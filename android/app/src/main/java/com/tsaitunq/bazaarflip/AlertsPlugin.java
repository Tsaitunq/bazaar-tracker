package com.tsaitunq.bazaarflip;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.core.app.NotificationManagerCompat;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.concurrent.TimeUnit;

/**
 * Bridge between the web app and the background check. The web app keeps favourites and settings
 * in the WebView's localStorage; the worker runs without the WebView, so they are mirrored here.
 */
@CapacitorPlugin(
    name = "BazaarAlerts",
    permissions = @Permission(alias = AlertsPlugin.NOTIFICATIONS, strings = { Manifest.permission.POST_NOTIFICATIONS })
)
public class AlertsPlugin extends Plugin {
    static final String NOTIFICATIONS = "notifications";
    static final String PREFS = "alerts";
    static final String KEY_CONFIG = "config";
    static final String KEY_ABOVE = "above";
    private static final String WORK = "bazaar-alerts";

    @PluginMethod
    public void configure(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        JSONObject favs = new JSONObject();
        JSArray list = call.getArray("favs", new JSArray());
        try {
            for (int i = 0; i < list.length(); i++) {
                JSONObject fav = list.optJSONObject(i);
                if (fav != null && !fav.optString("id").isEmpty()) favs.put(fav.optString("id"), fav.optString("name"));
            }
            JSONObject config = new JSONObject()
                .put("enabled", enabled)
                .put("minMargin", call.getDouble("minMargin", 0.05))
                .put("tax", call.getDouble("tax", 0.0125))
                .put("favs", favs);
            SharedPreferences.Editor edit = prefs(getContext()).edit().putString(KEY_CONFIG, config.toString());
            // Forget the last result when switched off, so switching on again reports current hits.
            if (!enabled) edit.remove(KEY_ABOVE);
            edit.apply();
        } catch (JSONException e) {
            call.reject("invalid alert configuration", e);
            return;
        }

        WorkManager work = WorkManager.getInstance(getContext());
        boolean scheduled = enabled && favs.length() > 0;
        if (scheduled) {
            // 15 minutes is the shortest period Android allows; KEEP leaves a running schedule untouched.
            PeriodicWorkRequest request = new PeriodicWorkRequest.Builder(AlertWorker.class, 15, TimeUnit.MINUTES)
                .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build();
            work.enqueueUniquePeriodicWork(WORK, ExistingPeriodicWorkPolicy.KEEP, request);
        } else {
            work.cancelUniqueWork(WORK);
        }
        call.resolve(new JSObject().put("scheduled", scheduled));
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !granted()) {
            requestPermissionForAlias(NOTIFICATIONS, call, "permissionResult");
        } else {
            permissionResult(call);
        }
    }

    @PermissionCallback
    private void permissionResult(PluginCall call) {
        call.resolve(new JSObject().put("granted", granted()));
    }

    // Also false when the user switched the app's notifications off on Android 12 and older.
    private boolean granted() {
        return NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
    }

    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}

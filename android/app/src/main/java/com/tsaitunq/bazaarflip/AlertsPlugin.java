package com.tsaitunq.bazaarflip;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
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

import java.io.DataInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
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
    static final String KEY_MARKET_QUALIFIED = "marketQualified";
    static final String KEY_MARKET_NOTIFIED = "marketNotified";
    static final String KEY_TIMING_SHOWN = "timingShown";
    static final String EXTRA_ROUTE = "route";
    private static final String NAMES_FILE = "names.json";
    private static final String WORK = "bazaar-alerts";

    @Override
    public void load() {
        route(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        route(intent);
    }

    // A tapped notification carries the page to open; retained until the web app listens.
    private void route(Intent intent) {
        String hash = intent == null ? null : intent.getStringExtra(EXTRA_ROUTE);
        if (hash == null) return;
        intent.removeExtra(EXTRA_ROUTE);
        notifyListeners("route", new JSObject().put("hash", hash), true);
    }

    @PluginMethod
    public void configure(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        JSObject market = call.getObject("market", new JSObject());
        boolean marketEnabled = market.optBoolean("enabled");
        JSObject timing = call.getObject("timing", new JSObject());
        boolean timingEnabled = timing.optBoolean("events") || timing.optBoolean("mayor");
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
                .put("favs", favs)
                .put("market", market)
                .put("timing", timing);
            SharedPreferences.Editor edit = prefs(getContext()).edit().putString(KEY_CONFIG, config.toString());
            // Forget the last result when switched off, so switching on again reports current hits.
            if (!enabled) edit.remove(KEY_ABOVE);
            if (!marketEnabled) edit.remove(KEY_MARKET_QUALIFIED).remove(KEY_MARKET_NOTIFIED);
            if (!timingEnabled) edit.remove(KEY_TIMING_SHOWN);
            edit.apply();
        } catch (JSONException e) {
            call.reject("invalid alert configuration", e);
            return;
        }

        WorkManager work = WorkManager.getInstance(getContext());
        boolean scheduled = (enabled && favs.length() > 0) || marketEnabled || timingEnabled;
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

    /** Item names for market notifications; the worker cannot ask the web app for them. */
    @PluginMethod
    public void setNames(PluginCall call) {
        try (FileOutputStream out = new FileOutputStream(namesFile(getContext()))) {
            out.write(call.getObject("names", new JSObject()).toString().getBytes(StandardCharsets.UTF_8));
            call.resolve();
        } catch (IOException e) {
            call.reject("could not store item names", e);
        }
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

    private static File namesFile(Context context) {
        return new File(context.getFilesDir(), NAMES_FILE);
    }

    /** Empty when the web app has not stored names yet; notifications then show item ids. */
    static Map<String, String> names(Context context) {
        File file = namesFile(context);
        byte[] data = new byte[(int) file.length()];
        try (DataInputStream in = new DataInputStream(new FileInputStream(file))) {
            in.readFully(data);
            return AlertWorker.strings(new JSONObject(new String(data, StandardCharsets.UTF_8)));
        } catch (IOException | JSONException e) {
            return new HashMap<>();
        }
    }
}

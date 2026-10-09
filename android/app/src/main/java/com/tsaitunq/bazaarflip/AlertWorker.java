package com.tsaitunq.bazaarflip;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.Reader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Periodic check: notifies when a favourite newly reaches the configured minimum margin. */
public class AlertWorker extends Worker {
    private static final String API = "https://api.hypixel.net/v2/skyblock/bazaar";
    private static final String CHANNEL = "flips";
    private static final int NOTIFICATION_ID = 1;
    private static final int TIMEOUT_MS = 30_000;

    public AlertWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        SharedPreferences prefs = AlertsPlugin.prefs(getApplicationContext());
        try {
            JSONObject config = new JSONObject(prefs.getString(AlertsPlugin.KEY_CONFIG, "{}"));
            JSONObject favs = config.optJSONObject("favs");
            if (!config.optBoolean("enabled") || favs == null || favs.length() == 0) return Result.success();

            Map<String, String> names = new HashMap<>();
            for (Iterator<String> it = favs.keys(); it.hasNext();) {
                String id = it.next();
                names.put(id, favs.optString(id, id));
            }
            double tax = config.optDouble("tax", 0.0125);
            double minMargin = config.optDouble("minMargin", 0.05);

            Map<String, double[]> prices = fetchPrices(names.keySet());
            Set<String> above = AlertLogic.above(prices, tax, minMargin);
            Set<String> before = prefs.getStringSet(AlertsPlugin.KEY_ABOVE, Collections.emptySet());
            Set<String> crossed = AlertLogic.crossed(above, before);
            prefs.edit().putStringSet(AlertsPlugin.KEY_ABOVE, new HashSet<>(above)).apply();

            if (!crossed.isEmpty()) {
                show(AlertLogic.title(crossed.size(), minMargin * 100), AlertLogic.lines(crossed, prices, names, tax));
            }
            return Result.success();
        } catch (IOException e) {
            return Result.retry();
        } catch (JSONException e) {
            return Result.failure();
        }
    }

    private Map<String, double[]> fetchPrices(Set<String> ids) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) new URL(API).openConnection();
        connection.setConnectTimeout(TIMEOUT_MS);
        connection.setReadTimeout(TIMEOUT_MS);
        try {
            if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) {
                throw new IOException("HTTP " + connection.getResponseCode());
            }
            try (Reader reader = new BufferedReader(new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
                return AlertLogic.readPrices(reader, ids);
            }
        } finally {
            connection.disconnect();
        }
    }

    private void show(String title, List<String> lines) {
        Context context = getApplicationContext();
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null || !manager.areNotificationsEnabled()) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(new NotificationChannel(
                CHANNEL, context.getString(R.string.alert_channel), NotificationManager.IMPORTANCE_DEFAULT));
        }
        Intent open = new Intent(context, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent tap = PendingIntent.getActivity(
            context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String text = String.join("\n", lines);
        manager.notify(NOTIFICATION_ID, new NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_coin)
            .setColor(context.getColor(R.color.gold))
            .setContentTitle(title)
            .setContentText(lines.get(0))
            .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
            .setContentIntent(tap)
            .setAutoCancel(true)
            .build());
    }
}

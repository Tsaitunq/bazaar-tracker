package com.tsaitunq.bazaarflip;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import com.tsaitunq.bazaarflip.AlertLogic.Flip;
import com.tsaitunq.bazaarflip.AlertLogic.Product;
import com.tsaitunq.bazaarflip.AlertLogic.Stat;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.Reader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Periodic check with two independent parts: favourites that newly reach their minimum margin,
 * and market-wide opportunities that newly meet every market alert condition.
 */
public class AlertWorker extends Worker {
    private static final String API = "https://api.hypixel.net/v2/skyblock/bazaar";
    private static final String STATS = "https://raw.githubusercontent.com/Tsaitunq/bazaar-tracker/data/stats.json";
    private static final int TIMEOUT_MS = 30_000;
    private static final long HOUR_MS = 3_600_000L;
    // channel id, channel name, notification id
    private static final Object[] FAVORITES = { "flips", R.string.alert_channel, 1 };
    private static final Object[] MARKET = { "market", R.string.market_channel, 2 };

    private interface Parser<T> {
        T parse(Reader reader) throws IOException;
    }

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
            JSONObject market = config.optJSONObject("market");
            boolean favoritesOn = config.optBoolean("enabled") && favs != null && favs.length() > 0;
            boolean marketOn = market != null && market.optBoolean("enabled");
            if (!favoritesOn && !marketOn) return Result.success();

            double tax = config.optDouble("tax", 0.0125);
            Map<String, Product> products = fetch(API, AlertLogic::readMarket);
            if (favoritesOn) checkFavorites(prefs, products, favs, tax, config.optDouble("minMargin", 0.05));
            if (marketOn) {
                try {
                    checkMarket(prefs, products, market, tax);
                } catch (IOException e) {
                    // Without the stats file "stable" cannot be verified; skip this round, favourites are done.
                }
            }
            return Result.success();
        } catch (IOException e) {
            return Result.retry();
        } catch (JSONException e) {
            return Result.failure();
        }
    }

    private void checkFavorites(SharedPreferences prefs, Map<String, Product> products, JSONObject favs,
            double tax, double minMargin) {
        Map<String, String> names = strings(favs);
        Map<String, double[]> prices = AlertLogic.prices(products, names.keySet());
        Set<String> above = AlertLogic.above(prices, tax, minMargin);
        Set<String> crossed = AlertLogic.crossed(above, prefs.getStringSet(AlertsPlugin.KEY_ABOVE, Collections.emptySet()));
        prefs.edit().putStringSet(AlertsPlugin.KEY_ABOVE, new HashSet<>(above)).apply();
        if (!crossed.isEmpty()) {
            show(FAVORITES, AlertLogic.title(crossed.size(), minMargin * 100),
                AlertLogic.lines(crossed, prices, names, tax), "#/flips");
        }
    }

    private void checkMarket(SharedPreferences prefs, Map<String, Product> products, JSONObject market, double tax)
            throws IOException, JSONException {
        Map<String, Stat> stats = fetch(STATS, AlertLogic::readStats);
        List<Flip> hits = AlertLogic.opportunities(products, stats, tax,
            market.optDouble("maxCapital", 0), market.optDouble("share", 1), market.optDouble("minMargin", 0.10),
            market.optDouble("minVolume", 0), market.optDouble("minProfitHour", 0));
        List<String> qualifying = new ArrayList<>();
        for (Flip f : hits) qualifying.add(f.id);

        long now = System.currentTimeMillis();
        long cooldown = Math.round(market.optDouble("cooldownHours", 6) * HOUR_MS);
        JSONObject stored = new JSONObject(prefs.getString(AlertsPlugin.KEY_MARKET_NOTIFIED, "{}"));
        Map<String, Long> notified = new HashMap<>();
        for (Iterator<String> it = stored.keys(); it.hasNext();) {
            String id = it.next();
            // entries past the cooldown no longer block anything
            if (now - stored.optLong(id) < cooldown) notified.put(id, stored.optLong(id));
        }
        Set<String> before = prefs.getStringSet(AlertsPlugin.KEY_MARKET_QUALIFIED, Collections.emptySet());
        List<String> due = AlertLogic.due(qualifying, before, notified, now, cooldown);
        for (String id : due) notified.put(id, now);
        prefs.edit()
            .putStringSet(AlertsPlugin.KEY_MARKET_QUALIFIED, new HashSet<>(qualifying))
            .putString(AlertsPlugin.KEY_MARKET_NOTIFIED, new JSONObject(notified).toString())
            .apply();
        if (due.isEmpty()) return;

        List<Flip> dueFlips = new ArrayList<>();
        for (Flip f : hits) if (due.contains(f.id)) dueFlips.add(f);
        // one hit opens its detail page, several open the filtered list
        String route = dueFlips.size() == 1 ? "#/item/" + Uri.encode(dueFlips.get(0).id) : "#/opps";
        show(MARKET, AlertLogic.marketTitle(dueFlips.size()),
            AlertLogic.marketLines(dueFlips, AlertsPlugin.names(getApplicationContext())), route);
    }

    static Map<String, String> strings(JSONObject object) {
        Map<String, String> out = new HashMap<>();
        for (Iterator<String> it = object.keys(); it.hasNext();) {
            String key = it.next();
            out.put(key, object.optString(key, key));
        }
        return out;
    }

    private <T> T fetch(String url, Parser<T> parser) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setConnectTimeout(TIMEOUT_MS);
        connection.setReadTimeout(TIMEOUT_MS);
        try {
            if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) {
                throw new IOException("HTTP " + connection.getResponseCode());
            }
            try (Reader reader = new BufferedReader(new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
                return parser.parse(reader);
            }
        } finally {
            connection.disconnect();
        }
    }

    private void show(Object[] kind, String title, List<String> lines, String route) {
        Context context = getApplicationContext();
        String channel = (String) kind[0];
        int id = (Integer) kind[2];
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null || !manager.areNotificationsEnabled()) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(new NotificationChannel(
                channel, context.getString((Integer) kind[1]), NotificationManager.IMPORTANCE_DEFAULT));
        }
        Intent open = new Intent(context, MainActivity.class)
            .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP)
            .putExtra(AlertsPlugin.EXTRA_ROUTE, route);
        // the notification id doubles as request code so the two kinds keep separate intents
        PendingIntent tap = PendingIntent.getActivity(
            context, id, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        manager.notify(id, new NotificationCompat.Builder(context, channel)
            .setSmallIcon(R.drawable.ic_stat_coin)
            .setColor(context.getColor(R.color.gold))
            .setContentTitle(title)
            .setContentText(lines.get(0))
            .setStyle(new NotificationCompat.BigTextStyle().bigText(String.join("\n", lines)))
            .setContentIntent(tap)
            .setAutoCancel(true)
            .build());
    }
}

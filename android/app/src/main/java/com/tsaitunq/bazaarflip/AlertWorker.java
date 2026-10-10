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

import com.tsaitunq.bazaarflip.AlertLogic.Candidate;
import com.tsaitunq.bazaarflip.AlertLogic.Flip;
import com.tsaitunq.bazaarflip.AlertLogic.Notice;
import com.tsaitunq.bazaarflip.AlertLogic.PlanItem;
import com.tsaitunq.bazaarflip.AlertLogic.Product;
import com.tsaitunq.bazaarflip.AlertLogic.Stat;
import com.tsaitunq.bazaarflip.AlertLogic.Warning;

import org.json.JSONArray;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Periodic check with four independent parts: favourites that newly reach their minimum margin,
 * market-wide opportunities that newly meet every market alert condition, notices about
 * events and mayors that the snapshot run prepared, and warnings about the flips of the stored portfolio.
 */
public class AlertWorker extends Worker {
    private static final String API = "https://api.hypixel.net/v2/skyblock/bazaar";
    private static final String TIMING = "https://raw.githubusercontent.com/Tsaitunq/bazaar-tracker/data/timing.json";
    private static final String STATS = "https://raw.githubusercontent.com/Tsaitunq/bazaar-tracker/data/stats.json";
    private static final String ELECTION = "https://raw.githubusercontent.com/Tsaitunq/bazaar-tracker/data/election.json";
    private static final int TIMEOUT_MS = 30_000;
    private static final long HOUR_MS = 3_600_000L;
    // channel id, channel name, notification id
    private static final Object[] FAVORITES = { "flips", R.string.alert_channel, 1 };
    private static final Object[] MARKET = { "market", R.string.market_channel, 2 };
    private static final Object[] EVENT = { "timing", R.string.timing_channel, 3 };
    private static final Object[] MAYOR = { "timing", R.string.timing_channel, 4 };
    private static final Object[] PORTFOLIO = { "portfolio", R.string.portfolio_channel, 5 };

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
            JSONObject timing = config.optJSONObject("timing");
            boolean eventsOn = timing != null && timing.optBoolean("events");
            boolean mayorOn = timing != null && timing.optBoolean("mayor");
            if (eventsOn || mayorOn) {
                try {
                    checkTiming(prefs, eventsOn, mayorOn);
                } catch (IOException e) {
                    // A notice is due for hours; the next round shows it.
                }
            }
            JSONObject plan = config.optJSONObject("portfolio");
            boolean planOn = AlertsPlugin.portfolioEnabled(plan);
            boolean planMarketOn = planOn && (plan.optBoolean("price") || plan.optBoolean("suspicious"));
            List<Warning> warnings = planOn ? voteWarnings(plan) : new ArrayList<>();
            if (!favoritesOn && !marketOn && !planMarketOn) {
                notifyPlan(prefs, plan, warnings);
                return Result.success();
            }

            double tax = config.optDouble("tax", 0.0125);
            Map<String, Product> products = fetch(API, AlertLogic::readMarket);
            if (favoritesOn) checkFavorites(prefs, products, favs, tax, config.optDouble("minMargin", 0.05));
            Map<String, Stat> stats = null;
            if (marketOn || planMarketOn) {
                try {
                    stats = fetch(STATS, AlertLogic::readStats);
                } catch (IOException e) {
                    // Without the stats file "stable" cannot be verified: market alerts skip this round.
                    // The plan is still checked, only without the comparison with the normal price.
                }
            }
            if (marketOn && stats != null) checkMarket(prefs, products, market, tax, stats);
            if (planMarketOn) {
                for (Warning w : AlertLogic.planWarnings(planItems(plan), products, stats == null ? new HashMap<>() : stats,
                        tax, plan.optDouble("drop", 0.05))) {
                    if (plan.optBoolean(w.kind)) warnings.add(w);
                }
            }
            notifyPlan(prefs, plan, warnings);
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

    private void checkMarket(SharedPreferences prefs, Map<String, Product> products, JSONObject market, double tax,
            Map<String, Stat> stats) throws JSONException {
        List<Flip> hits = AlertLogic.opportunities(products, stats, tax,
            market.optDouble("maxCapital", 0), market.optDouble("share", 1), market.optDouble("minMargin", 0.10),
            market.optDouble("minVolume", 0), market.optDouble("minProfitHour", 0));
        List<String> qualifying = new ArrayList<>();
        for (Flip f : hits) qualifying.add(f.id);

        long now = System.currentTimeMillis();
        long cooldown = Math.round(market.optDouble("cooldownHours", 6) * HOUR_MS);
        Map<String, Long> notified = recent(prefs.getString(AlertsPlugin.KEY_MARKET_NOTIFIED, "{}"), now, cooldown);
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

    /** The stored "when was this last reported" map, without the entries past the cooldown: they no longer block anything. */
    private static Map<String, Long> recent(String json, long now, long cooldown) throws JSONException {
        JSONObject stored = new JSONObject(json);
        Map<String, Long> out = new HashMap<>();
        for (Iterator<String> it = stored.keys(); it.hasNext();) {
            String key = it.next();
            if (now - stored.optLong(key) < cooldown) out.put(key, stored.optLong(key));
        }
        return out;
    }

    private static List<PlanItem> planItems(JSONObject plan) {
        List<PlanItem> out = new ArrayList<>();
        JSONArray items = plan.optJSONArray("items");
        for (int i = 0; items != null && i < items.length(); i++) {
            JSONObject item = items.optJSONObject(i);
            if (item != null && !item.optString("id").isEmpty()) out.add(new PlanItem(item.optString("id"), item.optDouble("buy")));
        }
        return out;
    }

    /** Election and "mayor leaves" warnings for the plan, as far as their switches are on. */
    private List<Warning> voteWarnings(JSONObject plan) {
        List<Warning> out = new ArrayList<>();
        Map<String, List<String>> itemPerks = new LinkedHashMap<>();
        JSONObject perks = plan.optJSONObject("perks");
        for (Iterator<String> it = perks == null ? Collections.emptyIterator() : perks.keys(); it.hasNext();) {
            String id = it.next();
            List<String> list = new ArrayList<>();
            JSONArray names = perks.optJSONArray(id);
            for (int i = 0; names != null && i < names.length(); i++) list.add(names.optString(i));
            itemPerks.put(id, list);
        }
        if (itemPerks.isEmpty()) return out;
        if (plan.optBoolean("election")) {
            try {
                List<Candidate> candidates = fetch(ELECTION, AlertLogic::readCandidates);
                out.addAll(AlertLogic.electionWarnings(candidates, itemPerks));
            } catch (IOException e) {
                // An election runs for days; the next round asks again.
            }
        }
        JSONObject term = plan.optJSONObject("term");
        JSONObject termPerks = term == null ? null : term.optJSONObject("perks");
        if (plan.optBoolean("leaving") && termPerks != null) {
            Map<String, String> by = new LinkedHashMap<>();
            for (Iterator<String> it = termPerks.keys(); it.hasNext();) {
                String perk = it.next();
                by.put(perk, termPerks.optString(perk));
            }
            out.addAll(AlertLogic.leavingWarnings(term.optLong("end"), by, itemPerks, System.currentTimeMillis()));
        }
        return out;
    }

    /** One notification for the warnings that were not reported within the cooldown, per item and kind. */
    private void notifyPlan(SharedPreferences prefs, JSONObject plan, List<Warning> warnings) throws JSONException {
        if (warnings.isEmpty()) return;
        long now = System.currentTimeMillis();
        long cooldown = Math.round(plan.optDouble("cooldownHours", 6) * HOUR_MS);
        Map<String, Long> notified = recent(prefs.getString(AlertsPlugin.KEY_PLAN_NOTIFIED, "{}"), now, cooldown);
        List<Warning> due = new ArrayList<>();
        for (Warning w : warnings) {
            String key = w.id + "|" + w.kind;
            if (notified.containsKey(key)) continue;
            notified.put(key, now);
            due.add(w);
        }
        prefs.edit().putString(AlertsPlugin.KEY_PLAN_NOTIFIED, new JSONObject(notified).toString()).apply();
        if (due.isEmpty()) return;
        show(PORTFOLIO, AlertLogic.planTitle(due.size()),
            AlertLogic.planLines(due, AlertsPlugin.names(getApplicationContext())), "#/opps");
    }

    private void checkTiming(SharedPreferences prefs, boolean events, boolean mayor) throws IOException {
        List<Notice> all = fetch(TIMING, AlertLogic::readNotices);
        Set<String> shown = prefs.getStringSet(AlertsPlugin.KEY_TIMING_SHOWN, Collections.emptySet());
        List<Notice> due = AlertLogic.dueNotices(all, events, mayor, shown, System.currentTimeMillis());
        // only notices that are still in the file are remembered, so the set stays small
        Set<String> keep = new HashSet<>();
        for (Notice n : all) if (shown.contains(n.key)) keep.add(n.key);
        for (Notice n : due) keep.add(n.key);
        prefs.edit().putStringSet(AlertsPlugin.KEY_TIMING_SHOWN, keep).apply();
        Map<String, String> names = AlertsPlugin.names(getApplicationContext());
        for (Notice n : due) {
            show(n.kind.equals("mayor") ? MAYOR : EVENT, n.title, AlertLogic.noticeLines(n, names), "#/flips");
        }
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
            .setSmallIcon(R.drawable.ic_stat_bars)
            .setColor(context.getColor(R.color.accent))
            .setContentTitle(title)
            .setContentText(lines.get(0))
            .setStyle(new NotificationCompat.BigTextStyle().bigText(String.join("\n", lines)))
            .setContentIntent(tap)
            .setAutoCancel(true)
            .build());
    }
}

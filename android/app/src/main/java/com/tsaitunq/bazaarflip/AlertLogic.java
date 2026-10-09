package com.tsaitunq.bazaarflip;

import com.google.gson.stream.JsonReader;
import com.google.gson.stream.JsonToken;

import java.io.IOException;
import java.io.Reader;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Pure logic of the background check. No Android classes, so it runs in JVM unit tests.
 * The flip maths mirrors flips.js; change both together.
 */
final class AlertLogic {
    // Same names and values as the constants in flips.js.
    static final double MEDIAN_SPIKE = 0.3;
    static final double PROVISIONAL_HOURS = 24;
    /** Stability score from which the app shows the "stable" badge. */
    static final int STABLE = 70;
    static final int MAX_LINES = 3;
    private static final double HOURS_PER_WEEK = 168;
    private static final DecimalFormatSymbols EN = new DecimalFormatSymbols(Locale.US);

    private AlertLogic() {}

    /** One bazaar product: top of both order book sides plus weekly volume and order counts. */
    static final class Product {
        final double buy;
        final double sell;
        final double buyWeek;
        final double sellWeek;
        final double buyOrders;
        final double sellOrders;

        Product(double buy, double sell, double buyWeek, double sellWeek, double buyOrders, double sellOrders) {
            this.buy = buy;
            this.sell = sell;
            this.buyWeek = buyWeek;
            this.sellWeek = sellWeek;
            this.buyOrders = buyOrders;
            this.sellOrders = sellOrders;
        }
    }

    /** One entry of stats.json. score is NaN when the item has too few points for one. */
    static final class Stat {
        final double score;
        final double median;
        final double hours;

        Stat(double score, double median, double hours) {
            this.score = score;
            this.median = median;
            this.hours = hours;
        }

        boolean provisional() {
            return !(hours >= PROVISIONAL_HOURS);
        }
    }

    static final class Flip {
        final String id;
        final double buy;
        final double margin;
        final double weekVol;
        final double profitHour;
        final boolean suspicious;

        Flip(String id, double buy, double margin, double weekVol, double profitHour, boolean suspicious) {
            this.id = id;
            this.buy = buy;
            this.margin = margin;
            this.weekVol = weekVol;
            this.profitHour = profitHour;
            this.suspicious = suspicious;
        }
    }

    /** Streams the bazaar response. Products without both order book sides are left out. */
    static Map<String, Product> readMarket(Reader json) throws IOException {
        Map<String, Product> out = new HashMap<>();
        boolean success = false;
        try (JsonReader r = new JsonReader(json)) {
            r.beginObject();
            while (r.hasNext()) {
                String key = r.nextName();
                if (key.equals("success")) success = r.nextBoolean();
                else if (key.equals("products")) readProducts(r, out);
                else r.skipValue();
            }
            r.endObject();
        } catch (IllegalStateException | NumberFormatException e) {
            throw new IOException("unexpected bazaar response", e);
        }
        if (!success) throw new IOException("bazaar API reported failure");
        return out;
    }

    private static void readProducts(JsonReader r, Map<String, Product> out) throws IOException {
        r.beginObject();
        while (r.hasNext()) {
            String id = r.nextName();
            double buy = Double.NaN;
            double sell = Double.NaN;
            double[] status = new double[4];
            r.beginObject();
            while (r.hasNext()) {
                String key = r.nextName();
                // API names are from the instant buyer's view: sell_summary holds buy orders.
                if (key.equals("sell_summary")) buy = topPrice(r);
                else if (key.equals("buy_summary")) sell = topPrice(r);
                else if (key.equals("quick_status")) status = quickStatus(r);
                else r.skipValue();
            }
            r.endObject();
            if (buy > 0 && sell > 0) out.put(id, new Product(buy, sell, status[0], status[1], status[2], status[3]));
        }
        r.endObject();
    }

    /**
     * Price of the best order, however small it is. A flipper trades at the top of the book;
     * looking deeper can only widen the spread and overstate the margin. Same rule as bookPrices in flips.js.
     */
    private static double topPrice(JsonReader r) throws IOException {
        double price = Double.NaN;
        r.beginArray();
        if (r.hasNext()) {
            r.beginObject();
            while (r.hasNext()) {
                if (r.nextName().equals("pricePerUnit")) price = r.nextDouble();
                else r.skipValue();
            }
            r.endObject();
        }
        while (r.hasNext()) r.skipValue();
        r.endArray();
        return price;
    }

    /** {buyMovingWeek, sellMovingWeek, buyOrders, sellOrders}; missing fields stay 0. */
    private static double[] quickStatus(JsonReader r) throws IOException {
        double[] out = new double[4];
        r.beginObject();
        while (r.hasNext()) {
            switch (r.nextName()) {
                case "buyMovingWeek": out[0] = r.nextDouble(); break;
                case "sellMovingWeek": out[1] = r.nextDouble(); break;
                case "buyOrders": out[2] = r.nextDouble(); break;
                case "sellOrders": out[3] = r.nextDouble(); break;
                default: r.skipValue();
            }
        }
        r.endObject();
        return out;
    }

    /** Reads stats.json of the data branch: {"t": minutes, "i": {id: [score | null, medianSell, hours]}}. */
    static Map<String, Stat> readStats(Reader json) throws IOException {
        Map<String, Stat> out = new HashMap<>();
        try (JsonReader r = new JsonReader(json)) {
            r.beginObject();
            while (r.hasNext()) {
                if (!r.nextName().equals("i")) {
                    r.skipValue();
                    continue;
                }
                r.beginObject();
                while (r.hasNext()) {
                    String id = r.nextName();
                    double[] v = { Double.NaN, Double.NaN, 0 };
                    r.beginArray();
                    for (int i = 0; r.hasNext(); i++) {
                        if (i < v.length && r.peek() != JsonToken.NULL) v[i] = r.nextDouble();
                        else r.skipValue();
                    }
                    r.endArray();
                    out.put(id, new Stat(v[0], v[1], v[2]));
                }
                r.endObject();
            }
            r.endObject();
        } catch (IllegalStateException | NumberFormatException e) {
            throw new IOException("unexpected stats file", e);
        }
        return out;
    }

    /** {buyOrder, sellOffer} for the requested ids that are on the market. */
    static Map<String, double[]> prices(Map<String, Product> market, Set<String> ids) {
        Map<String, double[]> out = new HashMap<>();
        for (String id : ids) {
            Product p = market.get(id);
            if (p != null) out.put(id, new double[] { p.buy, p.sell });
        }
        return out;
    }

    static double margin(double buy, double sell, double tax) {
        return (sell * (1 - tax) - buy) / buy;
    }

    /**
     * Same result as computeFlip in flips.js. share and tax are fractions; maxCapital 0 means no limit;
     * median is the 7 day median sell price, or NaN when unknown.
     */
    static Flip flip(String id, Product p, double tax, double maxCapital, double share, double median) {
        double weekVol = Math.min(p.buyWeek, p.sellWeek);
        double hourVol = weekVol / HOURS_PER_WEEK;
        double reach = hourVol * share;
        double units = maxCapital > 0 ? Math.min(reach, Math.floor(maxCapital / p.buy)) : reach;
        double profit = p.sell * (1 - tax) - p.buy;
        double margin = profit / p.buy;
        boolean suspicious = margin > 2 || (margin > 0.5 && hourVol < 100) || p.buyOrders < 3 || p.sellOrders < 3
            || (median > 0 && p.sell > median * (1 + MEDIAN_SPIKE));
        return new Flip(id, p.buy, margin, weekVol, units * profit, suspicious);
    }

    /**
     * Flips that meet every market alert condition, best profit per hour first: at least a day of
     * history, a stable score, no suspicious flag, margin, weekly volume, profit per hour, and a
     * price within the capital limit. Same rules as opportunities in flips.js.
     */
    static List<Flip> opportunities(Map<String, Product> market, Map<String, Stat> stats, double tax,
            double maxCapital, double share, double minMargin, double minVolume, double minProfitHour) {
        List<Flip> out = new ArrayList<>();
        for (Map.Entry<String, Product> e : market.entrySet()) {
            Stat stat = stats.get(e.getKey());
            if (stat == null || stat.provisional() || !(stat.score >= STABLE)) continue;
            Flip f = flip(e.getKey(), e.getValue(), tax, maxCapital, share, stat.median);
            if (!f.suspicious && f.margin >= minMargin && f.weekVol >= minVolume && f.profitHour >= minProfitHour
                    && !(maxCapital > 0 && f.buy > maxCapital)) {
                out.add(f);
            }
        }
        out.sort((a, b) -> Double.compare(b.profitHour, a.profitHour));
        return out;
    }

    /**
     * Ids to notify about: qualifying now, not qualifying in the previous run, and not notified
     * within the cooldown. Keeps the order of {@code qualifying}.
     */
    static List<String> due(List<String> qualifying, Set<String> qualifiedBefore, Map<String, Long> lastNotified,
            long now, long cooldownMs) {
        List<String> out = new ArrayList<>();
        for (String id : qualifying) {
            Long last = lastNotified.get(id);
            if (!qualifiedBefore.contains(id) && (last == null || now - last >= cooldownMs)) out.add(id);
        }
        return out;
    }

    static Set<String> above(Map<String, double[]> prices, double tax, double minMargin) {
        Set<String> out = new HashSet<>();
        for (Map.Entry<String, double[]> e : prices.entrySet()) {
            if (margin(e.getValue()[0], e.getValue()[1], tax) >= minMargin) out.add(e.getKey());
        }
        return out;
    }

    /** Ids that are above the threshold now and were not in the previous run. */
    static Set<String> crossed(Set<String> aboveNow, Set<String> aboveBefore) {
        Set<String> out = new HashSet<>(aboveNow);
        out.removeAll(aboveBefore);
        return out;
    }

    static String title(int count, double minMarginPercent) {
        return count + (count == 1 ? " favorite" : " favorites") + " above "
            + new DecimalFormat("#.#", EN).format(minMarginPercent) + "% margin";
    }

    /** One line per id, best margin first; falls back to the id when no name is known. */
    static List<String> lines(Set<String> ids, Map<String, double[]> prices, Map<String, String> names, double tax) {
        List<String> sorted = new ArrayList<>(ids);
        sorted.sort((a, b) -> Double.compare(
            margin(prices.get(b)[0], prices.get(b)[1], tax), margin(prices.get(a)[0], prices.get(a)[1], tax)));
        List<String> out = new ArrayList<>();
        for (String id : sorted) {
            out.add(line(name(names, id), margin(prices.get(id)[0], prices.get(id)[1], tax)));
        }
        return out;
    }

    static String line(String name, double margin) {
        return name + ": " + percent(margin);
    }

    static String marketTitle(int count) {
        return count + (count == 1 ? " market opportunity" : " market opportunities");
    }

    /** The first three hits with margin and profit per hour, then "+N more". */
    static List<String> marketLines(List<Flip> hits, Map<String, String> names) {
        List<String> out = new ArrayList<>();
        for (Flip f : hits.subList(0, Math.min(MAX_LINES, hits.size()))) {
            out.add(name(names, f.id) + ": " + percent(f.margin) + " · " + coins(f.profitHour) + "/h");
        }
        if (hits.size() > MAX_LINES) out.add("+" + (hits.size() - MAX_LINES) + " more");
        return out;
    }

    private static String name(Map<String, String> names, String id) {
        String name = names.get(id);
        return name == null || name.isEmpty() ? id : name;
    }

    private static String percent(double fraction) {
        return new DecimalFormat("0.0", EN).format(fraction * 100) + "%";
    }

    /** Same format as coins() in render.js: 1,234.5 below ten thousand, then 350k, 1.2M, 3.4B. */
    static String coins(double v) {
        DecimalFormat plain = new DecimalFormat("#,##0.#", EN);
        plain.setRoundingMode(RoundingMode.HALF_UP);
        double abs = Math.abs(v);
        if (abs < 9999.95) return plain.format(v);
        if (abs >= 1e9 * 0.99995) return plain.format(v / 1e9) + "B";
        if (abs >= 1e6 * 0.99995) return plain.format(v / 1e6) + "M";
        return plain.format(v / 1e3) + "k";
    }
}

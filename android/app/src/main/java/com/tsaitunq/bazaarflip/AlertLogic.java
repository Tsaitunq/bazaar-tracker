package com.tsaitunq.bazaarflip;

import com.google.gson.stream.JsonReader;

import java.io.IOException;
import java.io.Reader;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** Pure logic of the background check. No Android classes, so it runs in JVM unit tests. */
final class AlertLogic {
    private static final DecimalFormatSymbols DE = new DecimalFormatSymbols(Locale.GERMANY);

    private AlertLogic() {}

    /**
     * Streams the bazaar response and returns {buyOrder, sellOffer} for the requested ids.
     * Ids missing from the response or without both order book sides are left out.
     */
    static Map<String, double[]> readPrices(Reader json, Set<String> ids) throws IOException {
        Map<String, double[]> out = new HashMap<>();
        boolean success = false;
        try (JsonReader r = new JsonReader(json)) {
            r.beginObject();
            while (r.hasNext()) {
                String key = r.nextName();
                if (key.equals("success")) success = r.nextBoolean();
                else if (key.equals("products")) readProducts(r, ids, out);
                else r.skipValue();
            }
            r.endObject();
        } catch (IllegalStateException | NumberFormatException e) {
            throw new IOException("unexpected bazaar response", e);
        }
        if (!success) throw new IOException("bazaar API reported failure");
        return out;
    }

    private static void readProducts(JsonReader r, Set<String> ids, Map<String, double[]> out) throws IOException {
        r.beginObject();
        while (r.hasNext()) {
            String id = r.nextName();
            if (!ids.contains(id)) {
                r.skipValue();
                continue;
            }
            double buy = Double.NaN;
            double sell = Double.NaN;
            r.beginObject();
            while (r.hasNext()) {
                String key = r.nextName();
                // API names are from the instant buyer's view: sell_summary holds buy orders.
                if (key.equals("sell_summary")) buy = firstPrice(r);
                else if (key.equals("buy_summary")) sell = firstPrice(r);
                else r.skipValue();
            }
            r.endObject();
            if (buy > 0 && sell > 0) out.put(id, new double[] { buy, sell });
        }
        r.endObject();
    }

    private static double firstPrice(JsonReader r) throws IOException {
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

    static double margin(double buy, double sell, double tax) {
        return (sell * (1 - tax) - buy) / buy;
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
        return count + (count == 1 ? " Favorit" : " Favoriten") + " über "
            + new DecimalFormat("#.#", DE).format(minMarginPercent) + " % Marge";
    }

    static String line(String name, double margin) {
        return name + ": " + new DecimalFormat("0.0", DE).format(margin * 100) + " %";
    }
}

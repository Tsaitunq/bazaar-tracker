package com.tsaitunq.bazaarflip;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

import com.tsaitunq.bazaarflip.AlertLogic.Flip;
import com.tsaitunq.bazaarflip.AlertLogic.Product;
import com.tsaitunq.bazaarflip.AlertLogic.Stat;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import org.junit.Test;

import java.io.IOException;
import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class AlertLogicTest {
    private static final double TAX = 0.0125;
    private static final long HOUR = 3_600_000L;
    private static final double NONE = Double.NaN;

    private static final String RESPONSE = "{\"success\":true,\"lastUpdated\":1,\"products\":{"
        + "\"FULL\":{\"product_id\":\"FULL\",\"sell_summary\":[{\"amount\":5,\"pricePerUnit\":100.0,\"orders\":1},{\"pricePerUnit\":99.0}],"
        + "\"buy_summary\":[{\"amount\":2,\"pricePerUnit\":200.0}],"
        + "\"quick_status\":{\"productId\":\"FULL\",\"sellPrice\":1.5,\"sellMovingWeek\":3360000,\"sellOrders\":50,\"buyMovingWeek\":1680000,\"buyOrders\":40}},"
        + "\"NO_OFFERS\":{\"sell_summary\":[{\"pricePerUnit\":10.0}],\"buy_summary\":[]},"
        + "\"INK_SACK:4\":{\"sell_summary\":[{\"pricePerUnit\":3.5}],\"buy_summary\":[{\"pricePerUnit\":4.0}]}}}";

    private static Set<String> set(String... ids) {
        return new HashSet<>(Arrays.asList(ids));
    }

    /** A liquid product with many orders, like the helper in tests/flips.test.js. */
    private static Product product(double buy, double sell) {
        return new Product(buy, sell, 1_680_000, 3_360_000, 50, 50);
    }

    @Test
    public void readMarketKeepsCompleteProductsWithVolumeAndOrders() throws IOException {
        Map<String, Product> market = AlertLogic.readMarket(new StringReader(RESPONSE));
        assertEquals(set("FULL", "INK_SACK:4"), market.keySet());
        Product full = market.get("FULL");
        assertEquals(100.0, full.buy, 1e-9);
        assertEquals(200.0, full.sell, 1e-9);
        assertEquals(1_680_000, full.buyWeek, 1e-9);
        assertEquals(3_360_000, full.sellWeek, 1e-9);
        assertEquals(40, full.buyOrders, 1e-9);
        assertEquals(50, full.sellOrders, 1e-9);
        // no quick_status: volume and orders are 0, which makes the flip suspicious
        assertEquals(0, market.get("INK_SACK:4").buyWeek, 1e-9);
    }

    @Test
    public void readMarketRejectsFailureAndGarbage() {
        assertThrows(IOException.class, () -> AlertLogic.readMarket(new StringReader("{\"success\":false,\"cause\":\"x\"}")));
        assertThrows(IOException.class, () -> AlertLogic.readMarket(new StringReader("<html>")));
        assertThrows(IOException.class, () -> AlertLogic.readMarket(new StringReader("{\"success\":true,\"products\":[]}")));
    }

    @Test
    public void constantsMatchFlipsJs() {
        assertEquals(0.3, AlertLogic.MEDIAN_SPIKE, 0);
        assertEquals(24, AlertLogic.PROVISIONAL_HOURS, 0);
        assertEquals(70, AlertLogic.STABLE);
    }

    @Test
    public void thePriceIsTheTopOrderHoweverSmall() throws IOException {
        // same case as tests/flips.test.js
        String json = "{\"success\":true,\"products\":{\"X\":{"
            + "\"sell_summary\":[{\"amount\":1,\"pricePerUnit\":100.0},{\"amount\":5000,\"pricePerUnit\":90.0}],"
            + "\"buy_summary\":[{\"amount\":1,\"pricePerUnit\":110.0},{\"amount\":5000,\"pricePerUnit\":120.0}]}}}";
        Product p = AlertLogic.readMarket(new StringReader(json)).get("X");
        assertEquals(100, p.buy, 0);
        assertEquals(110, p.sell, 0);
    }

    /** Same real order books as tests/flips.test.js: the margin must not exceed the top-of-book margin. */
    @Test
    public void forRealOrderBooksTheMarginNeverExceedsTopOfBook() throws IOException {
        // Gradle runs unit tests from android/app
        String sample = new String(Files.readAllBytes(Paths.get("../../tests/fixtures/bazaar-sample.json")), StandardCharsets.UTF_8);
        Map<String, Product> market = AlertLogic.readMarket(new StringReader("{\"success\":true,\"products\":" + sample + "}"));
        JsonObject books = JsonParser.parseString(sample).getAsJsonObject();
        assertTrue(books.size() >= 20);
        for (Map.Entry<String, JsonElement> e : books.entrySet()) {
            JsonObject book = e.getValue().getAsJsonObject();
            double topBuy = book.getAsJsonArray("sell_summary").get(0).getAsJsonObject().get("pricePerUnit").getAsDouble();
            double topSell = book.getAsJsonArray("buy_summary").get(0).getAsJsonObject().get("pricePerUnit").getAsDouble();
            Product p = market.get(e.getKey());
            assertEquals(e.getKey(), topBuy, p.buy, 0);
            assertEquals(e.getKey(), topSell, p.sell, 0);
            double margin = AlertLogic.flip(e.getKey(), p, TAX, 0, 1, NONE).margin;
            assertTrue(e.getKey(), margin <= AlertLogic.margin(topBuy, topSell, TAX) + 1e-12);
        }
    }

    @Test
    public void readStatsReadsScoreMedianAndHours() throws IOException {
        Map<String, Stat> stats = AlertLogic.readStats(new StringReader(
            "{\"t\":29338000,\"i\":{\"A\":[82,150.5,48],\"INK_SACK:4\":[null,3.5,2.3],\"SHORT\":[90]}}"));
        assertEquals(82, stats.get("A").score, 0);
        assertEquals(150.5, stats.get("A").median, 0);
        assertFalse(stats.get("A").provisional());
        assertTrue(Double.isNaN(stats.get("INK_SACK:4").score));
        assertTrue(stats.get("INK_SACK:4").provisional());
        assertTrue(stats.get("SHORT").provisional());
        assertTrue(AlertLogic.readStats(new StringReader("{\"t\":1,\"i\":{}}")).isEmpty());
        assertThrows(IOException.class, () -> AlertLogic.readStats(new StringReader("404: Not Found")));
    }

    @Test
    public void provisionalBelowTwentyFourHours() {
        assertTrue(new Stat(82, 150, 23.9).provisional());
        assertFalse(new Stat(82, 150, 24).provisional());
    }

    @Test
    public void sellPriceFarAboveItsMedianIsSuspicious() {
        // same cases as tests/flips.test.js
        assertTrue(AlertLogic.flip("X", product(100, 131), TAX, 0, 1, 100).suspicious);
        assertFalse(AlertLogic.flip("X", product(100, 130), TAX, 0, 1, 100).suspicious);
        assertFalse(AlertLogic.flip("X", product(100, 131), TAX, 0, 1, Double.NaN).suspicious);
        assertFalse(AlertLogic.flip("X", product(100, 131), TAX, 0, 1, 0).suspicious);
    }

    @Test
    public void pricesPicksRequestedIdsThatExist() throws IOException {
        Map<String, double[]> prices = AlertLogic.prices(AlertLogic.readMarket(new StringReader(RESPONSE)), set("FULL", "MISSING"));
        assertEquals(set("FULL"), prices.keySet());
        assertEquals(200.0, prices.get("FULL")[1], 1e-9);
    }

    @Test
    public void marginMatchesTheApp() {
        assertEquals(0.975, AlertLogic.margin(100, 200, TAX), 1e-9);
        assertEquals(-0.0125, AlertLogic.margin(100, 100, TAX), 1e-9);
    }

    @Test
    public void flipMatchesComputeFlipInTheWebApp() {
        // same numbers as tests/flips.test.js
        Flip free = AlertLogic.flip("X", product(100, 200), TAX, 0, 1, NONE);
        assertEquals(0.975, free.margin, 1e-9);
        assertEquals(1_680_000, free.weekVol, 1e-9);
        assertEquals(975_000, free.profitHour, 1e-6);
        assertFalse(free.suspicious);
        assertEquals(4875, AlertLogic.flip("X", product(100, 200), TAX, 5000, 1, NONE).profitHour, 1e-6);
        assertEquals(48_750, AlertLogic.flip("X", product(100, 200), TAX, 0, 0.05, NONE).profitHour, 1e-6);
    }

    @Test
    public void flipFlagsSuspiciousProducts() {
        assertTrue(AlertLogic.flip("X", product(100, 400), TAX, 0, 1, NONE).suspicious);
        assertTrue(AlertLogic.flip("X", new Product(100, 200, 1680, 1680, 50, 50), TAX, 0, 1, NONE).suspicious);
        assertTrue(AlertLogic.flip("X", new Product(100, 110, 1_680_000, 3_360_000, 2, 50), TAX, 0, 1, NONE).suspicious);
        assertTrue(AlertLogic.flip("X", new Product(100, 110, 1_680_000, 3_360_000, 50, 2), TAX, 0, 1, NONE).suspicious);
        assertFalse(AlertLogic.flip("X", product(100, 110), TAX, 0, 1, NONE).suspicious);
    }

    @Test
    public void opportunitiesNeedEveryCondition() {
        Map<String, Product> market = new HashMap<>();
        market.put("GOOD", product(100, 120));          // margin 18.5 %, 50 units per hour within 5000 capital
        market.put("BEST", product(1000, 1300));        // margin 28.4 %, 5 units per hour within 5000 capital
        market.put("LOW_MARGIN", product(100, 105));
        market.put("UNSTABLE", product(100, 120));
        market.put("NO_SCORE", product(100, 120));
        market.put("SUSPICIOUS", product(100, 400));
        market.put("THIN", new Product(100, 120, 50_000, 50_000, 50, 50));
        market.put("PRICEY", product(9000, 12000));
        // the median equals the current sell price so the spike rule stays quiet
        Map<String, Stat> scores = new HashMap<>();
        for (Map.Entry<String, Product> e : market.entrySet()) scores.put(e.getKey(), new Stat(90, e.getValue().sell, 48));
        scores.put("UNSTABLE", new Stat(69, 120, 48));
        scores.remove("NO_SCORE");
        market.put("NEW", product(100, 120));           // good numbers, but only 5 hours of history
        scores.put("NEW", new Stat(90, 120, 5));
        market.put("SPIKE", product(100, 120));         // sell price 33 % above its median
        scores.put("SPIKE", new Stat(90, 90, 48));

        // GOOD: 50 x 18.5 = 925 per hour; BEST: 5 x 283.75 = 1418.75 per hour
        assertEquals(Arrays.asList("BEST", "GOOD"), ids(AlertLogic.opportunities(market, scores, TAX, 5000, 1, 0.10, 100_000, 900)));
        // the profit per hour floor applies after the capital cap
        assertEquals(Arrays.asList("BEST"), ids(AlertLogic.opportunities(market, scores, TAX, 5000, 1, 0.10, 100_000, 926)));
        // exactly at the stable threshold counts; no capital limit lets the pricey one in
        scores.put("UNSTABLE", new Stat(70, 120, 48));
        assertEquals(set("BEST", "GOOD", "UNSTABLE", "PRICEY"),
            new HashSet<>(ids(AlertLogic.opportunities(market, scores, TAX, 0, 1, 0.10, 100_000, 900))));
    }

    private static List<String> ids(List<Flip> flips) {
        List<String> out = new ArrayList<>();
        for (Flip f : flips) out.add(f.id);
        return out;
    }

    @Test
    public void dueReportsNewItemsOutsideTheCooldown() {
        long now = 100 * HOUR;
        long cooldown = 6 * HOUR;
        Map<String, Long> notified = new HashMap<>();
        notified.put("RECENT", now - 5 * HOUR);
        notified.put("OLD", now - 6 * HOUR);
        List<String> qualifying = Arrays.asList("NEW", "STILL", "RECENT", "OLD");

        // STILL qualified in the previous run; RECENT dropped out and came back within the cooldown
        assertEquals(Arrays.asList("NEW", "OLD"), AlertLogic.due(qualifying, set("STILL"), notified, now, cooldown));
        // an item that stays qualified is never repeated, even after the cooldown
        assertEquals(Collections.emptyList(), AlertLogic.due(Arrays.asList("OLD"), set("OLD"), notified, now + 10 * HOUR, cooldown));
        // one millisecond before the cooldown ends it is still blocked
        assertEquals(Collections.emptyList(), AlertLogic.due(Arrays.asList("RECENT"), set(), notified, now + HOUR - 1, cooldown));
        assertEquals(Arrays.asList("RECENT"), AlertLogic.due(Arrays.asList("RECENT"), set(), notified, now + HOUR, cooldown));
    }

    @Test
    public void aboveUsesTaxAndThreshold() {
        Map<String, double[]> prices = new HashMap<>();
        prices.put("BIG", new double[] { 100, 200 });
        prices.put("SMALL", new double[] { 100, 104 });
        prices.put("EDGE", new double[] { 100, 105 / 0.9875 });
        assertEquals(set("BIG", "EDGE"), AlertLogic.above(prices, TAX, 0.05));
        assertEquals(set("BIG"), AlertLogic.above(prices, TAX, 0.5));
    }

    @Test
    public void crossedReportsOnlyNewIds() {
        assertEquals(set("B"), AlertLogic.crossed(set("A", "B"), set("A")));
        assertEquals(set(), AlertLogic.crossed(set("A"), set("A", "B")));
        assertEquals(set("A"), AlertLogic.crossed(set("A"), Collections.emptySet()));
    }

    @Test
    public void linesAreSortedByMarginAndFallBackToTheId() {
        Map<String, double[]> prices = new HashMap<>();
        prices.put("A", new double[] { 100, 120 });
        prices.put("B", new double[] { 100, 200 });
        Map<String, String> names = new HashMap<>();
        names.put("B", "Item B");
        assertEquals(Arrays.asList("Item B: 97.5%", "A: 18.5%"), AlertLogic.lines(set("A", "B"), prices, names, TAX));
    }

    @Test
    public void marketLinesShowTopThreeAndTheRest() {
        List<Flip> hits = new ArrayList<>();
        for (int i = 1; i <= 5; i++) hits.add(new Flip("ID" + i, 100, 0.2, 1e6, 1_500_000.0 / i, false));
        Map<String, String> names = new HashMap<>();
        names.put("ID1", "First Item");
        assertEquals(
            Arrays.asList("First Item: 20.0% · 1.5M/h", "ID2: 20.0% · 750k/h", "ID3: 20.0% · 500k/h", "+2 more"),
            AlertLogic.marketLines(hits, names));
        assertEquals(Arrays.asList("First Item: 20.0% · 1.5M/h"), AlertLogic.marketLines(hits.subList(0, 1), names));
        assertEquals(3, AlertLogic.marketLines(hits.subList(0, 3), names).size());
    }

    @Test
    public void textsAreEnglish() {
        assertEquals("2 favorites above 5% margin", AlertLogic.title(2, 5));
        assertEquals("1 favorite above 7.5% margin", AlertLogic.title(1, 7.5));
        assertEquals("Enchanted Diamond: 12.3%", AlertLogic.line("Enchanted Diamond", 0.1234));
        assertEquals("1 market opportunity", AlertLogic.marketTitle(1));
        assertEquals("4 market opportunities", AlertLogic.marketTitle(4));
    }

    @Test
    public void coinsMatchesTheWebApp() {
        // same cases as tests/render.test.js
        assertEquals("0", AlertLogic.coins(0));
        assertEquals("52.7", AlertLogic.coins(52.74));
        assertEquals("1,234.5", AlertLogic.coins(1234.5));
        assertEquals("9,999.9", AlertLogic.coins(9999.9));
        assertEquals("10k", AlertLogic.coins(9999.96));
        assertEquals("20.8k", AlertLogic.coins(20767.9));
        assertEquals("350k", AlertLogic.coins(350000));
        assertEquals("999.9k", AlertLogic.coins(999949));
        assertEquals("1M", AlertLogic.coins(999950));
        assertEquals("1.2M", AlertLogic.coins(1200000));
        assertEquals("1.5B", AlertLogic.coins(1.5e9));
        assertEquals("-2.5M", AlertLogic.coins(-2500000));
    }
}

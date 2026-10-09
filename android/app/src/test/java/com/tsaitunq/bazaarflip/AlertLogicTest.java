package com.tsaitunq.bazaarflip;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;

import org.junit.Test;

import java.io.IOException;
import java.io.StringReader;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

public class AlertLogicTest {
    private static final String RESPONSE = "{\"success\":true,\"lastUpdated\":1,\"products\":{"
        + "\"FULL\":{\"product_id\":\"FULL\",\"sell_summary\":[{\"amount\":5,\"pricePerUnit\":100.0,\"orders\":1},{\"pricePerUnit\":99.0}],"
        + "\"buy_summary\":[{\"amount\":2,\"pricePerUnit\":200.0}],\"quick_status\":{\"buyPrice\":1}},"
        + "\"NO_OFFERS\":{\"sell_summary\":[{\"pricePerUnit\":10.0}],\"buy_summary\":[]},"
        + "\"INK_SACK:4\":{\"sell_summary\":[{\"pricePerUnit\":3.5}],\"buy_summary\":[{\"pricePerUnit\":4.0}]},"
        + "\"NOT_ASKED\":{\"sell_summary\":[{\"pricePerUnit\":1.0}],\"buy_summary\":[{\"pricePerUnit\":2.0}]}}}";

    private static Set<String> set(String... ids) {
        return new HashSet<>(Arrays.asList(ids));
    }

    @Test
    public void readPricesReturnsOnlyCompleteRequestedProducts() throws IOException {
        Map<String, double[]> prices =
            AlertLogic.readPrices(new StringReader(RESPONSE), set("FULL", "NO_OFFERS", "INK_SACK:4", "MISSING"));
        assertEquals(set("FULL", "INK_SACK:4"), prices.keySet());
        assertArrayEquals(new double[] { 100.0, 200.0 }, prices.get("FULL"), 1e-9);
        assertArrayEquals(new double[] { 3.5, 4.0 }, prices.get("INK_SACK:4"), 1e-9);
    }

    @Test
    public void readPricesRejectsFailureAndGarbage() {
        assertThrows(IOException.class,
            () -> AlertLogic.readPrices(new StringReader("{\"success\":false,\"cause\":\"x\"}"), set("A")));
        assertThrows(IOException.class, () -> AlertLogic.readPrices(new StringReader("<html>"), set("A")));
        assertThrows(IOException.class,
            () -> AlertLogic.readPrices(new StringReader("{\"success\":true,\"products\":[]}"), set("A")));
    }

    @Test
    public void marginMatchesTheApp() {
        assertEquals(0.975, AlertLogic.margin(100, 200, 0.0125), 1e-9);
        assertEquals(-0.0125, AlertLogic.margin(100, 100, 0.0125), 1e-9);
    }

    @Test
    public void aboveUsesTaxAndThreshold() {
        Map<String, double[]> prices = new HashMap<>();
        prices.put("BIG", new double[] { 100, 200 });
        prices.put("SMALL", new double[] { 100, 104 });
        prices.put("EDGE", new double[] { 100, 105 / 0.9875 });
        assertEquals(set("BIG", "EDGE"), AlertLogic.above(prices, 0.0125, 0.05));
        assertEquals(set("BIG"), AlertLogic.above(prices, 0.0125, 0.5));
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
        assertEquals(Arrays.asList("Item B: 97,5 %", "A: 18,5 %"), AlertLogic.lines(set("A", "B"), prices, names, 0.0125));
    }

    @Test
    public void textsAreGerman() {
        assertEquals("2 Favoriten über 5 % Marge", AlertLogic.title(2, 5));
        assertEquals("1 Favorit über 7,5 % Marge", AlertLogic.title(1, 7.5));
        assertEquals("Enchanted Diamond: 12,3 %", AlertLogic.line("Enchanted Diamond", 0.1234));
    }
}

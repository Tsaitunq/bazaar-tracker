// Trend signals: where an item's sell price is heading and how it compares with its normal price.
// Shown as a badge and used for sorting only; opportunities, portfolio and alerts never read them.
export const TREND_WINDOW_MIN = 1440;  // the slope is taken over the last 24 hours of history
export const TREND_MIN_POINTS = 12;
export const TREND_MIN_SPAN_MIN = 720; // and needs points across at least 12 of them
export const TREND_FLAT = 0.03;        // less than 3 % change per 24 hours counts as flat
export const LEVEL_BAND = 0.1;         // within 10 % of the 7 day median counts as normal

// points: [minute, buy, sell][] in time order. Returns the change of the sell price per 24 hours as a
// fraction of its mean (0.05 = rising 5 % a day), from a least squares line; null without enough history.
export function trendSlope(points) {
  if (!points.length) return null;
  const end = points[points.length - 1][0];
  const win = points.filter(([t]) => t > end - TREND_WINDOW_MIN);
  if (win.length < TREND_MIN_POINTS || end - win[0][0] < TREND_MIN_SPAN_MIN) return null;
  const meanT = win.reduce((a, p) => a + p[0], 0) / win.length;
  const mean = win.reduce((a, p) => a + p[2], 0) / win.length;
  if (!(mean > 0)) return null;
  let num = 0;
  let den = 0;
  for (const [t, , sell] of win) {
    num += (t - meanT) * (sell - mean);
    den += (t - meanT) ** 2;
  }
  return Math.round(((num / den) * TREND_WINDOW_MIN / mean) * 1000) / 1000;
}

export const direction = (slope) =>
  (slope == null ? null : slope > TREND_FLAT ? 'rising' : slope < -TREND_FLAT ? 'falling' : 'flat');

// 'below' or 'above' when the current sell price is clearly off its 7 day median, else null
export const level = (sell, median) =>
  (!(sell > 0 && median > 0) ? null : sell < median * (1 - LEVEL_BAND) ? 'below' : sell > median * (1 + LEVEL_BAND) ? 'above' : null);

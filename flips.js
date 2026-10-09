const HOURS_PER_WEEK = 168;

// API names are from the instant buyer's view: sell_summary holds buy orders, buy_summary holds sell offers.
export function computeFlip(id, product, tax, maxCapital) {
  const buy = product.sell_summary?.[0]?.pricePerUnit;
  const sell = product.buy_summary?.[0]?.pricePerUnit;
  if (!(buy > 0) || !(sell > 0)) return null;

  const qs = product.quick_status ?? {};
  const weekVol = Math.min(qs.buyMovingWeek, qs.sellMovingWeek) || 0;
  const hourVol = weekVol / HOURS_PER_WEEK;
  const units = maxCapital > 0 ? Math.min(hourVol, Math.floor(maxCapital / buy)) : hourVol;
  const profit = sell * (1 - tax) - buy;
  const margin = profit / buy;

  return {
    id, buy, sell, profit, margin, weekVol, hourVol,
    profitHour: units * profit,
    suspicious: (margin > 0.5 && hourVol < 100) || !(qs.buyOrders >= 3) || !(qs.sellOrders >= 3),
  };
}

export function buildFlips(products, { tax, minVolume, maxCapital, sort }) {
  return Object.entries(products)
    .map(([id, p]) => computeFlip(id, p, tax, maxCapital))
    .filter((f) => f && f.profit > 0 && f.weekVol >= minVolume && !(maxCapital > 0 && f.buy > maxCapital))
    .sort((a, b) => b[sort] - a[sort]);
}

const HOURS_PER_WEEK = 168;

// API names are from the instant buyer's view: sell_summary holds buy orders, buy_summary holds sell offers.
export function bookPrices(product) {
  const buy = product.sell_summary?.[0]?.pricePerUnit;
  const sell = product.buy_summary?.[0]?.pricePerUnit;
  return buy > 0 && sell > 0 ? { buy, sell } : null;
}

export function computeFlip(id, product, tax, maxCapital, share = 1) {
  const prices = bookPrices(product);
  if (!prices) return null;
  const { buy, sell } = prices;

  const qs = product.quick_status ?? {};
  const weekVol = Math.min(qs.buyMovingWeek, qs.sellMovingWeek) || 0;
  const hourVol = weekVol / HOURS_PER_WEEK;
  // share: the part of the hourly volume one player realistically gets
  const reach = hourVol * share;
  const units = maxCapital > 0 ? Math.min(reach, Math.floor(maxCapital / buy)) : reach;
  const profit = sell * (1 - tax) - buy;
  const margin = profit / buy;

  return {
    id, buy, sell, profit, margin, weekVol, hourVol,
    profitHour: units * profit,
    suspicious: margin > 2 || (margin > 0.5 && hourVol < 100) || !(qs.buyOrders >= 3) || !(qs.sellOrders >= 3),
  };
}

// favs are kept even when they fail the filters
export function buildFlips(products, { tax, minVolume, maxCapital, sort, share = 1, favs = new Set() }) {
  return Object.entries(products)
    .map(([id, p]) => computeFlip(id, p, tax, maxCapital, share))
    .filter((f) => f && (favs.has(f.id) || (f.profit > 0 && f.weekVol >= minVolume && !(maxCapital > 0 && f.buy > maxCapital))))
    .sort((a, b) => b[sort] - a[sort]);
}

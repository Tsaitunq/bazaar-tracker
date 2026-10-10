import { bookPrices, bySort, statOf } from './flips.js';

// Auction House fees, see docs/events-sources.md. The fee for the auction's duration is not included.
export const AH_TAX_FREE = 1e6; // collecting a sale up to this much costs nothing, and the tax never cuts below it
export const AH_CLAIM_TAX = 0.01;
export const DERPY_TAX_FACTOR = 4; // while Derpy is mayor the tax on collecting is four times as high
export const ahListFee = (price) => (price > 100e6 ? 0.025 : price >= 10e6 ? 0.02 : 0.01);

// What is left of a BIN sale at `price` after the listing fee and the tax on collecting the coins.
export function ahNet(price, derpy = false) {
  const rate = AH_CLAIM_TAX * (derpy ? DERPY_TAX_FACTOR : 1);
  const claim = price > AH_TAX_FREE ? Math.min(price * rate, price - AH_TAX_FREE) : 0;
  return price - price * ahListFee(price) - claim;
}

// One forge recipe as a flip, whether it pays or not; null when a price is missing.
// r: { n, d: seconds, h: HotM tier, c?: coins, i: { id: quantity } }. ah: { id: lowest BIN }.
// Ingredients are bought with buy orders, like craft flips. profit is per item. profitHour is what one
// forge slot can earn in an hour, but never more than can be sold: for a bazaar result that is `share`
// of its hourly instant-buy volume. The auction house has no volume data, so there only the forge counts.
export function forgeFlip(id, r, products, ah, { tax, share = 1, stats = null, derpy = false }) {
  const viaAh = !products[id];
  const sell = viaAh ? ah?.[id] : bookPrices(products[id])?.sell;
  if (!(sell > 0)) return null;
  let cost = r.c ?? 0;
  const ingredients = [];
  for (const [ingId, qty] of Object.entries(r.i)) {
    const ing = products[ingId] && bookPrices(products[ingId]);
    if (!ing) return null;
    cost += qty * ing.buy;
    ingredients.push({ id: ingId, qty, price: ing.buy });
  }
  if (!(cost > 0)) return null;
  const revenue = r.n * (viaAh ? ahNet(sell, derpy) : sell * (1 - tax));
  const profit = (revenue - cost) / r.n;
  const forged = (r.n * 3600) / r.d;
  const sold = viaAh ? Infinity : ((products[id].quick_status?.buyMovingWeek || 0) / 168) * share;
  return {
    id, n: r.n, cost, revenue, sell, profit, margin: (revenue - cost) / cost,
    profitHour: Math.min(forged, sold) * profit, limit: sold < forged ? 'sales' : 'forge',
    seconds: r.d, hotm: r.h, coins: r.c ?? 0, ah: viaAh, ingredients,
    // Derpy's higher tax only bites where the tax applies at all
    derpy: viaAh && derpy && sell > AH_TAX_FREE,
    // price history exists for bazaar items only
    ...(viaAh ? {} : statOf(stats, id)),
  };
}

// The Forge tab: recipes that pay, fit the HotM tier and the capital, with or without auction house results.
export function forgeFlips(products, recipes, ah, { maxCapital, sort, hotm = 10, forgeAh = true, ...opts }) {
  return Object.entries(recipes)
    .filter(([, r]) => !(r.h > hotm))
    .map(([id, r]) => forgeFlip(id, r, products, ah, opts))
    .filter((f) => f && f.profit > 0 && (forgeAh || !f.ah) && !(maxCapital > 0 && f.cost > maxCapital))
    .sort(bySort(sort));
}

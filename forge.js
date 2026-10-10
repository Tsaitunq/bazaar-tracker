import { bookPrices, bySort, statOf } from './flips.js';

// Auction House fees, see docs/events-sources.md. The fee for the auction's duration is not included.
export const AH_TAX_FREE = 1e6; // collecting a sale up to this much costs nothing, and the tax never cuts below it
export const AH_CLAIM_TAX = 0.01;
export const ahListFee = (price) => (price > 100e6 ? 0.025 : price >= 10e6 ? 0.02 : 0.01);

// What is left of a BIN sale at `price` after the listing fee and the tax on collecting the coins.
export function ahNet(price) {
  const claim = price > AH_TAX_FREE ? Math.min(price * AH_CLAIM_TAX, price - AH_TAX_FREE) : 0;
  return price - price * ahListFee(price) - claim;
}

// recipes: { id: { n, d: seconds, h: HotM tier, c?: coins, i: { id: quantity } } } from forge.json.
// ah: { id: lowest BIN } for results that are not on the bazaar.
// Ingredients are bought with buy orders, like craft flips. profit is per item, profitHour per hour of
// one forge slot; market share and volume play no part here.
export function forgeFlips(products, recipes, ah, { tax, maxCapital, sort, stats = null, hotm = 10, forgeAh = true }) {
  const out = [];
  for (const [id, r] of Object.entries(recipes)) {
    if (r.h > hotm) continue;
    const viaAh = !products[id];
    if (viaAh && !forgeAh) continue;
    const sell = viaAh ? ah?.[id] : bookPrices(products[id])?.sell;
    if (!(sell > 0)) continue;
    let cost = r.c ?? 0;
    const ingredients = [];
    for (const [ingId, qty] of Object.entries(r.i)) {
      const ing = products[ingId] && bookPrices(products[ingId]);
      if (!ing) { cost = NaN; break; }
      cost += qty * ing.buy;
      ingredients.push({ id: ingId, qty, price: ing.buy });
    }
    if (!(cost > 0)) continue;
    const revenue = r.n * (viaAh ? ahNet(sell) : sell * (1 - tax));
    const run = revenue - cost;
    if (run <= 0 || (maxCapital > 0 && cost > maxCapital)) continue;
    out.push({
      id, n: r.n, cost, revenue, sell, profit: run / r.n, margin: run / cost, profitHour: run / (r.d / 3600),
      seconds: r.d, hotm: r.h, coins: r.c ?? 0, ah: viaAh, ingredients,
      // price history exists for bazaar items only
      ...(viaAh ? {} : statOf(stats, id)),
    });
  }
  return out.sort(bySort(sort));
}

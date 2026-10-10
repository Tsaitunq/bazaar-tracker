import { bookPrices, bySort, statOf, computeFlip } from './flips.js';

// One recipe as a flip: buy every ingredient with buy orders, sell the result with a sell offer.
// null when a price is missing, the craft loses money or one craft costs more than maxCapital.
export function craftFlip(id, r, products, { tax, maxCapital, share = 1, stats = null }) {
  const res = products[id] && bookPrices(products[id]);
  if (!res) return null;
  let cost = 0, perWeek = (products[id].quick_status?.buyMovingWeek || 0) / r.n;
  const ingredients = [];
  for (const [ingId, qty] of Object.entries(r.i)) {
    const ing = products[ingId] && bookPrices(products[ingId]);
    if (!ing) return null;
    cost += qty * ing.buy;
    perWeek = Math.min(perWeek, (products[ingId].quick_status?.sellMovingWeek || 0) / qty);
    ingredients.push({ id: ingId, qty, price: ing.buy });
  }
  if (!(cost > 0)) return null;
  const revenue = r.n * res.sell * (1 - tax);
  const profit = revenue - cost;
  if (profit <= 0 || (maxCapital > 0 && cost > maxCapital)) return null;
  const reach = (perWeek / 168) * share;
  const craftsHour = maxCapital > 0 ? Math.min(reach, Math.floor(maxCapital / cost)) : reach;
  return {
    id, n: r.n, cost, revenue, profit, margin: profit / cost, craftsHour,
    profitHour: craftsHour * profit, ...statOf(stats, id), ingredients,
  };
}

export function craftFlips(products, recipes, opts) {
  return Object.entries(recipes).map(([id, r]) => craftFlip(id, r, products, opts)).filter(Boolean).sort(bySort(opts.sort));
}

// Hints for the portfolio: { [flip id]: { id, extra, orders } } where crafting the flip's item into `id`
// earns `extra` coins per hour more than the flip itself. The craft gets the coins the plan gave the flip
// (its stake) and the rules of the Craft tab: tax, market share and the weekly volume of every ingredient
// and of the result. orders: one buy order per ingredient plus the sell offer. A result with suspicious
// prices gives no hint. The best craft per flip wins. Whether the player has the recipe is not known here.
export function craftHints(flips, products, recipes, { tax, share = 1, stats = null }) {
  const out = {};
  for (const [id, r] of Object.entries(recipes)) {
    for (const f of flips) {
      if (!(f.id in r.i)) continue;
      const craft = craftFlip(id, r, products, { tax, share, stats, maxCapital: f.stake });
      const extra = craft && craft.profitHour - f.profitHour;
      if (!(extra > 0) || extra <= (out[f.id]?.extra ?? 0)) continue;
      if (computeFlip(id, products[id], tax, 0, share, statOf(stats, id).median).suspicious) continue;
      out[f.id] = { id, extra, orders: craft.ingredients.length + 1 };
    }
  }
  return out;
}

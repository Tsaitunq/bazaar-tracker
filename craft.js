import { bookPrices, bySort, statOf } from './flips.js';

export function craftFlips(products, recipes, { tax, maxCapital, share = 1, sort, stats = null }) {
  const out = [];
  for (const [id, r] of Object.entries(recipes)) {
    const res = products[id] && bookPrices(products[id]);
    if (!res) continue;
    let cost = 0, perWeek = (products[id].quick_status?.buyMovingWeek || 0) / r.n;
    const ingredients = [];
    for (const [ingId, qty] of Object.entries(r.i)) {
      const ing = products[ingId] && bookPrices(products[ingId]);
      if (!ing) { cost = NaN; break; }
      cost += qty * ing.buy;
      perWeek = Math.min(perWeek, (products[ingId].quick_status?.sellMovingWeek || 0) / qty);
      ingredients.push({ id: ingId, qty, price: ing.buy });
    }
    if (!(cost > 0)) continue;
    const revenue = r.n * res.sell * (1 - tax);
    const profit = revenue - cost;
    if (profit <= 0 || (maxCapital > 0 && cost > maxCapital)) continue;
    const reach = (perWeek / 168) * share;
    const craftsHour = maxCapital > 0 ? Math.min(reach, Math.floor(maxCapital / cost)) : reach;
    out.push({
      id, n: r.n, cost, revenue, profit, margin: profit / cost, craftsHour,
      profitHour: craftsHour * profit, ...statOf(stats, id), ingredients,
    });
  }
  return out.sort(bySort(sort));
}

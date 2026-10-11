import { bookPrices, bySort, statOf, computeFlip } from './flips.js';

// The Hypixel API names the two sides of a book after the player's action, which reads backwards:
//   buy_summary  = the sell offers, cheapest first. Someone who buys at once pays these.
//   sell_summary = the buy orders, highest first. Someone who sells at once is paid these.
// The Bazaar product API gives about 30 levels per side. bookPrices() (flips.js) reads the top of each:
// .buy = sell_summary[0] (the buy order you would have to beat), .sell = buy_summary[0] (the offer to beat).
// walkBook adds up what qty items cost (or pay) when they go through the levels in order; null when the
// shown levels hold less than qty, which is a price nobody can say.
export function walkBook(levels, qty, cheapestFirst) {
  const sorted = [...(levels ?? [])].sort((x, y) => (cheapestFirst ? x.pricePerUnit - y.pricePerUnit : y.pricePerUnit - x.pricePerUnit));
  let left = qty, total = 0;
  for (const l of sorted) {
    const take = Math.min(left, l.amount);
    total += take * l.pricePerUnit;
    left -= take;
    if (left <= 0) return total;
  }
  return left <= 0 ? total : null;
}

// How a craft is bought and sold: orders = open orders it needs, per ingredient and for the result.
export const CRAFT_MODES = [
  { key: 0, name: 'Order → Order', buy: 'order', sell: 'order' },
  { key: 1, name: 'Insta-buy → Order', buy: 'insta', sell: 'order' },
  { key: 2, name: 'Insta-buy → Insta-sell', buy: 'insta', sell: 'insta' },
];
export const CRAFT_RUNS = 16; // crafts per pass: one pass of 16 crafts of a 160-ingredient recipe is 2,560 items

// One recipe as a flip. mode: index into CRAFT_MODES. runs: crafts per pass, which sets how deep an instant
// buy or sell goes into the book (order prices do not depend on it). Prices are the average over the
// whole pass, tax is taken off the sale. null when a price is missing, a book is too thin for the pass,
// the craft loses money, or one craft costs more than maxCapital. minVolume (weekly units, result and every
// ingredient) and noSuspicious are the filters of the other tabs; without them nothing is filtered.
// Per hour, the volume that limits a craft is the flow on the side it uses: buying at once takes the offers
// that instant buyers take (buyMovingWeek), a buy order is filled by instant sellers (sellMovingWeek).
export function craftFlip(id, r, products, { tax, maxCapital, share = 1, stats = null, mode = 0, runs = 1, minVolume, noSuspicious = false }) {
  const m = CRAFT_MODES[mode] ?? CRAFT_MODES[0];
  const res = products[id] && bookPrices(products[id]);
  if (!res) return null;
  const week = (pid, key) => products[pid].quick_status?.[key] || 0;
  const bad = (pid) => (minVolume > 0 && !(Math.min(week(pid, 'buyMovingWeek'), week(pid, 'sellMovingWeek')) >= minVolume))
    || (noSuspicious && computeFlip(pid, products[pid], tax, 0, 1, statOf(stats, pid).median).suspicious);
  if (bad(id)) return null;
  const n = Math.max(1, runs);
  let cost = 0, perWeek = week(id, m.sell === 'order' ? 'buyMovingWeek' : 'sellMovingWeek') / r.n;
  const ingredients = [];
  for (const [ingId, qty] of Object.entries(r.i)) {
    const ing = products[ingId] && bookPrices(products[ingId]);
    if (!ing || bad(ingId)) return null;
    let price = ing.buy;
    if (m.buy === 'insta') {
      const total = walkBook(products[ingId].buy_summary, qty * n, true);
      if (total === null) return null;
      price = total / (qty * n);
    }
    cost += qty * price;
    perWeek = Math.min(perWeek, week(ingId, m.buy === 'order' ? 'sellMovingWeek' : 'buyMovingWeek') / qty);
    ingredients.push({ id: ingId, qty, price });
  }
  if (!(cost > 0)) return null;
  let sellPrice = res.sell;
  if (m.sell === 'insta') {
    const total = walkBook(products[id].sell_summary, r.n * n, false);
    if (total === null) return null;
    sellPrice = total / (r.n * n);
  }
  const revenue = r.n * sellPrice * (1 - tax);
  const profit = revenue - cost;
  if (profit <= 0 || (maxCapital > 0 && cost > maxCapital)) return null;
  const reach = (perWeek / 168) * share;
  const craftsHour = maxCapital > 0 ? Math.min(reach, Math.floor(maxCapital / cost)) : reach;
  const orders = (m.buy === 'order' ? ingredients.length : 0) + (m.sell === 'order' ? 1 : 0);
  return {
    id, n: r.n, cost, revenue, profit, margin: profit / cost, craftsHour,
    profitHour: craftsHour * profit, ...statOf(stats, id), ingredients,
    mode, runs: n, orders, profitItem: profit / r.n, capital: cost * n,
  };
}

// opts: as for craftFlip, plus sort.
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

import { bookPrices, bySort, statOf } from './flips.js';
import { walkBook, CRAFT_RUNS } from './craft.js';

// A player may sell NPC shops at most this many coins a day; it resets at 00:00 UTC.
// Source: hypixelskyblock.minecraft.wiki/w/Merchant, "limited to only selling up to 500,000,000 Coins per day".
// The wiki names no limit in items. The Bazaar tab's NPC flips are bought at the Bazaar, so the shops'
// daily buy limit (640 items, wiki page NPC) does not apply to them.
export const NPC_DAY_LIMIT = 500000000;

// Crafting a flip item into a higher step before the NPC takes it, e.g. 160 Enchanted Wheat into one
// Enchanted Hay Bale. Only recipes of one ingredient (a compaction step) count; the ingredients are bought at
// once, level by level through the sell offers (walkBook), for one pass of `runs` crafts. The same items go
// to the NPC either as they are (direct) or as the crafted result. null when the result has no NPC price,
// the recipe has several ingredients or the book is too thin for the pass.
// profitCoin: profit per coin spent. profitSale: profit per item handed to the NPC. profitHour: at the
// market share of the item's hourly volume, which is what a flip is rated by everywhere else; profitMin is
// that per minute. No selling speed is assumed beyond the volume. basis: 'insta' prices the items at the sell
// offers, 'order' at the top buy order (what the flip's own Profit/item uses).
export function npcStep(id, products, npcPrices, recipes, { share = 1, maxCapital = 0, runs = CRAFT_RUNS, basis = 'insta' }) {
  const book = products[id]?.buy_summary;
  const direct = npcPrices[id] || 0;
  let best = null;
  for (const [out, r] of Object.entries(recipes)) {
    const ings = Object.entries(r.i);
    if (ings.length !== 1 || ings[0][0] !== id) continue;
    const price = npcPrices[out];
    if (!(price > 0)) continue;
    const qty = ings[0][1];
    const items = qty * runs;
    const cost = basis === 'insta' ? walkBook(book, items, true) : items * (bookPrices(products[id])?.buy ?? NaN);
    if (cost === null || !(cost > 0)) continue;
    const crafted = runs * r.n * price - cost;
    const plain = items * direct - cost;
    const hourVol = (products[id].quick_status?.sellMovingWeek || 0) / 168;
    // items per hour the player gets, capped by the capital and by what the NPC pays out in an hour
    const perCoin = cost / items;
    let unitsHour = hourVol * share;
    if (maxCapital > 0) unitsHour = Math.min(unitsHour, maxCapital / perCoin);
    const hours = (profit, perItemCoins) => Math.min(unitsHour, NPC_DAY_LIMIT / 24 / perItemCoins) * profit / items;
    const craft = {
      id: out, n: r.n, qty, runs, items, cost, basis,
      profit: crafted, profitCoin: crafted / cost, profitSale: crafted / (runs * r.n),
      profitHour: hours(crafted, price * r.n / qty),
      direct: { profit: plain, profitCoin: plain / cost, profitSale: plain / items, profitHour: direct > 0 ? hours(plain, direct) : 0 },
    };
    craft.profitMin = craft.profitHour / 60;
    if (crafted > 0 && (!best || crafted > best.profit)) best = craft;
  }
  return best && best.profit > Math.max(0, best.direct.profit) ? best : null;
}

// recipes: recipes.json's r, or null for no craft steps. runs: crafts per pass (the Craft tab's setting).
export function npcFlips(products, npcPrices, { minVolume, maxCapital, share = 1, sort, stats = null, recipes = null, runs = CRAFT_RUNS }) {
  const out = [];
  for (const [id, p] of Object.entries(products)) {
    const npc = npcPrices[id];
    const prices = bookPrices(p);
    if (!prices) continue;
    const { buy, sell } = prices;
    const profit = (npc || 0) - buy;
    const weekVol = p.quick_status?.sellMovingWeek || 0;
    if (weekVol < minVolume || (maxCapital > 0 && buy > maxCapital)) continue;
    // priced as an instant buy first; when that gives nothing, with the buy order the flip itself uses
    const sopt = { share, maxCapital, runs };
    const step = recipes ? npcStep(id, products, npcPrices, recipes, sopt) ?? npcStep(id, products, npcPrices, recipes, { ...sopt, basis: 'order' }) : null;
    if (!(npc > 0 && profit > 0) && !step) continue;
    const hourVol = weekVol / 168;
    const reach = hourVol * share;
    const units = Math.min(maxCapital > 0 ? Math.min(reach, Math.floor(maxCapital / buy)) : reach, npc > 0 ? NPC_DAY_LIMIT / 24 / npc : Infinity);
    out.push({
      id, buy, sell, npc: npc || 0, profit, profitInstant: (npc || 0) - sell, margin: profit / buy, weekVol, hourVol,
      profitHour: step ? Math.max(units * profit, step.profitHour) : units * profit, ...statOf(stats, id), ...(step && { step }),
    });
  }
  return out.sort(bySort(sort));
}

import { bookPrices, bySort } from './flips.js';

export function npcFlips(products, npcPrices, { minVolume, maxCapital, share = 1, sort, scores = {} }) {
  const out = [];
  for (const [id, p] of Object.entries(products)) {
    const npc = npcPrices[id];
    const prices = npc > 0 && bookPrices(p);
    if (!prices) continue;
    const { buy, sell } = prices;
    const profit = npc - buy;
    const weekVol = p.quick_status?.sellMovingWeek || 0;
    if (profit <= 0 || weekVol < minVolume || (maxCapital > 0 && buy > maxCapital)) continue;
    const hourVol = weekVol / 168;
    const reach = hourVol * share;
    const units = maxCapital > 0 ? Math.min(reach, Math.floor(maxCapital / buy)) : reach;
    out.push({
      id, buy, sell, npc, profit, profitInstant: npc - sell, margin: profit / buy, weekVol, hourVol,
      profitHour: units * profit, score: scores[id] ?? null,
    });
  }
  return out.sort(bySort(sort));
}

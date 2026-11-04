// What the HOTM editor shows, worked out from gamedata/hotm.json and build.hotm. No markup in here.
import { valueAt } from './gamedata.js';

export const levelOf = (hotm, id) => hotm?.levels?.[id] ?? 0;

// Why a perk does not count: 'tier' (its row is above the HOTM level) or 'requires' (a perk it hangs on is below 1). null = free.
// An unknown tier locks nothing.
export function lockOf(perk, hotm) {
  if (!hotm) return null;
  if (Number.isInteger(hotm.tier) && perk.tier > hotm.tier) return 'tier';
  if ((perk.requires ?? []).some((id) => !(levelOf(hotm, id) >= 1))) return 'requires';
  return null;
}

// A perk switched off in the game keeps its level but does not count.
export const isOff = (hotm, perk) => perk.type === 'perk' && (hotm?.disabled ?? []).includes(perk.id);

// The picture of a tree cell like in the game: coal = not unlocked, emerald = unlocked, diamond = maxed, redstone block = Core and ready ability, emerald block = the selected ability, coal block = locked ability.
export function iconOf(perk, hotm) {
  const level = levelOf(hotm, perk.id);
  if (perk.type === 'core') return 'redstone_block';
  if (perk.type === 'ability') return lockOf(perk, hotm) || level < 1 ? 'coal_block' : hotm?.ability === perk.id ? 'emerald_block' : 'redstone_block';
  return level < 1 ? 'coal' : level >= perk.maxLevel ? 'diamond' : 'emerald';
}

export const LOCK_TEXT = { tier: 'Locked by your HOTM level', requires: 'Requirement missing' };

// Cost of reaching one level: { powder, amount }, { tokens: 1 } for a one-level perk, {} for free, null for unknown.
export function costOf(perk, level) {
  if (perk.type === 'core') {
    const c = perk.levels?.[level - 1]?.cost;
    return c ? { powder: c.powder, amount: c.amount } : {};
  }
  if (perk.maxLevel === 1) return { tokens: 1 };
  const c = perk.cost;
  if (!c || c.kind === 'none') return null;
  return { powder: c.powder, amount: Math.floor((level + c.offset) ** c.exp) };
}

// Sum of the costs of the levels from+1 to to: { mithril, gemstone, glacite, tokens, unknown }.
export function costBetween(perk, from, to) {
  const sum = { mithril: 0, gemstone: 0, glacite: 0, tokens: 0, unknown: false };
  for (let level = from + 1; level <= to; level++) {
    const c = costOf(perk, level);
    if (c === null) { sum.unknown = true; continue; }
    if (c.powder) sum[c.powder] += c.amount;
    if (c.tokens) sum.tokens += c.tokens;
  }
  return sum;
}

// What is spent in all set levels (the chips on top), over the perks that are not unknown.
export function spent(data, hotm) {
  const total = { mithril: 0, gemstone: 0, glacite: 0, tokens: 0 };
  for (const perk of data.hotm.perks) {
    const c = costBetween(perk, 0, levelOf(hotm, perk.id));
    for (const k of Object.keys(total)) total[k] += c[k];
  }
  return total;
}

// The effects of a perk at a level (the omelette lifts a perk that takes it by one).
export function effectsAt(perk, level, omelette) {
  const at = level > 0 ? level + (omelette && perk.omeletteBonus ? 1 : 0) : 0;
  return [...perk.effects.filter((e) => !e.hidden), ...(perk.activeEffects ?? [])].map((e) => ({ stat: e.stat, value: valueAt(e, at), cond: e.cond, percent: e.kind === 'percent_multiplier' }));
}

// Pixel place of a perk in the tree: 7 columns, 10 rows, the top row is tier 10.
export const CELL = 48;
export const place = (perk) => ({ x: perk.col * CELL, y: perk.row * CELL });

// What stars, potato books and Bling Armor add to a worn piece, on top of its item stats. Pure functions.
// Assumed order (not confirmed): (item stats × stars + books) × Bling Armor, then reforge and enchants, which are not touched here.
import { HPB, CRIMSON_STAR, BLAZE_ARMOR, DEFAULT_GEAR } from './optimizer-data.js';
import { DAGGERS } from './blaze.js';

const ARMOR = new Set(['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS']);
const CRIMSON = /^(HOT_|BURNING_|FIERY_|INFERNAL_)?CRIMSON_(HELMET|CHESTPLATE|LEGGINGS|BOOTS)$/;

// entry: the pets.json entry of the active pet (or null). The perks carry the effects.
export function rulesOf(build, entry) {
  const effects = (entry?.perks ?? []).map((k) => k.effect).filter(Boolean);
  return {
    gear: { ...DEFAULT_GEAR, ...(build?.gear ?? {}) },
    potato: effects.find((e) => e.kind === 'potato_multiplier')?.factor ?? 1,
    bling: effects.find((e) => e.kind === 'set_multiplier' && e.family === 'BLAZE_ARMOR')?.percent ?? 0,
  };
}

const times = (stats, n) => Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, v * n]));
const plus = (a, b) => { const out = { ...a }; for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v; return out; };

// The stats a piece gets beyond its item lore. {} for a piece that takes none of it, and without rules.
export function pieceExtra(id, items, rules) {
  const item = items?.[id];
  if (!item || !rules) return {};
  const base = item.stats ?? {};
  let extra = {};
  if (CRIMSON.test(id)) extra = plus(extra, times(base, (rules.gear.stars * CRIMSON_STAR.percent) / 100));
  const table = ARMOR.has(item.category) ? HPB.armor : DAGGERS[id] ? HPB.weapon : null;
  const books = rules.gear.hpb ? HPB.max + rules.gear.fuming : 0;
  const potato = table && books ? times(table, books * rules.potato) : {};
  extra = plus(extra, potato);
  if (BLAZE_ARMOR.includes(id) && rules.bling) extra = plus(extra, times(plus(base, potato), rules.bling / 100));
  return extra;
}

// Lore plus extra: what the piece is worth worn.
export const pieceTotal = (id, items, rules) => plus(items?.[id]?.stats ?? {}, pieceExtra(id, items, rules));

// The daggers with their extras in the lore (potato books).
export function dressDaggers(daggers, items, rules) {
  if (!daggers) return daggers;
  return Object.fromEntries(Object.entries(daggers).map(([line, d]) => [line, d && { ...d, lore: plus(d.lore ?? {}, pieceExtra(d.id, items, rules)) }]));
}

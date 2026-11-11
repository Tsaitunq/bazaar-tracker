// What one worn piece is made of, and which value counts for it: the tooltip of the real item (game) or the app's own sum (calculated).
// Pure functions, no DOM. The parts follow the item: base, gems per slot, reforge, enchants, drill parts, Polarvoid books, coating, potato books, Recombobulator.
import { RARITIES, REFORGES, GEMS, GEM_STAT, ENCHANTS, PARTS, POLARVOID, COATING, HPB } from './optimizer-data.js';

const round = (v) => Math.round(v * 100) / 100;

// piece: a piece of the virtual loadout (id, gems, enchants, parts, reforge, recomb, polarvoid, coating, hpb?, fuming?). items: items.json.
// Gives { lines: { STAT: [{ part, label, value }] }, total: { STAT: n }, conditional: [{ stat, text }] }. A rarity the item list does not know
// leaves reforge and gems out (they scale with it) and says so in conditional.
export function pieceParts(piece, items) {
  const item = items?.[piece.id];
  const lines = {};
  const conditional = [];
  const put = (stat, part, label, value) => {
    if (!Number.isFinite(value) || Math.abs(value) < 1e-9) return;
    (lines[stat] ??= []).push({ part, label, value: round(value) });
  };
  for (const [stat, v] of Object.entries(item?.stats ?? {})) put(stat.toUpperCase(), 'base', 'Base', v);
  const tier = RARITIES.indexOf(item?.tier);
  const top = RARITIES.length - 1;
  // reforge and gems at the rarity without the Recombobulator; what it lifts is its own line
  const gemStat = (g, r) => GEMS[g.type]?.[g.quality]?.[r];
  const reforge = String(piece.reforge ?? '').toLowerCase();
  const scaled = (r) => {
    const out = {};
    const add = (stat, v) => { if (Number.isFinite(v)) out[stat] = (out[stat] ?? 0) + v; };
    for (const [stat, list] of Object.entries(REFORGES[reforge] ?? {})) add(stat, list[r]);
    for (const g of piece.gems ?? []) if (GEM_STAT[g.type]) add(GEM_STAT[g.type], gemStat(g, r));
    return out;
  };
  if (tier < 0) {
    if (reforge || piece.gems?.length) conditional.push({ stat: null, text: 'Rarity unknown: reforge and gems are not counted.' });
  } else {
    const r0 = tier;
    const r1 = Math.min(tier + (piece.recomb ? 1 : 0), top);
    for (const [stat, list] of Object.entries(REFORGES[reforge] ?? {})) put(stat, 'reforge', `Reforge ${reforge}`, list[r0]);
    for (const g of piece.gems ?? []) if (GEM_STAT[g.type]) put(GEM_STAT[g.type], 'gems', `${g.type} ${g.quality} (${g.slot})`, gemStat(g, r0));
    if (piece.recomb) {
      const a = scaled(r0);
      const b = scaled(r1);
      for (const stat of new Set([...Object.keys(a), ...Object.keys(b)])) put(stat, 'recomb', 'Recombobulator (higher rarity)', (b[stat] ?? 0) - (a[stat] ?? 0));
    }
  }
  for (const [name, level] of Object.entries(piece.enchants ?? {})) {
    const table = ENCHANTS[name];
    if (!table) continue;
    for (const [stat, list] of Object.entries(table.stats)) {
      // Lapidary works on gemstones only: the tooltip total does not hold it
      if (table.gemstonesOnly) conditional.push({ stat, text: `${name} ${level}: +${list[level - 1]} ${stat.toLowerCase().replace(/_/g, ' ')} (only on gemstones)` });
      else put(stat, 'enchants', `${name} ${level}`, list[level - 1]);
    }
  }
  for (const id of Object.values(piece.parts ?? {})) for (const [stat, v] of Object.entries(PARTS[String(id).toUpperCase()]?.stats ?? {})) put(stat, 'parts', String(id).toLowerCase().replace(/_/g, ' '), v);
  if (piece.polarvoid) {
    put('MINING_SPEED', 'polarvoid', `Polarvoid books x${Math.min(piece.polarvoid, POLARVOID.max)}`, POLARVOID.speed * Math.min(piece.polarvoid, POLARVOID.max));
    put('MINING_FORTUNE', 'polarvoid', 'Polarvoid books', POLARVOID.fortune);
  }
  if (piece.coating) for (const [stat, v] of Object.entries(item?.category === 'DRILL' ? COATING.drill : COATING.other)) put(stat, 'coating', 'Powder coating', v);
  const books = (piece.hpb ?? 0) + (piece.fuming ?? 0);
  const potato = ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'].includes(item?.category) ? HPB.armor : null;
  if (potato && books) for (const [stat, v] of Object.entries(potato)) put(stat, 'hpb', `Potato books x${books}`, v * books);
  const total = Object.fromEntries(Object.entries(lines).map(([stat, list]) => [stat, round(list.reduce((n, l) => n + l.value, 0))]));
  return { lines, total, conditional };
}

// Which of the real items found in the profile stands for a piece id: worn, then a wardrobe set, then anywhere; among equals the one
// with the most stats on its tooltip. null when none has a tooltip.
// shortcut: "the guide's wardrobe set" is not known here, any wardrobe set ranks the same; add it when a guide names its set.
export function realItem(id, real) {
  const rank = (i) => (i.at?.includes('Getragen') ? 0 : i.at?.some((a) => /^(Wardrobe Set|Equipment-Set)/.test(a)) ? 1 : 2);
  const weight = (i) => Object.values(i.tip ?? {}).reduce((n, v) => n + Math.abs(v), 0);
  const found = (real ?? []).filter((i) => i.id === id && i.tip);
  return found.sort((a, b) => rank(a) - rank(b) || weight(b) - weight(a))[0] ?? null;
}

// The two figures of a piece side by side: stats of the area only. differs: the tooltip and the own sum disagree on one of them.
export function compareTip(tip, calc, stats) {
  const keys = stats.filter((s) => tip[s] !== undefined || calc[s] !== undefined);
  return { delta: Object.fromEntries(keys.map((s) => [s, round((tip[s] ?? 0) - (calc[s] ?? 0))]).filter(([, v]) => v)), differs: keys.some((s) => Math.abs((tip[s] ?? 0) - (calc[s] ?? 0)) > 0.051) };
}

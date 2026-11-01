// Which open guide step brings the most per coin (spec 4 and 5). Pure functions over the guide, the prices and the synced profile.
import { AREA_STATS, computeStats } from './stats.js';
import { RARITIES, ENCHANTS, ENCHANTS_NO_STAT, GEMS, GEM_STAT, REFORGES, REFORGES_NO_STAT, PARTS, POLARVOID, COATING } from './optimizer-data.js';

// Spec 4.1. Gemstone Fortune applies on gemstones only (wiki Pristine), and the other fortunes are not counted, so mithril and glacite read low.
export const PRESETS = {
  gemstone: { blockStrength: 3000, wF: 1, wS: 1, wP: 1, gemFortune: true },
  mithril: { blockStrength: 500, wF: 1, wS: 1, wP: 0, gemFortune: false },
  glacite: { blockStrength: 6000, wF: 1, wS: 1, wP: 0, gemFortune: false },
};

// What the settings hold is typed in by the player: anything unusable takes the value of the preset.
export function miningSettings(raw) {
  const preset = Object.hasOwn(PRESETS, raw?.preset ?? '') ? raw.preset : 'gemstone';
  const base = PRESETS[preset];
  const number = (key, ok) => {
    const v = raw?.[key] === '' || raw?.[key] === null ? NaN : Number(raw?.[key]);
    return Number.isFinite(v) && ok(v) ? v : base[key];
  };
  const weight = (key) => number(key, (v) => v >= 0);
  return { preset, wF: weight('wF'), wS: weight('wS'), wP: weight('wP'), blockStrength: number('blockStrength', (v) => v > 0), gemFortune: base.gemFortune };
}

const QUALITY = ['ROUGH', 'FLAWED', 'FINE', 'FLAWLESS', 'PERFECT'];
const TOOLS = new Set(['DRILL', 'PICKAXE', 'GAUNTLET']);
const GEM_SLOTS = ['MINING', 'UNIVERSAL'];

function plus(sum, stats, times = 1) {
  for (const [k, v] of Object.entries(stats ?? {})) if (AREA_STATS.mining.includes(k)) sum[k] = (sum[k] ?? 0) + v * times;
  return sum;
}
const difference = (next, old) => plus(plus({}, next), old, -1);
const total = (list) => list.reduce((sum, stats) => plus(sum, stats), {});
const worn = (loadout) => [...loadout.armor, ...loadout.equipment, ...(loadout.held ? [loadout.held] : [])];
const slotsOf = (d, guide) => (typeof d.on === 'string' ? guide.groups?.[d.on] : d.on);

// The piece a step works on: the one in the loadout, else one owned, else the one it will be.
function targetOf(ids, loadout, profile) {
  return worn(loadout).find((i) => ids.includes(i.id)) ?? profile.items.find((i) => ids.includes(i.id))
    ?? { id: ids[0], gems: [], enchants: {}, parts: {}, reforge: null, recomb: false, polarvoid: 0, coating: false };
}
const targetsOf = (d, guide, loadout, profile) => slotsOf(d, guide)?.map((ids) => targetOf(ids, loadout, profile)) ?? null;
const rarityOf = (item, items) => {
  const i = RARITIES.indexOf(items?.[item.id]?.tier);
  return i < 0 ? -1 : Math.min(i + (item.recomb ? 1 : 0), RARITIES.length - 1);
};

// The piece a new item takes the place of, and whether it is really in use.
export function replaced(id, loadout, profile, items) {
  const category = items[id]?.category;
  if (category === 'ACCESSORY') {
    const family = items[id].family ?? id;
    return { item: loadout.accessories.find((a) => (items[a.id]?.family ?? a.id) === family) ?? null, inUse: true };
  }
  if (TOOLS.has(category)) return { item: loadout.held, inUse: true };
  const inSlot = worn(loadout).find((i) => items[i.id]?.category === category);
  if (inSlot) return { item: inSlot, inUse: true };
  if ([...loadout.armor, ...loadout.equipment].length && ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS', 'NECKLACE', 'CLOAK', 'BELT', 'GLOVES', 'BRACELET'].includes(category)) return { item: null, inUse: true };
  // no slot for it, like a lantern: the strongest one owned is what it improves on
  const strength = (i) => Object.values(plus({}, items[i.id]?.stats)).reduce((sum, v) => sum + v, 0);
  const owned = profile.items.filter((i) => items[i.id]?.category === category);
  return { item: owned.reduce((best, i) => (!best || strength(i) > strength(best) ? i : best), null), inUse: false };
}

function ownedDelta(d, guide, loadout, profile, items) {
  const slots = slotsOf(d, guide);
  if (!slots || !items) return null;
  const open = slots.filter((ids) => !profile.items.some((i) => ids.includes(i.id)));
  const taken = open.slice(0, Math.max((d.need ?? slots.length) - (slots.length - open.length), 0));
  const deltas = [];
  for (const [id] of taken) {
    if (!items[id]) return null;
    deltas.push(difference(items[id].stats, items[replaced(id, loadout, profile, items).item?.id]?.stats));
  }
  return total(deltas);
}

function enchantDelta(d, guide, loadout, profile, settings) {
  if (ENCHANTS_NO_STAT.has(d.enchant)) return {};
  const table = ENCHANTS[d.enchant];
  const targets = targetsOf(d, guide, loadout, profile);
  if (!table || !targets || (table.gemstonesOnly && settings.gemFortune === false)) return null;
  const at = (level) => Object.fromEntries(Object.entries(table.stats).map(([stat, values]) => [stat, level ? values[level - 1] : 0]));
  if (Object.values(at(d.level)).includes(undefined)) return null;
  const open = targets.filter((t) => (t.enchants?.[d.enchant] ?? 0) < d.level).slice(0, d.need ?? targets.length);
  return total(open.map((t) => difference(at(d.level), at(t.enchants?.[d.enchant] ?? 0))));
}

// shortcut: two gem parts of one step can both count the same free MINING slot; split the slots if a step shows too much.
function gemDelta(d, guide, loadout, profile, items) {
  const table = GEMS[d.type];
  const targets = targetsOf(d, guide, loadout, profile);
  if (!table || !targets || !items) return null;
  const gains = [];
  let have = 0;
  for (const t of targets) {
    const r = rarityOf(t, items);
    if (r < 0) return null;
    for (const g of (t.gems ?? []).filter((gem) => gem.type === d.type)) {
      if (QUALITY.indexOf(g.quality) >= QUALITY.indexOf(d.quality)) have++;
      else gains.push(table[d.quality][r] - (table[g.quality]?.[r] ?? 0));
    }
    const seen = {};
    for (const { slot_type: type } of items[t.id]?.gemstone_slots ?? []) {
      const key = `${type}_${seen[type] = (seen[type] ?? -1) + 1}`;
      if ((type === d.type || GEM_SLOTS.includes(type)) && !t.gems?.some((g) => g.slot === key)) gains.push(table[d.quality][r]);
    }
  }
  const open = Math.max((d.need ?? targets.length) - have, 0);
  const sum = gains.sort((a, b) => b - a).slice(0, open).reduce((n, v) => n + v, 0);
  return sum ? { [GEM_STAT[d.type]]: sum } : {};
}

const reforgeAt = (name, rarity) => {
  if (REFORGES_NO_STAT.has(name)) return {};
  const table = REFORGES[name];
  return table ? Object.fromEntries(Object.entries(table).map(([stat, values]) => [stat, values[rarity]])) : null;
};

function reforgeDelta(d, guide, loadout, profile, items) {
  const targets = targetsOf(d, guide, loadout, profile);
  if (!targets || !items) return null;
  const deltas = [];
  for (const t of targets) {
    const old = t.reforge ? String(t.reforge).toLowerCase() : null;
    if (d.value.includes(old)) continue;
    const r = rarityOf(t, items);
    const next = reforgeAt(d.value[0], r);
    const before = old ? reforgeAt(old, r) : {};
    if (r < 0 || !next || !before) return null;
    deltas.push(difference(next, before));
  }
  return total(deltas.slice(0, d.need ?? targets.length));
}

// Only what the higher rarity lifts of gems and reforge. A reforge without a known value stays out of it.
function recombDelta(d, guide, loadout, profile, items) {
  const targets = targetsOf(d, guide, loadout, profile);
  if (!targets || !items) return null;
  const deltas = [];
  for (const t of targets.filter((item) => !item.recomb)) {
    const r = rarityOf(t, items);
    if (r < 0) return null;
    const next = Math.min(r + 1, RARITIES.length - 1);
    const sum = {};
    for (const g of t.gems ?? []) {
      const values = GEMS[g.type]?.[g.quality];
      if (values) plus(sum, { [GEM_STAT[g.type]]: values[next] - values[r] });
    }
    const name = String(t.reforge).toLowerCase();
    if (REFORGES[name]) plus(sum, difference(reforgeAt(name, next), reforgeAt(name, r)));
    deltas.push(sum);
  }
  return total(deltas.slice(0, d.need ?? targets.length));
}

// What a change of the profile does to the calculated stats. No visible change means the data has no value for it.
function recomputed(change, profile, items, loadout) {
  const before = computeStats(profile, items, loadout, 'mining').total;
  const after = computeStats({ ...profile, ...change }, items, loadout, 'mining').total;
  const delta = Object.fromEntries(Object.entries(difference(after, before)).filter(([, v]) => v));
  return Object.keys(delta).length ? delta : null;
}

function partStats(id, profile, items, loadout) {
  const part = PARTS[id];
  if (!part) return null;
  if (!part.hotmLevels) return part.stats;
  if (!profile.hotm) return null;
  const nodes = Object.fromEntries(Object.entries(profile.hotm.nodes ?? {}).map(([k, v]) => [k, v > 0 ? v + part.hotmLevels : v]));
  return recomputed({ hotm: { ...profile.hotm, nodes } }, profile, items, loadout);
}

function partDelta(d, loadout, profile, items) {
  const next = PARTS[d.ids[0]];
  if (!next) return null;
  const old = loadout.held?.parts?.[next.kind] ? String(loadout.held.parts[next.kind]).toUpperCase() : null;
  if (d.ids.includes(old)) return {};
  const after = partStats(d.ids[0], profile, items, loadout);
  const before = old ? partStats(old, profile, items, loadout) : {};
  return after && before ? difference(after, before) : null;
}

function polarvoidDelta(d, guide, loadout, profile) {
  const [tool] = targetsOf(d, guide, loadout, profile) ?? [];
  if (!tool) return null;
  const have = tool.polarvoid ?? 0;
  const books = Math.max(Math.min(d.need ?? POLARVOID.max, POLARVOID.max) - have, 0);
  return { ...(books && { MINING_SPEED: books * POLARVOID.speed }), ...(books && !have && { MINING_FORTUNE: POLARVOID.fortune }) };
}

function coatingDelta(d, guide, loadout, profile, items) {
  const targets = targetsOf(d, guide, loadout, profile);
  if (!targets || !items) return null;
  const open = targets.filter((t) => !t.coating).slice(0, d.need ?? targets.length);
  return total(open.map((t) => (items[t.id]?.category === 'DRILL' ? COATING.drill : COATING.other)));
}

function partOf(d, guide, loadout, profile, items, settings) {
  switch (d.kind) {
    case 'owned': return ownedDelta(d, guide, loadout, profile, items);
    case 'enchant': return enchantDelta(d, guide, loadout, profile, settings);
    case 'gem': return gemDelta(d, guide, loadout, profile, items);
    case 'reforge': return reforgeDelta(d, guide, loadout, profile, items);
    case 'recomb': return recombDelta(d, guide, loadout, profile, items);
    case 'part': return partDelta(d, loadout, profile, items);
    case 'polarvoid': return polarvoidDelta(d, guide, loadout, profile);
    case 'coating': return coatingDelta(d, guide, loadout, profile, items);
    case 'perk': return profile.hotm ? recomputed({ hotm: { ...profile.hotm, nodes: { ...profile.hotm.nodes, [d.perk]: d.level } } }, profile, items, loadout) : null;
    case 'attr': return profile.attrs ? recomputed({ attrs: { ...profile.attrs, [d.attr]: d.need } }, profile, items, loadout) : null;
    // scroll: wiki Amber Power Scroll, +30 Mining Speed for 5 s after an ability, no uptime known. held, coll, skill: no table.
    default: return null;
  }
}

// What a step adds to the stats of the loadout. null: nothing known about it. {}: known to add nothing of ours.
export function stepDelta(step, loadout, profile, items, settings, guide) {
  const parts = [step.detect ?? []].flat().map((d) => partOf(d, guide, loadout, profile, items, settings));
  const known = parts.length && !parts.includes(null) ? total(parts) : null;
  // the guide's own number stands in only where the data has nothing to say
  if (step.gain && (!known || !Object.keys(known).length)) return plus({}, step.gain);
  return known;
}

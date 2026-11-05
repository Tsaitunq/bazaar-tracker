// Which open guide step brings the most per coin (spec 4 and 5). Pure functions over the guide, the prices and the synced profile.
import { AREA_STATS, GEAR_STATS, computeStats, maxPetStats, petStats, MIN_TRUE_DEFENSE, MIN_MP, TARGET_MP } from './stats.js';
import { DAGGERS, OFA, ADDITIVE_ENCHANTS, blazeOutput, blazeState, daggersOf, additiveOf, setBonusOf } from './blaze.js';
import { stepCost, openStep, bookOf } from './progress.js';
import { checkStep } from './requires.js';
import { walkBook, ahNet } from '../../shared/prices.js';
import { pieceExtra, pieceTotal } from './pieces.js';
import { RARITIES, ENCHANTS, ENCHANTS_NO_STAT, GEMS, GEM_STAT, GEM_SHARED_SLOTS, REFORGES, REFORGES_NO_STAT, COLDFUSED_WISP, REFORGE_TARGETS, CATACOMBS_REFORGE, ENCHANT_EFFECTS, ACCESSORY_POWER, PARTS, POLARVOID, COATING } from './optimizer-data.js';

// Spec 4.1. Gemstone Fortune applies on gemstones only (wiki Pristine), and the other fortunes are not counted, so mithril and glacite read low.
export const PRESETS = {
  gemstone: { blockStrength: 3000, wF: 1, wS: 1, wP: 1, gemFortune: true },
  shafting: { blockStrength: 3000, wF: 1, wS: 1, wP: 1, gemFortune: true },
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

function plus(sum, stats, times = 1) {
  for (const [k, v] of Object.entries(stats ?? {})) sum[k] = (sum[k] ?? 0) + v * times;
  return sum;
}
const onlyOf = (stats, area) => Object.fromEntries(Object.entries(stats).filter(([k]) => AREA_STATS[area].includes(k)));
const gearOnly = (stats, area) => Object.fromEntries(Object.entries(stats).filter(([k]) => GEAR_STATS[area].includes(k)));
const difference = (next, old) => plus(plus({}, next), old, -1);
const total = (list) => list.reduce((sum, stats) => plus(sum, stats), {});
const worn = (loadout) => [...loadout.armor, ...loadout.equipment, ...Object.values(loadout.daggers ?? {}).filter(Boolean), ...(loadout.held ? [loadout.held] : [])];
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
export function replaced(id, loadout, profile, items, area = 'mining') {
  // a dagger only ever takes the place of its own line
  if (DAGGERS[id]) return { item: loadout.daggers?.[DAGGERS[id].line] ?? null, inUse: false };
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
  const strength = (i) => Object.values(onlyOf(items[i.id]?.stats ?? {}, area)).reduce((sum, v) => sum + v, 0);
  const owned = profile.items.filter((i) => items[i.id]?.category === category);
  return { item: owned.reduce((best, i) => (!best || strength(i) > strength(best) ? i : best), null), inUse: false };
}

// The ids a step of owned still has to bring: the first of each slot nothing is owned of, as many as it needs.
function openRungs(d, guide, profile) {
  const slots = slotsOf(d, guide);
  if (!slots) return null;
  const open = slots.filter((ids) => !profile.items.some((i) => ids.includes(i.id)));
  return open.slice(0, Math.max((d.need ?? slots.length) - (slots.length - open.length), 0)).map(([id]) => id);
}

function ownedDelta(d, guide, loadout, profile, items, area) {
  const rungs = openRungs(d, guide, profile);
  if (!rungs || !items) return null;
  const deltas = [];
  for (const id of rungs) {
    if (!items[id]) return null;
    deltas.push(difference(items[id].stats, items[replaced(id, loadout, profile, items, area).item?.id]?.stats));
  }
  return total(deltas);
}

function enchantDelta(d, guide, loadout, profile, settings, items) {
  if (ENCHANTS_NO_STAT.has(d.enchant)) return {};
  const table = ENCHANTS[d.enchant];
  const targets = targetsOf(d, guide, loadout, profile);
  if (!table || !targets || (table.gemstonesOnly && settings.gemFortune === false)) return null;
  const at = (level) => Object.fromEntries(Object.entries(table.stats).map(([stat, values]) => [stat, level ? values[level - 1] : 0]));
  if (Object.values(at(d.level)).includes(undefined)) return null;
  const fits = (t) => !table.only || items?.[t.id]?.category === table.only;
  const open = targets.filter((t) => fits(t) && (t.enchants?.[d.enchant] ?? 0) < d.level).slice(0, table.only ? 1 : d.need ?? targets.length);
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
      else if (table[d.quality][r] === undefined) return null;
      else gains.push(table[d.quality][r] - (table[g.quality]?.[r] ?? 0));
    }
    const seen = {};
    for (const { slot_type: type } of items[t.id]?.gemstone_slots ?? []) {
      const key = `${type}_${seen[type] = (seen[type] ?? -1) + 1}`;
      if ((type === d.type || GEM_SHARED_SLOTS[d.type].includes(type)) && !t.gems?.some((g) => g.slot === key)) {
        if (table[d.quality][r] === undefined) return null;
        gains.push(table[d.quality][r]);
      }
    }
  }
  const open = Math.max((d.need ?? targets.length) - have, 0);
  const sum = gains.sort((a, b) => b - a).slice(0, open).reduce((n, v) => n + v, 0);
  return sum ? { [GEM_STAT[d.type]]: sum } : {};
}

// The "no stat" list only speaks for mining; for Blaze a reforge outside the table is unknown.
const reforgeAt = (name, rarity, area = 'mining', pet = null, rules = null) => {
  const table = REFORGES[name];
  if (!table) return area === 'mining' && REFORGES_NO_STAT.has(name) ? {} : null;
  let stats = Object.fromEntries(Object.entries(table).map(([stat, values]) => [stat, values[rarity]]));
  if (name === 'coldfused' && /_WISP$/.test(pet?.type ?? '')) stats = plus(stats, COLDFUSED_WISP);
  // Withered and Ancient grow with the Catacombs level; unknown level counts nothing
  const level = rules?.gear?.catacombs;
  if (CATACOMBS_REFORGE[name] && level !== null && level !== undefined) stats = plus(stats, CATACOMBS_REFORGE[name], level);
  return stats;
};

// Whether a reforge can sit on this piece (NEU itemTypes). A reforge without an entry fits anywhere.
const reforgeFits = (name, id, items) => {
  const rule = REFORGE_TARGETS[name];
  return !rule || (rule.ids ? rule.ids.includes(id) : rule.category.includes(items?.[id]?.category));
};

function reforgeDelta(d, guide, loadout, profile, items, area, rules) {
  const targets = targetsOf(d, guide, loadout, profile);
  if (!targets || !items) return null;
  const deltas = [];
  for (const t of targets) {
    const old = t.reforge ? String(t.reforge).toLowerCase() : null;
    if (d.value.includes(old)) continue;
    const r = rarityOf(t, items);
    if (area === 'blaze' && !reforgeFits(d.value[0], t.id, items)) return null;
    const next = reforgeAt(d.value[0], r, area, loadout.pet, rules);
    const before = old ? reforgeAt(old, r, area, loadout.pet, rules) : {};
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
      if (values?.[next] !== undefined) plus(sum, { [GEM_STAT[g.type]]: values[next] - values[r] });
    }
    const name = String(t.reforge).toLowerCase();
    if (REFORGES[name]) plus(sum, difference(reforgeAt(name, next), reforgeAt(name, r)));
    deltas.push(sum);
  }
  return total(deltas.slice(0, d.need ?? targets.length));
}

// What a change of the profile does to the calculated stats. No visible change means the data has no value for it.
function recomputed(change, profile, items, loadout, area = 'mining') {
  const before = computeStats(profile, items, loadout, area).total;
  const after = computeStats({ ...profile, ...change }, items, loadout, area).total;
  const delta = Object.fromEntries(Object.entries(gearOnly(difference(after, before), area)).filter(([, v]) => v));
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

// Spec 5.4: a pet at the top of its table against the one picked. A type with no entry for that rarity has no value.
function petDelta(d, loadout) {
  const type = d.types.find((t) => maxPetStats(t, d.tier ?? 'LEGENDARY'));
  return type ? difference(maxPetStats(type, d.tier ?? 'LEGENDARY'), loadout.pet ? petStats(loadout.pet) : {}) : null;
}

function partOf(d, guide, loadout, profile, items, settings, area = 'mining', rules = null) {
  switch (d.kind) {
    case 'owned': return ownedDelta(d, guide, loadout, profile, items, area);
    case 'enchant': return enchantDelta(d, guide, loadout, profile, settings, items);
    case 'gem': return gemDelta(d, guide, loadout, profile, items);
    case 'reforge': return reforgeDelta(d, guide, loadout, profile, items, area, rules);
    case 'pet': return petDelta(d, loadout);
    case 'power': return d.value === profile.selectedPower ? {} : recomputed({ selectedPower: d.value }, profile, items, loadout, area);
    case 'recomb': return recombDelta(d, guide, loadout, profile, items);
    case 'part': return partDelta(d, loadout, profile, items);
    case 'polarvoid': return polarvoidDelta(d, guide, loadout, profile);
    case 'coating': return coatingDelta(d, guide, loadout, profile, items);
    case 'perk': return profile.hotm ? recomputed({ hotm: { ...profile.hotm, nodes: { ...profile.hotm.nodes, [d.perk]: d.level } } }, profile, items, loadout, area) : null;
    case 'attr': return profile.attrs ? recomputed({ attrs: { ...profile.attrs, [d.attr]: d.need } }, profile, items, loadout, area) : null;
    // scroll: wiki Amber Power Scroll, +30 Mining Speed for 5 s after an ability, no uptime known. held, coll, skill: no table.
    default: return null;
  }
}

// What a step adds to the stats of the loadout. null: nothing known about it. {}: known to add nothing of ours.
export function stepDelta(step, loadout, profile, items, settings, guide) {
  // a fixed guide states what each step adds on top of the one before; every stat stays for the display
  if (guide?.order === 'fixed' && step.gain) return { ...step.gain };
  const parts = [step.detect ?? []].flat().map((d) => partOf(d, guide, loadout, profile, items, settings));
  const known = parts.length && !parts.includes(null) ? onlyOf(total(parts), 'mining') : null;
  // the guide's own number stands in only where the data has nothing to say
  if (step.gain && (!known || !Object.keys(known).length)) return onlyOf(step.gain, 'mining');
  return known;
}

// Accessory Power of an accessory; null where the wiki gives it its own rule.
export function accessoryPower(id, recomb, items) {
  if (id === 'RIFT_PRISM' || id?.startsWith('ABICASE')) return null;
  const tier = items[id]?.tier;
  const i = RARITIES.indexOf(tier);
  const power = ACCESSORY_POWER[recomb && i >= 0 ? RARITIES[Math.min(i + 1, RARITIES.length - 1)] : tier];
  if (power === undefined) return null;
  return id === 'HEGEMONY_ARTIFACT' ? power * 2 : power;
}

// What a step does to the Accessory Power; null when an accessory in it follows its own rule.
function powerDelta(d, guide, loadout, profile, items) {
  const accessory = (id) => items?.[id]?.category === 'ACCESSORY';
  let sum = 0;
  if (d.kind === 'owned') {
    for (const id of openRungs(d, guide, profile) ?? []) {
      if (!accessory(id)) continue;
      const next = accessoryPower(id, false, items);
      const old = replaced(id, loadout, profile, items, 'blaze').item;
      const before = old ? accessoryPower(old.id, old.recomb, items) : 0;
      if (next === null || before === null) return null;
      sum += next - before;
    }
  }
  if (d.kind === 'recomb') {
    for (const t of targetsOf(d, guide, loadout, profile) ?? []) {
      if (!accessory(t.id) || t.recomb) continue;
      const [plain, lifted] = [accessoryPower(t.id, false, items), accessoryPower(t.id, true, items)];
      if (plain === null || lifted === null) return null;
      sum += lifted - plain;
    }
  }
  return sum;
}

// A step for Blaze: what it does to the shared stats, to one dagger line, to the enchants and to the Accessory Power.
// rules (pieces.js): stars, potato books and Bling Armor of a piece; without them a piece is only its item stats.
export function blazeDelta(step, state, loadout, profile, items, settings, guide, rules = null) {
  const change = { common: {}, lines: { ashen: {}, spirit: {} }, enchants: { ashen: {}, spirit: {} }, swaps: {}, armor: [], ofa: false, mp: 0, missing: [], notes: [] };
  const fallback = () => (step.gain ? { ...change, common: onlyOf(step.gain, 'blaze') } : null);
  const parts = [step.detect ?? []].flat();
  if (!parts.length) return fallback();
  for (const d of parts) {
    const slots = d.on === undefined ? null : slotsOf(d, guide);
    if (slots?.some((ids) => DAGGERS[ids[0]])) {
      for (const ids of slots.filter((list) => DAGGERS[list[0]])) {
        if (!weaponPart({ ...d, on: [ids], need: 1 }, ids, change, state, loadout, profile, items, settings, guide, rules)) return fallback();
      }
      continue;
    }
    const delta = partOf(d, guide, loadout, profile, items, settings, 'blaze', rules);
    const power = powerDelta(d, guide, loadout, profile, items);
    if (!delta || power === null) return fallback();
    plus(change.common, delta);
    change.mp += power;
    if (d.kind === 'owned') {
      for (const id of openRungs(d, guide, profile) ?? []) {
        if (!isArmor(items?.[id]?.category)) continue;
        const out = replaced(id, loadout, profile, items, 'blaze').item?.id ?? null;
        change.armor.push({ out, in: id });
        plus(change.common, difference(pieceExtra(id, items, rules), out ? pieceExtra(out, items, rules) : {}));
      }
    }
    if (d.kind === 'pet') change.notes.push('At max level. Abilities are not counted.');
  }
  if (change.mp && profile.mp !== null && profile.mp !== undefined) plus(change.common, recomputed({ mp: profile.mp + change.mp }, profile, items, loadout, 'blaze'));
  // the set bonus of the pieces that come and go (ten stacks of Dominus)
  if (change.armor.length) {
    const left = state.armorIds.filter((id) => !change.armor.some((piece) => piece.out === id));
    const after = setBonusOf([...left, ...change.armor.map((piece) => piece.in)]).add;
    plus(change.common, difference(after, setBonusOf(state.armorIds).add));
  }
  change.common = gearOnly(change.common, 'blaze');
  const crimson = change.armor.some((piece) => piece.in.includes('_CRIMSON_')) && new Set([...state.armorIds.filter((id) => !change.armor.some((piece) => piece.out === id)), ...change.armor.map((piece) => piece.in)].filter((id) => id.includes('_CRIMSON_'))).size === 4;
  if (crimson) change.notes.push('Set bonus not fully rated.');
  const nothing = !Object.values(change.common).some(Boolean) && !change.ofa && !change.mp && !Object.keys(change.swaps).length && !change.armor.length
    && !Object.values(change.lines).some((s) => Object.values(s).some(Boolean)) && !Object.values(change.enchants).some((e) => Object.keys(e).length);
  return nothing && step.gain ? fallback() : change;
}

const isArmor = (category) => ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'].includes(category);

// One dagger of a step. false: nothing known about it.
function weaponPart(d, ids, change, state, loadout, profile, items, settings, guide, rules) {
  const { line } = DAGGERS[ids[0]];
  const dagger = state.daggers[line];
  if (d.kind === 'owned') {
    if (dagger && ids.includes(dagger.id)) return true;
    if (!items?.[ids[0]]) return false;
    change.swaps[line] = { id: ids[0], lore: difference(pieceTotal(ids[0], items, rules), dagger ? pieceTotal(dagger.id, items, rules) : {}) };
    if (!dagger) change.missing.push(line);
    return true;
  }
  if (d.kind === 'enchant') {
    if (d.enchant === OFA) { change.ofa = state.path !== 'ofa'; return true; }
    if (state.path === 'ofa') {
      change.notes.push('Not used with One For All.');
      return true;
    }
    // Chimera copies a share of the active pet's stats onto the dagger; the lore of the dagger gets it when the step is done
    if (d.enchant === 'ultimate_chimera') {
      const share = (level) => (ENCHANT_EFFECTS.ultimate_chimera.values[level - 1] ?? 0) / 100;
      const have = dagger?.enchants?.ultimate_chimera ?? 0;
      if (have < d.level) {
        change.enchants[line][d.enchant] = d.level;
        plus(change.lines[line], rules?.petStats ?? {}, share(d.level) - share(have));
      }
      return true;
    }
    if (ADDITIVE_ENCHANTS.has(d.enchant)) {
      if ((dagger?.enchants?.[d.enchant] ?? 0) < d.level) change.enchants[line][d.enchant] = d.level;
      return true;
    }
  }
  const delta = partOf(d, guide, loadout, profile, items, settings, 'blaze', rules);
  if (!delta) return false;
  plus(change.lines[line], delta);
  return true;
}

// The state after a step. Pure: the state itself stays.
export function applyBlaze(state, change) {
  const daggers = { ...state.daggers };
  for (const line of ['ashen', 'spirit']) {
    const swap = change.swaps[line];
    const hasEnchant = Object.keys(change.enchants[line]).length;
    const hasStats = Object.values(change.lines[line]).some(Boolean);
    if (!swap && !hasEnchant && !hasStats) continue;
    const old = daggers[line] ?? { enchants: {}, lore: {} };
    daggers[line] = { ...old, id: swap?.id ?? old.id, enchants: { ...old.enchants, ...change.enchants[line] }, lore: plus(plus({ ...old.lore }, swap?.lore), change.lines[line]) };
  }
  let armorIds = state.armorIds;
  for (const piece of change.armor) armorIds = [...armorIds.filter((id) => id !== piece.out), piece.in];
  return { ...state, common: plus({ ...state.common }, change.common), daggers, armorIds, path: change.ofa ? 'ofa' : state.path };
}

// What the replaced piece brings: sold to the buy orders minus the bazaar tax, else its BIN minus the auction fees. 0 without a price.
function resaleOf(id, ctx) {
  const book = walkBook(ctx.products?.[id]?.sell_summary, 1, false);
  if (book) return book * (1 - (ctx.tax ?? 0));
  const bin = ctx.ah?.[id] > 0 ? ctx.ah[id] : ctx.cofl?.[id];
  if (bin === undefined && ctx.products) ctx.wants?.add(id);
  return bin > 0 ? ahNet(bin, ctx.derpy) : 0;
}

// The recipe takes the old piece in: it cannot also be sold.
function consumes(id, old, step, ctx) {
  const lines = (step.items ?? []).filter((i) => i.id === id);
  const recipes = [...lines.map((i) => i.forge), ctx.forge?.[id]].filter(Boolean);
  return recipes.some((r) => old in r.i) || lines.some((i) => i.without?.includes(old))
    || ctx.items?.[id]?.prestige?.item_id === old || Object.values(ctx.items?.[id]?.parent ?? {}).includes(old);
}

// Spec 5.7. Only an item swap sells something: reforges, gems and enchants carry over, so the base price is on the careful side.
export function netCost(step, gross, loadout, other, items, ctx, keepOldGear) {
  const soldIds = [];
  let resale = 0;
  if (!keepOldGear && ctx.profile && items) {
    const elsewhere = new Set(other ? [...worn(other), ...other.accessories].map((i) => i.id) : []);
    for (const d of [step.detect ?? []].flat().filter((part) => part.kind === 'owned')) {
      for (const id of openRungs(d, ctx.guide, ctx.profile) ?? []) {
        const { item, inUse } = replaced(id, loadout, ctx.profile, items);
        if (!item || !inUse || elsewhere.has(item.id) || ctx.nt?.has(item.id) || consumes(id, item.id, step, ctx)) continue;
        const price = resaleOf(item.id, ctx);
        if (price > 0) { resale += price; soldIds.push(item.id); }
      }
    }
  }
  return { net: Math.max(gross - resale, 0), resale, soldIds };
}

// Spec 5.3: from the first open step of a line up to the first one that brings something. What stands in the way decides.
export function walkLine(chain, ctx, rules) {
  const steps = [];
  let unknown = false;
  const notes = [];
  for (const entry of chain) {
    steps.push(entry);
    const { status, reasons } = checkStep(entry.step, ctx.items, ctx.profile);
    if (status === 'locked') return { group: 'locked', reasons };
    unknown ||= status === 'unknown';
    const delta = rules.deltaOf(entry.step);
    if (!delta) return { group: 'noGain', unknown };
    const verdict = rules.verdict?.(delta) ?? {};
    if (verdict.breaks) return { group: 'locked', reasons: [verdict.breaks] };
    notes.push(...(delta.notes ?? []));
    const gain = rules.gainOf(delta);
    if (gain > 0 || verdict.helps?.length) return { steps, target: entry, delta, gain, unknown, helps: verdict.helps ?? [], progress: verdict.progress ?? 0, notes };
  }
  return { group: 'zero', unknown, notes };
}

// A line of books pays only for its last one: that price is the cheapest way there, so the levels between are in it.
export function chainCost({ steps, target }, ctx) {
  const list = bookOf(target.step) ? [target] : steps;
  const costs = list.map(({ section, step }) => stepCost(openStep(section, step, ctx), ctx));
  return { coins: costs.reduce((n, c) => n + c.coins, 0), unpriced: costs.reduce((n, c) => n + c.unpriced, 0) };
}

// Spec 4.2 and 4.3: gain in damage per second, and what a step does to the limits. An unread value locks nothing and helps nothing.
export function blazeRules(state, loadout, ctx, settings, guide) {
  const now = blazeOutput(state);
  const td = ctx.profile.missing?.inventory ? null : state.common.TRUE_DEFENSE ?? 0;
  const mp = ctx.profile.mp ?? null;
  return {
    deltaOf: (step) => blazeDelta(step, state, loadout, ctx.profile, ctx.items, settings, guide, ctx.rules),
    gainOf: (change) => (now > 0 ? blazeOutput(applyBlaze(state, change)) / now - 1 : 0),
    verdict: (change) => {
      const moreTd = change.common.TRUE_DEFENSE ?? 0;
      if (td !== null && td >= MIN_TRUE_DEFENSE && td + moreTd < MIN_TRUE_DEFENSE) return { breaks: `Would drop True Defense below ${MIN_TRUE_DEFENSE}` };
      if (mp !== null && mp >= MIN_MP && mp + change.mp < MIN_MP) return { breaks: `Would drop Magical Power below ${MIN_MP}` };
      const helps = [];
      let progress = 0;
      if (td !== null && td < MIN_TRUE_DEFENSE && moreTd > 0) { helps.push('trueDefense'); progress = Math.max(progress, Math.min(moreTd / (MIN_TRUE_DEFENSE - td), 1)); }
      if (mp !== null && mp < MIN_MP && change.mp > 0) { helps.push('mp'); progress = Math.max(progress, Math.min(change.mp / (MIN_MP - mp), 1)); }
      if (change.missing.length) { helps.push('dagger'); progress = 1; }
      return { helps, progress };
    },
  };
}

const share = (v) => { const p = v * 100; return Math.abs(p) >= 0.1 ? p.toFixed(1) : p.toPrecision(1); };
export const LEFT_OUT = 'Estimate: compares upgrades, says nothing about real kill time. Not modelled: Thunderlord, Fire Aspect, Crimson swipe, Burning Vengeance, Venomous, demon phases, pillars.';

// Spec 4.3 as data.
export function limitsOf(profile, state) {
  const trueDefense = profile.missing?.inventory ? null : state.common.TRUE_DEFENSE ?? 0;
  const mp = profile.mp ?? null;
  return {
    trueDefense, mp, minTrueDefense: MIN_TRUE_DEFENSE, minMp: MIN_MP, targetMp: TARGET_MP,
    lowTrueDefense: trueDefense !== null && trueDefense < MIN_TRUE_DEFENSE,
    lowMp: mp !== null && mp < MIN_MP,
    underTarget: mp !== null && mp >= MIN_MP && mp < TARGET_MP,
    unknown: trueDefense === null || mp === null,
  };
}

// One For All against the guide's enchants (spec 4.2) as data.
export function pathsOf(state) {
  const lines = Object.values(state.daggers).filter(Boolean);
  const factor = (path) => (lines.length ? lines.reduce((sum, d) => sum + 1 + additiveOf(d, state.armorIds, path) / 100, 0) / lines.length : 1 + additiveOf(null, state.armorIds, path) / 100);
  const [guideOut, ofaOut] = [blazeOutput(state, 'guide'), blazeOutput(state, 'ofa')];
  return {
    guide: factor('guide'), ofa: factor('ofa'),
    leader: ofaOut >= guideOut ? 'One For All' : 'Enchants',
    lead: (Math.max(ofaOut, guideOut) / Math.max(Math.min(ofaOut, guideOut), 1e-9) - 1) * 100,
    inUse: state.path === 'ofa' ? 'One For All' : 'Enchants',
  };
}

// How a bare value reads. Swap this per area when the measure changes, for example to coins per hour: views only ever print these.
// rate: share per million coins. Two decimals always, the short coin format would hide a difference here.
const perOne = (rate) => {
  const v = 1e4 / rate;
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  return v >= 1e3 ? `${(v / 1e3).toFixed(2)}k` : `${Math.round(v)}`;
};
const scoreOf = (unit) => ({
  gainText: (gain) => `+${share(gain)} % ${unit}`,
  rateText: (rate) => `${perOne(rate)} per 1 %`,
  rateLong: (rate) => `${perOne(rate)} per 1 % ${unit}`,
});
export const SCORES = { mining: scoreOf('yield'), blaze: scoreOf('damage') };

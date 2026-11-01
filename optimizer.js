// Which open guide step brings the most per coin (spec 4 and 5). Pure functions over the guide, the prices and the synced profile.
import { AREA_STATS, computeStats, miningScore, loadoutOf, withOffset, offsetStale, maxPetStats, petStats, MIN_TRUE_DEFENSE, MIN_MP, TARGET_MP } from './stats.js';
import { DAGGERS, OFA, ADDITIVE_ENCHANTS, blazeOutput, blazeState, daggersOf, additiveOf } from './blaze.js';
import { nextUpgrades, stepCost, openStep, bookOf, stepKey, stepRow } from './progress.js';
import { esc, coins } from './render.js';
import { checkStep } from './requires.js';
import { walkBook } from './craft.js';
import { ahNet } from './forge.js';
import { RARITIES, ENCHANTS, ENCHANTS_NO_STAT, GEMS, GEM_STAT, GEM_SHARED_SLOTS, REFORGES, REFORGES_NO_STAT, COLDFUSED_WISP, ACCESSORY_POWER, PARTS, POLARVOID, COATING } from './optimizer-data.js';

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

function plus(sum, stats, times = 1) {
  for (const [k, v] of Object.entries(stats ?? {})) sum[k] = (sum[k] ?? 0) + v * times;
  return sum;
}
const onlyOf = (stats, area) => Object.fromEntries(Object.entries(stats).filter(([k]) => AREA_STATS[area].includes(k)));
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
const reforgeAt = (name, rarity, area = 'mining', pet = null) => {
  const table = REFORGES[name];
  if (!table) return area === 'mining' && REFORGES_NO_STAT.has(name) ? {} : null;
  const stats = Object.fromEntries(Object.entries(table).map(([stat, values]) => [stat, values[rarity]]));
  return name === 'coldfused' && /_WISP$/.test(pet?.type ?? '') ? plus(stats, COLDFUSED_WISP) : stats;
};

function reforgeDelta(d, guide, loadout, profile, items, area) {
  const targets = targetsOf(d, guide, loadout, profile);
  if (!targets || !items) return null;
  const deltas = [];
  for (const t of targets) {
    const old = t.reforge ? String(t.reforge).toLowerCase() : null;
    if (d.value.includes(old)) continue;
    const r = rarityOf(t, items);
    const next = reforgeAt(d.value[0], r, area, loadout.pet);
    const before = old ? reforgeAt(old, r, area, loadout.pet) : {};
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
  const delta = Object.fromEntries(Object.entries(onlyOf(difference(after, before), area)).filter(([, v]) => v));
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

function partOf(d, guide, loadout, profile, items, settings, area = 'mining') {
  switch (d.kind) {
    case 'owned': return ownedDelta(d, guide, loadout, profile, items, area);
    case 'enchant': return enchantDelta(d, guide, loadout, profile, settings, items);
    case 'gem': return gemDelta(d, guide, loadout, profile, items);
    case 'reforge': return reforgeDelta(d, guide, loadout, profile, items, area);
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
export function blazeDelta(step, state, loadout, profile, items, settings, guide) {
  const change = { common: {}, lines: { ashen: {}, spirit: {} }, enchants: { ashen: {}, spirit: {} }, swaps: {}, armor: [], ofa: false, mp: 0, missing: [], notes: [] };
  const fallback = () => (step.gain ? { ...change, common: onlyOf(step.gain, 'blaze') } : null);
  const parts = [step.detect ?? []].flat();
  if (!parts.length) return fallback();
  for (const d of parts) {
    const slots = d.on === undefined ? null : slotsOf(d, guide);
    if (slots?.some((ids) => DAGGERS[ids[0]])) {
      for (const ids of slots.filter((list) => DAGGERS[list[0]])) {
        if (!weaponPart({ ...d, on: [ids], need: 1 }, ids, change, state, loadout, profile, items, settings, guide)) return fallback();
      }
      continue;
    }
    const delta = partOf(d, guide, loadout, profile, items, settings, 'blaze');
    const power = powerDelta(d, guide, loadout, profile, items);
    if (!delta || power === null) return fallback();
    plus(change.common, delta);
    change.mp += power;
    if (d.kind === 'owned') {
      for (const id of openRungs(d, guide, profile) ?? []) if (isArmor(items?.[id]?.category)) change.armor.push({ out: replaced(id, loadout, profile, items, 'blaze').item?.id ?? null, in: id });
    }
    if (d.kind === 'pet') change.notes.push('At max level. Abilities are not counted.');
  }
  if (change.mp && profile.mp !== null && profile.mp !== undefined) plus(change.common, recomputed({ mp: profile.mp + change.mp }, profile, items, loadout, 'blaze'));
  change.common = onlyOf(change.common, 'blaze');
  const crimson = change.armor.some((piece) => piece.in.includes('_CRIMSON_')) && new Set([...state.armorIds.filter((id) => !change.armor.some((piece) => piece.out === id)), ...change.armor.map((piece) => piece.in)].filter((id) => id.includes('_CRIMSON_'))).size === 4;
  if (crimson) change.notes.push('Set bonus not fully rated.');
  const nothing = !Object.values(change.common).some(Boolean) && !change.ofa && !change.mp && !Object.keys(change.swaps).length && !change.armor.length
    && !Object.values(change.lines).some((s) => Object.values(s).some(Boolean)) && !Object.values(change.enchants).some((e) => Object.keys(e).length);
  return nothing && step.gain ? fallback() : change;
}

const isArmor = (category) => ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'].includes(category);

// One dagger of a step. false: nothing known about it.
function weaponPart(d, ids, change, state, loadout, profile, items, settings, guide) {
  const { line } = DAGGERS[ids[0]];
  const dagger = state.daggers[line];
  if (d.kind === 'owned') {
    if (dagger && ids.includes(dagger.id)) return true;
    if (!items?.[ids[0]]) return false;
    change.swaps[line] = { id: ids[0], lore: difference(items[ids[0]].stats, items[dagger?.id]?.stats) };
    if (!dagger) change.missing.push(line);
    return true;
  }
  if (d.kind === 'enchant') {
    if (d.enchant === OFA) { change.ofa = state.path !== 'ofa'; return true; }
    if (state.path === 'ofa') {
      change.notes.push('Not used with One For All.');
      return true;
    }
    if (ADDITIVE_ENCHANTS.has(d.enchant)) {
      if ((dagger?.enchants?.[d.enchant] ?? 0) < d.level) change.enchants[line][d.enchant] = d.level;
      return true;
    }
  }
  const delta = partOf(d, guide, loadout, profile, items, settings, 'blaze');
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
function walkLine(chain, ctx, rules) {
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
function chainCost({ steps, target }, ctx) {
  const list = bookOf(target.step) ? [target] : steps;
  const costs = list.map(({ section, step }) => stepCost(openStep(section, step, ctx), ctx));
  return { coins: costs.reduce((n, c) => n + c.coins, 0), unpriced: costs.reduce((n, c) => n + c.unpriced, 0) };
}

// Spec 4.2 and 4.3: gain in damage per second, and what a step does to the limits. An unread value locks nothing and helps nothing.
function blazeRules(state, loadout, ctx, settings, guide) {
  const now = blazeOutput(state);
  const td = ctx.profile.missing?.inventory ? null : state.common.TRUE_DEFENSE ?? 0;
  const mp = ctx.profile.mp ?? null;
  return {
    deltaOf: (step) => blazeDelta(step, state, loadout, ctx.profile, ctx.items, settings, guide),
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

// Spec 5.1. score and gain are shares: 0.012 is 1.2 %. A sum missing a price never gets a rank, it would look cheaper than it is.
export function rankUpgrades(guide, checked, ctx, loadout, settings, base, { area = 'mining', other = null, keepOldGear = false, state = null } = {}) {
  const groups = { requirements: [], free: [], ranked: [], noPrice: [], noGain: [], zero: [], locked: [] };
  const rules = area === 'blaze' ? blazeRules(state, loadout, ctx, settings, guide) : {
    deltaOf: (step) => stepDelta(step, loadout, ctx.profile, ctx.items, settings, guide),
    gainOf: (delta) => miningScore(base, delta, settings),
  };
  const firsts = nextUpgrades(guide, checked, ctx);
  const rest = (line) => guide.sections.flatMap((section) => section.steps.filter((step) => step.line === line && !checked.has(stepKey(section, step))).map((step) => ({ section, step })));
  const nt = new Set(guide.sections.flatMap((s) => s.steps.flatMap((step) => (step.items ?? []).filter((i) => i.nt && i.id).map((i) => i.id))));
  const sellCtx = { ...ctx, guide, nt };
  for (const first of firsts) {
    const row = { section: first.section, step: first.step, coins: first.coins, unpriced: first.unpriced, status: 'ok', reasons: [] };
    const walked = walkLine(first.step.line ? rest(first.step.line) : [first], ctx, rules);
    if (walked.unknown) row.status = 'unknown';
    if (walked.group) {
      groups[walked.group].push(walked.group === 'locked' ? { ...row, status: 'locked', reasons: walked.reasons } : { ...row, notes: walked.notes ?? [] });
      continue;
    }
    const { coins, unpriced } = chainCost(walked, ctx);
    const { net, resale } = netCost(walked.target.step, coins, loadout, other, ctx.items, sellCtx, keepOldGear);
    const rated = { ...row, coins, unpriced, delta: walked.delta, gain: walked.gain, net, resale, helps: walked.helps, notes: walked.notes, ahead: walked.target === walked.steps[0] ? null : walked.target.step };
    if (walked.helps.length) {
      const paid = !unpriced && (coins > 0 || walked.target.step.table);
      groups.requirements.push({ ...rated, ...(paid && net > 0 && { perMillion: walked.gain / (net / 1e6) }), pace: !paid ? -1 : net > 0 ? walked.progress / (net / 1e6) : Infinity });
    } else if (unpriced) groups.noPrice.push(rated);
    else if (net > 0) groups.ranked.push({ ...rated, perMillion: walked.gain / (net / 1e6) });
    else if (coins > 0 || walked.target.step.table) groups.free.push({ ...rated, net: 0 });
    else groups.noPrice.push(rated);
  }
  groups.requirements.sort((a, b) => b.pace - a.pace || (b.perMillion ?? 0) - (a.perMillion ?? 0));
  groups.ranked.sort((a, b) => b.perMillion - a.perMillion);
  groups.free.sort((a, b) => b.gain - a.gain);
  return groups;
}

const SLOT_GROUPS = [['HELMET'], ['CHESTPLATE'], ['LEGGINGS'], ['BOOTS'], ['NECKLACE'], ['CLOAK'], ['BELT'], ['GLOVES', 'BRACELET'], ['DRILL', 'PICKAXE', 'GAUNTLET']];

// Greedy per slot from everything owned, each pick on top of the ones before. The pet stays as picked: abilities are not in the tables.
export function bestLoadout(profile, items, loadout, base, settings) {
  const slots = [];
  let stats = plus({}, base);
  for (const group of SLOT_GROUPS) {
    const of = (i) => group.includes(items[i.id]?.category);
    const current = worn(loadout).find(of) ?? null;
    const without = difference(stats, current?.lore);
    const score = (i) => miningScore(without, i?.lore ?? {}, settings);
    let best = current;
    for (const i of profile.items.filter((item) => of(item) && item.where !== 'accessory')) if (score(i) > score(best) + 1e-12) best = i;
    stats = plus(without, best?.lore);
    if (best !== current) slots.push({ slot: group[0], current, best });
  }
  return { slots, gain: slots.length ? miningScore(base, difference(stats, base), settings) : 0 };
}

const share = (v) => { const p = v * 100; return Math.abs(p) >= 0.1 ? p.toFixed(1) : p.toPrecision(1); };
const RAW = { MINING_FORTUNE: 'Fortune', GEMSTONE_FORTUNE: 'Gemstone Fortune', ORE_FORTUNE: 'Ore Fortune', BLOCK_FORTUNE: 'Block Fortune', MINING_SPEED: 'Speed', PRISTINE: 'Pristine',
  DAMAGE: 'Damage', STRENGTH: 'Strength', CRITICAL_DAMAGE: 'Crit Damage', CRITICAL_CHANCE: 'Crit Chance', ATTACK_SPEED: 'Attack Speed', HEALTH: 'Health', DEFENSE: 'Defense', TRUE_DEFENSE: 'True Defense' };
const rawLine = (delta) => Object.entries(delta).filter(([k, v]) => v && RAW[k]).map(([k, v]) => `${v > 0 ? '+' : ''}${Math.round(v * 100) / 100} ${RAW[k]}`).join(', ');
const words = (s) => s[0].toUpperCase() + s.slice(1).toLowerCase();

// What a Blaze step moves, in the words of the stats: shared, then per dagger line.
function rawChange(c) {
  const lines = ['ashen', 'spirit'].map((line) => {
    const text = rawLine(plus(plus({}, c.swaps[line]?.lore), c.lines[line]));
    return text && `${words(line)}: ${text}`;
  });
  return [rawLine(c.common), ...lines, c.mp ? `${c.mp > 0 ? '+' : ''}${c.mp} Magical Power` : '', c.ofa ? 'One For All' : ''].filter(Boolean).join(' · ');
}

const HELP = { trueDefense: 'True Defense', mp: 'Magical Power', dagger: 'Dagger pair incomplete' };

function rowExtra(row, ctx, unit = 'yield') {
  const parts = [];
  if (row.helps?.length) parts.push(row.helps.map((h) => `<span class="guide-src" data-src="locked">${HELP[h]}</span>`).join(''));
  if (row.gain !== undefined) {
    const rate = row.perMillion === undefined ? '' : ` · ${share(row.perMillion)} %/1M`;
    const raw = unit === 'yield' ? rawLine(row.delta) : rawChange(row.delta);
    parts.push(`<small class="guide-hint"><strong>+${share(row.gain)} % ${unit}${rate}</strong></small><small class="guide-hint">${esc(raw)}</small>`);
  }
  for (const note of new Set(row.notes ?? [])) parts.push(`<small class="guide-hint">${esc(note)}</small>`);
  if (row.resale > 0) parts.push(`<small class="guide-hint">Net ${coins(row.net)} (buy ${coins(row.coins)} − resale ${coins(row.resale)})</small>`);
  if (row.ahead) parts.push(`<small class="guide-hint">Counted up to: ${esc(row.ahead.text)}</small>`);
  if (row.status === 'unknown') parts.push('<small class="guide-hint">Requirements could not be checked.</small>');
  // stepRow shows the reason of its own step, not one further along the line
  if (row.status === 'locked' && checkStep(row.step, ctx.items, ctx.profile).status !== 'locked') parts.push(`<small class="guide-hint">${esc(row.reasons.join(' · '))}</small>`);
  return parts.join('');
}

const NOTES = {
  boost: 'Your /stats do not match the God Potion / Booster Cookie settings, so they are left out.',
  noitems: 'Save your /stats again: item data was missing, so they are left out.',
  setup: 'Measure /stats again: the slot or pet changed, so they are left out.',
};

// Spec 2.5 for Blaze: per slot what brings the most damage, and never a swap that drops True Defense under its limit while it is met.
export function bestBlaze(profile, items, loadout, state) {
  const slots = [];
  let now = state;
  for (const group of SLOT_GROUPS.slice(0, -1)) {
    const of = (i) => group.includes(items[i.id]?.category);
    const current = worn(loadout).find(of) ?? null;
    const without = difference(now.common, current?.lore);
    const after = (i) => ({ ...now, common: plus({ ...without }, i?.lore), armorIds: [...now.armorIds.filter((id) => id !== current?.id), ...(i && isArmor(items[i.id]?.category) ? [i.id] : [])] });
    const td = now.common.TRUE_DEFENSE ?? 0;
    const allowed = (i) => td < MIN_TRUE_DEFENSE || (after(i).common.TRUE_DEFENSE ?? 0) >= MIN_TRUE_DEFENSE;
    let best = current;
    for (const i of profile.items.filter((item) => of(item) && item.where !== 'accessory')) {
      if (allowed(i) && blazeOutput(after(i)) > blazeOutput(after(best)) + 1e-9) best = i;
    }
    now = after(best);
    if (best !== current) slots.push({ slot: group[0], current, best });
  }
  return { slots, gain: slots.length ? blazeOutput(now) / blazeOutput(state) - 1 : 0 };
}

function bestCard(best, name, unit = 'yield', stays = 'Pet stays as picked. Set bonuses are not counted.') {
  const pick = (i) => (i ? esc(name(i.id)) : 'nothing');
  const body = best.slots.length
    ? `<strong>+${share(best.gain)} % ${unit} compared with your wardrobe slot</strong><ul class="stats-gaps">${best.slots.map((s) => `<li>${esc(words(s.slot))}: ${pick(s.current)} → ${pick(s.best)}</li>`).join('')}</ul>`
    : '<small class="guide-hint">Your wardrobe slot already is the best of what you own.</small>';
  return `<section class="guide-next" aria-label="Best possible"><h2>Best possible from what you own</h2>${body}<small class="guide-hint">${stays}</small></section>`;
}

const offsetNotes = (entry, state, loadout) => [
  ...(entry?.offset && NOTES[entry.offsetNote] ? [NOTES[entry.offsetNote]] : []),
  ...(!entry?.offset ? ['Save your /stats in Settings to include what the app cannot read.'] : []),
  ...(offsetStale(entry, entry?.choice) ? ['Measure /stats again: the slot or pet changed.'] : []),
  ...(entry?.at && entry.at < state.syncedAt ? ['Your /stats values are older than the last sync.'] : []),
  ...loadout.gaps,
];

const noSync = '<section class="guide-next" aria-label="Best value"><h2>Best value</h2><p class="muted">Sync your profile to rank the upgrades against what you have.</p><div class="actions"><button type="button" data-open-settings>Open settings</button></div></section>';

const LEFT_OUT = 'Estimate: compares upgrades, says nothing about real kill time. Not modelled: Thunderlord, Fire Aspect, Crimson swipe, Burning Vengeance, Venomous, demon phases, pillars.';

function limitsView(profile, state) {
  const td = profile.missing?.inventory ? null : state.common.TRUE_DEFENSE ?? 0;
  const mp = profile.mp ?? null;
  const fmt = (v) => (v === null ? 'unknown' : String(Math.round(v * 10) / 10));
  const low = [td !== null && td < MIN_TRUE_DEFENSE && `True Defense ${fmt(td)} / ${MIN_TRUE_DEFENSE}`, mp !== null && mp < MIN_MP && `Magical Power ${fmt(mp)} / ${MIN_MP}`].filter(Boolean);
  const lines = [`<p class="guide-hint">True Defense ${fmt(td)} / ${MIN_TRUE_DEFENSE} · Magical Power ${fmt(mp)} / ${MIN_MP}</p>`];
  if (low.length) lines.push(`<p class="guide-limit" role="alert">Below the limit: ${low.join(' · ')}. The damage numbers assume you survive.</p>`);
  if (mp !== null && mp >= MIN_MP && mp < TARGET_MP) lines.push(`<small class="guide-hint">Magical Power is under the target of ${TARGET_MP}.</small>`);
  if (td === null || mp === null) lines.push('<p class="guide-limit" role="alert">A limit could not be read. The ranking goes on without it.</p>');
  return lines.join('');
}

function pathsView(state) {
  const lines = Object.values(state.daggers).filter(Boolean);
  const factor = (path) => (lines.length ? lines.reduce((sum, d) => sum + 1 + additiveOf(d, state.armorIds, path) / 100, 0) / lines.length : 1 + additiveOf(null, state.armorIds, path) / 100);
  const [guideOut, ofaOut] = [blazeOutput(state, 'guide'), blazeOutput(state, 'ofa')];
  const leader = ofaOut >= guideOut ? 'One For All' : 'Enchants';
  const lead = (Math.max(ofaOut, guideOut) / Math.max(Math.min(ofaOut, guideOut), 1e-9) - 1) * 100;
  return `<p class="guide-hint">Enchants: ×${factor('guide').toFixed(2)} · One For All: ×${factor('ofa').toFixed(2)} · ${leader} leads by ${lead.toFixed(1)} % (estimate). In use: ${state.path === 'ofa' ? 'One For All' : 'Enchants'}.</p>`;
}

function blazeValueView({ guide, checked, ctx, name, state: synced, settings, keepOldGear, boosts, preset }) {
  const profile = synced.summary;
  const entry = synced.statsInput?.blaze ?? preset?.blaze ?? null;
  const picked = loadoutOf(profile, ctx.items, 'blaze', entry?.choice);
  const daggers = daggersOf(profile);
  const loadout = { ...picked, daggers };
  const base = withOffset(computeStats(profile, ctx.items, picked, 'blaze', boosts).total, entry);
  const state = blazeState(base, loadout, daggers);
  const miningChoice = synced.statsInput?.mining?.choice ?? preset?.mining?.choice;
  const other = miningChoice ? loadoutOf(profile, ctx.items, 'mining', miningChoice, settings) : null;
  const groups = rankUpgrades(guide, checked, ctx, loadout, settings, base, { area: 'blaze', other, keepOldGear, state });
  const list = (title, rows, note = '', label = () => '') => (rows.length
    ? `<section class="guide-next" aria-label="${title}"><h2>${title}</h2>${note ? `<small class="guide-hint">${note}</small>` : ''}<ul class="guide-steps">${rows.map((r) => stepRow(r.section, r.step, checked, ctx, name, label(r) + rowExtra(r, ctx, 'damage'))).join('')}</ul></section>` : '');
  const notes = offsetNotes(entry, synced, picked);
  const open = Object.values(groups).reduce((n, rows) => n + rows.length, 0);
  return `<p class="guide-hint">${LEFT_OUT}</p>
  ${limitsView(profile, state)}
  ${pathsView(state)}
  ${Object.values(daggers).includes(null) ? '<p class="guide-limit" role="alert">Dagger pair incomplete: the Hellion Shield needs one dagger of each line.</p>' : ''}
  ${notes.length ? `<ul class="stats-gaps">${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
  ${bestCard(bestBlaze(profile, ctx.items, loadout, state), name, 'damage', 'Pet and daggers stay as they are. Set bonuses other than Dominus are not counted. True Defense stays at its limit.')}
  ${open ? '' : '<p class="muted">All steps are done.</p>'}
  ${list('Requirements first', groups.requirements, 'These close a missed limit. Sorted by how much of the gap they close per coin.')}
  ${list('Best value', [...groups.free, ...groups.ranked], '', (r) => (r.perMillion === undefined ? '<span class="guide-src" data-src="free">free</span>' : ''))}
  ${list('Locked', groups.locked)}
  ${list('No price', groups.noPrice, 'A sum that leaves out an item would look cheaper than it is.')}
  ${list('No gain data', groups.noGain, 'Nothing known gives this step a fixed value.')}
  ${list('No damage gain', groups.zero, 'These add no damage in this model right now.')}`;
}

export function bestValueView({ guide, checked, ctx, name, state, settings, keepOldGear, boosts = {}, preset = null }) {
  const profile = state?.summary;
  if (!profile) return noSync;
  if (!ctx.items) return '<p class="muted">Loading item data…</p>';
  if (guide.area === 'blaze') return blazeValueView({ guide, checked, ctx, name, state, settings, keepOldGear, boosts, preset });
  const entry = state.statsInput?.mining ?? preset?.mining ?? null;
  const loadout = loadoutOf(profile, ctx.items, 'mining', entry?.choice, settings);
  // without a picked Blaze slot both areas fall back to what is worn, which says nothing about what Blaze still needs
  const blazeChoice = state.statsInput?.blaze?.choice ?? preset?.blaze?.choice;
  const other = blazeChoice ? loadoutOf(profile, ctx.items, 'blaze', blazeChoice) : null;
  const base = withOffset(computeStats(profile, ctx.items, loadout, 'mining', boosts).total, entry);
  const groups = rankUpgrades(guide, checked, ctx, loadout, settings, base, { other, keepOldGear });
  const notes = [
    ...(settings.gemFortune ? [] : ['Gemstone Fortune does not count here, and Ore, Block and Dwarven Metal Fortune are not counted, so fortune steps read low.']),
    ...offsetNotes(entry, state, loadout),
  ];
  const list = (title, rows, note = '', label = () => '') => (rows.length
    ? `<section class="guide-next" aria-label="${title}"><h2>${title}</h2>${note ? `<small class="guide-hint">${note}</small>` : ''}<ul class="guide-steps">${rows.map((r) => stepRow(r.section, r.step, checked, ctx, name, label(r) + rowExtra(r, ctx))).join('')}</ul></section>` : '');
  const free = () => '<span class="guide-src" data-src="free">free</span>';
  const open = Object.values(groups).reduce((n, rows) => n + rows.length, 0);
  return `<p class="guide-hint">Target: ${words(settings.preset)}</p>
  ${notes.length ? `<ul class="stats-gaps">${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
  ${bestCard(bestLoadout(profile, ctx.items, loadout, base, settings), name)}
  ${open ? '' : '<p class="muted">All steps are done.</p>'}
  ${list('Best value', [...groups.free, ...groups.ranked], '', (r) => (r.perMillion === undefined ? free() : ''))}
  ${list('Locked', groups.locked)}
  ${list('No price', groups.noPrice, 'A sum that leaves out an item would look cheaper than it is.')}
  ${list('No gain data', groups.noGain, 'Nothing known gives this step a fixed value.')}
  ${list('No mining gain', groups.zero, 'These add none of the stats counted here right now.')}`;
}

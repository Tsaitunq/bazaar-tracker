// What the ticked steps put on the player, over all guides of one area. Ownership is one store, so a piece ticked in guide A counts in guide B.
import { stepKey } from './progress.js';
import { isItemStep } from './owned.js';
import { virtualProfile, virtualLoadout, applyStep, baseStats } from './virtual.js';
import { stepDelta, blazeDelta } from './optimizer.js';
import { blazeState } from './blaze.js';
import { gearStats, petStats, petStatsAt } from './stats.js';
import { setBonusOf } from './blaze.js';
import { rulesOf, pieceExtra, dressDaggers } from './pieces.js';
import { enchantLine, ENCHANTS_CONDITIONAL } from './optimizer-data.js';
import { GEAR_STATS } from './stats.js';
import { pieceParts, realItem, compareTip, loreCompleted } from './gear-parts.js';

// Steps about the build or the pet are not gear: HOTM, shards and power are in the base, the pet is counted once at the end.
const BUILD_KINDS = new Set(['perk', 'attr', 'power', 'pet', 'petItem', 'held', 'coll', 'skill']);
const isEssenceStep = (step) => { const parts = [step.detect ?? []].flat(); return parts.length === 1 && parts[0].kind === 'essence'; };
const isBuildStep = (step) => { const parts = [step.detect ?? []].flat(); return parts.length > 0 && parts.every((d) => BUILD_KINDS.has(d.kind)); };

const sum = (into, from) => { for (const [k, v] of Object.entries(from ?? {})) into[k] = (into[k] ?? 0) + v; return into; };

// The pet of the build in the game data (id and rarity), null when the build has none or it is not in the data.
export const buildPet = (build, pets) => pets?.find((p) => p.id === build?.pet?.id && p.rarity === build.pet.rarity) ?? null;

// The pets.json entry of the active pet: the one a ticked step sets, otherwise the one saved in the build. null when it is not in the data.
export const activePet = (loadout, build, pets) => (loadout.pet ? pets?.find((p) => p.id === loadout.pet.type && p.rarity === loadout.pet.tier) ?? null : buildPet(build, pets));

// The stats of a pets.json pet (level 100) at the level of the build: flat stats grow in a straight line, so 125 at 100 is 123.75 at 99.
const atLevel = (stats, level) => {
  const f = Number.isFinite(level) && level >= 1 && level < 100 ? level / 100 : 1;
  return Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, Math.round(v * f * 100) / 100]));
};

// The pet: one a ticked step sets, otherwise the one saved in the build. Never both.
function petGear(loadout, build, pets) {
  if (loadout.pet) return petStats(loadout.pet);
  const known = buildPet(build, pets);
  if (known) return atLevel(known.stats, build.pet.level);
  const pet = build?.pet;
  return pet ? petStatsAt(pet.id, pet.rarity, pet.level) ?? {} : {};
}

// The pet item of the build, from the table in the game data (a pet from a ticked step has none).
const petItemStats = (loadout, build, data) => (loadout.pet ? {} : data?.find((i) => i.id === build?.pet?.item)?.stats ?? {});

const statSum = (stats) => Object.entries(stats ?? {}).reduce((n, [k, v]) => n + (GEAR_STATS.blaze.includes(k) ? v : 0), 0);

// Accessories sit in the base, because the base is measured with them. One ticked after the measurement counts as a change since then,
// as far as it is better than the piece of its family that was there at the measurement (a Talisman ladder gives the step between two rungs).
// dates: tick dates of the steps of one guide id each, measuredAt: the date of the base. A tick without a date is older than the app.
export function accessoryGain({ guides, area, dates, measuredAt, owned, items }) {
  if (!measuredAt || !items) return { gain: {}, after: 0 };
  const have = new Set(owned);
  const when = new Map();
  for (const guide of guides.filter((g) => g.area === area)) {
    for (const section of guide.sections) {
      for (const step of section.steps) {
        const at = dates?.[guide.id]?.[stepKey(section, step)] ?? 0;
        for (const d of [step.detect ?? []].flat().filter((part) => part.kind === 'owned')) {
          const slots = (typeof d.on === 'string' ? guide.groups?.[d.on] : d.on) ?? [];
          for (const id of slots.flat()) if (have.has(id) && items[id]?.category === 'ACCESSORY') when.set(id, Math.min(when.get(id) ?? Infinity, at));
        }
      }
    }
  }
  const families = new Map();
  for (const id of when.keys()) families.set(items[id].family ?? id, [...(families.get(items[id].family ?? id) ?? []), id]);
  const best = (ids) => ids.reduce((top, id) => (!top || statSum(items[id].stats) >= statSum(items[top].stats) ? id : top), null);
  const gain = {};
  let after = 0;
  for (const ids of families.values()) {
    const now = best(ids);
    const then = best(ids.filter((id) => when.get(id) <= measuredAt));
    if (now === then) continue;
    after += ids.filter((id) => when.get(id) > measuredAt).length;
    for (const [stat, v] of Object.entries(items[now].stats ?? {})) if (GEAR_STATS.blaze.includes(stat)) gain[stat] = (gain[stat] ?? 0) + v;
    for (const [stat, v] of Object.entries(items[then]?.stats ?? {})) if (GEAR_STATS.blaze.includes(stat)) gain[stat] = (gain[stat] ?? 0) - v;
  }
  return { gain: Object.fromEntries(Object.entries(gain).filter(([, v]) => v)), after };
}

// The pieces a step changed or added, with what it changed per stat (own calculation, before and after): [{ id, delta: { STAT: n } }].
function itemChanges(before, after, items) {
  const out = [];
  after.items.forEach((now, i) => {
    if (now === before.items[i]) return;
    const was = before.items[i]?.id === now.id ? pieceParts(before.items[i], items).total : {};
    const total = pieceParts(now, items).total;
    const delta = Object.fromEntries([...new Set([...Object.keys(total), ...Object.keys(was)])].map((k) => [k, Math.round(((total[k] ?? 0) - (was[k] ?? 0)) * 100) / 100]).filter(([, v]) => v));
    if (Object.keys(delta).length) out.push({ id: now.id, delta });
  });
  return out;
}

// Gear = item stats of the pieces owned + what each ticked step of the guides adds, in guide order.
// values: the typed base, only as the state the Blaze maths of a step starts from.
// Gives the flat gear stats, the profile and loadout the ranking works from.
export function gearOf({ guides, checks, owned, items, area, build, settings, values = {}, mp = null, pets = null, petItems = null, dates = {}, measuredAt = null, bagCounted = false, real = null }) {
  let profile = virtualProfile({ sections: [] }, new Set(), owned, items, mp);
  let loadout = virtualLoadout(profile, items, area);
  const gear = sum({}, gearStats([...loadout.armor, ...loadout.equipment, ...(loadout.held ? [loadout.held] : [])]));
  let state = baseStats(values, [gear]);
  const enchants = {}; // the highest level ticked per enchant, for the conditional lines
  let catacombsNeeded = false;
  // where each part of the gear comes from: the ticked step an item stands on (ownedBy), what each other step did to which item (stepLog), the pet step
  const ownedBy = {};
  const stepLog = [];
  let petStep = null;
  for (const guide of guides.filter((g) => g.area === area)) {
    const marks = new Set(checks[guide.id] ?? []);
    for (const section of guide.sections) {
      for (const step of section.steps) {
        if (marks.has(stepKey(section, step)) && isItemStep(step)) {
          for (const d of [step.detect ?? []].flat().filter((part) => part.kind === 'owned')) {
            for (const id of ((typeof d.on === 'string' ? guide.groups?.[d.on] : d.on) ?? []).flat()) ownedBy[id] ??= { guide: guide.title, text: step.text };
          }
        }
        // an item step is in the owned store already
        if (!marks.has(stepKey(section, step)) || isItemStep(step) || isEssenceStep(step)) continue;
        if ([step.detect ?? []].flat().some((d) => d.kind === 'pet')) petStep = { guide: guide.title, text: step.text };
        loadout = virtualLoadout(profile, items, area);
        for (const d of [step.detect ?? []].flat()) {
          if (d.kind === 'enchant') enchants[d.enchant] = Math.max(enchants[d.enchant] ?? 0, d.level);
          if (d.kind === 'reforge' && d.value.some((v) => v === 'withered' || v === 'ancient')) catacombsNeeded = true;
        }
        const change = isBuildStep(step) ? null : area === 'blaze'
          ? blazeDelta(step, blazeState(state, loadout, loadout.daggers), loadout, profile, items, settings, guide, rulesOf(build, activePet(loadout, build, pets)))
          : stepDelta(step, loadout, profile, items, settings, guide);
        const flat = change?.common ?? change ?? {};
        sum(gear, flat);
        state = baseStats(state, [flat]);
        const after = applyStep(profile, step, guide, items);
        if (!isBuildStep(step)) stepLog.push(...itemChanges(profile, after, items).map((c) => ({ guide: guide.title, text: step.text, ...c })));
        profile = after;
      }
    }
  }
  loadout = virtualLoadout(profile, items, area);
  sum(gear, petGear(loadout, build, pets));
  sum(gear, petItemStats(loadout, build, petItems));
  // stars, potato books and Bling Armor of the worn pieces, with the pet that is active at the end
  const pet = activePet(loadout, build, pets);
  const rules = area === 'blaze' ? rulesOf(build, pet, petGear(loadout, build, pets)) : null;
  for (const piece of loadout.armor) sum(gear, pieceExtra(piece.id, items, rules));
  if (area === 'blaze') sum(gear, setBonusOf(loadout.armor.map((i) => i.id)).add);
  const slots = [['armor', loadout.armor], ['tool', loadout.held ? [loadout.held] : []], ['equipment', loadout.equipment]];
  const pieces = slots.flatMap(([cat, list]) => list.map((piece) => {
    const parts = pieceParts(piece, items);
    const extra = cat === 'armor' ? pieceExtra(piece.id, items, rules) : {};
    for (const [stat, v] of Object.entries(extra)) if (v) { (parts.lines[stat] ??= []).push({ part: 'extra', label: 'Stars, books, Bling Armor', value: v }); parts.total[stat] = (parts.total[stat] ?? 0) + v; }
    // the tooltip of the real item replaces the own sum for this piece; the difference moves the gear
    // the real item is worked out from its own attributes (reforge, gems, enchants, parts, Polarvoid): the parts the tooltip lacks are found against that sum
    const record = realItem(piece.id, real);
    const realParts = record ? pieceParts({ ...record, where: 'inventory', lore: {} }, items) : null;
    if (realParts) for (const [stat, v] of Object.entries(extra)) if (v) { (realParts.lines[stat] ??= []).push({ part: 'extra', label: 'Stars, books, Bling Armor', value: v }); realParts.total[stat] = (realParts.total[stat] ?? 0) + v; }
    const found = record?.tip ?? null;
    const { tip, lacks } = found ? loreCompleted(found, realParts, GEAR_STATS[area]) : { tip: null, lacks: [] };
    const cmp = tip ? compareTip(tip, parts.total, GEAR_STATS[area]) : null;
    if (cmp) sum(gear, cmp.delta);
    return { cat, id: piece.id, source: tip ? 'game' : 'calculated', lacks, realLines: realParts?.lines ?? null, calc: parts.total, tip, lines: parts.lines, conditional: parts.conditional, differs: !!cmp?.differs };
  }));
  if (rules) loadout.daggers = dressDaggers(loadout.daggers, items, rules);
  // accessories ticked after the measurement; with an import the bag itself is counted (sources.js), so none are added here
  const accessories = area === 'blaze' && !bagCounted ? accessoryGain({ guides, area, dates, measuredAt, owned, items }) : { gain: {}, after: 0 };
  sum(gear, accessories.gain);
  // conditional effects of the ticked enchants: shown, never added
  const listed = Object.entries(enchants).map(([name, level]) => enchantLine(name, level)).filter(Boolean).map((text) => ({ text }));
  const stacking = Object.entries(enchants).filter(([name]) => ENCHANTS_CONDITIONAL[name]).map(([name, level]) => ({ stat: ENCHANTS_CONDITIONAL[name].stat, text: `${ENCHANTS_CONDITIONAL[name].name} ${level}: ${ENCHANTS_CONDITIONAL[name].text(level)}` }));
  if (area === 'blaze' && catacombsNeeded && rules.gear.catacombs === null) listed.push({ text: 'Withered and Ancient: +1 per Catacombs level, set your level under Power → Gear' });
  // the pet as a part: its stats at the level, the pet item, and the perks that need a condition (listed, never added)
  const petPart = pet || loadout.pet || build?.pet ? {
    name: pet?.name ?? loadout.pet?.type ?? build.pet.id, rarity: pet?.rarity ?? loadout.pet?.tier ?? build?.pet?.rarity ?? null, level: pet?.level ?? build?.pet?.level ?? null,
    stats: petGear(loadout, build, pets), item: petItemStats(loadout, build, petItems),
    conditional: (pet?.perks ?? []).filter((k) => k.condition).map((k) => ({ stat: k.stat ?? null, text: `${k.name}: ${k.text} (${k.condition})` })),
  } : null;
  return { pieces, petPart, ownedBy, stepLog, petStep, gear, profile, loadout, stepPet: loadout.pet ?? null, pet, rules, listed: area === 'blaze' ? listed : stacking, accessories: accessories.gain, hints: accessories.after ? ['An accessory changes your Magical Power: adjust it under Power.'] : [] };
}

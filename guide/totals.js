// Total per stat = base (typed in) + changes since the measurement + gear. Pure functions, no DOM.
// The multipliers come last: the base was measured with the multipliers of its snapshot inside, so they are divided out first.
import { valueAt } from './gamedata.js';
import { GOD_POTION } from '../stats.js';
import { lockOf } from './hotm-model.js';
import { buildPet } from './gear.js';

// The guide areas and the area names of gamedata/stats.json.
export const DATA_AREA = { mining: 'mining', blaze: 'combat', farming: 'farming' };
// Where the player is when the stats count. Mining islands: Dwarven Mines, Crystal Hollows, Glacite Tunnels/Mineshafts. Not the Crimson Isle.
const HOLDS = { mining: new Set(['always', 'on_mining_islands']), blaze: new Set(['always']), farming: new Set(['always']) };
// The mob families the fight of an area is against (wiki Inferno Demonlord: the boss and its minibosses are Infernal). An effect against another family is only listed.
const FAMILIES = { mining: new Set(), blaze: new Set(['infernal']), farming: new Set() };
// Perk effects that depend on where the player is: Nether Embodiment works on the Crimson Isle, which is where Blaze is fought.
const PLACES = { mining: new Set(), blaze: new Set(['crimson_isle']), farming: new Set() };

const addTo = (sum, stat, v) => { sum[stat] = (sum[stat] ?? 0) + v; };

function hotmStats(hotm, data, out, area) {
  const omelette = hotm.omelette === true;
  for (const perk of data.hotm.perks) {
    const base = hotm.levels?.[perk.id] ?? 0;
    if (!(base > 0)) continue;
    if (lockOf(perk, hotm)) continue; // a locked perk is shown, never counted
    if (perk.type === 'ability' ? hotm.ability !== perk.id : (hotm.disabled ?? []).includes(perk.id)) continue; // only the selected ability counts; a perk switched off does not
    const level = base + (omelette && perk.omeletteBonus ? 1 : 0);
    for (const e of perk.effects) {
      if (e.hidden) continue;
      const v = valueAt(e, level);
      if (e.kind === 'percent_multiplier' && HOLDS[area].has(e.cond)) out.mult[e.stat] = (out.mult[e.stat] ?? 1) * (1 + v / 100);
      else if (!e.kind && e.cond === 'always') addTo(out.add, e.stat, v);
      else out.listed.push({ stat: e.stat, value: v, cond: e.cond, text: `${perk.name}: ${e.stat} ${v}${e.kind === 'percent_multiplier' ? ' %' : ''} (${e.cond})` });
    }
  }
}

function attrStats(attrs, data, out, area) {
  for (const a of data.attributes.attributes) {
    const level = attrs[a.key] ?? 0;
    if (!(level > 0)) continue;
    for (const e of a.effects) {
      const v = e.fixed !== undefined ? e.fixed : (e.perLevel ?? 0) * level;
      const holds = e.cond === 'always' || (e.cond === 'vs_mob_family' && FAMILIES[area].has(e.family));
      if (holds && e.kind === 'percent_multiplier') out.mult[e.stat] = (out.mult[e.stat] ?? 1) * (1 + v / 100);
      else if (holds && !e.kind) addTo(out.add, e.stat, v);
      else out.listed.push({ stat: e.stat, value: v, cond: e.cond, text: `${a.name}: ${e.stat} ${v} (${e.cond}${e.family ? ` ${e.family}` : ''})` });
    }
    // damage attributes: a sentence, only for the fight area they are meant for
    if (a.note && area === 'blaze') out.listed.push({ stat: null, value: a.note.perLevel * level, cond: 'damage', text: `${a.name} ${level}: +${Math.round(a.note.perLevel * level * 100) / 100}${a.note.text}` });
  }
}

// A pet perk that multiplies a category of stats after everything is added (Nether Embodiment). Only where the perk works.
function petStats(pet, data, out, area) {
  for (const perk of pet?.perks ?? []) {
    const e = perk.effect;
    if (e?.kind !== 'category_multiplier' || !PLACES[area].has(e.where)) continue;
    for (const s of data.stats.stats) if (e.categories.includes(s.category)) out.mult[s.id] = (out.mult[s.id] ?? 1) * (1 + e.percent / 100);
  }
}

function powerStats(power, data, out) {
  const d = data.power;
  const stone = d.powerStones.find((p) => p.id === power.stone);
  const mp = power.mp;
  if (stone && mp !== null && mp >= 0) {
    const m = d.multiplier;
    const scale = m.a * Math.log(m.b * mp + 1) ** m.exp;
    for (const [stat, v] of Object.entries(stone.base)) addTo(out.add, stat, v * scale);
    for (const [stat, v] of Object.entries(stone.uniqueBonus)) addTo(out.add, stat, v);
  }
  for (const t of d.tuning.stats) if (t.perPoint !== null && power.tuning?.[t.stat] > 0) addTo(out.add, t.stat, t.perPoint * power.tuning[t.stat]);
}

// What a build gives: add (flat per stat), mult (factor per stat), listed (conditional effects, shown but never summed).
// A part that is null is unknown and gives nothing.
// pet: the pets.json entry that is active; by default the one of the build.
export function statsOf(build, data, area, pet = buildPet(build, data.pets?.pets)) {
  const out = { add: {}, mult: {}, listed: [] };
  if (build?.hotm) hotmStats(build.hotm, data, out, area);
  if (build?.attrs) attrStats(build.attrs, data, out, area);
  petStats(pet, data, out, area);
  if (build?.power) powerStats(build.power, data, out);
  if (build?.buffs?.godPotion) for (const [stat, v] of Object.entries(GOD_POTION)) addTo(out.add, stat, v);
  if (build?.buffs?.boosterCookie) for (const e of data.power.boosterCookie.effects) addTo(out.add, e.stat, e.value);
  return out;
}

export const PART_NAME = { hotm: 'HOTM', attrs: 'Attributes', power: 'Power', buffs: 'Buffs' };

// Per stat, what each editor moved since the measurement: the build as it is now against the same build with that one part as it was.
// A part that was unknown at the measurement moved nothing. Flat stats only.
function movedBy(build, snapshot, data, area) {
  const now = statsOf(build, data, area);
  const out = {};
  for (const part of Object.keys(PART_NAME)) {
    if (!entrySnapshot(snapshot, part)) continue;
    const was = statsOf({ ...build, [part]: snapshot[part] }, data, area);
    for (const stat of new Set([...Object.keys(now.add), ...Object.keys(was.add)])) {
      const d = (now.add[stat] ?? 0) - (was.add[stat] ?? 0);
      if (Math.abs(d) > 1e-9) (out[stat] ??= []).push({ part, value: d });
    }
  }
  return out;
}
const entrySnapshot = (snapshot, part) => snapshot?.[part] !== undefined && snapshot[part] !== null;

// gear: flat stats of the ticked steps. entry: pg.base[area]. Gives one row per stat of the area plus the conditional list.
export function totalFor({ area, entry, build, gear = {}, data, stats, pet }) {
  const now = statsOf(build, data, area, pet);
  // a part unknown at the measurement was not changed since: it counts as the build has it now
  // the pet is gear: none at the measurement means none, not unknown
  const snapshot = { ...build, ...Object.fromEntries(Object.entries(entry?.snapshot ?? {}).filter(([, v]) => v !== null)), pet: entry?.snapshot?.pet ?? null };
  const was = statsOf(snapshot, data, area);
  const total = {};
  const rows = stats.map((stat) => {
    const typed = entry?.values?.[stat];
    const g = gear[stat] ?? 0;
    if (typed === undefined) return { stat, base: undefined, gear: g, total: undefined };
    const sum = typed / (was.mult[stat] ?? 1) + ((now.add[stat] ?? 0) - (was.add[stat] ?? 0)) + g;
    total[stat] = sum * (now.mult[stat] ?? 1);
    return { stat, base: typed, gear: g, total: total[stat] };
  });
  return { rows, total, listed: now.listed, moved: entry?.snapshot ? movedBy(build, entry.snapshot, data, area) : {} };
}

// Blaze shows the Combat menu without Health Regen, Vitality and the weapon's Damage, and the two Misc stats gear gives (Speed, Magic Find).
const BLAZE_HIDDEN = new Set(['HEALTH_REGEN', 'VITALITY', 'DAMAGE']);
const BLAZE_MISC = new Set(['SPEED', 'MAGIC_FIND']);

// The stats of an area in the order of gamedata/stats.json.
export const statsFor = (area, data) => data.stats.stats
  .filter((s) => (area === 'blaze' ? (s.category === 'combat' && !BLAZE_HIDDEN.has(s.id)) || BLAZE_MISC.has(s.id) : s.areas.includes(DATA_AREA[area])))
  .map((s) => s.id);

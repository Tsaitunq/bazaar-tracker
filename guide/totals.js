// Total per stat = base (typed in) + changes since the measurement + gear. Pure functions, no DOM.
// The multipliers come last: the base was measured with the multipliers of its snapshot inside, so they are divided out first.
import { valueAt } from './gamedata.js';
import { GOD_POTION } from '../stats.js';

// The guide areas and the area names of gamedata/stats.json.
export const DATA_AREA = { mining: 'mining', blaze: 'combat', farming: 'farming' };
// Where the player is when the stats count. Mining islands: Dwarven Mines, Crystal Hollows, Glacite Tunnels/Mineshafts. Not the Crimson Isle.
const HOLDS = { mining: new Set(['always', 'on_mining_islands']), blaze: new Set(['always']), farming: new Set(['always']) };

const addTo = (sum, stat, v) => { sum[stat] = (sum[stat] ?? 0) + v; };

function hotmStats(hotm, data, out, area) {
  const omelette = hotm.omelette === true;
  for (const perk of data.hotm.perks) {
    const base = hotm.levels?.[perk.id] ?? 0;
    if (!(base > 0)) continue;
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

function attrStats(attrs, data, out) {
  for (const a of data.attributes.attributes) {
    const level = attrs[a.key] ?? 0;
    if (!(level > 0)) continue;
    for (const e of a.effects) {
      const v = e.fixed !== undefined ? e.fixed : (e.perLevel ?? 0) * level;
      if (e.cond === 'always' && !e.kind) addTo(out.add, e.stat, v);
      else out.listed.push({ stat: e.stat, value: v, cond: e.cond, text: `${a.name}: ${e.stat} ${v} (${e.cond})` });
    }
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
export function statsOf(build, data, area) {
  const out = { add: {}, mult: {}, listed: [] };
  if (build?.hotm) hotmStats(build.hotm, data, out, area);
  if (build?.attrs) attrStats(build.attrs, data, out);
  if (build?.power) powerStats(build.power, data, out);
  if (build?.buffs?.godPotion) for (const [stat, v] of Object.entries(GOD_POTION)) addTo(out.add, stat, v);
  if (build?.buffs?.boosterCookie) for (const e of data.power.boosterCookie.effects) addTo(out.add, e.stat, e.value);
  return out;
}

// gear: flat stats of the ticked steps. entry: pg.base[area]. Gives one row per stat of the area plus the conditional list.
export function totalFor({ area, entry, build, gear = {}, data, stats }) {
  const now = statsOf(build, data, area);
  // a part unknown at the measurement was not changed since: it counts as the build has it now
  const snapshot = { ...build, ...Object.fromEntries(Object.entries(entry?.snapshot ?? {}).filter(([, v]) => v !== null)) };
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
  return { rows, total, listed: now.listed };
}

// The stats of an area in the order of gamedata/stats.json.
export const statsFor = (area, data) => data.stats.stats.filter((s) => s.areas.includes(DATA_AREA[area])).map((s) => s.id);

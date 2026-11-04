// What the Stats screens show, worked out from the stores. No markup in here.
import { doneSet, stepKey } from '../progress.js';
import { miningSettings } from '../optimizer.js';
import { number } from '../format.js';
import { gearOf, buildPet } from './gear.js';
import { totalFor, statsFor, DATA_AREA, PART_NAME } from './totals.js';
import { autoOf } from './model.js';

export const AREA_NAME = { mining: 'Mining', blaze: 'Blaze', farming: 'Farming' };
// colours of gamedata/stats.json as the class of the token they are
const CLASS = { '#FFAA00': 'orange', '#D255D2': 'pink', '#FF5555': 'red', '#8C96FF': 'blue', '#FFFF55': 'yellow', '#55FF55': 'green', '#FFFFFF': 'white', '#55FFFF': 'cyan' };
const DAY = 24 * 3600e3;

const signed = (v) => `${v > 0 ? '+' : ''}${number(Math.round(v * 100) / 100)}`;

export function ago(at, now) {
  const days = Math.floor((now - at) / DAY);
  if (days < 1) return 'today';
  return days === 1 ? '1 day ago' : `${number(days)} days ago`;
}

const meta = (data, id) => data.stats.stats.find((s) => s.id === id);

// Ticked steps of the guides of one area, counted once.
function tickedSteps(world, area) {
  return world.guides.filter((g) => g.area === area).map((guide) => {
    const marks = new Set(world.checks?.[guide.id] ?? []);
    const done = doneSet(guide, marks, autoOf(guide, world.owned)); // a step derived without a tick still counts as owned
    const own = guide.sections.flatMap((s) => s.steps.map((step) => stepKey(s, step))).filter((k) => done.has(k));
    return { title: guide.title, n: own.length };
  });
}

// area: mining | blaze | farming. world needs gamedata, base, build, guides, checks, owned, items.
export function statsModel(world, area) {
  const data = world.gamedata;
  const entry = world.base?.[area] ?? null;
  if (!data) return { area, name: AREA_NAME[area], missing: 'data', fields: [], rows: [], listed: [], changes: [], pet: { chosen: null, step: null }, steps: 0, measured: null, gearLine: [], guides: [], buffs: world.build?.buffs ?? {} };
  const ids = statsFor(area, data);
  const worn = world.items ? gearOf({ guides: world.guides, checks: world.checks ?? {}, owned: world.owned ?? [], items: world.items, area, build: world.build, settings: miningSettings(world.settings), values: entry?.values ?? {}, mp: entry?.mp ?? null, pets: world.gamedata?.pets?.pets ?? null }) : { gear: {} };
  const t = totalFor({ area, entry, build: world.build, gear: worn.gear, data, stats: ids });
  const label = (id) => {
    const m = meta(data, id);
    return { id, icon: m.icon ?? '▚', label: m.name, color: CLASS[m.color] ?? 'white' };
  };
  const rows = t.rows.map((r) => ({
    ...label(r.stat),
    base: r.base === undefined ? '–' : number(Math.round(r.base * 100) / 100),
    gear: r.gear ? signed(r.gear) : '–',
    total: r.total === undefined ? (r.gear ? number(Math.round(r.gear * 100) / 100) : '–') : number(Math.round(r.total * 100) / 100),
  }));
  // what the editors moved since the measurement, per stat: "+12 Mining Fortune (HOTM +10, Attributes +2)"
  const changes = Object.entries(t.moved).filter(([id]) => ids.includes(id)).map(([id, parts]) => ({
    ...label(id), text: signed(parts.reduce((n, p) => n + p.value, 0)), parts: parts.map((p) => `${PART_NAME[p.part]} ${signed(p.value)}`).join(', '),
  }));
  const guides = tickedSteps(world, area);
  return {
    area, name: AREA_NAME[area], missing: DATA_AREA[area] && !world.items ? 'items' : null,
    measured: entry ? { at: entry.at, buffs: entry.snapshot?.buffs ?? {} } : null,
    changes, fields: ids.map(label), rows, listed: t.listed,
    gearLine: Object.entries(worn.gear).filter(([id, v]) => v && ids.includes(id)).slice(0, 3).map(([id, v]) => ({ ...label(id), text: signed(v) })),
    pet: { chosen: buildPet(world.build, data.pets?.pets), step: worn.stepPet ? `${worn.stepPet.type} ${worn.stepPet.tier}` : null },
    guides, steps: guides.reduce((n, g) => n + g.n, 0), buffs: world.build?.buffs ?? {},
  };
}

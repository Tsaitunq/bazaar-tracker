// What the Stats screens show, worked out from the stores. No markup in here.
import { doneSet, stepKey } from './progress.js';
import { miningSettings } from './optimizer.js';
import { number, coins } from '../../shared/format.js';
import { priceItem } from './progress.js';
import { miningScore } from './stats.js';
import { SCORES } from './optimizer.js';
import { gearOf, buildPet } from './gear.js';
import { totalFor, statsFor, statsOf, DATA_AREA, PART_NAME } from './totals.js';
import { autoOf } from './model.js';
import { calcFor, contribAt, unsafeLines } from './sources.js';

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
    const done = doneSet(guide, marks, autoOf(guide, world.owned, world.build)); // a step derived without a tick still counts as owned
    const own = guide.sections.flatMap((s) => s.steps.map((step) => stepKey(s, step))).filter((k) => done.has(k));
    return { title: guide.title, n: own.length };
  });
}

// The gear of an area from the ticked steps and the owned pieces.
const wornOf = (world, area, entry, calc) => (world.items ? gearOf({ guides: world.guides, checks: world.checks ?? {}, owned: world.owned ?? [], items: world.items, area, build: world.build, settings: miningSettings(world.settings), values: entry?.values ?? {}, mp: world.build?.power?.mp ?? entry?.mp ?? null, pets: world.gamedata?.pets?.pets ?? null, petItems: world.gamedata?.pets?.items ?? null, dates: world.dates ?? {}, measuredAt: entry?.at ?? null, bagCounted: !!calc, real: world.profile?.items ?? null }) : { gear: {} });

// area: mining | blaze | farming. world needs gamedata, base, build, guides, checks, owned, items.
export function statsModel(world, area) {
  const data = world.gamedata;
  const entry = world.base?.[area] ?? null;
  if (!data) return { area, name: AREA_NAME[area], missing: 'data', fields: [], rows: [], listed: [], known: [], other: [], changes: [], pet: { chosen: null, step: null }, steps: 0, measured: null, gearLine: [], guides: [], buffs: world.build?.buffs ?? {} };
  const ids = statsFor(area, data);
  const calc = calcFor(world); // null without an import
  const worn = wornOf(world, area, entry, calc);
  const t = totalFor({ area, entry, build: world.build, gear: worn.gear, data, stats: ids, pet: worn.pet, calc });
  const label = (id) => {
    const m = meta(data, id);
    return { id, icon: m.icon ?? '▚', label: m.name, color: CLASS[m.color] ?? 'white' };
  };
  // what the editors moved since the measurement, per stat: "+12 Mining Fortune (HOTM +10, Attributes +2)"
  const changes = Object.entries(t.moved).filter(([id]) => ids.includes(id)).map(([id, parts]) => ({
    ...label(id), value: parts.reduce((n, p) => n + p.value, 0), text: signed(parts.reduce((n, p) => n + p.value, 0)), parts: parts.map((p) => `${PART_NAME[p.part]} ${signed(p.value)}`).join(', '),
  }));
  for (const [id, v] of Object.entries(worn.accessories ?? {})) if (ids.includes(id)) changes.push({ ...label(id), value: v, text: signed(v), parts: 'Accessories' });
  // what the import sources grew by since the measurement (a skill level, a new accessory)
  if (calc && entry?.snapshot?.calc) {
    for (const id of ids) {
      const v = (calc.add[id] ?? 0) - (entry.snapshot.calc[id] ?? 0);
      if (Math.abs(v) > 1e-9) changes.push({ ...label(id), value: v, text: signed(v), parts: 'Skills, slayers, level, accessories, collections, bestiary, consumables' });
    }
  }
  const delta = {};
  for (const c of changes) delta[c.id] = (delta[c.id] ?? 0) + c.value;
  const unsafeOf = (stat) => (calc?.contrib[stat] ?? []).some((c) => c.unsafe);
  const rows = t.rows.map((r) => ({
    ...label(r.stat),
    base: r.base === undefined ? '–' : number(Math.round(r.base * 100) / 100),
    gear: r.gear ? signed(r.gear) : '–',
    delta: delta[r.stat] ? signed(delta[r.stat]) : '–',
    total: r.total === undefined ? (r.gear ? number(Math.round(r.gear * 100) / 100) : '–') : number(Math.round(r.total * 100) / 100),
    unsafe: !!r.calculated && unsafeOf(r.stat),
  }));
  // what the app knows by itself (the build and the ticked gear), and, with a measurement, what the base holds beyond that
  const knownText = (id) => {
    const v = (t.known.add[id] ?? 0) * (t.known.mult[id] ?? 1) + (worn.gear[id] ?? 0);
    return Math.abs(v) > 1e-9 ? { ...label(id), value: v, text: signed(v) } : null;
  };
  const knownCalc = (r) => ({ ...label(r.stat), value: r.total, text: signed(r.total), unsafe: unsafeOf(r.stat) });
  const known = entry ? [] : calc ? t.rows.filter((r) => r.total !== undefined && Math.abs(r.total) > 1e-9).map(knownCalc) : ids.map(knownText).filter(Boolean);
  // a gap that stays after the measurement: the unsafe sources that contribute to the stat are named
  const was = contribAt(calc?.contrib ?? {}, data.statSources, entry?.snapshot?.buffs ?? world.build?.buffs);
  const other = t.rows.filter((r) => r.other !== undefined && Math.abs(r.other) > 1e-9).map((r) => ({ ...label(r.stat), value: r.other, text: signed(r.other), suspects: calc && Math.abs(r.other) > 0.01 ? unsafeLines(was, r.stat).map((l) => l.text) : [] }));
  const unknown = calc ? [...calc.off, ...(calc.unknown.accessories.length ? [`${calc.unknown.accessories.length} accessories have no stats in the item list: ${calc.unknown.accessories.join(', ')}.`] : []), ...(calc.unknown.enrichments.length ? [`Enrichments without a value: ${calc.unknown.enrichments.join(', ')}.`] : [])] : [];
  const guides = tickedSteps(world, area);
  return {
    known, other, unknown, levels: calc?.levels ?? null, assumed: !!calc && !!entry && !entry.snapshot?.calc, hasCalc: !!calc,
   
    area, name: AREA_NAME[area], missing: DATA_AREA[area] && !world.items ? 'items' : null,
    // shortcut: any import newer than the measurement counts, not only one that applied parts; refine if it nags
    stale: !!(calc && entry && world.profile?.fetchedAt > entry.at && ['hotm', 'attrs', 'essence'].some((p) => world.build?.[p])),
    measured: entry ? { at: entry.at, buffs: entry.snapshot?.buffs ?? {} } : null,
    changes, fields: ids.map(label), rows, listed: [...t.listed, ...(worn.listed ?? [])],
    gearLine: Object.entries(worn.gear).filter(([id, v]) => v && ids.includes(id)).slice(0, 3).map(([id, v]) => ({ ...label(id), text: signed(v) })),
    pet: { chosen: buildPet(world.build, data.pets?.pets), step: worn.stepPet ? `${worn.stepPet.type} ${worn.stepPet.tier}` : null },
    guides, steps: guides.reduce((n, g) => n + g.n, 0), buffs: world.build?.buffs ?? {}, hints: worn.hints ?? [],
  };
}

// The breakdown of one stat, like "Click for details!" in the game: per category the single sources, uncertain ones marked, the conditional
// effects apart, and with a measurement the base you typed and what is left over as "Other sources". null for a stat the area does not show.
// groups: [{ title, lines: [{ label, value, text, unsafe }] }]; conditional: [text]; mult: factor; total: text.
const PART_TITLE = { skills: 'Skills', slayer: 'Slayers', level: 'SkyBlock level', accessories: 'Accessories', collections: 'Collections', bestiary: 'Bestiary', consumables: 'Consumables', base: 'Game base', godPotion: 'Buffs', cookie: 'Buffs' };
export function statDetail(world, area, stat) {
  const data = world.gamedata;
  const model = statsModel(world, area);
  const row = model.rows.find((r) => r.id === stat);
  if (!data || !row) return null;
  const entry = world.base?.[area] ?? null;
  const calc = calcFor(world);
  const worn = wornOf(world, area, entry, calc);
  const t = totalFor({ area, entry, build: world.build, gear: worn.gear, data, stats: statsFor(area, data), pet: worn.pet, calc });
  const line = (label, value, unsafe = false, note = null) => ({ label, value, text: signed(value), unsafe, note });
  const groups = [];
  const group = (title, lines) => { if (lines.length) groups.push({ title, lines }); };
  const r = t.rows.find((x) => x.stat === stat);
  const build = world.build ?? {};
  // what each editor of the build gives on its own
  const parts = Object.keys(PART_NAME).filter((p) => p !== 'buffs' && build[p]).map((p) => [PART_NAME[p], statsOf({ [p]: build[p] }, data, area, null, null).add[stat] ?? 0]);
  const buildLines = parts.filter(([, v]) => Math.abs(v) > 1e-9).map(([label, v]) => line(label, v));
  if (entry) {
    group('Measured base', [line('Typed from /stats', r.base ?? 0), ...(Math.abs(r.other ?? 0) > 1e-9 ? [line('Other sources', r.other)] : [])]);
    group('Changes since the measurement', model.changes.filter((c) => c.id === stat).map((c) => line(c.parts, c.value)));
  } else {
    const contrib = calc?.contrib[stat] ?? [];
    const byPart = new Map();
    for (const c of contrib) byPart.set(c.part, [...(byPart.get(c.part) ?? []), c]);
    group('Game base', (byPart.get('base') ?? []).map((c) => line(c.label, c.value, c.unsafe, c.note)));
    group('Build', buildLines);
    for (const [part, title] of Object.entries(PART_TITLE)) {
      if (part === 'base' || part === 'godPotion' || part === 'cookie') continue;
      group(title, (byPart.get(part) ?? []).map((c) => line(c.label, c.value, c.unsafe, c.note)));
    }
    group('Buffs', [...(byPart.get('godPotion') ?? []), ...(byPart.get('cookie') ?? [])].map((c) => line(c.label, c.value, c.unsafe, c.note)));
    if (!calc) { const v = statsOf({ buffs: build.buffs }, data, area).add[stat] ?? 0; if (Math.abs(v) > 1e-9) group('Buffs', [line('Buffs', v)]); }
  }
  group('Gear', worn.gear[stat] ? [line('Ticked steps and owned pieces', worn.gear[stat])] : []);
  const conditional = [...t.listed, ...(worn.listed ?? [])].filter((l) => l.stat === stat).map((l) => l.text);
  const mult = t.known.mult[stat] ?? 1;
  return { area, stat, name: row.label, icon: row.icon, color: row.color, groups, conditional, mult: mult === 1 ? null : mult, total: row.total, measured: !!entry };
}

// The Essence tab: per perk its level, what it gives now and at the next level, what the next level and the rest cost
// (essence times the bazaar price) and, in Mining, the coins for the next level per 1 % it brings. No markup in here.
export function essenceModel(world, area) {
  const data = world.gamedata;
  if (!data?.essence) return null;
  const levels = world.draft?.essence ?? world.build?.essence ?? {};
  const statName = (id) => data.stats.stats.find((s) => s.id === id)?.name ?? id;
  const entry = world.base?.[area] ?? null;
  let total = null;
  if (area === 'mining' && Object.keys(entry?.values ?? {}).length) {
    const ids = statsFor(area, data);
    const worn = world.items ? gearOf({ guides: world.guides, checks: world.checks ?? {}, owned: world.owned ?? [], items: world.items, area, build: world.build, settings: miningSettings(world.settings), values: entry.values, mp: world.build?.power?.mp ?? entry.mp ?? null, pets: data.pets?.pets ?? null, petItems: data.pets?.items ?? null, dates: world.dates ?? {}, measuredAt: entry.at ?? null, bagCounted: !!calcFor(world) }) : { gear: {} };
    total = totalFor({ area, entry, build: world.build, gear: worn.gear, data, stats: ids, pet: worn.pet, calc: calcFor(world) }).total;
  }
  const price = (perk, qty) => {
    const p = qty > 0 ? priceItem({ id: perk.bazaar, qty }, { products: world.products }) : { source: 'none', coins: 0 };
    return p.source ? p.coins : null;
  };
  const sum = (perk, from, to) => perk.costs.slice(from, to).reduce((n, c) => n + c, 0);
  const effect = (perk, level) => (perk.effect ? `+${number(perk.effect.perLevel * level)} ${statName(perk.effect.stat)}` : level ? perk.conditional.text : 'no permanent stat');
  return {
    draft: !!world.draft?.essence,
    perks: data.essence.perks.map((perk) => {
      const level = Math.min(levels[perk.id] ?? 0, perk.max);
      const maxed = level >= perk.max;
      const next = maxed ? 0 : sum(perk, level, level + 1);
      const toMax = sum(perk, level, perk.max);
      const nextCoins = maxed ? 0 : price(perk, next);
      const maxCoins = price(perk, toMax);
      let rate = null;
      if (total && perk.effect && !maxed && nextCoins > 0) {
        const gain = miningScore(total, { [perk.effect.stat]: perk.effect.perLevel }, miningSettings(world.settings));
        if (gain > 0) rate = SCORES.mining.rateText(gain / (nextCoins / 1e6));
      }
      return {
        id: perk.id, name: perk.name, essence: perk.essence, bazaar: perk.bazaar, level, max: perk.max, maxed, conditional: !perk.effect,
        now: effect(perk, level), after: maxed ? null : effect(perk, level + 1), where: perk.where,
        next: maxed ? null : { essence: next, coins: nextCoins === null ? null : coins(nextCoins) },
        toMax: { essence: toMax, coins: maxCoins === null ? null : coins(maxCoins) },
        rate,
      };
    }),
  };
}

// What the Stats screens show, worked out from the stores. No markup in here.
import { doneSet, stepKey } from './progress.js';
import { miningSettings } from './optimizer.js';
import { number, coins } from '../../shared/format.js';
import { priceItem } from './progress.js';
import { miningScore } from './stats.js';
import { SCORES } from './optimizer.js';
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
  const worn = world.items ? gearOf({ guides: world.guides, checks: world.checks ?? {}, owned: world.owned ?? [], items: world.items, area, build: world.build, settings: miningSettings(world.settings), values: entry?.values ?? {}, mp: world.build?.power?.mp ?? entry?.mp ?? null, pets: world.gamedata?.pets?.pets ?? null, petItems: world.gamedata?.pets?.items ?? null, dates: world.dates ?? {}, measuredAt: entry?.at ?? null }) : { gear: {} };
  const t = totalFor({ area, entry, build: world.build, gear: worn.gear, data, stats: ids, pet: worn.pet });
  const label = (id) => {
    const m = meta(data, id);
    return { id, icon: m.icon ?? '▚', label: m.name, color: CLASS[m.color] ?? 'white' };
  };
  // what the editors moved since the measurement, per stat: "+12 Mining Fortune (HOTM +10, Attributes +2)"
  const changes = Object.entries(t.moved).filter(([id]) => ids.includes(id)).map(([id, parts]) => ({
    ...label(id), value: parts.reduce((n, p) => n + p.value, 0), text: signed(parts.reduce((n, p) => n + p.value, 0)), parts: parts.map((p) => `${PART_NAME[p.part]} ${signed(p.value)}`).join(', '),
  }));
  for (const [id, v] of Object.entries(worn.accessories ?? {})) if (ids.includes(id)) changes.push({ ...label(id), value: v, text: signed(v), parts: 'Accessories' });
  const delta = {};
  for (const c of changes) delta[c.id] = (delta[c.id] ?? 0) + c.value;
  const rows = t.rows.map((r) => ({
    ...label(r.stat),
    base: r.base === undefined ? '–' : number(Math.round(r.base * 100) / 100),
    gear: r.gear ? signed(r.gear) : '–',
    delta: delta[r.stat] ? signed(delta[r.stat]) : '–',
    total: r.total === undefined ? (r.gear ? number(Math.round(r.gear * 100) / 100) : '–') : number(Math.round(r.total * 100) / 100),
  }));
  const guides = tickedSteps(world, area);
  return {
    area, name: AREA_NAME[area], missing: DATA_AREA[area] && !world.items ? 'items' : null,
    measured: entry ? { at: entry.at, buffs: entry.snapshot?.buffs ?? {} } : null,
    changes, fields: ids.map(label), rows, listed: [...t.listed, ...(worn.listed ?? [])],
    gearLine: Object.entries(worn.gear).filter(([id, v]) => v && ids.includes(id)).slice(0, 3).map(([id, v]) => ({ ...label(id), text: signed(v) })),
    pet: { chosen: buildPet(world.build, data.pets?.pets), step: worn.stepPet ? `${worn.stepPet.type} ${worn.stepPet.tier}` : null },
    guides, steps: guides.reduce((n, g) => n + g.n, 0), buffs: world.build?.buffs ?? {}, hints: worn.hints ?? [],
  };
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
    const worn = world.items ? gearOf({ guides: world.guides, checks: world.checks ?? {}, owned: world.owned ?? [], items: world.items, area, build: world.build, settings: miningSettings(world.settings), values: entry.values, mp: world.build?.power?.mp ?? entry.mp ?? null, pets: data.pets?.pets ?? null, petItems: data.pets?.items ?? null, dates: world.dates ?? {}, measuredAt: entry.at ?? null }) : { gear: {} };
    total = totalFor({ area, entry, build: world.build, gear: worn.gear, data, stats: ids, pet: worn.pet }).total;
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

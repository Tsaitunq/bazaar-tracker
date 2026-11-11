// What the Stats screens show, worked out from the stores. No markup in here.
import { doneSet, stepKey } from './progress.js';
import { miningSettings } from './optimizer.js';
import { number, coins } from '../../shared/format.js';
import { priceItem } from './progress.js';
import { miningScore } from './stats.js';
import { SCORES } from './optimizer.js';
import { gearOf, buildPet } from './gear.js';
import { totalFor, statsFor, statsOf, condHolds, CONDITIONS, DATA_AREA, PART_NAME } from './totals.js';
import { valueAt } from './gamedata.js';
import { lockOf } from './hotm-model.js';
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
  if (!data) return { area, name: AREA_NAME[area], missing: 'data', fields: [], rows: [], listed: [], known: [], other: [], changes: [], pet: { chosen: null, step: null }, steps: 0, measured: null, gearLine: [], guides: [], buffsOn: [], buffs: world.build?.buffs ?? {} };
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
  // the buffs counted as active, so an expired potion does not add its stats unnoticed
  const named = (add) => Object.entries(add).filter(([id]) => ids.includes(id) && Math.abs(add[id]) > 1e-9).map(([id, v]) => `${signed(v)} ${meta(data, id).name}`).join(', ');
  const buffsOn = [['godPotion', 'God Potion'], ['boosterCookie', 'Booster Cookie']].filter(([key]) => world.build?.buffs?.[key])
    .map(([key, name]) => ({ name, text: named(statsOf({ buffs: { [key]: true } }, data, area, null, calc).add) }));
  const eaten = Object.values(calc?.contrib ?? {}).flat().filter((c) => c.part === 'consumables');
  if (eaten.length) buffsOn.push({ name: 'Consumables', text: [...new Set(eaten.map((c) => c.label))].join(', ') });
  const guides = tickedSteps(world, area);
  return {
    buffsOn, known, other, unknown, levels: calc?.levels ?? null, assumed: !!calc && !!entry && !entry.snapshot?.calc, hasCalc: !!calc,
   
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

// The breakdown of one stat, grouped like /stats → "Click for details!" in the game: Armor, Held Item, Equipment, Pet, Accessory Bag, HOTM, Skills,
// Potion Effects and so on, so it can be compared line by line. A gear line opens into its parts (base, gems per slot, reforge, enchants, drill parts,
// Polarvoid, potato books, Recombobulator). Multipliers are their own rows with their condition and whether it holds now. null for a stat the area does not show.
// groups: [{ title, sum, lines: [{ label, value, text, unsafe, note, source?, parts? }] }]; conditional: [text]; multipliers: [{ label, text, condition, holds, key }].
const GAME_ORDER = ['Measured base', 'Changes since the measurement', 'Armor', 'Held Item', 'Equipment', 'Pet', 'Other gear', 'Accessory Bag', 'HOTM', 'Attributes', 'Power', 'Essence', 'Skills', 'Slayers', 'SkyBlock level', 'Collections', 'Bestiary', 'Consumables', 'Potion Effects', 'Game base'];
const PART_TITLE = { skills: 'Skills', slayer: 'Slayers', level: 'SkyBlock level', accessories: 'Accessory Bag', collections: 'Collections', bestiary: 'Bestiary', consumables: 'Consumables', base: 'Game base', godPotion: 'Potion Effects', cookie: 'Potion Effects' };
const BUILD_TITLE = { hotm: 'HOTM', attrs: 'Attributes', power: 'Power', essence: 'Essence' };
const CAT_TITLE = { armor: 'Armor', tool: 'Held Item', equipment: 'Equipment' };
const COND_TEXT = { ...CONDITIONS, always: 'always', mining_gemstones: 'only on gemstones', in_mineshaft: 'only in a mineshaft' };

// The multipliers that act on a stat, each with its condition: HOTM perks, the pet's category multipliers. Shown whether or not they hold now.
function multipliersOf(world, area, stat, worn, data) {
  const build = world.build ?? {};
  const out = [];
  const row = (label, percent, cond, key) => out.push({ label, percent, text: `${percent > 0 ? '+' : ''}${Math.round(percent * 100) / 100} %`, condition: COND_TEXT[cond] ?? cond, holds: condHolds(build, area, cond), key });
  const hotm = build.hotm;
  for (const perk of hotm ? data.hotm.perks : []) {
    const base = hotm.levels?.[perk.id] ?? 0;
    if (!(base > 0) || lockOf(perk, hotm) || (perk.type === 'ability' ? hotm.ability !== perk.id : (hotm.disabled ?? []).includes(perk.id))) continue;
    for (const e of perk.effects) if (e.kind === 'percent_multiplier' && e.stat === stat && !e.hidden) row(perk.name, valueAt(e, base + (hotm.omelette && perk.omeletteBonus ? 1 : 0)), e.cond, e.cond in CONDITIONS ? e.cond : null);
  }
  const category = data.stats.stats.find((s) => s.id === stat)?.category;
  for (const perk of worn.pet?.perks ?? []) {
    const e = perk.effect;
    if (e?.kind === 'category_multiplier' && e.categories.includes(category)) row(perk.name, e.percent, e.where, e.where in CONDITIONS ? e.where : null);
  }
  return out;
}

export function statDetail(world, area, stat) {
  const data = world.gamedata;
  const model = statsModel(world, area);
  const row = model.rows.find((r) => r.id === stat);
  if (!data || !row) return null;
  const entry = world.base?.[area] ?? null;
  const calc = calcFor(world);
  const worn = wornOf(world, area, entry, calc);
  const t = totalFor({ area, entry, build: world.build, gear: worn.gear, data, stats: statsFor(area, data), pet: worn.pet, calc });
  const line = (label, value, unsafe = false, note = null, extra = {}) => ({ label, value, text: signed(value), unsafe, note, ...extra });
  const groups = new Map();
  const add = (title, l) => groups.set(title, [...(groups.get(title) ?? []), l]);
  const r = t.rows.find((x) => x.stat === stat);
  const build = world.build ?? {};
  const conditional = [...t.listed, ...(worn.listed ?? [])].filter((l) => l.stat === stat).map((l) => l.text);

  if (entry) {
    add('Measured base', line('Typed from /stats', r.base ?? 0));
    if (Math.abs(r.other ?? 0) > 1e-9) add('Measured base', line('Other sources', r.other));
    for (const c of model.changes.filter((x) => x.id === stat)) add('Changes since the measurement', line(c.parts, c.value));
  } else {
    for (const c of calc?.contrib[stat] ?? []) add(PART_TITLE[c.part] ?? c.part, line(c.label, c.value, c.unsafe, c.note));
    for (const [part, title] of Object.entries(BUILD_TITLE)) {
      const v = build[part] ? statsOf({ [part]: build[part] }, data, area, null, null).add[stat] ?? 0 : 0;
      if (Math.abs(v) > 1e-9) add(title, line(PART_NAME[part], v));
    }
    if (!calc) { const v = statsOf({ buffs: build.buffs }, data, area).add[stat] ?? 0; if (Math.abs(v) > 1e-9) add('Potion Effects', line('Buffs', v)); }
  }

  // gear: per piece the tooltip of the real item when there is one, otherwise the own sum; both figures when they differ
  let shown = 0;
  for (const p of worn.pieces ?? []) {
    const own = p.calc[stat] ?? 0;
    const tip = p.tip?.[stat] ?? 0;
    const value = p.source === 'game' ? tip : own;
    if (!value && !own) continue;
    shown += value;
    const differs = p.source === 'game' && Math.abs(tip - own) > 0.051;
    const note = p.source === 'game' ? (differs ? `game (tooltip) ≠ calculated ${signed(own)}` : 'game (tooltip)') : 'calculated';
    const parts = (p.lines[stat] ?? []).map((l) => line(l.label, l.value));
    add(CAT_TITLE[p.cat], line(world.items?.[p.id]?.name ?? p.id, value, false, note, { source: p.source, differs, parts }));
    conditional.push(...p.conditional.filter((c) => !c.stat || c.stat === stat).map((c) => `${world.items?.[p.id]?.name ?? p.id}: ${c.text}`));
  }
  const pet = worn.petPart;
  if (pet) {
    const v = (pet.stats[stat] ?? 0) + (pet.item[stat] ?? 0);
    if (Math.abs(v) > 1e-9) {
      shown += v;
      add('Pet', line(`${pet.name}${pet.rarity ? ` ${pet.rarity.toLowerCase()}` : ''}${pet.level ? ` lvl ${pet.level}` : ''}`, v, false, 'calculated', { parts: [line('Pet stats at the level', pet.stats[stat] ?? 0), line('Pet item', pet.item[stat] ?? 0)].filter((l) => l.value) }));
    }
    conditional.push(...pet.conditional.filter((c) => c.stat === stat).map((c) => `${pet.name}: ${c.text}`));
  }
  const other = (worn.gear[stat] ?? 0) - shown;
  if (Math.abs(other) > 1e-9) add('Other gear', line('Lantern, ticked steps, set bonus', other));

  const ordered = [...GAME_ORDER, ...[...groups.keys()].filter((k) => !GAME_ORDER.includes(k))].filter((k) => groups.has(k));
  const out = ordered.map((title) => ({ title, lines: groups.get(title), sum: Math.round(groups.get(title).reduce((n, l) => n + l.value, 0) * 100) / 100 }));
  return { area, stat, name: row.label, icon: row.icon, color: row.color, groups: out, conditional, multipliers: multipliersOf(world, area, stat, worn, data), total: row.total, measured: !!entry };
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

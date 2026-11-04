// What the screens of the guide app show, worked out from the shared logic. No markup in here.
import { stepKey, doneSet, setMark, guideStats, openStep, stepCost, mergeGuides, priceItem } from '../progress.js';
import { isItemStep, idsOfStep, idsToOwn, ownedAuto, impliedDone } from '../owned.js';
import { SCORES, miningSettings, pathsOf, LEFT_OUT } from '../optimizer.js';
import { pathOf, entryPrice } from '../path.js';
import { blazeState, daggersOf } from '../blaze.js';
import { checkStep, lockProfile } from '../requires.js';
import { gearOf } from './gear.js';
import { totalFor, statsFor } from './totals.js';
import { coins, number } from '../format.js';

const DAY = 24 * 3600e3;
const WEEK = 7 * DAY;
const ARCS = 3;

// Sections with steps split into runs of about the same size, for a guide that names no chapters.
function splitInto(sections, parts) {
  const filled = sections.filter((s) => s.steps.length);
  const total = filled.reduce((n, s) => n + s.steps.length, 0);
  const out = Array.from({ length: parts }, () => []);
  let seen = 0;
  for (const section of filled) {
    const middle = seen + section.steps.length / 2;
    out[Math.min(Math.floor((middle / Math.max(total, 1)) * parts), parts - 1)].push(section);
    seen += section.steps.length;
  }
  return out;
}

// An extra section has no rank, so it stays out of the ring.
function chapterGroups(guide) {
  const ranked = guide.sections.filter((s) => !s.extra);
  if (guide.chapters?.length) {
    return guide.chapters.map((c) => ({ name: c.name, sections: ranked.filter((s) => c.sections.includes(s.name)) }));
  }
  if (ranked.length === ARCS) return ranked.map((s) => ({ name: s.name, sections: [s] }));
  return splitInto(ranked, ARCS).map((sections, i) => ({ name: sections[0]?.name ?? `Part ${i + 1}`, sections }));
}

// The chapters of the ring: how far each is, and which holds the current step. Without one, the first open step.
export function chaptersOf(guide, checked, costs = null, currentKey = null) {
  const chapters = chapterGroups(guide).map(({ name, sections }) => {
    const keys = sections.flatMap((s) => s.steps.map((step) => stepKey(s, step)));
    const done = keys.filter((k) => checked.has(k)).length;
    const left = costs ? sections.map((s) => costs.sections[guide.sections.indexOf(s)]) : [];
    return { name, keys, done, total: keys.length, share: keys.length ? done / keys.length : 0, current: false, left: { coins: left.reduce((n, l) => n + l.coins, 0), unpriced: left.reduce((n, l) => n + l.unpriced, 0) } };
  });
  const open = chapters.find((c) => c.keys.includes(currentKey)) ?? chapters.find((c) => c.done < c.total) ?? chapters[chapters.length - 1];
  if (open) open.current = true;
  return chapters.map(({ keys, ...chapter }) => chapter);
}

export function totalShare(chapters) {
  const total = chapters.reduce((n, c) => n + c.total, 0);
  return total ? chapters.reduce((n, c) => n + c.done, 0) / total : 0;
}

// When each step was first seen done. What is done at the first run is older than the app, so it gets 0 and never counts as new.
export function stampDone(prev, doneKeys, now, firstRun = false) {
  const out = {};
  for (const key of doneKeys) out[key] = prev?.[key] ?? (firstRun ? 0 : now);
  return out;
}

export const unlockedThisWeek = (stamps, now) => Object.values(stamps ?? {}).filter((at) => at > 0 && now - at < WEEK).length;

const STATS = {
  MINING_FORTUNE: { icon: '☘', label: 'Mining Fortune', color: 'orange' },
  MINING_SPEED: { icon: '⸕', label: 'Mining Speed', color: 'orange' },
  PRISTINE: { icon: '✧', label: 'Pristine', color: 'pink' },
  GEMSTONE_FORTUNE: { icon: '☘', label: 'Gemstone Fortune', color: 'orange' },
  ORE_FORTUNE: { icon: '☘', label: 'Ore Fortune', color: 'orange' },
  BLOCK_FORTUNE: { icon: '☘', label: 'Block Fortune', color: 'orange' },
  DAMAGE: { icon: '❁', label: 'Damage', color: 'red' },
  STRENGTH: { icon: '❁', label: 'Strength', color: 'red' },
  CRITICAL_DAMAGE: { icon: '☠', label: 'Crit Damage', short: 'Crit Dmg', color: 'blue' },
  CRITICAL_CHANCE: { icon: '☣', label: 'Crit Chance', short: 'Crit Ch.', color: 'blue' },
  ATTACK_SPEED: { icon: '⚔', label: 'Attack Speed', short: 'Atk Speed', color: 'yellow' },
  HEALTH: { icon: '❤', label: 'Health', color: 'red' },
  DEFENSE: { icon: '❈', label: 'Defense', color: 'green' },
  TRUE_DEFENSE: { icon: '❂', label: 'True Defense', color: 'white' },
  COLD_RESISTANCE: { icon: '❄', label: 'Cold Resistance', color: 'cyan' },
  GEMSTONE_SPREAD: { icon: '☘', label: 'Gemstone Spread', color: 'orange' },
  PICKAXE_CDR: { icon: '⏱', label: 'Pickaxe Cooldown', color: 'green' },
};
const GRIDS = {
  mining: ['MINING_FORTUNE', 'MINING_SPEED', 'PRISTINE', 'GEMSTONE_FORTUNE'],
  blaze: ['STRENGTH', 'CRITICAL_DAMAGE', 'CRITICAL_CHANCE', 'ATTACK_SPEED', 'HEALTH', 'DEFENSE'],
};
const signed = (v) => `${v > 0 ? '+' : ''}${number(v)}`;
const linesOf = (delta, prefix = '') => Object.entries(delta).filter(([k, v]) => v && STATS[k]).map(([k, v]) => ({ text: `${prefix}${signed(v)} ${STATS[k].icon} ${STATS[k].label}`, color: STATS[k].color }));

// What a step moves in the words of the game. A Blaze change holds shared stats and per dagger line, a mining one is flat.
function statLines(delta) {
  if (!delta) return [];
  if (!delta.common) return linesOf(delta);
  const line = (name) => {
    const out = { ...delta.swaps[name]?.lore };
    for (const [k, v] of Object.entries(delta.lines[name])) out[k] = (out[k] ?? 0) + v;
    return linesOf(out, `${name[0].toUpperCase()}${name.slice(1)}: `);
  };
  return [
    ...linesOf(delta.common), ...line('ashen'), ...line('spirit'),
    ...(delta.mp ? [{ text: `${signed(delta.mp)} ✦ Magical Power`, color: 'cyan' }] : []),
    ...(delta.ofa ? [{ text: 'One For All', color: 'white' }] : []),
  ];
}

// The grid holds what is worn, without the daggers, so only the shared part of a Blaze change previews there.
export function statDelta(stats, delta) {
  const flat = delta?.common ?? delta ?? {};
  return stats.map((s) => ({ ...s, delta: flat[s.key] ? signed(flat[s.key]) : '' }));
}

export const stepStatus = ({ done, locked, first }) => {
  if (done) return 'done';
  if (locked) return 'locked';
  return first ? 'current' : 'open';
};

// With a resale the rate beside it is per net coin, so the cost says net too.
// What is still to pay up to the end of a chapter or section; steps without a price stay counted, so it never just reads lower.
function leftText({ coins: left, unpriced }, products) {
  if (!products) return 'Left …';
  return [left > 0 && `Left ${coins(left)}`, unpriced > 0 && `+ ${unpriced} unpriced`].filter(Boolean).join(' ');
}

function costText(step, cost, ctx) {
  if (!ctx.products && step.items?.length) return '…';
  if (cost.unpriced) return 'No price';
  if (cost.resale > 0) return `Net ${coins(cost.net)} coins`;
  return cost.coins > 0 ? `${coins(cost.coins)} coins` : 'No coins';
}

const SOURCES = { bazaar: 'Bazaar', forge: 'Forge', ah: 'AH' };

// What to buy for a step: amount, name, price and where from.
function itemLines(step, ctx, name) {
  return (step.items ?? []).map((item) => {
    const label = `${item.qty}× ${item.name ?? name(item.id)}`;
    const p = priceItem(item, ctx);
    if (p.source === 'nt') return { text: `${label} · not tradeable` };
    if (!p.source) return { text: `${label} · ${ctx.products ? 'no price' : '…'}` };
    const way = p.picked ? p.picked.map(name).join(', ') : p.note;
    return { text: `${label} · ${coins(p.coins)} · ${SOURCES[p.source]}${way ? ` · ${way}` : ''}` };
  });
}

function openSide(step, rank, score, ctx) {
  if (rank && !rank.head) return '';
  if (rank?.group === 'locked') return 'locked';
  if (rank?.perMillion !== undefined) return score.rateText(rank.perMillion);
  if (rank?.group === 'free') return 'free';
  if (!ctx.products && step.items?.length) return '…';
  return rank?.group === 'noPrice' ? 'no price' : '';
}

function subOf(status, rank, reasons, lines, skipped) {
  if (status === 'done') return { sub: skipped ? 'skipped' : '', subColor: '' };
  if (status === 'locked') return { sub: reasons.join(' · '), subColor: '' };
  if (rank?.group === 'locked') return { sub: rank.reasons.join(' · '), subColor: '' };
  return { sub: lines.map((l) => l.text).join(' · '), subColor: lines[0]?.color ?? '' };
}

// What the ticked items make of the steps of one guide: an item step is met once its pieces are owned.
export const autoOf = (guide, owned) => ownedAuto(guide, new Set(owned ?? []), stepKey);

// One tick. An item step goes to the state of all guides, anything else stays a mark of this guide. Gives the new owned state.
export function tickStep({ guide, key, on, marks, owned }) {
  const step = guide.sections.flatMap((s) => s.steps.filter((one) => stepKey(s, one) === key))[0];
  const next = new Set(owned);
  const item = step && isItemStep(step);
  if (item && on) for (const id of idsToOwn(step, guide, next)) next.add(id);
  if (item && !on) for (const id of idsOfStep(step, guide)) next.delete(id);
  setMark(guide, marks, key, on, autoOf(guide, next));
  if (item) marks.delete(key);
  return next;
}

// What the path is worked out from: the base typed in at the measurement, the changes since and the gear of the ticks.
// missing: not enough to rank.
function planOf(guide, world, ctx, checked, scores) {
  if (!ctx.items || !world.gamedata) return { missing: 'items' };
  if (!scores[guide.area]) return { missing: 'score' };
  const area = guide.area;
  const entry = world.base?.[area] ?? null;
  if (!Object.keys(entry?.values ?? {}).length) return { missing: 'stats' };
  const settings = guide.preset ? miningSettings({ preset: guide.preset }) : world.settings;
  const worn = gearOf({ guides: world.guides ?? [guide], checks: world.checks ?? { [guide.id]: [...world.marks] }, owned: world.owned ?? [], items: ctx.items, area, build: world.build, settings, values: entry.values, mp: entry.mp ?? null });
  const base = totalFor({ area, entry, build: world.build, gear: worn.gear, data: world.gamedata, stats: statsFor(area, world.gamedata) }).total;
  const daggers = area === 'blaze' ? daggersOf(worn.profile) : null;
  const loadout = daggers ? { ...worn.loadout, daggers } : worn.loadout;
  const state = daggers ? blazeState(base, loadout, daggers) : null;
  const path = pathOf({ guide, checked, ctx, profile: worn.profile, loadout, base, settings, brake: world.brake, other: null, keepOldGear: world.keepOldGear, state });
  let notes = [];
  if (!settings.gemFortune && area === 'mining') notes = ['Gemstone Fortune does not count here, and Ore, Block and Dwarven Metal Fortune are not counted, so fortune steps read low.'];
  if (state) {
    const paths = pathsOf(state);
    notes = [`Enchants: ×${paths.guide.toFixed(2)} · One For All: ×${paths.ofa.toFixed(2)} · ${paths.leader} leads by ${paths.lead.toFixed(1)} % (estimate). In use: ${paths.inUse}.`, ...notes];
  }
  return { path, base, other: null, notes, leftOut: state ? LEFT_OUT : null, daggerMissing: !!daggers && Object.values(daggers).includes(null) };
}

// Worked out when a guide opens, on a tick and when the first prices come. A later price only changes the numbers on the row.
const plans = new Map();
function planCached(guide, world, ctx, checked, scores) {
  if (world.pathEpoch === undefined) return planOf(guide, world, ctx, checked, scores);
  const key = `${guide.id}|${world.pathEpoch}|${world.opened?.[guide.id] ?? 0}|${world.base?.[guide.area]?.at}`;
  if (plans.get(guide.id)?.key !== key) plans.set(guide.id, { key, plan: planOf(guide, world, ctx, checked, scores) });
  return plans.get(guide.id).plan;
}

// The price and the rate of a row now, on the gain of the plan.
function rankOf(entry, guide, ctx, world, other) {
  const price = entry.units ? entryPrice(entry, { guide, ctx, other, keepOldGear: world.keepOldGear }) : entry;
  const paid = !price.unpriced && price.net > 0 && entry.gain > 0;
  const free = !price.unpriced && price.net === 0 && (price.coins > 0 || !!entry.step.table);
  const group = entry.tier === 'noPrice' && free && entry.gain > 0 ? 'free' : entry.tier;
  return { ...entry, ...price, group, head: !entry.group || entry.group.head, ...(paid && { perMillion: entry.gain / (price.net / 1e6) }) };
}

// A ranked guide counts to milestones instead of chapters. Each mark sits where its last step is in the shown order
// (done first, then the path), so the ring passes a mark when that milestone is done.
// shortcut: what is left is the plain price of each open step, without resale or book lines; use the path's price if it misleads.
export function milestonesOf(guide, order, checked, ctx, products) {
  if (!guide.milestones) return null;
  const total = Math.max(order.length, 1);
  const list = guide.milestones.map((m) => {
    const names = new Set(m.steps);
    const mine = order.map((e, i) => ({ ...e, i })).filter((e) => names.has(e.step.text));
    const open = mine.filter((e) => !checked.has(e.key));
    return { name: m.name, at: mine.length ? (mine[mine.length - 1].i + 1) / total : 0, done: !open.length, open };
  });
  const next = list.find((m) => !m.done);
  let left = '';
  if (next) {
    const cost = next.open.map((e) => stepCost(openStep(e.section, e.step, ctx), ctx)).reduce((a, c) => ({ coins: a.coins + c.coins, unpriced: a.unpriced + c.unpriced }), { coins: 0, unpriced: 0 });
    left = !products ? '… left' : [`${coins(cost.coins)} left`, cost.unpriced > 0 && `+ ${cost.unpriced} unpriced`].filter(Boolean).join(' ');
  }
  return {
    marks: list.map(({ at, done }) => ({ at, done })),
    reached: list.filter((m) => m.done).length,
    count: list.length,
    next: next ? { name: next.name, steps: next.open.length, left } : null,
  };
}

const withNext = (n) => (n === 1 ? 'with the next step' : `with the next ${n} steps`);

// The world holds what the app knows: marks, the synced state, prices and settings. rows: done first in guide order, then the path, then the extras.
export function guideModel(guide, world) {
  const scores = world.scores ?? SCORES;
  const owned = new Set(world.owned ?? []);
  const auto = autoOf(guide, owned);
  const ctx = { ...world.prices, products: world.products, auto, profile: null, lockProfile: lockProfile(world.build), marks: world.marks, owned };
  const checked = doneSet(guide, world.marks, auto);
  const implied = impliedDone(guide, checked, stepKey);
  const held = owned;
  const costs = guideStats(guide, checked, ctx); // also sets what the cost of a book line needs
  const plan = planCached(guide, world, ctx, checked, scores);
  const score = scores[guide.area];
  const entries = new Map((plan.path?.order ?? []).map((e) => [e.step, e]));
  const leader = plan.path?.order[0] ?? null;
  const all = guide.sections.flatMap((section) => section.steps.map((step) => ({ section, step, key: stepKey(section, step) })));
  const ranked = all.filter((e) => !e.section.extra);
  const inPlace = plan.path ? [...ranked.filter((e) => checked.has(e.key)), ...plan.path.order.filter((e) => !checked.has(e.key))] : ranked;
  const shownSteps = [...inPlace, ...all.filter((e) => e.section.extra)];

  let card = null;
  const rows = shownSteps.map(({ section, step, key }) => {
    const done = checked.has(key);
    // only what the build proves locks a step (the HOTM tier); unknown is never locked
    const lock = done ? null : checkStep(step, world.items, ctx.lockProfile);
    const status = stepStatus({ done, locked: lock?.status === 'locked', first: !card && !section.extra });
    const reasons = lock?.status === 'locked' ? lock.reasons : [];
    const entry = done ? null : entries.get(step);
    const rank = entry ? rankOf(entry, guide, ctx, world, plan.other) : null;
    const lines = statLines(rank?.delta ?? null);
    const found = auto.get(key);
    const met = !!found && found.have >= found.need;
    // done without the player having the piece itself: something better replaced it
    const skipped = done && !world.marks.has(key) && (implied.has(key) || (met && isItemStep(step) && !idsOfStep(step, guide).some((id) => held.has(id))));
    const row = {
      key, name: step.text, status, tier: rank?.tier ?? null,
      ...subOf(status, rank, reasons, lines, skipped),
      side: status === 'done' || status === 'locked' ? status : openSide(step, rank, score, ctx),
      progress: found?.have && !met ? `${number(found.have)} / ${number(found.need)}` : '',
      group: entry?.group?.head && entry.group.left > 0 ? withNext(entry.group.left) : '',
      member: !!entry?.group && !entry.group.head,
    };
    if (status === 'current') {
      const open = openStep(section, step, ctx);
      const price = rank?.units ? rank : stepCost(open, ctx);
      row.card = card = {
        key, name: step.text, where: section.name, left: leftText(costs.sections[guide.sections.indexOf(section)], world.products), stats: lines, hint: step.hint ?? '', items: itemLines(open, ctx, world.name ?? String),
        gain: !rank?.gain ? '' : score.gainText(rank.gain),
        cost: costText(open, price, ctx),
        rate: rank?.perMillion === undefined ? '' : score.rateLong(rank.perMillion),
        badge: !!leader && leader.step === step && ['value', 'free'].includes(rank?.group),
        delta: rank?.delta ?? null,
        group: row.group,
        notes: [...new Set(rank?.notes ?? []), ...(rank?.resale > 0 ? [`Net ${coins(rank.net)} (buy ${coins(rank.coins)} − resale ${coins(rank.resale)})`] : []), ...(rank?.ahead ? [`Counted up to: ${rank.ahead.text}`] : []), ],
      };
    }
    return row;
  });

  // The line runs up to the current step, without one up to the last step done.
  const end = rows.findIndex((r) => r.status === 'current');
  const limit = end >= 0 ? end : rows.map((r) => r.status).lastIndexOf('done');
  rows.forEach((row, i) => {
    row.railTop = i <= limit;
    row.railBottom = i < limit;
    if (row.card) Object.assign(row.card, { railTop: row.railTop, railBottom: row.railBottom });
  });

  const milestones = milestonesOf(guide, inPlace, checked, ctx, world.products);
  const chapters = chaptersOf(guide, checked, costs, card?.key).map((c) => ({ ...c, leftText: c.current && c.done < c.total ? leftText(c.left, world.products) : '' }));
  // a stat with no typed base is unknown, not 0
  const shown = plan.base ?? null;
  const grid = shown ? (GRIDS[guide.area] ?? []).map((k) => ({ key: k, icon: STATS[k].icon, label: STATS[k].short ?? STATS[k].label, color: STATS[k].color, value: shown[k] === undefined ? '–' : number(shown[k]), delta: '' })) : [];
  return {
    id: guide.id, source: guide.source ?? '', products: world.products, area: guide.area, theme: guide.area ?? 'home', name: guide.title, chapters, milestones, total: totalShare(chapters),
    stats: statDelta(grid, card?.delta ?? null), chips: plan.path?.limits ?? null, rows, card, score, leader, missing: plan.missing ?? null, notes: plan.notes ?? [], leftOut: plan.leftOut ?? null, daggerMissing: !!plan.daggerMissing, usedCofl: !!ctx.usedCofl,
  };
}

const GUIDE_TABS = ['path'];
export const STATS_TABS = ['overview', 'hotm', 'attributes', 'power'];
export const STATS_AREAS = ['mining', 'blaze', 'farming'];
// #/stats, #/stats/<overview|hotm|attributes|power>, #/stats/overview/<area> and #/stats/measure/<area>
export function parseRoute(hash, guides) {
  const [, page, id, tab] = String(hash).split('/');
  if (page === 'settings') return { page };
  if (page === 'stats') {
    const area = STATS_AREAS.includes(tab) ? tab : 'mining';
    if (id === 'measure') return { page, tab: 'measure', area };
    return { page, tab: STATS_TABS.includes(id) ? id : 'overview', area };
  }
  if (page === 'guide' && (id === 'farming' || guides.some((g) => g.id === id))) return { page, id, tab: GUIDE_TABS.includes(tab) ? tab : 'path' };
  return { page: 'home' };
}

// Where a sideways drag leads: from a guide the next guide of its area, the one before, and from the first one home; from a stats page the next tab. family: the guide ids of the area in order.
export function swipeTarget(r, dx, family) {
  if (!dx) return null;
  if (r.page === 'stats' && STATS_TABS.includes(r.tab)) {
    // Overview, HOTM, Attributes, Power in a row; the ends do not lead anywhere
    const to = STATS_TABS[STATS_TABS.indexOf(r.tab) + (dx > 0 ? -1 : 1)];
    return to ? { hash: `#/stats/${to}/${r.area}`, back: dx > 0 } : null;
  }
  if (r.page !== 'guide') return null;
  const at = Math.max(family.indexOf(r.id), 0);
  if (dx > 0) return { hash: at > 0 ? `#/guide/${family[at - 1]}/path` : '#/', back: true };
  return at + 1 < family.length ? { hash: `#/guide/${family[at + 1]}/path`, back: false } : null;
}

// The first 8 px decide: mostly sideways is a swipe, anything else stays a scroll for the whole touch.
const AXIS_MIN_PX = 8;
const AXIS_RATIO = 1.5;
export function swipeAxis(dx, dy) {
  if (Math.hypot(dx, dy) < AXIS_MIN_PX) return null;
  return Math.abs(dx) > AXIS_RATIO * Math.abs(dy) ? 'x' : 'y';
}

// On release the swipe goes on with the speed of the finger: where it would be after MOMENTUM_MS decides.
// It lands past 30 % of the width on the side it was pulled to, otherwise it goes back. speed in px/ms.
const LAND_SHARE = 0.3;
const MOMENTUM_MS = 200;
export function swipeLands(dx, speed, width) {
  const ahead = dx + speed * MOMENTUM_MS;
  return ahead * dx > 0 && Math.abs(ahead) >= LAND_SHARE * width;
}

// A shipped guide coming back unchanged stays shipped, so a later app update can still change it.
export function applyImport({ imported, checks, bundled, owned = [] }, data) {
  const same = (g) => JSON.stringify(g) === JSON.stringify(bundled.find((b) => b.id === g.id));
  return { imported: mergeGuides(imported, data.guides).filter((g) => !same(g)), checks: { ...checks, ...data.progress }, owned: [...new Set([...owned, ...(data.owned ?? [])])] };
}

// What is done at the first run is older than the app, so it gets 0 and never counts as new. That holds per guide.
export function stampAll(guides, checks, dates, now, owned = []) {
  const out = { ...dates };
  for (const guide of guides) {
    const done = doneSet(guide, new Set(checks[guide.id] ?? []), autoOf(guide, owned));
    out[guide.id] = stampDone(dates[guide.id], [...done].filter((k) => !k.startsWith('undone:')), now, dates[guide.id] === undefined);
  }
  return out;
}

const edited = (f) => {
  if (f.tagName === 'SELECT') return [...f.options].some((o) => o.selected !== o.defaultSelected);
  return f.type === 'checkbox' ? f.checked !== f.defaultChecked : f.value !== f.defaultValue;
};

// Is someone filling in this form? Then a redraw from outside would throw away what they typed.
export const formEdited = (fields, active) => fields.some((f) => f === active || edited(f));

// A field is known by its data attributes, which stay the same over a redraw.
const fieldKey = (f) => `${f.tagName}${JSON.stringify(f.dataset)}`;

// What is typed but not saved yet, to survive a redraw of the same form.
export const typedFields = (fields) => new Map(fields.filter(edited).map((f) => [fieldKey(f), f.type === 'checkbox' ? f.checked : f.value]));

export function restoreTyped(fields, typed) {
  for (const f of fields) {
    if (!typed.has(fieldKey(f))) continue;
    if (f.type === 'checkbox') f.checked = typed.get(fieldKey(f));
    else f.value = typed.get(fieldKey(f));
  }
}

// From here on the field counts as saved: the next redraw shows what the app holds.
export function settled(f) {
  if (f.tagName === 'SELECT') for (const o of f.options) o.defaultSelected = o.selected;
  else if (f.type === 'checkbox') f.defaultChecked = f.checked;
  else f.defaultValue = f.value;
}

// Guides of one area belong together: home shows the first, the head switches between them. Owned items are shared anyway.
export const familyOf = (guides, guide) => (guide.area ? guides.filter((g) => g.area === guide.area) : [guide]);
export const firstOfFamilies = (guides) => guides.filter((g) => familyOf(guides, g)[0] === g);

// The app keeps the checks per guide; a guide model sees only its own.
export const worldFor = (world, guide) => ({ ...world, marks: new Set(world.checks?.[guide.id] ?? []) });

// Each guide's own next step in its own unit: the units do not compare, so nothing ranks across guides.
export const nextPerGuide = (models) => models.filter((m) => m.card).map((m) => ({
  area: m.area, name: m.name, step: m.card.name, text: m.rows.find((r) => r.card).side,
}));

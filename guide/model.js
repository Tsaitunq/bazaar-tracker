// What the screens of the guide app show, worked out from the shared logic. No markup in here.
import { stepKey, doneSet, guideStats, openStep, stepCost, mergeGuides, priceItem } from '../progress.js';
import { syncMessage } from '../sync.js';
import { rankArea, SCORES } from '../optimizer.js';
import { detectGuide } from '../detect.js';
import { checkStep } from '../requires.js';
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

function chapterGroups(guide) {
  if (guide.chapters?.length) {
    return guide.chapters.map((c) => ({ name: c.name, sections: guide.sections.filter((s) => c.sections.includes(s.name)) }));
  }
  if (guide.sections.length === ARCS) return guide.sections.map((s) => ({ name: s.name, sections: [s] }));
  return splitInto(guide.sections, ARCS).map((sections, i) => ({ name: sections[0]?.name ?? `Part ${i + 1}`, sections }));
}

// The chapters of the ring: how far each is, and which holds the first open step.
export function chaptersOf(guide, checked, costs = null) {
  const chapters = chapterGroups(guide).map(({ name, sections }) => {
    const keys = sections.flatMap((s) => s.steps.map((step) => stepKey(s, step)));
    const done = keys.filter((k) => checked.has(k)).length;
    const left = costs ? sections.map((s) => costs.sections[guide.sections.indexOf(s)]) : [];
    return { name, done, total: keys.length, share: keys.length ? done / keys.length : 0, current: false, left: { coins: left.reduce((n, l) => n + l.coins, 0), unpriced: left.reduce((n, l) => n + l.unpriced, 0) } };
  });
  const open = chapters.find((c) => c.done < c.total) ?? chapters[chapters.length - 1];
  if (open) open.current = true;
  return chapters;
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
  if (rank?.group === 'locked') return 'locked';
  if (rank?.perMillion !== undefined) return score.rateText(rank.perMillion);
  if (rank?.group === 'free') return 'free';
  if (!ctx.products && step.items?.length) return '…';
  return rank?.group === 'noPrice' ? 'no price' : '';
}

function subOf(status, rank, reasons, lines, fromSync) {
  if (status === 'done') return { sub: fromSync ? 'from sync' : '', subColor: '' };
  if (status === 'locked') return { sub: reasons.join(' · '), subColor: '' };
  if (rank?.group === 'locked') return { sub: rank.reasons.join(' · '), subColor: '' };
  return { sub: lines.map((l) => l.text).join(' · '), subColor: lines[0]?.color ?? '' };
}

// The world holds what the app knows: marks, the synced state, prices and settings. rows is the whole path in guide order.
export function guideModel(guide, world) {
  const scores = world.scores ?? SCORES;
  const profile = world.state?.summary ?? null;
  const auto = detectGuide(guide, profile, stepKey);
  const ctx = { ...world.prices, products: world.products, auto, profile, marks: world.marks };
  const checked = doneSet(guide, world.marks, auto);
  const costs = guideStats(guide, checked, ctx); // also sets what the cost of a book line needs
  const ranked = rankArea({ guide, checked, ctx, state: world.state, settings: world.settings, keepOldGear: world.keepOldGear, boosts: world.boosts, preset: world.preset }, scores);
  const score = scores[guide.area];
  const ranks = new Map();
  for (const [group, list] of Object.entries(ranked.groups ?? {})) for (const row of list) ranks.set(row.step, { ...row, group });
  const leader = ranked.groups && [...ranked.groups.free, ...ranked.groups.ranked][0];

  let card = null;
  const rows = guide.sections.flatMap((section) => section.steps.map((step) => {
    const key = stepKey(section, step);
    const done = checked.has(key);
    const { status: check, reasons } = checkStep(step, ctx.items, ctx.profile);
    const status = stepStatus({ done, locked: check === 'locked', first: !card });
    const rank = ranks.get(step);
    const lines = statLines(rank?.delta ?? null);
    const found = auto.get(key);
    const met = !!found && found.have >= found.need;
    const fromSync = met && done && !world.marks.has(key);
    const row = {
      key, name: step.text, status,
      ...subOf(status, rank, reasons, lines, fromSync),
      side: status === 'done' || status === 'locked' ? status : openSide(step, rank, score, ctx),
      progress: found?.have && !met ? `${number(found.have)} / ${number(found.need)}` : '',
      api: !!found?.have && (!met || fromSync),
      undo: fromSync,
    };
    if (status === 'current') {
      const open = openStep(section, step, ctx);
      const price = rank ?? stepCost(open, ctx);
      row.card = card = {
        key, name: step.text, where: section.name, left: leftText(costs.sections[guide.sections.indexOf(section)], world.products), stats: lines, hint: step.hint ?? '', items: itemLines(open, ctx, world.name ?? String),
        gain: rank?.gain === undefined ? '' : score.gainText(rank.gain),
        cost: costText(open, price, ctx),
        rate: rank?.perMillion === undefined ? '' : score.rateLong(rank.perMillion),
        badge: !!leader && leader.step === step,
        delta: rank?.delta ?? null,
      };
    }
    return row;
  }));

  // The line runs up to the current step, without one up to the last step done.
  const end = rows.findIndex((r) => r.status === 'current');
  const limit = end >= 0 ? end : rows.map((r) => r.status).lastIndexOf('done');
  rows.forEach((row, i) => {
    row.railTop = i <= limit;
    row.railBottom = i < limit;
    if (row.card) Object.assign(row.card, { railTop: row.railTop, railBottom: row.railBottom });
  });

  const chapters = chaptersOf(guide, checked, costs).map((c) => ({ ...c, leftText: c.current && c.done < c.total ? leftText(c.left, world.products) : '' }));
  const grid = ranked.base ? (GRIDS[guide.area] ?? []).map((k) => ({ key: k, icon: STATS[k].icon, label: STATS[k].short ?? STATS[k].label, color: STATS[k].color, value: number(ranked.base[k] ?? 0), delta: '' })) : [];
  return {
    id: guide.id, source: guide.source ?? '', products: world.products, area: guide.area, theme: guide.area ?? 'home', name: guide.title, chapters, total: totalShare(chapters),
    stats: statDelta(grid, card?.delta ?? null), chips: ranked.limits ?? null, rows, card, ranked, score, leader, missing: ranked.missing ?? null, usedCofl: !!ctx.usedCofl,
    tabs: score ? [{ id: 'path', label: 'Path' }, { id: 'best', label: 'Best value' }] : [{ id: 'path', label: 'Path' }],
  };
}

const GUIDE_TABS = ['path', 'best'];
export function parseRoute(hash, guides) {
  const [, page, id, tab] = String(hash).split('/');
  if (page === 'stats' || page === 'settings') return { page };
  if (page === 'guide' && (id === 'farming' || guides.some((g) => g.id === id))) return { page, id, tab: GUIDE_TABS.includes(tab) ? tab : 'path' };
  return { page: 'home' };
}

// Where a sideways drag leads from a guide: the next tab, the one before, and from the first tab home. tabs: those on screen.
export function swipeTarget(r, dx, tabs) {
  if (r.page !== 'guide' || !dx) return null;
  const at = Math.max(tabs.indexOf(r.tab), 0);
  if (dx > 0) return { hash: at > 0 ? `#/guide/${r.id}/${tabs[at - 1]}` : '#/', back: true };
  return at + 1 < tabs.length ? { hash: `#/guide/${r.id}/${tabs[at + 1]}`, back: false } : null;
}

// The first movement decides: clearly sideways is a swipe, anything else stays a scroll for the whole touch.
const AXIS_MIN_PX = 10;
export function swipeAxis(dx, dy) {
  if (Math.hypot(dx, dy) < AXIS_MIN_PX) return null;
  return Math.abs(dx) > 2 * Math.abs(dy) ? 'x' : 'y';
}

// On release a flick counts by its direction, a slow drag by how far it got. speed in px/ms.
const LAND_SHARE = 0.3;
const FLICK_SPEED = 0.5;
export const swipeLands = (dx, speed, width) => (Math.abs(speed) >= FLICK_SPEED ? speed * dx > 0 : Math.abs(dx) >= LAND_SHARE * width);

// What a sync run means for the screen. Anything but success keeps the last state.
export function syncOutcome(result, last) {
  if (result.status === 'ok') return { state: result.state, message: 'Synced.', choices: [] };
  if (result.status === 'choose') return { state: last, message: 'Pick your profile.', choices: result.choices };
  if (result.status === 'error') return { state: last, message: syncMessage(result.error, result.retryIn), choices: [] };
  return { state: last, message: '', choices: [] };
}

// A shipped guide coming back unchanged stays shipped, so a later app update can still change it.
export function applyImport({ imported, checks, bundled }, data) {
  const same = (g) => JSON.stringify(g) === JSON.stringify(bundled.find((b) => b.id === g.id));
  return { imported: mergeGuides(imported, data.guides).filter((g) => !same(g)), checks: { ...checks, ...data.progress } };
}

// firstRun: what is done now is older than the app. That holds per guide too, and for what the first sync finds.
// state undefined: the profile is not loaded yet, so what the sync found cannot be told from what is new. Nothing gets a date.
export function stampAll(guides, checks, dates, state, now, firstRun = false) {
  if (state === undefined) return dates;
  const out = { ...dates };
  for (const guide of guides) {
    const done = doneSet(guide, new Set(checks[guide.id] ?? []), detectGuide(guide, state?.summary ?? null, stepKey));
    out[guide.id] = stampDone(dates[guide.id], [...done].filter((k) => !k.startsWith('undone:')), now, firstRun || dates[guide.id] === undefined);
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

// The app keeps the checks per guide; a guide model sees only its own.
export const worldFor = (world, guide) => ({ ...world, marks: new Set(world.checks?.[guide.id] ?? []) });

// Each guide's own best step in its own unit: the units do not compare, so nothing ranks across guides.
export const bestPerGuide = (models) => models.filter((m) => m.leader).map((m) => ({
  area: m.area, name: m.name, step: m.leader.step.text,
  text: m.leader.perMillion === undefined ? m.score.gainText(m.leader.gain) : m.score.rateText(m.leader.perMillion),
}));

function bestRow(row, model, products) {
  const lines = statLines(row.delta ?? null).map((l) => l.text);
  const extra = [
    ...new Set(row.notes ?? []),
    ...(row.resale > 0 ? [`Net ${coins(row.net)} (buy ${coins(row.coins)} − resale ${coins(row.resale)})`] : []),
    ...(row.ahead ? [`Counted up to: ${row.ahead.text}`] : []),
    ...(row.status === 'unknown' ? ['Requirements could not be checked.'] : []),
    ...(row.status === 'locked' ? [row.reasons.join(' · ')] : []),
  ];
  const side = row.perMillion !== undefined ? model.score.rateText(row.perMillion) : row.status === 'locked' ? 'locked' : row.unpriced ? (products ? 'no price' : '…') : row.free ? 'free' : '';
  return {
    key: stepKey(row.section, row.step), name: row.step.text, side,
    sub: [row.gain === undefined ? '' : model.score.gainText(row.gain), ...lines].filter(Boolean).join(' · '),
    extra: extra.filter(Boolean),
  };
}

// The groups of the Best value tab, in the order of the existing view. Empty ones stay out.
export function bestGroups(model) {
  const g = model.ranked.groups;
  const free = new Set(g.free);
  return [
    ['Requirements first', g.requirements, 'These close a missed limit. Sorted by how much of the gap they close per coin.'],
    ['Best value', [...g.free, ...g.ranked], ''],
    ['Locked', g.locked, ''],
    ['No price', g.noPrice, 'A sum that leaves out an item would look cheaper than it is.'],
    ['No gain data', g.noGain, 'Nothing known gives this step a fixed value.'],
    ['No gain', g.zero, 'These add nothing in this model right now.'],
  ].filter(([, list]) => list.length).map(([title, list, note]) => ({ title, note, rows: list.map((row) => bestRow({ ...row, free: free.has(row) }, model, model.products)) }));
}

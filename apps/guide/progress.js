// The guides and what their steps cost. Guides come from personal/guides (copied into the guide app by
// scripts/guide/guide-copy.mjs, never in git) or from an imported file.

import { coins } from '../../shared/format.js';
import { walkBook } from '../../shared/prices.js';
import { validDetect, validGroups } from './detect.js';
import { impliedDone } from './owned.js';

const INDEX = 'personal/guides/index.json';
const text = (v) => (typeof v === 'string' && v.trim() ? v : null);

// A forge recipe written into a guide, in the shape of forge.json.
function validRecipe(r) {
  if (!(r?.d > 0) || !r.i || typeof r.i !== 'object' || !Object.values(r.i).every((q) => q > 0)) return null;
  return { ...(r.n > 0 && { n: r.n }), d: r.d, ...(r.c > 0 && { c: r.c }), i: { ...r.i } };
}

function validItem(i) {
  const qty = i?.qty ?? 1;
  if (!Number.isInteger(qty) || qty < 1) return null;
  const id = text(i?.id), name = text(i?.name);
  if (!id && !name) return null;
  const forge = validRecipe(i?.forge);
  if (i?.forge !== undefined && !forge) return null;
  const without = Array.isArray(i?.without) ? i.without.filter(text) : [];
  const anyOf = Array.isArray(i?.anyOf) ? i.anyOf.filter(text) : [];
  if (anyOf.length && !name) return null;
  return { ...(id && { id }), ...(name && { name }), qty, ...(i.ah === true && { ah: true }), ...(i.nt === true && { nt: true }), ...(forge && { forge }), ...(without.length && { without }), ...(anyOf.length && { anyOf }), ...(Number.isInteger(i?.skip) && i.skip > 0 && { skip: i.skip }), ...(Number.isInteger(i?.combine) && i.combine >= 0 && { combine: i.combine }) };
}

// What a step adds where the data has no value for it; only real numbers come through.
function validGain(g) {
  if (!g || typeof g !== 'object' || Array.isArray(g)) return null;
  const kept = Object.entries(g).filter(([, v]) => Number.isFinite(v));
  return kept.length ? Object.fromEntries(kept) : null;
}

function validStep(s) {
  if (!text(s?.text)) return null;
  const items = s.items === undefined ? [] : Array.isArray(s.items) ? s.items.map(validItem) : [null];
  if (items.includes(null)) return null;
  const detect = validDetect(s.detect);
  const gain = validGain(s.gain);
  const after = Array.isArray(s.after) ? s.after.filter(text) : [];
  return { text: s.text, ...(detect && { detect }), ...(gain && { gain }), ...(items.length && { items }), ...(text(s.hint) && { hint: s.hint }), ...(s.table === true && { table: true }), ...(text(s.line) && { line: s.line }), ...(Number.isInteger(s.priority) && s.priority > 0 && { priority: s.priority }), ...(text(s.group) && { group: s.group }), ...(after.length && { after }) };
}

// Sections grouped for the ring of the guide app. A name that is no section drops out, and a chapter left empty with it.
function validChapters(list, sections) {
  if (!Array.isArray(list)) return null;
  const known = new Set(sections.map((s) => s.name));
  const kept = list.flatMap((c) => {
    const names = Array.isArray(c?.sections) ? c.sections.filter((n) => known.has(n)) : [];
    return text(c?.name) && names.length ? [{ name: c.name, sections: names }] : [];
  });
  return kept.length ? kept : null;
}

// Milestones name steps by their text; unknown names drop out, a milestone without a known step goes.
function validMilestones(list, sections) {
  if (!Array.isArray(list)) return null;
  const known = new Set(sections.flatMap((s) => s.steps.map((step) => step.text)));
  const kept = list.flatMap((m) => {
    const steps = Array.isArray(m?.steps) ? m.steps.filter((n) => known.has(n)) : [];
    return text(m?.name) && steps.length ? [{ name: m.name, steps }] : [];
  });
  return kept.length ? kept : null;
}

// A guide from a file is outside data: only the known fields come through, and a link only as http(s).
export function validGuide(g) {
  if (!text(g?.title) || !Array.isArray(g.sections) || !g.sections.length) return null;
  const sections = g.sections.map((s) => {
    if (!text(s?.name) || !Array.isArray(s.steps)) return null;
    const steps = s.steps.map(validStep);
    if (steps.includes(null)) return null;
    return { name: s.name, ...(text(s.goal) && { goal: s.goal }), ...(s.extra === true && { extra: true }), steps };
  });
  if (sections.includes(null)) return null;
  const groups = validGroups(g.groups);
  const chapters = validChapters(g.chapters, sections);
  const milestones = validMilestones(g.milestones, sections);
  return { title: g.title, ...(text(g.label) && { label: g.label }), ...(/^https?:\/\//i.test(g.source ?? '') && { source: g.source }), ...(['mining', 'blaze', 'farming'].includes(g.area) && { area: g.area }), ...(['fixed', 'value'].includes(g.order) && { order: g.order }), ...(text(g.preset) && { preset: g.preset }), ...(chapters && { chapters }), ...(milestones && { milestones }), ...(groups && { groups }), sections };
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'guide';

// The guides shipped with the app; an installation without them gets a 404 here, which means none.
export async function loadBundled(get = fetch) {
  try {
    const names = await (await get(INDEX)).json();
    if (!Array.isArray(names)) return [];
    const loaded = await Promise.all(names.map(async (f) => {
      const g = validGuide(await (await get(`personal/guides/${f}`)).json());
      return g && { id: f.replace(/\.json$/, ''), ...g };
    }));
    return loaded.filter(Boolean);
  } catch {
    return [];
  }
}

// An imported guide replaces the shipped one with the same id.
export function mergeGuides(bundled, imported) {
  const ids = new Set(imported.map((g) => g.id));
  return [...bundled.filter((g) => !ids.has(g.id)), ...imported];
}

export const exportData = (guides, progress, owned = []) => JSON.stringify({ type: 'bt-progress', guides, progress, owned }, null, 2);

// Reads an export of the app or one plain guide file. Throws with a message for the player.
export function importData(raw) {
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error('That is not valid JSON.'); }
  const list = data?.type === 'bt-progress' ? data.guides : [data];
  if (!Array.isArray(list)) throw new Error('No guides found in that file.');
  const guides = list.map((g) => {
    const valid = validGuide(g);
    if (!valid) throw new Error('A guide in that file has the wrong format.');
    return { id: text(g.id) ?? slug(valid.title), ...valid };
  });
  const progress = {};
  for (const [id, keys] of Object.entries(data?.type === 'bt-progress' && data.progress ? data.progress : {})) {
    if (Array.isArray(keys)) progress[id] = keys.filter((k) => typeof k === 'string');
  }
  if (!guides.length && !Object.keys(progress).length) throw new Error('No guides found in that file.');
  const owned = data?.type === 'bt-progress' && Array.isArray(data.owned) ? data.owned.filter((id) => typeof id === 'string') : [];
  return { guides, progress, owned };
}

// A checkmark belongs to its section and text, so a changed guide keeps the marks of the steps it kept.
export const stepKey = (section, step) => `${section.name}|${step.text}`;

// What the last sync says never lands in marks, so an item sold loses its API tick but no tick of the player. A mark
// wins, then an explicit untick (UNDONE + key), then the sync. A table step needs no coins and counts as done unless
// a sync refutes it.
const met = (found) => !!found && found.have >= found.need;
const UNDONE = 'undone:';
export function doneSet(guide, marks, auto = null) {
  const done = new Set(marks);
  for (const section of guide.sections) {
    for (const step of section.steps) {
      const key = stepKey(section, step);
      const found = auto?.get(key);
      if (!marks.has(UNDONE + key) && (met(found) || (step.table && !found))) done.add(key);
    }
  }
  for (const key of impliedDone(guide, done, stepKey)) if (!marks.has(UNDONE + key)) done.add(key);
  return done;
}

export function setMark(guide, marks, key, on, auto = null) {
  const isTable = guide.sections.some((section) => section.steps.some((step) => step.table && stepKey(section, step) === key));
  marks.delete(key);
  marks.delete(UNDONE + key);
  if (on) marks.add(key);
  else if (isTable || met(auto?.get(key))) marks.add(UNDONE + key);
}

// Shards and enchanted books only trade on the bazaar, so asking the auction side for them is wasted.
const BAZAAR_ONLY = /^(ENCHANTMENT_|SHARD_)/;

const bin = (id, ctx) => {
  if (ctx.ah?.[id] > 0) return { coins: ctx.ah[id] };
  if (BAZAAR_ONLY.test(id)) return null;
  const found = ctx.cofl?.[id];
  if (found === undefined && ctx.products) ctx.wants?.add(id);
  return found > 0 ? { coins: found, cofl: true } : null;
};

// The ingredients are priced like the item itself, the forge times of what must be forged add up.
function forgeCost(id, qty, opts, ctx, seen) {
  const recipe = opts.forge ?? ctx.forge?.[id];
  if (!recipe || seen.includes(id)) return null;
  const runs = Math.ceil(qty / (recipe.n ?? 1));
  const total = { coins: (recipe.c ?? 0) * runs, secs: recipe.d * runs, cofl: false };
  for (const [ing, need] of Object.entries(recipe.i)) {
    if (opts.without?.includes(ing)) continue;
    const sub = cheapest(ing, need * runs, {}, ctx, [...seen, id]);
    if (!sub) return null;
    total.coins += sub.coins;
    total.secs += sub.secs ?? 0;
    total.cofl ||= !!sub.cofl;
  }
  return total;
}

// null when no source has a price. The bazaar goes first; only what is not on it compares forge and auction.
function cheapest(id, qty, opts, ctx, seen = []) {
  const onBazaar = bazaarCost(id, qty, ctx.products);
  if (onBazaar !== null) return { source: 'bazaar', coins: onBazaar };
  const forged = forgeCost(id, qty, opts, ctx, seen);
  const auction = opts.noAh ? null : bin(id, ctx);
  const ah = auction && { coins: auction.coins * qty, cofl: auction.cofl };
  if (!forged && !ah) return null;
  const best = forged && (!ah || forged.coins <= ah.coins) ? { source: 'forge', ...forged } : { source: 'ah', ...ah };
  return { ...best, forged, ah };
}

const span = (secs) => (secs >= 3600 ? `${Math.round(secs / 3600)}h` : secs >= 60 ? `${Math.round(secs / 60)}m` : `${secs}s`);

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const bazaarCost = (id, qty, products) => {
  const book = products?.[id]?.buy_summary;
  return book?.length ? walkBook(book, qty, true) : null;
};

// Two of the level below, of which the player may already own or be able to work up the first.
function combineCost(id, level, qty, combine, products, have) {
  if (!have) return bookCost(id, qty * 2, combine, products);
  const second = bookCost(id, qty, combine, products);
  if (have >= level) return second;
  const first = bookCost(id, qty, combine, products, have);
  return first && second && { coins: first.coins + second.coins };
}

// A book of level L: bought as it is, or made from two of L-1 where combine (the wiki's limit) allows that.
function bookCost(id, qty, combine, products, have = 0) {
  const [, base, lvl] = id.match(/^(.+)_(\d+)$/) ?? [];
  const level = Number(lvl);
  const direct = bazaarCost(id, qty, products);
  const lower = level > 1 && level <= combine ? combineCost(`${base}_${level - 1}`, level - 1, qty, combine, products, have) : null;
  if (lower && (direct === null || lower.coins < direct)) return { coins: lower.coins, made: true, direct, lower: lower.coins, level };
  return direct === null ? null : { coins: direct, made: false, direct, lower: lower?.coins ?? null, level };
}

function bookPrice(item, ctx) {
  const b = bookCost(item.id, item.qty, item.combine, ctx.products, ctx.have?.get(item) ?? 0);
  if (!b) return { source: null, coins: 0 };
  const made = b.lower !== null && `combine 2× ${ROMAN[b.level - 1]}: ${coins(b.lower)}`;
  const bought = b.direct !== null && `book: ${coins(b.direct)}`;
  return { source: 'bazaar', coins: b.coins, nt: false, note: (b.made ? [made, bought] : [bought, made]).filter(Boolean).join(' · ') };
}

// The guide leaves the piece open: the cheapest qty of the list, after the skip cheapest an earlier step already bought.
function piecesPrice(item, ctx) {
  const found = item.anyOf.map((id) => ({ id, ...priceItem({ id, qty: 1 }, ctx) })).filter((p) => p.source).sort((a, b) => a.coins - b.coins);
  const skip = item.skip ?? 0;
  const picked = found.slice(skip, skip + item.qty);
  if (picked.length < item.qty) return { source: null, coins: 0 };
  return { source: picked[0].source, coins: picked.reduce((sum, p) => sum + p.coins, 0), picked: picked.map((p) => p.id) };
}

// What one guide item costs: source is bazaar, forge, ah, nt (not tradeable) or null when nothing has a price.
export function priceItem(item, ctx) {
  if (item.anyOf) return piecesPrice(item, ctx);
  if (item.id && item.combine !== undefined) return bookPrice(item, ctx);
  const tradeable = !item.nt;
  if (!item.id || (!tradeable && !item.forge && !ctx.forge?.[item.id])) return { source: item.nt ? 'nt' : null, coins: 0 };
  const found = cheapest(item.id, item.qty, { forge: item.forge, without: item.without, noAh: !tradeable }, ctx);
  if (!found) return { source: null, coins: 0 };
  const parts = [found.forged && `forge: ${coins(found.forged.coins)} + ${span(found.forged.secs)}`, found.ah && `AH: ${coins(found.ah.coins)}`].filter(Boolean);
  if (found.cofl) ctx.usedCofl = true;
  return { source: found.source, coins: found.coins, nt: !tradeable, ...(parts.length && { note: parts.join(' · ') }) };
}

// What the items of a step cost now and how many of them have no price; not tradeable ones count as neither.
export function stepCost(step, ctx) {
  const prices = (step.items ?? []).map((i) => priceItem(i, ctx));
  return {
    coins: prices.reduce((sum, p) => sum + p.coins, 0),
    unpriced: prices.filter((p) => p.source === null).length,
  };
}

// What is still open of a step the sync found partly done. Pieces owned drop out, the rest shrinks with what is
// left, rounded up. shortcut: anyOf stays at its own qty and skip, a partly owned choice can read a bit high; split it if that misleads.
export function openStep(section, step, ctx) {
  const found = ctx.auto?.get(stepKey(section, step));
  if (!found?.have || !step.items || met(found)) return step;
  const owned = [step.detect].flat().some((d) => d.kind === 'owned') ? new Set([...(ctx.profile?.items ?? []).map((i) => i.id), ...(ctx.owned ?? [])]) : new Set();
  const share = (found.need - found.have) / found.need;
  const items = step.items.filter((i) => !owned.has(i.id)).map((item) => {
    if (item.anyOf) return item;
    const open = { ...item, qty: Math.ceil(item.qty * share) };
    if (ctx.have?.has(item)) ctx.have.set(open, ctx.have.get(item));
    return open;
  });
  return { ...step, items };
}

export const bookOf = (step) => (step.items?.length === 1 && step.items[0].combine !== undefined ? step.items[0] : null);
const bookLevel = (item) => item.id.match(/^(.+)_(\d+)$/) ?? [];

// Per book of a guide the highest level of the same enchant already checked below it.
function haveLevels(guide, checked) {
  const books = guide.sections.flatMap((section) => section.steps.filter(bookOf).map((step) => ({ item: bookOf(step), done: checked.has(stepKey(section, step)) })));
  const have = new Map();
  for (const { item } of books) {
    const [, base, level] = bookLevel(item);
    const below = books.filter((b) => b.done && bookLevel(b.item)[1] === base && Number(bookLevel(b.item)[2]) < Number(level));
    if (below.length) have.set(item, Math.max(...below.map((b) => Number(bookLevel(b.item)[2]))));
  }
  return have;
}

// Counts for the guide and per section; only open steps count towards what is left to pay. Of a line of books only
// the last one costs: its price is the cheapest way there from the level reached, so the levels between are in it.
export function guideStats(guide, checked, ctx) {
  let next = null;
  ctx.have = haveLevels(guide, checked);
  const ends = new Map();
  for (const section of guide.sections) for (const step of section.steps) if (step.line && bookOf(step)) ends.set(step.line, step);
  const sections = guide.sections.map((section) => {
    const left = { done: 0, total: section.steps.length, coins: 0, unpriced: 0 };
    for (const step of section.steps) {
      if (checked.has(stepKey(section, step))) { left.done++; continue; }
      next ??= { section, step };
      if (step.line && bookOf(step) && ends.get(step.line) !== step) continue;
      const cost = stepCost(openStep(section, step, ctx), ctx);
      left.coins += cost.coins;
      left.unpriced += cost.unpriced;
    }
    return left;
  });
  return { done: sections.reduce((n, s) => n + s.done, 0), total: sections.reduce((n, s) => n + s.total, 0), next, sections };
}

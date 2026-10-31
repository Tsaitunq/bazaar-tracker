// The private Progress area: guides with checkboxes. Guides come from personal/guides (copied into the
// app by scripts/copy-web.mjs, never in git) or from an imported file.

import { esc, coins } from './render.js';
import { walkBook } from './craft.js';

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
  return { ...(id && { id }), ...(name && { name }), qty, ...(i.ah === true && { ah: true }), ...(i.nt === true && { nt: true }), ...(forge && { forge }), ...(without.length && { without }) };
}

function validStep(s) {
  if (!text(s?.text)) return null;
  const items = s.items === undefined ? [] : Array.isArray(s.items) ? s.items.map(validItem) : [null];
  if (items.includes(null)) return null;
  return { text: s.text, ...(items.length && { items }), ...(text(s.hint) && { hint: s.hint }) };
}

// A guide from a file is outside data: only the known fields come through, and a link only as http(s).
export function validGuide(g) {
  if (!text(g?.title) || !Array.isArray(g.sections) || !g.sections.length) return null;
  const sections = g.sections.map((s) => {
    if (!text(s?.name) || !Array.isArray(s.steps)) return null;
    const steps = s.steps.map(validStep);
    if (steps.includes(null)) return null;
    return { name: s.name, ...(text(s.goal) && { goal: s.goal }), steps };
  });
  if (sections.includes(null)) return null;
  return { title: g.title, ...(/^https?:\/\//i.test(g.source ?? '') && { source: g.source }), sections };
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

// What the settings show: import after the hidden unlock or with a guide, the switch only with a guide.
export const personalVisibility = (guideCount, unlocked) => ({ section: guideCount > 0 || unlocked, toggle: guideCount > 0 });

// The hidden way in: true on the fifth tap in a row, each within the given time of the one before.
export function secretTap(taps, now, need = 5, gap = 1500) {
  const last = taps[taps.length - 1];
  const next = last !== undefined && now - last <= gap ? [...taps, now] : [now];
  return { taps: next.length >= need ? [] : next, open: next.length >= need };
}

export const exportData = (guides, progress) => JSON.stringify({ type: 'bt-progress', guides, progress }, null, 2);

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
  return { guides, progress };
}

// A checkmark belongs to its section and text, so a changed guide keeps the marks of the steps it kept.
export const stepKey = (section, step) => `${section.name}|${step.text}`;

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
  const book = ctx.products?.[id]?.buy_summary;
  const onBazaar = book?.length ? walkBook(book, qty, true) : null;
  if (onBazaar !== null) return { source: 'bazaar', coins: onBazaar };
  const forged = forgeCost(id, qty, opts, ctx, seen);
  const auction = opts.noAh ? null : bin(id, ctx);
  const ah = auction && { coins: auction.coins * qty, cofl: auction.cofl };
  if (!forged && !ah) return null;
  const best = forged && (!ah || forged.coins <= ah.coins) ? { source: 'forge', ...forged } : { source: 'ah', ...ah };
  return { ...best, forged, ah };
}

const span = (secs) => (secs >= 3600 ? `${Math.round(secs / 3600)}h` : secs >= 60 ? `${Math.round(secs / 60)}m` : `${secs}s`);

// What one guide item costs: source is bazaar, forge, ah, nt (not tradeable) or null when nothing has a price.
export function priceItem(item, ctx) {
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

// Counts for the guide and per section; only open steps count towards what is left to pay.
export function guideStats(guide, checked, ctx) {
  let next = null;
  const sections = guide.sections.map((section) => {
    const left = { done: 0, total: section.steps.length, coins: 0, unpriced: 0 };
    for (const step of section.steps) {
      if (checked.has(stepKey(section, step))) { left.done++; continue; }
      next ??= { section, step };
      const cost = stepCost(step, ctx);
      left.coins += cost.coins;
      left.unpriced += cost.unpriced;
    }
    return left;
  });
  return { done: sections.reduce((n, s) => n + s.done, 0), total: sections.reduce((n, s) => n + s.total, 0), next, sections };
}

const SOURCES = { bazaar: 'Bazaar', forge: 'Forge', ah: 'AH', nt: 'not tradeable' };
const badge = (source) => `<span class="guide-src" data-src="${source}">${SOURCES[source]}</span>`;

function itemLine(item, ctx, name) {
  const label = `${esc(item.name ?? name(item.id))} × ${item.qty}`;
  const p = priceItem(item, ctx);
  if (p.source === 'nt') return `<small class="guide-item">${label} ${badge('nt')}</small>`;
  if (!p.source) return `<small class="guide-item">${label} · <strong>${ctx.products ? 'no price' : '…'}</strong></small>`;
  return `<small class="guide-item">${label} · <strong>${coins(p.coins)}</strong> ${badge(p.source)}${p.nt ? ` ${badge('nt')}` : ''}${p.note ? `<span class="guide-way">${esc(p.note)}</span>` : ''}</small>`;
}

const stepRow = (section, step, checked, ctx, name) => {
  const key = stepKey(section, step);
  // a finished step needs no price from the network
  const itemCtx = checked.has(key) ? { ...ctx, wants: null } : ctx;
  return `<li class="guide-step"><label>
    <input type="checkbox" data-step="${esc(key)}"${checked.has(key) ? ' checked' : ''}>
    <span><span class="guide-text">${esc(step.text)}</span>${(step.items ?? []).map((i) => itemLine(i, itemCtx, name)).join('')}${step.hint ? `<small class="guide-hint">${esc(step.hint)}</small>` : ''}</span>
  </label></li>`;
};

function restNote(s, products) {
  if (s.done === s.total) return '';
  if (!products) return 'Left …';
  return [s.coins > 0 && `Left ${coins(s.coins)}`, s.unpriced > 0 && `+ ${s.unpriced} unpriced`].filter(Boolean).join(' ');
}

// open: the unfolded sections' names, or null at first, when the first one with open steps unfolds.
export function progressView({ guides, current, checked, products, prices = {}, name, open = null, armed = false, removable = false }) {
  const ctx = { ...prices, products };
  const guide = guides.find((g) => g.id === current) ?? guides[0];
  const stats = guideStats(guide, checked, ctx);
  const first = open ? null : guide.sections.find((_, i) => stats.sections[i].done < stats.sections[i].total)?.name;
  const page = `<div class="bar ranges guide-switch" role="group" aria-label="Guide">${guides.map((g) => `<button type="button" data-guide="${esc(g.id)}" aria-pressed="${g.id === guide.id}">${esc(g.title)}</button>`).join('')}</div>
  <p class="guide-count"><strong>${stats.done} / ${stats.total}</strong>${guide.source ? ` <a class="muted" href="${esc(guide.source)}" rel="noopener">Source</a>` : ''}</p>
  <section class="guide-next" aria-label="Next step"><h2>Next step</h2>${stats.next
    ? `<small class="guide-hint">${esc(stats.next.section.name)}</small><ul class="guide-steps">${stepRow(stats.next.section, stats.next.step, checked, ctx, name)}</ul>`
    : '<p class="muted">All steps are done.</p>'}</section>
  ${guide.sections.map((section, i) => {
    const s = stats.sections[i];
    const isOpen = open ? open.has(section.name) : section.name === first;
    const note = restNote(s, products);
    return `<details class="guide-section" data-section="${esc(section.name)}"${isOpen ? ' open' : ''}>
      <summary><span class="guide-name">${esc(section.name)}</span>${s.total ? `<span class="muted">${s.done} / ${s.total}</span>` : ''}${note ? `<small class="guide-rest">${note}</small>` : ''}</summary>
      ${section.goal ? `<p class="guide-goal">${esc(section.goal)}</p>` : ''}
      ${s.total ? `<ul class="guide-steps">${section.steps.map((step) => stepRow(section, step, checked, ctx, name)).join('')}</ul>` : ''}
    </details>`;
  }).join('')}
  <div class="actions guide-foot">${armed
    ? '<span class="muted">Clear all checkmarks of this guide?</span><button type="button" data-guide-act="reset-yes" class="primary">Reset</button><button type="button" data-guide-act="reset-no">Cancel</button>'
    : `${removable ? '<button type="button" data-guide-act="remove">Remove imported copy</button>' : ''}<button type="button" data-guide-act="reset">Reset guide</button>`}</div>`;
  return `${page}${ctx.usedCofl ? '<p class="muted guide-credit">Prices: <a href="https://sky.coflnet.com" rel="noopener">SkyCofl</a></p>' : ''}`;
}

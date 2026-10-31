// The private Progress area: guides with checkboxes. Guides come from personal/guides (copied into the
// app by scripts/copy-web.mjs, never in git) or from an imported file.

import { esc, coins } from './render.js';

const INDEX = 'personal/guides/index.json';
const text = (v) => (typeof v === 'string' && v.trim() ? v : null);

function validItem(i) {
  const qty = i?.qty ?? 1;
  if (!Number.isInteger(qty) || qty < 1) return null;
  const id = text(i?.id), name = text(i?.name);
  if (!id && !name) return null;
  return { ...(id && { id }), ...(name && { name }), qty, ...(i.ah === true && { ah: true }) };
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

const instaBuy = (id, products) => {
  const price = products?.[id]?.buy_summary?.[0]?.pricePerUnit;
  return price > 0 ? price : null;
};

// What the priced items of a step cost now, and whether auction items or items without an offer come on top.
export function stepCost(step, products) {
  const items = step.items ?? [];
  const priced = items.filter((i) => !i.ah && instaBuy(i.id, products));
  return {
    coins: priced.reduce((sum, i) => sum + instaBuy(i.id, products) * i.qty, 0),
    ah: items.some((i) => i.ah),
    unpriced: items.some((i) => !i.ah && !instaBuy(i.id, products)),
  };
}

// Counts for the guide and per section; only open steps count towards what is left to pay.
export function guideStats(guide, checked, products) {
  let next = null;
  const sections = guide.sections.map((section) => {
    const left = { done: 0, total: section.steps.length, coins: 0, ah: false, unpriced: false };
    for (const step of section.steps) {
      if (checked.has(stepKey(section, step))) { left.done++; continue; }
      next ??= { section, step };
      const cost = stepCost(step, products);
      left.coins += cost.coins;
      left.ah ||= cost.ah;
      left.unpriced ||= cost.unpriced;
    }
    return left;
  });
  return { done: sections.reduce((n, s) => n + s.done, 0), total: sections.reduce((n, s) => n + s.total, 0), next, sections };
}

const AH_LABEL = 'AH – not priced';

function itemLine(item, products, name) {
  const label = `${esc(item.name ?? name(item.id))} × ${item.qty}`;
  if (item.ah) return `<small class="guide-item">${label} · ${AH_LABEL}</small>`;
  const price = instaBuy(item.id, products);
  const worth = price ? coins(price * item.qty) : products ? 'no offer' : '…';
  return `<small class="guide-item">${label} · <strong>${worth}</strong></small>`;
}

const stepRow = (section, step, checked, products, name) => {
  const key = stepKey(section, step);
  return `<li class="guide-step"><label>
    <input type="checkbox" data-step="${esc(key)}"${checked.has(key) ? ' checked' : ''}>
    <span><span class="guide-text">${esc(step.text)}</span>${(step.items ?? []).map((i) => itemLine(i, products, name)).join('')}${step.hint ? `<small class="guide-hint">${esc(step.hint)}</small>` : ''}</span>
  </label></li>`;
};

function restNote(s, products) {
  if (s.done === s.total) return '';
  const extras = [s.ah && '+ AH items', s.unpriced && products && '+ no offer'].filter(Boolean).join(' ');
  const sum = products ? (s.coins > 0 ? `Left ${coins(s.coins)}` : '') : 'Left …';
  return [sum, extras].filter(Boolean).join(' ');
}

// open: the unfolded sections' names, or null at first, when the first one with open steps unfolds.
export function progressView({ guides, current, checked, products, name, open = null, armed = false, removable = false }) {
  const guide = guides.find((g) => g.id === current) ?? guides[0];
  const stats = guideStats(guide, checked, products);
  const first = open ? null : guide.sections.find((_, i) => stats.sections[i].done < stats.sections[i].total)?.name;
  return `<div class="bar ranges guide-switch" role="group" aria-label="Guide">${guides.map((g) => `<button type="button" data-guide="${esc(g.id)}" aria-pressed="${g.id === guide.id}">${esc(g.title)}</button>`).join('')}</div>
  <p class="guide-count"><strong>${stats.done} / ${stats.total}</strong>${guide.source ? ` <a class="muted" href="${esc(guide.source)}" rel="noopener">Source</a>` : ''}</p>
  <section class="guide-next" aria-label="Next step"><h2>Next step</h2>${stats.next
    ? `<small class="guide-hint">${esc(stats.next.section.name)}</small><ul class="guide-steps">${stepRow(stats.next.section, stats.next.step, checked, products, name)}</ul>`
    : '<p class="muted">All steps are done.</p>'}</section>
  ${guide.sections.map((section, i) => {
    const s = stats.sections[i];
    const isOpen = open ? open.has(section.name) : section.name === first;
    const note = restNote(s, products);
    return `<details class="guide-section" data-section="${esc(section.name)}"${isOpen ? ' open' : ''}>
      <summary><span class="guide-name">${esc(section.name)}</span>${s.total ? `<span class="muted">${s.done} / ${s.total}</span>` : ''}${note ? `<small class="guide-rest">${note}</small>` : ''}</summary>
      ${section.goal ? `<p class="guide-goal">${esc(section.goal)}</p>` : ''}
      ${s.total ? `<ul class="guide-steps">${section.steps.map((step) => stepRow(section, step, checked, products, name)).join('')}</ul>` : ''}
    </details>`;
  }).join('')}
  <div class="actions guide-foot">${armed
    ? '<span class="muted">Clear all checkmarks of this guide?</span><button type="button" data-guide-act="reset-yes" class="primary">Reset</button><button type="button" data-guide-act="reset-no">Cancel</button>'
    : `${removable ? '<button type="button" data-guide-act="remove">Remove imported copy</button>' : ''}<button type="button" data-guide-act="reset">Reset guide</button>`}</div>`;
}

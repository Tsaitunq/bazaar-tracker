// A guide with categories: the overview (best step, prerequisites, attributes, tiles) and the page of one category.
import { esc, number } from '../../../shared/format.js';
import { ring, icon, stepCard, pathRow } from './parts.js';

const bar = (share) => `<div class="bar-track" role="presentation"><i style="width:${Math.round(share * 100)}%"></i></div>`;
const pct = (share) => `${Math.round(share * 100)}%`;

// One ring with the share of the path steps, the name and how many categories are begun.
export function overviewHead(m) {
  const s = m.structure;
  const arcs = ring({ chapters: [{ share: m.total }], total: m.total, size: 88, label: 'Progress', marks: m.milestones?.marks ?? [] });
  return `<div class="head"><div class="ring-head">${arcs}<div class="ring-text"><div class="ring-title">${icon(m.theme)}<h1>${esc(m.name)}</h1><b class="head-pct">${pct(m.total)}</b></div><span class="milestone-count">${number(s.started)} of ${number(s.categories.length)} categories started</span></div></div></div>`;
}

// The best step over all categories: the value ranking stays on top.
function best(m) {
  const c = m.card;
  if (!c) return '';
  const lines = c.stats.map((x) => `<span class="card-stat c-${x.color}">${esc(x.text)}</span>`).join('');
  return `<section class="card best" aria-label="Best next step"><span class="eyebrow">Best next step · ${esc(m.structure.best ?? '')}</span><div class="card-head"><span class="card-name">${esc(c.name)}</span>${c.rate ? `<span class="card-where">${esc(c.rate)}</span>` : ''}</div>${lines || c.gain ? `<div class="card-box">${lines}${c.gain ? `<span class="card-gain">${esc(c.gain)}</span>` : ''}</div>` : ''}<div class="card-foot"><span class="card-cost">${esc(c.cost)}</span></div><button type="button" class="primary" data-step="${esc(c.key)}">Mark done</button></section>`;
}

const video = (url) => (url ? `<a class="video" href="${esc(url)}" rel="noopener"><span class="video-play" aria-hidden="true">▶</span><span><b>Watch the guide</b><small>Opens in your browser</small></span></a>` : '');

function prereqs(s) {
  if (!s.prereqs.length && !s.startNote) return '';
  const done = s.prereqs.filter((p) => p.done).length;
  const chips = s.prereqs.map((p) => `<button type="button" class="pre-chip${p.done ? ' pre-done' : ''}" data-step="${esc(p.key)}" aria-pressed="${p.done}">${p.done ? '✓ ' : ''}${esc(p.name)}</button>`).join('');
  return `<section class="sec"><div class="sec-h"><b>${s.startNote ? 'Start here' : 'Prerequisites'}</b>${s.prereqs.length ? `<span>${done} / ${s.prereqs.length}</span>` : ''}</div>${chips ? `<div class="pre-chips">${chips}</div>` : ''}${s.startNote ? `<small class="sec-note">${esc(s.startNote)}</small>` : ''}</section>`;
}

// A tap opens the attribute tab of the stats, narrowed to the attributes of this guide.
function attributes(m) {
  const a = m.structure.attributes;
  if (!a) return '';
  const dear = a.open.map((x) => `<span class="attr-open"><b>${esc(x.name)}</b> ${esc(x.cost)}</span>`).join('');
  return `<a class="sec sec-link" href="#/stats/attributes/${esc(m.area ?? 'mining')}" data-attr-guide="${esc(m.id)}"><div class="sec-h"><b>Attributes</b><span>${a.done} / ${a.total} maxed</span></div>${bar(a.total ? a.done / a.total : 0)}${dear}</a>`;
}

const tile = (m, c) => `<a class="tile-cat${c.current ? ' tile-now' : ''}" href="#/guide/${esc(m.id)}/path/${esc(c.id)}"><b>${esc(c.name)}</b><small>${c.locked || c.next.startsWith('Locked') ? '' : c.done === c.total && c.total ? '' : 'Next: '}${esc(c.next)}</small>${bar(c.share)}</a>`;

export const overviewBody = (m) => `${best(m)}${video(m.structure.video)}${prereqs(m.structure)}${attributes(m)}<div class="tiles">${m.structure.categories.map((c) => tile(m, c)).join('')}</div>`;

// The page of one category: ring and name, the note of the guide, then the path of this category.
export function categoryHead(m, page) {
  const arcs = ring({ chapters: [{ share: page.share }], total: page.share, size: 88, label: `${page.name} progress` });
  return `<div class="head"><div class="ring-head">${arcs}<div class="ring-text"><div class="ring-title">${icon(m.theme)}<h1>${esc(page.name)}</h1><b class="head-pct">${pct(page.share)}</b></div><span class="milestone-count">${number(page.done)} of ${number(page.total)} steps · sorted by value</span></div></div>${page.note ? `<p class="cat-note">${esc(page.note)}</p>` : ''}</div>`;
}

export const categoryBody = (page) => `<div class="path">${page.rows.map((row) => (row.card ? stepCard(row.card) : pathRow(row))).join('')}</div>`;

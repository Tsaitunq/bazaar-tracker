// The building blocks of the guide app. Every text, value and unit comes in from the model.
import { esc, number } from '../../../shared/format.js';

const svgIcon = (d, size) => `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">${d}</svg>`;
const ICONS = {
  mining: '<path d="M4 20l9-9M14 4c3 0 6 3 6 6l-3-1-4-4z M13 11l-2-2"/>',
  blaze: '<path d="M12 3c1 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z"/>',
  farming: '<path d="M12 21V10M12 10C12 6 9 4 5 4c0 4 3 6 7 6zM12 13c0-4 3-6 7-6 0 4-3 6-7 6z"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
};
export const icon = (name, size = 18) => (ICONS[name] ? svgIcon(ICONS[name], size) : '');

const percent = (share) => `${Math.round(share * 100)}%`;
// r, stroke, gap, text position and size of the two rings of the mockups
const RINGS = { 88: { r: 36, stroke: 9, gap: 12, textY: 50, font: 18 }, 70: { r: 28, stroke: 7, gap: 10, textY: 40, font: 14 } };

export function ring({ chapters, total, size, label = 'Chapter progress', showTotal = true, marks = [] }) {
  const { r, stroke, gap, textY, font } = RINGS[size];
  const mid = size / 2;
  const C = 2 * Math.PI * r;
  const part = C / chapters.length;
  const L = part - gap;
  const circle = (cls, dash, off) => `<circle class="${cls}" cx="${mid}" cy="${mid}" r="${r}" fill="none" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${dash}" stroke-dashoffset="${off}" transform="rotate(-90 ${mid} ${mid})"></circle>`;
  const arcs = chapters.map((c, i) => {
    const off = (-(i * part) - gap / 2).toFixed(1);
    return circle('arc-track', `${L.toFixed(1)} ${(C - L).toFixed(1)}`, off)
      + circle(`arc-${(i % 3) + 1}`, `${Math.max(0.1, L * c.share).toFixed(1)} ${(C - L * c.share).toFixed(1)}`, off);
  }).join('');
  // a milestone: a small dot on the one arc, light on the track, dark on the filled part
  const dots = marks.map((m) => {
    const angle = ((gap / 2 + m.at * L) / C) * 2 * Math.PI - Math.PI / 2;
    return `<circle class="ring-mark${m.done ? ' ring-mark-done' : ''}" cx="${(mid + r * Math.cos(angle)).toFixed(1)}" cy="${(mid + r * Math.sin(angle)).toFixed(1)}" r="${(stroke * 0.28).toFixed(1)}"></circle>`;
  }).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(label)}">${arcs}${dots}${showTotal ? `<text class="ring-pct" x="${mid}" y="${textY}" text-anchor="middle" font-size="${font}">${percent(total)}</text>` : ''}</svg>`;
}

// The line of a ranked guide under its ring.
export const nextMilestone = (ms) => (ms.next ? `Next milestone: ${ms.next.name} · ${number(ms.next.steps)} ${ms.next.steps === 1 ? 'step' : 'steps'} · ${ms.next.left}` : 'All milestones reached');

export const legend = (chapters) => chapters.map((c, i) => `<div class="legend"><i class="dot-${(i % 3) + 1}"></i><span${c.current ? ' class="legend-now"' : ''}>${esc(c.name)}</span><b>${percent(c.share)}</b></div>${c.leftText ? `<div class="legend-left">${esc(c.leftText)} to chapter end</div>` : ''}`).join('');

export const statGrid = (stats, columns) => `<div class="stats${columns === 3 ? ' stats-3' : ''}">${stats.map((s) => `<div class="stat"><div class="stat-label"><span class="c-${s.color}">${esc(s.icon)}</span> ${esc(s.label)}</div><div class="stat-row"><span class="stat-value c-${s.color}">${esc(s.value)}</span><span class="stat-delta">${esc(s.delta)}</span></div></div>`).join('')}</div>`;

const rail = (status, top, bottom) => `<div class="step-rail"><div class="rail-top${top ? ' rail-on' : ''}"></div><div class="step-dot dot-${status}">${status === 'done' ? '✓' : ''}</div><div class="rail-bottom${bottom ? ' rail-on' : ''}"></div></div>`;
const shown = (cls, text) => (text ? `<span class="${cls}">${esc(text)}</span>` : '');

export function pathRow(row) {
  const key = esc(row.key);
  const state = row.status === 'done' || row.status === 'locked' ? ` row-${row.status}` : '';
  const sub = shown(`row-sub${row.subColor ? ` c-${row.subColor}` : ''}`, row.sub);
  const side = [row.side && esc(row.side), row.progress && esc(row.progress)].filter(Boolean).map((part) => `<span>${part}</span>`).join('');
  return `<div class="step${row.member ? ' step-member' : ''}">${rail(row.status, row.railTop, row.railBottom)}<button type="button" class="row${state}" data-step="${key}" aria-pressed="${row.status === 'done'}"><span class="row-text"><span class="row-name">${esc(row.name)}</span>${sub}${shown('row-sub', row.group)}</span><span class="row-side">${side}</span></button></div>`;
}

// The part of a section name in brackets explains the section; the guide's ⓘ holds it, the card shows the short name.
export const shortSection = (name) => name.replace(/\s*\(.+\)$/, '');

// The card keeps name, stats, cost and Mark done in sight; what the cost is made of folds behind the cost line.
export function stepCard(card) {
  const box = card.stats.length || card.gain
    ? `<div class="card-box">${card.stats.map((s) => `<span class="card-stat c-${s.color}">${esc(s.text)}</span>`).join('')}${shown('card-gain', card.gain)}</div>`
    : '';
  const more = [...(card.items ?? []).map((i) => shown('card-item', i.text)), shown('card-where', card.group), ...(card.notes ?? []).map((n) => shown('card-where', n)), shown('card-where', card.hint), card.left ? `<span class="card-where">${esc(card.left)} to section end</span>` : ''].filter(Boolean);
  const cost = `<span class="card-cost">${esc(card.cost)}</span>${shown('card-rate', card.rate)}`;
  // one line takes less room than the 44 px of a fold, so it stays open
  const foot = more.length > 1
    ? `<details class="card-more" data-keep-open="${esc(card.key)}"><summary class="card-foot">${cost}<span class="card-fold" aria-hidden="true">▾</span></summary>${more.join('')}</details>`
    : `<div class="card-foot">${cost}</div>${more.join('')}`;
  return `<div class="step">${rail('current', card.railTop, card.railBottom)}<div class="card"><div class="card-head"><span class="card-name">${esc(card.name)}</span>${card.badge ? '<span class="card-badge">★ BEST VALUE</span>' : ''}${shown('card-where', card.where && shortSection(card.where))}</div>${box}${foot}<button type="button" class="primary" data-step="${esc(card.key)}">Mark done</button></div></div>`;
}

const limitValue = (v) => (v === null ? 'unknown' : number(v));

// A missed limit stays in its chip: the value turns red and gets a mark, so colour is not the only sign.
const missed = (v) => `<span class="c-red">${number(v)} ✗</span>`;

export function chips(limits) {
  const { trueDefense: td, mp } = limits;
  const defense = limits.lowTrueDefense ? missed(td) : td === null ? limitValue(td) : `<span class="c-gain">${number(td)} ✓</span>`;
  const power = limits.lowMp ? `${missed(mp)} / ${number(limits.minMp)}` : `${limitValue(mp)} / ${number(limits.targetMp)}`;
  return `<div class="chips"><div class="chip${limits.lowTrueDefense ? ' chip-low' : ''}"><span class="c-white">❂ True Def ≥ ${number(limits.minTrueDefense)}</span><span class="chip-value">${defense}</span></div><div class="chip${limits.lowMp ? ' chip-low' : ''}"><span class="c-cyan">✦ Power</span><span class="chip-value">${power}</span></div></div>`;
}

export const bottomBar = (tabs, active) => `<nav class="bar">${tabs.map((t) => `<button type="button" data-tab="${esc(t.id)}"${t.id === active ? ' aria-current="page"' : ''}>${esc(t.label)}</button>`).join('')}</nav>`;

export const profileLink = () => `<a class="profile" href="#/stats" aria-label="Your stats">${icon('profile', 22)}</a>`;

export const backLink = () => `<a class="back" href="#/"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>Guides</a>`;

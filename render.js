import { lineChart } from './chart.js';
import { marginSeries } from './history.js';
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
export const compact = new Intl.NumberFormat('de-DE', { notation: 'compact', maximumFractionDigits: 1 });
export const percent = new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 1 });

export const ICON_BASE = 'https://sky.coflnet.com/static/icon/';
export const iconUrl = (id) => ICON_BASE + encodeURIComponent(id);
export const itemHref = (id) => '#/item/' + encodeURIComponent(id);

export const PLACEHOLDER_ICON = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x="3" y="3" width="26" height="26" rx="6" fill="#2a2f3a"/></svg>');

export const icon = (id, size = 32) =>
  `<img class="icon" src="${esc(iconUrl(id))}" width="${size}" height="${size}" alt="" loading="lazy" decoding="async" crossorigin="anonymous">`;

export function scoreBadge(score) {
  if (score == null) return '';
  const [cls, label] = score >= 70 ? ['good', 'stabil'] : score >= 40 ? ['mid', 'mittel'] : ['bad', 'instabil'];
  return `<span class="badge badge-${cls}">${label} ${Math.round(score)}</span>`;
}

const cell = (label, value, cls = '') => `<div><dt>${label}</dt><dd${cls ? ` class="${cls}"` : ''}>${value}</dd></div>`;
const gain = (v) => (v > 0 ? 'gain' : 'loss');
const num = (v) => compact.format(v);

const card = (f, isFav, warn, cells, extra = '') => `<li class="card">
  <button class="star" type="button" data-id="${esc(f.id)}" aria-pressed="${isFav}" aria-label="Favorit: ${esc(f.name)}">★</button>
  <a class="body" href="${esc(itemHref(f.id))}">
    <div class="name">${icon(f.id)}<span>${esc(f.name)}${warn ? ' <span class="warn">⚠ verdächtig</span>' : ''} ${scoreBadge(f.score)}</span></div>
    <dl>${cells.join('')}</dl>${extra}
  </a>
</li>`;

export const flipCard = (f, isFav) => card(f, isFav, f.suspicious, [
  cell('Buy-Order', num(f.buy)),
  cell('Sell-Offer', num(f.sell)),
  cell('Vol./Woche', num(f.weekVol)),
  cell('Gewinn/Stück', num(f.profit), gain(f.profit)),
  cell('Marge', percent.format(f.margin)),
  cell('Gewinn/h', num(f.profitHour), gain(f.profit)),
]);

export const npcCard = (f, isFav) => card(f, isFav, false, [
  cell('Buy-Order', num(f.buy)),
  cell('NPC-Preis', num(f.npc)),
  cell('Vol./Woche', num(f.weekVol)),
  cell('Gewinn/Stück', num(f.profit), gain(f.profit)),
  cell('Gewinn Sofortkauf', num(f.profitInstant), gain(f.profitInstant)),
  cell('Gewinn/h', num(f.profitHour), gain(f.profit)),
]);

export const craftCard = (f, isFav) => card(f, isFav, false, [
  cell('Kosten', num(f.cost)),
  cell('Erlös', num(f.revenue)),
  cell('Marge', percent.format(f.margin)),
  cell('Gewinn/Craft', num(f.profit), gain(f.profit)),
  cell('Crafts/h', num(f.craftsHour)),
  cell('Gewinn/h', num(f.profitHour), gain(f.profit)),
], `<ul class="ingredients">${f.ingredients.map((i) => `<li>${num(i.qty)}× ${esc(i.name)} à ${num(i.price)}</li>`).join('')}</ul>`);

export function parseRoute(hash) {
  const [, view, arg] = /^#\/([^/]*)(?:\/(.*))?$/.exec(hash) ?? [];
  if (view === 'item' && arg) {
    try { return { view, id: decodeURIComponent(arg) }; } catch {}
  }
  return { view: view === 'npc' || view === 'craft' ? view : 'flips' };
}

const RANGES = [['24h', '24 Std.'], ['7d', '7 Tage']];

export function detailView({ id, name, flip, score, back = 'flips', isFav, range, points, tax }) {
  const stat = (label, value) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;
  const current = flip ? `<dl>${stat('Buy-Order', num(flip.buy))}${stat('Sell-Offer', num(flip.sell))}${stat('Marge', percent.format(flip.margin))}${stat('Gewinn/Stück', num(flip.profit))}${stat('Vol./Woche', num(flip.weekVol))}${stat('Gewinn/h', num(flip.profitHour))}</dl>` : '';
  const buttons = RANGES.map(([r, label]) => `<button type="button" data-range="${r}" aria-pressed="${r === range}">${label}</button>`).join('');
  const charts = points === null ? '<p class="muted">Lade Verlauf…</p>'
    : !points.length ? '<p class="muted">Noch kein Verlauf vorhanden</p>'
    : `<h3>Preise</h3><p class="legend"><span class="buy">Buy-Order</span> <span class="sell">Sell-Offer</span></p>${lineChart([
      { color: 'var(--gold)', points: points.map(([t, b]) => [t, b]) },
      { color: 'var(--green)', points: points.map(([t, , s]) => [t, s]) },
    ], { format: num })}<h3>Marge</h3>${lineChart([{ color: 'var(--text)', points: marginSeries(points, tax) }], { format: (v) => percent.format(v) })}`;
  return `<a class="back" href="#/${back}">← Zurück</a>
<div class="detail-head"><button class="star" type="button" data-id="${esc(id)}" aria-pressed="${isFav}" aria-label="Favorit: ${esc(name)}">★</button>
${icon(id, 48)}<h2 class="name">${esc(name)} ${scoreBadge(score)}</h2></div>
${current}<div class="bar ranges">${buttons}</div>${charts}`;
}

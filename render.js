import { lineChart } from './chart.js';
import { marginSeries } from './history.js';
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const plain = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const UNITS = [[1e9, 'B'], [1e6, 'M'], [1e3, 'k']];
// Hypixel style: 1,234.5 below ten thousand, then 350k, 1.2M, 3.4B
export function coins(v) {
  if (!Number.isFinite(v)) return '–';
  if (Math.abs(v) < 9999.95) return plain.format(v);
  // 0.99995: a value that rounds up to 1000 of a unit moves to the next unit (999,950 is 1M, not 1000k)
  const [div, unit] = UNITS.find(([d]) => Math.abs(v) >= d * 0.99995) ?? UNITS[2];
  return plain.format(v / div) + unit;
}
export const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 });

export const ICON_BASE = 'https://sky.coflnet.com/static/icon/';
export const iconUrl = (id) => ICON_BASE + encodeURIComponent(id);
export const itemHref = (id) => '#/item/' + encodeURIComponent(id);

export const PLACEHOLDER_ICON = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x="3" y="3" width="26" height="26" rx="6" fill="#2a2f3a"/></svg>');

export const icon = (id, size = 32) =>
  `<img class="icon" src="${esc(iconUrl(id))}" width="${size}" height="${size}" alt="" loading="lazy" decoding="async" crossorigin="anonymous">`;

export function scoreBadge(score) {
  if (score == null) return '';
  const [cls, label] = score >= 70 ? ['good', 'stable'] : score >= 40 ? ['mid', 'medium'] : ['bad', 'unstable'];
  return `<span class="badge badge-${cls}">${label} ${Math.round(score)}</span>`;
}

const cell = (label, value, cls = '') => `<div><dt>${label}</dt><dd${cls ? ` class="${cls}"` : ''}>${value}</dd></div>`;
const gain = (v) => (v > 0 ? 'gain' : 'loss');
const num = coins;

const card = (f, isFav, warn, cells, extra = '') => `<li class="card">
  <button class="star" type="button" data-id="${esc(f.id)}" aria-pressed="${isFav}" aria-label="Favorite: ${esc(f.name)}">★</button>
  <a class="body" href="${esc(itemHref(f.id))}">
    <div class="name">${icon(f.id)}<span>${esc(f.name)}${warn ? ' <span class="warn">⚠ suspicious</span>' : ''} ${scoreBadge(f.score)}</span></div>
    <dl>${cells.join('')}</dl>${extra}
  </a>
</li>`;

export const flipCard = (f, isFav) => card(f, isFav, f.suspicious, [
  cell('Buy order', num(f.buy)),
  cell('Sell offer', num(f.sell)),
  cell('Vol./week', num(f.weekVol)),
  cell('Profit/item', num(f.profit), gain(f.profit)),
  cell('Margin', percent.format(f.margin)),
  cell('Profit/h', num(f.profitHour), gain(f.profit)),
]);

export const npcCard = (f, isFav) => card(f, isFav, false, [
  cell('Buy order', num(f.buy)),
  cell('NPC price', num(f.npc)),
  cell('Vol./week', num(f.weekVol)),
  cell('Profit/item', num(f.profit), gain(f.profit)),
  cell('Profit (instant buy)', num(f.profitInstant), gain(f.profitInstant)),
  cell('Profit/h', num(f.profitHour), gain(f.profit)),
]);

export const craftCard = (f, isFav) => card(f, isFav, false, [
  cell('Cost', num(f.cost)),
  cell('Revenue', num(f.revenue)),
  cell('Margin', percent.format(f.margin)),
  cell('Profit/craft', num(f.profit), gain(f.profit)),
  cell('Crafts/h', num(f.craftsHour)),
  cell('Profit/h', num(f.profitHour), gain(f.profit)),
], `<ul class="ingredients">${f.ingredients.map((i) => `<li>${num(i.qty)}× ${esc(i.name)} @ ${num(i.price)}</li>`).join('')}</ul>`);

export function parseRoute(hash) {
  const [, view, arg] = /^#\/([^/]*)(?:\/(.*))?$/.exec(hash) ?? [];
  if (view === 'item' && arg) {
    try { return { view, id: decodeURIComponent(arg) }; } catch {}
  }
  return { view: ['npc', 'craft', 'opps'].includes(view) ? view : 'flips' };
}

const RANGES = [['24h', '24 h'], ['7d', '7 days']];

export function detailView({ id, name, flip, score, back = 'flips', isFav, range, points, tax }) {
  const stat = (label, value) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;
  const current = flip ? `<dl>${stat('Buy order', num(flip.buy))}${stat('Sell offer', num(flip.sell))}${stat('Margin', percent.format(flip.margin))}${stat('Profit/item', num(flip.profit))}${stat('Vol./week', num(flip.weekVol))}${stat('Profit/h', num(flip.profitHour))}</dl>` : '';
  const buttons = RANGES.map(([r, label]) => `<button type="button" data-range="${r}" aria-pressed="${r === range}">${label}</button>`).join('');
  const charts = points === null ? '<p class="muted">Loading history…</p>'
    : !points.length ? '<p class="muted">No history yet</p>'
    : `<h3>Prices</h3><p class="legend"><span class="buy">Buy order</span> <span class="sell">Sell offer</span></p>${lineChart([
      { color: 'var(--gold)', points: points.map(([t, b]) => [t, b]) },
      { color: 'var(--green)', points: points.map(([t, , s]) => [t, s]) },
    ], { format: num })}<h3>Margin</h3>${lineChart([{ color: 'var(--text)', points: marginSeries(points, tax) }], { format: (v) => percent.format(v) })}`;
  return `<a class="back" href="#/${back}">← Back</a>
<div class="detail-head"><button class="star" type="button" data-id="${esc(id)}" aria-pressed="${isFav}" aria-label="Favorite: ${esc(name)}">★</button>
${icon(id, 48)}<h2 class="name">${esc(name)} ${scoreBadge(score)}</h2></div>
${current}<div class="bar ranges">${buttons}</div>${charts}`;
}

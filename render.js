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
  cell('Gewinn/h', num(f.profitHour), gain(f.profitHour)),
]);

export const craftCard = (f, isFav) => card(f, isFav, false, [
  cell('Kosten', num(f.cost)),
  cell('Erlös', num(f.revenue)),
  cell('Marge', percent.format(f.margin)),
  cell('Gewinn/Craft', num(f.profit), gain(f.profit)),
  cell('Crafts/h', num(f.craftsHour)),
  cell('Gewinn/h', num(f.profitHour), gain(f.profitHour)),
], `<ul class="ingredients">${f.ingredients.map((i) => `<li>${num(i.qty)}× ${esc(i.name)} à ${num(i.price)}</li>`).join('')}</ul>`);

export function parseRoute(hash) {
  const [, view, arg] = /^#\/([^/]*)(?:\/(.*))?$/.exec(hash) ?? [];
  if (view === 'item' && arg) {
    try { return { view, id: decodeURIComponent(arg) }; } catch {}
  }
  return { view: view === 'npc' || view === 'craft' ? view : 'flips' };
}

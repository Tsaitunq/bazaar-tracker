import { lineChart } from './chart.js';
import { marginSeries } from './history.js';
import { direction } from './trends.js';
import { skyDate, MONTHS, PERK_ITEMS, DAY_MS } from './events.js';

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const plain = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const UNITS = [[1e9, 'B'], [1e6, 'M'], [1e3, 'k']];
// Hypixel style: 1,234.5 below ten thousand, then 350k, 1.2M, 3.4B
export function coins(v) {
  if (!Number.isFinite(v)) return '–';
  if (Math.abs(v) < 9999.95) return plain.format(v || 0); // || 0: no "-0" for a loss on zero units
  // 0.99995: a value that rounds up to 1000 of a unit moves to the next unit (999,950 is 1M, not 1000k)
  const [div, unit] = UNITS.find(([d]) => Math.abs(v) >= d * 0.99995) ?? UNITS[2];
  return plain.format(v / div) + unit;
}
export const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 });

export const ICON_BASE = 'https://sky.coflnet.com/static/icon/';
export const iconUrl = (id) => ICON_BASE + encodeURIComponent(id);
export const itemHref = (id) => '#/item/' + encodeURIComponent(id);

export const PLACEHOLDER_ICON = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x="3" y="3" width="26" height="26" rx="6" fill="#2e2e2e"/></svg>');

export const icon = (id, size = 32) =>
  `<img class="icon" src="${esc(iconUrl(id))}" width="${size}" height="${size}" alt="" loading="lazy" decoding="async" crossorigin="anonymous">`;

// Hypixel rarities; anything else (or none) counts as common
const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'divine', 'special', 'very_special'];
export const rarity = (tier) => (RARITIES.includes(tier) ? tier : 'common');
// the item picture on a small tile that can carry the rarity colour
const tile = (id, size) => `<span class="tile">${icon(id, size)}</span>`;

// Line icons drawn for this app; index.html carries the same shapes for the static buttons.
const svg = (body) => `<svg class="ico" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const ICONS = {
  star: svg('<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8L3.5 9.7l5.9-.9z"/>'),
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  warn: svg('<path d="M12 4l9 16H3z"/><path d="M12 10v4.5M12 17.4v.1"/>'),
  rising: svg('<path d="M6 18L18 6M10 6h8v8"/>'),
  falling: svg('<path d="M6 6l12 12M18 10v8h-8"/>'),
  flat: svg('<path d="M4 12h16M14 6l6 6-6 6"/>'),
  event: svg('<rect x="4" y="6" width="16" height="14" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>'),
};

export function scoreBadge(score, provisional = false) {
  if (provisional) return '<span class="badge badge-prov">provisional</span>';
  if (score == null) return '';
  const [cls, label] = score >= 70 ? ['good', 'stable'] : score >= 40 ? ['mid', 'medium'] : ['bad', 'unstable'];
  return `<span class="badge badge-${cls}">${label} ${Math.round(score)}</span>`;
}

const gain = (v) => (v > 0 ? 'gain' : 'loss');
const num = coins;
const star = (id, name, isFav) =>
  `<button class="star" type="button" data-id="${esc(id)}" aria-pressed="${isFav}" aria-label="Favorite: ${esc(name)}">${ICONS.star}</button>`;
// trend: change of the sell price per 24 hours (see trends.js); level: 'below' or 'above' its normal price
const LEVELS = { below: 'below normal', above: 'above normal' };
export function trendBadge(trend, level) {
  const dir = direction(trend);
  const text = [dir, LEVELS[level]].filter(Boolean).join(' · ');
  return text && `<span class="badge badge-trend">${dir ? ICONS[dir] : ''}${text}</span>`;
}
// f.ah: sold on the auction house; f.event: name of an event or mayor perk the item belongs to
const badges = (f, warn) => {
  const html = (warn ? `<span class="badge badge-warn">${ICONS.warn}suspicious</span>` : '')
    + (f.ah ? '<span class="badge badge-warn">AH sale – estimate</span>' : '')
    + scoreBadge(f.score, f.provisional) + trendBadge(f.trend, f.level)
    + (f.event ? `<span class="badge badge-event">${ICONS.event}${esc(f.event)}</span>` : '');
  return html && `<div class="badges">${html}</div>`;
};
// the two numbers a flip is judged by
const keyStats = (f, label = 'Profit/h') => `<div class="key">
      <div><span class="big ${gain(f.profit)}">${num(f.profitHour)}</span><span class="lbl">${label}</span></div>
      <div><span class="big">${percent.format(f.margin)}</span><span class="lbl">Margin</span></div>
    </div>`;
const fact = (label, value, cls = '') => `<div><dt>${label}</dt><dd${cls ? ` class="${cls}"` : ''}>${value}</dd></div>`;
// sell price with its 7 day median next to it, so an unusual price stands out
const sellFact = (f) => fact('Sell offer', num(f.sell) + (f.median > 0 ? ` <span class="normal">normal: ${num(f.median)}</span>` : ''));

const card = (f, isFav, warn, facts, extra = '', label) => `<li class="card" data-rarity="${rarity(f.tier)}">
  ${star(f.id, f.name, isFav)}
  <a class="body" href="${esc(itemHref(f.id))}">
    <div class="name">${tile(f.id, 32)}<span>${esc(f.name)}</span></div>
    ${badges(f, warn)}${f.why?.length ? `
    <p class="why">${esc(f.why.join(' · '))}</p>` : ''}
    ${facts.length ? `${keyStats(f, label)}
    <dl class="facts">${facts.join('')}</dl>` : ''}${extra}
  </a>
</li>`;

export const flipCard = (f, isFav) => card(f, isFav, f.suspicious, [
  fact('Buy order', num(f.buy)),
  sellFact(f),
  fact('Profit/item', num(f.profit), gain(f.profit)),
  fact('Vol./week', num(f.weekVol)),
]);

// a search hit the current list does not hold; without prices only the name and the reason are left
export const searchCard = (f, isFav) => (f.buy ? flipCard(f, isFav) : card(f, isFav, false, []));

export const npcCard = (f, isFav) => card(f, isFav, false, [
  fact('Buy order', num(f.buy)),
  fact('NPC price', num(f.npc)),
  fact('Profit/item', num(f.profit), gain(f.profit)),
  fact('Profit (instant buy)', num(f.profitInstant), gain(f.profitInstant)),
  fact('Vol./week', num(f.weekVol)),
]);

const ingredientList = (f) => `<ul class="ingredients">${f.ingredients.map((i) => `<li>${num(i.qty)}× ${esc(i.name)} @ ${num(i.price)}</li>`).join('')}${
  f.coins ? `<li>${num(f.coins)} coins</li>` : ''}</ul>`;

export const craftCard = (f, isFav) => card(f, isFav, false, [
  fact('Cost', num(f.cost)),
  fact('Revenue', num(f.revenue)),
  fact('Profit/craft', num(f.profit), gain(f.profit)),
  fact('Crafts/h', num(f.craftsHour)),
], ingredientList(f));

// 21600 -> "6h", 5400 -> "1h 30m": the two largest units are enough for a forge time
export function duration(seconds) {
  let rest = Math.round(seconds);
  const parts = [];
  for (const [size, unit] of [[86400, 'd'], [3600, 'h'], [60, 'm'], [1, 's']]) {
    const n = Math.floor(rest / size);
    rest -= n * size;
    if (n) parts.push(n + unit);
  }
  return parts.slice(0, 2).join(' ') || '0s';
}

const AH_HINT = 'Sells on the Auction House: slower and less certain than the Bazaar. The price is the lowest BIN right now.';
export const forgeCard = (f, isFav) => card(f.ah ? { ...f, why: [AH_HINT] } : f, isFav, false, [
  fact('Cost', num(f.cost)),
  fact(f.ah ? 'Lowest BIN' : 'Sell offer', num(f.sell)),
  fact('Profit/item', num(f.profit), gain(f.profit)),
  fact('Duration', duration(f.seconds)),
  fact('HotM tier', f.hotm || '–'),
], ingredientList(f), 'Profit/forge hour');

// the switch above the Forge list
export const forgeFilter = (withAh) => `<div class="bar ranges forge-filter" role="group" aria-label="Forge results">
  <button type="button" data-forge-ah="0" aria-pressed="${!withAh}">Bazaar only</button>
  <button type="button" data-forge-ah="1" aria-pressed="${!!withAh}">Incl. AH</button>
</div>`;

// The plan at the top of the Opportunities tab: total first, then what it is made of.
// plan comes from portfolio() with a name on every flip; sharePercent is the market share setting.
export function portfolioView(plan, { capital, slots, sharePercent }) {
  const hint = `<p class="assume">Assumes ${num(sharePercent)}% market share – only realistic if you relist actively</p>`;
  if (!plan.flips.length) {
    return `<section class="portfolio"><h2>Portfolio</h2><p class="muted">${capital > 0
      ? 'No flip qualifies for the portfolio right now. It uses the same conditions as the list below.'
      : 'Set a total capital in the settings to get a plan.'}</p></section>`;
  }
  const rows = plan.flips.map((f) => `<li><a href="${esc(itemHref(f.id))}"><span class="pick">${esc(f.name)}</span><span class="stake">${num(f.stake)}</span><span class="gain">${num(f.profitHour)}/h</span></a></li>`).join('');
  return `<section class="portfolio">
  <h2>Portfolio</h2>
  <div class="total"><span class="big gain">${num(plan.profitHour)}</span><span class="lbl">Profit/h with ${plan.flips.length} ${plan.flips.length === 1 ? 'flip' : 'flips'}</span></div>
  <p class="muted">${num(plan.used)} of ${num(capital)} capital in use · up to ${num(plan.budget)} per flip · ${Math.floor(slots)} planned</p>
  <div class="picks-head"><span>Item</span><span>Stake</span><span>Profit/h</span></div>
  <ol class="picks">${rows}</ol>
  ${hint}
</section>`;
}

// The mayor and event radar above every list. Folded it is one line; unfolded it lists the mayor's
// perks, the election and the events, each of which unfolds to its details.
// perks: activePerks(); events: upcoming(); vote: electionWindow(); name(id): an item's name;
// open: keys of the parts that are unfolded.
export function radarView({ election, perks, events, vote, now, name, open = new Set() }) {
  const until = (t) => duration(Math.ceil(Math.max(0, t - now) / 60000) * 60);
  const affected = (ids) => (ids?.length
    ? `<p class="affected"><span class="muted">Typically affected:</span> ${ids.map((id) => `<a href="${esc(itemHref(id))}">${esc(name(id))}</a>`).join(', ')}</p>` : '');
  const row = (key, title, side, body) => `<li><details data-key="${esc(key)}"${open.has(key) ? ' open' : ''}>
    <summary><span>${esc(title)}</span> <span class="side">${esc(side)}</span></summary>${body}</details></li>`;
  const day = (t) => { const d = skyDate(t); return `${MONTHS[d.month]} ${d.day}`; };

  const running = events.filter((e) => e.active);
  const next = events.find((e) => !e.active);
  const line = [
    election && `Mayor ${election.mayor.name}`,
    running.length === 1 ? `${running[0].name} now` : running.length > 1 && `${running.length} events now`,
    next && `${next.name} in ${until(next.start)}`,
  ].filter(Boolean).join(' · ');

  const mayor = election ? `<p><strong>${esc(election.mayor.name)}</strong>${
    election.mayor.minister ? ` · minister ${esc(election.mayor.minister.name)}` : ''}</p>
  <ul>${perks.map((p) => row(`perk:${p.name}`, p.name, p.by, `<p>${esc(p.text)}</p>${affected(PERK_ITEMS[p.name])}`)).join('')}</ul>`
    : '<p class="muted">Mayor data is not available right now.</p>';

  const total = election?.vote?.candidates.reduce((sum, c) => sum + c.votes, 0);
  const votes = election?.vote ? `<p class="muted">Election for year ${esc(election.vote.year)}${vote.open ? ` · closes in ${until(vote.at)}` : ''}</p>
  <ol class="votes">${[...election.vote.candidates].sort((a, b) => b.votes - a.votes).map((c) =>
    `<li><span>${esc(c.name)}</span> <span class="side">${total > 0 ? percent.format(c.votes / total) : '–'}</span><small>${esc(c.perks.join(', '))}</small></li>`).join('')}</ol>`
    : `<p class="muted">${vote.open ? `The election is open and closes in ${until(vote.at)}.` : `No election right now. The next one opens in ${until(vote.at)}.`}</p>`;

  const list = events.map((e) => row(`event:${e.key}`, e.name, e.active ? `now · ${until(e.end)} left` : `in ${until(e.start)}`,
    `<p class="muted">${e.active ? 'Started' : 'Starts'} on ${day(e.start)} · lasts ${duration((e.end - e.start) / 1000)} (${Math.round((e.end - e.start) / DAY_MS)} SkyBlock days)${
      e.perk ? ` · only with the ${esc(e.perk)} perk` : ''}</p>${affected(e.items)}`)).join('');

  return `<details class="radar" data-key="radar"${open.has('radar') ? ' open' : ''}>
  <summary><span class="radar-title">${ICONS.event}Event radar</span> <span class="radar-line">${esc(line)}</span></summary>
  <h3>Mayor</h3>
  ${mayor}
  <h3>Election</h3>
  ${votes}
  <h3>Events</h3>
  <ul>${list}</ul>
</details>`;
}

export function parseRoute(hash) {
  const [, view, arg] = /^#\/([^/]*)(?:\/(.*))?$/.exec(hash) ?? [];
  if (view === 'item' && arg) {
    try { return { view, id: decodeURIComponent(arg) }; } catch {}
  }
  return { view: TABS.includes(view) ? view : 'flips' };
}

// Tab a horizontal swipe leads to, or null. A swipe to the left opens the tab on the right, like turning a page.
// It has to be long enough and clearly more sideways than up or down, so scrolling the list never switches tabs.
export const TABS = ['flips', 'opps', 'npc', 'craft', 'forge'];
const SWIPE_MIN_PX = 60;
export function swipeTab(view, dx, dy) {
  if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < 2 * Math.abs(dy)) return null;
  return TABS[TABS.indexOf(view) + (dx < 0 ? 1 : -1)] ?? null;
}
// How far the page follows the finger: fully towards a tab that exists, only a little at either end.
export const dragOffset = (view, dx) => (TABS[TABS.indexOf(view) + (dx < 0 ? 1 : -1)] ? dx : dx * 0.25);

const RANGES = [['24h', '24 h'], ['7d', '7 days']];

// flip is the item's bazaar flip or null while prices are unknown; points are already cut to the range.
export function detailView({ id, name, tier, flip, score, median, provisional, trend, level, event, back = 'flips', isFav, range, points, tax }) {
  const stat = { score, provisional, median, trend, level, event };
  const current = flip ? `<div class="summary">${keyStats(flip)}<dl class="facts">${[
    fact('Buy order', num(flip.buy)),
    sellFact({ ...flip, median }),
    fact('Profit/item', num(flip.profit), gain(flip.profit)),
    fact('Vol./week', num(flip.weekVol)),
  ].join('')}</dl></div>` : '';
  const buttons = RANGES.map(([r, label]) => `<button type="button" data-range="${r}" aria-pressed="${r === range}">${label}</button>`).join('');
  const charts = points === null ? '<p class="muted">Loading history…</p>'
    : !points.length ? '<p class="muted">No history yet</p>'
    : `<div class="charts"><section><h3>Prices</h3><p class="legend"><span class="buy">Buy order</span> <span class="sell">Sell offer</span></p>${lineChart([
      { label: 'Buy order', cls: 'line-a', points: points.map(([t, b]) => [t, b]) },
      { label: 'Sell offer', cls: 'line-b', points: points.map(([t, , s]) => [t, s]) },
    ], { format: num, kind: 'coins' })}</section><section><h3>Margin</h3><p class="legend"><span class="buy">Margin after tax</span></p>${lineChart(
      [{ label: 'Margin', cls: 'line-a', points: marginSeries(points, tax) }], { format: (v) => percent.format(v), kind: 'percent' })}</section></div>`;
  return `<a class="back" href="#/${back}">${ICONS.back}Back</a>
<div class="detail-head" data-rarity="${rarity(tier)}">${star(id, name, isFav)}
${tile(id, 48)}<h2 class="name">${esc(name)}</h2></div>
${badges(stat, flip?.suspicious)}
${current}<div class="bar ranges">${buttons}</div>${charts}`;
}

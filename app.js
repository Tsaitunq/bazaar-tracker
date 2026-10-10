import { buildFlips, computeFlip, opportunities, portfolio, statOf, searchFlip, flipIssues, oppIssues, bySort } from './flips.js';
import { npcFlips } from './npc.js';
import { craftFlips } from './craft.js';
import { forgeFlips } from './forge.js';
import { loadItems, fallbackName } from './names.js';
import { loadStats, loadRecipes, loadForge, loadAh, loadElection, loadHistory } from './data.js';
import { plugin, syncAlerts, syncNames, onRoute, requestAlertPermission } from './native.js';
import { flipCard, npcCard, craftCard, forgeCard, forgeFilter, searchCard, radarView, parseRoute, detailView, portfolioView, swipeTab, dragOffset, TABS, coins, percent, PLACEHOLDER_ICON } from './render.js';
import { chartHit, when } from './chart.js';
import { level } from './trends.js';
import { activePerks, upcoming, electionWindow, eventItems } from './events.js';
import { initOnboarding } from './tour.js';

const API = 'https://api.hypixel.net/v2/skyblock/bazaar';
const MAX_ROWS = 100;
const PULL_PX = 70;
const STATS_TTL = 20 * 60000;
const CARDS = { flips: flipCard, opps: flipCard, npc: npcCard, craft: craftCard, forge: forgeCard };
const DEFAULTS = { tax: 1.25, minVolume: 100000, maxCapital: 5000000, interval: 2, share: 5, sort: 'profitHour', favOnly: false, alerts: false, alertMargin: 5,
  marketAlerts: false, marketMargin: 10, marketMinVolume: 100000, marketMinProfit: 100000, marketCooldown: 6,
  portfolioCapital: 50000000, portfolioSlots: 10, hotm: 10, forgeAh: true };

const $ = (id) => document.getElementById(id);
const load = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };

const settings = { ...DEFAULTS, ...load('bt.settings', {}) };
// A stored interval of 0 would refresh in a tight loop, so bad values fall back to defaults.
function sanitize() {
  for (const key of ['tax', 'interval', 'sort']) {
    if (![...$(key).options].some((o) => o.value === String(settings[key]))) settings[key] = DEFAULTS[key];
  }
  for (const key of ['minVolume', 'maxCapital', 'marketMinVolume', 'marketMinProfit', 'portfolioCapital']) {
    if (!(settings[key] >= 0)) settings[key] = DEFAULTS[key];
  }
  if (!(settings.share > 0 && settings.share <= 100)) settings.share = DEFAULTS.share;
  if (!(settings.alertMargin > 0 && settings.alertMargin <= 1000)) settings.alertMargin = DEFAULTS.alertMargin;
  settings.alerts = settings.alerts === true;
  if (!(settings.marketMargin > 0 && settings.marketMargin <= 1000)) settings.marketMargin = DEFAULTS.marketMargin;
  if (!(settings.marketCooldown > 0 && settings.marketCooldown <= 168)) settings.marketCooldown = DEFAULTS.marketCooldown;
  settings.marketAlerts = settings.marketAlerts === true;
  settings.portfolioSlots = Math.floor(settings.portfolioSlots);
  if (!(settings.portfolioSlots >= 1 && settings.portfolioSlots <= 50)) settings.portfolioSlots = DEFAULTS.portfolioSlots;
  settings.hotm = Math.floor(settings.hotm);
  if (!(settings.hotm >= 0 && settings.hotm <= 10)) settings.hotm = DEFAULTS.hotm;
  settings.forgeAh = settings.forgeAh !== false;
}
sanitize();
const storedFavs = load('bt.favs', []);
const favs = new Set(Array.isArray(storedFavs) ? storedFavs : []);

let products = null;
let names = {};
let npc = {};
let tiers = {}; // rarity per item id
let stats = null; // score, median and hours of history per item; null until loaded
let recipes;
let forge;   // forge recipes; undefined while loading, null when there are none
let ah = {}; // lowest BIN of forge results that are not on the bazaar
let election = null; // mayor, perks and a running election; null when unknown
let marked = {};     // item id -> event or perk it belongs to right now
let lastStats = 0;
let route = parseRoute(location.hash);
let lastList = route.view === 'item' ? 'flips' : route.view; // where the detail page's back link goes
let flips = [];
let plan = null; // portfolio for the Opportunities tab
let lastFetch = 0;
let timer;
let busy = false;
let hist = { id: null, points: null }; // 7 days of history for the open item, loaded once
let range = '24h';
let markReady; // resolved once the first list is on screen, so the tour has something to point at
const ready = new Promise((resolve) => { markReady = resolve; });
const shown = new Map(); // last rendered big numbers per view and item, to flash the ones that changed

const view = () => (route.view === 'item' ? 'flips' : route.view);
const nameOf = (id) => names[id] ?? fallbackName(id);
// "Trend" only reorders what is shown: the lists are built in their usual order and sorted afterwards
const baseOpts = () => ({ ...settings, tax: settings.tax / 100, share: settings.share / 100, stats, sort: settings.sort === 'trend' ? 'profitHour' : settings.sort });
// What a row shows besides its numbers: name, rarity and the trend signals.
function decorate(f) {
  f.name = nameOf(f.id);
  f.tier = tiers[f.id];
  f.trend = stats?.[f.id]?.[3] ?? null;
  f.level = level(f.sell, statOf(stats, f.id).median);
  f.event = marked[f.id];
  return f;
}
const oppOpts = () => ({ ...baseOpts(), minMargin: settings.marketMargin / 100, minVolume: settings.marketMinVolume, minProfitHour: settings.marketMinProfit });

// The flips of one tab, with names. plan is the portfolio and only exists for the Opportunities tab.
function compute(v) {
  marked = eventItems(Date.now(), election);
  const opts = baseOpts();
  let list;
  let pf = null;
  if (v === 'flips') list = buildFlips(products, { ...opts, favs });
  else if (v === 'opps') {
    const conditions = oppOpts();
    list = opportunities(products, conditions);
    pf = portfolio(products, { ...conditions, capital: settings.portfolioCapital, slots: settings.portfolioSlots });
  }
  else if (v === 'npc') list = npcFlips(products, npc, opts);
  else if (v === 'forge') list = forge ? forgeFlips(products, forge, ah, opts) : [];
  else list = recipes ? craftFlips(products, recipes, opts) : [];
  for (const f of pf?.flips ?? []) f.name = nameOf(f.id);
  for (const f of list) {
    decorate(f);
    for (const i of f.ingredients ?? []) i.name = nameOf(i.id);
  }
  if (settings.sort === 'trend') list.sort(bySort('trend'));
  return { list, plan: pf };
}

// Search hits the tab's list does not hold: every other bazaar item with a matching name, each with
// the reason it is missing. The search always covers the whole bazaar, whatever the filters say.
const NOT_HERE = { npc: 'No NPC flip right now', craft: 'No craft flip right now', forge: 'No forge flip right now' };
function searchRest(v, q, listed) {
  const opts = v === 'opps' ? oppOpts() : baseOpts();
  const issues = v === 'opps' ? oppIssues : v === 'flips' ? flipIssues : () => [NOT_HERE[v]];
  return Object.keys(products)
    .filter((id) => !listed.has(id) && nameOf(id).toLowerCase().includes(q))
    .map((id) => decorate(searchFlip(id, products[id], opts, issues)))
    .sort(bySort(settings.sort));
}

function recompute() {
  if (!products || route.view === 'item') return;
  ({ list: flips, plan } = compute(view()));
}

// The three pieces of a list view as HTML: what stands above the list (portfolio or the forge switch),
// the "x of y" line and the cards.
function listMarkup(v, list, pf) {
  const q = $('search').value.trim().toLowerCase();
  if (!q && ((v === 'craft' && recipes === null) || (v === 'forge' && forge === null))) {
    return { portfolio: '', count: '', list: '<li class="muted">No recipe data yet. The snapshot workflow has to run once.</li>' };
  }
  // a search ignores the favorites switch too: it has to find every item
  const rows = list.filter((f) => (q || !settings.favOnly || favs.has(f.id)) && f.name.toLowerCase().includes(q));
  const rest = q ? searchRest(v, q, new Set(rows.map((f) => f.id))) : [];
  let cards = [...rows.map((f) => [CARDS[v], f]), ...rest.map((f) => [searchCard, f])]
    .slice(0, MAX_ROWS).map(([card, f]) => card(f, favs.has(f.id))).join('');
  if (v === 'opps' && !list.length && !q) {
    cards = `<li class="muted">${stats
      ? 'No item meets all conditions right now. Items need 24 hours of price history before they can show up here.'
      : 'Price history could not be loaded, so stability cannot be checked right now.'}</li>`;
  }
  if (v === 'forge' && forge && !list.length && !q) {
    cards = '<li class="muted">No forge recipe makes a profit with these settings.</li>';
  }
  return {
    portfolio: v === 'opps' && pf
      ? portfolioView(pf, { capital: settings.portfolioCapital, slots: settings.portfolioSlots, sharePercent: settings.share })
      : v === 'forge' ? forgeFilter(settings.forgeAh) : '',
    count: q ? `${rows.length} ${rows.length === 1 ? 'flip' : 'flips'}, ${rest.length} other ${rest.length === 1 ? 'item' : 'items'}`
      : `${Math.min(rows.length, MAX_ROWS)} of ${rows.length} flips`,
    list: cards,
  };
}

// Marks a big number that differs from the last time it was rendered; the stylesheet lets it glow briefly.
function flashChanges() {
  for (const box of document.querySelectorAll('#list .card, #detail')) {
    const id = box.querySelector('.star')?.dataset.id;
    if (!id) continue;
    box.querySelectorAll('.big').forEach((el, i) => {
      const key = `${route.view}:${id}:${i}`;
      if (shown.has(key) && shown.get(key) !== el.textContent) el.classList.add('flash');
      shown.set(key, el.textContent);
    });
  }
}

// The radar is only rebuilt when its content changed, so parts the user unfolded stay open.
let radarShown = '';
function renderRadar() {
  const now = Date.now();
  const data = { election, perks: activePerks(election), events: upcoming(now, election), vote: electionWindow(now), now, name: nameOf };
  const plain = radarView(data);
  if (plain === radarShown) return;
  const box = $('radar');
  const open = new Set([...box.querySelectorAll('details[open]')].map((d) => d.dataset.key));
  if (!radarShown && load('bt.radar', false) === true) open.add('radar');
  radarShown = plain;
  box.innerHTML = radarView({ ...data, open });
}

function renderDetail() {
  const { id } = route;
  marked = eventItems(Date.now(), election);
  if (hist.id !== id) {
    hist = { id, points: null };
    loadHistory(id, 7).then((points) => { if (hist.id === id) { hist.points = points; render(); } });
  }
  const nowMin = Date.now() / 60000;
  const points = hist.points && (range === '24h' ? hist.points.filter(([t]) => t >= nowMin - 1440) : hist.points);
  const stat = statOf(stats, id);
  const flip = products?.[id] ? computeFlip(id, products[id], settings.tax / 100, settings.maxCapital, settings.share / 100, stat.median) : null;
  $('detail').innerHTML = detailView({ ...decorate({ id, sell: flip?.sell }), flip, ...stat, back: lastList, isFav: favs.has(id), range, points, tax: settings.tax / 100 });
  flashChanges();
}

function render() {
  const item = route.view === 'item';
  // cards fade in on a normal render, but not when a swipe has just slid them into place
  document.querySelector('main').classList.toggle('sliding', switching);
  document.body.classList.toggle('detail', item);
  if (item) return renderDetail();
  $('detail').innerHTML = '';
  renderRadar();
  for (const a of document.querySelectorAll('#tabs a')) {
    if (a.getAttribute('href') !== `#/${view()}`) a.removeAttribute('aria-current');
    else if (!a.hasAttribute('aria-current')) {
      a.setAttribute('aria-current', 'page');
      // the tab bar scrolls sideways on a narrow screen: bring the active tab to its middle
      $('tabs').scrollLeft = a.offsetLeft - ($('tabs').clientWidth - a.offsetWidth) / 2;
    }
  }
  if (!products) return;
  const markup = listMarkup(view(), flips, plan);
  $('portfolio').innerHTML = markup.portfolio;
  $('count').textContent = markup.count;
  $('list').innerHTML = markup.list;
  $('list').classList.toggle('opps', view() === 'opps');
  flashChanges();
}

function schedule() {
  clearTimeout(timer);
  if (!document.hidden) timer = setTimeout(refresh, settings.interval * 60000);
}

// Resolves to true when new prices arrived.
async function refresh() {
  if (busy) return false;
  busy = true;
  let ok = false;
  $('refresh').classList.add('busy');
  try {
    const res = await fetch(API, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.cause || 'the API reported an error');
    products = data.products;
    sendNames();
    $('stamp-time').textContent = new Date(data.lastUpdated).toLocaleTimeString('en-GB');
    $('error').hidden = true;
    recompute();
    render();
    markReady();
    if (Date.now() - lastStats > STATS_TTL) refreshStats();
    ok = true;
  } catch (e) {
    $('error').textContent = `Update failed: ${e.message}`;
    $('error').hidden = false;
    if (!products) $('count').textContent = 'No data';
  }
  lastFetch = Date.now();
  busy = false;
  $('refresh').classList.remove('busy');
  schedule();
  return ok;
}

async function refreshStats() {
  lastStats = Date.now();
  [stats, ah, election] = await Promise.all([loadStats(), loadAh(), loadElection()]);
  recompute();
  render();
}

function applySettings() {
  save('bt.settings', settings);
  $('fav-only').setAttribute('aria-pressed', settings.favOnly);
  syncAlerts(settings, favs, names);
  recompute();
  render();
}

for (const key of ['tax', 'interval', 'share', 'sort', 'minVolume', 'maxCapital', 'alertMargin', 'marketMargin', 'marketMinVolume', 'marketMinProfit', 'marketCooldown', 'portfolioCapital', 'portfolioSlots', 'hotm']) {
  $(key).value = settings[key];
  $(key).addEventListener('change', (e) => {
    settings[key] = key === 'sort' ? e.target.value : Math.max(0, Number(e.target.value) || 0);
    sanitize();
    e.target.value = settings[key];
    applySettings();
    if (key === 'interval') schedule();
  });
}
$('settings').addEventListener('submit', (e) => e.preventDefault());
// toggle does not bubble, so listen in the capture phase; only the radar itself is remembered
$('radar').addEventListener('toggle', (e) => { if (e.target.dataset.key === 'radar') save('bt.radar', e.target.open); }, true);
$('search').addEventListener('input', render);
$('refresh').addEventListener('click', refresh);
$('fav-only').addEventListener('click', () => {
  settings.favOnly = !settings.favOnly;
  applySettings();
});
$('toggle-settings').addEventListener('click', (e) => {
  const open = $('settings').hidden;
  $('settings').hidden = !open;
  e.currentTarget.setAttribute('aria-expanded', open);
});
// Image errors do not bubble, so listen in the capture phase.
document.addEventListener('error', (e) => {
  const img = e.target;
  if (img.matches?.('img.icon') && img.src !== PLACEHOLDER_ICON) img.src = PLACEHOLDER_ICON;
}, true);
$('detail').addEventListener('click', (e) => {
  const r = e.target.closest('[data-range]')?.dataset.range;
  if (!r) return;
  range = r;
  render();
});
// Chart readout: the values of the point nearest to the pointer or finger.
const FORMATS = { coins, percent: (v) => percent.format(v) };
function chartPointer(e) {
  const box = e.target.closest?.('.chart-box');
  if (!box) return;
  const chart = box.querySelector('svg');
  const rect = chart.getBoundingClientRect();
  const hit = chartHit(JSON.parse(box.dataset.chart), (e.clientX - rect.left) / rect.width);
  const format = FORMATS[box.dataset.kind] ?? String;
  box.querySelector('.readout').textContent = [when(hit.time), ...hit.values.map((v) => `${v.label} ${format(v.value)}`)].join(' · ');
  const cursor = chart.querySelector('.cursor');
  cursor.setAttribute('x1', hit.x);
  cursor.setAttribute('x2', hit.x);
  cursor.setAttribute('visibility', 'visible');
}
$('detail').addEventListener('pointermove', chartPointer);
$('detail').addEventListener('pointerdown', chartPointer);
document.querySelector('main').addEventListener('click', (e) => {
  const withAh = e.target.closest('[data-forge-ah]')?.dataset.forgeAh;
  if (withAh) {
    settings.forgeAh = withAh === '1';
    return applySettings();
  }
  const id = e.target.closest('.star')?.dataset.id;
  if (!id) return;
  if (!favs.delete(id)) favs.add(id);
  save('bt.favs', [...favs]);
  syncAlerts(settings, favs, names);
  recompute();
  render();
});

addEventListener('hashchange', () => {
  route = parseRoute(location.hash);
  if (route.view !== 'item') lastList = route.view;
  recompute();
  render();
  settle();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) clearTimeout(timer);
  else if (Date.now() - lastFetch >= settings.interval * 60000) refresh();
  else schedule();
});

// Pull-to-refresh: only starts at the top of the page. The indicator is a pill that slides out from
// under the header, so the status bar never covers it: pull (arrow turns with the distance), ready,
// busy (spinner), done ("Updated").
const PTR_REST = 56; // how far below the header's edge the pill's own bottom edge rests, in px
const PTR_DONE_MS = 1200;
const ptr = $('ptr');
let pullStart = null;
let pulled = 0;
function showPtr(state, text, pull = PTR_REST) {
  if (state) ptr.dataset.state = state;
  else delete ptr.dataset.state;
  ptr.style.setProperty('--pull', `${state ? pull : 0}px`);
  // only on a change, so a screen reader hears each text once
  if (text && $('ptr-text').textContent !== text) $('ptr-text').textContent = text;
}
const pulling = () => ptr.dataset.state === 'pull' || ptr.dataset.state === 'ready';
addEventListener('touchstart', (e) => {
  pullStart = scrollY === 0 && !ptr.dataset.state ? e.touches[0].clientY : null;
  pulled = 0;
  ptr.style.top = `${document.querySelector('header').getBoundingClientRect().bottom}px`;
}, { passive: true });
addEventListener('touchmove', (e) => {
  if (pullStart === null) return;
  pulled = e.touches[0].clientY - pullStart;
  // a sideways swipe between tabs is not a pull
  if (drag?.side) pullStart = null;
  if (pullStart === null || pulled <= 0) return showPtr();
  ptr.style.setProperty('--turn', `${Math.min(pulled / PULL_PX, 1) * 180}deg`);
  if (pulled > PULL_PX) showPtr('ready', 'Release to refresh');
  else showPtr('pull', 'Pull to refresh', Math.min(pulled / 2, PTR_REST));
}, { passive: true });
async function endPull() {
  const go = pullStart !== null && pulled > PULL_PX;
  pullStart = null;
  if (!go) { if (pulling()) showPtr(); return; }
  showPtr('busy', 'Updating…');
  if (!await refresh()) return showPtr(); // the error line in the header says what went wrong
  showPtr('done', 'Updated');
  setTimeout(() => { if (ptr.dataset.state === 'done') showPtr(); }, PTR_DONE_MS);
}
addEventListener('touchend', endPull);
addEventListener('touchcancel', () => { pullStart = null; if (pulling()) showPtr(); });

// Swipe left or right on a list to change tabs, like a pager: the page follows the finger and the
// neighbouring tab is already there next to it. Not on the detail page, and not from the screen
// edge, where Android's own back gesture starts.
const EDGE_PX = 24;
const SLIDE_MS = 180;
const page = document.querySelector('main');
const peek = $('peek');
const calm = matchMedia('(prefers-reduced-motion: reduce)');
let drag = null;        // the touch in progress: start point, distance, side of the neighbour shown
let switching = false;  // a swipe has just changed the tab; the next render must not animate

function movePage(x, animate) {
  page.style.transition = animate && !calm.matches ? `transform ${SLIDE_MS}ms ease-out` : 'none';
  page.style.transform = x ? `translateX(${x}px)` : '';
}

// Renders the tab on one side (1 = right, -1 = left) next to the page, level with the visible part of the list.
function showPeek(side) {
  const tab = TABS[TABS.indexOf(view()) + side];
  peek.hidden = !tab;
  if (!tab) return;
  const { list, plan: pf } = compute(tab);
  const markup = listMarkup(tab, list, pf);
  peek.innerHTML = `${$('radar').innerHTML}${markup.portfolio}<p class="count muted">${markup.count}</p><ul class="list${tab === 'opps' ? ' opps' : ''}">${markup.list}</ul>`;
  peek.style.left = `${side * 100}%`;
  peek.style.top = `${Math.max(0, document.querySelector('header').getBoundingClientRect().bottom - page.getBoundingClientRect().top)}px`;
}

// Called after a tab change has been rendered: the real list takes the place of its preview.
function settle() {
  if (!switching) return;
  switching = false;
  movePage(0, false);
  peek.hidden = true;
  peek.innerHTML = '';
  scrollTo(0, 0);
}

page.addEventListener('touchstart', (e) => {
  const { clientX: x, clientY: y } = e.touches[0];
  const usable = products && route.view !== 'item' && e.touches.length === 1 && x > EDGE_PX && x < innerWidth - EDGE_PX;
  drag = usable ? { x, y, dx: 0, side: 0 } : null;
}, { passive: true });
page.addEventListener('touchmove', (e) => {
  if (!drag) return;
  const dx = e.touches[0].clientX - drag.x;
  const dy = e.touches[0].clientY - drag.y;
  if (!drag.side) {
    // a touch that starts as a scroll stays a scroll
    if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { drag = null; return; }
    if (Math.abs(dx) < 10 || Math.abs(dx) < 2 * Math.abs(dy)) return;
  }
  const side = dx < 0 ? 1 : -1;
  if (side !== drag.side) showPeek(side);
  drag.side = side;
  drag.dx = dx;
  movePage(dragOffset(view(), dx), false);
}, { passive: true });
function endDrag() {
  if (!drag) return;
  const { dx, side } = drag;
  drag = null;
  if (!side) return;
  const tab = swipeTab(view(), dx, 0);
  if (!tab) {
    movePage(0, true);
    setTimeout(() => { if (!drag && !switching) peek.hidden = true; }, SLIDE_MS);
    return;
  }
  movePage(dx < 0 ? -innerWidth : innerWidth, true);
  setTimeout(() => {
    switching = true;
    location.hash = `#/${tab}`;
  }, calm.matches ? 0 : SLIDE_MS);
}
page.addEventListener('touchend', endDrag, { passive: true });
page.addEventListener('touchcancel', endDrag, { passive: true });

// Background alerts exist only in the Android app.
function bindAlertToggle(key, hint) {
  $(key).checked = settings[key];
  $(key).addEventListener('change', async (e) => {
    const wanted = e.target.checked;
    settings[key] = wanted && await requestAlertPermission();
    e.target.checked = settings[key];
    $(hint).hidden = !wanted || settings[key];
    applySettings();
  });
}
if (plugin()) {
  $('alert-settings').hidden = false;
  $('market-alert-settings').hidden = false;
  bindAlertToggle('alerts', 'alert-hint');
  bindAlertToggle('marketAlerts', 'market-hint');
  onRoute((hash) => { location.hash = hash; });
}

// The worker needs a name for every product; send them once both lists are there.
let itemsLoaded = false;
let namesSent = false;
function sendNames() {
  if (namesSent || !itemsLoaded || !products) return;
  namesSent = true;
  syncNames(Object.keys(products), names);
}

$('fav-only').setAttribute('aria-pressed', settings.favOnly);
refresh();
refreshStats();
loadItems().then((items) => {
  names = items.names;
  npc = items.npc;
  tiers = items.tiers;
  itemsLoaded = true;
  syncAlerts(settings, favs, names);
  sendNames();
  recompute();
  render();
});
loadRecipes().then((r) => { recipes = r; recompute(); render(); });
loadForge().then((r) => { forge = r; recompute(); render(); });
initOnboarding({
  native: !!plugin(),
  ready,
  slots: () => settings.portfolioSlots,
  forge: () => ({ hotm: settings.hotm, ah: settings.forgeAh }),
  // the setup assistant hands over setting values; they go through the same checks as typed ones
  apply(values) {
    Object.assign(settings, values);
    sanitize();
    for (const key of Object.keys(values)) if ($(key)) $(key).value = settings[key];
    applySettings();
  },
});

// The Android app ships its files inside the APK and needs no service worker.
if ('serviceWorker' in navigator && !window.Capacitor?.isNativePlatform?.()) navigator.serviceWorker.register('sw.js');

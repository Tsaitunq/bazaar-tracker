import { buildFlips, computeFlip, opportunities, portfolio, statOf } from './flips.js';
import { npcFlips } from './npc.js';
import { craftFlips } from './craft.js';
import { loadItems, fallbackName } from './names.js';
import { loadStats, loadRecipes, loadHistory } from './data.js';
import { plugin, syncAlerts, syncNames, onRoute, requestAlertPermission } from './native.js';
import { flipCard, npcCard, craftCard, parseRoute, detailView, portfolioView, swipeTab, dragOffset, TABS, coins, percent, PLACEHOLDER_ICON } from './render.js';
import { chartHit, when } from './chart.js';
import { initOnboarding } from './tour.js';

const API = 'https://api.hypixel.net/v2/skyblock/bazaar';
const MAX_ROWS = 100;
const PULL_PX = 70;
const STATS_TTL = 20 * 60000;
const CARDS = { flips: flipCard, opps: flipCard, npc: npcCard, craft: craftCard };
const DEFAULTS = { tax: 1.25, minVolume: 100000, maxCapital: 5000000, interval: 2, share: 5, sort: 'profitHour', favOnly: false, alerts: false, alertMargin: 5,
  marketAlerts: false, marketMargin: 10, marketMinVolume: 100000, marketMinProfit: 100000, marketCooldown: 6,
  portfolioCapital: 50000000, portfolioSlots: 10 };

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

// The flips of one tab, with names. plan is the portfolio and only exists for the Opportunities tab.
function compute(v) {
  const opts = { ...settings, tax: settings.tax / 100, share: settings.share / 100, stats };
  let list;
  let pf = null;
  if (v === 'flips') list = buildFlips(products, { ...opts, favs });
  else if (v === 'opps') {
    const conditions = { ...opts, minMargin: settings.marketMargin / 100, minVolume: settings.marketMinVolume, minProfitHour: settings.marketMinProfit };
    list = opportunities(products, conditions);
    pf = portfolio(products, { ...conditions, capital: settings.portfolioCapital, slots: settings.portfolioSlots });
  }
  else if (v === 'npc') list = npcFlips(products, npc, opts);
  else list = recipes ? craftFlips(products, recipes, opts) : [];
  const name = (id) => names[id] ?? fallbackName(id);
  for (const f of pf?.flips ?? []) f.name = name(f.id);
  for (const f of list) {
    f.name = name(f.id);
    f.tier = tiers[f.id];
    for (const i of f.ingredients ?? []) i.name = name(i.id);
  }
  return { list, plan: pf };
}

function recompute() {
  if (!products || route.view === 'item') return;
  ({ list: flips, plan } = compute(view()));
}

// The three pieces of a list view as HTML: portfolio, the "x of y" line and the cards.
function listMarkup(v, list, pf) {
  if (v === 'craft' && recipes === null) {
    return { portfolio: '', count: '', list: '<li class="muted">No recipe data yet. The snapshot workflow has to run once.</li>' };
  }
  const q = $('search').value.trim().toLowerCase();
  const rows = list.filter((f) => (!settings.favOnly || favs.has(f.id)) && f.name.toLowerCase().includes(q));
  let cards = rows.slice(0, MAX_ROWS).map((f) => CARDS[v](f, favs.has(f.id))).join('');
  if (v === 'opps' && !list.length) {
    cards = `<li class="muted">${stats
      ? 'No item meets all conditions right now. Items need 24 hours of price history before they can show up here.'
      : 'Price history could not be loaded, so stability cannot be checked right now.'}</li>`;
  }
  return {
    portfolio: v === 'opps' && pf
      ? portfolioView(pf, { capital: settings.portfolioCapital, slots: settings.portfolioSlots, sharePercent: settings.share }) : '',
    count: `${Math.min(rows.length, MAX_ROWS)} of ${rows.length} flips`,
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

function renderDetail() {
  const { id } = route;
  if (hist.id !== id) {
    hist = { id, points: null };
    loadHistory(id, 7).then((points) => { if (hist.id === id) { hist.points = points; render(); } });
  }
  const nowMin = Date.now() / 60000;
  const points = hist.points && (range === '24h' ? hist.points.filter(([t]) => t >= nowMin - 1440) : hist.points);
  const stat = statOf(stats, id);
  const flip = products?.[id] ? computeFlip(id, products[id], settings.tax / 100, settings.maxCapital, settings.share / 100, stat.median) : null;
  $('detail').innerHTML = detailView({ id, name: names[id] ?? fallbackName(id), tier: tiers[id], flip, ...stat, back: lastList, isFav: favs.has(id), range, points, tax: settings.tax / 100 });
  flashChanges();
}

function render() {
  const item = route.view === 'item';
  // cards fade in on a normal render, but not when a swipe has just slid them into place
  document.querySelector('main').classList.toggle('sliding', switching);
  document.body.classList.toggle('detail', item);
  if (item) return renderDetail();
  $('detail').innerHTML = '';
  for (const a of document.querySelectorAll('#tabs a')) {
    if (a.getAttribute('href') === `#/${view()}`) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
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

async function refresh() {
  if (busy) return;
  busy = true;
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
  } catch (e) {
    $('error').textContent = `Update failed: ${e.message}`;
    $('error').hidden = false;
    if (!products) $('count').textContent = 'No data';
  }
  lastFetch = Date.now();
  busy = false;
  $('refresh').classList.remove('busy');
  schedule();
}

async function refreshStats() {
  lastStats = Date.now();
  stats = await loadStats();
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

for (const key of ['tax', 'interval', 'share', 'sort', 'minVolume', 'maxCapital', 'alertMargin', 'marketMargin', 'marketMinVolume', 'marketMinProfit', 'marketCooldown', 'portfolioCapital', 'portfolioSlots']) {
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

// Pull-to-refresh: only starts at the top of the page.
let pullStart = null;
let pulled = 0;
addEventListener('touchstart', (e) => { pullStart = scrollY === 0 ? e.touches[0].clientY : null; pulled = 0; }, { passive: true });
addEventListener('touchmove', (e) => {
  if (pullStart === null) return;
  pulled = e.touches[0].clientY - pullStart;
  $('ptr').style.height = `${Math.max(0, Math.min(pulled / 2, 40))}px`;
  $('ptr').textContent = pulled > PULL_PX ? 'Release to refresh' : 'Pull to refresh';
}, { passive: true });
addEventListener('touchend', () => {
  $('ptr').style.height = '0';
  if (pullStart !== null && pulled > PULL_PX) refresh();
  pullStart = null;
});

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
  peek.innerHTML = `${markup.portfolio}<p class="count muted">${markup.count}</p><ul class="list${tab === 'opps' ? ' opps' : ''}">${markup.list}</ul>`;
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
initOnboarding({
  native: !!plugin(),
  ready,
  slots: () => settings.portfolioSlots,
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

import { buildFlips, computeFlip } from './flips.js';
import { npcFlips } from './npc.js';
import { craftFlips } from './craft.js';
import { loadItems, fallbackName } from './names.js';
import { loadScores, loadRecipes, loadHistory } from './data.js';
import { plugin, syncAlerts, requestAlertPermission } from './native.js';
import { flipCard, npcCard, craftCard, parseRoute, detailView, PLACEHOLDER_ICON } from './render.js';

const API = 'https://api.hypixel.net/v2/skyblock/bazaar';
const MAX_ROWS = 100;
const PULL_PX = 70;
const SCORES_TTL = 20 * 60000;
const CARDS = { flips: flipCard, npc: npcCard, craft: craftCard };
const DEFAULTS = { tax: 1.25, minVolume: 100000, maxCapital: 5000000, interval: 2, share: 5, sort: 'profitHour', favOnly: false, alerts: false, alertMargin: 5 };

const $ = (id) => document.getElementById(id);
const load = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };

const settings = { ...DEFAULTS, ...load('bt.settings', {}) };
// A stored interval of 0 would refresh in a tight loop, so bad values fall back to defaults.
function sanitize() {
  for (const key of ['tax', 'interval', 'sort']) {
    if (![...$(key).options].some((o) => o.value === String(settings[key]))) settings[key] = DEFAULTS[key];
  }
  for (const key of ['minVolume', 'maxCapital']) {
    if (!(settings[key] >= 0)) settings[key] = DEFAULTS[key];
  }
  if (!(settings.share > 0 && settings.share <= 100)) settings.share = DEFAULTS.share;
  if (!(settings.alertMargin > 0 && settings.alertMargin <= 1000)) settings.alertMargin = DEFAULTS.alertMargin;
  settings.alerts = settings.alerts === true;
}
sanitize();
const storedFavs = load('bt.favs', []);
const favs = new Set(Array.isArray(storedFavs) ? storedFavs : []);

let products = null;
let names = {};
let npc = {};
let scores = {};
let recipes;
let lastScores = 0;
let route = parseRoute(location.hash);
let lastList = route.view === 'item' ? 'flips' : route.view; // where the detail page's back link goes
let flips = [];
let lastFetch = 0;
let timer;
let busy = false;
let hist = { id: null, points: null }; // 7 days of history for the open item, loaded once
let range = '24h';

const view = () => (route.view === 'item' ? 'flips' : route.view);

function recompute() {
  if (!products || route.view === 'item') return;
  const opts = { ...settings, tax: settings.tax / 100, share: settings.share / 100, scores };
  const v = view();
  if (v === 'flips') flips = buildFlips(products, { ...opts, favs });
  else if (v === 'npc') flips = npcFlips(products, npc, opts);
  else flips = recipes ? craftFlips(products, recipes, opts) : [];
  const name = (id) => names[id] ?? fallbackName(id);
  for (const f of flips) {
    f.name = name(f.id);
    for (const i of f.ingredients ?? []) i.name = name(i.id);
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
  const flip = products?.[id] ? computeFlip(id, products[id], settings.tax / 100, settings.maxCapital, settings.share / 100) : null;
  $('detail').innerHTML = detailView({ id, name: names[id] ?? fallbackName(id), flip, score: scores[id], back: lastList, isFav: favs.has(id), range, points, tax: settings.tax / 100 });
}

function render() {
  const item = route.view === 'item';
  document.body.classList.toggle('detail', item);
  if (item) return renderDetail();
  $('detail').innerHTML = '';
  for (const a of document.querySelectorAll('#tabs a')) {
    if (a.getAttribute('href') === `#/${view()}`) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  if (!products) return;
  if (view() === 'craft' && recipes === null) {
    $('count').textContent = '';
    $('list').innerHTML = '<li class="muted">Noch keine Rezeptdaten. Der Snapshot-Workflow muss einmal gelaufen sein.</li>';
    return;
  }
  const q = $('search').value.trim().toLowerCase();
  const rows = flips.filter((f) => (!settings.favOnly || favs.has(f.id)) && f.name.toLowerCase().includes(q));
  $('count').textContent = `${Math.min(rows.length, MAX_ROWS)} von ${rows.length} Flips`;
  $('list').innerHTML = rows.slice(0, MAX_ROWS).map((f) => CARDS[view()](f, favs.has(f.id))).join('');
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
    if (!data.success) throw new Error(data.cause || 'API meldet einen Fehler');
    products = data.products;
    $('stamp').textContent = `Stand ${new Date(data.lastUpdated).toLocaleTimeString('de-DE')}`;
    $('error').hidden = true;
    recompute();
    render();
    if (Date.now() - lastScores > SCORES_TTL) refreshScores();
  } catch (e) {
    $('error').textContent = `Aktualisierung fehlgeschlagen: ${e.message}`;
    $('error').hidden = false;
    if (!products) $('count').textContent = 'Keine Daten';
  }
  lastFetch = Date.now();
  busy = false;
  $('refresh').classList.remove('busy');
  schedule();
}

async function refreshScores() {
  lastScores = Date.now();
  scores = await loadScores();
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

for (const key of ['tax', 'interval', 'share', 'sort', 'minVolume', 'maxCapital', 'alertMargin']) {
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
  $('ptr').textContent = pulled > PULL_PX ? 'Loslassen zum Aktualisieren' : 'Ziehen zum Aktualisieren';
}, { passive: true });
addEventListener('touchend', () => {
  $('ptr').style.height = '0';
  if (pullStart !== null && pulled > PULL_PX) refresh();
  pullStart = null;
});

// Background alerts exist only in the Android app.
if (plugin()) {
  $('alert-settings').hidden = false;
  $('alerts').checked = settings.alerts;
  $('alerts').addEventListener('change', async (e) => {
    const wanted = e.target.checked;
    settings.alerts = wanted && await requestAlertPermission();
    e.target.checked = settings.alerts;
    $('alert-hint').hidden = !wanted || settings.alerts;
    applySettings();
  });
}

$('fav-only').setAttribute('aria-pressed', settings.favOnly);
refresh();
refreshScores();
loadItems().then((items) => { names = items.names; npc = items.npc; syncAlerts(settings, favs, names); recompute(); render(); });
loadRecipes().then((r) => { recipes = r; recompute(); render(); });
// The Android app ships its files inside the APK and needs no service worker.
if ('serviceWorker' in navigator && !window.Capacitor?.isNativePlatform?.()) navigator.serviceWorker.register('sw.js');

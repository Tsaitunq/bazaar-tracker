import { buildFlips } from './flips.js';
import { loadItems, fallbackName } from './names.js';
import { flipCard, PLACEHOLDER_ICON } from './render.js';

const API = 'https://api.hypixel.net/v2/skyblock/bazaar';
const MAX_ROWS = 100;
const PULL_PX = 70;
const DEFAULTS = { tax: 1.25, minVolume: 100000, maxCapital: 5000000, interval: 2, share: 5, sort: 'profitHour', favOnly: false };

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
}
sanitize();
const storedFavs = load('bt.favs', []);
const favs = new Set(Array.isArray(storedFavs) ? storedFavs : []);

let products = null;
let names = {};
let flips = [];
let lastFetch = 0;
let timer;
let busy = false;

function recompute() {
  if (!products) return;
  flips = buildFlips(products, { ...settings, tax: settings.tax / 100, share: settings.share / 100, favs });
  for (const f of flips) f.name = names[f.id] ?? fallbackName(f.id);
}

function render() {
  if (!products) return;
  const q = $('search').value.trim().toLowerCase();
  const rows = flips.filter((f) => (!settings.favOnly || favs.has(f.id)) && f.name.toLowerCase().includes(q));
  $('count').textContent = `${Math.min(rows.length, MAX_ROWS)} von ${rows.length} Flips`;
  $('list').innerHTML = rows.slice(0, MAX_ROWS).map((f) => flipCard(f, favs.has(f.id))).join('');
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

function applySettings() {
  save('bt.settings', settings);
  $('fav-only').setAttribute('aria-pressed', settings.favOnly);
  recompute();
  render();
}

for (const key of ['tax', 'interval', 'share', 'sort', 'minVolume', 'maxCapital']) {
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
$('list').addEventListener('click', (e) => {
  const id = e.target.closest('.star')?.dataset.id;
  if (!id) return;
  if (!favs.delete(id)) favs.add(id);
  save('bt.favs', [...favs]);
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

$('fav-only').setAttribute('aria-pressed', settings.favOnly);
refresh();
loadItems().then((items) => { names = items.names; recompute(); render(); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

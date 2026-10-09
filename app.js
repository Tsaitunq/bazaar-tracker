import { buildFlips } from './flips.js';
import { loadNames, fallbackName } from './names.js';

const API = 'https://api.hypixel.net/v2/skyblock/bazaar';
const MAX_ROWS = 100;
const PULL_PX = 70;
const DEFAULTS = { tax: 1.25, minVolume: 100000, maxCapital: 5000000, interval: 2, sort: 'profitHour', favOnly: false };

const $ = (id) => document.getElementById(id);
const load = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const compact = new Intl.NumberFormat('de-DE', { notation: 'compact', maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 1 });

const settings = { ...DEFAULTS, ...load('bt.settings', {}) };
// A stored interval of 0 would refresh in a tight loop, so bad values fall back to defaults.
for (const key of ['tax', 'interval', 'sort']) {
  if (![...$(key).options].some((o) => o.value === String(settings[key]))) settings[key] = DEFAULTS[key];
}
for (const key of ['minVolume', 'maxCapital']) {
  if (!(settings[key] >= 0)) settings[key] = DEFAULTS[key];
}
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
  flips = buildFlips(products, { ...settings, tax: settings.tax / 100 });
  for (const f of flips) f.name = names[f.id] ?? fallbackName(f.id);
}

const card = (f) => `<li class="card">
  <button class="star" type="button" data-id="${esc(f.id)}" aria-pressed="${favs.has(f.id)}" aria-label="Favorit: ${esc(f.name)}">★</button>
  <div class="body">
    <div class="name">${esc(f.name)}${f.suspicious ? ' <span class="warn">⚠ verdächtig</span>' : ''}</div>
    <dl>
      <div><dt>Buy-Order</dt><dd>${compact.format(f.buy)}</dd></div>
      <div><dt>Sell-Offer</dt><dd>${compact.format(f.sell)}</dd></div>
      <div><dt>Vol./Woche</dt><dd>${compact.format(f.weekVol)}</dd></div>
      <div><dt>Gewinn/Stück</dt><dd class="gain">${compact.format(f.profit)}</dd></div>
      <div><dt>Marge</dt><dd>${percent.format(f.margin)}</dd></div>
      <div><dt>Gewinn/h</dt><dd class="gain">${compact.format(f.profitHour)}</dd></div>
    </dl>
  </div>
</li>`;

function render() {
  if (!products) return;
  const q = $('search').value.trim().toLowerCase();
  const rows = flips.filter((f) => (!settings.favOnly || favs.has(f.id)) && f.name.toLowerCase().includes(q));
  $('count').textContent = `${Math.min(rows.length, MAX_ROWS)} von ${rows.length} Flips`;
  $('list').innerHTML = rows.slice(0, MAX_ROWS).map(card).join('');
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

for (const key of ['tax', 'interval', 'sort', 'minVolume', 'maxCapital']) {
  $(key).value = settings[key];
  $(key).addEventListener('change', (e) => {
    settings[key] = key === 'sort' ? e.target.value : Math.max(0, Number(e.target.value) || 0);
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
$('list').addEventListener('click', (e) => {
  const id = e.target.closest('.star')?.dataset.id;
  if (!id) return;
  if (!favs.delete(id)) favs.add(id);
  save('bt.favs', [...favs]);
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
loadNames().then((m) => { names = m; recompute(); render(); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

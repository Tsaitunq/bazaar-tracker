// The guide app: state, routes, sync, prices and events. What it shows is worked out in model.js and views/.
import { loadItemData, loadStatsPreset, loadForge, loadAh, loadElection, freshBins, fetchBins } from '../data.js';
import { loadBundled, mergeGuides, exportData, importData, setMark, stepKey, doneSet } from '../progress.js';
import { createSync, syncMessage, normalizeUuid, cleanKey } from '../sync.js';
import { plugin, canSync, getApiKey, setApiKey, loadProfile, saveProfile, clearProfileData } from '../native.js';
import { summarize } from '../profile.js';
import { detectGuide } from '../detect.js';
import { fallbackName, loadItems } from '../names.js';
import { PRESETS, miningSettings } from '../optimizer.js';
import { computeStats, loadoutOf, offsetStale, statsEntry } from '../stats.js';
import { parseRoute, syncOutcome, applyImport, stampAll, formEdited, typedFields, restoreTyped, settled, swipeTarget } from './model.js';
import { homeView } from './views/home.js';
import { guideView, statsView } from './views/guide.js';
import { settingsView } from './views/settings.js';

const BAZAAR = 'https://api.hypixel.net/v2/skyblock/bazaar';
const PRICE_EVERY = 300e3;
const BIN_RETRY = 600e3;
const DEFAULT_TAX = 1.25;

const load = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const save = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* full or blocked: it stays for this session */ }
};

const root = document.getElementById('app');
let bundled = [];
let imported = load('pg.guides', []);
let checks = load('pg.checks', {});
let dates = load('pg.dates', {});
const settings = load('pg.settings', {});
const bins = load('pg.bins', {});
let state = null;
let products = null;
let forge = null;
let ah = {};
let items = null;
let election = null;
let preset = null;
let hasKey = false;
let keyMessage = null;
let names = {};
let note = { message: '', choices: [] };
let profileMessage = '';
let dataMessage = '';
let dataText = '';
let armed = null;
let removeArmed = false;
let binsBusy = false;
let binsFailed = 0;
let pending = new Set();
let touch = null;
let slide = '';

const guides = () => mergeGuides(bundled, imported);
const route = () => parseRoute(location.hash, guides());
const boosts = () => ({ godPotion: settings.godPotion ?? preset?.boosts?.godPotion ?? false, boosterCookie: settings.boosterCookie ?? preset?.boosts?.boosterCookie ?? false });

const world = () => {
  pending = new Set();
  return {
    guides: guides(), checks, dates, state, products, now: Date.now(),
    prices: { forge, ah, cofl: freshBins(bins), wants: pending, items, tax: (settings.tax ?? DEFAULT_TAX) / 100, derpy: election?.mayor?.name === 'Derpy' },
    settings: miningSettings(settings.mining), keepOldGear: settings.keepOldGear === true, boosts: boosts(), preset,
    name: (id) => names[id] ?? fallbackName(id), uuid: state?.uuid ?? '', hasKey, keyMessage, tax: settings.tax ?? DEFAULT_TAX, importedIds: imported.map((g) => g.id), canSync: canSync(), message: note.message, choices: note.choices,
    profileMessage, dataMessage, dataText, armed, removeArmed,
  };
};

function screenOf(r, w) {
  if (r.page === 'stats') return statsView(w);
  if (r.page === 'settings') return settingsView(w);
  if (r.page === 'guide') return guideView(w, r.id, r.tab) ?? homeView(w);
  return homeView(w);
}

// A redraw keeps the scroll position of the list and the keyboard on the same step.
function draw() {
  const scroller = root.querySelector('.path, .scroll');
  const top = scroller?.scrollTop ?? 0;
  const list = scroller?.className;
  const focused = document.activeElement?.dataset?.step;
  const focusClass = document.activeElement?.className;
  const fields = () => [...root.querySelectorAll('input:not([type="file"]), select, textarea')];
  const typed = typedFields(fields());
  const activeField = fields().indexOf(document.activeElement);
  const shownPage = root.firstElementChild?.dataset.page;
  const w = world();
  root.innerHTML = screenOf(route(), w);
  // the same form again: what is typed stays, and so does the field being typed in
  if (root.firstElementChild?.dataset.page === shownPage) {
    restoreTyped(fields(), typed);
    if (activeField >= 0) fields()[activeField]?.focus({ preventScroll: true });
  }
  document.documentElement.dataset.theme = root.firstElementChild?.dataset.theme ?? 'home';
  if (slide) root.firstElementChild?.classList.add(slide);
  slide = '';
  const after = root.querySelector('.path, .scroll');
  if (after && after.className === list) after.scrollTop = top;
  if (focused !== undefined) {
    const same = [...root.querySelectorAll('[data-step]')].filter((el) => el.dataset.step === focused);
    (same.find((el) => el.className === focusClass) ?? same[0])?.focus({ preventScroll: true });
  }
  askBins(pending);
}

// New prices must not wipe what is being typed into a form.
function drawInBackground() {
  if (!formEdited([...root.querySelectorAll('input, select, textarea')], document.activeElement)) draw();
}

async function askBins(wants) {
  if (binsBusy || !wants.size || Date.now() - binsFailed < BIN_RETRY) return;
  binsBusy = true;
  let answers = 0;
  const ok = await fetchBins([...wants], bins, (last) => {
    if (!last && ++answers % 20) return;
    save('pg.bins', freshBins(bins));
    drawInBackground();
  });
  binsBusy = false;
  if (!ok) binsFailed = Date.now();
  else drawInBackground();
}

function stamp(firstRun = false) {
  dates = stampAll(guides(), checks, dates, state, Date.now(), firstRun);
  save('pg.dates', dates);
}

async function refreshPrices() {
  try {
    const res = await fetch(BAZAAR, { cache: 'no-store' });
    const data = await res.json();
    if (!data.success) return;
    products = data.products;
    drawInBackground();
  } catch { /* no connection: costs stay as they were, or as … */ }
}

function toggle(key) {
  const r = route();
  const guide = guides().find((g) => g.id === r.id);
  if (!guide) return;
  const marks = new Set(checks[guide.id] ?? []);
  const auto = detectGuide(guide, state?.summary ?? null, stepKey);
  setMark(guide, marks, key, !doneSet(guide, marks, auto).has(key), auto);
  checks = { ...checks, [guide.id]: [...marks] };
  save('pg.checks', checks);
  dataText = ''; // an export from before this tick must not come back by accident
  stamp();
  draw();
}

const profileSync = createSync({ store: { getApiKey, loadProfile, saveProfile }, summarize });

async function runSync(pick) {
  note = { message: 'Syncing…', choices: [] };
  draw();
  const first = !state?.syncedAt;
  const result = await profileSync.run(pick);
  if (result.status === 'busy') return;
  const out = syncOutcome(result, state);
  state = out.state;
  note = { message: out.message, choices: out.choices };
  if (result.status === 'ok') stamp(first);
  draw();
}

async function showProfile() {
  state = await loadProfile();
  // a key that cannot be read right now is not a missing key
  [hasKey, keyMessage] = await getApiKey().then((key) => [!!key, null], () => [false, syncMessage('keyread')]);
}

async function saveUuid(input) {
  const uuid = normalizeUuid(input.value);
  if (uuid) settled(input);
  if (!uuid) profileMessage = syncMessage('input');
  else if ((await loadProfile())?.uuid !== uuid) {
    // another player's stand must not stay behind under a new UUID
    profileSync.invalidate();
    profileMessage = await saveProfile({ uuid }) ? 'Saved.' : syncMessage('store');
    await showProfile();
  }
  draw();
}

async function saveKey(input) {
  const key = cleanKey(input.value);
  input.value = '';
  settled(input);
  if (key) profileMessage = await setApiKey(key) ? 'Saved.' : 'Could not save the key on this phone.';
  await showProfile();
  draw();
}

async function removeProfile() {
  if (!removeArmed) { removeArmed = true; return draw(); }
  removeArmed = false;
  note = { message: '', choices: [] };
  const keyField = root.querySelector('[data-set="key"]');
  keyField.value = '';
  settled(keyField);
  profileSync.invalidate();
  profileMessage = await clearProfileData() ? 'Key and profile data removed.' : 'Could not remove them.';
  await showProfile();
  draw();
}

function saveSettings() {
  save('pg.settings', settings);
  draw();
}

// What the box holds is dealt with, so the next redraw shows the app's text.
const jsonSettled = () => { const box = root.querySelector('[data-json]'); if (box) settled(box); };

function runImport(raw) {
  try {
    const data = importData(raw);
    ({ imported, checks } = applyImport({ imported, checks, bundled }, data));
    save('pg.guides', imported);
    save('pg.checks', checks);
    stamp();
    dataText = '';
    jsonSettled();
    dataMessage = `Imported ${data.guides.length} ${data.guides.length === 1 ? 'guide' : 'guides'}.`;
  } catch (e) {
    dataMessage = e.message;
  }
  draw();
}

async function runExport() {
  dataText = exportData(guides(), checks);
  let copied = false;
  try { await navigator.clipboard.writeText(dataText); copied = true; } catch { /* the text field holds it */ }
  // the Android WebView has no downloads, so there the text and the clipboard are the export
  if (!plugin()) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([dataText], { type: 'application/json' }));
    link.download = 'progress-guides.json';
    link.click();
    URL.revokeObjectURL(link.href);
  }
  jsonSettled();
  dataMessage = copied ? 'Copied to the clipboard.' : 'Copy the text above.';
  draw();
}

async function saveStats(box) {
  const area = box.dataset.statsArea;
  const values = Object.fromEntries([...box.querySelectorAll('[data-stats-stat]')].map((input) => [input.dataset.statsStat, input.value]));
  const pick = (kind) => box.querySelector(`[data-stats-set="${kind}"]`).value;
  const form = { armor: pick('armor'), equipment: pick('equipment'), pet: pick('pet'), emptyHand: box.querySelector('[data-stats-empty-hand]').checked, boost: box.querySelector('[data-stats-boost]').checked, values };
  const stand = await loadProfile();
  if (!stand) return;
  const { choice } = statsEntry(area, form, 0);
  const measured = items && stand.summary ? { total: computeStats(stand.summary, items, loadoutOf(stand.summary, items, area, choice, miningSettings(settings.mining)), area, boosts()).total, boosts: boosts() } : null;
  const entry = statsEntry(area, form, Date.now(), measured, stand.statsInput?.[area] ?? null);
  const next = { ...stand, statsInput: { ...stand.statsInput, [area]: entry } };
  if (await saveProfile(next)) {
    state = next;
    box.querySelectorAll('input, select').forEach(settled);
  }
  draw();
}

function tabTarget(tab) {
  const r = route();
  if (r.page === 'guide') return `#/guide/${r.id}/${tab}`;
  return tab === 'home' ? '#/' : `#/${tab}`;
}

root.addEventListener('click', (e) => {
  const el = (selector) => e.target.closest(selector);
  const tab = el('[data-tab]');
  if (tab) { location.hash = tabTarget(tab.dataset.tab); return; }
  const step = el('[data-step]');
  if (step) { toggle(step.dataset.step); return; }
  const sync = el('[data-sync="run"]');
  if (sync) { runSync(); return; }
  const pick = el('[data-sync-pick]');
  if (pick) { runSync(pick.dataset.syncPick); return; }
  if (el('[data-stats-save]')) { saveStats(el('[data-stats-area]')); return; }
  const reset = el('[data-reset]');
  if (reset) { armed = reset.dataset.reset; draw(); return; }
  if (el('[data-reset-no]')) { armed = null; draw(); return; }
  const yes = el('[data-reset-yes]');
  if (yes) {
    armed = null;
    checks = { ...checks, [yes.dataset.resetYes]: [] };
    save('pg.checks', checks);
    stamp();
    draw();
    return;
  }
  const act = el('[data-act]')?.dataset.act;
  if (act === 'remove') removeProfile();
  if (act === 'mining-reset') { settings.mining = null; saveSettings(); }
  if (act === 'export') runExport();
  if (act === 'import') runImport(root.querySelector('[data-json]').value);
  if (act === 'import-file') root.querySelector('[data-import-file]').click();
  const removeGuide = el('[data-remove-guide]');
  if (removeGuide) {
    imported = imported.filter((g) => g.id !== removeGuide.dataset.removeGuide);
    save('pg.guides', imported);
    draw();
  }
});

root.addEventListener('change', async (e) => {
  const { dataset } = e.target;
  if (dataset.set === 'uuid') return saveUuid(e.target);
  if (dataset.set === 'key') return saveKey(e.target);
  if (e.target.matches('[data-tax], [data-flag]')) settled(e.target);
  if (e.target.matches('[data-tax]')) { settings.tax = Number(e.target.value); return saveSettings(); }
  if (dataset.flag) { settings[dataset.flag] = e.target.checked; return saveSettings(); }
  if (dataset.mining) settled(e.target);
  if (dataset.mining === 'preset') {
    const { gemFortune, ...values } = PRESETS[e.target.value];
    settings.mining = { preset: e.target.value, ...values };
    return saveSettings();
  }
  if (dataset.mining) { settings.mining = { ...miningSettings(settings.mining), [dataset.mining]: e.target.value }; return saveSettings(); }
  if (e.target.matches('[data-import-file]')) {
    const file = e.target.files[0];
    if (file) runImport(await file.text());
    return undefined;
  }
  // a picker that moves away from the measured setup says so before anything is saved
  if (e.target.matches('[data-stats-set]')) {
    const box = e.target.closest('[data-stats-area]');
    if (!box.dataset.offsetFor) return undefined;
    const was = JSON.parse(box.dataset.offsetFor);
    const picked = (kind) => (was[kind] === null ? null : box.querySelector(`[data-stats-set="${kind}"]`).value);
    box.querySelector('[data-stats-setup-hint]').hidden = !offsetStale({ offsetFor: was }, { armor: was.armor === null ? null : Number(picked('armor')), equipment: was.equipment === null ? null : Number(picked('equipment')), pet: picked('pet') });
  }
  return undefined;
});

// A list that scrolls sideways keeps its own swipe.
function scrollsSideways(el) {
  for (; el && el !== root; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth && /auto|scroll/.test(getComputedStyle(el).overflowX)) return true;
  }
  return false;
}

root.addEventListener('touchstart', (e) => {
  const [first] = e.touches;
  touch = e.touches.length === 1 && !scrollsSideways(e.target) ? { x: first.clientX, y: first.clientY } : null;
}, { passive: true });
root.addEventListener('touchcancel', () => { touch = null; }, { passive: true });
root.addEventListener('touchend', (e) => {
  if (!touch) return;
  const [last] = e.changedTouches;
  const tabs = [...root.querySelectorAll('.bar [data-tab]')].map((b) => b.dataset.tab);
  const to = swipeTarget(route(), last.clientX - touch.x, last.clientY - touch.y, tabs);
  touch = null;
  if (!to) return;
  slide = to.back ? 'slide-back' : 'slide-next';
  location.hash = to.hash;
}, { passive: true });

window.addEventListener('hashchange', draw);

if ('serviceWorker' in navigator && !plugin()) navigator.serviceWorker.register('sw.js').catch(() => {});

draw();
await Promise.all([
  loadBundled().then((list) => { bundled = list; }),
  showProfile(),
  loadStatsPreset().then((p) => { preset = p; }),
]);
stamp();
draw();
loadForge().then((r) => { forge = r; drawInBackground(); });
loadAh().then((r) => { ah = r; drawInBackground(); });
loadElection().then((r) => { election = r; drawInBackground(); });
loadItemData().then((r) => { items = r; drawInBackground(); });
loadItems().then((r) => { names = r.names; drawInBackground(); });
refreshPrices();
setInterval(refreshPrices, PRICE_EVERY);

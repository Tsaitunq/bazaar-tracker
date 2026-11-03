// The guide app: state, routes, sync, prices and events. What it shows is worked out in model.js and views/.
import { loadItemData, loadStatsPreset, loadForge, loadAh, loadElection, freshBins, fetchBins } from '../data.js';
import { loadBundled, mergeGuides, exportData, importData, doneSet } from '../progress.js';
import { createSync, syncMessage, normalizeUuid, cleanKey } from '../sync.js';
import { plugin, canSync, getApiKey, setApiKey, loadProfile, saveProfile, clearProfileData, clearApiKeyOnly } from '../native.js';
import { summarize } from '../profile.js';
import { migrateOwned, resetOwned } from '../owned.js';
import { fallbackName, loadItems } from '../names.js';
import { PRESETS, miningSettings } from '../optimizer.js';
import { computeStats, loadoutOf, offsetStale, statsEntry } from '../stats.js';
import { parseRoute, syncOutcome, applyImport, stampAll, formEdited, typedFields, restoreTyped, settled, statsOnly, autoOf, tickStep, swipeTarget, swipeAxis, swipeLands, familyOf } from './model.js';
import { homeView } from './views/home.js';
import { guideView, statsView } from './views/guide.js';
import { settingsView } from './views/settings.js';

const BAZAAR = 'https://api.hypixel.net/v2/skyblock/bazaar';
const PRICE_EVERY = 300e3;
const BIN_RETRY = 600e3;
const DEFAULT_TAX = 1.25;
const SETTLE_MS = 200; // as in guide.css
const EDGE_PULL = 0.25; // only where no screen waits: the last guide of an area
const FLICK_FRESH_MS = 80;
const SPEED_KEEP = 0.4; // the speed of a flick: the last moves count most, one jittery event does not decide
const CARD_GAP = 8;
const MARK_MS = 250; // as in guide.css
const HAND_QUIET_MS = 700; // a flicked list still glides this long after the finger lifts
const FOLD_PX = 24;

const load = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const save = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; /* full or blocked: it stays for this session */ }
};

const root = document.getElementById('app');
let bundled = [];
let imported = load('pg.guides', []);
let checks = load('pg.checks', {});
let dates = load('pg.dates', {});
let owned = load('pg.owned', []);
const settings = load('pg.settings', {});
const bins = load('pg.bins', {});
let state; // undefined until the stored profile is loaded, null when there is none
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
let settling = false;
let redrawDue = false;
let shownRoute = '';
let infoOpen = false; // the sheet of notes stays open over a redraw
let evidenceKey = null; // the step whose API tag was tapped: its sheet stays open over a redraw
let tiers = {};
let folded = false; // the head of a guide, down to its title line
let byHand = false; // a finger, wheel or key was used; the app's own scroll to the card does not fold the head
let handAt = -Infinity; // when a hand last moved the list: no reveal scroll pulls against it
let follow = false; // the list still sits where the app put it, so a redraw puts it on the card again
let foldFrom = 0; // where the list was when the head last opened
let loading = true; // until the guide files are read, an empty list means nothing yet
let pathEpoch = 0; // a new order of all paths: on a tick, on the first prices and when a setting changes
const opened = {}; // a new order of one path: when that guide opens. Going back reuses what home had, so it is quick

const guides = () => mergeGuides(bundled, imported);
const route = () => parseRoute(location.hash, guides());
// A swipe moves between the guides of one area, like the switch at the top.
const targetOf = (dx) => {
  const r = route();
  const guide = guides().find((g) => g.id === r.id);
  return swipeTarget(r, dx, guide ? familyOf(guides(), guide).map((g) => g.id) : [r.id]);
};
// Off until asked for, so the app starts on typed-in stats. Whoever already has a key or a sync keeps it.
const personal = () => settings.personal ?? (hasKey || !!state?.syncedAt);
// With the sync off, what it found stays stored but counts for nothing. Keeps undefined: the profile is not loaded yet.
const shownState = () => (state && !personal() ? { ...state, summary: undefined, syncedAt: undefined } : state);
// Typed-in stats are no secret, so without the Android store they live in the browser.
const loadStand = () => (plugin() ? loadProfile() : load('pg.profile', null));
const saveStand = async (stand) => {
  if (plugin()) return saveProfile(stand);
  save('pg.profile', stand);
  return true;
};
const boosts = () => ({ godPotion: settings.godPotion ?? preset?.boosts?.godPotion ?? false, boosterCookie: settings.boosterCookie ?? preset?.boosts?.boosterCookie ?? false });

const world = () => {
  pending = new Set();
  return {
    guides: guides(), checks, owned, dates, state: shownState() ?? null, personal: personal(), products, now: Date.now(),
    prices: { forge, ah, cofl: freshBins(bins), wants: pending, items, tax: (settings.tax ?? DEFAULT_TAX) / 100, derpy: election?.mayor?.name === 'Derpy' },
    settings: miningSettings(settings.mining), keepOldGear: settings.keepOldGear === true, brake: settings.brake > 0 ? settings.brake : 5, pathEpoch, opened, boosts: boosts(), preset,
    name: (id) => names[id] ?? fallbackName(id), uuid: state?.uuid ?? '', hasKey, keyMessage, tax: settings.tax ?? DEFAULT_TAX, importedIds: imported.map((g) => g.id), canSync: canSync(), message: note.message, choices: note.choices,
    loading, profileMessage, dataMessage, dataText, armed, removeArmed, evidence: evidenceKey, tierOf: (id) => tiers[id] ?? '',
  };
};

function screenOf(r, w) {
  if (r.page === 'stats') return statsView(w);
  if (r.page === 'settings') return settingsView(w);
  if (r.page === 'guide') return guideView(w, r.id) ?? homeView(w);
  return homeView(w);
}

// A guide opens on its current step, just below the fixed head.
function showCard(box) {
  const path = box.querySelector('.path');
  const card = path?.querySelector('.card');
  if (card) path.scrollTop += card.getBoundingClientRect().top - path.getBoundingClientRect().top - CARD_GAP;
}

// A redraw keeps the scroll position of the list and the keyboard on the same step.
function draw() {
  // a redraw would pull the screen from under the finger; it follows when the swipe is over
  if (settling || touch?.axis === 'x') { redrawDue = true; return; }
  const scroller = root.querySelector('.path, .scroll');
  const top = scroller?.scrollTop ?? 0;
  const list = scroller?.className;
  const focused = document.activeElement?.dataset?.step;
  const focusClass = document.activeElement?.className;
  const fields = () => [...root.querySelectorAll('input:not([type="file"]), select, textarea')];
  const typed = typedFields(fields());
  const activeField = fields().indexOf(document.activeElement);
  const shownPage = root.firstElementChild?.dataset.page;
  const openParts = [...root.querySelectorAll('details[data-keep-open][open]')].map((d) => d.dataset.keepOpen);
  const w = world();
  root.innerHTML = screenOf(route(), w);
  // the same form again: what is typed stays, and so does the field being typed in
  if (root.firstElementChild?.dataset.page === shownPage) {
    restoreTyped(fields(), typed);
    if (activeField >= 0) fields()[activeField]?.focus({ preventScroll: true });
    root.querySelectorAll('details[data-keep-open]').forEach((d) => { d.open = openParts.includes(d.dataset.keepOpen); });
  }
  document.documentElement.dataset.theme = root.firstElementChild?.dataset.theme ?? 'home';
  const after = root.querySelector('.path, .scroll');
  if (after && after.className === list) after.scrollTop = top;
  const shown = JSON.stringify(route());
  if (shown !== shownRoute) {
    folded = false;
    infoOpen = false;
    evidenceKey = null;
    byHand = false;
    follow = true;
  }
  // prices or item data that come after the opening reorder the path; until a hand or a tick moves the list, the card stays in sight
  if (shown !== shownRoute || follow) {
    showCard(root);
    foldFrom = root.querySelector('.path')?.scrollTop ?? 0;
  }
  shownRoute = shown;
  root.firstElementChild?.classList.toggle('head-min', folded);
  if (infoOpen) openInfo();
  if (evidenceKey) openEvidence();
  if (focused !== undefined) {
    const same = [...root.querySelectorAll('[data-step]')].filter((el) => el.dataset.step === focused);
    (same.find((el) => el.className === focusClass) ?? same[0])?.focus({ preventScroll: true });
  }
  preparePeek();
  askBins(pending);
}

// New prices must not wipe what is being typed into a form.
function openInfo() {
  const sheet = root.querySelector('dialog.sheet:not(.ev-sheet)');
  if (!sheet) { infoOpen = false; return; }
  if (!sheet.open) sheet.showModal();
  infoOpen = true;
  // a sheet thrown away by a redraw may still report its close; only the one on screen counts
  sheet.addEventListener('close', () => { if (root.contains(sheet)) infoOpen = false; }, { once: true });
}

function openEvidence() {
  const sheet = root.querySelector('dialog.ev-sheet');
  if (!sheet) { evidenceKey = null; return; }
  if (!sheet.open) sheet.showModal();
  sheet.addEventListener('close', () => { if (root.contains(sheet)) evidenceKey = null; }, { once: true });
}

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
  dates = stampAll(guides(), checks, dates, shownState(), Date.now(), firstRun, owned);
  save('pg.dates', dates);
}

async function refreshPrices() {
  try {
    const res = await fetch(BAZAAR, { cache: 'no-store' });
    const data = await res.json();
    if (!data.success) return;
    if (!products) pathEpoch++;
    products = data.products;
    drawInBackground();
  } catch { /* no connection: costs stay as they were, or as … */ }
}

// After Mark done the next card comes fully into sight, unless a hand is moving the list right now.
function revealCard() {
  const path = root.querySelector('.path');
  const card = path?.querySelector('.card');
  if (!card) return;
  const box = path.getBoundingClientRect();
  const at = card.getBoundingClientRect(); // measured before the opening scale
  card.classList.add('card-open');
  if (performance.now() - handAt < HAND_QUIET_MS) return;
  const below = at.bottom + CARD_GAP - box.bottom;
  const above = at.top - CARD_GAP - box.top;
  const by = above < 0 || at.height + 2 * CARD_GAP > box.height ? above : Math.max(below, 0);
  if (!by) return;
  byHand = false; // the app's own scroll does not fold the head
  path.scrollBy({ top: by, behavior: stillMotion() ? 'auto' : 'smooth' });
}

// The card closes (tick pops, dot fills, line runs on), then the next step opens as a card.
let marking = false;
function markCard(step, key) {
  if (marking) return;
  if (stillMotion()) { toggle(key, true); return; }
  marking = true;
  step.closest('.step')?.classList.add('marking');
  setTimeout(() => { marking = false; toggle(key, true); }, MARK_MS);
}

function toggle(key, fromCard = false) {
  const r = route();
  const guide = guides().find((g) => g.id === r.id);
  if (!guide) return;
  const marks = new Set(checks[guide.id] ?? []);
  const summary = shownState()?.summary;
  const on = !doneSet(guide, marks, autoOf(guide, summary, owned)).has(key);
  owned = [...tickStep({ guide, key, on, marks, owned, summary })];
  checks = { ...checks, [guide.id]: [...marks] };
  save('pg.checks', checks);
  save('pg.owned', owned);
  dataText = ''; // an export from before this tick must not come back by accident
  follow = false; // the list stays under the finger that ticked
  pathEpoch++;
  stamp();
  draw();
  if (fromCard) revealCard();
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
  state = await loadStand();
  // a key that cannot be read right now is not a missing key
  [hasKey, keyMessage] = await getApiKey().then((key) => [!!key, null], () => [false, syncMessage('keyread')]);
}

async function saveUuid(input) {
  const uuid = normalizeUuid(input.value);
  let stand;
  if (uuid) settled(input);
  if (!uuid) profileMessage = syncMessage('input');
  else if ((stand = await loadStand())?.uuid !== uuid) {
    // another player's stand must not stay behind under a new UUID; stats typed in before any UUID are the player's own
    profileSync.invalidate();
    profileMessage = await saveStand(stand?.uuid ? { uuid } : { ...stand, uuid }) ? 'Saved.' : syncMessage('store');
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
  // a store that cannot be read right now gives null: what is on screen still holds the typed-in stats
  const kept = statsOnly(await loadStand() ?? state);
  let removed;
  if (!plugin()) removed = await saveStand(kept);
  else if (kept) removed = await saveStand(kept) && await clearApiKeyOnly();
  else removed = await clearProfileData();
  profileMessage = removed ? 'Key and profile data removed.' : 'Could not remove them.';
  await showProfile();
  draw();
}

function saveSettings() {
  pathEpoch++;
  save('pg.settings', settings);
  draw();
}

// What the box holds is dealt with, so the next redraw shows the app's text.
const jsonSettled = () => { const box = root.querySelector('[data-json]'); if (box) settled(box); };

function runImport(raw) {
  try {
    const data = importData(raw);
    ({ imported, checks, owned } = applyImport({ imported, checks, bundled, owned }, data));
    ({ owned, checks } = migrateOwned(guides(), checks, owned));
    pathEpoch++;
    save('pg.guides', imported);
    save('pg.checks', checks);
    save('pg.owned', owned);
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
  dataText = exportData(guides(), checks, owned);
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
  // the typed-in form has no slots and boxes
  const pick = (kind) => box.querySelector(`[data-stats-set="${kind}"]`)?.value;
  const form = { armor: pick('armor'), equipment: pick('equipment'), pet: pick('pet'), emptyHand: box.querySelector('[data-stats-empty-hand]')?.checked, boost: box.querySelector('[data-stats-boost]')?.checked, mp: box.querySelector('[data-stats-mp]')?.value, values };
  const stand = await loadStand() ?? {};
  const synced = personal() ? stand.summary : null;
  const { choice } = statsEntry(area, form, 0);
  let measured; // nothing to measure against without a sync, so no offset at all
  if (synced) measured = items ? { total: computeStats(synced, items, loadoutOf(synced, items, area, choice, miningSettings(settings.mining)), area, boosts()).total, boosts: boosts() } : null;
  const entry = statsEntry(area, form, Date.now(), measured, stand.statsInput?.[area] ?? null);
  const next = { ...stand, statsInput: { ...stand.statsInput, [area]: entry } };
  if (await saveStand(next)) {
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
  if (el('[data-info]')) { openInfo(); return; }
  const why = el('[data-evidence]');
  if (why) { evidenceKey = why.dataset.evidence; draw(); return; }
  const step = el('[data-step]');
  if (step) { if (step.closest('.card')) markCard(step, step.dataset.step); else toggle(step.dataset.step); return; }
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
    owned = [...resetOwned(guides().find((g) => g.id === yes.dataset.resetYes), owned)];
    pathEpoch++;
    save('pg.checks', checks);
    save('pg.owned', owned);
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
  if (e.target.matches('[data-tax], [data-flag], [data-brake]')) settled(e.target);
  if (e.target.matches('[data-brake]')) { settings.brake = Number(e.target.value) > 0 ? Number(e.target.value) : 5; return saveSettings(); }
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

const stillMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const idle = (job) => (window.requestIdleCallback ? requestIdleCallback(job, { timeout: 1000 }) : setTimeout(job, 200));
const unidle = (id) => (window.cancelIdleCallback ? cancelIdleCallback(id) : clearTimeout(id));
let peekJob = 0;
let reorderJob = 0;
let landedOn = null;
let frame = 0;

function buildPeek(to) {
  const peek = document.createElement('div');
  peek.className = to.back ? 'peek' : 'peek peek-next';
  peek.inert = true;
  peek.dataset.hash = to.hash;
  peek.innerHTML = screenOf(parseRoute(to.hash, guides()), world());
  root.append(peek);
  showCard(peek); // already on its card while hidden, so the slide in shows no done steps and no jump at landing
  return peek;
}

const peekOf = (to) => [...root.querySelectorAll('.peek')].find((p) => p.dataset.hash === to.hash);
// a peek waits beside the screen: the one before on the left, the next one on the right
const besideAt = (peek, shift) => `translate3d(${shift + (peek.classList.contains('peek-next') ? root.clientWidth : -root.clientWidth)}px, 0, 0)`;

// The screens a swipe leads to, built while the app is idle and kept hidden, so the first move of a finger renders nothing.
function preparePeek() {
  if (peekJob) unidle(peekJob);
  peekJob = 0;
  const targets = [targetOf(1), targetOf(-1)].filter(Boolean);
  if (!targets.length || stillMotion()) return;
  peekJob = idle(() => {
    peekJob = 0;
    if (!touch && !settling) targets.filter((to) => !peekOf(to)).forEach(buildPeek);
  });
}

// The switch of an area stays where it is while its guides slide under it; its mark follows the swipe.
// A swipe out of the area (back home) takes the switch along with its screen.
function pinSwitch(shift, to) {
  const sw = root.firstElementChild?.querySelector('.switch');
  const thumb = sw?.querySelector('.switch-thumb');
  if (!thumb) return;
  const links = [...sw.querySelectorAll('a')];
  const from = links.findIndex((a) => a.hasAttribute('aria-current'));
  const goal = to ? links.findIndex((a) => a.getAttribute('href') === to.hash) : from;
  if (goal < 0) { sw.style.removeProperty('transform'); thumb.style.removeProperty('transform'); return; }
  const pos = from + (goal - from) * Math.min(1, Math.abs(shift) / root.clientWidth);
  sw.style.transform = `translate3d(${-shift}px, 0, 0)`;
  thumb.style.transform = `translateX(${pos * 100}%)`;
}

// One write per frame, and only transforms: the list under the finger is never laid out again.
function paint() {
  frame = 0;
  if (touch?.axis !== 'x') return;
  const shift = touch.to ? touch.dx : touch.dx * EDGE_PULL;
  root.firstElementChild.style.transform = `translate3d(${shift}px, 0, 0)`;
  pinSwitch(shift, touch.to);
  // only the peek on the side the finger moves to comes along; the other one waits at its place
  for (const peek of root.querySelectorAll('.peek')) {
    if (touch.to?.hash === peek.dataset.hash) peek.style.transform = besideAt(peek, shift);
    else peek.style.removeProperty('transform');
  }
}

// A guide opens at once in the order it had last time; its new order follows when the app is idle, with the card kept in sight.
function reorderLater() {
  const r = route();
  if (r.page !== 'guide') return;
  if (reorderJob) unidle(reorderJob);
  reorderJob = idle(() => {
    reorderJob = 0;
    const now = route();
    if (now.page !== 'guide' || now.id !== r.id) return;
    opened[r.id] = (opened[r.id] ?? 0) + 1;
    drawInBackground();
  });
}

function landed(to) {
  settling = false;
  root.removeAttribute('class');
  root.firstElementChild?.style.removeProperty('transform');
  root.querySelectorAll('.switch, .switch-thumb').forEach((el) => el.style.removeProperty('transform'));
  root.querySelectorAll('.peek').forEach((p) => p.style.removeProperty('transform'));
  // drawn at once, so no frame shows the old screen back in place; its hashchange then has nothing left to do
  if (to) { landedOn = to.hash; location.hash = to.hash; }
  if (to || redrawDue) draw();
  redrawDue = false;
  if (to) reorderLater();
}

function settle(to) {
  touch = null;
  settling = true;
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  if (stillMotion()) { landed(to); return; }
  root.classList.add(to ? 'settle' : 'spring');
  root.classList.remove('swiping');
  const shift = to ? (to.back ? root.clientWidth : -root.clientWidth) : 0;
  root.firstElementChild.style.transform = `translate3d(${shift}px, 0, 0)`;
  pinSwitch(shift, to);
  root.querySelectorAll('.peek').forEach((p) => { p.style.transform = besideAt(p, shift); });
  setTimeout(() => landed(to), SETTLE_MS);
}

// Scrolled down by hand the head folds, at the top or on a tap of its line it opens again. One class change, no work per frame.
let foldFrame = 0;
function fold(next) {
  if (next === folded) return;
  folded = next;
  if (!next) foldFrom = root.querySelector('.path')?.scrollTop ?? 0;
  root.firstElementChild?.classList.toggle('head-min', folded);
}
root.addEventListener('scroll', (e) => {
  if (!byHand || !e.target.classList?.contains('path')) return;
  handAt = performance.now();
  if (foldFrame) return;
  foldFrame = requestAnimationFrame(() => {
    foldFrame = 0;
    const top = e.target.scrollTop;
    if (top <= 0) fold(false);
    else if (Math.abs(top - foldFrom) > FOLD_PX) fold(true);
  });
}, { capture: true, passive: true });
// set before the scroll it causes: a passive wheel may already have moved the list when its event comes
const handScroll = () => { byHand = true; follow = false; };
root.addEventListener('wheel', handScroll, { passive: true });
root.addEventListener('keydown', handScroll);
// A tap on the switch slides to the neighbour like a swipe does, so the mark glides over in the same 200 ms.
root.addEventListener('click', (e) => {
  const link = e.target.closest('.switch a:not([aria-current])');
  if (!link || settling || touch?.axis === 'x' || stillMotion()) return;
  const to = [targetOf(-1), targetOf(1)].find((t) => t?.hash === link.getAttribute('href'));
  if (!to) return;
  e.preventDefault();
  // a peek built now needs its first place laid out, or it would not slide in
  (peekOf(to) ?? buildPeek(to)).getBoundingClientRect();
  settle(to);
});
root.addEventListener('click', (e) => { if (folded && e.target.closest('.ring-head')) fold(false); });

root.addEventListener('touchstart', (e) => {
  handScroll();
  if (touch?.axis === 'x') { settle(null); return; } // a second finger ends the swipe
  const [first] = e.touches;
  const free = e.touches.length === 1 && !settling && route().page === 'guide' && !scrollsSideways(e.target);
  touch = free ? { x: first.clientX, y: first.clientY, lastX: first.clientX, at: e.timeStamp, speed: 0, axis: null, dx: 0, to: null } : null;
}, { passive: true });

// Not passive: once a touch is a swipe, the list under it must not scroll along.
root.addEventListener('touchmove', (e) => {
  if (!touch) return;
  const [now] = e.touches;
  const dx = now.clientX - touch.x;
  touch.axis ??= swipeAxis(dx, now.clientY - touch.y);
  if (touch.axis === 'y') { touch = null; return; }
  if (touch.axis !== 'x') return;
  if (e.cancelable) e.preventDefault();
  if (e.timeStamp > touch.at) touch.speed = SPEED_KEEP * touch.speed + (1 - SPEED_KEEP) * ((now.clientX - touch.lastX) / (e.timeStamp - touch.at));
  touch.lastX = now.clientX;
  touch.at = e.timeStamp;
  if (stillMotion()) return;
  touch.dx = dx;
  touch.to = targetOf(dx);
  if (touch.to && !peekOf(touch.to)) buildPeek(touch.to); // not ready yet: built now, once per side
  root.classList.add('swiping');
  frame ||= requestAnimationFrame(paint);
}, { passive: false });

root.addEventListener('touchcancel', () => {
  if (touch?.axis === 'x') settle(null);
  else touch = null;
}, { passive: true });

root.addEventListener('touchend', (e) => {
  if (touch?.axis !== 'x') { touch = null; return; }
  const dx = e.changedTouches[0].clientX - touch.x;
  // a finger that rested before lifting is no flick
  const speed = e.timeStamp - touch.at > FLICK_FRESH_MS ? 0 : touch.speed;
  const to = targetOf(dx);
  settle(to && swipeLands(dx, speed, root.clientWidth) ? to : null);
}, { passive: true });

window.addEventListener('hashchange', () => {
  if (landedOn === location.hash) { landedOn = null; return; }
  landedOn = null;
  draw();
  reorderLater();
});

if ('serviceWorker' in navigator && !plugin()) navigator.serviceWorker.register('sw.js').catch(() => {});

draw();
await Promise.all([
  loadBundled().then((list) => { bundled = list; }),
  showProfile(),
  loadStatsPreset().then((p) => { preset = p; }),
]);
loading = false;
// once: ticks from before the shared state. Without a guide loaded there is nothing to move yet.
pathEpoch++;
if (!load('pg.ownedV1', false) && guides().length) {
  ({ owned, checks } = migrateOwned(guides(), checks, owned));
  // the flag only follows when both are stored: a failed save runs it again next start, and twice changes nothing
  if (save('pg.owned', owned) && save('pg.checks', checks)) save('pg.ownedV1', true);
}
stamp();
draw();
loadForge().then((r) => { forge = r; pathEpoch++; drawInBackground(); });
loadAh().then((r) => { ah = r; pathEpoch++; drawInBackground(); });
loadElection().then((r) => { election = r; drawInBackground(); });
loadItemData().then((r) => { items = r; pathEpoch++; drawInBackground(); });
loadItems().then((r) => { names = r.names; tiers = r.tiers ?? {}; drawInBackground(); });
refreshPrices();
setInterval(refreshPrices, PRICE_EVERY);

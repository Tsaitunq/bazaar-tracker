// The guide app: state, routes, prices and events. What it shows is worked out in model.js and views/.
import { loadItemData, loadForge, loadAh, loadElection, freshBins, fetchBins } from '../../shared/data.js';
import { loadBundled, mergeGuides, exportData, importData, doneSet } from './progress.js';
import { isNative } from '../../shared/native.js';
import { migrateOwned, resetOwned } from './owned.js';
import { fallbackName, loadItems } from '../../shared/names.js';
import { PRESETS, miningSettings } from './optimizer.js';
import { loadGameData } from './gamedata.js';
import { emptyBuild, measure, editPart, commitDraft, discardDraft, EMPTY_PART, perkLevel, perkEnabled, abilityPick, hotmTier, omelette, attrLevel, powerStone, powerMp, tuningPoints, setPet, setPetItem, setGear } from './build.js';
import { runMigration } from './migrate.js';
import { expandChecks, collapseChecks, commitGuide, resetKeys } from './keys.js';
import { STATS_TABS, parseRoute, applyImport, stampAll, formEdited, typedFields, restoreTyped, settled, autoOf, tickStep, swipeTarget, swipeAxis, swipeLands, familyOf } from './model.js';
import { homeView } from './views/home.js';
import { guideView } from './views/guide.js';
import { statsView } from './views/stats.js';
import { settingsView } from './views/settings.js';
import { paintFigures } from './skin.js';
import { decide, finishTour, STEPS, tourHtml, newsHtml } from './intro.js';

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
const SPOT_PAD = 6;

const load = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const save = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; /* full or blocked: it stays for this session */ }
};

const root = document.getElementById('app');
let bundled = [];
let imported = load('pg.guides', []);
let checks = load('pg.checks', {}); // the marks of steps without a shared key, per guide
let keys = load('pg.keys', []); // ticks of steps with a shared key, for all guides
const live = () => expandChecks(guides(), checks, keys);
let dates = load('pg.dates', {});
let owned = load('pg.owned', []);
const settings = load('pg.settings', {});
let base = load('pg.base', {}); // the measured stats per area
let build = { ...emptyBuild(), ...load('pg.build', {}) }; // HOTM, shards, power and buffs now
let draft = load('pg.draft', {}); // a part the measurement did not know, typed but not saved yet
let wantPet = false; // the Pet tag or the floating pet was tapped: the power tab opens on the pet picker (true) or on that pet's card (its key)
let ui = {}; // the perk, attribute and search that are open; not saved
let gamedata = null;
const bins = load('pg.bins', {});
let products = null;
let forge = null;
let ah = {};
let items = null;
let election = null;
let names = {};
let dataMessage = '';
let dataText = '';
let armed = null;
let binsBusy = false;
let binsFailed = 0;
let pending = new Set();
let touch = null;
let settling = false;
let redrawDue = false;
let shownRoute = '';
let infoOpen = false; // the sheet of notes stays open over a redraw
let tiers = {};
let folded = false; // the head of a guide, down to its title line
let byHand = false; // a finger, wheel or key was used; the app's own scroll to the card does not fold the head
let handAt = -Infinity; // when a hand last moved the list: no reveal scroll pulls against it
let follow = false; // the list still sits where the app put it, so a redraw puts it on the card again
let foldFrom = 0; // where the list was when the head last opened
let loading = true; // until the guide files are read, an empty list means nothing yet
let pathEpoch = 0; // a new order of all paths: on a tick, on the first prices and when a setting changes
const opened = {}; // a new order of one path: when that guide opens. Going back reuses what home had, so it is quick

let changelog = null;
let tour = null; // { i, from } while the tour runs
let tourShown = -1; // the step whose card is on screen
const tourBox = Object.assign(document.createElement('div'), { id: 'tour', className: 'tour', hidden: true });
const newsBox = Object.assign(document.createElement('div'), { id: 'news', hidden: true });
document.body.append(tourBox, newsBox);
const store = { get: (key) => load(key, null), set: (key, value) => save(key, value) };
const theme = () => document.documentElement.dataset.theme ?? 'home';

const guides = () => mergeGuides(bundled, imported);
const route = () => parseRoute(location.hash, guides());
// A swipe moves between the guides of one area, like the switch at the top.
const targetOf = (dx) => {
  const r = route();
  const guide = guides().find((g) => g.id === r.id);
  return swipeTarget(r, dx, guide ? familyOf(guides(), guide).map((g) => g.id) : [r.id]);
};
const world = () => {
  pending = new Set();
  return {
    guides: guides(), checks: live(), owned, dates, base, build, draft, ui, gamedata, products, now: Date.now(),
    prices: { forge, ah, cofl: freshBins(bins), wants: pending, items, tax: (settings.tax ?? DEFAULT_TAX) / 100, derpy: election?.mayor?.name === 'Derpy' },
    settings: miningSettings(settings.mining), keepOldGear: settings.keepOldGear === true, brake: settings.brake > 0 ? settings.brake : 5, pathEpoch, opened, items,
    name: (id) => names[id] ?? fallbackName(id), tax: settings.tax ?? DEFAULT_TAX, importedIds: imported.map((g) => g.id),
    loading, dataMessage, dataText, armed,
  };
};

function screenOf(r, w) {
  if (r.page === 'stats') return statsView(w, r);
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
  if (ui.attr && shownRoute && JSON.stringify(route()) !== shownRoute) ui = { ...ui, attr: undefined }; // a sheet does not follow you to another page
  // a redraw would pull the screen from under the finger; it follows when the swipe is over
  // nor during Mark done: a new screen would drop the running line, dot and card; the tick draws once it is over
  if (settling || touch?.axis === 'x' || marking) { redrawDue = true; return; }
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
  paintFigures(root);
  fitTrees(root);
  const after = root.querySelector('.path, .scroll');
  if (after && after.className === list) after.scrollTop = top;
  const shown = JSON.stringify(route());
  if (shown !== shownRoute) {
    folded = false;
    infoOpen = false;
    byHand = false;
    follow = true;
  }
  // prices or item data that come after the opening reorder the path; until a hand or a tick moves the list, the card stays in sight
  if (shown !== shownRoute || follow) {
    showCard(root);
    foldFrom = root.querySelector('.path')?.scrollTop ?? 0;
  }
  shownRoute = shown;
  if (wantPet) {
    const panel = route().tab === 'power' && root.querySelector('.pet-panel');
    if (panel) (root.querySelector(`[data-pet-card="${wantPet}"]`) ?? panel).scrollIntoView({ block: 'start' });
    if (panel || route().tab !== 'power') wantPet = false;
  }
  root.firstElementChild?.classList.toggle('head-min', folded);
  if (infoOpen) openInfo();
  if (focused !== undefined) {
    const same = [...root.querySelectorAll('[data-step]')].filter((el) => el.dataset.step === focused);
    (same.find((el) => el.className === focusClass) ?? same[0])?.focus({ preventScroll: true });
  }
  preparePeek();
  askBins(pending);
  tourSync();
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

// The tour lives outside #app, so a redraw does not remove it; after each draw the spotlight finds its element again.
function tourSync() {
  tourBox.hidden = !tour;
  root.inert = !!tour;
  if (!tour) { tourShown = -1; return; }
  tourBox.dataset.theme = theme();
  const fresh = tourShown !== tour.i;
  if (fresh) {
    tourBox.innerHTML = tourHtml(tour.i);
    tourShown = tour.i;
    tourBox.querySelector('[data-tour="next"]').focus();
  }
  const el = root.querySelector(STEPS[tour.i].target);
  const hole = tourBox.querySelector('.tour-hole');
  tourBox.classList.toggle('tour-nohole', !el); // a missing element: the step shows without a spotlight
  hole.hidden = !el;
  if (!el) return;
  if (fresh) el.scrollIntoView({ block: 'center', behavior: 'instant' });
  const r = el.getBoundingClientRect();
  // a panel taller than the screen is lit as far as it shows
  const top = Math.max(r.top - SPOT_PAD, 0);
  const bottom = Math.min(r.bottom + SPOT_PAD, innerHeight);
  Object.assign(hole.style, { left: `${r.left - SPOT_PAD}px`, top: `${top}px`, width: `${r.width + 2 * SPOT_PAD}px`, height: `${bottom - top}px` });
  tourBox.dataset.card = (top + bottom) / 2 > innerHeight / 2 ? 'top' : 'bottom';
}

function tourGo(i) {
  tour = { ...tour, i };
  const want = STEPS[i].hash(guides()[0]?.id);
  if ((location.hash || '#/') !== want) location.hash = want;
  else tourSync();
}

function tourStart() {
  tour = { i: 0, from: location.hash || '#/' };
  tourShown = -1;
  tourGo(0);
}

function tourEnd() {
  const { from } = tour;
  tour = null;
  finishTour(store);
  if ((location.hash || '#/') !== from) location.hash = from;
  tourSync();
}

function newsShow(versions) {
  newsBox.dataset.theme = theme();
  newsBox.innerHTML = newsHtml(versions);
  newsBox.hidden = false;
  newsBox.querySelector('.bs-close').focus();
}
const newsClose = () => { newsBox.hidden = true; newsBox.innerHTML = ''; };

async function startIntro() {
  try { changelog = await (await fetch('changelog.json')).json(); } catch { /* offline and not cached yet: no news this time */ }
  const what = decide(store, changelog);
  if (what.type === 'tour') tourStart();
  else if (what.type === 'news') newsShow(what.news);
}

tourBox.addEventListener('click', (e) => {
  const b = e.target.closest('[data-tour]');
  if (!b || !tour) return;
  if (b.dataset.tour === 'next' && tour.i + 1 < STEPS.length) tourGo(tour.i + 1);
  else tourEnd();
});
newsBox.addEventListener('click', (e) => { if (e.target.closest('[data-news-close]')) newsClose(); });
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (tour) tourEnd();
  else if (!newsBox.hidden) newsClose();
});

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

function stamp() {
  dates = stampAll(guides(), live(), dates, Date.now(), owned);
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
  setTimeout(() => {
    marking = false;
    redrawDue = false;
    toggle(key, true);
    // the tick found no guide (the route moved on meanwhile): the held redraw still follows
    if (root.querySelector('.marking')) draw();
  }, MARK_MS);
}

function toggle(key, fromCard = false) {
  const r = route();
  const guide = guides().find((g) => g.id === r.id);
  if (!guide) return;
  const marks = new Set(live()[guide.id] ?? []);
  const on = !doneSet(guide, marks, autoOf(guide, owned)).has(key);
  owned = [...tickStep({ guide, key, on, marks, owned })];
  ({ checks, keys } = commitGuide(guides(), guide, marks, checks, keys));
  save('pg.checks', checks);
  save('pg.keys', keys);
  save('pg.owned', owned);
  dataText = ''; // an export from before this tick must not come back by accident
  follow = false; // the list stays under the finger that ticked
  pathEpoch++;
  stamp();
  draw();
  if (fromCard) revealCard();
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
    ({ checks, keys } = collapseChecks(guides(), checks, keys));
    pathEpoch++;
    save('pg.guides', imported);
    save('pg.checks', checks);
    save('pg.keys', keys);
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
  dataText = exportData(guides(), live(), owned);
  let copied = false;
  try { await navigator.clipboard.writeText(dataText); copied = true; } catch { /* the text field holds it */ }
  // the Android WebView has no downloads, so there the text and the clipboard are the export
  if (!isNative()) {
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

// The typed /stats become the base of the area, with a snapshot of the build.
function saveMeasure(box) {
  const area = box.dataset.statsArea;
  const values = Object.fromEntries([...box.querySelectorAll('[data-stats-stat]')].map((input) => [input.dataset.statsStat, input.value]));
  base = measure(base, area, { values, mp: box.querySelector('[data-stats-mp]')?.value }, build, Date.now());
  save('pg.base', base);
  pathEpoch++;
  location.hash = `#/stats/overview/${area}`;
  draw();
}

// An editor change: the build, the measured bases (the first entry backfills them) and the draft are saved together.
function edit(part, change) {
  ({ build, base, draft } = editPart({ build, base, draft }, part, change));
  save('pg.draft', draft);
  save('pg.base', base);
  saveBuild();
}

function draftDone(part, keep) {
  ({ build, base, draft } = (keep ? commitDraft : discardDraft)({ build, base, draft }, part));
  save('pg.draft', draft);
  save('pg.base', base);
  saveBuild();
}

const partNow = (part) => draft[part] ?? build[part] ?? EMPTY_PART[part]();
const perkOpen = () => gamedata?.hotm.perks.find((p) => p.id === ui.perk);
const attrOpen = () => gamedata?.attributes.attributes.find((a) => a.key === ui.attr);

// The level buttons and the number field of the open perk or attribute.
function setLevel(kind, level) {
  if (kind === 'perk' && perkOpen()) edit('hotm', perkLevel(perkOpen(), level));
  if (kind === 'attr' && attrOpen()) edit('attrs', attrLevel(attrOpen(), level));
}

// The pet picker: "ID:RARITY" or empty for none. The pet is gear, so it is saved without a draft.
function setPetChoice(key) {
  const [id, rarity] = key.split(':');
  build = setPet(build, key ? { id, rarity } : null);
  saveBuild();
}

function saveBuild() {
  save('pg.build', build);
  pathEpoch++;
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
  const step = el('[data-step]');
  if (step) { if (step.closest('.card')) markCard(step, step.dataset.step); else toggle(step.dataset.step); return; }
  if (el('[data-stats-save]')) { saveMeasure(el('[data-stats-area]')); return; }
  const save1 = el('[data-draft-save]');
  if (save1) { draftDone(save1.dataset.draftSave, true); return; }
  const drop = el('[data-draft-discard]');
  if (drop) { draftDone(drop.dataset.draftDiscard, false); return; }
  const perk = el('[data-perk]');
  if (perk) { ui = { ...ui, perk: perk.dataset.perk }; draw(); return; }
  const attr = el('[data-attr]');
  if (attr) { ui = { ...ui, attr: attr.dataset.attr }; draw(); return; }
  if (el('[data-attr-close]')) { ui = { ...ui, attr: undefined }; draw(); return; }
  if (el('[data-attr-all]')) { ui = { ...ui, attrAll: !ui.attrAll }; draw(); return; }
  const stepBy = el('[data-perk-step], [data-attr-step]');
  if (stepBy) {
    const kind = stepBy.hasAttribute('data-perk-step') ? 'perk' : 'attr';
    const now = kind === 'perk' ? partNow('hotm').levels[ui.perk] ?? 0 : partNow('attrs')[ui.attr] ?? 0;
    setLevel(kind, now + Number(stepBy.dataset[kind + 'Step']));
    return;
  }
  if (el('[data-perk-enabled]') && perkOpen()) { edit('hotm', perkEnabled(perkOpen(), (partNow('hotm').disabled ?? []).includes(perkOpen().id))); return; }
  if (el('[data-ability-pick]') && perkOpen()) { edit('hotm', abilityPick(perkOpen())); return; }
  const goPet = el('[data-goto-pet]');
  if (goPet) { wantPet = goPet.dataset.gotoPet || true; return; } // the link itself opens the power tab
  if (el('[data-perk-max]')) { setLevel('perk', perkOpen()?.maxLevel ?? 0); return; }
  if (el('[data-attr-max]')) { setLevel('attr', attrOpen()?.maxLevel ?? 0); return; }
  const pet = el('[data-pet]');
  if (pet) { setPetChoice(pet.dataset.pet); return; }
  const petItem = el('[data-pet-item]');
  if (petItem) { build = setPetItem(build, petItem.dataset.petItem); saveBuild(); return; }
  const stone = el('[data-power-stone]');
  if (stone) { edit('power', powerStone(stone.dataset.powerStone)); return; }
  const tune = el('[data-tune]');
  if (tune) { edit('power', tuningPoints(tune.dataset.tune, (partNow('power').tuning?.[tune.dataset.tune] ?? 0) + Number(tune.dataset.tuneStep))); return; }
  const reset = el('[data-reset]');
  if (reset) { armed = reset.dataset.reset; draw(); return; }
  if (el('[data-reset-no]')) { armed = null; draw(); return; }
  const yes = el('[data-reset-yes]');
  if (yes) {
    armed = null;
    const gone = guides().find((g) => g.id === yes.dataset.resetYes);
    checks = { ...checks, [yes.dataset.resetYes]: [] };
    owned = [...resetOwned(gone, owned)];
    keys = resetKeys(gone, keys);
    save('pg.keys', keys);
    pathEpoch++;
    save('pg.checks', checks);
    save('pg.owned', owned);
    stamp();
    draw();
    return;
  }
  const act = el('[data-act]')?.dataset.act;
  if (act === 'mining-reset') { settings.mining = null; saveSettings(); }
  if (act === 'tour') tourStart();
  if (act === 'news' && changelog) newsShow(changelog.versions);
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

root.addEventListener('input', (e) => {
  if (!e.target.matches('[data-attr-query]')) return;
  ui = { ...ui, attrQuery: e.target.value };
  draw();
});

root.addEventListener('change', async (e) => {
  const { dataset } = e.target;
  if (e.target.matches('[data-hotm-tier]')) { settled(e.target); return edit('hotm', hotmTier(e.target.value === '' ? null : Number(e.target.value))); }
  if (e.target.matches('[data-hotm-omelette]')) { settled(e.target); return edit('hotm', omelette(e.target.checked)); }
  if (e.target.matches('[data-perk-level]')) { settled(e.target); return setLevel('perk', e.target.value); }
  if (e.target.matches('[data-attr-level]')) { settled(e.target); return setLevel('attr', e.target.value); }
  if (e.target.matches('[data-power-mp]')) { settled(e.target); return edit('power', powerMp(e.target.value)); }
  if (dataset.gear) { settled(e.target); build = setGear(build, { [dataset.gear]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }); return saveBuild(); }
  if (dataset.buff) { settled(e.target); build = { ...build, buffs: { ...build.buffs, [dataset.buff]: e.target.checked } }; return saveBuild(); }
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
  return undefined;
});

// The HOTM tree is 336 px wide; on a narrower screen it shrinks to fit, so the list never scrolls sideways and keeps the swipe.
function fitTrees(el) {
  for (const tree of el.querySelectorAll('.tree')) {
    const room = tree.parentElement.clientWidth;
    tree.style.zoom = room > 0 && room < tree.offsetWidth ? String(room / tree.offsetWidth) : '';
  }
}

// A list that scrolls sideways keeps its own swipe.
function scrollsSideways(el) {
  for (; el && el !== root; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth && /auto|scroll/.test(getComputedStyle(el).overflowX)) return true;
  }
  return false;
}

// guide pages and the four stats tabs swipe; the measure form does not
const swipeable = (r) => r.page === 'guide' || (r.page === 'stats' && STATS_TABS.includes(r.tab));

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
  fitTrees(peek);
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
    if (!touch && !settling && !marking) targets.filter((to) => !peekOf(to)).forEach(buildPeek);
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
// A picture that is not there leaves its placeholder (the error event does not bubble, so it is caught on the way down).
root.addEventListener('error', (e) => e.target.closest?.('.pic')?.classList.add('pic-miss'), true);
root.addEventListener('wheel', handScroll, { passive: true });
root.addEventListener('keydown', handScroll);
// A tap on the switch slides to the neighbour like a swipe does, so the mark glides over in the same 200 ms.
root.addEventListener('click', (e) => {
  const link = e.target.closest('.switch a:not([aria-current])');
  if (!link || settling || marking || touch?.axis === 'x' || stillMotion()) return;
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
  const free = e.touches.length === 1 && !settling && !marking && swipeable(route()) && !e.target.closest('input, select, .bsheet, .sheet-back') && !scrollsSideways(e.target);
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

if ('serviceWorker' in navigator && !isNative()) navigator.serviceWorker.register('sw.js').catch(() => {});

draw();
await Promise.all([
  loadBundled().then((list) => { bundled = list; }),
  loadGameData(async (name) => (await fetch(`gamedata/${name}.json`)).json()).then((d) => { gamedata = d; }).catch(() => {}),
]);
loading = false;
pathEpoch++;
// once: recognised ticks become manual ticks, key and profile go. Without a guide loaded there is nothing to move yet.
const drop = (key) => { try { localStorage.removeItem(key); } catch { /* blocked: the next start tries again */ } };
if (await runMigration({ read: load, write: save, drop }, guides())) {
  checks = load('pg.checks', {});
  keys = load('pg.keys', []);
  owned = load('pg.owned', []);
}
stamp();
draw();
startIntro();
loadForge().then((r) => { forge = r; pathEpoch++; drawInBackground(); });
loadAh().then((r) => { ah = r; pathEpoch++; drawInBackground(); });
loadElection().then((r) => { election = r; drawInBackground(); });
loadItemData().then((r) => { items = r; pathEpoch++; drawInBackground(); });
loadItems().then((r) => { names = r.names; tiers = r.tiers ?? {}; drawInBackground(); });
refreshPrices();
setInterval(refreshPrices, PRICE_EVERY);

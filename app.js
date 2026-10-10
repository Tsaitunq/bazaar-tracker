import { buildFlips, computeFlip, opportunities, portfolio, MAX_SLOTS, statOf, searchFlip, flipIssues, oppIssues, bySort, planWarnings, trackPlan } from './flips.js';
import { npcFlips } from './npc.js';
import { craftFlips, craftHints } from './craft.js';
import { forgeFlips, forgeFlip } from './forge.js';
import { minionRows, FUELS, UPGRADES, MAX_TIER } from './minions.js';
import { loadItems, fallbackName } from './names.js';
import { loadStats, loadRecipes, loadForge, loadAh, loadElection, loadTiming, loadHistory } from './data.js';
import { plugin, syncAlerts, syncNames, onRoute, requestAlertPermission } from './native.js';
import { flipCard, npcCard, craftCard, forgeCard, forgeFilter, searchCard, radarView, trendsView, todayView, minionCard, parseRoute, detailView, portfolioView, warningsView, FILTERS, activeFilters, filterChips, swipeTab, dragOffset, tabsFor, viewsFor, areaOf, coins, percent, PLACEHOLDER_ICON } from './render.js';
import { chartHit, when } from './chart.js';
import { level } from './trends.js';
import { activePerks, upcoming, electionWindow, eventItems, flipRisks, planElection } from './events.js';
import { bindSheet, openSheet } from './sheet.js';
import { initOnboarding, refreshHints, offerAdvanced, returning } from './tour.js';

const API = 'https://api.hypixel.net/v2/skyblock/bazaar';
const MAX_ROWS = 100;
const PULL_PX = 70;
const STATS_TTL = 20 * 60000;
const CARDS = { flips: flipCard, opps: flipCard, npc: npcCard, craft: craftCard, forge: forgeCard };
const DEFAULTS = { tax: 1.25, minVolume: 100000, maxCapital: 5000000, interval: 2, share: 5, sort: 'profitHour', favOnly: false, alerts: false, alertMargin: 5,
  marketAlerts: false, marketMargin: 10, marketMinVolume: 100000, marketMinProfit: 100000, marketCooldown: 6, eventAlerts: false, mayorAlerts: false,
  portfolioCapital: 50000000, portfolioSlots: MAX_SLOTS, portfolioMargin: 3, portfolioTurnover: 1000000000, hotm: 10, forgeAh: true,
  portfolioDrop: 5, portfolioCooldown: 6, planPriceAlerts: false, planSuspiciousAlerts: false, planElectionAlerts: false, planLeavingAlerts: false };
const PLAN_ALERTS = ['planPriceAlerts', 'planSuspiciousAlerts', 'planElectionAlerts', 'planLeavingAlerts'];

const $ = (id) => document.getElementById(id);
const load = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };

// the fields of the panel; they take effect together, on Apply
const FIELDS = ['tax', 'interval', 'share', 'minVolume', 'maxCapital', 'alertMargin', 'marketMargin', 'marketMinVolume', 'marketMinProfit', 'marketCooldown', 'portfolioCapital', 'portfolioSlots', 'portfolioMargin', 'portfolioTurnover', 'hotm', 'portfolioDrop', 'portfolioCooldown'];
const settings = { ...DEFAULTS, ...load('bt.settings', {}) };
// A stored interval of 0 would refresh in a tight loop, so bad values fall back to defaults.
function sanitize() {
  for (const key of ['tax', 'interval', 'sort']) {
    if (![...$(key).options].some((o) => o.value === String(settings[key]))) settings[key] = DEFAULTS[key];
  }
  for (const key of ['minVolume', 'maxCapital', 'marketMinVolume', 'marketMinProfit', 'portfolioCapital', 'portfolioTurnover']) {
    if (!(settings[key] >= 0)) settings[key] = DEFAULTS[key];
  }
  if (!(settings.share > 0 && settings.share <= 100)) settings.share = DEFAULTS.share;
  if (!(settings.alertMargin > 0 && settings.alertMargin <= 1000)) settings.alertMargin = DEFAULTS.alertMargin;
  settings.alerts = settings.alerts === true;
  if (!(settings.marketMargin > 0 && settings.marketMargin <= 1000)) settings.marketMargin = DEFAULTS.marketMargin;
  if (!(settings.portfolioMargin > 0 && settings.portfolioMargin <= 1000)) settings.portfolioMargin = DEFAULTS.portfolioMargin;
  if (!(settings.marketCooldown > 0 && settings.marketCooldown <= 168)) settings.marketCooldown = DEFAULTS.marketCooldown;
  settings.marketAlerts = settings.marketAlerts === true;
  settings.eventAlerts = settings.eventAlerts === true;
  settings.mayorAlerts = settings.mayorAlerts === true;
  // more than the bazaar's 21 orders (older versions took up to 50) becomes 21
  settings.portfolioSlots = Math.min(MAX_SLOTS, Math.floor(settings.portfolioSlots));
  if (!(settings.portfolioSlots >= 1)) settings.portfolioSlots = DEFAULTS.portfolioSlots;
  settings.hotm = Math.floor(settings.hotm);
  if (!(settings.hotm >= 0 && settings.hotm <= 10)) settings.hotm = DEFAULTS.hotm;
  settings.forgeAh = settings.forgeAh !== false;
  if (!(settings.portfolioDrop > 0 && settings.portfolioDrop <= 90)) settings.portfolioDrop = DEFAULTS.portfolioDrop;
  if (!(settings.portfolioCooldown > 0 && settings.portfolioCooldown <= 168)) settings.portfolioCooldown = DEFAULTS.portfolioCooldown;
  for (const key of PLAN_ALERTS) settings[key] = settings[key] === true;
}
sanitize();
// A new user starts in Simple mode; whoever used the app before keeps everything (Pro). Stored at once,
// so the second start does not take a new user for a returning one.
if (settings.mode !== 'simple' && settings.mode !== 'pro') {
  settings.mode = returning ? 'pro' : 'simple';
  save('bt.settings', settings);
}
const simple = () => settings.mode === 'simple';
const tabs = () => tabsFor(settings.mode);
// a page that Simple mode does not show opens as Flips
function readRoute() {
  const r = parseRoute(location.hash);
  return r.view !== 'item' && !viewsFor(settings.mode).includes(r.view) ? { view: 'flips' } : r;
}
// Without an address the app opens where it was left; the very first time that is Today.
if (!location.hash) history.replaceState(null, '', String(load('bt.route', '#/today')));
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
let timing = {};     // past runs per event and perk, for the radar's price patterns
let marked = {};     // item id -> event or perk it belongs to right now
let lastStats = 0;
let route = readRoute();
let lastList = route.view === 'item' ? 'flips' : route.view; // where the detail page's back link goes
let lastTab = tabs().includes(route.view) ? route.view : 'flips'; // the Trade tab the bar's Trade button opens
let flips = [];
let plan = null; // the portfolio: shown in the Opportunities tab and on Today
// The plan the player last saw, as [{ id, buy }]: what the warnings and the Android worker compare the market with.
const storedPlan = load('bt.plan', null);
let tracked = Array.isArray(storedPlan) ? storedPlan.filter((i) => typeof i?.id === 'string' && i.buy > 0) : null;
let alerts = [];  // warnings about the tracked plan, each with the item's name
// Today's "new since your last visit": the opportunities of the last visit, or null when there was none.
const storedOpps = load('bt.opps', null);
let lastVisit = Array.isArray(storedOpps) ? new Set(storedOpps) : null;
let opps = [];    // the opportunities right now, best profit per hour first
const AWAY_MS = 30 * 60000; // back after this long counts as a new visit
let lastFetch = 0;
let timer;
let busy = false;
let hist = { id: null, points: null }; // 7 days of history for the open item, loaded once
let range = '24h';
let otherHits = 0;        // search hits below the tab's own flips
let detailSuspicious = false;
let markReady; // resolved once the first list is on screen, so the tour has something to point at
const ready = new Promise((resolve) => { markReady = resolve; });
const shown = new Map(); // last rendered big numbers per view and item, to flash the ones that changed

// the Trade tab in use; in the other areas that is the one last opened
const view = () => (tabs().includes(route.view) ? route.view : lastTab);
const area = () => areaOf(route.view);
// One place for what a new address means: the back link, the Trade button and where the next start opens.
function noteRoute() {
  if (route.view === 'item') return;
  lastList = route.view;
  if (tabs().includes(route.view)) lastTab = route.view;
  else if (!tabs().includes(lastTab)) lastTab = 'flips'; // a Pro tab does not survive the switch to Simple
  save('bt.route', `#/${route.view}`);
}
noteRoute();
const nameOf = (id) => names[id] ?? fallbackName(id);
// "Trend" only reorders what is shown: the lists are built in their usual order and sorted afterwards
const baseOpts = () => ({ ...settings, tax: settings.tax / 100, share: settings.share / 100, stats, sort: settings.sort === 'trend' ? 'profitHour' : settings.sort,
  derpy: election?.mayor?.name === 'Derpy' });
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

// The portfolio, with what a row shows besides its numbers.
function buildPlan() {
  // The plan has its own floors: a lower margin, because items that trade a lot rarely have a high one,
  // and the week's turnover in coins instead of units, so expensive items can take part.
  const pf = portfolio(products, { ...oppOpts(), minMargin: settings.portfolioMargin / 100, minTurnover: settings.portfolioTurnover, capital: settings.portfolioCapital, slots: settings.portfolioSlots });
  const risks = flipRisks(election, Date.now());
  const crafts = recipes ? craftHints(pf.flips, products, recipes, baseOpts()) : {};
  for (const f of pf.flips) {
    f.name = nameOf(f.id);
    f.risk = risks[f.id]?.text; // what the election may do to this item's price, in words
    f.craft = crafts[f.id] && { ...crafts[f.id], name: nameOf(crafts[f.id].id) };
  }
  return pf;
}

// The flips of one tab, with names.
function compute(v) {
  marked = eventItems(Date.now(), election);
  const opts = baseOpts();
  let list;
  if (v === 'flips') list = buildFlips(products, { ...opts, favs });
  else if (v === 'opps') list = opportunities(products, oppOpts());
  else if (v === 'npc') list = npcFlips(products, npc, opts);
  else if (v === 'forge') list = forge ? forgeFlips(products, forge, ah, opts) : [];
  else list = recipes ? craftFlips(products, recipes, opts) : [];
  for (const f of list) {
    decorate(f);
    for (const i of f.ingredients ?? []) i.name = nameOf(i.id);
  }
  if (settings.sort === 'trend') list.sort(bySort('trend'));
  return list;
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

// What the Android worker gets about the plan; sent again only when it changed.
let planSent = '';
const planConfig = () => ({ items: tracked ?? [], ...planElection((tracked ?? []).map((i) => i.id), election, Date.now()) });
const sync = () => syncAlerts(settings, favs, names, planConfig());

// Compares the tracked plan with the market, then lets it follow the current plan (see trackPlan).
// Without the stats there is no plan at all, so nothing is stored until they are there.
function watchPlan() {
  if (!stats) return;
  const market = planWarnings(tracked ?? [], products, { tax: settings.tax / 100, drop: settings.portfolioDrop / 100, stats });
  tracked = trackPlan(tracked, plan.flips, market.length > 0);
  save('bt.plan', tracked);
  const risks = flipRisks(election, Date.now());
  alerts = [...market, ...tracked.filter((i) => risks[i.id]).map((i) => ({ id: i.id, ...risks[i.id] }))]
    .map((w) => ({ ...w, name: nameOf(w.id) }));
  const config = JSON.stringify(planConfig());
  if (config !== planSent) { planSent = config; sync(); }
}
const marketWarned = () => alerts.some((w) => w.kind === 'price' || w.kind === 'suspicious');

function recompute() {
  if (!products) return;
  plan = buildPlan();
  watchPlan();
  opps = opportunities(products, { ...oppOpts(), sort: 'profitHour' });
  for (const f of opps) f.name = nameOf(f.id);
  // without the stats the list is empty, and an empty list would make everything "new" next time
  if (stats) save('bt.opps', opps.map((f) => f.id));
  if (route.view !== 'item') flips = compute(view());
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
      ? warningsView(alerts, { dismiss: marketWarned() }) + portfolioView(pf, { capital: settings.portfolioCapital, slots: settings.portfolioSlots, sharePercent: settings.share, simple: simple() })
      : v === 'forge' ? forgeFilter(settings.forgeAh) : '',
    count: q ? `${rows.length} ${rows.length === 1 ? 'flip' : 'flips'}, ${rest.length} other ${rest.length === 1 ? 'item' : 'items'}`
      : `${Math.min(rows.length, MAX_ROWS)} of ${rows.length} flips`,
    list: cards,
    rest: rest.length,
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
  const data = { election, perks: activePerks(election), events: upcoming(now, election), vote: electionWindow(now), now, name: nameOf, timing };
  const plain = radarView(data);
  if (plain === radarShown) return;
  const box = $('radar');
  const open = new Set([...box.querySelectorAll('details[open]')].map((d) => d.dataset.key));
  radarShown = plain;
  box.innerHTML = radarView({ ...data, open });
}

// The minion setup: its own small form, stored apart from the settings because it changes nothing else.
const MINION_FIELDS = { tier: 'm-tier', count: 'm-count', fuel: 'm-fuel', up1: 'm-up1', up2: 'm-up2' };
const minionSetup = { tier: 11, count: 1, fuel: 'lava', up1: 'compactor', up2: 'spreading', ...load('bt.minions', {}) };
const options = (list) => list.map((o) => `<option value="${o.key}">${o.name}</option>`).join('');
$('m-tier').innerHTML = Array.from({ length: MAX_TIER }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
$('m-fuel').innerHTML = options(FUELS);
$('m-up1').innerHTML = $('m-up2').innerHTML = options(UPGRADES);
for (const [key, id] of Object.entries(MINION_FIELDS)) {
  $(id).value = minionSetup[key];
  // a stored value the lists no longer have falls back to the first option
  if ($(id).tagName === 'SELECT' && $(id).selectedIndex < 0) $(id).selectedIndex = 0;
}
$('minion-setup').addEventListener('change', () => {
  for (const [key, id] of Object.entries(MINION_FIELDS)) minionSetup[key] = key === 'tier' || key === 'count' ? Number($(id).value) : $(id).value;
  minionSetup.count = Math.min(50, Math.max(1, Math.floor(minionSetup.count) || 1));
  $('m-count').value = minionSetup.count;
  save('bt.minions', minionSetup);
  render();
});
$('minion-setup').addEventListener('submit', (e) => e.preventDefault());

// The areas that are one page each. Trade is drawn by renderPage itself.
function renderArea() {
  if (area() === 'minions' && products) {
    const rows = minionRows(products, npc, { ...minionSetup, upgrades: [minionSetup.up1, minionSetup.up2] }, { tax: settings.tax / 100 });
    $('minion-note').textContent = `${rows.length} minions, best first · coins per day for ${minionSetup.count === 1 ? '1 minion' : `${minionSetup.count} minions`} · Bazaar = sold at once to buy orders, after tax`;
    $('minion-list').innerHTML = rows.map(minionCard).join('');
  }
  if (area() === 'today') {
    const now = Date.now();
    const risks = flipRisks(election, now);
    $('today').innerHTML = products ? todayView({
      plan, capital: settings.portfolioCapital, slots: settings.portfolioSlots, alerts, dismiss: marketWarned(),
      events: upcoming(now, election), vote: electionWindow(now), election,
      voteItems: Object.keys(risks).filter((id) => risks[id].kind === 'election'),
      fresh: (lastVisit ? opps.filter((f) => !lastVisit.has(f.id)) : opps).slice(0, 3), firstVisit: !lastVisit, now, name: nameOf,
    }) : '<p class="count muted">Loading…</p>';
  }
  if (area() === 'market') {
    renderRadar();
    if (products) $('trends').innerHTML = trendsView(compute('flips'));
  }
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
  // an item that is not on the bazaar (a forge result) has no history to be provisional about
  const stat = { ...statOf(stats, id), ...(products && !products[id] && { provisional: false }) };
  const flip = products?.[id] ? computeFlip(id, products[id], settings.tax / 100, settings.maxCapital, settings.share / 100, stat.median) : null;
  // the item's forge recipe, shown whatever the Forge tab's filters say
  const forged = products && forge?.[id] ? forgeFlip(id, forge[id], products, ah, baseOpts()) : null;
  detailSuspicious = !!flip?.suspicious;
  for (const i of forged?.ingredients ?? []) i.name = nameOf(i.id);
  $('detail').innerHTML = detailView({ ...decorate({ id, sell: flip?.sell }), flip, forge: forged, ...stat, back: lastList, isFav: favs.has(id), range, points, tax: settings.tax / 100 });
  flashChanges();
}

// The context hints that fit what is on screen, most specific first. tour.js shows the first one
// that has not been seen yet.
function hintsNow() {
  if (route.view === 'item') return [detailSuspicious && 'suspicious', 'detail'];
  if (area() !== 'trade') return [area() === 'market' && 'radar', area() === 'minions' && 'minions', area() === 'today' && alerts.length > 0 && 'planalerts', area() === 'today' && 'today'];
  const v = view();
  return [
    ...($('panel').open && !$('settings').classList.contains('filtering') ? ['alerts', 'settings'] : []),
    $('search').value.trim() && otherHits > 0 && 'search',
    favs.size > 0 && 'fav',
    v === 'flips' ? 'card' : v,
    v === 'opps' && alerts.length > 0 && 'planalerts',
    v === 'opps' && plan?.flips.length > 0 && 'portfolio',
    v === 'opps' && plan?.flips.some((f) => f.craft) && 'crafthint',
  ];
}

function render() {
  renderPage();
  refreshHints();
}

function renderPage() {
  const item = route.view === 'item';
  // cards fade in on a normal render, but not when a swipe has just slid them into place
  document.querySelector('main').classList.toggle('sliding', switching);
  document.body.classList.toggle('detail', item);
  document.body.dataset.area = area();
  for (const a of document.querySelectorAll('#areas a')) {
    if (a.dataset.area === area()) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  document.querySelector('#areas [data-area="trade"]').setAttribute('href', `#/${lastTab}`);
  if (item) return renderDetail();
  $('detail').innerHTML = '';
  renderArea();
  for (const a of document.querySelectorAll('#tabs a')) {
    if (a.getAttribute('href') !== `#/${view()}`) a.removeAttribute('aria-current');
    else if (!a.hasAttribute('aria-current')) {
      a.setAttribute('aria-current', 'page');
      // the tab bar scrolls sideways on a narrow screen: bring the active tab to its middle
      $('tabs').scrollLeft = a.offsetLeft - ($('tabs').clientWidth - a.offsetWidth) / 2;
    }
  }
  const filters = activeFilters(view(), settings, DEFAULTS);
  $('filter-count').textContent = filters.length || '';
  $('open-filters').setAttribute('aria-label', filters.length ? `Filter, ${filters.length} active` : 'Filter');
  $('chips').innerHTML = filterChips(filters, settings);
  if (!products) return;
  const markup = listMarkup(view(), flips, plan);
  $('portfolio').innerHTML = markup.portfolio;
  $('count').textContent = markup.count;
  $('list').innerHTML = markup.list;
  otherHits = markup.rest;
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
  [stats, ah, election, timing] = await Promise.all([loadStats(), loadAh(), loadElection(), loadTiming()]);
  recompute();
  render();
}

function applyMode() {
  // Simple mode has no field for the cap per flip, so there is none
  if (simple()) settings.maxCapital = 0;
  document.body.dataset.mode = settings.mode;
  for (const b of document.querySelectorAll('[data-set-mode]')) b.setAttribute('aria-pressed', b.dataset.setMode === settings.mode);
  // an option cannot be hidden by the stylesheet in every browser
  for (const o of document.querySelectorAll('#sort .pro')) o.hidden = o.disabled = simple();
}

function applySettings() {
  applyMode();
  save('bt.settings', settings);
  $('fav-only').setAttribute('aria-pressed', settings.favOnly);
  sync();
  recompute();
  render();
}

const fillForm = () => { for (const key of FIELDS) $(key).value = settings[key]; };
fillForm();
$('sort').value = settings.sort;
$('sort').addEventListener('change', (e) => {
  settings.sort = e.target.value;
  applySettings();
});
// Apply: the fields go through the same checks as before, all at once
$('settings').addEventListener('submit', (e) => {
  e.preventDefault();
  const before = { ...settings };
  for (const key of FIELDS) settings[key] = Math.max(0, Number($(key).value) || 0);
  sanitize();
  applySettings();
  if (settings.interval !== before.interval) schedule();
  $('panel').close();
});

// One panel for both buttons: all settings, or (tab given) only the fields that narrow that tab's list.
// modal: false is for the tour, whose spotlight has to stay on top.
function openPanel(tab, modal = true) {
  const only = tab ? FILTERS[tab] : null;
  $('panel-title').textContent = only ? 'Filter' : 'Settings';
  $('settings').classList.toggle('filtering', !!only);
  for (const key of FIELDS) $(key).closest('label').classList.toggle('on', !!only?.includes(key));
  openSheet($('panel'), modal);
  refreshHints();
}
bindSheet($('panel'));
// closed without Apply: what was typed is dropped
$('panel').addEventListener('close', () => { fillForm(); refreshHints(); });
// Reset fills the fields on screen with the defaults; Apply makes it count
$('panel').addEventListener('click', (e) => {
  if (!e.target.closest('[data-act="reset"]')) return;
  for (const key of FIELDS) if ($(key).getClientRects().length) $(key).value = DEFAULTS[key];
});
$('open-filters').addEventListener('click', () => openPanel(view()));
$('settings').addEventListener('click', (e) => {
  // the setup assistant opens its own window (tour.js)
  if (e.target.closest('[data-act="setup"]')) return $('panel').close();
  const mode = e.target.closest('[data-set-mode]')?.dataset.setMode;
  if (!mode || mode === settings.mode) return;
  settings.mode = mode;
  // Simple mode offers two ways to sort; nothing else is reset
  if (simple() && !['profitHour', 'margin'].includes(settings.sort)) $('sort').value = settings.sort = 'profitHour';
  route = readRoute();
  noteRoute();
  applySettings();
  if (!simple()) offerAdvanced();
});
$('search').addEventListener('input', render);
$('refresh').addEventListener('click', refresh);
$('fav-only').addEventListener('click', () => {
  settings.favOnly = !settings.favOnly;
  applySettings();
});
$('toggle-settings').addEventListener('click', () => openPanel());
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
  // "Got it" on the warnings: from now on the market is compared with the plan as it is now
  if (e.target.closest('[data-act="plan-seen"]')) {
    tracked = trackPlan(null, plan?.flips ?? []);
    recompute();
    return render();
  }
  const drop = e.target.closest('[data-unfilter]')?.dataset.unfilter;
  if (drop) {
    settings[drop] = DEFAULTS[drop];
    fillForm();
    return applySettings();
  }
  const id = e.target.closest('.star')?.dataset.id;
  if (!id) return;
  if (!favs.delete(id)) favs.add(id);
  save('bt.favs', [...favs]);
  sync();
  recompute();
  render();
});

addEventListener('hashchange', () => {
  const from = area();
  route = readRoute();
  noteRoute();
  recompute();
  render();
  settle();
  if (area() !== from) scrollTo(0, 0);
});

let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  // the app often stays open in the background for days: coming back after a while is a new visit
  if (document.hidden) hiddenAt = Date.now();
  else if (hiddenAt && Date.now() - hiddenAt > AWAY_MS && stats) lastVisit = new Set(opps.map((f) => f.id));
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
  // a drag inside a window scrolls or closes that window
  pullStart = scrollY === 0 && !ptr.dataset.state && !e.target.closest?.('dialog') ? e.touches[0].clientY : null;
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
// neighbouring tab is already there next to it. Only between the tabs of Trade: not on the detail
// page, not in another area, and not from the screen edge, where Android's own back gesture starts.
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
  const tab = tabs()[tabs().indexOf(view()) + side];
  peek.hidden = !tab;
  if (!tab) return;
  const markup = listMarkup(tab, compute(tab), plan);
  peek.innerHTML = `<div class="chips">${filterChips(activeFilters(tab, settings, DEFAULTS), settings)}</div>${markup.portfolio}<p class="count muted">${markup.count}</p><ul class="list${tab === 'opps' ? ' opps' : ''}">${markup.list}</ul>`;
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
  const usable = products && route.view !== 'item' && area() === 'trade' && e.touches.length === 1 && x > EDGE_PX && x < innerWidth - EDGE_PX;
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
  movePage(dragOffset(view(), dx, tabs()), false);
}, { passive: true });
function endDrag() {
  if (!drag) return;
  const { dx, side } = drag;
  drag = null;
  if (!side) return;
  const tab = swipeTab(view(), dx, 0, tabs());
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
  $('timing-alert-settings').hidden = false;
  $('plan-alert-settings').hidden = false;
  for (const key of PLAN_ALERTS) bindAlertToggle(key, 'plan-hint');
  bindAlertToggle('alerts', 'alert-hint');
  bindAlertToggle('marketAlerts', 'market-hint');
  bindAlertToggle('eventAlerts', 'timing-hint');
  bindAlertToggle('mayorAlerts', 'timing-hint');
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
applyMode();
refresh();
refreshStats();
loadItems().then((items) => {
  names = items.names;
  npc = items.npc;
  tiers = items.tiers;
  itemsLoaded = true;
  sync();
  sendNames();
  recompute();
  render();
});
loadRecipes().then((r) => { recipes = r; recompute(); render(); });
loadForge().then((r) => { forge = r; recompute(); render(); });
initOnboarding({
  native: !!plugin(),
  ready,
  forge: () => ({ hotm: settings.hotm, ah: settings.forgeAh }),
  pro: () => !simple(),
  hints: hintsNow,
  showSettings(open) {
    if (open) openPanel(null, false);
    else $('panel').close();
  },
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

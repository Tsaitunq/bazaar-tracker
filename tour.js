// Wires the onboarding to the page: one <dialog> for windows, one overlay for the spotlight.
import {
  currentVersion, startupAction, migrateState, SCHEME, setupResult, tourSteps, advancedSteps,
  welcomeHtml, newsHtml, helpHtml, advancedOfferHtml, setupOfferHtml, setupFormHtml, setupSummaryHtml, bubbleHtml,
  HINTS, HINT_IDS, PRO_OFFER, initialHints, pickHint, hintHtml,
} from './onboarding.js';

const STATE_KEY = 'bt.onboarding';
const HINTS_KEY = 'bt.hints';
const WAIT_MS = 1500;
const $ = (id) => document.getElementById(id);

// Read before the app writes anything, so "had data" really means an earlier visit.
const hadData = (() => {
  try { return ['bt.settings', 'bt.favs', 'bt.items'].some((k) => localStorage.getItem(k) !== null); } catch { return false; }
})();
const readState = () => { try { return migrateState(JSON.parse(localStorage.getItem(STATE_KEY))); } catch { return null; } };
// Someone who opened the app before: keeps Pro mode and is not shown hints about things they know.
export const returning = hadData || readState() !== null;

let ctx;          // what app.js hands over: { native, ready, forge, apply, pro, hints, showSettings }
let seen = [];    // context hints that were dismissed or covered by a tour
let started = false; // the start window (welcome, news) has had its turn; before that no hint shows
let log;          // changelog.json
let run = null;   // the tour in progress: { steps, index, then, skipped, target }
let answers = {}; // the setup assistant's answers while its window is open

function markSeen() {
  try { localStorage.setItem(STATE_KEY, JSON.stringify({ done: true, version: currentVersion(log), scheme: SCHEME })); } catch {}
}

// ---- windows

function sheet(html, name) {
  const dialog = $('sheet');
  dialog.innerHTML = html;
  dialog.dataset.name = name;
  if (!dialog.open) dialog.showModal();
  dialog.querySelector('.primary')?.focus();
  dialog.scrollTop = 0; // focusing the button at the bottom must not hide the heading
  refreshHints();
}
const closeSheet = () => $('sheet').open && $('sheet').close();

const showWelcome = () => sheet(welcomeHtml(), 'welcome');
const showNews = (versions, options) => sheet(newsHtml(versions, options), 'news');

function showSetup() {
  answers = { capital: undefined, activity: 'rarely', style: 'safe', ...ctx.forge(), ...answers };
  sheet(setupFormHtml({ ...answers, pro: ctx.pro() }), 'setup');
}
const setupRows = () => setupResult(answers, ctx.pro());

function readSetupForm() {
  const data = new FormData($('setup-form'));
  const capital = data.get('capital') === 'custom' ? Number(data.get('custom')) : Number(data.get('capital'));
  // Simple mode does not ask the forge questions; those answers stay as they were
  answers = { capital, activity: data.get('activity'), style: data.get('style'),
    hotm: data.has('hotm') ? Number(data.get('hotm')) : answers.hotm, ah: data.has('ah') ? data.get('ah') !== 'no' : answers.ah };
}

// ---- spotlight tour

const visible = (el) => el && el.getClientRects().length > 0;
const find = (selector) => [...document.querySelectorAll(selector)].find(visible);
// Waits for the step's target. With several selectors the first is preferred; a later one is
// taken only after a moment, so content that is still loading gets a chance to appear.
function waitFor(target) {
  const selectors = [].concat(target);
  return new Promise((resolve) => {
    const start = Date.now();
    (function look() {
      const waited = Date.now() - start;
      const el = find(selectors[0]) ?? (waited > WAIT_MS / 2 ? selectors.slice(1).map(find).find(Boolean) : undefined);
      if (el || waited > WAIT_MS) resolve(el ?? null);
      else setTimeout(look, 50);
    })();
  });
}

function place(el) {
  const hole = $('tour-hole');
  const bubble = $('tour-bubble');
  const gap = 12;
  hole.hidden = !el;
  let top = (innerHeight - bubble.offsetHeight) / 2; // no target: the bubble sits in the middle
  if (el) {
    const r = el.getBoundingClientRect();
    const pad = 6;
    // a target taller than the screen is lit only as far as the bubble leaves room
    const room = innerHeight - r.top - bubble.offsetHeight - 3 * gap;
    const height = r.height > room && room > 80 ? room : r.height;
    Object.assign(hole.style, {
      left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + 2 * pad}px`, height: `${height + 2 * pad}px`,
    });
    const below = r.top + height + gap + pad;
    const above = r.top - gap - pad - bubble.offsetHeight;
    // below the target if it fits, else above, else pinned to the bottom edge over the target
    top = below + bubble.offsetHeight <= innerHeight - gap ? below : above >= gap ? above : innerHeight - bubble.offsetHeight - gap;
  }
  bubble.style.top = `${Math.max(gap, top)}px`;
}

async function showStep() {
  const step = run.steps[run.index];
  if (step.route && location.hash !== step.route) location.hash = step.route;
  if (step.open) ctx.showSettings(true);
  if (step.hint) markHint(step.hint);
  const stepIndex = run.index;
  const bubble = $('tour-bubble');
  // The text changes together with the spotlight, once the target is there; only the very first
  // step shows its text right away, because there is nothing on screen yet.
  if (!bubble.innerHTML) { bubble.innerHTML = bubbleHtml(step, stepIndex, run.steps.length); place(null); }
  const el = await waitFor(step.target);
  if (!run || run.index !== stepIndex) return; // skipped or moved on while waiting
  bubble.innerHTML = bubbleHtml(step, stepIndex, run.steps.length);
  if (el) {
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    if (el.getBoundingClientRect().height > innerHeight / 2) {
      // a tall target is shown from its top, just below the header that stays on screen
      scrollBy(0, el.getBoundingClientRect().top - document.querySelector('header').getBoundingClientRect().bottom - 16);
    }
  }
  run.target = el;
  place(el);
  // pictures and charts that arrive late can move the target
  setTimeout(() => run && run.index === stepIndex && place(live()), 400);
  $('tour-bubble').querySelector('.primary').focus();
}

// A list that was redrawn in the meantime has new elements: look the target up again.
function live() {
  if (run.target && !run.target.isConnected) run.target = [].concat(run.steps[run.index].target).map(find).find(Boolean) ?? null;
  return run.target;
}

// then runs after the last station, skipped when the tour is left early.
function startTour(steps, then, skipped) {
  closeSheet();
  run = { steps, index: 0, then, skipped, target: null };
  $('tour').hidden = false;
  refreshHints();
  showStep();
}

function endTour(finished) {
  const { then, skipped } = run;
  run = null;
  $('tour').hidden = true;
  $('tour-bubble').innerHTML = '';
  ctx.showSettings(false);
  if (location.hash !== '#/flips') location.hash = '#/flips';
  scrollTo(0, 0);
  markSeen();
  if (finished) then?.();
  else skipped?.();
  refreshHints();
}

function moveTour(by) {
  const next = run.index + by;
  if (next < 0) return;
  if (next >= run.steps.length) return endTour(true);
  run.index = next;
  showStep();
}

const listReady = () => Promise.race([ctx.ready, new Promise((r) => setTimeout(r, 8000))]);

// then: what follows the tour. On a first visit that is the setup assistant; whoever skips the tour is
// still offered it once. From the help screen nothing follows.
async function startBasicTour(then) {
  closeSheet();
  await listReady();
  startTour(tourSteps(), then, then && (() => sheet(setupOfferHtml(), 'offer')));
}

async function startAdvancedTour() {
  closeSheet();
  await listReady();
  startTour(advancedSteps({ native: ctx.native }));
}

// The first switch to Pro mode offers the advanced tour, once.
export function offerAdvanced() {
  if (!ctx || seen.includes(PRO_OFFER)) return;
  markHint(PRO_OFFER);
  sheet(advancedOfferHtml(advancedSteps({ native: ctx.native }).length), 'offer');
}

// ---- context hints

const saveSeen = () => { try { localStorage.setItem(HINTS_KEY, JSON.stringify(seen)); } catch {} };
function markHint(id) {
  if (seen.includes(id)) return;
  seen.push(id);
  saveSeen();
}

// Puts the one hint that fits the screen at its place. Never next to a window or a tour.
// app.js calls this after every render and says which hints fit (ctx.hints).
export function refreshHints() {
  document.querySelectorAll('.tip').forEach((el) => el.remove());
  if (!started || run || $('sheet').open) return;
  const id = pickHint(ctx.hints(), seen, find);
  if (id) find(HINTS[id].at).insertAdjacentHTML(HINTS[id].where, hintHtml(id, { native: ctx.native, pro: ctx.pro() }));
}

// "Show me" in the news window: one spotlight per entry that points at something
function startNewsTour(versions) {
  const steps = versions.flatMap((v) => v.entries).filter((e) => e.target)
    .map((e) => ({ title: e.title, text: e.text, target: e.target, route: e.route ?? '#/flips' }));
  startTour(steps);
}

// ---- settings: a "?" next to every option that shows its explanation

function enhanceHelp() {
  for (const small of document.querySelectorAll('#settings small')) {
    const label = small.closest('label') ?? small.previousElementSibling;
    if (!label) continue;
    const name = label.textContent.trim().split('\n')[0].trim();
    const help = document.createElement('button');
    help.type = 'button';
    help.className = 'help';
    help.textContent = '?';
    help.setAttribute('aria-expanded', 'false');
    help.setAttribute('aria-label', `What is ${name}?`);
    help.addEventListener('click', (e) => {
      e.preventDefault(); // inside a label: do not jump into the field
      small.hidden = !small.hidden;
      help.setAttribute('aria-expanded', String(!small.hidden));
    });
    small.hidden = true;
    // in a field label the button goes right after the name; next to a switch it goes at the end
    const control = label.querySelector('input:not([type="checkbox"]), select');
    if (control) label.insertBefore(help, control);
    else label.append(help);
  }
}

// ---- start

let shownNews = [];

export async function initOnboarding(context) {
  ctx = context;
  enhanceHelp();
  // written on the first start, so a new user is not taken for a returning one the second time
  try { seen = JSON.parse(localStorage.getItem(HINTS_KEY)); } catch { seen = null; }
  if (!Array.isArray(seen)) { seen = initialHints(returning); saveSeen(); }
  document.addEventListener('click', (e) => {
    const id = e.target.closest?.('[data-hint]')?.dataset.hint;
    if (id) { markHint(id); refreshHints(); }
    else if (e.target.closest?.('#settings [data-act="setup"]')) showSetup();
  });
  $('sheet').addEventListener('close', refreshHints);
  try {
    const res = await fetch('changelog.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    log = await res.json();
  } catch {
    started = true;
    refreshHints();
    return; // without the changelog there is no version: start the app as it is
  }
  $('version').textContent = `v${currentVersion(log)}`;

  $('sheet').addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    const from = $('sheet').dataset.name;
    if (act === 'tour') startBasicTour(from === 'help' ? null : showSetup);
    else if (act === 'tour-advanced') startAdvancedTour();
    else if (act === 'skip') sheet(setupOfferHtml(), 'offer');
    else if (act === 'close') closeSheet();
    else if (act === 'hints-reset') { seen = seen.filter((id) => !HINT_IDS.includes(id)); saveSeen(); closeSheet(); }
    else if (act === 'news-show') startNewsTour(shownNews);
    else if (act === 'setup') showSetup();
    else if (act === 'news') showNews(log.versions, { history: true });
    else if (act === 'setup-next') { readSetupForm(); sheet(setupSummaryHtml(setupRows()), 'setup'); }
    else if (act === 'setup-back') showSetup();
    else if (act === 'setup-apply') {
      ctx.apply(Object.fromEntries(setupRows().map((r) => [r.key, r.value])));
      closeSheet();
    }
  });
  // every way of leaving a window (button, Escape) counts as seen
  $('sheet').addEventListener('close', markSeen);

  $('tour').addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'tour-next') moveTour(1);
    else if (act === 'tour-back') moveTour(-1);
    else if (act === 'tour-skip') endTour(false);
  });
  addEventListener('keydown', (e) => {
    if (!run) return;
    if (e.key === 'Escape') endTour(false);
    else if (e.key === 'ArrowRight') moveTour(1);
    else if (e.key === 'ArrowLeft') moveTour(-1);
  });
  const again = () => run && place(live());
  addEventListener('resize', again);
  addEventListener('scroll', again, { passive: true });

  $('open-help').addEventListener('click', () => sheet(helpHtml({ pro: ctx.pro() }), 'help'));

  const action = startupAction(readState(), log, hadData);
  shownNews = action.news ?? [];
  if (action.type === 'welcome') showWelcome();
  else if (action.type === 'tourOffer') showNews(action.news, { offerTour: true });
  else if (action.type === 'whatsNew') showNews(action.news, { offerAdvanced: action.advanced && ctx.pro() });
  started = true;
  refreshHints();
}

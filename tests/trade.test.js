import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { skyTime, DAY_MS, YEAR_DAYS } from '../events.js';
import { compactElection } from '../scripts/election.mjs';
import {
  phaseSpans, curveMedians, tradeWindow, tradeText, phaseLabel, itemWindows, allWindows, buyNow, updateTiming, BACKFILL,
  TERM_PHASES, EVENT_PHASES,
} from '../timing.js';
import { windowsView, todayView, detailView } from '../render.js';

const H = 60; // minutes
const TAX = 0.0125;
const raw = JSON.parse(fs.readFileSync(new URL('./fixtures/election.json', import.meta.url), 'utf8'));
const election = compactElection(raw, raw.lastUpdated); // Paul, Marauder, in office in year 519

// a term run at minute s with a curve: factors are the price relative to the day before, by phase
const termRun = (s, factors, { src, base = 1000 } = {}) => ({
  s, e: s + 124 * H, b: s - 24 * H, a: s + 148 * H, p: {},
  c: { X: Object.fromEntries(TERM_PHASES.map((ph) => [ph, base * (factors[ph] ?? 1)])) }, ...(src && { src }),
});
const eventRun = (s, factors, { src, base = 1000 } = {}) => ({
  s, e: s + 10 * H, b: s - 24 * H, a: s + 34 * H, p: {},
  c: { X: Object.fromEntries(EVENT_PHASES.map((ph) => [ph, base * (factors[ph] ?? 1)])) }, ...(src && { src }),
});

test('phases: a term in days with three days after, an event as one phase measured over at least six hours', () => {
  const t = phaseSpans({ s: 10000, e: 10000 + 124 * H });
  assert.deepEqual(t.map((x) => x[0]), TERM_PHASES);
  assert.deepEqual(t[2], ['d1', 10000, 10000 + 24 * H]);
  assert.deepEqual(t[6], ['d5', 10000 + 96 * H, 10000 + 124 * H]); // 28 hours
  assert.deepEqual(t.at(-1), ['a3', 10000 + 124 * H + 48 * H, 10000 + 124 * H + 72 * H]);
  assert.equal(t[0][1], 10000 - 48 * H);
  const short = phaseSpans({ s: 10000, e: 10000 + 1 * H });
  assert.deepEqual(short.map((x) => x[0]), EVENT_PHASES);
  assert.deepEqual(short[2], ['during', 10000, 10000 + 6 * H]);
  assert.equal(short[3][1], 10000 + 6 * H);
});

test('curveMedians: the median of each phase, phases without a price left out', () => {
  const run = { s: 1000, e: 1000 + 10 * H };
  const points = [[1000 - 30 * H, 0, 50], [1000 - 10 * H, 0, 100], [1000 - 9 * H, 0, 120], [1000 + 2 * H, 0, 200]];
  assert.deepEqual(curveMedians(points, run), { pre2: 50, pre1: 110, during: 200 });
});

test('tradeWindow: buy in the term, sell after it, with the gain after tax and how often it paid', () => {
  const f = { d2: 0.9, d3: 0.8, d4: 0.85, d5: 0.9, a1: 0.95, a2: 1.0, a3: 1.0 };
  const runs = Array.from({ length: 12 }, (_, i) => termRun(i * 10000, f, { src: i < 9 ? BACKFILL : undefined }));
  const w = tradeWindow(runs, 'X', TAX);
  assert.equal(w.buy, 'd3');
  assert.ok(['a2', 'a3'].includes(w.sell));
  assert.ok(Math.abs(w.spread - (1.0 / 0.8 * (1 - TAX) - 1)) < 1e-9);
  assert.deepEqual([w.hits, w.n], [12, 12]);
  assert.equal(w.src.filter((s) => s === BACKFILL).length, 9);
  assert.match(tradeText(w, 'perk:Fishing Festival'), /^Buy around: day 3 of Marina's term · Sell around: [23] days? after Marina's term · typical \+2[0-9]% \(12\/12, 3 own, 9 historical\)$/);
});

test('tradeWindow: a price that rises into an event is buy before, sell during', () => {
  const runs = Array.from({ length: 6 }, (_, i) => eventRun(i * 10000, { during: 1.2, a1: 1.1, a2: 1.0 }));
  const w = tradeWindow(runs, 'X', TAX);
  assert.deepEqual([w.buy, w.sell], ['pre1', 'during']);
  assert.match(tradeText(w, 'event:workshop'), /^Buy around: 1 day before the event · Sell around: during the event · typical \+19% \(6\/6\)$/);
});

test('tradeWindow: needs more than 3% after tax, two thirds of the runs and three runs', () => {
  const flat = Array.from({ length: 8 }, (_, i) => eventRun(i * 10000, { during: 1.04 }));
  // +4% before tax is +2.7% after: not shown
  assert.equal(tradeWindow(flat, 'X', TAX), null);
  assert.ok(tradeWindow(flat, 'X', 0)); // without tax 4% is shown
  // 5 of 8 runs paid (62%): under two thirds
  const mixed = Array.from({ length: 8 }, (_, i) => eventRun(i * 10000, { during: i < 5 ? 1.3 : 0.95 }));
  assert.equal(tradeWindow(mixed, 'X', TAX), null);
  // 6 of 9 is exactly two thirds
  const enough = Array.from({ length: 9 }, (_, i) => eventRun(i * 10000, { during: i < 6 ? 1.3 : 0.95 }));
  assert.deepEqual([tradeWindow(enough, 'X', TAX).hits, tradeWindow(enough, 'X', TAX).n], [6, 9]);
  assert.equal(tradeWindow(flat.slice(0, 2), 'X', 0), null);
});

test('itemWindows and allWindows: best first, only what passes', () => {
  const up = (k) => Array.from({ length: 5 }, (_, i) => eventRun(i * 10000, { during: k }));
  const timing = { 'event:spooky': up(1.4), 'event:workshop': up(1.1), 'perk:Marauder': up(1.0) };
  assert.deepEqual(itemWindows(timing, 'X', TAX).map((x) => x.key), ['event:spooky', 'event:workshop']);
  assert.deepEqual(allWindows(timing, TAX).map((x) => x.id), ['X', 'X']);
  assert.equal(itemWindows(timing, 'Y', TAX).length, 0);
});

test('buyNow: now while the buy phase runs, soon within a day, not after the sell phase', () => {
  const termStart = skyTime(519, 2, 27);               // Paul's term, election 518
  const s = termStart / 60000;
  const runs = Array.from({ length: 5 }, (_, i) => termRun(s - (i + 1) * 20000, { d3: 0.8, a2: 1.0, a3: 1.0 }));
  const timing = { 'perk:Marauder': runs };
  const at = (min) => min * 60000;
  const d3 = [s + 48 * H, s + 72 * H];
  const now = buyNow(at(d3[0] + 5 * H), election, timing, TAX);
  assert.equal(now.length, 1);
  assert.equal(now[0].state, 'now');
  assert.equal(now[0].id, 'X');
  assert.equal(now[0].from, at(d3[0]));
  assert.equal(buyNow(at(d3[0] - 6 * H), election, timing, TAX)[0].state, 'soon');
  assert.equal(buyNow(at(d3[0] - 25 * H), election, timing, TAX).length, 0);     // more than a day away
  assert.equal(buyNow(at(s + 124 * H + 60 * H), election, timing, TAX).length, 0); // the sell phase is over
});

test('updateTiming: a run collects its price curve, own runs only, once its last phase is over', () => {
  const start = skyTime(519, 7, 29); // Spooky Festival
  const sMin = start / 60000;
  const series = () => [[sMin - 30 * H, 0, 100], [sMin - 5 * H, 0, 100], [sMin + 2 * H, 0, 80], [sMin + 10 * H, 0, 90]];
  let timing = updateTiming(null, null, series, start + 20 * 60000);
  const run = () => timing.r['event:spooky'].find((r) => r.s === sMin);
  assert.equal(run().c, undefined);                                    // the last phase is not over
  timing = updateTiming(timing, null, series, start + 79 * 3600000); // six hours measured, then three days
  assert.deepEqual(run().c.GREEN_CANDY, { pre2: 100, pre1: 100, during: 80, a1: 90 });
  assert.equal(run().src, undefined);
});

test('views: the radar lists the windows, the item page and Today carry them', () => {
  const up = Array.from({ length: 5 }, (_, i) => eventRun(i * 10000, { during: 1.3 }));
  const timing = { 'event:spooky': up };
  const name = (id) => `Name of ${id}`;
  const radar = windowsView(timing, TAX, name);
  assert.match(radar, /Buy and sell windows/);
  assert.match(radar, /Name of X<\/a> <small>Spooky Festival: Buy around: 1 day before the event · Sell around: during the event · typical \+2\d% \(5\/5\)/);
  assert.equal(windowsView({}, TAX, name), '');
  const windows = itemWindows(timing, 'X', TAX);
  assert.match(detailView({ id: 'X', name: 'X', points: null, range: '1d', windows }), /Event timing[\s\S]*Buy around/);
  assert.ok(!detailView({ id: 'X', name: 'X', points: null, range: '1d' }).includes('Event timing'));
  const now = Date.now();
  const today = todayView({ plan: null, capital: 0, slots: 1, now, name, vote: { open: false, at: now }, buying: [
    { id: 'X', key: 'event:spooky', state: 'now', from: now - 3600000, to: now + 3600000, text: 'Buy around: …' }] });
  assert.match(today, /Buying window[\s\S]*Name of X[\s\S]*now · /);
  assert.equal(phaseLabel('d3', { who: null, term: true }), 'day 3 of the term');
  assert.equal(YEAR_DAYS * DAY_MS, 124 * 3600000);
});

// ---- drivers, roles, volume ----
import { itemRole, driverTitle, isLowVolume, LOW_WEEK_VOLUME } from '../timing.js';
import { expectedRole, DRIVERS, activePerks, upcoming } from '../events.js';
import { effectsView, volumeNote, roleBadge, keyTitle } from '../render.js';

const pRun = (s, vs, c) => ({ s, e: s + 100, b: s - 10, a: s + 120, p: { X: vs }, ...(c && { c: { X: c } }) });

test('drivers: the mayor or the event, the perk only where it starts the event', () => {
  assert.equal(driverTitle('perk:Marauder'), 'Paul – more dungeon players');
  assert.equal(driverTitle('perk:Fishing Festival'), 'Fishing Festival (Marina)');
  assert.equal(driverTitle('perk:Mythological Ritual'), 'Mythological Ritual (Diana)');
  assert.equal(driverTitle('perk:Stock Exchange'), 'Stock Exchange (Diaz)');
  assert.equal(driverTitle('perk:Blooming Business'), 'Finnegan – more Garden visitors');
  assert.equal(driverTitle('event:spooky'), 'Spooky Festival');
  assert.equal(keyTitle('perk:Marauder'), 'Paul – more dungeon players');
  assert.ok(!/Marauder/.test(Object.values(DRIVERS).find((d) => d.group === 'Paul').title));
});

test('itemRole: the measured change decides, the expected role only settles shop against supply', () => {
  const runs = (before, during, after) => [0, 1, 2, 3].map((i) => pRun(i * 1000, [before, during, after]));
  // cheaper during, dearer after: supply; the shop items stay shop, and an expected demand is overruled
  const supply = itemRole(runs(100, 80, 100), 'X', 'supply');
  assert.deepEqual([supply.role, supply.expected, supply.measured, supply.mismatch, supply.recovers, supply.confirmed], ['supply', 'supply', 'supply', false, true, true]);
  assert.ok(Math.abs(supply.pct + 0.2) < 1e-9);
  assert.equal(itemRole(runs(100, 80, 100), 'X', 'shop').role, 'shop');
  const bait = itemRole(runs(100, 80, 70), 'X', 'demand');
  assert.deepEqual([bait.role, bait.mismatch, bait.recovers], ['supply', true, false]); // Shark Bait: measured, and no recovery
  // dearer during, cheaper after: demand (Ice Bait); an expected supply is overruled
  assert.equal(itemRole(runs(100, 130, 90), 'X', 'demand').role, 'demand');
  const wrong = itemRole(runs(100, 130, 90), 'X', 'supply');
  assert.deepEqual([wrong.role, wrong.mismatch], ['demand', true]);
  // nothing measured: the expectation stands, and says so
  const none = itemRole([], 'X', 'shop');
  assert.deepEqual([none.role, none.measured, none.mismatch], ['shop', null, false]);
  // expected roles of the known items
  assert.deepEqual(['WHITE_GIFT', 'ENCHANTMENT_LUCK_6', 'ICE_BAIT', 'DARK_ORB'].map(expectedRole), ['shop', 'shop', 'demand', 'supply']);
});

test('roles show as badges, the effects are grouped by driver and the role can be searched', () => {
  const run = (i) => ({ s: i * 1000, e: i * 1000 + 100, b: i * 1000 - 10, a: i * 1000 + 120, p: { ICE_BAIT: [100, 130, 90], GREEN_GIFT: [100, 130, 90] } });
  const timing = { 'event:workshop': [0, 1, 2, 3].map(run) };
  const election = { mayor: { name: 'Paul', perks: [{ name: 'Marauder', text: '' }], minister: null } };
  const now = skyTime(519, 7, 5);
  const args = { perks: activePerks(election), events: upcoming(now, election), now, name: (id) => id, timing };
  const html = effectsView(args);
  // grouped: the heading of a driver comes once, before its rows
  assert.equal((html.match(/<h4>Paul<\/h4>/g) ?? []).length, 1);
  assert.match(html, /<h4>Jerry&#39;s Workshop<\/h4>/);
  // the measured role shows: Ice Bait is dearer during the Workshop, so demand; the expectation was demand too
  assert.match(html, /ICE_BAIT<\/a> <span class="badge role role-demand" title="[^"]*">Demand<\/span>/);
  // Green Gift was expected as shop and measured dearer during: demand, marked as measured
  assert.match(html, /GREEN_GIFT<\/a> <span class="badge role role-demand"[^>]*>Demand \(measured\)<\/span>/);
  // an item without runs shows its expected role
  assert.match(html, /DARK_ORB<\/a> <span class="badge role role-supply"[^>]*>Supply<\/span>/);
  // the role is part of the search text
  const hits = (q) => (effectsView({ ...args, query: q }).match(/<li data-g="[^"]*" data-q="[^"]*" hidden>/g) ?? []).length;
  const total = (html.match(/<li data-g="[^"]*" data-q=/g) ?? []).length;
  assert.ok(hits('demand') < total && hits('shop') < total);
  assert.equal(hits('zzzz'), total);
  assert.match(roleBadge({ role: 'shop', expected: 'shop', measured: 'supply', mismatch: false }), />Shop<\/span>/);
});

test('volume: shown with every window, and a window that is hard to fill is marked', () => {
  assert.equal(LOW_WEEK_VOLUME, 1000);
  assert.ok(isLowVolume(754) && !isLowVolume(1000) && !isLowVolume(null));
  assert.equal(volumeNote(9713), ' · Vol./week 9,713');
  assert.equal(volumeNote(754), ' · Vol./week 754 · <strong>low volume – hard to fill</strong>');
  assert.equal(volumeNote(null), '');
  const timing = { 'event:spooky': Array.from({ length: 5 }, (_, i) => eventRun(i * 10000, { during: 1.3 })) };
  const view = windowsView(timing, TAX, (id) => id, () => 500);
  assert.match(view, /Vol\.\/week 500 · <strong>low volume – hard to fill<\/strong>/);
  const detail = detailView({ id: 'X', name: 'X', points: null, range: '1d', windows: itemWindows(timing, 'X', TAX), volume: 2500 });
  assert.match(detail, /Vol\.\/week 2,500<\/small>/);
});

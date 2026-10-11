import test from 'node:test';
import assert from 'node:assert/strict';
import { skyTime, DAY_MS, YEAR_DAYS, PERK_EXPECT, EVENTS } from '../events.js';
import { pattern, itemPattern, patternText, removeBackfill, mergeBackfill, BACKFILL, CONFIRM } from '../timing.js';
import { plan, termOf, windows, rowsToPoints, buildRun, itemsOf, MIN_DURING_MS } from '../scripts/backfill-lib.mjs';
import { fetchHistory } from '../scripts/timing-backfill.mjs';

const HOUR = 3600000;
const YEAR_MS = YEAR_DAYS * DAY_MS;
const NOW = skyTime(519, 5, 11);

test('a term runs from Late Spring 27 of the year after the election for a year', () => {
  const { s, e } = termOf(518);
  assert.equal(s, skyTime(519, 2, 27));
  assert.equal(e - s, YEAR_MS);
  assert.equal(YEAR_MS, 124 * HOUR);
});

test('windows: a day before, a day after, never more than seven days from the start of the first', () => {
  const s = skyTime(500, 2, 27);
  const w = windows(s, s + YEAR_MS);
  assert.equal(w.s - w.b, 24 * 60);
  assert.equal(w.a - w.b, 7 * 24 * 60); // 24 h + 124 h + 24 h is 172 h: cut at 168 h
  const short = windows(s, s + HOUR);
  assert.equal(short.a - short.e, 24 * 60);
});

test('plan: newest terms first, only ids from 179, only after a perk change, only finished runs', () => {
  const elections = { 150: 'Paul', 179: 'Paul', 300: 'Paul', 400: 'Paul', 518: 'Paul', 450: 'Cole', 515: 'Cole' };
  const spec = { key: 'perk:Marauder', mayor: 'Paul' };
  const runs = plan(NOW, elections, { perks: [spec], events: [] });
  // 150 is below 179; 518 is the running term (its after window is not over)
  assert.deepEqual(runs['perk:Marauder'].map((r) => r.s), [400, 300, 179].map((n) => termOf(n).s / 60000));
  assert.equal(plan(NOW, elections, { perks: [spec], events: [], count: 2 })['perk:Marauder'].length, 2);
  // a perk changed on the wiki: only terms from that day on
  const cut = new Date(termOf(300).s).toISOString();
  const since = plan(NOW, elections, { perks: [{ ...spec, since: cut }], events: [] })['perk:Marauder'];
  assert.deepEqual(since.map((r) => r.s), [400, 300].map((n) => termOf(n).s / 60000));
});

test('plan: a short event is measured over at least six hours, Grand Feast only under Finnegan', () => {
  const runs = plan(NOW, {}, { perks: [], events: ['spooky', 'grandfeast'], count: 3 });
  const [r] = runs['event:spooky'];
  assert.equal(runs['event:spooky'].length, 3);
  assert.equal((r.e - r.s) * 60000, MIN_DURING_MS); // Spooky is one real hour
  assert.equal(runs['event:grandfeast'].length, 0); // nobody was Finnegan here
  const fin = plan(NOW, { 517: 'Finnegan' }, { perks: [], events: ['grandfeast'] })['event:grandfeast'];
  assert.ok(fin.every((w) => w.s * 60000 >= Date.parse('2026-04-28')));
});

test('rows become points the way timing.js reads them: SkyCofl buy is our sell offer', () => {
  const rows = [{ buy: 110, sell: 100, timestamp: '2026-10-02T02:00:00' }, { buy: 105, sell: 95, timestamp: '2026-10-02T00:00:00' }];
  const points = rowsToPoints(rows);
  assert.deepEqual(points.map((p) => p[2]), [105, 110]); // oldest first, sell offer = SkyCofl buy
  assert.equal(points[0][0], Date.parse('2026-10-02T00:00:00Z') / 60000);
});

test('buildRun: the same three medians as a recorded run, items without data left out', () => {
  const s = Date.parse('2026-10-05T00:00:00Z');
  const w = windows(s, s + 10 * HOUR);
  const row = (t, price) => ({ buy: price, sell: price - 1, timestamp: new Date(t).toISOString() });
  const rows = [];
  for (let h = -24; h < 0; h += 2) rows.push(row(s + h * HOUR, 100));
  for (let h = 0; h < 10; h += 2) rows.push(row(s + h * HOUR, 80));
  for (let h = 10; h < 34; h += 2) rows.push(row(s + h * HOUR, 90));
  const run = buildRun(w, { A: rows, B: null, C: [] });
  assert.deepEqual(run.p, { A: [100, 80, 90] });
  assert.equal(run.src, BACKFILL);
  assert.equal(run.s, s / 60000);
});

test('mergeBackfill never replaces an own run, is idempotent, and marks what it adds', () => {
  const own = { s: 100, e: 200, b: 50, a: 250, p: { X: [1, 2, 3] } };
  const timing = { t: 1, r: { 'perk:A': [own] } };
  const back = { r: {
    'perk:A': [{ s: 100, e: 200, b: 50, a: 250, p: { X: [9, 9, 9] } }, { s: 10, e: 20, b: 0, a: 30, p: { X: [4, 5, 6] } }],
    'event:B': [{ s: 1, e: 2, b: 0, a: 3, p: {} }],
  } };
  const merged = mergeBackfill(timing, back);
  assert.deepEqual(merged.r['perk:A'].map((r) => [r.s, r.src]), [[10, BACKFILL], [100, undefined]]);
  assert.deepEqual(merged.r['perk:A'][1].p.X, [1, 2, 3]);
  assert.deepEqual(mergeBackfill(merged, back), merged);
  assert.equal(timing.r['perk:A'].length, 1); // the input is not changed
});

test('a pattern keeps own and backfilled runs apart, and takes the backfill out again', () => {
  const run = (s, src, vs) => ({ s, e: s + 1, b: s - 1, a: s + 2, p: { X: vs }, ...(src && { src }) });
  const timing = { r: { 'perk:A': [run(1, null, [100, 120, 110]), run(2, BACKFILL, [100, 130, 110]), run(3, BACKFILL, [100, 125, 110])] } };
  const p = itemPattern(timing.r['perk:A'], 'X').into;
  assert.deepEqual([p.n, p.nOwn, p.nBackfill, p.confirmed], [3, 1, 2, true]);
  assert.match(patternText(p, 'during term'), /seen 3 times, 1 own, 2 from historical data \(SkyCofl\)/);
  const without = removeBackfill(timing);
  const q = itemPattern(without.r['perk:A'], 'X').into;
  assert.deepEqual([q.n, q.nOwn, q.nBackfill, q.confirmed], [1, 1, 0, false]);
  assert.match(patternText(q, 'during term'), /not enough data yet \(1\/3\)$/);
  // an own-only pattern reads as before
  assert.doesNotMatch(patternText(pattern([0.1, 0.1, 0.1]), 'x'), /historical/);
  assert.equal(CONFIRM, 3);
  // a key with only backfilled runs is dropped
  assert.deepEqual(removeBackfill({ r: { k: [run(1, BACKFILL, [1, 2, 3])] } }).r, {});
});

test('fetchHistory waits for Retry-After on a 429 and then returns the rows', async () => {
  const answers = [
    { status: 429, ok: false, headers: { get: (h) => (h === 'retry-after' ? '1' : null) } },
    { status: 200, ok: true, headers: { get: () => null }, json: async () => [{ buy: 1, sell: 1, timestamp: '2026-01-01T00:00:00' }] },
  ];
  const urls = [];
  const t0 = Date.now();
  const rows = await fetchHistory('X', { b: 0, a: 60 }, async (url) => { urls.push(url); return answers.shift(); });
  assert.equal(rows.length, 1);
  assert.equal(urls.length, 2);
  assert.ok(Date.now() - t0 >= 900);
  assert.ok(urls[0].startsWith('https://sky.coflnet.com/api/bazaar/X/history?start=1970-01-01T00:00:00.000Z'));
});

test('every backfilled key has items, and the Fishing Festival has the crafted ones', () => {
  for (const key of ['perk:Marauder', 'perk:Fishing Festival', 'event:spooky', 'event:feast']) assert.ok(itemsOf(key).length > 0, key);
  assert.ok(itemsOf('perk:Fishing Festival').includes('GREAT_WHITE_TOOTH_MEAL'));
  assert.ok(PERK_EXPECT['Fishing Festival'] && EVENTS.some((e) => e.key === 'fishing'));
});

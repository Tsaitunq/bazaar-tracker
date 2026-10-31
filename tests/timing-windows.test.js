import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { skyTime, termStart, DAY_MS, YEAR_DAYS } from '../events.js';
import { compactElection } from '../scripts/election.mjs';
import { runSnapshot } from '../scripts/snapshot.mjs';
import { timingWindows, avoidPattern, tradeWindow, windowTax, phaseSpans, TERM_PHASES, EVENT_PHASES, BACKFILL, AVOID_LEAD_MS } from '../timing.js';

const H = 3600000;
const TAX = 0.0125;
const YEAR = YEAR_DAYS * DAY_MS;
const raw = JSON.parse(fs.readFileSync(new URL('./fixtures/election.json', import.meta.url), 'utf8'));
const paul = { ...compactElection(raw, raw.lastUpdated), vote: null }; // Paul, Marauder, won the election of year 518

const start = skyTime(519, 2, 27); // Paul's term
const NOW = start + 30 * H;        // in day 2 of it

// old runs far in the past: price relative to the day before, by phase
const curve = (phases, f) => Object.fromEntries(phases.map((ph) => [ph, 1000 * (f[ph] ?? 1)]));
const termRuns = (id, f, count = 6, sources = []) => Array.from({ length: count }, (_, i) => {
  const s = 10000 + i * 100000;
  return { s, e: s + 7440, b: s - 1440, a: s + 8880, p: { [id]: [1000, 1000, 1000] }, c: { [id]: curve(TERM_PHASES, f) }, ...(sources[i] && { src: sources[i] }) };
});
const eventRuns = (id, f, p = [1000, 1000, 1000]) => Array.from({ length: 6 }, (_, i) => {
  const s = 10000 + i * 100000;
  return { s, e: s + 60, b: s - 1440, a: s + 1500, p: { [id]: p }, c: { [id]: curve(EVENT_PHASES, f) } };
});
// a bottom on day 3, back two days after the term: the shape of a Paul item
const DIP = { d2: 0.9, d3: 0.7, d4: 0.8, d5: 0.9, a1: 0.95, a2: 1.0, a3: 1.0 };

test('Paul term: the window of an item as concrete times', () => {
  const sources = [BACKFILL, BACKFILL, BACKFILL, BACKFILL];
  const file = timingWindows(NOW, paul, { 'perk:Marauder': termRuns('DARK_ORB', DIP, 6, sources) }, TAX);
  const t = tradeWindow(termRuns('DARK_ORB', DIP, 6, sources), 'DARK_ORB', TAX);
  assert.deepEqual([t.buy, t.sell], ['d3', 'a2']); // on a tie the earlier sell phase
  const end = start + YEAR;
  assert.deepEqual(file.w, [{
    id: 'DARK_ORB', key: 'perk:Marauder', driver: 'Paul – more dungeon players', s: start,
    buyStart: start + 48 * H, buyEnd: start + 72 * H,
    sellStart: end + 24 * H, sellEnd: end + 48 * H,
    spread: Math.round((1 / 0.7 * (1 - TAX) - 1) * 10000) / 10000, hits: 6, n: 6, own: 2, backfill: 4,
  }]);
  assert.deepEqual(file.a, []);
  assert.equal(file.tax, TAX);
});

test('the same thresholds as the app: no window for a gain under 3% after tax', () => {
  assert.deepEqual(timingWindows(NOW, paul, { 'perk:Marauder': termRuns('X', { d3: 0.97 }) }, TAX).w, []);
  // fewer than three runs
  assert.deepEqual(timingWindows(NOW, paul, { 'perk:Marauder': termRuns('X', DIP, 2) }, TAX).w, []);
});

test('the term before stays in the file until its sell phase is over', () => {
  // the mayor changed; the runs in timing.json still say Marauder ran in that term
  const later = start + YEAR + 3 * H;
  const finnegan = { ...paul, mayor: { name: 'Finnegan', year: 519, perks: [{ name: 'Blooming Business', text: '' }], minister: null } };
  const prior = { s: start / 60000, e: (start + YEAR) / 60000, p: {}, c: {} };
  const runs = { 'perk:Marauder': [...termRuns('DARK_ORB', DIP), prior] };
  const [w] = timingWindows(later, finnegan, runs, TAX).w;
  assert.equal(w.sellStart, start + YEAR + 24 * H);
  assert.equal(w.s, start);
  // a2 is over, and without a run in that term a perk is not taken for active
  assert.deepEqual(timingWindows(start + YEAR + 49 * H, finnegan, runs, TAX).w, []);
  assert.deepEqual(timingWindows(later, finnegan, { 'perk:Marauder': termRuns('DARK_ORB', DIP) }, TAX).w, []);
});

test('the leader of the running election gives the coming term, marked as such', () => {
  const vote = { year: 520, candidates: [
    { name: 'Paul', votes: 100, perks: ['Marauder'], minister: 'Marauder' },
    { name: 'Marina', votes: 50, perks: ['Double Trouble', 'Fishing Festival'], minister: 'Fishing Festival' },
  ] };
  const election = { ...paul, mayor: { name: 'Aatrox', year: 519, perks: [], minister: null }, vote };
  const next = skyTime(521, 2, 27);
  const now = next - 20 * H;
  const runs = { 'perk:Fishing Festival': termRuns('SHARK_FIN', { pre1: 1, d1: 1.2, d2: 1.2, d3: 1.2, d4: 1.2, d5: 1.2, a1: 1.2, a2: 1.2, a3: 1.2 }), 'perk:Marauder': termRuns('DARK_ORB', DIP) };
  const file = timingWindows(now, election, runs, TAX);
  const orb = file.w.find((x) => x.id === 'DARK_ORB');
  assert.equal(orb.driver, 'Paul – more dungeon players (if elected)');
  assert.equal(orb.buyStart, next + 48 * H);
  // the runner-up's minister perk counts too
  const fin = file.w.find((x) => x.id === 'SHARK_FIN');
  assert.equal(fin.driver, 'Fishing Festival (Marina) (if elected)');
  // nobody has a vote yet: nothing comes of the election
  const none = { ...election, vote: { year: 520, candidates: vote.candidates.map((c) => ({ ...c, votes: 0 })) } };
  assert.deepEqual(timingWindows(now, none, runs, TAX).w, []);
});

test('a fixed event from the calendar, also when its buy phase is after the event', () => {
  const spooky = skyTime(520, 7, 29);
  const after = eventRuns('GREEN_GIFT', { during: 1, a1: 0.7, a2: 0.8, a3: 1 });
  const during = eventRuns('PUMPKIN_GUTS', { during: 0.7, a1: 0.8, a2: 1, a3: 1 });
  const now = spooky + 2 * H; // the event is over (it lasts an hour)
  const file = timingWindows(now, paul, { 'event:spooky': [...after.map((r, i) => ({ ...r, c: { ...r.c, ...during[i].c } }))] }, TAX);
  const spans = Object.fromEntries(phaseSpans({ s: spooky / 60000, e: (spooky + 3 * DAY_MS) / 60000 }).map(([n, a, b]) => [n, [a * 60000, b * 60000]]));
  const gift = file.w.find((x) => x.id === 'GREEN_GIFT' && x.s === spooky);
  assert.deepEqual([gift.buyStart, gift.buyEnd, gift.sellStart, gift.sellEnd], [...spans.a1, ...spans.a3]);
  assert.equal(gift.driver, 'Spooky Festival');
  // the next festival a year later is in the file too, the one after it is past the horizon
  assert.deepEqual(file.w.filter((x) => x.id === 'GREEN_GIFT').map((x) => x.s), [spooky, spooky + YEAR]);
  // an event tied to a perk nobody has gives nothing
  assert.deepEqual(timingWindows(now, paul, { 'event:grandfeast': termRuns('MELON_JUICE', DIP) }, TAX).w, []);
});

test('avoid: drops and does not recover', () => {
  const stays = eventRuns('SHARK', { during: 0.9, a1: 0.9, a2: 0.9, a3: 0.9 }, [1000, 880, 893]); // -12%, then +1.5%
  assert.deepEqual(avoidPattern(stays, 'SHARK'), { drop: 0.12, hits: 6, n: 6, own: 6, backfill: 0 });
  // wins back more than half of it
  assert.equal(avoidPattern(eventRuns('X', {}, [1000, 880, 960]), 'X'), null);
  // too small, or rising
  assert.equal(avoidPattern(eventRuns('X', {}, [1000, 980, 980]), 'X'), null);
  assert.equal(avoidPattern(eventRuns('X', {}, [1000, 1200, 1200]), 'X'), null);
  // nothing measured after the event: unknown, not "does not recover"
  assert.equal(avoidPattern(eventRuns('X', {}, [1000, 880, null]), 'X'), null);
  // under two thirds of the runs fell
  const mixed = eventRuns('X', {}, [1000, 880, 880]).map((r, i) => (i < 3 ? { ...r, p: { X: [1000, 1100, 1100] } } : r));
  assert.equal(avoidPattern(mixed, 'X'), null);
});

test('avoid in the file: time to have sold by, with the notice 12 hours earlier; a window beats it', () => {
  const spooky = skyTime(520, 7, 29);
  const now = spooky - 20 * H;
  const stays = eventRuns('SHARK', { during: 0.9, a1: 0.9, a2: 0.9, a3: 0.9 }, [1000, 880, 880]);
  const file = timingWindows(now, paul, { 'event:spooky': stays }, TAX);
  assert.deepEqual(file.a.filter((x) => x.s === spooky), [{
    id: 'SHARK', key: 'event:spooky', driver: 'Spooky Festival', s: spooky, at: spooky, notifyAt: spooky - AVOID_LEAD_MS, drop: 0.12, hits: 6, n: 6, own: 6, backfill: 0,
  }]);
  // the same fall, but the curve pays later: a window, not a warning
  const back = eventRuns('SHARK', { during: 0.8, a1: 0.9, a2: 1, a3: 1 }, [1000, 880, 880]);
  const both = timingWindows(now, paul, { 'event:spooky': back }, TAX);
  assert.equal(both.a.length, 0);
  assert.ok(both.w.length > 0);
  // a driver that has started is too late for a warning
  assert.deepEqual(timingWindows(spooky + H, paul, { 'event:spooky': stays }, TAX).a.filter((x) => x.s === spooky), []);
});

test('windowTax: the default, quadrupled under Derpy', () => {
  assert.equal(windowTax(paul), 0.0125);
  assert.equal(windowTax({ mayor: { name: 'Derpy' } }), 0.05);
  assert.equal(windowTax(null), 0.0125);
});

test('runSnapshot writes timing-windows.json next to timing.json', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-'));
  try {
    fs.writeFileSync(path.join(dir, 'election.json'), JSON.stringify(paul));
    fs.writeFileSync(path.join(dir, 'timing.json'), JSON.stringify({ t: 0, r: { 'perk:Marauder': termRuns('DARK_ORB', DIP) } }));
    runSnapshot(dir, {}, NOW);
    const file = JSON.parse(fs.readFileSync(path.join(dir, 'timing-windows.json'), 'utf8'));
    assert.equal(file.t, NOW);
    assert.equal(file.w[0].id, 'DARK_ORB');
    assert.equal(file.w[0].s, termStart(NOW));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

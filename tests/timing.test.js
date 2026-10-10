import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { skyTime, termStart, PERK_EXPECT, DAY_MS, YEAR_DAYS } from '../events.js';
import { started, updateTiming, pattern, itemPattern, patternText, LEAD_MS } from '../timing.js';
import { compactElection } from '../scripts/election.mjs';

const raw = JSON.parse(fs.readFileSync(new URL('./fixtures/election.json', import.meta.url), 'utf8'));
const election = compactElection(raw, raw.lastUpdated); // Paul, elected in 518, minister Cole with Mining Fiesta
const HOUR = 3600000;
const YEAR_MS = YEAR_DAYS * DAY_MS;
const spooky = (year) => skyTime(year, 7, 29);
const min = (ms) => ms / 60000;
// a sell price that depends on the time only: 100 before the festival of `year`, 120 during, 90 after
const series = (year) => () => [-2, 0.5, 2].map((h, i) => [min(spooky(year) + h * HOUR), 1, [100, 120, 90][i]]);
const run = (before, during, after, id = 'GREEN_CANDY') => ({ p: { [id]: [before, during, after] } });
const find = (list, key) => list.find((o) => o.key === key);

test('pattern: three runs in the same direction confirm it, the typical change is the median', () => {
  assert.deepEqual(pattern([0.1, 0.2, 0.3]), { pct: 0.2, dir: 1, n: 3, confirmed: true });
  assert.equal(pattern([0.1, 0.2]).confirmed, false);
  // one run went the other way: it is not counted
  assert.equal(pattern([-0.1, -0.2, 0.3]).n, 2);
  assert.equal(pattern([-0.1, -0.2, 0.3, -0.05]).confirmed, true);
  // below 1% there is no direction
  assert.deepEqual(pattern([0.001, 0.002, 0.003]), { pct: 0.002, dir: 0, n: 0, confirmed: false });
  assert.deepEqual(pattern([]), { pct: null, dir: 0, n: 0, confirmed: false });
});

test('itemPattern: before to during and during to after, runs with a missing median are left out', () => {
  const runs = [run(100, 120, 90), run(100, 110, 99), run(200, 260, null), run(null, 50, 60), run(0, 5, 5)];
  const { into, out } = itemPattern(runs, 'GREEN_CANDY');
  assert.equal(into.n, 3);
  assert.ok(Math.abs(into.pct - 0.2) < 1e-9);
  assert.equal(out.dir, -1);
  assert.equal(out.n, 2);
  assert.deepEqual(itemPattern(undefined, 'X').into, pattern([]));
});

test('patternText: the confirmed pattern or how far it is', () => {
  assert.equal(patternText(pattern([0.1, 0.123, 0.2]), 'during event'), 'Usually +12.3% during event (seen 3 times)');
  assert.equal(patternText(pattern([-0.1, -0.1, -0.1]), 'during term'), 'Usually −10% during term (seen 3 times)');
  assert.equal(patternText(pattern([0.1]), 'during event'), 'not enough data yet (1/3)');
});

test('termStart: Late Spring 27, in this year or the one before', () => {
  assert.equal(termStart(skyTime(519, 3, 2)), skyTime(519, 2, 27));
  assert.equal(termStart(skyTime(519, 1, 1)), skyTime(518, 2, 27));
});

test('started: an event counts from its start until 24 hours after its end', () => {
  const o = find(started(spooky(519) + 1, null), 'event:spooky');
  assert.deepEqual([o.s, o.e, o.b, o.a], [spooky(519), spooky(519) + HOUR, spooky(519) - 24 * HOUR, spooky(519) + 25 * HOUR]);
  assert.ok(find(started(spooky(519) + 24.9 * HOUR, null), 'event:spooky'));
  assert.ok(!find(started(spooky(519) + 25 * HOUR, null), 'event:spooky'));
  assert.ok(!find(started(spooky(519) - 1, null), 'event:spooky'));
  // events without items are not tracked
  assert.ok(!find(started(skyTime(519, 3, 1) + 1, null), 'event:zoo'));
});

test('started: Fishing Festival windows stop at the neighbouring festivals', () => {
  const marina = { mayor: { name: 'Marina', year: 518, perks: [{ name: 'Fishing Festival', text: '' }], minister: null } };
  const s = skyTime(519, 5, 1);
  const o = find(started(s + 1, marina), 'event:fishing');
  const month = 31 * DAY_MS;
  assert.deepEqual([o.b, o.a], [s - month + HOUR, s + month]);
  assert.ok(!find(started(s + 1, null), 'event:fishing'));
});

test('started: a term is tracked per perk with an expectation, only for the mayor elected for it', () => {
  const now = skyTime(519, 3, 2);
  const s = skyTime(519, 2, 27);
  const terms = started(now, election).filter((o) => o.key.startsWith('perk:'));
  assert.deepEqual(terms.map((o) => o.key), ['perk:Marauder', 'perk:Mining Fiesta']);
  assert.deepEqual([terms[0].s, terms[0].e, terms[0].b, terms[0].a], [s, s + YEAR_MS, s - 24 * HOUR, s + YEAR_MS + 24 * HOUR]);
  assert.deepEqual(terms[0].items, PERK_EXPECT.Marauder.items);
  // one year on the file still names the old mayor
  assert.ok(!started(now + YEAR_MS, election).some((o) => o.key.startsWith('perk:')));
  assert.ok(!started(now, { mayor: { ...election.mayor, year: undefined } }).some((o) => o.key.startsWith('perk:')));
});

test('updateTiming: the three medians are filled in as their windows pass and then kept', () => {
  const at = spooky(519);
  let t = updateTiming(null, null, series(519), at + 10 * 60000);
  const first = t.r['event:spooky'][0];
  assert.deepEqual([first.s, first.e, first.b, first.a], [min(at), min(at + HOUR), min(at - 24 * HOUR), min(at + 25 * HOUR)]);
  assert.deepEqual(first.p.GREEN_CANDY, [100, null, null]);
  assert.deepEqual(first.p.PURPLE_CANDY, [100, null, null]);
  // through the file, as the workflow does it
  t = updateTiming(JSON.parse(JSON.stringify(t)), null, series(519), at + HOUR);
  assert.deepEqual(t.r['event:spooky'][0].p.GREEN_CANDY, [100, 120, null]);
  t = updateTiming(t, null, series(519), at + 25 * HOUR);
  assert.deepEqual(t.r['event:spooky'][0].p.GREEN_CANDY, [100, 120, 90]);
  // later the snapshots are gone: nothing is overwritten, and the next festival is a second run
  t = updateTiming(t, null, () => [], at + 25 * HOUR + 20 * 60000);
  t = updateTiming(t, null, series(520), spooky(520) + 30 * 60000);
  assert.equal(t.r['event:spooky'].length, 2);
  assert.deepEqual(t.r['event:spooky'].map((r) => r.p.GREEN_CANDY), [[100, 120, 90], [100, null, null]]);
  assert.equal(t.t, spooky(520) + 30 * 60000);
});

test('updateTiming: a window without any price stays empty', () => {
  const t = updateTiming(null, null, () => [], spooky(519) + 2 * HOUR);
  assert.deepEqual(t.r['event:spooky'][0].p.GREEN_CANDY, [null, null, null]);
});

test('notices: an event with a confirmed pattern is announced three hours before', () => {
  const runs = [run(100, 120, 90), run(100, 125, 90), run(100, 130, 90)];
  const now = spooky(519) - 10 * HOUR;
  assert.deepEqual(updateTiming({ r: { 'event:spooky': runs.slice(1) } }, null, () => [], now).n, []);
  assert.deepEqual(updateTiming({ r: { 'event:spooky': runs } }, null, () => [], now).n, [{
    k: `event:spooky:${spooky(519)}`, kind: 'event', from: spooky(519) - LEAD_MS, to: spooky(519),
    title: 'Spooky Festival starts soon', lines: [['GREEN_CANDY', 'Usually +25% during event (seen 3 times)']] }]);
});

test('notices: a new mayor is announced for six hours, learned patterns and expectations', () => {
  const s = skyTime(519, 2, 27);
  const learned = [1, 2, 3].map(() => run(100, 80, 100, 'RECOMBOBULATOR_3000'));
  const n = updateTiming({ r: { 'perk:Marauder': learned } }, election, () => [], s + HOUR).n.find((x) => x.kind === 'mayor');
  assert.deepEqual([n.k, n.from, n.to, n.title], [`term:${s}`, s, s + 6 * HOUR, 'Mayor Paul took office']);
  assert.deepEqual(n.lines[0], ['RECOMBOBULATOR_3000', 'Usually −20% during term (seen 3 times)']);
  assert.deepEqual(n.lines[1], ['FUMING_POTATO_BOOK', 'expected cheaper: dungeon reward chests cost 20% less']);
  assert.ok(!updateTiming({ r: {} }, election, () => [], s + 7 * HOUR).n.some((x) => x.kind === 'mayor'));
});

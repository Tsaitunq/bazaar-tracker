import test from 'node:test';
import assert from 'node:assert/strict';
import { totalFor, statsOf } from '../../apps/guide/totals.js';
import { measure } from '../../apps/guide/build.js';
import { proposals, applyRows, isPickable } from '../../apps/guide/import/propose.js';
import { statsModel } from '../../apps/guide/stats-model.js';
import { statsView } from '../../apps/guide/views/stats.js';
import { gamedata, emptyBuild } from '../fixtures/guide-world.js';

const STAT = 'MINING_SPEED';
const hotm = (level) => ({ tier: 3, levels: { mining_speed: level }, omelette: false, disabled: [], ability: null });
const ids = gamedata.stats.stats.map((s) => s.id);
const total = (build, base) => totalFor({ area: 'mining', entry: base.mining, build, data: gamedata, stats: ids }).rows.find((r) => r.stat === STAT);
const profile = (levels) => ({ profileId: 'p', fetchedAt: 1e12, items: [], pets: null, attrLevels: null, attrUnknown: 0, huntingBox: {}, essence: null, essenceUnknown: 0, mp: null, tuning: null, stone: null, selectedPower: null, missing: { inventory: false, list: [] }, hotm: { levels, tier: 3, experience: 12000, ability: null, disabled: [], powder: {}, unknown: 0 } });
const state = (build, base) => ({ guides: [], checks: {}, keys: [], owned: [], build, base, draft: {}, dates: {} });
const world = (build, base) => ({ guides: [], checks: {}, owned: [], build, base, draft: {}, gamedata, items: {}, now: 2e12 });

test('reconcile: other sources are your /stats value minus what the app knew, and the total is the app\'s figure plus them', () => {
  const build = { ...emptyBuild(), hotm: hotm(10) };
  const base = measure({}, 'mining', { values: { [STAT]: 1000 } }, build, 5);
  const known = statsOf(build, gamedata, 'mining').add[STAT];
  assert.ok(known > 0);
  const row = total(build, base);
  assert.equal(row.total, 1000); // nothing changed since the measurement
  assert.ok(Math.abs(row.other - (1000 - known)) < 1e-9);
  // a later change counts once: the total is the app's figure now plus the other sources
  const later = { ...build, hotm: hotm(20) };
  const knownLater = statsOf(later, gamedata, 'mining').add[STAT];
  assert.ok(Math.abs(total(later, base).total - (knownLater + row.other)) < 1e-9);
});

test('import of a part the measurement did not know: the total stays, the other sources shrink by what is now known', () => {
  const base = measure({}, 'mining', { values: { [STAT]: 1000 } }, emptyBuild(), 5); // measured with the HOTM unknown
  const before = total(emptyBuild(), base);
  assert.equal(before.total, 1000);
  assert.equal(before.other, 1000);
  const w = { guides: [], checks: {}, owned: [], build: emptyBuild(), base, draft: {}, gamedata };
  const rows = proposals(w, profile({ mining_speed: 10 })).find((a) => a.id === 'hotm').rows.filter(isPickable);
  const out = applyRows(state(emptyBuild(), base), rows);
  const after = total(out.state.build, out.state.base);
  assert.equal(after.total, 1000); // not counted twice
  const knownNow = statsOf(out.state.build, gamedata, 'mining').add[STAT];
  assert.ok(knownNow > 0);
  assert.ok(Math.abs(after.other - (1000 - knownNow)) < 1e-9);
});

test('a change the profile shows against a known snapshot counts once, as a change since the measurement', () => {
  const build = { ...emptyBuild(), hotm: hotm(10) };
  const base = measure({}, 'mining', { values: { [STAT]: 1000 } }, build, 5);
  const w = { guides: [], checks: {}, owned: [], build, base, draft: {}, gamedata };
  const rows = proposals(w, profile({ mining_speed: 15 })).find((a) => a.id === 'hotm').rows.filter((r) => r.id === 'hotm:level:mining_speed');
  assert.equal(rows[0].status, 'different');
  const out = applyRows(state(build, base), rows.filter(isPickable));
  const gain = statsOf(out.state.build, gamedata, 'mining').add[STAT] - statsOf(build, gamedata, 'mining').add[STAT];
  assert.ok(gain > 0);
  assert.ok(Math.abs(total(out.state.build, out.state.base).total - (1000 + gain)) < 1e-9);
});

test('stats screen: without a base only the known sources are listed; with one, the other sources', () => {
  const build = { ...emptyBuild(), hotm: hotm(10) };
  const none = statsModel(world(build, {}), 'mining');
  assert.ok(none.known.some((k) => k.id === STAT));
  assert.deepEqual(none.other, []);
  assert.match(statsView(world(build, {}), { page: 'stats', tab: 'overview', area: 'mining' }), /From known sources/);
  const base = measure({}, 'mining', { values: { [STAT]: 1000 } }, build, 5);
  const some = statsModel(world(build, base), 'mining');
  assert.deepEqual(some.known, []);
  assert.ok(some.other.some((o) => o.id === STAT));
  const html = statsView(world(build, base), { page: 'stats', tab: 'overview', area: 'mining' });
  assert.match(html, /<h2>Other sources<\/h2>/);
  assert.doesNotMatch(html, /From known sources/);
  assert.match(statsView(world(build, base), { page: 'stats', tab: 'measure', area: 'mining' }), /Optional\. Without it the stats show only what the app knows/);
});

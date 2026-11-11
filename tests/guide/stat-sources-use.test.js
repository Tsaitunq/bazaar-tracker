import test from 'node:test';
import assert from 'node:assert/strict';
import { totalFor, statsOf } from '../../apps/guide/totals.js';
import { measure } from '../../apps/guide/build.js';
import { statsModel } from '../../apps/guide/stats-model.js';
import { calcFor } from '../../apps/guide/sources.js';
import { gamedata, emptyBuild } from '../fixtures/guide-world.js';

const ss = gamedata.statSources;
const ids = gamedata.stats.stats.map((s) => s.id);
const items = { RING: { category: 'ACCESSORY', stats: { HEALTH: 10, STRENGTH: 8 } } };
const profile = (more = {}) => ({ profileId: 'p', fetchedAt: 1, skills: null, slayer: null, skyblockXp: 12345, items: [{ id: 'RING', at: ['Accessory Bag'], enrichment: null }], ...more });
const world = (build, base, prof = profile()) => ({ guides: [], checks: {}, owned: [], build, base, draft: {}, gamedata, items, now: 2e12, profile: prof });
const row = (m, id) => m.rows.find((r) => r.id === id);
const num = (text) => Number(String(text).replace(/,/g, ''));

test('not measured: the total is base + build + sources (health 100, SkyBlock level 123, one ring)', () => {
  const m = statsModel(world(emptyBuild(), {}), 'blaze');
  assert.equal(num(row(m, 'HEALTH').total), 100 + 123 * 5 + 10);
  assert.equal(num(row(m, 'STRENGTH').total), 24 + 8);
  assert.equal(row(m, 'HEALTH').unsafe, true); // the SkyBlock level is one source
  assert.equal(row(m, 'CRITICAL_CHANCE').unsafe, false); // only the safe base
  assert.ok(m.known.some((k) => k.id === 'HEALTH' && k.unsafe));
  assert.deepEqual(m.other, []);
  assert.equal(m.hasCalc, true);
});

test('without an import nothing changes: no sources, no base, the old buff values', () => {
  const m = statsModel({ ...world(emptyBuild(), {}), profile: null }, 'blaze');
  assert.equal(m.hasCalc, false);
  assert.equal(row(m, 'HEALTH').total, '–');
  const god = statsOf({ ...emptyBuild(), buffs: { godPotion: true, boosterCookie: false } }, gamedata, 'blaze');
  assert.equal(god.add.STRENGTH, 95);
  const withImport = statsOf({ ...emptyBuild(), buffs: { godPotion: true, boosterCookie: false } }, gamedata, 'blaze', undefined, calcFor(world(emptyBuild(), {})));
  assert.equal(withImport.add.STRENGTH, ss.godPotion.stats.STRENGTH.value);
});

test('measured with the import: the total is what was typed, a source that grew counts once', () => {
  const build = emptyBuild();
  const calc = calcFor(world(build, {}));
  const base = measure({}, 'blaze', { values: { HEALTH: 2000, STRENGTH: 500 }, calc: calc.add }, build, 5);
  assert.equal(base.blaze.snapshot.calc.HEALTH, 123 * 5 + 10);
  const now = statsModel(world(build, base), 'blaze');
  assert.equal(num(row(now, 'HEALTH').total), 2000);
  // other = typed minus the sources then minus the base
  const other = now.other.find((o) => o.id === 'HEALTH');
  assert.equal(other.value, 2000 - (123 * 5 + 10) - 100);
  assert.equal(now.assumed, false);
  // 200 SkyBlock XP later: 2 levels, +10 Health, once
  const later = statsModel(world(build, base, profile({ skyblockXp: 12545 })), 'blaze');
  assert.equal(num(row(later, 'HEALTH').total), 2010);
  assert.ok(later.changes.some((c) => c.id === 'HEALTH' && c.parts.includes('Skills, slayers, level, accessories')));
  assert.equal(later.other.find((o) => o.id === 'HEALTH').value, other.value);
});

test('a measurement from before the import counts the sources as they are now and says so', () => {
  const build = emptyBuild();
  const base = measure({}, 'blaze', { values: { HEALTH: 2000 } }, build, 5);
  assert.equal(base.blaze.snapshot.calc, undefined);
  const m = statsModel(world(build, base), 'blaze');
  assert.equal(num(row(m, 'HEALTH').total), 2000);
  assert.equal(m.assumed, true);
  assert.equal(m.other.find((o) => o.id === 'HEALTH').value, 2000 - (123 * 5 + 10) - 100);
});

test('a gap names the unsafe sources behind the stat, a stat without a gap names none', () => {
  const build = emptyBuild();
  const calc = calcFor(world(build, {}));
  const base = measure({}, 'blaze', { values: { HEALTH: 2000, CRITICAL_CHANCE: 30 }, calc: calc.add }, build, 5);
  const m = statsModel(world(build, base), 'blaze');
  const health = m.other.find((o) => o.id === 'HEALTH');
  assert.ok(health.suspects.some((s) => /SkyBlock level 123/.test(s)));
  assert.equal(m.other.find((o) => o.id === 'CRITICAL_CHANCE'), undefined); // the safe base explains all of it
});

test('what could not be counted is listed', () => {
  const m = statsModel(world(emptyBuild(), {}, profile({ items: [{ id: 'NOSTATS', at: ['Accessory Bag'] }], skyblockXp: null })), 'blaze');
  assert.ok(m.unknown.some((t) => /SkyBlock level: the worker/.test(t)));
  assert.ok(m.unknown.some((t) => /Skills API is off/.test(t)));
  assert.ok(m.unknown.some((t) => /1 accessories have no stats.*NOSTATS/.test(t)));
});

test('measure keeps the sources only when it is given them', () => {
  assert.equal('calc' in measure({}, 'blaze', { values: {} }, emptyBuild(), 1).blaze.snapshot, false);
  assert.deepEqual(measure({}, 'blaze', { values: {}, calc: { HEALTH: 5 } }, emptyBuild(), 1).blaze.snapshot.calc, { HEALTH: 5 });
});

test('totalFor without calc is untouched by the new argument', () => {
  const build = emptyBuild();
  const entry = measure({}, 'blaze', { values: { HEALTH: 700 } }, build, 5).blaze;
  const r = totalFor({ area: 'blaze', entry, build, data: gamedata, stats: ids });
  assert.equal(r.total.HEALTH, 700);
});

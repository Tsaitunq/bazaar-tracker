import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadGameData, valueAt } from '../guide/gamedata.js';
import { statsOf, totalFor } from '../guide/totals.js';
import { emptyBuild, measure, setPart } from '../guide/build.js';

const read = (f) => JSON.parse(fs.readFileSync(new URL(`../gamedata/${f}.json`, import.meta.url), 'utf8'));
const data = await loadGameData(read);
const STATS = ['MINING_FORTUNE', 'MINING_SPEED', 'STRENGTH'];
const total = (entry, build, gear = {}, area = 'mining') => totalFor({ area, entry, build, gear, data, stats: STATS });
const NOW = 1e12;
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('valueAt: linear, step, floor, cap, level 0', () => {
  assert.equal(valueAt({ a: 0, b: 20 }, 3), 60);
  assert.equal(valueAt({ a: 0, b: 20 }, 0), 0);
  const quick = data.hotm.perks.find((p) => p.id === 'quick_forge').otherEffects[0];
  assert.equal(valueAt(quick, 20), 30); // 10 + 10 + 10, capped at 30
  assert.equal(valueAt({ a: 1, b: 0.2, floor: true }, 7), 2);
});

test('base only, gear only, and both', () => {
  const entry = measure({}, 'mining', { values: { MINING_FORTUNE: 100 } }, emptyBuild(), NOW).mining;
  const r = total(entry, emptyBuild(), { MINING_FORTUNE: 30, MINING_SPEED: 5 });
  assert.equal(r.total.MINING_FORTUNE, 130);
  const speed = r.rows.find((x) => x.stat === 'MINING_SPEED');
  assert.equal(speed.total, undefined); // no base typed: unknown, not 0
  assert.equal(speed.gear, 5);
});

test('nothing changed since the measurement: no delta', () => {
  const build = { ...emptyBuild(), hotm: { levels: { mining_speed: 10 } } };
  const entry = measure({}, 'mining', { values: { MINING_SPEED: 500 } }, build, NOW).mining;
  assert.equal(total(entry, build).total.MINING_SPEED, 500);
});

test('unknown part at the measurement, then entered: total unchanged, then +1 level moves it by the formula', () => {
  let build = emptyBuild();
  let base = measure({}, 'mining', { values: { MINING_SPEED: 500 } }, build, NOW);
  assert.equal(base.mining.snapshot.hotm, null);
  ({ build, base } = setPart(build, base, 'hotm', { levels: { mining_speed: 10 } }));
  assert.equal(base.mining.snapshot.hotm.levels.mining_speed, 10);
  assert.equal(total(base.mining, build).total.MINING_SPEED, 500); // already inside the base
  ({ build, base } = setPart(build, base, 'hotm', { levels: { mining_speed: 11 } }));
  assert.equal(total(base.mining, build).total.MINING_SPEED, 520); // +20 per level
});

test('a part set before the measurement is not backfilled', () => {
  let build = emptyBuild();
  ({ build } = setPart(build, {}, 'hotm', { levels: { mining_speed: 5 } }));
  let base = measure({}, 'mining', { values: { MINING_SPEED: 100 } }, build, NOW);
  ({ build, base } = setPart(build, base, 'hotm', { levels: { mining_speed: 6 } }));
  assert.equal(base.mining.snapshot.hotm.levels.mining_speed, 5);
  assert.equal(total(base.mining, build).total.MINING_SPEED, 120);
});

test('multiplier comes after the sum and only where its condition holds', () => {
  const lone = { ...emptyBuild(), hotm: { levels: { lonesome_miner: 1 } } }; // 5 %
  const entry = measure({}, 'mining', { values: { STRENGTH: 100 } }, { ...emptyBuild(), hotm: { levels: {} } }, NOW).mining; // measured with an empty tree
  near(total(entry, lone, { STRENGTH: 100 }).total.STRENGTH, 210); // (100 + 100) * 1.05
  const blaze = totalFor({ area: 'blaze', entry, build: lone, gear: { STRENGTH: 100 }, data, stats: STATS });
  assert.equal(blaze.total.STRENGTH, 200);
  assert.ok(blaze.listed.some((l) => l.cond === 'on_mining_islands'));
});

test('a measured multiplier is divided out of the base before the sum', () => {
  const lone = { ...emptyBuild(), hotm: { levels: { lonesome_miner: 1 } } };
  const entry = measure({}, 'mining', { values: { STRENGTH: 105 } }, lone, NOW).mining;
  near(total(entry, lone, { STRENGTH: 100 }).total.STRENGTH, 210); // (105 / 1.05 + 100) * 1.05
});

test('conditional effects are listed, not summed', () => {
  const out = statsOf({ ...emptyBuild(), hotm: { levels: { strong_arm: 10 } } }, data, 'mining');
  assert.equal(out.add.MINING_SPEED, undefined);
  assert.ok(out.listed.some((l) => l.cond === 'mining_dwarven_metals'));
});

test('omelette adds a level to perks that take it', () => {
  const build = { ...emptyBuild(), hotm: { levels: { mining_speed: 10 }, omelette: true } };
  assert.equal(statsOf(build, data, 'mining').add.MINING_SPEED, 220);
});

test('empty field is unknown, not 0', () => {
  const entry = measure({}, 'mining', { values: { MINING_FORTUNE: '', MINING_SPEED: '0' }, mp: '' }, emptyBuild(), NOW).mining;
  assert.deepEqual(entry.values, { MINING_SPEED: 0 });
  assert.equal('mp' in entry, false);
});

test('the God Potion toggled after the measurement moves the total', () => {
  const entry = measure({}, 'mining', { values: { MINING_SPEED: 100 } }, emptyBuild(), NOW).mining;
  const on = { ...emptyBuild(), buffs: { godPotion: true, boosterCookie: false } };
  assert.equal(total(entry, on).total.MINING_SPEED, 300);
});

test('power: stone = base x multiplier + unique bonus, tuning per point, mp 250 gives 9.642', () => {
  const m = data.power.multiplier;
  assert.equal(Math.round(m.a * Math.log(m.b * 250 + 1) ** m.exp * 1000) / 1000, 9.642);
  const out = statsOf({ ...emptyBuild(), power: { stone: 'MANDRAA', mp: 250, tuning: { STRENGTH: 10, CRITICAL_CHANCE: 5, HEALTH: 2 } } }, data, 'blaze');
  const scale = m.a * Math.log(m.b * 250 + 1) ** m.exp;
  near(out.add.STRENGTH, 12 * scale + 25 + 10);
  near(out.add.CRITICAL_CHANCE, 1);
  near(out.add.HEALTH, 10);
});

test('power: the tuning values are the confirmed ones', () => {
  const t = Object.fromEntries(data.power.tuning.stats.map((s) => [s.stat, s.perPoint]));
  assert.deepEqual(t, { HEALTH: 5, DEFENSE: 1, SPEED: 1.5, STRENGTH: 1, CRITICAL_DAMAGE: 1, CRITICAL_CHANCE: 0.2, ATTACK_SPEED: 0.3, INTELLIGENCE: 2 });
});

test('moved: names the editor that shifted a stat since the measurement', () => {
  const was = { ...emptyBuild(), hotm: { tier: 10, levels: { mining_speed: 5 }, omelette: false }, power: { stone: null, mp: null, tuning: {} } };
  const entry = measure({}, 'mining', { values: { MINING_SPEED: 1000 } }, was, NOW).mining;
  const now = { ...was, hotm: { ...was.hotm, levels: { mining_speed: 8 } }, power: { stone: null, mp: null, tuning: { MINING_SPEED: 1 } }, attrs: { nature_elemental: 3 } };
  const r = total(entry, now);
  assert.deepEqual(r.moved.MINING_SPEED.map((m) => m.part), ['hotm']);
  near(r.moved.MINING_SPEED[0].value, 60);
  assert.equal(r.moved.STRENGTH, undefined);
  assert.deepEqual(total(entry, was).moved, {}); // nothing changed: empty
  near(r.total.MINING_SPEED, 1060);
});

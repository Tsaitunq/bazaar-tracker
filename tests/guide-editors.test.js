import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadGameData } from '../guide/gamedata.js';
import { statsOf, totalFor } from '../guide/totals.js';
import { emptyBuild, measure, editPart, commitDraft, needsDraft, perkLevel, hotmTier, attrLevel, powerStone, powerMp, tuningPoints } from '../guide/build.js';
import { lockOf, costOf, costBetween, effectsAt, spent } from '../guide/hotm-model.js';

const read = (f) => JSON.parse(fs.readFileSync(new URL(`../gamedata/${f}.json`, import.meta.url), 'utf8'));
const data = await loadGameData(read);
const perk = (id) => data.hotm.perks.find((p) => p.id === id);
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('cost: formula, one-level perks cost a token, only mining_speed is unknown', () => {
  const mf = perk('mining_fortune');
  assert.deepEqual(costOf(mf, 3), { powder: 'mithril', amount: Math.floor(4 ** 3.05) });
  assert.deepEqual(costOf(perk('sky_mall'), 1), { tokens: 1 });
  assert.deepEqual(costOf(perk('pickobulus'), 1), { tokens: 1 });
  assert.equal(costOf(perk('mining_speed'), 2), null);
  assert.equal(costBetween(perk('mining_speed'), 0, 5).unknown, true);
  const unknown = data.hotm.perks.filter((p) => costBetween(p, 0, p.maxLevel).unknown).map((p) => p.id);
  assert.deepEqual(unknown, ['mining_speed']);
  const toMax = costBetween(mf, 10, 50).mithril;
  assert.equal(toMax, Array.from({ length: 40 }, (_, i) => Math.floor((i + 11 + 1) ** 3.05)).reduce((a, b) => a + b, 0));
});

test('core of the mountain: cost from its table, level 1 is free', () => {
  const core = perk('core_of_the_mountain');
  assert.deepEqual(costOf(core, 1), {});
  assert.deepEqual(costOf(core, 2), { powder: 'mithril', amount: 50000 });
});

test('locks: rows above the HOTM level and a missing requirement; unknown tier locks nothing', () => {
  assert.equal(lockOf(perk('mining_master'), null), null);
  assert.equal(lockOf(perk('mining_master'), { tier: null, levels: {} }), null);
  assert.equal(lockOf(perk('mining_master'), { tier: 9, levels: {} }), 'tier');
  assert.equal(lockOf(perk('mining_master'), { tier: 10, levels: {} }), null);
  assert.equal(lockOf(perk('front_loaded'), { tier: 10, levels: {} }), 'requires');
  assert.equal(lockOf(perk('front_loaded'), { tier: 10, levels: { seasoned_mineman: 1 } }), null);
});

test('a locked perk keeps its level but does not count', () => {
  const levels = { mining_fortune: 10, mining_master: 5 };
  const free = statsOf({ ...emptyBuild(), hotm: { tier: null, levels } }, data, 'mining').add;
  const locked = statsOf({ ...emptyBuild(), hotm: { tier: 5, levels } }, data, 'mining').add;
  assert.ok(free.MINING_FORTUNE > 0);
  assert.equal(locked.MINING_FORTUNE, free.MINING_FORTUNE - (statsOf({ ...emptyBuild(), hotm: { tier: null, levels: { mining_master: 5 } } }, data, 'mining').add.MINING_FORTUNE ?? 0));
  const lowered = { ...emptyBuild(), hotm: { tier: 5, levels: { mining_fortune: 10 } } };
  assert.deepEqual(statsOf(lowered, data, 'mining').add, locked);
});

test('effects at the level and with the omelette', () => {
  const mf = perk('mining_fortune');
  const [at5] = effectsAt(mf, 5, false);
  const [at6] = effectsAt(mf, 5, true);
  assert.ok(at6.value > at5.value);
  assert.equal(effectsAt(mf, 0, true)[0].value, 0);
});

test('draft: the first entry of an unknown part is written once, then edits are deltas', () => {
  const STATS = ['MINING_FORTUNE'];
  let state = { build: emptyBuild(), base: {}, draft: {} };
  state.base = measure({}, 'mining', { values: { MINING_FORTUNE: 1000 } }, state.build, 1);
  assert.equal(needsDraft(state.build, state.base, 'hotm'), true);
  const total = () => totalFor({ area: 'mining', entry: state.base.mining, build: state.build, data, stats: STATS }).rows[0].total;
  state = editPart(state, 'hotm', perkLevel(perk('mining_fortune'), 10));
  state = editPart(state, 'hotm', perkLevel(perk('titanium_insanium'), 5));
  assert.equal(state.build.hotm, null); // still a draft, the total is the typed value
  assert.equal(total(), 1000);
  state = commitDraft(state, 'hotm');
  assert.equal(state.draft.hotm, undefined);
  assert.equal(total(), 1000); // the tree is inside the base
  const before = total();
  state = editPart(state, 'hotm', perkLevel(perk('mining_fortune'), 11));
  const step = statsOf({ ...emptyBuild(), hotm: { levels: { mining_fortune: 11 } } }, data, 'mining').add.MINING_FORTUNE - statsOf({ ...emptyBuild(), hotm: { levels: { mining_fortune: 10 } } }, data, 'mining').add.MINING_FORTUNE;
  near(total() - before, step);
});

test('without a measurement the editors write straight to the build', () => {
  let state = { build: emptyBuild(), base: {}, draft: {} };
  assert.equal(needsDraft(state.build, state.base, 'attrs'), false);
  state = editPart(state, 'hotm', hotmTier(7));
  assert.equal(state.build.hotm.tier, 7);
  assert.equal(editPart(state, 'hotm', hotmTier(11)).build.hotm.tier, null);
});

test('levels are clamped to the maximum and whole', () => {
  const state = editPart({ build: emptyBuild(), base: {}, draft: {} }, 'hotm', perkLevel(perk('sky_mall'), 7));
  assert.equal(state.build.hotm.levels.sky_mall, 1);
  const attr = data.attributes.attributes[0];
  assert.equal(editPart(state, 'attrs', attrLevel(attr, 99)).build.attrs[attr.key], attr.maxLevel);
  assert.equal(editPart(state, 'attrs', attrLevel(attr, -3)).build.attrs[attr.key], 0);
});

test('power editor: stone, mp and tuning reach the totals', () => {
  let state = { build: emptyBuild(), base: {}, draft: {} };
  state = editPart(state, 'power', powerStone('MANDRAA'));
  state = editPart(state, 'power', powerMp('250'));
  state = editPart(state, 'power', tuningPoints('STRENGTH', 4));
  const m = data.power.multiplier;
  near(statsOf(state.build, data, 'blaze').add.STRENGTH, 12 * m.a * Math.log(m.b * 250 + 1) ** m.exp + 25 + 4);
  assert.equal(editPart(state, 'power', powerMp('')).build.power.mp, null);
});

test('spent powder counts the set levels', () => {
  const s = spent(data, { levels: { mining_fortune: 2, sky_mall: 1 } });
  assert.equal(s.mithril, Math.floor(2 ** 3.05) + Math.floor(3 ** 3.05));
  assert.equal(s.tokens, 1);
});

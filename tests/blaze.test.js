import test from 'node:test';
import assert from 'node:assert/strict';
import { DAGGERS, OFA, hitOf, hitsPerSecond, additiveOf, activePath, daggersOf, dominusOf, blazeOutput, blazeState } from '../blaze.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} is not ${b}`);
const stats = { DAMAGE: 95, STRENGTH: 100, CRITICAL_CHANCE: 50, CRITICAL_DAMAGE: 100 };
const dagger = (id, extra = {}) => ({ id, where: 'inventory', enchants: {}, lore: {}, ...extra });
const INFERNAL = ['INFERNAL_CRIMSON_HELMET', 'INFERNAL_CRIMSON_BOOTS'];

test('hit follows the wiki formula with the expected crit', () => {
  // (5 + 95) × 2 × (1 + 0.5 × 1) × (1 + 50/100) × 2
  near(hitOf(stats, 50, 2), 900);
});

test('the dagger multipliers are the wiki values', () => {
  assert.deepEqual(Object.values(DAGGERS).map((d) => d.m), [1.2, 1.5, 2, 1.5, 2.5, 3.5]);
  assert.deepEqual(Object.values(DAGGERS).map((d) => d.line), ['ashen', 'ashen', 'ashen', 'spirit', 'spirit', 'spirit']);
});

test('crit chance stops at 100', () => {
  near(hitOf({ ...stats, CRITICAL_CHANCE: 300 }, 0, 1), 100 * 2 * 2);
});

test('ticks follow the wiki and hits per second is 20 over ticks', () => {
  assert.equal(hitsPerSecond(0), 2);
  assert.equal(hitsPerSecond(82), 20 / 5);
  assert.equal(hitsPerSecond(100), 4);
  assert.equal(hitsPerSecond(500), 4);
});

test('a little attack speed below a step changes nothing, more jumps', () => {
  assert.equal(hitsPerSecond(1), hitsPerSecond(0));
  assert.ok(hitsPerSecond(20) > hitsPerSecond(0));
});

const state = (daggers, common = stats, armorIds = []) => ({ common, daggers, armorIds, path: activePath(daggers) });

test('the output is the mean of the lines times hits per second', () => {
  const pair = { ashen: dagger('FIREDUST_DAGGER'), spirit: dagger('MAWDUST_DAGGER') };
  const base = 100 * 2 * 1.5;
  near(blazeOutput(state(pair)), ((base * 1.2) + (base * 1.5)) / 2 * 2);
});

test('attack speed of a dagger counts for its own line', () => {
  const pair = { ashen: dagger('FIREDUST_DAGGER', { lore: { ATTACK_SPEED: 100 } }), spirit: dagger('MAWDUST_DAGGER') };
  const base = 100 * 2 * 1.5;
  near(blazeOutput(state(pair)), ((base * 1.2 * 4) + (base * 1.5 * 2)) / 2);
});

test('one dagger: the mean is that line alone', () => {
  near(blazeOutput(state({ ashen: dagger('FIREDUST_DAGGER'), spirit: null })), 100 * 2 * 1.5 * 1.2 * 2);
});

test('no dagger still gives a number to compare with', () => {
  near(blazeOutput(state({ ashen: null, spirit: null })), 100 * 2 * 1.5 * 2);
});

test('sharpness adds by its level, one for all adds 500 and drops the others', () => {
  const sharp = dagger('FIREDUST_DAGGER', { enchants: { sharpness: 7 } });
  assert.equal(additiveOf(sharp, [], 'guide'), 50);
  assert.equal(additiveOf(dagger('FIREDUST_DAGGER', { enchants: { sharpness: 5 } }), [], 'guide'), 30);
  assert.equal(additiveOf(dagger('FIREDUST_DAGGER'), [], 'guide'), 0);
  assert.equal(additiveOf(sharp, [], 'ofa'), 500);
});

test('infernal dominus adds 100 from two pieces, one piece or a lower tier adds none', () => {
  assert.equal(dominusOf(INFERNAL), 100);
  assert.equal(dominusOf(['INFERNAL_CRIMSON_HELMET']), 0);
  assert.equal(dominusOf(['FIERY_CRIMSON_HELMET', 'FIERY_CRIMSON_BOOTS', 'BURNING_CRIMSON_LEGGINGS', 'HOT_CRIMSON_CHESTPLATE']), 0);
  assert.equal(additiveOf(dagger('FIREDUST_DAGGER', { enchants: { sharpness: 7 } }), INFERNAL, 'guide'), 150);
});

test('the active path follows a dagger with one for all', () => {
  assert.equal(activePath({ ashen: dagger('FIREDUST_DAGGER'), spirit: null }), 'guide');
  assert.equal(activePath({ ashen: dagger('FIREDUST_DAGGER'), spirit: dagger('MAWDUST_DAGGER', { enchants: { [OFA]: 1 } }) }), 'ofa');
});

test('a forced path changes the output and not the state', () => {
  const s = state({ ashen: dagger('FIREDUST_DAGGER'), spirit: null });
  near(blazeOutput(s, 'ofa') / blazeOutput(s), 6);
  assert.equal(s.path, 'guide');
});

test('daggersOf takes the highest tier owned per line', () => {
  const profile = { items: [dagger('FIREDUST_DAGGER'), dagger('HEARTFIRE_DAGGER'), dagger('BURSTFIRE_DAGGER'), dagger('MAWDUST_DAGGER'), dagger('OTHER')] };
  const out = daggersOf(profile);
  assert.equal(out.ashen.id, 'HEARTFIRE_DAGGER');
  assert.equal(out.spirit.id, 'MAWDUST_DAGGER');
  assert.equal(daggersOf({ items: [] }).ashen, null);
});

test('the state takes the held weapon out of the shared stats', () => {
  const held = dagger('FIREDUST_DAGGER', { lore: { DAMAGE: 90, STRENGTH: 45 } });
  const s = blazeState({ DAMAGE: 90, STRENGTH: 145 }, { held, armor: [{ id: 'INFERNAL_CRIMSON_HELMET' }] }, { ashen: held, spirit: null });
  assert.deepEqual(s.common, { STRENGTH: 100 });
  assert.deepEqual(s.armorIds, ['INFERNAL_CRIMSON_HELMET']);
  assert.equal(s.path, 'guide');
});

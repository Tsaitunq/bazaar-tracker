import test from 'node:test';
import assert from 'node:assert/strict';
import { pathOf } from '../path.js';
import { miningSettings } from '../optimizer.js';
import { virtualProfile, virtualLoadout } from '../virtual.js';
import { blazeState, daggersOf } from '../blaze.js';

const sold = (price) => ({ buy_summary: [{ pricePerUnit: price, amount: 100 }] });
const step = (text, id, fortune, extra = {}) => ({ text, gain: { MINING_FORTUNE: fortune }, items: [{ id, qty: 1 }], ...extra });
const guideOf = (steps, extra = {}) => ({ id: 'g', title: 'G', area: 'mining', sections: [{ name: 'S', steps }], ...extra });

function run(guide, products, { done = [], brake = 5, base = { MINING_FORTUNE: 100, MINING_SPEED: 1000 }, ...over } = {}) {
  const checked = new Set(done.map((text) => `S|${text}`));
  const profile = virtualProfile(guide, checked, new Set(), {});
  return pathOf({ guide, checked, ctx: { products, items: {}, forge: null, ah: {}, tax: 0 }, profile, loadout: virtualLoadout(profile, {}, 'mining'), base, settings: miningSettings(null), brake, other: null, keepOldGear: true, state: null, ...over });
}
const texts = (path) => path.order.map((e) => e.step.text);

test('best value per coin comes first', () => {
  const g = guideOf([step('dear', 'A', 1), step('good', 'B', 10)]);
  assert.deepEqual(texts(run(g, { A: sold(1e6), B: sold(1e6) })), ['good', 'dear']);
});

test('guide order breaks a tie', () => {
  const g = guideOf([step('one', 'A', 5), step('two', 'B', 5)]);
  const path = run(g, { A: sold(1e6), B: sold(1e6) }, { base: { MINING_SPEED: 1000 } });
  assert.deepEqual(texts(path), ['one', 'two']);
});

// the cap is brake x max(spent, 1M): 6M fits under brake 5 from 1.2M spent on
test('a step over brake x max(spent, 1M) waits and comes after spending', () => {
  const g = guideOf([step('big', 'BIG', 500), step('small', 'S1', 2), step('next', 'S2', 1)]);
  const products = { BIG: sold(6e6), S1: sold(1.2e6), S2: sold(1e6) };
  const path = run(g, products);
  assert.deepEqual(texts(path), ['small', 'big', 'next']);
  assert.equal(path.order[1].tier, 'value');
  // what is already done counts as spent
  assert.equal(run(g, products, { done: ['small'] }).order[0].step.text, 'big');
});

test('every step over the cap: cheapest first, path stays complete', () => {
  const g = guideOf([step('dear', 'A', 100), step('cheap', 'B', 1), step('mid', 'C', 50)]);
  const path = run(g, { A: sold(9e6), B: sold(6e6), C: sold(7e6) }, { brake: 1 });
  assert.deepEqual(texts(path), ['cheap', 'mid', 'dear']);
  assert.equal(path.order[0].tier, 'overCap');
  assert.equal(path.order.length, 3);
});

test('a priority step stays ahead of a better rate', () => {
  const g = guideOf([step('rate', 'A', 100), step('low', 'B', 1, { priority: 1 }), step('high', 'C', 1, { priority: 2 })]);
  const path = run(g, { A: sold(1e5), B: sold(1e6), C: sold(1e6) });
  assert.deepEqual(texts(path), ['high', 'low', 'rate']);
  assert.equal(path.order[0].tier, 'priority');
});

test('a line keeps its order', () => {
  const g = guideOf([step('first', 'A', 1, { line: 'L' }), step('second', 'B', 100, { line: 'L' }), step('alone', 'C', 10)]);
  assert.deepEqual(texts(run(g, { A: sold(1e6), B: sold(1e5), C: sold(1e6) })), ['alone', 'first', 'second']);
});

test('a line step without a gain walks to the next one and pays for both', () => {
  const g = guideOf([{ text: 'unlock', items: [{ id: 'A', qty: 1 }], detect: { kind: 'held' }, gain: { PRISTINE: 0 }, line: 'L' }, step('payoff', 'B', 10, { line: 'L' })]);
  const [head, tail] = run(g, { A: sold(1e6), B: sold(1e6) }).order;
  assert.equal(head.coins, 2e6);
  assert.ok(head.gain > 0);
  assert.equal(head.ahead.text, 'payoff');
  assert.equal(tail.gain, 0);
  assert.equal(tail.coins, 0);
});

test('a group ranks as one and stays together', () => {
  const g = guideOf([step('a', 'A', 1, { group: 'G' }), step('other', 'C', 5), step('b', 'B', 100, { group: 'G' })]);
  const path = run(g, { A: sold(1e6), B: sold(1e6), C: sold(1e6) });
  assert.deepEqual(texts(path), ['a', 'b', 'other']);
  assert.deepEqual(path.order[0].group, { id: 'G', left: 1, head: true });
  assert.deepEqual(path.order[1].group, { id: 'G', left: 0, head: false });
  assert.equal(path.order[0].coins, 2e6);
  assert.deepEqual(path.order[0].delta, { MINING_FORTUNE: 101 });
});

test('a group with a member behind an open line step waits', () => {
  const g = guideOf([step('before', 'L1', 1, { line: 'L' }), step('member', 'L2', 100, { line: 'L', group: 'G' }), step('mate', 'M', 100, { group: 'G' }), step('alone', 'C', 2)]);
  const path = run(g, { L1: sold(1e6), L2: sold(1e5), M: sold(1e5), C: sold(1e6) });
  assert.ok(texts(path).indexOf('before') < texts(path).indexOf('member'));
  assert.ok(texts(path).indexOf('before') < texts(path).indexOf('mate'));
  assert.equal(texts(path).indexOf('mate'), texts(path).indexOf('member') + 1);
});

test('half done group: head done, rest shows open sum and left', () => {
  const g = guideOf([step('a', 'A', 1, { group: 'G' }), step('b', 'B', 2, { group: 'G' }), step('c', 'C', 3, { group: 'G' })]);
  const path = run(g, { A: sold(1e6), B: sold(1e6), C: sold(1e6) }, { done: ['a'] });
  assert.deepEqual(texts(path), ['b', 'c']);
  assert.equal(path.order[0].group.left, 1);
  assert.equal(path.order[0].group.head, true);
  assert.equal(path.order[0].coins, 2e6);
  assert.deepEqual(path.order[0].delta, { MINING_FORTUNE: 5 });
});

test('no price, no gain and zero stand after the ranked steps in guide order', () => {
  const g = guideOf([
    { text: 'zero', items: [{ id: 'A', qty: 1 }], detect: { kind: 'enchant', enchant: 'nothing_at_all', level: 1, on: [] }, gain: { PRISTINE: 0 } },
    { text: 'noGain', items: [{ id: 'A', qty: 1 }] },
    step('noPrice2', 'GONE', 1),
    step('ranked', 'A', 1),
    step('noPrice1', 'GONE', 1),
  ]);
  const path = run(g, { A: sold(1e6) });
  assert.equal(path.order[0].step.text, 'ranked');
  assert.deepEqual(texts(path).slice(1, 3), ['noPrice2', 'noPrice1']);
  assert.deepEqual(path.order.slice(1).map((e) => e.tier).filter((t, i, all) => all.indexOf(t) === i), ['noPrice', 'noGain', 'zero'].filter((t) => path.order.some((e) => e.tier === t)));
});

test('a locked line head stays last and takes its line along', () => {
  const items = { A: { requirements: [{ type: 'SKILL', skill: 'MINING', level: 99 }] } };
  const g = guideOf([step('locked', 'A', 50, { line: 'L' }), step('behind', 'B', 50, { line: 'L' }), step('free', 'C', 1)]);
  const profile = { ...virtualProfile(g, new Set(), new Set(), {}), skills: { MINING: 1 } };
  const path = pathOf({ guide: g, checked: new Set(), ctx: { products: { A: sold(1e6), B: sold(1e6), C: sold(1e6) }, items, tax: 0 }, profile, loadout: virtualLoadout(profile, {}, 'mining'), base: { MINING_FORTUNE: 100 }, settings: miningSettings(null), brake: 5, keepOldGear: true });
  assert.equal(path.order[0].step.text, 'free');
  assert.ok(texts(path).indexOf('locked') < texts(path).indexOf('behind'));
});

test('without prices the order is the guide order', () => {
  const g = guideOf([step('dear', 'A', 1), step('good', 'B', 10), step('first', 'C', 5, { priority: 2 })]);
  const path = run(g, null);
  assert.deepEqual(texts(path), ['dear', 'good', 'first']);
  assert.ok(path.order.every((e) => e.tier === 'noPrice'));
});

test('fixed order keeps the guide order and adds the gains up', () => {
  const g = guideOf([step('a', 'A', 100), step('b', 'B', 100), step('c', 'C', 100, { group: 'G' }), step('d', 'D', 100, { group: 'G' })], { order: 'fixed' });
  const path = run(g, { A: sold(1e7), B: sold(1e5), C: sold(1e5), D: sold(1e5) }, { base: { MINING_FORTUNE: 100 } });
  assert.deepEqual(texts(path), ['a', 'b', 'c', 'd']);
  assert.equal(path.order[0].gain, 100 / 200);
  assert.equal(path.order[1].gain, 100 / 300);
  assert.equal(path.order[2].gain, 200 / 400);
  assert.equal(path.order[2].group.left, 1);
  assert.equal(path.order[0].tier, 'value');
});

test('extra sections never stand in the order', () => {
  const g = { id: 'g', title: 'G', area: 'mining', sections: [{ name: 'S', steps: [step('a', 'A', 1)] }, { name: 'X', extra: true, steps: [step('buff', 'A', 99)] }] };
  assert.deepEqual(texts(run(g, { A: sold(1e6) })), ['a']);
});

test('what a planned item replaces is what the next one improves on', () => {
  const items = { LOW: { category: 'HELMET', tier: 'RARE', stats: { MINING_FORTUNE: 10 } }, HIGH: { category: 'HELMET', tier: 'EPIC', stats: { MINING_FORTUNE: 30 } } };
  const g = guideOf([
    { text: 'low', items: [{ id: 'LOW', qty: 1 }], detect: { kind: 'owned', on: [['LOW']] } },
    { text: 'high', items: [{ id: 'HIGH', qty: 1 }], detect: { kind: 'owned', on: [['HIGH']] } },
  ]);
  const profile = virtualProfile(g, new Set(), new Set(), items);
  const path = pathOf({ guide: g, checked: new Set(), ctx: { products: { LOW: sold(1e5), HIGH: sold(1e6) }, items, tax: 0 }, profile, loadout: virtualLoadout(profile, items, 'mining'), base: { MINING_FORTUNE: 100 }, settings: miningSettings(null), brake: 5, keepOldGear: true });
  assert.deepEqual(texts(path), ['low', 'high']);
  assert.deepEqual(path.order[1].delta, { MINING_FORTUNE: 20 });
});

test('blaze: a dagger planned once counts for the next step, limits come along', () => {
  const items = { FIREDUST_DAGGER: { category: 'SWORD', tier: 'RARE', stats: { DAMAGE: 100 } }, BURSTFIRE_DAGGER: { category: 'SWORD', tier: 'EPIC', stats: { DAMAGE: 200 } } };
  const g = { id: 'b', title: 'B', area: 'blaze', sections: [{ name: 'S', steps: [
    { text: 'one', items: [{ id: 'FIREDUST_DAGGER', qty: 1 }], detect: { kind: 'owned', on: [['FIREDUST_DAGGER']] } },
    { text: 'two', items: [{ id: 'BURSTFIRE_DAGGER', qty: 1 }], detect: { kind: 'owned', on: [['BURSTFIRE_DAGGER', 'FIREDUST_DAGGER']] } },
  ] }] };
  const profile = virtualProfile(g, new Set(), new Set(), items, 900);
  const loadout = virtualLoadout(profile, items, 'blaze');
  const base = { STRENGTH: 100, TRUE_DEFENSE: 200 };
  const path = pathOf({ guide: g, checked: new Set(), ctx: { products: { FIREDUST_DAGGER: sold(1e5), BURSTFIRE_DAGGER: sold(1e6) }, items, tax: 0 }, profile, loadout, base, settings: miningSettings(null), brake: 5, keepOldGear: true, state: blazeState(base, loadout, daggersOf(profile)) });
  assert.deepEqual(texts(path), ['one', 'two']);
  assert.equal(path.order[0].tier, 'requirement');
  assert.equal(path.limits.mp, 900);
  assert.equal(path.limits.lowTrueDefense, false);
});

test('178 steps stay under a second', () => {
  const list = Array.from({ length: 178 }, (_, i) => step(`s${i}`, `I${i % 40}`, 1 + (i % 17), i % 3 === 0 ? { line: `L${i % 12}` } : i % 11 === 0 ? { group: `G${i % 5}` } : {}));
  const products = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`I${i}`, sold(1e4 * (i + 1))]));
  const at = performance.now();
  const path = run(guideOf(list), products);
  assert.equal(path.order.length, 178);
  assert.ok(performance.now() - at < 1000);
});

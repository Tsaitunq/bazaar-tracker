import test from 'node:test';
import assert from 'node:assert/strict';
import { milestonesOf } from '../../guide/model.js';
import { validGuide, stepKey } from '../../progress.js';
import { ring, nextMilestone } from '../../guide/views/parts.js';

const section = { name: 'Path', steps: ['a', 'b', 'c', 'd', 'e'].map((text) => ({ text, items: [{ id: text.toUpperCase(), qty: 1 }] })) };
const order = section.steps.map((step) => ({ section, step, key: stepKey(section, step) }));
const sold = (price) => ({ buy_summary: [{ pricePerUnit: price, amount: 100 }] });
const products = { A: sold(1e6), B: sold(2e6), C: sold(3e6), D: sold(4e6) };
const ctx = { products, prices: {} };
const guide = { milestones: [{ name: 'First', steps: ['a', 'b'] }, { name: 'Second', steps: ['c', 'e'] }] };

test('marks sit where the last step of each milestone is in the shown order', () => {
  const ms = milestonesOf(guide, order, new Set(), ctx, products);
  assert.deepEqual(ms.marks, [{ at: 0.4, done: false }, { at: 1, done: false }]);
  assert.equal(ms.count, 2);
  assert.equal(ms.reached, 0);
});

test('the next milestone counts its open steps and what they cost; a done one is passed', () => {
  const first = milestonesOf(guide, order, new Set([order[0].key]), ctx, products);
  assert.deepEqual(first.next, { name: 'First', steps: 1, left: '2M left' });
  const second = milestonesOf(guide, order, new Set([order[0].key, order[1].key]), ctx, products);
  assert.equal(second.reached, 1);
  assert.deepEqual(second.next, { name: 'Second', steps: 2, left: '3M left + 1 unpriced' });
  assert.equal(nextMilestone(second), 'Next milestone: Second · 2 steps · 3M left + 1 unpriced');
  assert.equal(milestonesOf(guide, order, new Set(order.map((e) => e.key)), ctx, products).next, null);
  assert.equal(milestonesOf(guide, order, new Set(), ctx, null).next.left, '… left');
});

test('a guide without milestones has none', () => {
  assert.equal(milestonesOf({}, order, new Set(), ctx, products), null);
});

test('a guide file keeps milestones with known step names only', () => {
  const g = validGuide({ title: 'T', sections: [section], milestones: [{ name: 'Ok', steps: ['a', 'nope'] }, { name: 'Gone', steps: ['nope'] }, { name: '', steps: ['b'] }, 'x'] });
  assert.deepEqual(g.milestones, [{ name: 'Ok', steps: ['a'] }]);
  assert.equal(validGuide({ title: 'T', sections: [section], milestones: 'x' }).milestones, undefined);
});

test('the ring draws one dot per milestone, dark where it is passed', () => {
  const svg = ring({ chapters: [{ share: 0.5 }], total: 0.5, size: 88, marks: [{ at: 0.25, done: true }, { at: 1, done: false }] });
  assert.equal(svg.match(/class="ring-mark ring-mark-done"/g).length, 1);
  assert.equal(svg.match(/class="ring-mark"/g).length, 1);
  assert.equal(svg.match(/<circle class="arc-\d/g).length, 1);
});

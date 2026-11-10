import test from 'node:test';
import assert from 'node:assert/strict';
import { guideModel, categoryPage } from '../../apps/guide/model.js';
import { gamedata, baseOf, emptyBuild } from '../fixtures/guide-world.js';
import { miningSettings } from '../../apps/guide/optimizer.js';

const sold = (price) => ({ buy_summary: [{ pricePerUnit: price, amount: 100 }] });
const DRILL = 'TITANIUM_DRILL_4';
const items = { [DRILL]: { category: 'DRILL', tier: 'LEGENDARY', stats: { MINING_SPEED: 1600 } } };
const fortune = (text, id, extra = {}) => ({ text, gain: { MINING_FORTUNE: 8 }, items: [{ id, qty: 1 }], ...extra });
const guide = (steps, extra = {}) => ({ id: 'm', title: 'Mine', area: 'mining', groups: {}, categories: ['drill', 'armor', 'misc'], sections: [{ name: 'Main', steps }], ...extra });
const world = (over = {}) => ({ marks: new Set(), owned: [DRILL], base: baseOf({ mining: { values: { MINING_SPEED: 1000, MINING_FORTUNE: 100 } } }), build: emptyBuild(), gamedata, products: { A: sold(1e6), B: sold(1e5), C: sold(1e6) }, prices: { items }, settings: miningSettings(null), ...over });
const attr = (text, id, extra = {}) => ({ text, items: [{ id, qty: 1 }], detect: { kind: 'attr', attr: text.toLowerCase(), need: 1 }, ...extra });

const steps = [
  fortune('a-drill', 'A', { category: 'drill' }),
  fortune('b-armor', 'B', { category: 'armor' }),
  fortune('c-chip', 'C', { prereq: true, category: 'misc' }),
  attr('Elite', 'C', { category: 'misc' }),
  attr('Cheap', 'C', { prereq: true }),
];

test('a guide with categories gets tiles, prerequisites and attributes', () => {
  const m = guideModel(guide(steps), world());
  const s = m.structure;
  assert.deepEqual(s.categories.map((c) => [c.id, c.total]), [['drill', 1], ['armor', 1], ['misc', 0]]);
  assert.deepEqual(s.prereqs.map((p) => p.name), ['c-chip']); // a cheap attribute is no chip, it counts as an attribute
  assert.deepEqual([s.attributes.done, s.attributes.total], [0, 2]);
  assert.deepEqual(s.attributes.open.map((a) => a.name), ['Elite']); // the dear one stays open, with a cost
  assert.ok(s.attributes.open[0].cost);
});

test('the ring counts path steps only: no prerequisite, no attribute', () => {
  const m = guideModel(guide(steps), world({ marks: new Set(['Main|a-drill', 'Main|c-chip', 'Main|Cheap', 'Main|Elite']) }));
  assert.equal(m.total, 0.5);
  assert.equal(m.structure.started, 1);
  assert.deepEqual([m.structure.prereqs[0].done, m.structure.attributes.done], [true, 2]);
});

test('a prerequisite is off the path, and the best step comes from any category', () => {
  const m = guideModel(guide(steps), world());
  assert.ok(!m.rows.some((r) => r.name === 'c-chip'));
  assert.ok(m.card);
  const tile = m.structure.categories.find((c) => c.current);
  assert.ok(tile);
  assert.ok(m.structure.best);
});

test('a category page holds its own rows and a card for its first open step', () => {
  const m = guideModel(guide(steps), world());
  const page = categoryPage(m, 'armor');
  assert.deepEqual(page.rows.map((r) => r.name), ['b-armor']);
  assert.ok(page.rows[0].card); // card although the best step overall may be another category
  assert.equal(categoryPage(m, 'nope'), null);
});

test('a note of the guide reaches its category page', () => {
  const m = guideModel(guide(steps, { notes: { armor: 'Hot tier.' } }), world());
  assert.equal(categoryPage(m, 'armor').note, 'Hot tier.');
});

test('a step that needs another comes after it on the page', () => {
  const g = guide([fortune('late', 'A', { category: 'armor', needs: ['early'] }), fortune('early', 'B', { category: 'armor' })]);
  const page = categoryPage(guideModel(g, world()), 'armor');
  assert.deepEqual(page.rows.map((r) => r.name), ['early', 'late']);
});

test('a guide without categories keeps the old model', () => {
  const m = guideModel(guide(steps, { categories: undefined }), world());
  assert.equal(m.structure, undefined);
  assert.equal(categoryPage(m, 'armor'), null);
});

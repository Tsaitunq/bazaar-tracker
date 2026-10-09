import test from 'node:test';
import assert from 'node:assert/strict';
import { craftFlips } from '../craft.js';

const p = (buy, sell, qs) => ({
  sell_summary: buy == null ? [] : [{ pricePerUnit: buy }],
  buy_summary: sell == null ? [] : [{ pricePerUnit: sell }],
  quick_status: qs,
});
const products = {
  ING: p(10, 12, { sellMovingWeek: 16800000 }),
  OUT: p(1900, 2000, { buyMovingWeek: 168000 }),
};
const recipes = { OUT: { n: 1, i: { ING: 160 } } };
const run = (o = {}, pr = products) => craftFlips(pr, recipes, { tax: 0.0125, maxCapital: 0, sort: 'profitHour', ...o });

test('craft formulas', () => {
  const [f] = run();
  assert.equal(f.cost, 1600);
  assert.equal(f.revenue, 1975);
  assert.equal(f.profit, 375);
  assert.equal(f.margin, 0.234375);
  assert.equal(f.craftsHour, 625);
  assert.equal(f.profitHour, 234375);
  assert.deepEqual(f.ingredients, [{ id: 'ING', qty: 160, price: 10 }]);
});

test('capital cap', () => {
  const [f] = run({ maxCapital: 3200 });
  assert.equal(f.craftsHour, 2);
  assert.equal(f.profitHour, 750);
  assert.equal(run({ maxCapital: 1000 }).length, 0);
});

test('missing ingredient or empty book is skipped', () => {
  assert.equal(run({}, { OUT: products.OUT }).length, 0);
  assert.equal(run({}, { ...products, ING: p(null, 12, {}) }).length, 0);
});

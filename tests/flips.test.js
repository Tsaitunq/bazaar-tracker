import test from 'node:test';
import assert from 'node:assert/strict';
import { computeFlip, buildFlips } from '../flips.js';

const product = (buy, sell, qs = {}) => ({
  sell_summary: buy == null ? [] : [{ pricePerUnit: buy }],
  buy_summary: sell == null ? [] : [{ pricePerUnit: sell }],
  quick_status: { buyMovingWeek: 1680000, sellMovingWeek: 3360000, buyOrders: 50, sellOrders: 50, ...qs },
});
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test('profit, margin and hourly volume', () => {
  const f = computeFlip('X', product(100, 200), 0.0125, 0);
  near(f.profit, 97.5);
  near(f.margin, 0.975);
  assert.equal(f.weekVol, 1680000);
  near(f.hourVol, 10000);
  near(f.profitHour, 975000);
  assert.equal(f.suspicious, false);
});

test('capital caps units per hour', () => {
  near(computeFlip('X', product(100, 200), 0.0125, 5000).profitHour, 4875);
});

test('empty order book side is skipped', () => {
  assert.equal(computeFlip('X', product(null, 200), 0.0125, 0), null);
  assert.equal(computeFlip('X', product(100, null), 0.0125, 0), null);
  assert.equal(computeFlip('X', {}, 0.0125, 0), null);
});

test('missing quick_status gives zero volume and a warning', () => {
  const f = computeFlip('X', { sell_summary: [{ pricePerUnit: 100 }], buy_summary: [{ pricePerUnit: 200 }] }, 0.0125, 0);
  assert.equal(f.weekVol, 0);
  assert.equal(f.profitHour, 0);
  assert.equal(f.suspicious, true);
});

test('suspicious: big margin with low volume, or few orders', () => {
  const lowVol = { buyMovingWeek: 1680, sellMovingWeek: 1680 };
  assert.equal(computeFlip('X', product(100, 200, lowVol), 0.0125, 0).suspicious, true);
  assert.equal(computeFlip('X', product(100, 110, lowVol), 0.0125, 0).suspicious, false);
  assert.equal(computeFlip('X', product(100, 110, { buyOrders: 2 }), 0.0125, 0).suspicious, true);
  assert.equal(computeFlip('X', product(100, 110, { sellOrders: 2 }), 0.0125, 0).suspicious, true);
});

test('margin above 200 % is suspicious even with high volume', () => {
  assert.equal(computeFlip('X', product(100, 400), 0.0125, 0).suspicious, true);
});

test('market share scales volume before the capital cap', () => {
  near(computeFlip('X', product(100, 200), 0.0125, 0, 0.05).profitHour, 48750);
  near(computeFlip('X', product(100, 200), 0.0125, 5000, 0.05).profitHour, 4875);
});

test('favourites bypass all filters', () => {
  const products = { LOSS: product(100, 100), THIN: product(100, 200, { buyMovingWeek: 10 }), OK: product(100, 200) };
  const opts = { tax: 0.0125, minVolume: 1000, maxCapital: 50, sort: 'profit', favs: new Set(['LOSS', 'THIN']) };
  assert.deepEqual(buildFlips(products, opts).map((f) => f.id).sort(), ['LOSS', 'THIN']);
});

test('buildFlips filters and sorts descending', () => {
  const products = {
    LOSS: product(100, 100),
    THIN: product(100, 200, { buyMovingWeek: 10 }),
    PRICEY: product(9000, 20000),
    SMALL: product(100, 110),
    BIG: product(100, 200),
  };
  const opts = { tax: 0.0125, minVolume: 1000, maxCapital: 5000, sort: 'profit' };
  assert.deepEqual(buildFlips(products, opts).map((f) => f.id), ['BIG', 'SMALL']);
  assert.deepEqual(buildFlips(products, { ...opts, maxCapital: 0 }).map((f) => f.id), ['PRICEY', 'BIG', 'SMALL']);
  assert.deepEqual(buildFlips(products, { ...opts, maxCapital: 0, sort: 'margin' }).map((f) => f.id), ['PRICEY', 'BIG', 'SMALL']);
  assert.deepEqual(buildFlips(products, { ...opts, maxCapital: 0, sort: 'profitHour' })[0].id, 'PRICEY');
});

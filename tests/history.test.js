import test from 'node:test';
import assert from 'node:assert/strict';
import { bookPrices } from '../flips.js';
import {
  shardOf, dayKey, dayKeys, compactPrices, appendSnapshot, seriesFor, marginSeries, stabilityScore,
} from '../history.js';

test('shardOf sums char codes modulo 16', () => {
  assert.equal(shardOf('A'), 1);
  assert.equal(shardOf('AB'), 3);
  const s = shardOf('INK_SACK:4');
  assert.ok(Number.isInteger(s) && s >= 0 && s <= 15);
});

test('dayKey and dayKeys use UTC', () => {
  assert.equal(dayKey(Date.UTC(2026, 9, 9, 23, 59)), '2026-10-09');
  assert.deepEqual(dayKeys(Date.UTC(2026, 9, 9), 3), ['2026-10-07', '2026-10-08', '2026-10-09']);
  assert.deepEqual(dayKeys(Date.UTC(2026, 9, 1), 2), ['2026-09-30', '2026-10-01']);
});

test('bookPrices returns null when a side is missing', () => {
  assert.equal(bookPrices({}), null);
  assert.deepEqual(bookPrices({ sell_summary: [{ pricePerUnit: 1 }], buy_summary: [{ pricePerUnit: 2 }] }), { buy: 1, sell: 2 });
});

test('compactPrices rounds to 1 decimal and drops incomplete products', () => {
  const out = compactPrices({
    A: { sell_summary: [{ pricePerUnit: 1.26 }], buy_summary: [{ pricePerUnit: 2.04 }] },
    B: { sell_summary: [], buy_summary: [{ pricePerUnit: 1 }] },
  });
  assert.deepEqual(out, { A: [1.3, 2] });
});

test('appendSnapshot builds, pads and ignores old timestamps', () => {
  const c1 = appendSnapshot(null, 100, { A: [1, 2] });
  assert.deepEqual(c1, { t: [100], p: { A: [[1], [2]] } });
  const c2 = appendSnapshot(c1, 120, { B: [3, 4] });
  assert.deepEqual(c2, { t: [100, 120], p: { A: [[1, null], [2, null]], B: [[null, 3], [null, 4]] } });
  assert.deepEqual(appendSnapshot(c2, 120, { A: [9, 9] }), c2);
});

test('seriesFor merges chunks ascending, skips null chunks and gaps', () => {
  const c1 = appendSnapshot(appendSnapshot(null, 100, { A: [1, 2] }), 120, { B: [3, 4] });
  assert.deepEqual(seriesFor([c1, null], 'A'), [[100, 1, 2]]);
  assert.deepEqual(seriesFor([c1], 'nope'), []);
  const later = appendSnapshot(null, 200, { A: [5, 6] });
  assert.deepEqual(seriesFor([later, c1], 'A'), [[100, 1, 2], [200, 5, 6]]);
});

test('marginSeries', () => {
  assert.deepEqual(marginSeries([[1, 100, 200]], 0.0125), [[1, 0.975]]);
});

test('stabilityScore', () => {
  const pts = (n, f) => Array.from({ length: n }, (_, i) => [i, ...f(i)]);
  assert.equal(stabilityScore(pts(12, () => [100, 200])), 100);
  assert.equal(stabilityScore(pts(12, () => [100, 100])), 0);
  assert.equal(stabilityScore(pts(12, (i) => (i % 2 ? [100, 100] : [100, 200]))), 33);
  assert.equal(stabilityScore(pts(11, () => [100, 200])), null);
});

test('median', async () => {
  const { median } = await import('../history.js');
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([]), null);
});

test('itemStats gives score, median sell price and hours of history', async () => {
  const { itemStats } = await import('../history.js');
  // 13 points, 20 minutes apart: 4 hours
  const points = Array.from({ length: 13 }, (_, i) => [1000 + i * 20, 100, i === 12 ? 500 : 200]);
  const [score, med, hours] = itemStats(points);
  assert.equal(typeof score, 'number');
  assert.equal(med, 200);
  assert.equal(hours, 4);
  assert.deepEqual(itemStats([[1000, 100, 123.44]]), [null, 123.4, 0]);
});

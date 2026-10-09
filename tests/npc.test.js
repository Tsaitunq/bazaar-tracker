import test from 'node:test';
import assert from 'node:assert/strict';
import { npcFlips } from '../npc.js';

const product = (buy, sell, qs = {}) => ({
  sell_summary: [{ pricePerUnit: buy }], buy_summary: [{ pricePerUnit: sell }],
  quick_status: { sellMovingWeek: 1680000, ...qs },
});
const run = (npc, o = {}, p = product(100, 120)) =>
  npcFlips({ X: p }, { X: npc }, { minVolume: 0, maxCapital: 0, sort: 'profitHour', ...o });

test('npc profit, margin, volume', () => {
  const [f] = run(150);
  assert.equal(f.profit, 50);
  assert.equal(f.profitInstant, 30);
  assert.equal(f.margin, 0.5);
  assert.equal(f.hourVol, 10000);
  assert.equal(f.score, null);
});

test('share and capital cap', () => {
  assert.equal(run(150, { share: 0.05 })[0].profitHour, 25000);
  assert.equal(run(150, { share: 0.05, maxCapital: 5000 })[0].profitHour, 2500);
});

test('filters', () => {
  assert.equal(run(90).length, 0);
  assert.equal(run(undefined).length, 0);
  assert.equal(run(150, { minVolume: 2000000 }).length, 0);
  assert.equal(run(150, { maxCapital: 50 }).length, 0);
});

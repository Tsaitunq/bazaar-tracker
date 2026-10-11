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

// Craft steps before the NPC. buy_summary = sell offers (cheapest first): what an instant buyer pays.
test('npc craft step: 160 of the item into the higher step pays more per sale than the single items', async () => {
  const { npcFlips: flips, npcStep, NPC_DAY_LIMIT } = await import('../npc.js');
  const liquid = { sellMovingWeek: 168000000, buyMovingWeek: 168000000 };
  const products = {
    RAW: { sell_summary: [{ amount: 9e6, pricePerUnit: 3, orders: 1 }], buy_summary: [{ amount: 100000, pricePerUnit: 4, orders: 1 }, { amount: 9e6, pricePerUnit: 6, orders: 1 }], quick_status: liquid },
  };
  // the NPC pays 7 for one and 1,440 for the step that takes 160 of them (the wiki's Obsidian figures)
  const npc = { RAW: 7, ENCH: 1440 };
  const recipes = { ENCH: { n: 1, i: { RAW: 160 } } };
  const opts = { minVolume: 0, maxCapital: 0, share: 1, sort: 'profitHour', recipes, runs: 16 };
  // 2,560 items, all within the first level: 4 each at once
  const step = npcStep('RAW', products, npc, recipes, { runs: 16 });
  assert.equal(step.id, 'ENCH');
  assert.equal(step.basis, 'insta');
  assert.equal(step.cost, 2560 * 4);
  assert.equal(step.profit, 16 * 1440 - 2560 * 4);       // 12,800
  assert.equal(step.direct.profit, 2560 * 7 - 2560 * 4); // 7,680
  assert.equal(step.profitSale, 12800 / 16);             // per crafted item: 800
  assert.ok(step.profitCoin > step.direct.profitCoin);
  const [f] = flips(products, npc, opts);
  assert.equal(f.step.id, 'ENCH');
  // without recipes the list is the old one
  assert.equal(flips(products, npc, { ...opts, recipes: null })[0].step, undefined);
  // the book is deep enough only on dearer levels: 2,560 items cost 100,000 × 4 and the rest at 6
  const thin = { RAW: { ...products.RAW, buy_summary: [{ amount: 100, pricePerUnit: 4, orders: 1 }, { amount: 9e6, pricePerUnit: 6, orders: 1 }] } };
  assert.equal(npcStep('RAW', thin, npc, recipes, { runs: 16 }).cost, 100 * 4 + 2460 * 6);
  // a book that cannot fill the pass gives no instant price; the buy order of the flip is used instead
  const empty = { RAW: { ...products.RAW, buy_summary: [{ amount: 10, pricePerUnit: 4, orders: 1 }] } };
  assert.equal(npcStep('RAW', empty, npc, recipes, { runs: 16 }), null);
  assert.equal(flips(empty, npc, opts)[0].step.basis, 'order');
  // no step when the crafted result is worth no more than the single items
  assert.equal(npcStep('RAW', products, { RAW: 9, ENCH: 1440 }, recipes, { runs: 16 }), null);
  // what an NPC pays out in a day caps the hourly volume
  const rich = { RAW: { ...products.RAW, quick_status: { sellMovingWeek: 1e15, buyMovingWeek: 1e15 } } };
  const [g] = flips(rich, { RAW: 7 }, { ...opts, recipes: null });
  assert.ok(Math.abs(g.profitHour - (NPC_DAY_LIMIT / 24 / 7) * (7 - 3)) < 1e-3);
});

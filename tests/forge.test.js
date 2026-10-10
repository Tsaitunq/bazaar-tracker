import test from 'node:test';
import assert from 'node:assert/strict';
import { forgeFlips, forgeFlip, ahNet, ahListFee } from '../forge.js';

const p = (buy, sell, buyMovingWeek = 168_000_000) => ({
  sell_summary: buy == null ? [] : [{ pricePerUnit: buy }],
  buy_summary: sell == null ? [] : [{ pricePerUnit: sell }],
  quick_status: { buyMovingWeek },
});
const products = { PLATE: p(1000, 1100), GEM: p(10, 12), REFINED: p(4000, 5000) };
const recipes = {
  REFINED: { n: 1, d: 7200, h: 2, i: { GEM: 160 } },                       // bazaar result
  DRILL: { n: 1, d: 14400, h: 4, c: 50000, i: { PLATE: 3, GEM: 100 } },     // auction house result
  LANTERN: { n: 2, d: 3600, h: 7, i: { PLATE: 1 } },
};
const ah = { DRILL: 2_000_000, LANTERN: 900 };
const run = (o = {}, r = recipes, pr = products) => forgeFlips(pr, r, ah, { tax: 0.0125, maxCapital: 0, sort: 'profitHour', ...o });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test('auction house fees follow the price brackets', () => {
  assert.deepEqual([ahListFee(9_999_999), ahListFee(10_000_000), ahListFee(100_000_000), ahListFee(100_000_001)], [0.01, 0.02, 0.02, 0.025]);
  near(ahNet(500_000), 495_000);                 // 1 % listing, nothing to pay on collecting
  near(ahNet(2_000_000), 1_960_000);             // 1 % listing + 1 % collecting
  near(ahNet(1_005_000), 1_005_000 - 10_050 - 5_000); // the collecting tax stops at 1M
  near(ahNet(20_000_000), 20_000_000 * 0.97);
  near(ahNet(200_000_000), 200_000_000 * 0.965);
});

test('while Derpy is mayor the tax on collecting is four times as high, the listing fee is not', () => {
  near(ahNet(2_000_000, true), 2_000_000 * (1 - 0.01 - 0.04));
  near(ahNet(20_000_000, true), 20_000_000 * (1 - 0.02 - 0.04));
  near(ahNet(500_000, true), 495_000);                        // still nothing to pay below 1M
  near(ahNet(1_005_000, true), 1_005_000 - 10_050 - 5_000);   // and still never below 1M
  const normal = run().find((x) => x.id === 'DRILL');
  const derpy = run({ derpy: true }).find((x) => x.id === 'DRILL');
  near(normal.revenue - derpy.revenue, 60_000);
  assert.deepEqual([normal.derpy, derpy.derpy], [false, true]);
  // a sale below 1M pays no tax on collecting, so there is nothing to mark
  assert.equal(run({ derpy: true }).find((x) => x.id === 'LANTERN').derpy, false);
  // bazaar results are not touched and not marked
  const refined = run({ derpy: true }).find((x) => x.id === 'REFINED');
  near(refined.revenue, 4937.5);
  assert.equal(refined.derpy, false);
});

test('a bazaar result sells at the sell offer minus bazaar tax', () => {
  const f = run().find((x) => x.id === 'REFINED');
  assert.equal(f.cost, 1600);
  near(f.revenue, 4937.5);
  near(f.profit, 3337.5);
  near(f.margin, 3337.5 / 1600);
  near(f.profitHour, 3337.5 / 2);
  assert.deepEqual([f.seconds, f.hotm, f.ah, f.coins, f.limit], [7200, 2, false, 0, 'forge']);
  assert.deepEqual(f.ingredients, [{ id: 'GEM', qty: 160, price: 10 }]);
});

test('profit per hour is capped by what can be sold: market share of the hourly volume', () => {
  // a 30 second recipe: one slot makes 120 items an hour
  const quick = { REFINED: { n: 1, d: 30, h: 2, i: { GEM: 160 } } };
  const slow = { ...products, REFINED: p(4000, 5000, 168 * 200) };  // 200 are bought per hour
  const free = run({}, quick).find((x) => x.id === 'REFINED');
  near(free.profitHour, 120 * 3337.5);
  assert.equal(free.limit, 'forge');
  const capped = run({ share: 0.05 }, quick, slow).find((x) => x.id === 'REFINED');
  near(capped.profitHour, 10 * 3337.5);                               // 5 % of 200
  assert.equal(capped.limit, 'sales');
  // a market share large enough leaves the forge as the limit
  assert.equal(run({ share: 1 }, quick, slow).find((x) => x.id === 'REFINED').limit, 'forge');
  // nothing is bought: no profit per hour, but the recipe stays visible
  const dead = run({}, quick, { ...products, REFINED: p(4000, 5000, 0) }).find((x) => x.id === 'REFINED');
  assert.deepEqual([dead.profitHour, dead.limit], [0, 'sales']);
});

test('an auction house result sells at the lowest BIN minus fees; coins count as cost', () => {
  const f = run({ share: 0.05 }).find((x) => x.id === 'DRILL');
  assert.equal(f.cost, 50000 + 3000 + 1000);
  near(f.revenue, 1_960_000);
  near(f.profit, 1_906_000);
  // no volume is known for the auction house, so only the forge time limits it
  near(f.profitHour, 1_906_000 / 4);
  assert.deepEqual([f.ah, f.limit, f.sell], [true, 'forge', 2_000_000]);
  assert.ok(!('provisional' in f));
});

test('profit is per item, profit per hour is per forge run', () => {
  const f = run().find((x) => x.id === 'LANTERN');
  near(f.revenue, 2 * 900 * 0.99);
  near(f.profit, (1782 - 1000) / 2);
  near(f.profitHour, 782);
});

test('filters: HotM tier, bazaar only, capital, losses, missing prices', () => {
  const ids = (o, r, pr) => run(o, r, pr).map((f) => f.id).sort();
  assert.deepEqual(ids(), ['DRILL', 'LANTERN', 'REFINED']);
  assert.deepEqual(ids({ hotm: 4 }), ['DRILL', 'REFINED']);
  assert.deepEqual(ids({ hotm: 0 }), []);
  assert.deepEqual(ids({ forgeAh: false }), ['REFINED']);
  assert.deepEqual(ids({ maxCapital: 1600 }), ['LANTERN', 'REFINED']);
  // no lowest BIN known, a loss, an ingredient without orders
  assert.deepEqual(forgeFlips(products, recipes, {}, { tax: 0.0125, maxCapital: 0, sort: 'profit' }).map((f) => f.id), ['REFINED']);
  assert.deepEqual(ids({}, { REFINED: { n: 1, d: 60, h: 0, i: { GEM: 1000 } } }), []);
  assert.deepEqual(ids({}, recipes, { ...products, GEM: p(null, 12) }), ['LANTERN']);
});

test('forgeFlip describes one recipe even when it loses money or is filtered out of the tab', () => {
  const loss = forgeFlip('REFINED', { n: 1, d: 60, h: 9, i: { GEM: 1000 } }, products, ah, { tax: 0.0125 });
  assert.ok(loss.profit < 0);
  assert.deepEqual([loss.hotm, loss.seconds, loss.ah], [9, 60, false]);
  assert.equal(forgeFlip('DRILL', recipes.DRILL, products, {}, { tax: 0.0125 }), null);
  assert.equal(forgeFlip('DRILL', recipes.DRILL, { GEM: products.GEM }, ah, { tax: 0.0125 }), null);
});

test('sorted by the chosen key, stats attached to bazaar results', () => {
  assert.deepEqual(run({ sort: 'profitHour' }).map((f) => f.id), ['DRILL', 'REFINED', 'LANTERN']);
  const f = run({ stats: { REFINED: [88, 5000, 48] } }).find((x) => x.id === 'REFINED');
  assert.deepEqual([f.score, f.median, f.provisional], [88, 5000, false]);
});

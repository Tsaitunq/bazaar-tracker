import test from 'node:test';
import assert from 'node:assert/strict';
import { craftFlips, craftHints } from '../craft.js';

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

// A plan flip of ING: 100 units an hour at a stake of 1000 coins, earning 185 an hour.
const liquid = { sellMovingWeek: 16800000, buyMovingWeek: 16800000, buyOrders: 50, sellOrders: 50 };
const market = {
  ING: p(10, 12, liquid),
  OTHER: p(5, 6, liquid),
  OUT: p(1900, 2000, liquid),
};
const planFlip = { id: 'ING', stake: 32000, profitHour: 185 };
const hints = (recipe, o = {}, pr = market, flip = planFlip) => craftHints([flip], pr, { OUT: recipe }, { tax: 0.0125, share: 1, ...o });

test('craftHints: a craft that beats the flip with the same coins, with what it adds and the orders it takes', () => {
  // one craft costs 1600 and earns 375; the stake of 32000 buys 20 crafts an hour
  assert.deepEqual(hints({ n: 1, i: { ING: 160 } }), { ING: { id: 'OUT', extra: 20 * 375 - 185, orders: 2 } });
  // two ingredients: one buy order each plus the sell offer
  const two = hints({ n: 1, i: { ING: 100, OTHER: 100 } });
  assert.equal(two.ING.orders, 3);
  assert.equal(two.ING.extra, Math.floor(32000 / 1500) * (1975 - 1500) - 185);
});

test('craftHints: no hint when the flip earns more, the stake is too small or the item is no ingredient', () => {
  assert.deepEqual(hints({ n: 1, i: { ING: 160 } }, {}, market, { ...planFlip, profitHour: 20 * 375 }), {});
  assert.deepEqual(hints({ n: 1, i: { ING: 160 } }, {}, market, { ...planFlip, stake: 1599 }), {});
  assert.deepEqual(hints({ n: 1, i: { OTHER: 160 } }), {});
});

test('craftHints: the volume of the ingredients and of the result caps the craft, and so does the market share', () => {
  // the result is bought 168 times a week: one craft an hour
  const slowOut = { ...market, OUT: p(1900, 2000, { ...liquid, buyMovingWeek: 168 }) };
  assert.equal(hints({ n: 1, i: { ING: 160 } }, {}, slowOut).ING.extra, 375 - 185);
  // the ingredient is sold 160 × 168 × 2 times a week: two crafts an hour
  const slowIng = { ...market, ING: p(10, 12, { ...liquid, sellMovingWeek: 160 * 168 * 2 }) };
  assert.equal(hints({ n: 1, i: { ING: 160 } }, {}, slowIng).ING.extra, 2 * 375 - 185);
  assert.equal(hints({ n: 1, i: { ING: 160 } }, { share: 0.5 }, slowIng).ING.extra, 375 - 185);
});

test('craftHints: a result with suspicious prices gives no hint, and the best craft wins', () => {
  const thin = { ...market, OUT: p(1900, 2000, { ...liquid, sellOrders: 2 }) };
  assert.deepEqual(hints({ n: 1, i: { ING: 160 } }, {}, thin), {});
  const spiked = hints({ n: 1, i: { ING: 160 } }, { stats: { OUT: [90, 1000, 100] } });
  assert.deepEqual(spiked, {});
  const best = craftHints([planFlip], { ...market, BETTER: p(1900, 2100, liquid) },
    { OUT: { n: 1, i: { ING: 160 } }, BETTER: { n: 1, i: { ING: 160 } } }, { tax: 0.0125, share: 1 });
  assert.equal(best.ING.id, 'BETTER');
});

test('an opportunity card carries the same hint and opens the end product in the Craft tab', async () => {
  const { flipCard } = await import('../render.js');
  // an opportunity as the list holds it: stake = units × buy
  const opp = { id: 'ING', profitHour: 185, units: 3200, buy: 10 };
  const crafts = craftHints([{ id: opp.id, profitHour: opp.profitHour, stake: opp.units * opp.buy }], market, { OUT: { n: 1, i: { ING: 160 } } }, { tax: 0.0125, share: 1 });
  assert.deepEqual(crafts.ING, { id: 'OUT', extra: 20 * 375 - 185, orders: 2 });
  const html = flipCard({ ...opp, name: 'Ingredient', sell: 12, profit: 1, margin: 0.1, weekVol: 5, craft: { ...crafts.ING, name: 'Output' } }, false);
  assert.match(html, /Craft into Output: \+7,315\/h · uses 2 orders · recipe must be unlocked/);
  assert.match(html, /data-craft="OUT" data-name="Output"/);
  // no hint, no extra line
  assert.ok(!flipCard({ ...opp, name: 'Ingredient', sell: 12, profit: 1, margin: 0.1, weekVol: 5 }, false).includes('data-craft'));
});

// Craft modes. buy_summary are the offers (cheapest first, what an instant buyer pays), sell_summary the buy
// orders (highest first, what an instant seller gets); the names read backwards, see craft.js.
const deep = {
  ING: { sell_summary: [{ amount: 9999, pricePerUnit: 9, orders: 1 }], buy_summary: [{ amount: 200, pricePerUnit: 10, orders: 1 }, { amount: 100000, pricePerUnit: 14, orders: 1 }], quick_status: liquid },
  OUT: { sell_summary: [{ amount: 5, pricePerUnit: 2000, orders: 1 }, { amount: 1000, pricePerUnit: 1500, orders: 1 }], buy_summary: [{ amount: 10, pricePerUnit: 2200, orders: 1 }], quick_status: liquid },
};
const rec = { OUT: { n: 1, i: { ING: 160 } } };
const mode = (m, runs) => craftFlips(deep, rec, { tax: 0.0125, maxCapital: 0, sort: 'profitHour', mode: m, runs });

test('craft modes: the same recipe at the top of the book, and what the depth does to it', () => {
  // top of the book, one craft: order buys at 9, sells at the offer 2200; insta buys at 10
  const [oo] = mode(0, 1);
  assert.equal(oo.cost, 160 * 9);
  assert.equal(oo.revenue, 2200 * 0.9875);
  assert.equal(oo.orders, 2);
  const [io] = mode(1, 1);
  assert.equal(io.cost, 1600);
  assert.equal(io.orders, 1);
  const [ii] = mode(2, 1);
  assert.equal(ii.revenue, 2000 * 0.9875);
  assert.equal(ii.profit, 375);
  assert.equal(ii.orders, 0);
  assert.equal(ii.capital, 1600);
  assert.equal(ii.profitItem, 375);
  // five crafts: 800 ingredients go 200 at 10 and 600 at 14 (13 on average), and 5 results take the 2000 order
  const [io5] = mode(1, 5);
  assert.equal(io5.cost, (200 * 10 + 600 * 14) / 5);
  assert.equal(io5.capital, 200 * 10 + 600 * 14);
  // insta-sell of ten results goes through the 2000 and 1500 levels; with the dearer ingredients it loses
  assert.deepEqual(mode(2, 5), []);
  // a pass the book cannot fill has no price
  assert.deepEqual(mode(1, 100000), []);
  // orders do not look at the depth
  assert.equal(mode(0, 5)[0].cost, 160 * 9);
});

test('craft filters: suspicious prices and too little volume hide a craft, without them nothing is filtered', () => {
  const run = (o) => craftFlips(deep, rec, { tax: 0.0125, maxCapital: 0, sort: 'profitHour', mode: 2, runs: 1, ...o });
  assert.equal(run({}).length, 1);
  assert.equal(run({ minVolume: 1e9 }).length, 0);
  assert.equal(run({ minVolume: 1000 }).length, 1);
  const thin = { ...deep, ING: { ...deep.ING, quick_status: { ...liquid, buyOrders: 1 } } };
  assert.equal(craftFlips(thin, rec, { tax: 0.0125, maxCapital: 0, sort: 'profitHour', mode: 2, runs: 1, noSuspicious: true }).length, 0);
  assert.equal(craftFlips(thin, rec, { tax: 0.0125, maxCapital: 0, sort: 'profitHour', mode: 2, runs: 1 }).length, 1);
});

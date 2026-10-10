import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { searchFlip, flipIssues, oppIssues, portfolio, opportunities, computeFlip, buildFlips, bookPrices, statOf, MEDIAN_SPIKE, PROVISIONAL_HOURS, STABLE } from '../flips.js';

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

test('scores and sort by score, missing last', () => {
  const products = { A: product(100, 200), BIG: product(100, 200), C: product(100, 200) };
  const r = buildFlips(products, { tax: 0.0125, minVolume: 0, maxCapital: 0, sort: 'score', stats: { BIG: [80, 150, 48], C: [10, 150, 48] } });
  assert.deepEqual(r.map((f) => f.id), ['BIG', 'C', 'A']);
  assert.equal(r[0].score, 80);
  assert.equal(r[2].score, null);
});

test('opportunities need every condition', () => {
  // same market as AlertLogicTest.opportunitiesNeedEveryCondition
  const products = {
    GOOD: product(100, 120),
    BEST: product(1000, 1300),
    LOW_MARGIN: product(100, 105),
    UNSTABLE: product(100, 120),
    NO_SCORE: product(100, 120),
    SUSPICIOUS: product(100, 400),
    THIN: product(100, 120, { buyMovingWeek: 50000, sellMovingWeek: 50000 }),
    PRICEY: product(9000, 12000),
  };
  // [score, median sell, hours]; the median equals the current sell price so the spike rule stays quiet
  const stats = Object.fromEntries(Object.entries(products).map(([id, p]) => [id, [90, p.buy_summary[0].pricePerUnit, 48]]));
  stats.UNSTABLE[0] = 69;
  delete stats.NO_SCORE;
  const opts = { tax: 0.0125, maxCapital: 5000, share: 1, sort: 'profitHour', stats, minMargin: 0.1, minVolume: 100000, minProfitHour: 900 };
  const ids = (o) => opportunities(products, o).map((f) => f.id);

  assert.deepEqual(ids(opts), ['BEST', 'GOOD']);
  // the profit per hour floor applies after the capital cap: GOOD makes 50 x 18.5 = 925
  assert.deepEqual(ids({ ...opts, minProfitHour: 926 }), ['BEST']);
  assert.deepEqual(ids({ ...opts, stats: {} }), []);
  assert.deepEqual(ids({ ...opts, stats: null }), []);
  // exactly at the stable threshold counts; no capital limit lets the pricey one in
  assert.deepEqual(ids({ ...opts, maxCapital: 0, stats: { ...stats, UNSTABLE: [70, 120, 48] } }).sort(), ['BEST', 'GOOD', 'PRICEY', 'UNSTABLE']);
  assert.equal(opportunities(products, opts)[0].score, 90);
});

test('constants match AlertLogic.java', () => {
  assert.deepEqual([MEDIAN_SPIKE, PROVISIONAL_HOURS, STABLE], [0.3, 24, 70]);
});

test('the price is the top order, however small it is', () => {
  const p = {
    sell_summary: [{ amount: 1, pricePerUnit: 100 }, { amount: 5000, pricePerUnit: 90 }],
    buy_summary: [{ amount: 1, pricePerUnit: 110 }, { amount: 5000, pricePerUnit: 120 }],
  };
  assert.deepEqual(bookPrices(p), { buy: 100, sell: 110 });
  assert.equal(bookPrices({ sell_summary: [], buy_summary: [{ amount: 1, pricePerUnit: 5 }] }), null);
  assert.equal(bookPrices({}), null);
});

// Real order books, saved from the live API. Guards against any price rule that looks deeper into
// the book: that can only raise the margin above what a flipper at the top of the book gets.
test('for real order books the margin never exceeds the top-of-book margin', () => {
  const products = JSON.parse(fs.readFileSync('tests/fixtures/bazaar-sample.json', 'utf8'));
  assert.ok(Object.keys(products).length >= 20);
  let withSmallTopOrder = 0;
  for (const [id, p] of Object.entries(products)) {
    const top = { buy: p.sell_summary[0].pricePerUnit, sell: p.buy_summary[0].pricePerUnit };
    const topMargin = (top.sell * (1 - 0.0125) - top.buy) / top.buy;
    const flip = computeFlip(id, p, 0.0125, 0);
    assert.deepEqual({ buy: flip.buy, sell: flip.sell }, top, id);
    assert.ok(flip.margin <= topMargin + 1e-12, `${id}: ${flip.margin} > ${topMargin}`);
    if (p.sell_summary[0].amount < 64 || p.buy_summary[0].amount < 64) withSmallTopOrder++;
  }
  // the sample must contain the case the rule is about
  assert.ok(withSmallTopOrder >= 5, `only ${withSmallTopOrder} products with a small top order`);
});

test('a sell price more than 30 % above its median is suspicious', () => {
  const flip = (sell, median) => computeFlip('X', product(100, sell), 0.0125, 0, 1, median);
  assert.equal(flip(131, 100).suspicious, true);
  assert.equal(flip(130, 100).suspicious, false);
  assert.equal(flip(131, null).suspicious, false);
  assert.equal(flip(131, 0).suspicious, false);
  assert.equal(flip(131).suspicious, false);
});

test('statOf: provisional below 24 hours of history', () => {
  assert.deepEqual(statOf({ X: [82, 150, 23.9] }, 'X'), { score: null, median: 150, provisional: true });
  assert.deepEqual(statOf({ X: [82, 150, 24] }, 'X'), { score: 82, median: 150, provisional: false });
  assert.deepEqual(statOf({ X: [null, 150, 30] }, 'X'), { score: null, median: 150, provisional: false });
  // not in the loaded stats: no history yet
  assert.deepEqual(statOf({}, 'X'), { score: null, median: null, provisional: true });
  // stats not loaded at all: unknown, so no badge
  assert.deepEqual(statOf(null, 'X'), { score: null, median: null, provisional: false });
});

test('flips carry score, median and provisional; opportunities skip provisional and spiking items', () => {
  const products = { OLD: product(100, 120), NEW: product(100, 120), SPIKE: product(100, 120), NONE: product(100, 120) };
  const stats = { OLD: [90, 118, 48], NEW: [90, 118, 5], SPIKE: [90, 90, 48] };
  const opts = { tax: 0.0125, minVolume: 0, maxCapital: 0, share: 1, sort: 'profitHour', stats, minMargin: 0.1, minProfitHour: 0 };
  const byId = Object.fromEntries(buildFlips(products, opts).map((f) => [f.id, f]));
  assert.deepEqual([byId.OLD.score, byId.OLD.median, byId.OLD.provisional, byId.OLD.suspicious], [90, 118, false, false]);
  assert.deepEqual([byId.NEW.score, byId.NEW.provisional], [null, true]);
  assert.equal(byId.SPIKE.suspicious, true);
  assert.equal(byId.NONE.provisional, true);
  assert.deepEqual(opportunities(products, opts).map((f) => f.id), ['OLD']);
});

// 10,000 of each trade per hour, so at a market share of 1 the volume takes 10,000 × the buy price
const PLAN = {
  BEST: product(12000, 15000),   // takes 120M, 23.4% return
  DEEP: product(100000, 120000), // takes 1,000M, 18.5% return
  OK: product(1000, 1200),       // takes 10M, 18.5% return
};
const planStats = (products) => Object.fromEntries(Object.entries(products).map(([id, p]) => [id, [90, p.buy_summary[0].pricePerUnit, 48]]));
const planOpts = { tax: 0.0125, share: 1, stats: planStats(PLAN), minMargin: 0.1, minVolume: 0, minProfitHour: 0, capital: 200e6, slots: 10 };
const stakes = (plan) => plan.flips.map((f) => [f.id, f.stake]);

test('portfolio fills the best return first, as far as its volume goes', () => {
  // no even split: BEST gets the 120M it trades, not 20M, and DEEP the rest; OK is not needed
  const plan = portfolio(PLAN, planOpts);
  assert.deepEqual(stakes(plan), [['BEST', 120e6], ['DEEP', 80e6]]);
  near(plan.profitHour, 10000 * 2812.5 + 800 * 18500);
  assert.deepEqual([plan.used, plan.limit], [200e6, null]);

  // provisional and suspicious items never get a stake
  const products = { ...PLAN, NEW: product(12000, 15000), SPIKE: product(12000, 15000) };
  const stats = { ...planStats(products), NEW: [90, 15000, 5], SPIKE: [90, 9000, 48] };
  assert.deepEqual(stakes(portfolio(products, { ...planOpts, stats })), stakes(plan));

  // never a flip that cannot buy a single item
  assert.deepEqual(stakes(portfolio(PLAN, { ...planOpts, capital: 5000 })), [['OK', 5000]]);
});

test('portfolio is empty without capital, slots or stats', () => {
  const opts = { ...planOpts, maxCapital: 50e6 };
  assert.equal(portfolio(PLAN, opts).flips.length, 3);
  for (const change of [{ capital: 0 }, { slots: 0 }, { stats: null }, { stats: {} }]) {
    const p = portfolio(PLAN, { ...opts, ...change });
    assert.deepEqual([p.flips.length, p.profitHour, p.used, p.limit], [0, 0, 0, null]);
  }
  // 2.9 slots count as 2
  assert.equal(portfolio(PLAN, { ...opts, slots: 2.9 }).flips.length, 2);
});

test('portfolio says what keeps capital unused', () => {
  const { BEST, OK } = PLAN;
  // everything trades as much as it can: only more market share or wider filters help
  const thin = portfolio({ BEST, OK }, planOpts);
  assert.deepEqual(stakes(thin), [['BEST', 120e6], ['OK', 10e6]]);
  assert.deepEqual([thin.used, thin.limit], [130e6, 'volume']);

  // the cap per flip stops BEST and DEEP; whole units leave 8,000 of BEST's 50M over
  const capped = portfolio(PLAN, { ...planOpts, maxCapital: 50e6 });
  assert.deepEqual(stakes(capped), [['BEST', 49992000], ['DEEP', 50e6], ['OK', 10e6]]);
  assert.equal(capped.limit, 'maxCapital');
  // an item that costs more than the cap is left out
  assert.deepEqual(stakes(portfolio(PLAN, { ...planOpts, maxCapital: 5000 })), [['OK', 5000]]);

  // slots are the most flips there can be, even with capital left for another one
  const one = portfolio({ BEST, OK }, { ...planOpts, slots: 1 });
  assert.deepEqual(stakes(one), [['BEST', 120e6]]);
  assert.equal(one.limit, 'slots');
  // two flips would use all that trades; a plan that is not short of slots has nothing to add
  assert.deepEqual(one.more, { slots: 2, used: 130e6, profitHour: thin.profitHour });
  assert.equal(thin.more, null);
  // a single slot goes to the flip that earns the most with it, not to the best return
  assert.deepEqual(stakes(portfolio(PLAN, { ...planOpts, slots: 1 })), [['DEEP', 200e6]]);
});

test('portfolio: the hint for more parallel flips stops at 50', () => {
  // 60 items that each take 1M: 10 slots use 10M, and 50 is the most the settings accept
  const products = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`I${i}`, product(100, 120)]));
  const plan = portfolio(products, { ...planOpts, stats: planStats(products) });
  assert.deepEqual([plan.flips.length, plan.used, plan.limit], [10, 10e6, 'slots']);
  assert.deepEqual([plan.more.slots, plan.more.used], [50, 50e6]);
  near(plan.more.profitHour, 50 * 10000 * 18.5);
  // already at 50: still the limit, but there is nothing to suggest
  const full = portfolio(products, { ...planOpts, stats: planStats(products), slots: 50 });
  assert.deepEqual([full.limit, full.more], ['slots', null]);
});

test('a lower margin floor lets items with more volume into the portfolio', () => {
  // WIDE has 4.8% margin and trades ten times as much as BEST
  const products = { BEST: PLAN.BEST, WIDE: product(10000, 10600, { buyMovingWeek: 16800000, sellMovingWeek: 16800000 }) };
  const opts = { ...planOpts, stats: planStats(products), capital: 1000e6 };
  assert.deepEqual(stakes(portfolio(products, { ...opts, minMargin: 0.15 })), [['BEST', 120e6]]);
  assert.deepEqual(stakes(portfolio(products, { ...opts, minMargin: 0.03 })), [['WIDE', 880e6], ['BEST', 120e6]]);
});

// Apply recomputes from the prices already loaded: every setting has to change the plan without new data
test('portfolio follows every setting on the same prices, and 0 means no cap per flip', () => {
  const opts = { ...planOpts, capital: 60e6, slots: 3, maxCapital: 20e6, share: 0.5 };
  const sum = (plan) => JSON.stringify([stakes(plan), Math.round(plan.profitHour)]);
  const base = portfolio(PLAN, opts);
  assert.deepEqual(stakes(base), [['BEST', 19992000], ['DEEP', 20e6], ['OK', 5e6]]);
  for (const change of [{ capital: 30e6 }, { slots: 2 }, { maxCapital: 0 }, { share: 1 }, { tax: 0.01 }, { minMargin: 0.2 }, { minProfitHour: 4e6 }]) {
    assert.notEqual(sum(portfolio(PLAN, { ...opts, ...change })), sum(base), JSON.stringify(change));
  }
  // without a cap BEST takes all it trades at a 50% share, which is the whole capital
  assert.deepEqual(stakes(portfolio(PLAN, { ...opts, maxCapital: 0 })), [['BEST', 60e6]]);
});

test('search keeps every item and says why it is not a flip', () => {
  const opts = { tax: 0.0125, minVolume: 1000, maxCapital: 5000, share: 1, stats: null };
  const why = (p, o = opts, issues = flipIssues) => searchFlip('X', p, o, issues).why;
  assert.deepEqual(why(product(100, 200)), []);
  assert.deepEqual(why(product(100, 100)), ['Margin is 0 or below']);
  assert.deepEqual(why(product(100, 200, { buyMovingWeek: 10 })), ['Volume too low']);
  assert.deepEqual(why(product(9000, 12000)), ['Above your max capital']);
  assert.deepEqual(why(product(9000, 9000, { buyMovingWeek: 10 })), ['Margin is 0 or below', 'Volume too low', 'Above your max capital']);
  // no orders on one side: no flip, but still an entry that leads to the detail page
  assert.deepEqual(searchFlip('X', product(100, null), opts, flipIssues), { id: 'X', why: ['No buy orders or sell offers right now'] });
  assert.equal(searchFlip('X', product(9000, 12000), opts, flipIssues).buy, 9000);

  const opp = { ...opts, minMargin: 0.1, minVolume: 100000, minProfitHour: 900 };
  const scored = (score, hours = 48) => ({ ...opp, stats: { X: [score, 120, hours] } });
  assert.deepEqual(why(product(100, 120), scored(90), oppIssues), []);
  assert.deepEqual(why(product(100, 120), scored(69), oppIssues), ['Not stable enough']);
  assert.deepEqual(why(product(100, 120), scored(90, 5), oppIssues), ['Under 24 hours of price history']);
  assert.deepEqual(why(product(100, 120), opp, oppIssues), ['No stability score yet']);
  assert.deepEqual(why(product(100, 105), { ...opp, stats: { X: [90, 105, 48] } }, oppIssues), ['Margin below your minimum', 'Profit/h below your minimum']);
  assert.deepEqual(why(product(100, 400), { ...opp, stats: { X: [90, 400, 48] } }, oppIssues), ['Suspicious prices']);
});

// The Android background check repeats this maths in AlertLogic.java. Change both together.
const HOURS_PER_WEEK = 168;
export const MEDIAN_SPIKE = 0.3;      // sell price this far above its 7 day median is suspicious
export const PROVISIONAL_HOURS = 24;  // less price history than this: no score, no opportunity
export const STABLE = 70;

// A flipper trades at the top of the book, so the price is always the best order, however small it is.
// Looking deeper into the book can only widen the spread and overstate the margin.
// API names are from the instant buyer's view: sell_summary holds buy orders, buy_summary holds sell offers.
export function bookPrices(product) {
  const buy = product.sell_summary?.[0]?.pricePerUnit;
  const sell = product.buy_summary?.[0]?.pricePerUnit;
  return buy > 0 && sell > 0 ? { buy, sell } : null;
}

// stats: { [id]: [score | null, medianSell, hoursOfHistory] } from stats.json, or null when it could not be loaded.
// An item missing from loaded stats has no history yet and is provisional too.
export function statOf(stats, id) {
  if (!stats) return { score: null, median: null, provisional: false };
  const [score, median, hours] = stats[id] ?? [null, null, 0];
  const provisional = !(hours >= PROVISIONAL_HOURS);
  return { score: provisional ? null : score ?? null, median: median ?? null, provisional };
}

export function computeFlip(id, product, tax, maxCapital, share = 1, median = null) {
  const prices = bookPrices(product);
  if (!prices) return null;
  const { buy, sell } = prices;

  const qs = product.quick_status ?? {};
  const weekVol = Math.min(qs.buyMovingWeek, qs.sellMovingWeek) || 0;
  const hourVol = weekVol / HOURS_PER_WEEK;
  // share: the part of the hourly volume one player realistically gets
  const reach = hourVol * share;
  const units = maxCapital > 0 ? Math.min(reach, Math.floor(maxCapital / buy)) : reach;
  const profit = sell * (1 - tax) - buy;
  const margin = profit / buy;

  return {
    id, buy, sell, profit, margin, weekVol, hourVol, units,
    profitHour: units * profit,
    suspicious: margin > 2 || (margin > 0.5 && hourVol < 100) || !(qs.buyOrders >= 3) || !(qs.sellOrders >= 3)
      || (median > 0 && sell > median * (1 + MEDIAN_SPIKE)),
  };
}

function flipWithStats(id, product, { tax, maxCapital, share = 1 }, stats) {
  const stat = statOf(stats, id);
  const flip = computeFlip(id, product, tax, maxCapital, share, stat.median);
  return flip && { ...flip, ...stat };
}

// descending by a[sort]; null/undefined last
export const bySort = (sort) => (a, b) => (a[sort] == null) - (b[sort] == null) || b[sort] - a[sort];

// Why a flip is not in a list, in words for the player; empty when it passes. The lists filter with
// these, so a reason shown in the search is always the real one.
export function flipIssues(f, { minVolume, maxCapital }) {
  return [
    !(f.profit > 0) && 'Margin is 0 or below',
    !(f.weekVol >= minVolume) && 'Volume too low',
    maxCapital > 0 && f.buy > maxCapital && 'Above your max capital',
  ].filter(Boolean);
}

export function oppIssues(f, { maxCapital, minMargin, minVolume, minProfitHour }) {
  return [
    f.suspicious && 'Suspicious prices',
    f.provisional ? 'Under 24 hours of price history' : !(f.score >= STABLE) && (f.score == null ? 'No stability score yet' : 'Not stable enough'),
    !(f.margin >= minMargin) && 'Margin below your minimum',
    !(f.weekVol >= minVolume) && 'Volume too low',
    !(f.profitHour >= minProfitHour) && 'Profit/h below your minimum',
    maxCapital > 0 && f.buy > maxCapital && 'Above your max capital',
  ].filter(Boolean);
}

// One item for the search, whatever the filters say: its flip plus `why` it is not in the list.
// An item without orders on both sides has no flip; it still gets an entry so its detail page can be opened.
export function searchFlip(id, product, opts, issues) {
  const f = flipWithStats(id, product, opts, opts.stats);
  return f ? { ...f, why: issues(f, opts) } : { id, why: ['No buy orders or sell offers right now'] };
}

// favs are kept even when they fail the filters
export function buildFlips(products, { tax, minVolume, maxCapital, sort, share = 1, favs = new Set(), stats = null }) {
  return Object.entries(products)
    .map(([id, p]) => flipWithStats(id, p, { tax, maxCapital, share }, stats))
    .filter((f) => f && (favs.has(f.id) || !flipIssues(f, { minVolume, maxCapital }).length))
    .sort(bySort(sort));
}

// Flips worth acting on without checking them by hand: every condition must hold.
export function opportunities(products, { tax, maxCapital, share = 1, sort, stats = null, minMargin, minVolume, minProfitHour }) {
  return Object.entries(products)
    .map(([id, p]) => flipWithStats(id, p, { tax, maxCapital, share }, stats))
    .filter((f) => f && !oppIssues(f, { maxCapital, minMargin, minVolume, minProfitHour }).length)
    .sort(bySort(sort));
}

// A plan for running several flips at once. There is no even split: the flips with the highest return per coin
// are filled first, each up to what its volume takes (hourly volume × market share), the max. capital per flip
// and the capital that is left. `slots` ("Max. flips") is the most flips the plan holds; fewer are fine.
// Uses the opportunity conditions, so suspicious and provisional items never appear, with one change: the
// weekly volume is measured in coins (opts.minTurnover, units × buy price) instead of units, so an expensive
// item that sells a few thousand times a week can take part. opts.minVolume is ignored.
// opts.maxCapital ("Max. capital per flip") caps the stake of one flip; 0 means no cap.
// limit says what keeps capital unused: 'slots', 'maxCapital' or 'volume'; null when the capital is in use.
// more: when slots are the limit and more are allowed, { slots, used, profitHour } of the plan they would give.
// The API has no sales per hour, only the week's total. A floor on the hourly average is the nearest check
// that an item sells all day: at 10 an hour, an hour without a sale is very unlikely if sales are spread out.
// shortcut: cannot tell steady sales from a few bulk trades; record the weekly volume per snapshot to do that
export const PLAN_MIN_HOUR_SALES = 10;
export const MAX_SLOTS = 21; // the bazaar allows 21 open orders, so no plan can hold more flips
export function portfolio(products, { capital, slots, ...opts }) {
  const n = Math.floor(slots);
  const cap = opts.maxCapital > 0 ? opts.maxCapital : capital;
  const share = opts.share ?? 1;
  const unitsFor = (f, coins) => Math.min(f.hourVol * share, Math.floor(coins / f.buy));
  const ranked = capital > 0 && n >= 1
    ? opportunities(products, { ...opts, minVolume: 0, maxCapital: cap, sort: 'profitHour' })
      .filter((f) => f.units >= 1 && f.weekVol * f.buy >= (opts.minTurnover ?? 0) && f.hourVol >= PLAN_MIN_HOUR_SALES)
    : [];
  // a set of flips, the best return per coin served first
  const fill = (set) => {
    const plan = { flips: [], left: capital, profitHour: 0 };
    for (const f of set.sort(bySort('margin'))) {
      const units = unitsFor(f, Math.min(cap, plan.left));
      if (!(units >= 1) || units * f.profit < (opts.minProfitHour ?? 0)) continue;
      plan.left -= units * f.buy;
      plan.profitHour += units * f.profit;
      plan.flips.push({ ...f, units, stake: units * f.buy, profitHour: units * f.profit });
    }
    return plan;
  };
  // Which n flips earn the most together? With capital to spare it is the n with the highest profit per hour,
  // big volume before big margin. When capital is short those would starve each other, and a coin is worth
  // more in a flip with a higher return. So capital gets a price: a flip counts for what it earns above that
  // price on the coins it takes. The price is narrowed down to where the chosen flips just fit the capital,
  // and the best plan seen on the way wins; it starts from price 0, so nothing does worse than that.
  // shortcut: a search over one price, not an exact optimum; whole units and the cap per flip can cost a little
  const takes = (set) => set.reduce((sum, f) => sum + f.units * f.buy, 0);
  let best = fill(ranked.slice(0, n));
  let low = 0;
  let high = takes(ranked.slice(0, n)) > capital ? Math.max(...ranked.map((f) => f.margin)) : 0;
  for (let i = 0; i < 40 && high > low; i++) {
    const price = (low + high) / 2;
    const worth = (f) => f.profitHour - price * f.units * f.buy;
    const set = [...ranked].sort((a, b) => worth(b) - worth(a)).slice(0, n);
    if (takes(set) > capital) low = price;
    else high = price;
    const plan = fill(set);
    if (plan.profitHour > best.profitHour) best = plan;
  }
  const { flips, left } = best;
  flips.sort(bySort('profitHour'));

  let limit = null;
  // whole units always leave some coins over, so under 1% counts as in use
  if (flips.length && left > capital * 0.01) {
    const fits = (f) => !flips.some((p) => p.id === f.id) && unitsFor(f, Math.min(cap, left)) >= 1;
    limit = flips.length >= n && ranked.some(fits) ? 'slots'
      : opts.maxCapital > 0 && flips.some((f) => f.hourVol * share - f.units >= 1) ? 'maxCapital' : 'volume';
  }
  // What more slots would do, worked out once with the most the bazaar allows. If fewer are enough, the
  // numbers are those of a plan with exactly that many, so the hint holds when the player sets it.
  let more = null;
  if (limit === 'slots' && n < MAX_SLOTS) {
    const plan = (slots) => portfolio(products, { capital, slots, ...opts });
    const most = plan(MAX_SLOTS);
    const { used, profitHour } = most.flips.length < MAX_SLOTS ? plan(most.flips.length) : most;
    more = { slots: most.flips.length, used, profitHour };
  }
  return {
    flips,
    limit,
    more,
    profitHour: flips.reduce((sum, f) => sum + f.profitHour, 0),
    used: flips.reduce((sum, f) => sum + f.stake, 0),
  };
}

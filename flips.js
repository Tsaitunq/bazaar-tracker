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

// A plan for running several flips at once: the total capital is split evenly over `slots` flips, and the best
// opportunities for that budget are picked. A flip that cannot use its whole share (the item does not trade
// enough, or whole units do not divide the budget) keeps the smaller stake; nothing is moved to other flips.
// Uses exactly the opportunity conditions, so suspicious and provisional items never appear.
// opts.maxCapital ("Max. capital per flip") caps the share of one flip; 0 means no cap.
export function portfolio(products, { capital, slots, ...opts }) {
  const even = capital > 0 && slots >= 1 ? capital / Math.floor(slots) : 0;
  const budget = opts.maxCapital > 0 ? Math.min(even, opts.maxCapital) : even;
  const flips = budget > 0
    ? opportunities(products, { ...opts, maxCapital: budget, sort: 'profitHour' })
      .filter((f) => f.units >= 1)
      .slice(0, Math.floor(slots))
      .map((f) => ({ ...f, stake: f.units * f.buy }))
    : [];
  return {
    flips,
    budget,
    profitHour: flips.reduce((sum, f) => sum + f.profitHour, 0),
    used: flips.reduce((sum, f) => sum + f.stake, 0),
  };
}

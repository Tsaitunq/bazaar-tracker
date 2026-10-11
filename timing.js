// Event timing: what an item's price did around past events and mayor terms, and the pattern in it.
// The snapshot run keeps three medians per run and item in timing.json; the snapshots themselves
// expire. A run is { s, e, b, a, p }: start and end, where the "before" window starts and the
// "after" window ends (all in minutes), and p[itemId] = [median before, during, after]. c[itemId] is the price
// curve: the median of each phase (phaseSpans) from two days before to three days after, by phase name.
// src is "backfill" for a run filled in afterwards from SkyCofl's price history (scripts/timing-backfill.mjs);
// a run the snapshot run recorded itself has no src and counts as "own".
import { PERK_EXPECT, PERKS, DRIVERS, expectedRole, DAY_MS, YEAR_DAYS, EVENTS, skyDate, skyTime, activePerks, upcoming, termStart } from './events.js';
import { median } from './history.js';

export const CONFIRM = 3;                // runs in the same direction before a pattern counts
export const FLAT = 0.01;                // a change below 1% has no direction
export const LEAD_MS = 3 * 3600000;      // the Android notice comes this long before an event
const WINDOW_MS = 24 * 3600000;
const TERM_NOTICE_MS = 6 * 3600000;      // a new mayor is announced for this long
const RETRY_MIN = 2 * 24 * 60;           // a window without prices is given up after two days
const YEAR_MS = YEAR_DAYS * DAY_MS;
export const BACKFILL = 'backfill';
const H = 60; // minutes in an hour: runs are in minutes
export const MIN_DURING_MS = 6 * 3600000; // an event shorter than this is measured over this long (3 points at 2 hours)

// The phases of a run, in minutes: two days and one day before, the term in days (a term and the Grand Feast are
// 124 hours, days 1 to 4 are 24 hours and day 5 the rest) or an event as one phase, then three days after.
export const TERM_PHASES = ['pre2', 'pre1', 'd1', 'd2', 'd3', 'd4', 'd5', 'a1', 'a2', 'a3'];
export const EVENT_PHASES = ['pre2', 'pre1', 'during', 'a1', 'a2', 'a3'];
export const isTerm = (run) => run.e - run.s >= 4 * 24 * H;
export function phaseSpans(run) {
  const s = run.s;
  const e = isTerm(run) ? run.e : Math.max(run.e, run.s + (MIN_DURING_MS / 60000));
  const spans = [['pre2', s - 48 * H, s - 24 * H], ['pre1', s - 24 * H, s]];
  if (isTerm(run)) {
    for (let k = 1; k <= 4; k++) spans.push([`d${k}`, s + (k - 1) * 24 * H, s + k * 24 * H]);
    spans.push(['d5', s + 96 * H, e]);
  } else spans.push(['during', s, e]);
  spans.push(['a1', e, e + 24 * H], ['a2', e + 24 * H, e + 48 * H], ['a3', e + 48 * H, e + 72 * H]);
  return spans;
}
// The medians of every phase of a run from an item's points; phases without a price are left out.
export function curveMedians(points, run) {
  const out = {};
  for (const [name, from, to] of phaseSpans(run)) {
    const m = windowMedian(points, from, to);
    if (m != null) out[name] = m;
  }
  return out;
}

// The median of the sell price (point[2]) of the points in [from, to) minutes, rounded like timing.json keeps it.
export function windowMedian(points, from, to) {
  const m = median(points.filter(([t]) => t >= from && t < to).map((p) => p[2]));
  return m == null ? null : Math.round(m * 10) / 10;
}

// The three medians of a finished run from an item's points [minute, buy, sell].
export const runMedians = (points, run) => [[run.b, run.s], [run.s, run.e], [run.e, run.a]].map(([from, to]) => windowMedian(points, from, to));

// timing without the runs that came from the backfill; a pattern that needed them is no longer confirmed
// because patterns are always computed from the runs.
export function removeBackfill(timing) {
  const r = Object.fromEntries(Object.entries(timing?.r ?? {})
    .map(([key, runs]) => [key, runs.filter((run) => run.src !== BACKFILL)]).filter(([, runs]) => runs.length));
  return { ...timing, r };
}

// timing plus the runs of a backfill file ({ r: { key: [run] } }). A run the snapshot run recorded itself, or one
// that starts at the same minute, is never replaced. Idempotent.
export function mergeBackfill(timing, backfill) {
  const r = Object.fromEntries(Object.entries(timing?.r ?? {}).map(([key, runs]) => [key, [...runs]]));
  for (const [key, runs] of Object.entries(backfill?.r ?? {})) {
    const have = new Set((r[key] ?? []).map((run) => run.s));
    for (const run of runs) {
      if (have.has(run.s)) continue;
      (r[key] ??= []).push({ ...run, src: BACKFILL });
      have.add(run.s);
    }
    r[key]?.sort((x, y) => x.s - y.s);
  }
  return { ...timing, r };
}

// Events and terms that have started and whose "after" window is still open, with times in ms.
// Windows are cut where they would reach into the neighbouring run (Fishing Festival: every month).
// opts.curve: also the runs that are only waiting for the last phase of their price curve (three days after the end)
export function started(nowMs, election, { curve = false } = {}) {
  const perks = activePerks(election);
  const { year } = skyDate(nowMs);
  const out = [];
  for (const e of EVENTS) {
    if (!e.items.length || (e.perk && !perks.some((p) => p.name === e.perk))) continue;
    const length = e.days * DAY_MS;
    const starts = [year - 2, year - 1, year, year + 1].flatMap((y) => e.starts.map(([month, day]) => skyTime(y, month, day))).sort((a, b) => a - b);
    const i = starts.findLastIndex((s) => s <= nowMs);
    const s = starts[i];
    // curve: the fishing festival comes every ten hours, so there the windows would overlap
    out.push({ key: `event:${e.key}`, s, e: s + length, b: Math.max(s - WINDOW_MS, starts[i - 1] + length), a: Math.min(s + length + WINDOW_MS, starts[i + 1]), items: e.items,
      curve: e.key !== 'fishing' });
  }
  const s = termStart(nowMs);
  // the election file lags behind the calendar: only a mayor elected for this term counts
  if (election?.mayor?.year === skyDate(s).year - 1) {
    for (const p of perks) {
      if (PERK_EXPECT[p.name]) out.push({ key: `perk:${p.name}`, s, e: s + YEAR_MS, b: s - WINDOW_MS, a: s + YEAR_MS + WINDOW_MS, items: PERK_EXPECT[p.name].items, curve: true });
    }
  }
  // the curve of a run is filled in up to three days after its end
  return out.filter((o) => nowMs < Math.max(o.a, curve && o.curve ? Math.max(o.e, o.s + MIN_DURING_MS) + 72 * 3600000 : 0));
}

// The next timing.json. series(id): the item's kept snapshots as [minute, buy, sell].
// Runs are never removed; a median is filled in once its window has passed. Changes `timing`.
export function updateTiming(timing, election, series, nowMs) {
  const now = nowMs / 60000;
  const r = timing?.r ?? {};
  for (const o of started(nowMs, election, { curve: true })) {
    r[o.key] ??= [];
    if (!r[o.key].some((run) => run.s === o.s / 60000)) {
      r[o.key].push({ s: o.s / 60000, e: o.e / 60000, b: o.b / 60000, a: o.a / 60000, p: {} });
    }
    const run = r[o.key].find((x) => x.s === o.s / 60000);
    for (const id of o.items) run.p[id] ??= [null, null, null];
    if (o.curve) run.cv = true; // marks the runs that collect a curve
  }
  for (const run of Object.values(r).flat()) {
    [[run.b, run.s], [run.s, run.e], [run.e, run.a]].forEach(([from, to], i) => {
      if (now < to || now > to + RETRY_MIN) return;
      for (const [id, v] of Object.entries(run.p)) {
        if (v[i] != null) continue;
        v[i] = windowMedian(series(id), from, to);
      }
    });
  }
  // the price curve, once its last phase is over; a run that was recorded without one is not given one afterwards
  for (const run of Object.values(r).flat()) {
    if (!run.cv || run.src === BACKFILL) continue;
    const end = phaseSpans(run).at(-1)[2];
    if (now < end || now > end + RETRY_MIN) continue;
    run.c ??= {};
    for (const id of Object.keys(run.p)) {
      if (run.c[id]) continue;
      const curve = curveMedians(series(id), run);
      if (Object.keys(curve).length) run.c[id] = curve;
    }
  }
  return { t: nowMs, r, n: notices(r, election, nowMs) };
}

// changes: one relative price change per run. pct: the typical one; dir: its direction or 0;
// n: runs that went the same way.
// sources: the src of each run, same order. Own and backfilled runs count together; nOwn and nBackfill say how many
// of the n came from which.
export function pattern(changes, sources = []) {
  const pct = median(changes);
  const dir = pct == null || Math.abs(pct) < FLAT ? 0 : Math.sign(pct);
  const same = (c) => Math.abs(c) >= FLAT && Math.sign(c) === dir;
  const n = dir ? changes.filter(same).length : 0;
  const nBackfill = dir ? changes.filter((c, i) => same(c) && sources[i] === BACKFILL).length : 0;
  return { pct, dir, n, nOwn: n - nBackfill, nBackfill, confirmed: n >= CONFIRM };
}

// into: before → during; out: during → after
export function itemPattern(runs = [], id) {
  const usable = (i) => runs.filter((run) => run.p[id]?.[i] > 0 && run.p[id][i + 1] != null);
  const of = (i) => { const rs = usable(i); return pattern(rs.map((run) => run.p[id][i + 1] / run.p[id][i] - 1), rs.map((run) => run.src)); };
  return { into: of(0), out: of(1) };
}

const signed = (x) => `${x > 0 ? '+' : '−'}${Math.round(Math.abs(x) * 1000) / 10}%`;
// when: "during event", "during term", "after event"
export const patternText = (p, when) =>
  (p.confirmed ? `Usually ${signed(p.pct)} ${when} (seen ${p.n} times${history(p)})` : `not enough data yet (${p.n}/${CONFIRM}${history(p)})`);
// where the runs came from: only the backfill, or both
const history = (p) => (p.nBackfill > 0
  ? (p.nOwn > 0 ? `, ${p.nOwn} own, ${p.nBackfill} from historical data (SkyCofl)` : ', based on historical data (SkyCofl)') : '');

// What the Android worker shows, ready-made so it needs no calendar: each notice is due between
// `from` and `to`. lines: [itemId, text]; the worker knows the item names.
function notices(r, election, nowMs) {
  const out = [];
  for (const e of upcoming(nowMs, election)) {
    if (e.active) continue;
    const lines = e.items.map((id) => [id, itemPattern(r[`event:${e.key}`], id).into])
      .filter(([, p]) => p.confirmed).map(([id, p]) => [id, patternText(p, 'during event')]);
    if (lines.length) out.push({ k: `event:${e.key}:${e.start}`, kind: 'event', from: e.start - LEAD_MS, to: e.start, title: `${e.name} starts soon`, lines });
  }
  const s = termStart(nowMs);
  if (election?.mayor?.year === skyDate(s).year - 1 && nowMs < s + TERM_NOTICE_MS) {
    const lines = activePerks(election).flatMap((perk) => (PERK_EXPECT[perk.name]?.items ?? []).map((id) => {
      const p = itemPattern(r[`perk:${perk.name}`], id).into;
      return [id, p.confirmed ? patternText(p, 'during term') : `expected cheaper: ${PERK_EXPECT[perk.name].why}`];
    }));
    if (lines.length) out.push({ k: `term:${s}`, kind: 'mayor', from: s, to: s + TERM_NOTICE_MS, title: `Mayor ${election.mayor.name} took office`, lines });
  }
  return out;
}

// ---- when to buy and when to sell ----------------------------------------------------------------------------
export const TRADE_MIN_SPREAD = 0.03; // after the Bazaar tax
export const TRADE_MIN_HIT = 2 / 3;   // of the runs that have both phases

const phaseLabels = { pre2: 2, pre1: 1, a1: 1, a2: 2, a3: 3 };
// Who a key belongs to ("Marina" for perk:Fishing Festival), or null.
export const whoOf = (key) => (key.startsWith('perk:') ? PERKS.find((p) => p.name === key.slice(5))?.who ?? null : null);

// The buy phase and sell phase with the best typical gain after tax, from the curves of the runs of one key.
// Prices are taken relative to the median of the day before (pre1). The pair is a phase and a later one, so a
// price that rises into the event (Ice Bait) gives "buy before, sell during" and one that falls during a term and
// recovers gives "buy in the term, sell after". spread: typical gain of buying in one phase and selling in the
// later one at its median, after the tax on the sale; hits/n: in how many of the runs that have both it paid.
// null unless the spread is over TRADE_MIN_SPREAD and at least TRADE_MIN_HIT of the runs hit (and 3 runs have both).
export function tradeWindow(runs, id, tax) {
  const have = (runs ?? []).filter((run) => run.c?.[id]?.pre1 > 0);
  if (have.length < CONFIRM) return null;
  const order = have.some((run) => isTerm(run)) ? TERM_PHASES : EVENT_PHASES;
  const rel = {};
  for (const ph of order) {
    const v = have.map((run) => run.c[id][ph] / run.c[id].pre1).filter((x) => Number.isFinite(x) && x > 0);
    if (v.length >= CONFIRM) rel[ph] = median(v);
  }
  const names = order.filter((ph) => ph in rel);
  let best = null;
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const spread = (rel[names[j]] / rel[names[i]]) * (1 - tax) - 1;
      // on a tie the later buy phase wins (a day before beats two days before), the earlier sell phase too
      if (!best || spread > best.spread + 1e-9 || (Math.abs(spread - best.spread) <= 1e-9 && i > best.i)) best = { buy: names[i], sell: names[j], spread, i };
    }
  }
  if (!best || best.spread <= TRADE_MIN_SPREAD) return null;
  const both = have.filter((run) => run.c[id][best.buy] > 0 && run.c[id][best.sell] > 0);
  const hits = both.filter((run) => (run.c[id][best.sell] / run.c[id][best.buy]) * (1 - tax) > 1).length;
  if (both.length < CONFIRM || hits / both.length < TRADE_MIN_HIT) return null;
  const { i, ...window } = best;
  return { ...window, hits, n: both.length, src: both.map((run) => run.src ?? 'own') };
}

// "day 3 of Marina's term", "2 days after the term", "during the event"
export function phaseLabel(phase, { who, term }) {
  const what = term ? (who ? `${who}'s term` : 'the term') : 'the event';
  if (phase === 'during') return 'during the event';
  if (phase[0] === 'd') return `day ${phase.slice(1)} of ${what}`;
  const n = phaseLabels[phase];
  return `${n} day${n > 1 ? 's' : ''} ${phase[0] === 'a' ? 'after' : 'before'} ${what}`;
}

// "Buy around: day 3 of Marina's term · Sell around: 2 days after the term · typical +13% (9/12)"
export function tradeText(w, key) {
  const term = key.startsWith('perk:') || key === 'event:grandfeast';
  const who = whoOf(key);
  const from = w.src.filter((s) => s === BACKFILL).length;
  const note = from === w.src.length ? ', historical data (SkyCofl)' : from > 0 ? `, ${w.src.length - from} own, ${from} historical` : '';
  return `Buy around: ${phaseLabel(w.buy, { who, term })} · Sell around: ${phaseLabel(w.sell, { who, term })} · typical +${Math.round(w.spread * 100)}% (${w.hits}/${w.n}${note})`;
}

// Every shown window for one item: [{ key, w, text }], best first.
export function itemWindows(timing, id, tax) {
  return Object.entries(timing ?? {}).map(([key, runs]) => ({ key, w: tradeWindow(runs, id, tax) }))
    .filter((x) => x.w).sort((a, b) => b.w.spread - a.w.spread).map((x) => ({ ...x, text: tradeText(x.w, x.key) }));
}

// Every shown window of every key: [{ key, id, w, text }], best first.
export function allWindows(timing, tax) {
  const out = [];
  for (const [key, runs] of Object.entries(timing ?? {})) {
    for (const id of new Set(runs.flatMap((run) => Object.keys(run.c ?? {})))) {
      const w = tradeWindow(runs, id, tax);
      if (w) out.push({ key, id, w, text: tradeText(w, key) });
    }
  }
  return out.sort((a, b) => b.w.spread - a.w.spread);
}

// Items whose buy phase runs now or starts within `soon` ms, for the terms and events that run or come:
// [{ id, key, state: 'now' | 'soon', from, to (ms), text }]. timing is timing.json's r.
export function buyNow(nowMs, election, timing, tax, soon = 24 * 3600000) {
  const out = [];
  const spans = [];
  const s = termStart(nowMs);
  if (election?.mayor?.year === skyDate(s).year - 1) {
    for (const p of activePerks(election)) spans.push({ key: `perk:${p.name}`, run: { s: s / 60000, e: (s + YEAR_MS) / 60000 } });
  }
  for (const e of upcoming(nowMs, election)) spans.push({ key: `event:${e.key}`, run: { s: e.start / 60000, e: e.end / 60000 } });
  for (const { key, run } of spans) {
    const phases = Object.fromEntries(phaseSpans(run).map(([name, from, to]) => [name, [from * 60000, to * 60000]]));
    for (const id of new Set((timing[key] ?? []).flatMap((r) => Object.keys(r.c ?? {})))) {
      const w = tradeWindow(timing[key], id, tax);
      if (!w) continue;
      const [from, to] = phases[w.buy] ?? [];
      const sellEnd = phases[w.sell]?.[1];
      if (from == null || nowMs >= sellEnd) continue;
      if (nowMs >= from && nowMs < to) out.push({ id, key, state: 'now', from, to, text: tradeText(w, key), w });
      else if (from > nowMs && from - nowMs <= soon) out.push({ id, key, state: 'soon', from, to, text: tradeText(w, key), w });
    }
  }
  return out.sort((a, b) => b.w.spread - a.w.spread);
}

// ---- role of an item ---------------------------------------------------------------------------------------------
// supply: cheaper while the driver runs, dearer after; demand: dearer while it runs, cheaper after; shop: supply
// of an item that is only obtainable then. The measured change (before to during, the pattern of itemPattern) decides;
// the expected role (events.js expectedRole) only settles shop against supply and stands in when nothing was measured.
// { role, expected, measured: 'supply' | 'demand' | null, mismatch, recovers, confirmed, pct }
export function itemRole(runs, id, expected = expectedRole(id)) {
  const { into, out } = itemPattern(runs, id);
  const measured = into.dir < 0 ? 'supply' : into.dir > 0 ? 'demand' : null;
  const sameSide = (a, b) => (a === 'demand') === (b === 'demand');
  const role = measured == null ? expected : sameSide(measured, expected) ? expected : measured;
  return {
    role, expected, measured, mismatch: measured != null && !sameSide(measured, expected),
    recovers: into.dir !== 0 && out.dir === -into.dir, confirmed: into.confirmed, pct: into.pct,
  };
}

// The title of a key for the lists: the driver (mayor or event), not the perk.
export function driverTitle(key) {
  if (DRIVERS[key]) return DRIVERS[key].title;
  if (key.startsWith('perk:')) return key.slice(5);
  return EVENTS.find((e) => `event:${e.key}` === key)?.name ?? key;
}

export const LOW_WEEK_VOLUME = 1000; // items a week; below this a window is hard to fill
export const isLowVolume = (v) => v != null && v < LOW_WEEK_VOLUME;

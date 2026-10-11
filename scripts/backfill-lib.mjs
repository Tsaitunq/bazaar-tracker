// Timing backfill: what to ask SkyCofl for and how its rows become runs of timing.json.
// Pure functions, no network: scripts/timing-backfill.mjs does the asking. The windows and the three medians are
// those of timing.js (runMedians), so a backfilled run is read exactly like one the snapshot run recorded.
import { skyTime, DAY_MS, YEAR_DAYS, EVENTS, PERK_EXPECT } from '../events.js';
import { runMedians, curveMedians, BACKFILL, MIN_DURING_MS } from '../timing.js';

const HOUR = 3600000;
const YEAR_MS = YEAR_DAYS * DAY_MS;
const WINDOW_MS = 24 * HOUR;       // before and after, as in timing.js
const FETCH_MS = 7 * 24 * HOUR;    // SkyCofl gives 2 hour points only for a range of up to 7 days
const CURVE_BEFORE_MS = 48 * HOUR; // the price curve reaches two days before the start
const CURVE_AFTER_MS = 72 * HOUR;  // and three days after the end
export { MIN_DURING_MS };
export const MIN_ELECTION = 179;   // wiki ids before it are not used
export const RUNS_PER_KEY = 12;
export const DATA_START = Date.parse('2020-09-10'); // the first day SkyCofl has bazaar data for GRIFFIN_FEATHER

// Mayor terms. since: the day of the last change of the perk on the wiki (history of the mayor's page); only terms
// that start on or after it count. Mayors' pages read 2026-10-11, see docs/timing-backfill.md.
export const PERK_SPECS = [
  { key: 'perk:Marauder', mayor: 'Paul' },
  { key: 'perk:Mining Fiesta', mayor: 'Cole', since: '2026-08-25' },
  { key: 'perk:Mythological Ritual', mayor: 'Diana' },
  { key: 'perk:Fishing Festival', mayor: 'Marina' },
  { key: 'perk:Blooming Business', mayor: 'Finnegan', since: '2024-07-02' },
  { key: 'perk:Stock Exchange', mayor: 'Diaz', since: '2024-07-02' },
];
// Fixed events. Season of Jerry (one hour inside Jerry's Workshop, same items) cannot be told apart from the
// Workshop and is left out. The Grand Feast needs Finnegan's perk, which exists since 2026-04-28.
export const EVENT_KEYS = ['spooky', 'workshop', 'feast', 'grandfeast'];
const GRAND_FEAST_SINCE = '2026-04-28';

// The term of election n: from Late Spring 27 of year n + 1 for one SkyBlock year.
export const termOf = (n) => { const s = skyTime(n + 1, 2, 27); return { s, e: s + YEAR_MS }; };

// Who was mayor at time t (ms), or null.
export function mayorAt(t, elections) {
  for (const [id, mayor] of Object.entries(elections)) { const { s, e } = termOf(Number(id)); if (t >= s && t < e) return mayor; }
  return null;
}

// A run for timing.json from the start and end of the measured part (ms): b is a day earlier, a a day later.
// x0 and x1 are what the price curve needs: two days before to three days after. Minutes, like timing.json.
export function windows(s, e) {
  return { s: s / 60000, e: e / 60000, b: (s - WINDOW_MS) / 60000, a: (e + WINDOW_MS) / 60000,
    x0: (s - CURVE_BEFORE_MS) / 60000, x1: (e + CURVE_AFTER_MS) / 60000 };
}

// The requests for one run: ranges of at most seven days (two hour points), [from, to) in minutes.
export function chunks(w) {
  const out = [];
  for (let from = w.x0; from < w.x1; from += FETCH_MS / 60000) out.push({ from, to: Math.min(from + FETCH_MS / 60000, w.x1) });
  return out;
}

// What to fetch: { key: [{ s, e, b, a }] }, newest first, only runs whose windows are over by nowMs.
export function plan(nowMs, elections, { count = RUNS_PER_KEY, perks = PERK_SPECS, events = EVENT_KEYS } = {}) {
  const out = {};
  const finished = (w) => w.x1 * 60000 <= nowMs && w.x0 * 60000 >= DATA_START;
  for (const spec of perks) {
    const since = spec.since ? Date.parse(spec.since) : 0;
    out[spec.key] = Object.entries(elections)
      .filter(([id, mayor]) => mayor === spec.mayor && Number(id) >= MIN_ELECTION)
      .map(([id]) => termOf(Number(id)))
      .filter((t) => t.s >= since)
      .map((t) => windows(t.s, t.e))
      .filter(finished)
      .sort((x, y) => y.s - x.s).slice(0, count);
  }
  for (const key of events) {
    const ev = EVENTS.find((x) => x.key === key);
    const out0 = [];
    for (let y = 1; y < 700; y++) { // far past any year the data can reach
      for (const [month, day] of ev.starts) {
        const s = skyTime(y, month, day);
        if (s > nowMs || s < DATA_START) continue;
        if (key === 'grandfeast' && (mayorAt(s, elections) !== 'Finnegan' || s < Date.parse(GRAND_FEAST_SINCE))) continue;
        const w = windows(s, s + Math.max(ev.days * DAY_MS, MIN_DURING_MS));
        if (finished(w)) out0.push(w);
      }
    }
    out[`event:${key}`] = out0.sort((x, y) => y.s - x.s).slice(0, count);
  }
  return out;
}

// The items of a key: the perk's expected items or the event's.
export function itemsOf(key) {
  if (key.startsWith('perk:')) return PERK_EXPECT[key.slice(5)]?.items ?? [];
  return EVENTS.find((e) => `event:${e.key}` === key)?.items ?? [];
}

// SkyCofl rows { buy, sell, timestamp } to points [minute, buy, sell] as timing.js reads them. SkyCofl's "buy" is the
// instant-buy price (lowest offer), which is what bookPrices().sell and so the third value is; its "sell" is ours.
export function rowsToPoints(rows) {
  const utc = (t) => Date.parse(t + (/[zZ]|[+-]dd:?dd$/.test(t) ? '' : 'Z')) / 60000;
  // chunks of one run share their end points: one point per time
  const byTime = new Map();
  for (const r of rows ?? []) { const t = r && utc(r.timestamp); if (Number.isFinite(t)) byTime.set(t, [t, r.sell, r.buy]); }
  return [...byTime.values()].sort((x, y) => x[0] - y[0]);
}

// One run with its item medians and curves. fetched: { item: rows | null } (null = no data in the window)
export function buildRun(w, fetched) {
  const p = {}, c = {};
  for (const [id, rows] of Object.entries(fetched)) {
    const points = rowsToPoints(rows);
    const m = runMedians(points, w);
    if (m.some((v) => v != null)) p[id] = m;
    const curve = curveMedians(points, w);
    if (Object.keys(curve).length) c[id] = curve;
  }
  return { s: w.s, e: w.e, b: w.b, a: w.a, p, c, src: BACKFILL };
}

// --fill: what an earlier result still lacks. The items of a key that the run starting at s has no medians or
// curve for and that were not found empty before (prior.none[key]).
export function missingItems(prior, key, s, items) {
  const run = prior?.r?.[key]?.find((r) => r.s === s);
  const none = new Set(prior?.none?.[key] ?? []);
  return items.filter((id) => !none.has(id) && !(run && (id in (run.p ?? {}) || id in (run.c ?? {}))));
}

// A freshly built run joined with the one a prior result has for the same start: the prior items stay.
export const mergeRun = (prior, run) => (prior ? { ...prior, p: { ...prior.p, ...run.p }, c: { ...(prior.c ?? {}), ...run.c } } : run);

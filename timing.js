// Event timing: what an item's price did around past events and mayor terms, and the pattern in it.
// The snapshot run keeps three medians per run and item in timing.json; the snapshots themselves
// expire. A run is { s, e, b, a, p }: start and end, where the "before" window starts and the
// "after" window ends (all in minutes), and p[itemId] = [median before, during, after].
import { PERK_EXPECT, DAY_MS, YEAR_DAYS, EVENTS, skyDate, skyTime, activePerks, upcoming, termStart } from './events.js';
import { median } from './history.js';

export const CONFIRM = 3;                // runs in the same direction before a pattern counts
export const FLAT = 0.01;                // a change below 1% has no direction
export const LEAD_MS = 3 * 3600000;      // the Android notice comes this long before an event
const WINDOW_MS = 24 * 3600000;
const TERM_NOTICE_MS = 6 * 3600000;      // a new mayor is announced for this long
const RETRY_MIN = 2 * 24 * 60;           // a window without prices is given up after two days
const YEAR_MS = YEAR_DAYS * DAY_MS;

// Events and terms that have started and whose "after" window is still open, with times in ms.
// Windows are cut where they would reach into the neighbouring run (Fishing Festival: every month).
export function started(nowMs, election) {
  const perks = activePerks(election);
  const { year } = skyDate(nowMs);
  const out = [];
  for (const e of EVENTS) {
    if (!e.items.length || (e.perk && !perks.some((p) => p.name === e.perk))) continue;
    const length = e.days * DAY_MS;
    const starts = [year - 2, year - 1, year, year + 1].flatMap((y) => e.starts.map(([month, day]) => skyTime(y, month, day))).sort((a, b) => a - b);
    const i = starts.findLastIndex((s) => s <= nowMs);
    const s = starts[i];
    out.push({ key: `event:${e.key}`, s, e: s + length, b: Math.max(s - WINDOW_MS, starts[i - 1] + length), a: Math.min(s + length + WINDOW_MS, starts[i + 1]), items: e.items });
  }
  const s = termStart(nowMs);
  // the election file lags behind the calendar: only a mayor elected for this term counts
  if (election?.mayor?.year === skyDate(s).year - 1) {
    for (const p of perks) {
      if (PERK_EXPECT[p.name]) out.push({ key: `perk:${p.name}`, s, e: s + YEAR_MS, b: s - WINDOW_MS, a: s + YEAR_MS + WINDOW_MS, items: PERK_EXPECT[p.name].items });
    }
  }
  return out.filter((o) => nowMs < o.a);
}

// The next timing.json. series(id): the item's kept snapshots as [minute, buy, sell].
// Runs are never removed; a median is filled in once its window has passed. Changes `timing`.
export function updateTiming(timing, election, series, nowMs) {
  const now = nowMs / 60000;
  const r = timing?.r ?? {};
  for (const o of started(nowMs, election)) {
    r[o.key] ??= [];
    if (!r[o.key].some((run) => run.s === o.s / 60000)) {
      r[o.key].push({ s: o.s / 60000, e: o.e / 60000, b: o.b / 60000, a: o.a / 60000, p: {} });
    }
    const run = r[o.key].find((x) => x.s === o.s / 60000);
    for (const id of o.items) run.p[id] ??= [null, null, null];
  }
  for (const run of Object.values(r).flat()) {
    [[run.b, run.s], [run.s, run.e], [run.e, run.a]].forEach(([from, to], i) => {
      if (now < to || now > to + RETRY_MIN) return;
      for (const [id, v] of Object.entries(run.p)) {
        if (v[i] != null) continue;
        const m = median(series(id).filter(([t]) => t >= from && t < to).map((p) => p[2]));
        v[i] = m == null ? null : Math.round(m * 10) / 10;
      }
    });
  }
  return { t: nowMs, r, n: notices(r, election, nowMs) };
}

// changes: one relative price change per run. pct: the typical one; dir: its direction or 0;
// n: runs that went the same way.
export function pattern(changes) {
  const pct = median(changes);
  const dir = pct == null || Math.abs(pct) < FLAT ? 0 : Math.sign(pct);
  const n = dir ? changes.filter((c) => Math.abs(c) >= FLAT && Math.sign(c) === dir).length : 0;
  return { pct, dir, n, confirmed: n >= CONFIRM };
}

// into: before → during; out: during → after
export function itemPattern(runs = [], id) {
  const changes = (i) => runs.map((run) => run.p[id]).filter((v) => v?.[i] > 0 && v[i + 1] != null).map((v) => v[i + 1] / v[i] - 1);
  return { into: pattern(changes(0)), out: pattern(changes(1)) };
}

const signed = (x) => `${x > 0 ? '+' : '−'}${Math.round(Math.abs(x) * 1000) / 10}%`;
// when: "during event", "during term", "after event"
export const patternText = (p, when) =>
  (p.confirmed ? `Usually ${signed(p.pct)} ${when} (seen ${p.n} times)` : `not enough data yet (${p.n}/${CONFIRM})`);

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

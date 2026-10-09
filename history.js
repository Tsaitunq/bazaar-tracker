import { bookPrices } from './flips.js';

export const SHARDS = 16;
export const KEEP_DAYS = 7;
export const MIN_POINTS = 12;
export const SCORE_TAX = 0.0125;

export const shardOf = (id) => [...id].reduce((s, c) => s + c.charCodeAt(0), 0) % SHARDS;

export const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10);

export const dayKeys = (nowMs, n) =>
  Array.from({ length: n }, (_, i) => dayKey(nowMs - (n - 1 - i) * 86400000));

export function compactPrices(products) {
  const out = {};
  for (const [id, p] of Object.entries(products)) {
    const b = bookPrices(p);
    if (b) out[id] = [Math.round(b.buy * 10) / 10, Math.round(b.sell * 10) / 10];
  }
  return out;
}

// Does not mutate its input.
export function appendSnapshot(chunk, tMin, prices) {
  const t = chunk?.t ?? [];
  if (chunk && tMin <= t[t.length - 1]) return chunk;
  const p = {};
  for (const id of new Set([...Object.keys(chunk?.p ?? {}), ...Object.keys(prices)])) {
    const old = chunk?.p[id] ?? [t.map(() => null), t.map(() => null)];
    const now = prices[id] ?? [null, null];
    p[id] = [[...old[0], now[0]], [...old[1], now[1]]];
  }
  return { t: [...t, tMin], p };
}

export function seriesFor(chunks, id) {
  const out = [];
  for (const c of chunks) {
    const s = c?.p?.[id];
    if (!s) continue;
    c.t.forEach((t, i) => { if (s[0][i] != null && s[1][i] != null) out.push([t, s[0][i], s[1][i]]); });
  }
  return out.sort((a, b) => a[0] - b[0]);
}

export const marginSeries = (points, tax) =>
  points.map(([t, buy, sell]) => [t, (sell * (1 - tax) - buy) / buy]);

const cv = (xs) => {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / xs.length) / mean;
};

export function stabilityScore(points) {
  if (points.length < MIN_POINTS) return null;
  const positive = points.filter(([, b, s]) => s * (1 - SCORE_TAX) - b > 0).length / points.length;
  const swing = (cv(points.map((p) => p[1])) + cv(points.map((p) => p[2]))) / 2;
  return Math.round(100 * positive * Math.max(0, 1 - 2 * swing));
}

export function median(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// [score | null, median sell price, hours between first and last point] for stats.json
export function itemStats(points) {
  const hours = points.length ? (points[points.length - 1][0] - points[0][0]) / 60 : 0;
  const round = (v) => Math.round(v * 10) / 10;
  return [stabilityScore(points), round(median(points.map((p) => p[2])) ?? 0), round(hours)];
}

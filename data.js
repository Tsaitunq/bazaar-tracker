import { dayKeys, shardOf, seriesFor } from './history.js';

const RAW = 'https://raw.githubusercontent.com/Tsaitunq/bazaar-tracker/data/';

// The Android app is served from https://localhost, so only plain http counts as the dev server.
export const dataUrl = (hostname, protocol) =>
  (protocol === 'http:' && (hostname === 'localhost' || hostname === '127.0.0.1') ? './data/' : RAW);

async function fetchJson(path) {
  const { hostname, protocol } = globalThis.location ?? {};
  const res = await fetch(dataUrl(hostname, protocol) + path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// null when the file cannot be loaded, so the app can tell that apart from an item without history
export const loadStats = () => fetchJson('stats.json').then((d) => d.i ?? null, () => null);
export const loadRecipes = () => fetchJson('recipes.json').then((d) => d.r ?? null, () => null);
export const loadForge = () => fetchJson('forge.json').then((d) => d.r ?? null, () => null);
// lowest BIN per forge result that is not on the bazaar; empty when there is none yet
export const loadAh = () => fetchJson('ah.json').then((d) => d.p ?? {}, () => ({}));
export const loadElection = () => fetchJson('election.json').then((d) => (d?.mayor ? d : null), () => null);
// runs per event and perk (timing.js); empty until the first one is recorded
export const loadTiming = () => fetchJson('timing.json').then((d) => d.r ?? {}, () => ({}));

// the buy and sell windows as concrete times (timing.js timingWindows); null until the snapshot run has written them
export const loadWindows = () => fetchJson('timing-windows.json').catch(() => null);

// Lowest BIN of single items, asked on the device only when the Progress page needs them.
// A cache entry is { p: price or 0 for no auction, t: when }.
const COFL = 'https://sky.coflnet.com/api/item/price/';
export const BIN_MAX_AGE = 3600e3;
const BIN_GAP = 1300; // the service allows 50 requests a minute

export function freshBins(cache, now = Date.now()) {
  const out = {};
  for (const [id, e] of Object.entries(cache)) if (now - e?.t < BIN_MAX_AGE) out[id] = e.p;
  return out;
}

// Asks one by one and reports after each answer; false as soon as the service fails, which is not cached.
export async function fetchBins(ids, cache, onAnswer, { get = fetch, wait = (ms) => new Promise((r) => setTimeout(r, ms)), now = Date.now } = {}) {
  for (const [n, id] of ids.entries()) {
    if (n) await wait(BIN_GAP);
    try {
      const res = await get(`${COFL}${encodeURIComponent(id)}/bin`);
      // an item the service does not know answers 400 or 404: that is no auction, not a failure
      if (!res.ok && res.status !== 400 && res.status !== 404) return false;
      const lowest = res.ok && res.status !== 204 ? (await res.json())?.lowest : 0;
      cache[id] = { p: lowest > 0 ? lowest : 0, t: now() };
    } catch {
      return false;
    }
    onAnswer(n + 1 === ids.length);
  }
  return true;
}

export async function loadHistory(id, days, nowMs = Date.now()) {
  const chunks = await Promise.all(dayKeys(nowMs, days + 1).map((d) => fetchJson(`h/${d}/${shardOf(id)}.json`).catch(() => null)));
  return seriesFor(chunks, id);
}

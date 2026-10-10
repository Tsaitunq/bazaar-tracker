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

export async function loadHistory(id, days, nowMs = Date.now()) {
  const chunks = await Promise.all(dayKeys(nowMs, days + 1).map((d) => fetchJson(`h/${d}/${shardOf(id)}.json`).catch(() => null)));
  return seriesFor(chunks, id);
}

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

export const loadScores = () => fetchJson('scores.json').then((d) => d.s ?? {}, () => ({}));
export const loadRecipes = () => fetchJson('recipes.json').then((d) => d.r ?? null, () => null);

export async function loadHistory(id, days, nowMs = Date.now()) {
  const chunks = await Promise.all(dayKeys(nowMs, days + 1).map((d) => fetchJson(`h/${d}/${shardOf(id)}.json`).catch(() => null)));
  return seriesFor(chunks, id);
}

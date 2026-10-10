import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { recipesStale, refreshRecipes } from './recipes.mjs';
import { fetchLowestBins } from './auctions.mjs';
import { compactElection } from './election.mjs';
import { trendSlope } from '../trends.js';
import { updateTiming } from '../timing.js';
import { SHARDS, KEEP_DAYS, shardOf, dayKey, dayKeys, compactPrices, appendSnapshot, seriesFor, itemStats } from '../history.js';

const readChunk = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null);

export function runSnapshot(dataDir, products, nowMs) {
  const prices = compactPrices(products);
  const tMin = Math.round(nowMs / 60000);
  const day = dayKey(nowMs);
  const hDir = path.join(dataDir, 'h');
  const dayDir = path.join(hDir, day);
  fs.mkdirSync(dayDir, { recursive: true });
  for (let s = 0; s < SHARDS; s++) {
    const shardPrices = Object.fromEntries(Object.entries(prices).filter(([id]) => shardOf(id) === s));
    const file = path.join(dayDir, `${s}.json`);
    fs.writeFileSync(file, JSON.stringify(appendSnapshot(readChunk(file), tMin, shardPrices)));
  }
  const oldest = dayKeys(nowMs, KEEP_DAYS + 1)[0];
  for (const d of fs.readdirSync(hDir)) if (d < oldest) fs.rmSync(path.join(hDir, d), { recursive: true, force: true });

  const days = fs.readdirSync(hDir);
  const chunks = days.flatMap((d) => Array.from({ length: SHARDS }, (_, s) => readChunk(path.join(hDir, d, `${s}.json`))));
  const ids = new Set(chunks.flatMap((c) => Object.keys(c?.p ?? {})));
  const scores = {};
  const stats = {};
  for (const id of ids) {
    const series = seriesFor(chunks, id);
    // the trend is a fourth field; readers of the first three (older apps, the Android worker) ignore it
    stats[id] = [...itemStats(series), trendSlope(series)];
    if (stats[id][0] != null) scores[id] = stats[id][0];
  }
  fs.writeFileSync(path.join(dataDir, 'stats.json'), JSON.stringify({ t: tMin, i: stats }));
  // app versions before 3 read only this file
  fs.writeFileSync(path.join(dataDir, 'scores.json'), JSON.stringify({ t: tMin, s: scores }));
  // kept for good, unlike the snapshots; a broken file stops the run here instead of being overwritten
  const timingFile = path.join(dataDir, 'timing.json');
  const election = readChunk(path.join(dataDir, 'election.json'));
  fs.writeFileSync(timingFile, JSON.stringify(updateTiming(readChunk(timingFile), election, (id) => seriesFor(chunks, id), nowMs)));
  return { day, count: Object.keys(prices).length };
}

const API = 'https://api.hypixel.net/v2/';
// Runs fn again after a failure: the auction pages are large, and now and then a connection drops mid-way.
export async function retry(fn, waits = [1000, 3000]) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= waits.length) throw e;
      await new Promise((resolve) => setTimeout(resolve, waits[attempt]));
    }
  }
}

const getJson = (url) => retry(async () => {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error('API reported success=false');
  return json;
});

// Mayor and lowest BINs ride along with the snapshot. If one of them fails, its old file stays
// and the snapshot still counts.
export async function runExtras(dataDir, bazaarIds, nowMs, get = getJson) {
  const write = (name, value) => fs.writeFileSync(path.join(dataDir, name), JSON.stringify(value));
  const done = [];
  try {
    write('election.json', compactElection(await get(`${API}resources/skyblock/election`), nowMs));
    done.push('election');
  } catch (e) {
    console.error(`election failed: ${e.message}`);
  }
  try {
    const forge = readChunk(path.join(dataDir, 'forge.json'))?.r ?? {};
    const wanted = new Set(Object.keys(forge).filter((id) => !bazaarIds.has(id)));
    if (wanted.size) {
      write('ah.json', { t: nowMs, p: await fetchLowestBins((n) => get(`${API}skyblock/auctions?page=${n}`), wanted) });
      done.push('ah');
    }
  } catch (e) {
    console.error(`auctions failed: ${e.message}${e.cause ? ` (${e.cause.code ?? e.cause.message})` : ''}`);
  }
  return done;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const json = await getJson(`${API}skyblock/bazaar`);
    const dataDir = process.argv[2] ?? 'data';
    const now = Date.now();
    const { day, count } = runSnapshot(dataDir, json.products, now);
    console.log(`snapshot ${day}: ${count} products`);
    // forge.json came later than recipes.json: fetch both as soon as it is missing
    if (recipesStale(path.join(dataDir, 'recipes.json'), now) || !fs.existsSync(path.join(dataDir, 'forge.json'))) {
      try {
        const r = refreshRecipes(dataDir, new Set(Object.keys(json.products)), now);
        console.log(`recipes: ${Object.keys(r.recipes).length}, forge: ${Object.keys(r.forge).length}`);
      } catch (e) {
        console.error(`recipes failed: ${e.message}`);
      }
    }
    const extras = await runExtras(dataDir, new Set(Object.keys(json.products)), now);
    console.log(`extras: ${extras.join(', ') || 'none'}`);
  } catch (e) {
    console.error(`snapshot failed: ${e.message}`);
    process.exitCode = 1;
  }
}

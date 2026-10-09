import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SHARDS, KEEP_DAYS, shardOf, dayKey, dayKeys, compactPrices, appendSnapshot, seriesFor, stabilityScore } from '../history.js';

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
  for (const id of ids) {
    const score = stabilityScore(seriesFor(chunks, id));
    if (score != null) scores[id] = score;
  }
  fs.writeFileSync(path.join(dataDir, 'scores.json'), JSON.stringify({ t: tMin, s: scores }));
  return { day, count: Object.keys(prices).length };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const res = await fetch('https://api.hypixel.net/v2/skyblock/bazaar');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.success) throw new Error('API reported success=false');
    const { day, count } = runSnapshot(process.argv[2] ?? 'data', json.products, Date.now());
    console.log(`snapshot ${day}: ${count} products`);
  } catch (e) {
    console.error(`snapshot failed: ${e.message}`);
    process.exitCode = 1;
  }
}

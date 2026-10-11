// One-off: fills timing.json's runs from SkyCofl's bazaar history, for the mayor perks and fixed events the
// app knows items for. node scripts/timing-backfill.mjs [--out timing-backfill.json] [--count 12] [--dry-run]
// One request a second, Retry-After respected. Progress is kept in <out>.partial.json, so a stopped run resumes.
// --fill: keep the runs of an earlier <out> and ask only for the items they lack (a new item in events.js).
// Data: https://sky.coflnet.com/data (SkyCofl), please attribute.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { plan, itemsOf, buildRun, chunks, missingItems, mergeRun, RUNS_PER_KEY } from './backfill-lib.mjs';

const API = 'https://sky.coflnet.com/api/bazaar/';
const GAP_MS = 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const iso = (min) => new Date(min * 60000).toISOString();

// rows, [] for no data; throws when it cannot be had after the retries
export async function fetchHistory(item, w, fetchImpl = fetch, log = () => {}) {
  const url = `${API}${encodeURIComponent(item)}/history?start=${iso(w.from)}&end=${iso(w.to)}`;
  for (let attempt = 1; attempt <= 6; attempt++) {
    let res;
    try { res = await fetchImpl(url, { headers: { Accept: 'application/json' } }); } catch (err) {
      log(`  ${item}: ${err.message}, retry ${attempt}`);
      await sleep(5000 * attempt);
      continue;
    }
    if (res.status === 429) {
      const wait = (Number(res.headers.get('retry-after')) || 15) * 1000;
      log(`  429, waiting ${wait / 1000} s`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) {
      log(`  ${item}: HTTP ${res.status}, retry ${attempt}`);
      await sleep(5000 * attempt);
      continue;
    }
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  }
  throw new Error(`no answer for ${item} ${iso(w.from)}`);
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
  const out = opt('--out', 'timing-backfill.json');
  const count = Number(opt('--count', RUNS_PER_KEY));
  const dry = args.includes('--dry-run');
  const fill = args.includes('--fill');
  const here = path.dirname(fileURLToPath(import.meta.url));
  const elections = JSON.parse(fs.readFileSync(path.join(here, 'mayors-history.json'), 'utf8')).elections;
  const nowMs = Date.now();
  const runs = plan(nowMs, elections, { count });
  const total = Object.entries(runs).reduce((sum, [key, ws]) => sum + ws.reduce((n, w) => n + chunks(w).length, 0) * itemsOf(key).length, 0);
  console.log(`${Object.values(runs).flat().length} runs, up to ${total} requests`);
  for (const [key, ws] of Object.entries(runs)) console.log(`  ${key}: ${ws.length} runs, ${itemsOf(key).length} items`);
  if (dry) return;

  const partialFile = `${out}.partial.json`;
  const done = fs.existsSync(partialFile) ? JSON.parse(fs.readFileSync(partialFile, 'utf8')) : {}; // `${key}|${s}|${item}` -> rows
  const firstGone = {}; // item -> true once a window had no data: older ones have none either
  let requests = 0;
  const prior = fill && fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : null;
  const result = prior ? { ...prior, t: nowMs, none: { ...(prior.none ?? {}) } } : { t: nowMs, src: 'skycofl', r: {} };
  for (const [key, ws] of Object.entries(runs)) {
    const found = new Set();
    for (const w of ws) {
      const fetched = {};
      for (const item of fill ? missingItems(prior, key, w.s, itemsOf(key)) : itemsOf(key)) {
        if (firstGone[item]) continue;
        const rows = [];
        for (const [n, chunk] of chunks(w).entries()) {
          const id = `${key}|${w.s}|${item}|${n}`;
          if (!(id in done)) {
            done[id] = await fetchHistory(item, chunk, fetch, console.log);
            requests++;
            if (requests % 50 === 0) { fs.writeFileSync(partialFile, JSON.stringify(done)); console.log(`  ${requests} requests`); }
            await sleep(GAP_MS);
          }
          rows.push(...done[id]);
        }
        if (rows.length === 0) firstGone[item] = true; else fetched[item] = rows;
      }
      for (const item of Object.keys(fetched)) found.add(item);
      const run = buildRun(w, fetched);
      const list = (result.r[key] ??= []);
      const at = list.findIndex((r) => r.s === w.s);
      if (at >= 0) list[at] = mergeRun(list[at], run);
      else if (Object.keys(run.p).length) list.push(run);
    }
    if (result.r[key]) result.r[key].sort((x, y) => x.s - y.s);
    // an item that had no rows in any run is remembered, so --fill does not ask again
    if (fill) {
      const empty = itemsOf(key).filter((id) => !found.has(id) && missingItems(prior, key, ws[0]?.s, [id]).length && !result.r[key]?.some((r) => id in (r.p ?? {})));
      if (empty.length) result.none[key] = [...new Set([...(result.none[key] ?? []), ...empty])];
    }
  }
  fs.writeFileSync(out, JSON.stringify(result));
  fs.rmSync(partialFile, { force: true });
  console.log(`wrote ${out}: ${Object.values(result.r).flat().length} runs, ${requests} requests`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const REPO = 'https://github.com/NotEnoughUpdates/NotEnoughUpdates-REPO';
const SLOTS = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3'];

export function parseRecipe(item) {
  const r = item.recipe ?? item.recipes?.find((x) => x.type === 'crafting');
  if (!r) return null;
  const i = {};
  for (const slot of SLOTS) {
    const v = r[slot];
    if (!v) continue;
    const [, id, q] = v.match(/^(.+):(\d+)$/) ?? [, v];
    i[id] = (i[id] ?? 0) + (q ? Number(q) : 1);
  }
  if (!Object.keys(i).length) return null;
  return { out: r.overrideOutputId ?? item.internalname, n: r.count ?? 1, i };
}

export function toBazaarId(neuId, bazaarIds) {
  if (bazaarIds.has(neuId)) return neuId;
  const alt = neuId.replace(/-(\d+)$/, ':$1');
  return alt !== neuId && bazaarIds.has(alt) ? alt : null;
}

export function buildRecipes(items, bazaarIds) {
  const res = {};
  for (const item of items) {
    const p = parseRecipe(item);
    const out = p && toBazaarId(p.out, bazaarIds);
    if (!out) continue;
    const i = {};
    let ok = true;
    for (const [id, q] of Object.entries(p.i)) {
      const b = toBazaarId(id, bazaarIds);
      if (!b || b === out) { ok = false; break; }
      i[b] = (i[b] ?? 0) + q;
    }
    if (!ok) continue;
    res[out] = { n: p.n, i };
  }
  return res;
}

export function loadNeuItems(repoDir) {
  const dir = path.join(repoDir, 'items');
  const items = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    try { items.push(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))); } catch { /* skip bad file */ }
  }
  return items;
}

export function recipesStale(file, nowMs) {
  try { return nowMs - JSON.parse(fs.readFileSync(file, 'utf8')).t > 24 * 3600e3; } catch { return true; }
}

export function refreshRecipes(dataDir, bazaarIds, nowMs) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'neu-'));
  try {
    execFileSync('git', ['clone', '--quiet', '--depth', '1', REPO, tmp], { stdio: 'inherit' });
    const r = buildRecipes(loadNeuItems(tmp), bazaarIds);
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'recipes.json'), JSON.stringify({ t: nowMs, r }));
    return r;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

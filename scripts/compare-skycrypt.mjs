// Local check, not part of the app: node scripts/compare-skycrypt.mjs <name> <profile name> [saved SkyCrypt JSON]
// Reads the profile from the worker and from SkyCrypt (sky.shiiyu.moe, or the JSON saved in personal/skycrypt.json when the call
// is blocked) and writes only the differences to personal/sources/skycrypt-diff.md (private: personal/ is not in git).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { listProfiles, fetchProfile } from '../apps/guide/import/api.js';
import { summarize } from '../apps/guide/import/profile.js';
import { loadGameData } from '../apps/guide/gamedata.js';
import { ourItems, skycryptItems, diffItems, diffProfile, renderTable } from './lib/skycrypt-compare.mjs';

const [name, wanted, file = 'personal/skycrypt.json'] = process.argv.slice(2);
if (!name || !wanted) { console.error('usage: node scripts/compare-skycrypt.mjs <name> <profile name> [saved SkyCrypt JSON]'); process.exit(2); }

// The answer holds profiles by id: { profiles: { <id>: { cute_name, data } } } (or one profile object saved on its own).
function skyProfile(body) {
  const list = Object.values(body?.profiles ?? (body?.data ? { x: body } : {}));
  return list.find((p) => String(p.cute_name).toLowerCase() === wanted.toLowerCase())?.data ?? null;
}
async function skycrypt() {
  try {
    const res = await fetch(`https://sky.shiiyu.moe/api/v2/profile/${encodeURIComponent(name)}`, { headers: { 'User-Agent': 'progression-guides-check' } });
    if (res.ok) { const data = skyProfile(await res.json()); if (data) return data; }
    console.error(`SkyCrypt answered ${res.status}; reading ${file}`);
  } catch { console.error(`SkyCrypt not reachable; reading ${file}`); }
  if (!existsSync(file)) { console.error(`No ${file}. Save the SkyCrypt JSON of the profile there.`); process.exit(1); }
  const data = skyProfile(JSON.parse(readFileSync(file, 'utf8')));
  if (!data) { console.error('The saved JSON has no such profile.'); process.exit(1); }
  return data;
}

const list = await listProfiles(name);
const profile = list.find((p) => p.cute_name.toLowerCase() === wanted.toLowerCase());
if (!profile) { console.error(`Profile not found. Profiles: ${list.map((p) => p.cute_name).join(', ')}`); process.exit(1); }
const answer = await fetchProfile(name, profile.id);
const data = await loadGameData(async (f) => JSON.parse(readFileSync(new URL(`../gamedata/${f}.json`, import.meta.url), 'utf8')));
const summary = await summarize(answer, data);
const sky = await skycrypt();

const mine = await ourItems(answer.inventories);
const theirs = skycryptItems(sky);
const rows = [...diffItems(mine, theirs), ...diffProfile(summary, sky)];
const table = renderTable(rows);
console.log(`${mine.length} items in the app, ${theirs.length} in SkyCrypt, ${rows.length} differences`);
console.log(table);
mkdirSync('personal/sources', { recursive: true });
writeFileSync('personal/sources/skycrypt-diff.md', `# SkyCrypt against the app (${new Date().toISOString().slice(0, 10)})\n\n${mine.length} items in the app, ${theirs.length} in SkyCrypt.\n\n${table}`);

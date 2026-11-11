// Local check, not part of the app: node scripts/compare-skycrypt.mjs <name> <profile name> [saved SkyCrypt JSON]
// Reads the profile from the worker and from SkyCrypt (api.shiiyu.moe with SKYCRYPT_API_KEY, or the JSON saved in personal/skycrypt.json
// when there is no key) and writes only the differences to personal/sources/skycrypt-diff.md (private: personal/ is not in git).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { listProfiles, fetchProfile } from '../apps/guide/import/api.js';
import { summarize } from '../apps/guide/import/profile.js';
import { loadGameData } from '../apps/guide/gamedata.js';
import { ourItems, skycryptItems, diffItems, diffProfile, renderTable } from './lib/skycrypt-compare.mjs';

const [name, wanted, file = 'personal/skycrypt.json'] = process.argv.slice(2);
if (!name || !wanted) { console.error('usage: node scripts/compare-skycrypt.mjs <name> <profile name> [saved SkyCrypt JSON]'); process.exit(2); }

// SkyCrypt's API (api.shiiyu.moe) needs a key: SKYCRYPT_API_KEY, from the developer page of your SkyCrypt dashboard. Without one, or when
// it is blocked, a saved JSON is read: { uuid-less } the answers of /api/combined and /api/inventory as { combined, inventory }.
const KEY = process.env.SKYCRYPT_API_KEY;
async function get(path) {
  const res = await fetch(`https://api.shiiyu.moe/api${path}`, { headers: { 'User-Agent': 'progression-guides-check', 'x-api-key': KEY } });
  if (!res.ok) throw new Error(`SkyCrypt ${path.split('/')[1]} answered ${res.status}`);
  return res.json();
}
// what the compare reads: items under data.items by place, plus the parts of the combined answer
const shape = ({ combined, inventory }) => ({ ...combined, items: { ...combined.gear, accessory_bag: combined.accessories?.accessories, inventory }, pets: combined.pets });
async function skycrypt() {
  try {
    if (!KEY) throw new Error('no SKYCRYPT_API_KEY');
    const { uuid } = await get(`/uuid/${encodeURIComponent(name)}`);
    const id = (await get(`/stats/${uuid}`)).profiles?.find((p) => String(p.cute_name ?? p.profile_cute_name).toLowerCase() === wanted.toLowerCase())?.profile_id;
    if (!id) throw new Error('profile not found at SkyCrypt');
    return shape({ combined: await get(`/combined/${uuid}/${id}`), inventory: await get(`/inventory/${uuid}/${id}`) });
  } catch (e) { console.error(`${e.message}; reading ${file}`); }
  if (!existsSync(file)) { console.error(`No ${file}. Set SKYCRYPT_API_KEY, or save { "combined": ..., "inventory": ... } there.`); process.exit(1); }
  return shape(JSON.parse(readFileSync(file, 'utf8')));
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

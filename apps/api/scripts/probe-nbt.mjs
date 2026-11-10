// Finds where item data lives in a profile member. Prints PATHS, types and lengths only: no values, no name, no uuid.
// Usage (in apps/api):  node scripts/probe-nbt.mjs <name> [profile-id]
// Without a profile id the selected profile is used. The key is read from apps/api/.dev.vars (git-ignored) and never printed.
//  1. Every path holding item data: {type:number, data:string} or a string starting with "H4sI" (gzip base64), with the length of data.
//  2. Every key path whose last key contains ward, loadout, preset, equip, armor or set (case-insensitive), with its type.
// Numeric keys print as #, id-like keys (32 hex chars, with or without dashes) as <id>; same normalised paths are counted.
import { readFileSync } from 'node:fs';
import { mojangUuid, hypixelProfiles } from '../src/upstream.js';

const [name, profileId] = process.argv.slice(2);
if (!name) {
  console.error('usage: node scripts/probe-nbt.mjs <name> [profile-id]');
  process.exit(1);
}
const vars = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8');
const key = (vars.match(/^HYPIXEL_KEY\s*=\s*"?([^"\r\n]+)"?/m) || [])[1];
if (!key) {
  console.error('HYPIXEL_KEY not found in apps/api/.dev.vars');
  process.exit(1);
}

const deps = { fetch: (...a) => fetch(...a) };
const uuid = await mojangUuid(name, deps);
const profiles = await hypixelProfiles(uuid, { HYPIXEL_KEY: key }, deps);
const wanted = profileId ? profileId.toLowerCase().replace(/-/g, '') : null;
const p = profiles.find((x) => (wanted ? x.profile_id.replace(/-/g, '') === wanted : x.selected));
const member = p && p.members && p.members[uuid];
if (!member) {
  console.log('no member data for this profile');
  process.exit(0);
}

const KEYWORDS = /ward|loadout|preset|equip|armor|set/i;
const seg = (k) => (/^\d+$/.test(k) ? '#' : /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(k) ? '<id>' : k);
const kind = (v) => (Array.isArray(v) ? `array[${v.length}]` : v === null ? 'null' : typeof v === 'object' ? `object[${Object.keys(v).length} keys]` : typeof v);
const items = new Map(); // path -> { count, lens:Set }
const keyed = new Map(); // path -> { count, types:Set }
const bump = (map, path, extra) => {
  const e = map.get(path) || { count: 0, extra: new Set() };
  e.count++;
  if (extra !== undefined) e.extra.add(extra);
  map.set(path, e);
};

function walk(v, path, depth) {
  if (typeof v === 'string') {
    if (v.startsWith('H4sI')) bump(items, path, `string len ${v.length}`);
    return;
  }
  if (!v || typeof v !== 'object' || depth > 12) return;
  if (!Array.isArray(v) && typeof v.type === 'number' && typeof v.data === 'string') bump(items, path, `{type,data} data len ${v.data.length}`);
  for (const k of Object.keys(v)) {
    const child = `${path}.${seg(k)}`;
    if (KEYWORDS.test(k)) bump(keyed, child, kind(v[k]));
    walk(v[k], child, depth + 1);
  }
}
walk(member, 'member', 0);

const out = (map) => [...map].sort(([a], [b]) => a.localeCompare(b)).map(([path, e]) => `  ${path}  x${e.count}  ${[...e.extra].sort().join(' | ')}`);
console.log(`item-data paths (${items.size}):`);
console.log(out(items).join('\n') || '  (none)');
console.log(`\nkeys matching ward|loadout|preset|equip|armor|set (${keyed.size}):`);
console.log(out(keyed).join('\n') || '  (none)');

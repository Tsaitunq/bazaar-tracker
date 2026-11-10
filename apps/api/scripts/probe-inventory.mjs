// Prints ONLY key names under members.<uuid>.inventory (and one level deeper), no values, no name, no ids.
// Usage (in apps/api):  node scripts/probe-inventory.mjs <name> [profile-id]
// Without a profile id the selected profile is used. The key is read from apps/api/.dev.vars (git-ignored) and never printed.
import { readFileSync } from 'node:fs';
import { mojangUuid, hypixelProfiles } from '../src/upstream.js';

const [name, profileId] = process.argv.slice(2);
if (!name) {
  console.error('usage: node scripts/probe-inventory.mjs <name> [profile-id]');
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
const inv = p && p.members && p.members[uuid] && p.members[uuid].inventory;
if (!inv) {
  console.log('no inventory object for this member (API setting off, or wrong profile)');
  process.exit(0);
}

const kind = (v) => (Array.isArray(v) ? `array[${v.length}]` : v === null ? 'null' : typeof v);
console.log('members.<uuid>.inventory keys:');
for (const k of Object.keys(inv)) {
  const v = inv[k];
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const sub = Object.keys(v);
    // Long maps (e.g. sacks_counts, one key per item) only get a count.
    console.log(`  ${k}: object, ${sub.length} keys` + (sub.length <= 30 ? ` -> ${sub.map((s) => `${s}:${kind(v[s])}`).join(', ')}` : ''));
  } else {
    console.log(`  ${k}: ${kind(v)}`);
  }
}
const other = Object.keys(p.members[uuid]).filter((k) => /ward|equip/i.test(k));
console.log('other top-level member keys matching ward|equip:', other.length ? other.join(', ') : '(none)');

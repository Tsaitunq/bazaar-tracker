// Shows how an item is built inside the profile NBT. Prints KEY PATHS and value types only. The only value printed is the item id.
// No name, no lore text, no uuid, no number. Usage (in apps/api):  node scripts/probe-items.mjs <name> [profile-id]
// Without a profile id the selected profile is used. The key is read from apps/api/.dev.vars (git-ignored) and never printed.
// Sources: inv_armor, equipment_contents, one armor wardrobe set, one equipment wardrobe set; plus the first DRILL_MAX items whose id contains DRILL
// from inv_contents, the backpacks and the ender chest. Per source the MAX items with the most key paths. A path ends in a type: number | string | array[n] | object | bytes[n].
// Children of enchantments and runes are counted, not listed. Numeric keys print as #, uuid-like keys as <id>.
import { readFileSync } from 'node:fs';
import { mojangUuid, hypixelProfiles } from '../src/upstream.js';
import { decodeInventory } from '../../guide/nbt.js';

const MAX = 4;
const DRILL_MAX = 2;
const COLLAPSE = new Set(['enchantments', 'runes']);

const [name, profileId] = process.argv.slice(2);
if (!name) {
  console.error('usage: node scripts/probe-items.mjs <name> [profile-id]');
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

const seg = (k) => (/^\d+$/.test(k) ? '#' : /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(k) ? '<id>' : k);
const kind = (v) => (Array.isArray(v) ? (v.every((x) => typeof x === 'number') ? `bytes-or-numbers[${v.length}]` : `array[${v.length}]`) : v === null ? 'null' : typeof v);

// every key path of one item with its type; collapsed keys list only how many children they have
function paths(v, path, out, depth) {
  if (depth > 8) return;
  if (Array.isArray(v)) {
    out.set(path, kind(v));
    v.slice(0, 3).forEach((x) => x && typeof x === 'object' && paths(x, `${path}[]`, out, depth + 1));
    return;
  }
  if (!v || typeof v !== 'object') {
    out.set(path, kind(v));
    return;
  }
  const keys = Object.keys(v);
  out.set(path, `object[${keys.length}]`);
  if (COLLAPSE.has(path.split('.').pop())) return;
  for (const k of keys) paths(v[k], `${path}.${seg(k)}`, out, depth + 1);
}

// the id of the item: classic format tag.ExtraAttributes.id, newer format components.custom_data.id
const idOf = (raw) => raw?.tag?.ExtraAttributes?.id ?? raw?.components?.['minecraft:custom_data']?.id ?? raw?.components?.custom_data?.id ?? '(no id found)';

async function show(label, store, only = null, max = MAX) {
  if (!store?.data) {
    console.log(`\n== ${label}: no data`);
    return;
  }
  let slots;
  try {
    slots = await decodeInventory(store.data);
  } catch (e) {
    console.log(`\n== ${label}: could not decode (${e.constructor.name})`);
    return;
  }
  const used = slots.filter((s) => s && Object.keys(s).length && (!only || only(idOf(s))));
  const rows = used.map((raw) => {
    const out = new Map();
    paths(raw, 'item', out, 0);
    return { id: idOf(raw), out };
  }).sort((a, b) => b.out.size - a.out.size).slice(0, max);
  if (only && !rows.length) return 0; // a search that finds nothing in this inventory prints nothing
  console.log(`\n== ${label}: ${slots.length} slots, ${used.length} used, showing ${rows.length}`);
  for (const r of rows) {
    console.log(`-- ${r.id}`);
    console.log([...r.out].sort(([a], [b]) => a.localeCompare(b)).map(([path, type]) => `   ${path}  ${type}`).join('\n'));
  }
  return rows.length;
}

const inv = member.inventory ?? {};
// a wardrobe set that holds something. The worn set is empty in the wardrobe (what is worn is in inv_armor), so it is skipped.
const setOf = (group) => Object.entries(group ?? {}).find(([n, s]) => /^\d+$/.test(n) && s && typeof s === 'object' && Object.values(s).some((x) => x?.data)) ?? null;
await show('inv_armor', inv.inv_armor);
await show('equipment_contents', inv.equipment_contents);
for (const [group, label] of [['armor', 'wardrobe armor set'], ['equipment', 'wardrobe equipment set']]) {
  const found = setOf(member.loadout?.[group]);
  if (!found) {
    const keys = [...new Set(Object.keys(member.loadout?.[group] ?? {}).map((k) => (/^\d+$/.test(k) ? '#' : k)))];
    console.log(`\n== ${label}: no set with item data (loadout.${group} keys: ${keys.join(', ') || 'none'})`);
    continue;
  }
  for (const [slot, store] of Object.entries(found[1]).filter(([, s]) => s?.data).slice(0, 2)) await show(`${label} #${found[0]} ${slot}`, store);
}

// drills: the first DRILL_MAX items whose id contains DRILL, looked for in the inventory, the backpacks and the ender chest
let drills = 0;
const backpacks = Object.entries(inv.backpack_contents ?? {}).map(([n, s]) => [`backpack ${Number(n) + 1}`, s]);
for (const [label, store] of [['inv_contents', inv.inv_contents], ['ender_chest_contents', inv.ender_chest_contents], ...backpacks]) {
  if (drills >= DRILL_MAX) break;
  drills += (await show(`${label} (drills)`, store, (id) => String(id).includes('DRILL'), DRILL_MAX - drills)) ?? 0;
}
if (!drills) console.log('\n== drills: none found');

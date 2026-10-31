// shortcut: temporary for the field check, removed in Task 6. Prints the structure of a test copy, never its values.
// node scripts/check-fixture.mjs personal/fixtures/profile.json
import fs from 'node:fs';
import { decodeInventory } from '../nbt.js';

const STATS = ['Damage', 'Strength', 'Crit Chance', 'Crit Damage', 'Attack Speed', 'Health', 'Defense', 'True Defense', 'Ferocity', 'Magic Find', 'Mining Speed', 'Mining Fortune', 'Pristine', 'Gemstone Fortune', 'Ore Fortune', 'Block Fortune'];
const lines = [];
const print = (s) => lines.push(s);
const type = (v) => (Array.isArray(v) ? `array(${v.length})` : v === null ? 'null' : typeof v);
const shape = (o) => Object.entries(o ?? {}).map(([k, v]) => `${k}:${type(v)}`).join(' ');
// inventories can be keyed by the player's own stuff, so a key only passes in a plain shape
const safeKey = (k) => (/^[a-zA-Z_][a-zA-Z0-9_]{0,40}$/.test(k) ? k : '?');
const clean = (s) => s.replace(/§./g, '');

const profile = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const member = profile.members?.self;
if (!member) throw new Error('No members.self: not an anonymized copy.');

print(`profile: ${shape(profile)}`);
print(`member: ${shape(member)}`);
print(`inventory: ${shape(member.inventory)}`);
print(`bag_contents: ${shape(member.inventory?.bag_contents)}`);
print(`accessory_bag_storage: ${shape(member.accessory_bag_storage)}`);
print(`pet sample: ${shape(member.pets_data?.pets?.[0])} count=${member.pets_data?.pets?.length}`);
print(`skill_tree: ${shape(member.skill_tree)}`);
print(`skill_tree.nodes: ${shape(member.skill_tree?.nodes)}`);
print(`skill_tree.nodes.mining keys: ${Object.keys(member.skill_tree?.nodes?.mining ?? {}).map(safeKey).slice(0, 40).join(' ')}`);
print(`skill_tree.experience: ${shape(member.skill_tree?.experience)}`);
print(`mining_core: ${shape(member.mining_core)}`);
print(`collection: ${type(member.collection)} entries=${Object.keys(member.collection ?? {}).length}`);
print(`experience: ${Object.keys(member.player_data?.experience ?? {}).map(safeKey).join(' ')}`);
print(`slayer_bosses: ${Object.keys(member.slayer?.slayer_bosses ?? {}).map(safeKey).join(' ')}`);
print(`nether_island_player_data: ${Object.keys(member.nether_island_player_data ?? {}).map(safeKey).join(' ')}`);

const inv = member.inventory ?? {};
const stores = {
  inv_armor: inv.inv_armor, equipment_contents: inv.equipment_contents, inv_contents: inv.inv_contents, ender_chest_contents: inv.ender_chest_contents,
  wardrobe_contents: inv.wardrobe_contents, talisman_bag: inv.bag_contents?.talisman_bag,
  ...Object.fromEntries(Object.entries(inv.backpack_contents ?? {}).map(([k, v]) => [`backpack_${safeKey(k)}`, v])),
};
const attrs = new Set();
const gemKeys = new Set();
const loreForms = new Set();
for (const [name, store] of Object.entries(stores)) {
  if (!store?.data) {
    print(`${name}: MISSING`);
    continue;
  }
  try {
    const slots = await decodeInventory(store.data);
    const filled = slots.filter((s) => s.tag);
    print(`${name}: slots=${slots.length} filled=${filled.length} emptyForm=${slots.find((s) => !s.tag) ? shape(slots.find((s) => !s.tag)) || '{}' : 'n/a'}`);
    for (const slot of filled) {
      const extra = slot.tag.ExtraAttributes ?? {};
      for (const k of Object.keys(extra)) attrs.add(`${safeKey(k)}:${type(extra[k])}`);
      for (const k of Object.keys(extra.gems ?? {})) gemKeys.add(safeKey(k).replace(/\d+/, 'N'));
      for (const line of slot.tag.display?.Lore ?? []) {
        const text = clean(line);
        if (STATS.some((s) => text.startsWith(`${s}:`))) loreForms.add(text.replace(/\d[\d,.]*/g, 'N'));
      }
    }
  } catch {
    print(`${name}: UNREADABLE`);
  }
}
print(`ExtraAttributes: ${[...attrs].sort().join(' ')}`);
print(`gems keys: ${[...gemKeys].sort().join(' ')}`);
print(`lore forms:\n  ${[...loreForms].sort().join('\n  ')}`);

const out = lines.join('\n');
if (/[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}/i.test(out)) throw new Error('The output would contain a UUID. Nothing printed.');
console.log(out);

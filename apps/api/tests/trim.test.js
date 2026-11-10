import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { trimList, trimProfile } from '../src/trim.js';

const profile = JSON.parse(readFileSync(new URL('./fixtures/profile.anon.json', import.meta.url), 'utf8'));
const UUID = '00000000000040008000000000000001';
const clone = (o) => JSON.parse(JSON.stringify(o));

test('list keeps id, cute_name, game_mode, selected only', () => {
  const l = trimList([{ ...profile, extra: 1 }, { profile_id: 'x', cute_name: 'Y', selected: false }]);
  assert.deepEqual(l[0], { id: profile.profile_id, cute_name: 'Apple', game_mode: 'ironman', selected: true });
  assert.equal(JSON.stringify(l[1]), '{"id":"x","cute_name":"Y","selected":false}');
  assert.deepEqual(trimList(null), []);
});

test('trim: every guide section is present', () => {
  const t = trimProfile(profile, UUID);
  assert.equal(t.profileId, profile.profile_id);
  assert.ok(t.hotm.nodes && t.hotm.experience !== undefined && t.hotm.powder);
  assert.ok(Object.keys(t.essencePerks).length);
  assert.equal(t.pets.length, 3);
  assert.deepEqual(Object.keys(t.pets[0]).sort(), ['active', 'exp', 'heldItem', 'tier', 'type']);
  assert.equal(t.pets[0].active, true);
  assert.ok(Object.keys(t.skills).every((k) => k.startsWith('SKILL_')));
  assert.ok(Object.values(t.slayer).every((x) => typeof x === 'number'));
  assert.deepEqual(Object.keys(t.fairySouls), ['collected', 'unspent', 'exchanges']);
  assert.deepEqual(Object.keys(t.accessoryBag), ['selectedPower', 'tuning', 'highestMagicalPower']);
  assert.ok(Object.keys(t.attributes.stacks).length);
  assert.deepEqual(t.attributes.huntingBox, [{ type: 'DUMMY', amount_owned: 1 }]);
  assert.equal(t.attributes.owned, undefined);
});

test('trim: inventory fields stay raw base64', () => {
  const t = trimProfile(profile, UUID);
  const m = profile.members[UUID];
  const inv = m.inventory;
  assert.equal(t.inventories.inventory, inv.inv_contents.data);
  assert.equal(t.inventories.armor, inv.inv_armor.data);
  assert.equal(t.inventories.equipment, inv.equipment_contents.data);
  assert.equal(t.inventories.accessoryBag, inv.bag_contents.talisman_bag.data);
  assert.equal(t.inventories.enderChest, inv.ender_chest_contents.data);
  assert.equal(t.inventories.personalVault, inv.personal_vault_contents.data);
  assert.deepEqual(t.inventories.storage, { 0: inv.backpack_contents[0].data, 1: inv.backpack_contents[1].data });
  assert.deepEqual(t.missing, []);
});

test('trim: wardrobe from loadout.armor, parts left out when absent', () => {
  const { wardrobe } = trimProfile(profile, UUID).inventories;
  const a = profile.members[UUID].loadout.armor;
  assert.equal(wardrobe.equipped, 0);
  assert.deepEqual(wardrobe.sets[0], { helmet: a[0].HELMET.data, chestplate: a[0].CHESTPLATE.data, leggings: a[0].LEGGINGS.data, boots: a[0].BOOTS.data });
  assert.deepEqual(wardrobe.sets[1], { helmet: a[1].HELMET.data });
  assert.deepEqual(Object.keys(wardrobe.sets), ['0', '1']);
});

test('trim: equipment wardrobe, loadouts, farming toolkit', () => {
  const t = trimProfile(profile, UUID);
  const m = profile.members[UUID];
  const e = m.loadout.equipment[0];
  assert.deepEqual(t.inventories.equipmentWardrobe, { equipped: 0, sets: { 0: { slot1: e.EQUIPMENT_SLOT_1.data, slot2: e.EQUIPMENT_SLOT_2.data, slot3: e.EQUIPMENT_SLOT_3.data, slot4: e.EQUIPMENT_SLOT_4.data } } });
  assert.deepEqual(t.loadouts, [{ id: '0', armorSet: 0, equipmentSet: 0 }, { id: '1', armorSet: 1, equipmentSet: 0 }]);
  const kit = m.garden_player_data.farming_toolkit;
  assert.deepEqual(t.inventories.farmingToolkit, { WHEAT: [kit.WHEAT[0].data, kit.WHEAT[1].data], CARROT: [kit.CARROT[0].data] });
});

test('trim: rift inventory is not taken', () => {
  assert.ok(!JSON.stringify(trimProfile(profile, UUID)).includes('RIFT_SENTINEL'));
});

test('trim: other members never leak', () => {
  assert.ok(!JSON.stringify(trimProfile(profile, UUID)).includes('OTHER_MEMBER_SENTINEL'));
});

test('trim: not a member -> null', () => {
  assert.equal(trimProfile(profile, 'a'.repeat(32)), null);
});

test('trim: API settings off -> fields left out and listed', () => {
  const p = clone(profile);
  const m = p.members[UUID];
  delete m.inventory;
  delete m.loadout;
  delete m.garden_player_data;
  delete m.pets_data;
  delete m.skill_tree;
  delete m.mining_core;
  const t = trimProfile(p, UUID);
  for (const k of ['pets', 'hotm']) assert.ok(!(k in t) && t.missing.includes(k), k);
  for (const k of ['inventories.inventory', 'inventories.storage', 'inventories.wardrobe', 'inventories.equipmentWardrobe', 'inventories.farmingToolkit', 'inventories.personalVault', 'loadouts']) assert.ok(t.missing.includes(k), k);
  assert.deepEqual(t.inventories, {});
});

test('trim: old mining_core format is read as fallback', () => {
  const p = clone(profile);
  const m = p.members[UUID];
  m.mining_core = { nodes: { mining_speed: 3 }, experience: 7, tokens_spent: 2, selected_pickaxe_ability: 'mining_speed_boost', powder_mithril: 5 };
  delete m.skill_tree;
  const t = trimProfile(p, UUID);
  assert.deepEqual(t.hotm.nodes, { mining_speed: 3 });
  assert.equal(t.hotm.selectedAbility, 'mining_speed_boost');
  assert.equal(t.hotm.powder.mithril.current, 5);
});

test('trim: empty member -> everything missing, no crash', () => {
  const t = trimProfile({ profile_id: 'p', members: { [UUID]: {} } }, UUID);
  assert.ok(t.missing.includes('hotm') && t.missing.includes('attributes') && t.missing.includes('inventories.enderChest'));
});

test('trim: wardrobe with the real shape (equipped_set is a number among sets "1","2","3", parts partly missing)', () => {
  const p = clone(profile);
  const part = (tag) => ({ type: 0, data: 'H4sI' + tag });
  p.members[UUID].loadout.armor = {
    1: { HELMET: part('1h'), CHESTPLATE: part('1c'), LEGGINGS: part('1l'), BOOTS: part('1b') },
    equipped_set: 2,
    2: { CHESTPLATE: part('2c'), BOOTS: part('2b') },
    3: { HELMET: part('3h') },
  };
  const t = trimProfile(p, UUID);
  assert.deepEqual(t.inventories.wardrobe, {
    equipped: 2,
    sets: {
      1: { helmet: 'H4sI1h', chestplate: 'H4sI1c', leggings: 'H4sI1l', boots: 'H4sI1b' },
      2: { chestplate: 'H4sI2c', boots: 'H4sI2b' },
      3: { helmet: 'H4sI3h' },
    },
  });
  assert.deepEqual(t.missing, []);
  assert.ok(!('equipped_set' in t.inventories.wardrobe.sets));
});

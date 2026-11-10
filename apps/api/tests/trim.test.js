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

test('trim: inventory fields stay raw base64, wardrobe missing', () => {
  const t = trimProfile(profile, UUID);
  const inv = profile.members[UUID].inventory;
  assert.equal(t.inventories.inventory, inv.inv_contents.data);
  assert.equal(t.inventories.armor, inv.inv_armor.data);
  assert.equal(t.inventories.equipment, inv.equipment_contents.data);
  assert.equal(t.inventories.accessoryBag, inv.bag_contents.talisman_bag.data);
  assert.equal(t.inventories.enderChest, inv.ender_chest_contents.data);
  assert.deepEqual(t.inventories.storage, { 0: inv.backpack_contents[0].data, 1: inv.backpack_contents[1].data });
  assert.equal(t.inventories.wardrobe, undefined);
  assert.deepEqual(t.missing, ['inventories.wardrobe']);
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
  delete m.pets_data;
  delete m.skill_tree;
  delete m.mining_core;
  const t = trimProfile(p, UUID);
  for (const k of ['pets', 'hotm']) assert.ok(!(k in t) && t.missing.includes(k), k);
  assert.ok(t.missing.includes('inventories.inventory') && t.missing.includes('inventories.storage'));
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

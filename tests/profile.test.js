import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLore, readItem, summarize } from '../profile.js';
import { encodeInventory, gzipBase64, encodeNbt, tag } from './fixtures/nbt-encode.js';

const slot = (id, extra = {}, lore = []) => ({ id: 1, Count: 1, tag: { ExtraAttributes: { id, ...extra }, display: { Lore: lore } } });
const store = (...slots) => ({ type: 0, data: encodeInventory(slots) });

test('parseLore takes the first number and strips colours', () => {
  assert.deepEqual(parseLore(['§7Mining Speed: §a+1,234 §9(+20)', '§7Pristine: §a+2.5', '§7Unrelated text', '§7Crit Damage: §c+60% §9(+20%) §9(+5%)', '§7Attack Speed: §a+10%', '§7Health: §c-5']), { MINING_SPEED: 1234, PRISTINE: 2.5, CRITICAL_DAMAGE: 60, ATTACK_SPEED: 10, HEALTH: -5 });
});

test('parseLore ignores lines without a stat name or a number', () => {
  assert.deepEqual(parseLore(['constructor: +1', 'toString: +2', 'Damage: +,', 'Strength: none', 'Health: +5']), { HEALTH: 5 });
});

test('readItem finds reforge, enchants, gems, recomb, stars and parts', () => {
  const item = readItem(slot('DIVAN_DRILL', {
    modifier: 'jaded', enchantments: { fortune: 4 }, rarity_upgrades: 1, upgrade_level: 5, drill_part_engine: 'amber_polished_drill_engine',
    gems: { JADE_0: 'FINE', AMBER_0: { uuid: 'item-uuid', quality: 'FLAWLESS' }, COMBAT_0: 'PERFECT', COMBAT_0_gem: 'OPAL', CHISEL_1: { uuid: 'x', quality: 'FINE' }, CHISEL_1_gem: 'RUBY', unlocked_slots: ['JADE_0'] },
    uuid: 'item-uuid',
  }, ['§7Mining Speed: §a+1,800']), 'armor');
  assert.deepEqual(item, {
    id: 'DIVAN_DRILL', slot: null, where: 'armor', reforge: 'jaded', enchants: { fortune: 4 },
    gems: [{ slot: 'JADE_0', type: 'JADE', quality: 'FINE' }, { slot: 'AMBER_0', type: 'AMBER', quality: 'FLAWLESS' }, { slot: 'COMBAT_0', type: 'OPAL', quality: 'PERFECT' }, { slot: 'CHISEL_1', type: 'RUBY', quality: 'FINE' }],
    recomb: true, stars: 5, parts: { engine: 'amber_polished_drill_engine' }, lore: { MINING_SPEED: 1800 },
  });
});

test('readItem returns null for an empty slot and keeps no item uuid', () => {
  assert.equal(readItem({}, 'armor'), null);
  assert.equal(readItem({ tag: {} }, 'armor'), null);
  assert.ok(!JSON.stringify(readItem(slot('A', { uuid: 'item-uuid', gems: { JADE_0: { uuid: 'gem-uuid', quality: 'FINE' } } }), 'armor')).includes('uuid'));
});

const member = () => ({
  inventory: {
    inv_armor: store(slot('WORN')), equipment_contents: store(slot('EQUIP')), inv_contents: store({}, slot('INV')), ender_chest_contents: store(slot('ENDER')),
    personal_vault_contents: store(slot('VAULT')), backpack_contents: { 0: store(slot('PACK0')), 7: store(slot('PACK7')) }, bag_contents: { talisman_bag: store(slot('TALI')) },
  },
  loadout: {
    armor: { 1: { id: 1, HELMET: store(slot('SET_HELM')), BOOTS: store({}) }, equipped_set: 1 },
    equipment: { 1: { id: 1, EQUIPMENT_SLOT_1: store(slot('SET_NECK')) }, equipped_set: 1 },
  },
  accessory_bag_storage: { highest_magical_power: 823, selected_power: 'silky', tuning: { slot_0: { strength: 5 } } },
  pets_data: { pets: [{ uuid: 'pet-uuid', uniqueId: 'x', type: 'GOLEM', exp: 5.5, tier: 'LEGENDARY', active: true, heldItem: null, candyUsed: 0, skin: null }] },
  skill_tree: { nodes: { mining: { mining_speed: 10, toggle_mining_speed: true }, foraging: { x: 1 } }, experience: { mining: 99 }, tokens_spent: { mining: 3 } },
  collection: { MITHRIL_ORE: 12 },
  player_data: { experience: { SKILL_MINING: 7 } },
  slayer: { slayer_bosses: { blaze: { xp: 40, boss_kills_tier_0: 2 } } },
  nether_island_player_data: { kuudra_completed_tiers: { none: 1 } },
});

test('summarize reads every storage and marks where', async () => {
  const out = await summarize(member());
  const where = Object.fromEntries(out.items.map((i) => [i.id, i.where]));
  assert.deepEqual(where, { WORN: 'armor', EQUIP: 'equipment', INV: 'inventory', ENDER: 'ender', VAULT: 'vault', PACK0: 'backpack', PACK7: 'backpack', TALI: 'accessory', SET_HELM: 'wardrobe', SET_NECK: 'wardrobe' });
  assert.equal(out.items.find((i) => i.id === 'SET_HELM').slot, 'HELMET');
  assert.equal(out.items.find((i) => i.id === 'SET_NECK').slot, 'EQUIPMENT_SLOT_1');
  assert.deepEqual(out.missing, { inventory: false, collections: false, skills: false });
});

test('summarize reads the other member data and drops what identifies', async () => {
  const out = await summarize(member());
  assert.equal(out.mp, 823);
  assert.equal(out.selectedPower, 'silky');
  assert.deepEqual(out.tuning, { slot_0: { strength: 5 } });
  assert.deepEqual(out.pets, [{ type: 'GOLEM', exp: 5.5, tier: 'LEGENDARY', active: true, heldItem: null }]);
  assert.deepEqual(out.hotm, { experience: 99, nodes: { mining_speed: 10 }, tokens: 3 });
  assert.deepEqual(out.collections, { MITHRIL_ORE: 12 });
  assert.deepEqual(out.skills, { SKILL_MINING: 7 });
  assert.deepEqual(out.slayer, { blaze: 40 });
  assert.deepEqual(out.kuudra, { none: 1 });
  assert.ok(!JSON.stringify(out).includes('uuid'));
});

test('a set that is in the wardrobe and worn counts once', async () => {
  const worn = slot('SAME', { uuid: 'one' });
  const m = member();
  m.inventory.inv_armor = store(worn);
  m.loadout.armor[1].HELMET = store(worn);
  const out = await summarize(m);
  assert.equal(out.items.filter((i) => i.id === 'SAME').length, 1);
  assert.equal(out.items.find((i) => i.id === 'SAME').where, 'armor');
});

test('items without a uuid are never taken for duplicates', async () => {
  const m = member();
  m.inventory.inv_contents = store(slot('STACK'), slot('STACK'));
  assert.equal((await summarize(m)).items.filter((i) => i.id === 'STACK').length, 2);
});

test('missing APIs are reported, not treated as empty', async () => {
  const { inventory, collection, player_data, loadout, ...bare } = member();
  const out = await summarize({ ...bare, player_data: {} });
  assert.deepEqual(out.missing, { inventory: true, collections: true, skills: true });
  assert.equal(out.collections, null);
  assert.equal(out.skills, null);
});

test('inventory turned off keeps the items of the last sync', async () => {
  const previous = await summarize(member());
  const { inventory, ...bare } = member();
  const out = await summarize(bare, previous);
  assert.deepEqual(out.items, previous.items);
  assert.equal(out.missing.inventory, true);
});

test('one broken inventory does not lose the others', async () => {
  const m = member();
  m.inventory.backpack_contents[0] = { data: 'bm90Z3ppcA==' };
  const out = await summarize(m);
  assert.ok(out.items.some((i) => i.id === 'PACK7'));
  assert.ok(!out.items.some((i) => i.id === 'PACK0'));
  assert.equal(out.skipped, 1);
});

test('one broken item does not lose the others', async () => {
  const m = member();
  m.inventory.inv_contents = store(slot('BROKEN', {}, { not: 'a list' }), slot('FINE'));
  const out = await summarize(m);
  assert.ok(out.items.some((i) => i.id === 'FINE'));
  assert.ok(!out.items.some((i) => i.id === 'BROKEN'));
  assert.equal(out.skipped, 1);
  assert.equal((await summarize(member())).skipped, 0);
});

test('nothing readable at all rejects', async () => {
  await assert.rejects(summarize({ inventory: { inv_armor: { data: 'bm90Z3ppcA==' } } }));
  // an inventory without slots is readable, just empty
  assert.deepEqual((await summarize({ inventory: { inv_armor: { data: gzipBase64(encodeNbt({ i: tag.list([]) })) } } })).items, []);
});

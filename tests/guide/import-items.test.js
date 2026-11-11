import test from 'node:test';
import assert from 'node:assert/strict';
import { readItem, readGems, readItems, sourcesOf } from '../../apps/guide/import/items.js';
import { encodeInventory } from '../fixtures/guide/nbt-encode.js';

const item = (extra, id = 'DIVAN_DRILL') => ({ id: 278, Count: 1, tag: { ExtraAttributes: { id, uuid: `u-${id}`, ...extra }, display: { Name: 'x', Lore: ['§7Mining Speed: §a+1'] } } });

test('gems: object form, text form, typed slots and the open slots', () => {
  const { gems, unlocked } = readGems({
    AMBER_0: { quality: 'PERFECT', uuid: 'x' }, JADE_0: 'FLAWLESS',
    MINING_0: { quality: 'perfect', uuid: 'y' }, MINING_0_gem: 'TOPAZ', unlocked_slots: ['AMBER_0', 'JADE_0', 'MINING_0', 'AMBER_1'],
  });
  assert.deepEqual(gems, [
    { slot: 'AMBER_0', type: 'AMBER', quality: 'PERFECT' },
    { slot: 'JADE_0', type: 'JADE', quality: 'FLAWLESS' },
    { slot: 'MINING_0', type: 'TOPAZ', quality: 'PERFECT' },
  ]);
  assert.deepEqual(unlocked, ['AMBER_0', 'JADE_0', 'MINING_0', 'AMBER_1']); // AMBER_1 is open and empty
  assert.deepEqual(readGems(undefined), { gems: [], unlocked: [] });
});

test('readItem takes the fields detect asks for and nothing else', () => {
  const got = readItem(item({
    modifier: 'jaded', enchantments: { fortune: 4, ultimate_wise: 'x' }, rarity_upgrades: 1, hot_potato_count: 13, upgrade_level: 4,
    polarvoid: 5, divan_powder_coating: 1, ability_scroll: ['IMPLOSION_SCROLL'], power_ability_scroll: 'X', donated_museum: 1, timestamp: 'now',
  }), 'Inventar');
  assert.deepEqual(got, {
    id: 'DIVAN_DRILL', reforge: 'jaded', enchants: { fortune: 4 }, gems: [], unlocked: [], recomb: true, upgradedRarity: null,
    hpb: 10, fuming: 3, stars: 4, parts: {}, polarvoid: 5, coating: true, enrichment: null, scrolls: ['IMPLOSION_SCROLL', 'X'], at: ['Inventar'], tip: { MINING_SPEED: 1 }, uuid: 'u-DIVAN_DRILL',
  });
  assert.equal(JSON.stringify(got).includes('Lore'), false);
});

test('upgraded_rarity is its own field and not a recombobulator', () => {
  const belt = readItem(item({ upgraded_rarity: 'MYTHIC' }, 'SAFARI_BELT'), 'Getragen');
  assert.equal(belt.upgradedRarity, 'MYTHIC');
  assert.equal(belt.recomb, false);
  assert.equal(readItem(item({ rarity_upgrades: 0 }), 'x').recomb, false);
});

test('an accessory enrichment is kept as the stat name', () => {
  assert.equal(readItem(item({ talisman_enrichment: 'sea_creature_chance' }, 'ARTIFACT_X'), 'Accessory Bag').enrichment, 'sea_creature_chance');
  assert.equal(readItem(item({}, 'ARTIFACT_X'), 'Accessory Bag').enrichment, null);
});

test('drill parts: the text form and the compound form', () => {
  assert.deepEqual(readItem(item({ drill_part_engine: 'AMBER_POLISHED_DRILL_ENGINE', drill_part_fuel_tank: 'PERFECTLY_CUT_FUEL_TANK' }), 'x').parts, { engine: 'AMBER_POLISHED_DRILL_ENGINE', fuel_tank: 'PERFECTLY_CUT_FUEL_TANK' });
  assert.deepEqual(readItem(item({ engine: { id: 'E1' }, fuel_tank: { id: 'T1' }, upgrade_module: { id: 'GOBLIN_OMELETTE' } }), 'x').parts, { engine: 'E1', fuel_tank: 'T1', upgrade_module: 'GOBLIN_OMELETTE' });
  assert.deepEqual(readItem(item({ drill_part_upgrade_module: 'GOBLIN_OMELETTE' }), 'x').parts, { upgrade_module: 'GOBLIN_OMELETTE' });
});

test('an empty slot or an item without an id reads as nothing', () => {
  assert.equal(readItem({}, 'x'), null);
  assert.equal(readItem({ id: 1, tag: { ExtraAttributes: {} } }, 'x'), null);
});

test('sources: worn, wardrobe, backpacks and the farming toolkit carry their place', () => {
  const inv = {
    armor: 'a', equipment: 'e', inventory: 'i', enderChest: 'c', accessoryBag: 'b', personalVault: 'v',
    wardrobe: { equipped: 2, sets: { 0: { helmet: 'w0' }, 1: { boots: 'w1' } } },
    equipmentWardrobe: { equipped: 0, sets: { 1: { slot1: 'q1' } } },
    storage: { 0: 's0', 4: 's4' }, farmingToolkit: { WHEAT: ['f1'] },
  };
  const at = Object.fromEntries(sourcesOf(inv).map((s) => [s.data, s.at]));
  assert.deepEqual(at.a, ['Getragen', 'Wardrobe Set 3']); // a set 0 exists: the game counts from 1
  assert.deepEqual(at.e, ['Getragen', 'Equipment-Set 1']);
  assert.deepEqual(at.w0, ['Wardrobe Set 1']);
  assert.deepEqual(at.w1, ['Wardrobe Set 2']);
  assert.deepEqual(at.q1, ['Equipment-Set 2']);
  assert.deepEqual(at.s0, ['Backpack 1']);
  assert.deepEqual(at.s4, ['Backpack 5']);
  assert.deepEqual(at.f1, ['Farming-Toolkit WHEAT']);
  assert.deepEqual(at.c, ['Ender Chest']);
  assert.deepEqual(at.v, ['Personal Vault']);
  assert.deepEqual(at.b, ['Accessory Bag']);
});

test('readItems reads every place, joins one item found twice and drops the uuid', async () => {
  const worn = encodeInventory([item({}, 'DIVAN_HELMET')]);
  const inv = {
    armor: worn,
    wardrobe: { equipped: 1, sets: { 2: { helmet: worn, chestplate: encodeInventory([item({ modifier: 'jaded' }, 'DIVAN_CHESTPLATE')]) } } },
    storage: { 4: encodeInventory([item({ polarvoid: 3 }, 'JASPER_DRILL_X')]) },
    equipment: encodeInventory([item({}, 'TITANIUM_NECKLACE')]),
  };
  const { items, skipped } = await readItems(inv);
  assert.equal(skipped, 0);
  assert.deepEqual(items.map((i) => i.id).sort(), ['DIVAN_CHESTPLATE', 'DIVAN_HELMET', 'JASPER_DRILL_X', 'TITANIUM_NECKLACE']);
  const helmet = items.find((i) => i.id === 'DIVAN_HELMET');
  assert.deepEqual(helmet.at, ['Getragen', 'Wardrobe Set 1', 'Wardrobe Set 2']);
  assert.deepEqual(items.find((i) => i.id === 'JASPER_DRILL_X').at, ['Backpack 5']);
  assert.ok(items.every((i) => !('uuid' in i)));
});

test('a broken inventory costs only itself; nothing readable rejects', async () => {
  const good = encodeInventory([item({}, 'DIVAN_HELMET')]);
  const { items, skipped } = await readItems({ armor: good, inventory: 'bm90Z3ppcA==' });
  assert.equal(items.length, 1);
  assert.equal(skipped, 1);
  await assert.rejects(readItems({ armor: 'bm90Z3ppcA==', inventory: '%%%' }), /No inventory could be read/);
  assert.deepEqual(await readItems({}), { items: [], skipped: 0 });
});

test('readItem: modifier "none" is no reforge and enchant names are lower case', () => {
  const got = readItem({ tag: { ExtraAttributes: { id: 'X', modifier: 'none', enchantments: { PROSECUTE: 5, sharpness: 6 } } } }, 'Inventar');
  assert.equal(got.reforge, null);
  assert.deepEqual(got.enchants, { prosecute: 5, sharpness: 6 });
});

test('readTip keeps the stat numbers of a tooltip: the total, names mapped, nothing else', async () => {
  const { readTip } = await import('../../apps/guide/import/items.js');
  assert.deepEqual(readTip(['§7Strength: §c+5 §8(+2)', '§7Crit Damage: §9+1,200%', '§7Gives §c+5 Strength', '§6Ability: Foo']), { STRENGTH: 5, CRITICAL_DAMAGE: 1200 });
  assert.deepEqual(readTip(['§7§c+1 Health§7.', '§7Current Bonus: §c+10 Health']), { HEALTH: 10 }); // the game puts an icon glyph after the number
  assert.deepEqual(readTip(undefined), {});
});

test('an item keeps its tip wherever it was found', async () => {
  const { readItem } = await import('../../apps/guide/import/items.js');
  const raw = { id: 1, tag: { ExtraAttributes: { id: 'X' }, display: { Lore: ['§7Health: §a+10'] } } };
  assert.deepEqual(readItem(raw, 'Accessory Bag').tip, { HEALTH: 10 });
  assert.deepEqual(readItem(raw, 'Inventar').tip, { HEALTH: 10 });
  assert.equal('tip' in readItem({ id: 1, tag: { ExtraAttributes: { id: 'X' }, display: { Lore: ['§7plain'] } } }, 'Inventar'), false);
});

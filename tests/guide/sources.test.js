import test from 'node:test';
import assert from 'node:assert/strict';
import { sourcesOf, buffsOf, levelFor, unsafeLines } from '../../apps/guide/sources.js';
import { gamedata } from '../fixtures/guide-world.js';

const ss = gamedata.statSources;
const items = {
  RING_A: { category: 'ACCESSORY', stats: { STRENGTH: 5, HEALTH: 10 }, family: 'RING' },
  RING_B: { category: 'ACCESSORY', stats: { STRENGTH: 8, HEALTH: 10 }, family: 'RING' },
  CHARM: { category: 'ACCESSORY', stats: { speed: 2 } },
  PLAIN: { category: 'ACCESSORY' },
};
const bag = (id, extra = {}) => ({ id, at: ['Accessory Bag'], enrichment: null, ...extra });
const run = (profile, more = {}) => sourcesOf({ profile: { skills: null, slayer: null, skyblockXp: null, items: [], ...profile }, ss, items, ...more });

test('level from XP: the first level above each cumulative total', () => {
  assert.equal(levelFor(ss.skills.mining.xpTotal, 49), 0);
  assert.equal(levelFor(ss.skills.mining.xpTotal, 50), 1);
  assert.equal(levelFor(ss.skills.mining.xpTotal, 3022425), 25);
  assert.equal(levelFor(ss.skills.mining.xpTotal, 1e12), 60);
});

test('skills: stats per level from the table; a skill the import lacks adds nothing', () => {
  const r = run({ skills: { SKILL_MINING: 3022425 } });
  assert.equal(r.levels.skills.mining.level, 25);
  assert.equal(r.add.MINING_FORTUNE, 25 * 4);
  assert.equal(r.add.DEFENSE, 14 * 1 + 11 * 2);
  assert.equal(r.levels.skills.combat, undefined);
  assert.ok(!r.off.some((t) => /Skills API/.test(t)));
});

test('skills off: nothing counted and it is said', () => {
  const r = run({});
  assert.deepEqual(r.add, {});
  assert.ok(r.off.some((t) => /Skills API is off/.test(t)));
  assert.ok(r.off.some((t) => /slayer/.test(t)));
  assert.ok(r.off.some((t) => /SkyBlock level/.test(t)));
});

test('slayer: cumulative XP gives the level, stats add up per level', () => {
  const r = run({ slayer: { zombie: 1000, blaze: 400000, spider: 0 } });
  assert.equal(r.levels.slayers.zombie.level, 4);
  assert.equal(r.levels.slayers.blaze.level, 8);
  assert.equal(r.levels.slayers.spider.level, 0);
  // blaze: HEALTH 3,0,4,0,5,0,6,0 / STRENGTH 0,1,0,0,0,2,0,0 / TRUE_DEFENSE 0,0,0,1,0,0,0,2
  assert.equal(r.add.STRENGTH, 3);
  assert.equal(r.add.TRUE_DEFENSE, 3);
  const unsafe = unsafeLines(r.contrib, 'STRENGTH');
  assert.ok(unsafe.some((l) => /Blaze slayer 8/.test(l.text)));
});

test('SkyBlock level: 100 XP a level, health per level, strength every 5 levels, capped', () => {
  const r = run({ skyblockXp: 12345 });
  assert.equal(r.levels.skyblock.level, 123);
  assert.equal(r.add.HEALTH, 123 * 5);
  assert.equal(r.add.STRENGTH, 24);
  assert.equal(run({ skyblockXp: 1e9 }).levels.skyblock.level, ss.skyblockLevel.maxLevel.value);
  assert.equal(run({ skyblockXp: 99 }).levels.skyblock.level, 0);
});

test('accessories: one per family (the larger), keys normalised, no stats listed as unknown', () => {
  const r = run({ items: [bag('RING_A'), bag('RING_B'), bag('CHARM'), bag('PLAIN'), { id: 'RING_A', at: ['Inventar'] }] });
  assert.equal(r.add.STRENGTH, 8);
  assert.equal(r.add.HEALTH, 10);
  assert.equal(r.add.SPEED, 2);
  assert.deepEqual(r.unknown.accessories, ['PLAIN']);
});

test('accessories: an item that is not in the bag is not counted; a reforge adds nothing', () => {
  const r = run({ items: [{ id: 'RING_B', at: ['Ender Chest'], reforge: 'bizarre' }, bag('CHARM', { reforge: 'itchy' })] });
  assert.equal(r.add.STRENGTH, undefined);
  assert.equal(r.add.SPEED, 2);
});

test('enrichment: the value from stat-sources, unsafe; an unknown one is listed', () => {
  const r = run({ items: [bag('RING_A', { enrichment: 'intelligence' }), bag('CHARM', { enrichment: 'made_up_stat' })] });
  assert.equal(r.add.INTELLIGENCE, ss.accessories.enrichments.values.INTELLIGENCE.value);
  assert.equal(r.contrib.INTELLIGENCE[0].unsafe, true);
  assert.deepEqual(r.unknown.enrichments, ['made_up_stat']);
});

test('no item data: accessories are not counted and it is said', () => {
  const r = sourcesOf({ profile: { skills: null, slayer: null, items: [bag('RING_A')] }, ss, items: null });
  assert.equal(r.add.STRENGTH, undefined);
  assert.ok(r.off.some((t) => /Item data missing/.test(t)));
});

test('base stats: all of them, the three older ones safe, the rest unsafe', () => {
  const r = run({});
  assert.equal(r.base.SWING_RANGE, 3);
  assert.equal(r.base.HEALTH, 100);
  const flag = (stat) => r.contrib[stat].find((c) => c.part === 'base').unsafe;
  assert.equal(flag('HEALTH'), false);
  assert.equal(flag('SPEED'), true);
});

test('buffs: values of stat-sources, only what is switched on, unsafe marked', () => {
  assert.deepEqual(buffsOf({}, ss).add, {});
  const god = buffsOf({ godPotion: true }, ss);
  assert.equal(god.add.CRITICAL_DAMAGE, 80);
  assert.equal(god.contrib.STRENGTH[0].unsafe, true);
  assert.equal(god.contrib.CRITICAL_DAMAGE[0].unsafe, false);
  const cookie = buffsOf({ boosterCookie: true }, ss);
  assert.equal(cookie.add.MAGIC_FIND, 15);
  const r = run({}, { buffs: { godPotion: true, boosterCookie: true } });
  assert.equal(r.buffs.MAGIC_FIND, ss.godPotion.stats.MAGIC_FIND.value + 15);
  assert.ok(r.contrib.MAGIC_FIND.filter((c) => c.part === 'godPotion' || c.part === 'cookie').length === 2);
});

test('a series that is unsafe makes the level-based contribution unsafe, a safe one does not', () => {
  const r = run({ skills: { SKILL_MINING: 3022425, SKILL_FARMING: 3022425 } });
  const defense = r.contrib.DEFENSE.find((c) => c.part === 'skills');
  assert.equal(defense.unsafe, false);
  const fortune = r.contrib.MINING_FORTUNE.find((c) => c.part === 'skills');
  assert.equal(fortune.unsafe, false); // confirmed in the game
  assert.equal(r.contrib.FARMING_FORTUNE.find((c) => c.part === 'skills').unsafe, true);
});

test('the God Potion gives Haste (+200 Mining Speed) and Spelunker (+25 Mining Fortune), both safe', () => {
  const r = run({}, { buffs: { godPotion: true, boosterCookie: false } });
  assert.equal(r.buffs.MINING_SPEED, 200);
  assert.equal(r.buffs.MINING_FORTUNE, 25);
  assert.equal(r.contrib.MINING_SPEED.find((c) => c.part === 'godPotion').unsafe, false);
});

test('collections: one Mining Fortune per tier reached; without the list nothing and a note', () => {
  const r = run({ collTiers: ['GLACITE_1', 'GLACITE_6', 'GLACITE_2', 'OBSIDIAN_5', 'OBSIDIAN_3', 'COAL_9'] });
  assert.equal(r.add.MINING_FORTUNE, 3);
  assert.equal(r.contrib.MINING_FORTUNE.find((c) => c.part === 'collections' && /Glacite/.test(c.label)).value, 2);
  assert.ok(!r.off.some((t) => /Collections/.test(t)));
  const none = run({});
  assert.equal(none.add.MINING_FORTUNE, undefined);
  assert.ok(none.off.some((t) => /Collections: not provided/.test(t)));
});

test('bestiary: one Health per claimed milestone', () => {
  assert.equal(run({ bestiaryMilestone: 179 }).add.HEALTH, 179);
  assert.ok(run({}).off.some((t) => /Bestiary: not provided/.test(t)));
});

test('consumables: the ticked uses, capped at the maximum; Ore Oats x5 give 10 Mining Fortune', () => {
  assert.equal(run({}, { consumables: { ore_oats: 5 } }).add.MINING_FORTUNE, 10);
  assert.equal(run({}, { consumables: { ore_oats: 99 } }).add.MINING_FORTUNE, 10);
  assert.equal(run({}, { consumables: { ore_oats: 2, unknown_item: 3 } }).add.MINING_FORTUNE, 4);
  assert.equal(run({}).add.MINING_FORTUNE, undefined);
});

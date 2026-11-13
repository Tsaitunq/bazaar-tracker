import test from 'node:test';
import assert from 'node:assert/strict';
import { statDetail, buildOf, statsModel } from '../../apps/guide/stats-model.js';
import { attrLevel } from '../../apps/guide/import/profile.js';
import { gamedata, emptyBuild } from '../fixtures/guide-world.js';

const world = (build, over = {}) => ({ guides: [], checks: {}, owned: [], build, base: {}, draft: {}, gamedata, items: {}, now: 2e12, profile: null, audit: {}, ...over });
const group = (d, title) => d.groups.find((g) => g.title === title);
const hotm = (levels, over = {}) => ({ tier: 8, levels, omelette: false, disabled: [], ability: null, ...over });

// --- HOTM: one line per perk, conditional ones grey and outside the sum
test('HOTM: a line per perk; a perk that only holds in a condition is grey and not in the sum', () => {
  const d = statDetail(world({ ...emptyBuild(), hotm: hotm({ mining_speed: 43, speedy_mineman: 35, professional: 51 }) }), 'mining', 'MINING_SPEED');
  const g = group(d, 'HOTM');
  assert.equal(g.sum, 2260);
  assert.deepEqual(g.lines.filter((l) => !l.inactive).map((l) => [l.label, l.value]), [['Mining Speed 43', 860], ['Speedy Mineman 35', 1400]]);
  const grey = g.lines.find((l) => l.inactive && /Professional/.test(l.label));
  assert.ok(grey, 'Professional is listed');
  assert.equal(grey.value, 0);
  assert.match(grey.note, /conditional \(not active\)/);
});

test('HOTM: the Goblin Omelette adds a level to Speedy Mineman and Mining Speed: +60, grey while it is off, counted when it is on', () => {
  const levels = { mining_speed: 43, speedy_mineman: 35 };
  const off = group(statDetail(world({ ...emptyBuild(), hotm: hotm(levels) }), 'mining', 'MINING_SPEED'), 'HOTM');
  assert.equal(off.sum, 2260);
  const grey = off.lines.filter((l) => l.inactive && /Omelette/.test(l.label));
  assert.deepEqual(grey.map((l) => l.text).sort(), ['+20', '+40']);
  const on = group(statDetail(world({ ...emptyBuild(), hotm: hotm(levels, { omelette: true }) }), 'mining', 'MINING_SPEED'), 'HOTM');
  assert.equal(on.sum, 2320);
  assert.equal(on.lines.filter((l) => /Omelette/.test(l.label) && !l.inactive).reduce((n, l) => n + l.value, 0), 60);
});

test('HOTM: a perk switched off, and an ability that is not selected, is grey and not counted', () => {
  const d = statDetail(world({ ...emptyBuild(), hotm: hotm({ mining_speed: 43, speedy_mineman: 35 }, { disabled: ['speedy_mineman'] }) }), 'mining', 'MINING_SPEED');
  const g = group(d, 'HOTM');
  assert.equal(g.sum, 860);
  assert.match(g.lines.find((l) => /Speedy Mineman/.test(l.label)).note, /switched off/);
});

// --- attributes: the level comes from the shards of the table of the rarity
test('every attribute: the level is the highest one whose cumulative shards are paid', () => {
  for (const a of gamedata.attributes.attributes) {
    const table = gamedata.attributes.shardsPerLevel[a.rarity];
    let paid = 0;
    for (let level = 1; level <= a.maxLevel; level++) {
      paid += table[level - 1];
      assert.equal(attrLevel(paid, a, gamedata), level, `${a.key} at ${paid} shards`);
      assert.equal(attrLevel(paid - 1, a, gamedata), level - 1, `${a.key} at ${paid - 1} shards`);
    }
    assert.equal(attrLevel(1e9, a, gamedata), a.maxLevel, `${a.key} stops at its maximum`);
  }
});

test('Rotten Pickaxe: 8 shards are level 2 and give 6 Mining Speed, 3 per level', () => {
  const rotten = gamedata.attributes.attributes.find((a) => a.key === 'rotten_pickaxe');
  const level = attrLevel(8, rotten, gamedata);
  assert.equal(level, 2);
  const g = group(statDetail(world({ ...emptyBuild(), attrs: { rotten_pickaxe: level } }), 'mining', 'MINING_SPEED'), 'Attributes');
  assert.equal(g.sum, 6);
  assert.equal(g.lines[0].label, 'Rotten Pickaxe 2');
});

test('attributes: a level in the build that the import does not have is named on the line', () => {
  const profile = { fetchedAt: 1, skills: null, slayer: null, skyblockXp: null, items: [], attrLevels: { rotten_pickaxe: 2 } };
  const g = group(statDetail(world({ ...emptyBuild(), attrs: { rotten_pickaxe: 10 } }, { profile }), 'mining', 'MINING_SPEED'), 'Attributes');
  assert.equal(g.sum, 30); // the build is what counts
  assert.match(g.lines[0].note, /the import says level 2/);
});

// --- the pet: its stats at the level of the build, and the active pet of an import when the build has none
test('a pet of the build gives its stats at its level: 125 at level 100, 123.75 at 99', () => {
  const at = (level) => group(statDetail(world({ ...emptyBuild(), pet: { id: 'GLACITE_GOLEM', rarity: 'LEGENDARY', level } }, { items: { X: { category: 'ACCESSORY', stats: {} } } }), 'mining', 'MINING_SPEED'), 'Pet')?.sum;
  assert.equal(at(100), 125);
  assert.equal(at(99), 123.75);
});

test('without a pet in the build the active pet of the import counts, at the level of its experience', () => {
  const profile = { fetchedAt: 1, skills: null, slayer: null, skyblockXp: null, items: [], pets: [{ type: 'GLACITE_GOLEM', tier: 'LEGENDARY', exp: 1e12, heldItem: null, active: true }, { type: 'BAL', tier: 'LEGENDARY', exp: 0, heldItem: null, active: false }] };
  const w = world(emptyBuild(), { profile });
  assert.equal(buildOf(w).pet.id, 'GLACITE_GOLEM');
  assert.equal(buildOf(w).pet.level, 100);
  assert.equal(group(statDetail(w, 'mining', 'MINING_SPEED'), 'Pet').sum, 125);
  assert.equal(statsModel(w, 'mining').pet.chosen.id, 'GLACITE_GOLEM');
  // a pet picked in the build wins; a pet the data does not know changes nothing
  assert.equal(buildOf(world({ ...emptyBuild(), pet: { id: 'BAL', rarity: 'LEGENDARY', level: 100 } }, { profile })).pet.id, 'BAL');
  assert.equal(buildOf(world(emptyBuild(), { profile: { ...profile, pets: [{ type: 'NOT_A_PET', tier: 'LEGENDARY', exp: 5, active: true }] } })).pet, null);
});

// --- accessories: a line per item, named
test('Accessory Bag lines carry the item names, not "Accessories"', () => {
  const items = { RING: { name: 'Test Ring', category: 'ACCESSORY', stats: { HEALTH: 10 } }, CHARM: { name: 'Test Charm', category: 'ACCESSORY', stats: { HEALTH: 5 } } };
  const profile = { fetchedAt: 1, skills: null, slayer: null, skyblockXp: null, items: [{ id: 'RING', at: ['Accessory Bag'] }, { id: 'CHARM', at: ['Accessory Bag'], enrichment: null }] };
  const g = group(statDetail(world(emptyBuild(), { items, profile }), 'blaze', 'HEALTH'), 'Accessory Bag');
  assert.deepEqual(g.lines.map((l) => [l.label, l.value]), [['Test Charm', 5], ['Test Ring', 10]].sort((a, b) => g.lines.findIndex((l) => l.label === a[0]) - g.lines.findIndex((l) => l.label === b[0])));
  assert.equal(g.lines.some((l) => l.label === 'Accessories'), false);
});

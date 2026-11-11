import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { summarize, attrLevel, attrLevels, attrStacks } from '../../apps/guide/import/profile.js';
import { trimProfile } from '../../apps/api/src/trim.js';
import { encodeInventory } from '../fixtures/guide/nbt-encode.js';
import { gamedata } from '../fixtures/guide-world.js';

const fixture = JSON.parse(readFileSync(new URL('../../apps/api/tests/fixtures/profile.anon.json', import.meta.url), 'utf8'));
const UUID = '00000000000040008000000000000001';
const attr = (key) => gamedata.attributes.attributes.find((a) => a.key === key);
const worker = (inventories) => ({ ...trimProfile(fixture, UUID), inventories });
const piece = (id, extra = {}) => ({ id: 1, Count: 1, tag: { ExtraAttributes: { id, uuid: `u-${id}`, ...extra } } });

test('attribute level from the shards applied, per rarity table', () => {
  // wiki / api-worker.md: rotten_pickaxe 8 is level 2 Common (1, 3, 5 shards), freezing_spread 32 is Epic max
  assert.equal(attrLevel(8, attr('rotten_pickaxe'), gamedata), 2);
  assert.equal(attrLevel(32, attr('freezing_spread'), gamedata), 10);
  assert.equal(attrLevel(0, attr('rotten_pickaxe'), gamedata), 0);
  assert.equal(attrLevel(1, attr('rotten_pickaxe'), gamedata), 1);
  assert.equal(attrLevel(3, attr('rotten_pickaxe'), gamedata), 1); // 1 + 3 = 4 shards for level 2
  assert.equal(attrLevel(4, attr('rotten_pickaxe'), gamedata), 2);
  assert.equal(attrLevel(9999, attr('rotten_pickaxe'), gamedata), 10); // never above the maximum
});

test('attrLevels counts keys the app does not know and leaves level 0 out', () => {
  const got = attrLevels({ rotten_pickaxe: 8, freezing_spread: 0, not_an_attribute: 5, text: 'x' }, gamedata);
  assert.deepEqual(got, { levels: { rotten_pickaxe: 2 }, unknown: 1 });
});

test('summarize: the answer becomes the profile detect reads, with levels for the build', async () => {
  const worn = encodeInventory([piece('DIVAN_HELMET', { modifier: 'jaded' })]);
  const p = await summarize(worker({ armor: worn }), gamedata, 1234);
  assert.equal(p.fetchedAt, 1234);
  assert.equal(p.items[0].id, 'DIVAN_HELMET');
  assert.equal(p.items[0].reforge, 'jaded');
  assert.equal(p.pets.length, 3);
  assert.equal(p.pets[0].type, 'BEE');
  assert.equal(p.attrs.forest_strength, 5); // shards, what the guides' attr steps count
  assert.ok(p.attrLevels.forest_strength >= 1 && p.attrLevels.forest_strength <= 10);
  assert.equal(p.attrUnknown, 0); // visitor_bait is the API name of visitor_speed (the shard id)
  assert.ok(p.attrLevels.visitor_speed >= 1);
  assert.equal(p.hotm.levels.mining_speed, 39);
  assert.equal(p.hotm.levels.toggle_mining_speed, undefined);
  assert.ok(p.hotm.tier >= 1 && p.hotm.tier <= 10);
  assert.equal(p.powers, null); // only the selected power is in the answer
  assert.equal(p.selectedPower, 'scorching');
  assert.ok(p.stone === null || typeof p.stone === 'string'); // mapped by power name, null for a power gamedata lacks
  assert.deepEqual(p.missing, { inventory: false, list: [] });
});

test('the summary keeps no inventory text, uuid, lore or name', async () => {
  const p = await summarize(worker({ armor: encodeInventory([piece('DIVAN_HELMET')]) }), gamedata);
  const text = JSON.stringify(p);
  assert.equal(text.includes('H4sI'), false);
  assert.equal(text.includes('uuid'), false);
  assert.equal(text.includes('u-DIVAN_HELMET'), false);
  assert.equal(text.includes('Lore'), false);
});

test('hotm: toggles become disabled perks, an unknown perk is counted, the selected ability must be an ability', async () => {
  const answer = worker({ armor: encodeInventory([piece('X')]) });
  answer.hotm = { nodes: { mining: { mining_speed: 5, toggle_mining_speed: false, pickobulus: 1, toggle_pickobulus: true, brand_new_perk: 3 } }, experience: { mining: 12000 }, selectedAbility: 'pickobulus', powder: { mithril: { current: 100, total: 500, spent: 400 }, gemstone: { total: 50, spent: 20 } } };
  const { hotm } = await summarize(answer, gamedata);
  assert.deepEqual(hotm.levels, { mining_speed: 5, pickobulus: 1 });
  assert.deepEqual(hotm.disabled, ['mining_speed']);
  assert.equal(hotm.unknown, 1);
  assert.equal(hotm.tier, 3); // 12000 experience
  assert.equal(hotm.ability, 'pickobulus');
  assert.deepEqual(hotm.powder, { mithril: 100, gemstone: 30 });
  answer.hotm.selectedAbility = 'mining_speed';
  assert.equal((await summarize(answer, gamedata)).hotm.ability, null);
  // the older format: nodes flat, experience a number
  answer.hotm = { nodes: { mining_speed: 7 }, experience: 3000 };
  const old = (await summarize(answer, gamedata)).hotm;
  assert.deepEqual(old.levels, { mining_speed: 7 });
  assert.equal(old.tier, 2);
});

test('tuning: only one slot with points is taken, several are left alone', async () => {
  const answer = worker({ armor: encodeInventory([piece('X')]) });
  answer.accessoryBag = { selectedPower: 'x', highestMagicalPower: 1200, tuning: { slot_0: { health: 0, walk_speed: 3, critical_damage: 5 }, slot_1: { strength: 0 }, highest_unlocked_slot: 1 } };
  const p = await summarize(answer, gamedata);
  assert.deepEqual(p.tuning, { SPEED: 3, CRITICAL_DAMAGE: 5 });
  assert.equal(p.mp, 1200);
  answer.accessoryBag.tuning.slot_1.strength = 4;
  assert.equal((await summarize(answer, gamedata)).tuning, null);
});

test('a field the profile lacks gives no answer, and an inventory API that is off says so', async () => {
  const answer = { profileId: 'p', cute_name: 'Apple', missing: ['hotm', 'pets', 'inventories.armor'], inventories: {} };
  const p = await summarize(answer, gamedata);
  assert.equal(p.hotm, null);
  assert.equal(p.pets, null);
  assert.equal(p.attrs, null);
  assert.equal(p.perks, null);
  assert.deepEqual(p.items, []);
  assert.deepEqual(p.missing, { inventory: true, list: ['hotm', 'pets', 'inventories.armor'] });
});

test('the API names many attributes by the shard id: Flare is "blazing" and counts as infernal_ruler (maxed at 32 Epic shards)', () => {
  const got = attrLevels({ blazing: 32, hunters_grasp: 48 }, gamedata);
  assert.deepEqual(got, { levels: { infernal_ruler: 10, hunter_s_grasp: 10 }, unknown: 0 });
  assert.deepEqual(attrStacks({ blazing: 32, rotten_pickaxe: 8, not_an_attribute: 5 }, gamedata), { infernal_ruler: 32, rotten_pickaxe: 8, not_an_attribute: 5 });
});

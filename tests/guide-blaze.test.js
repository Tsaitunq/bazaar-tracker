// Blaze gear data and rules (spec: docs/blaze-data.md). Fixtures only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { REFORGES, REFORGE_TARGETS, RARITIES, CATACOMBS_REFORGE, HPB, CRIMSON_STAR, DOMINUS, ENCHANT_EFFECTS, enchantLine } from '../optimizer-data.js';

const neu = JSON.parse(fs.readFileSync(new URL('./fixtures/reforges-neu.json', import.meta.url), 'utf8'));
const STAT = { crit_damage: 'CRITICAL_DAMAGE', crit_chance: 'CRITICAL_CHANCE' };
const key = (k) => STAT[k] ?? k.toUpperCase();

test('reforges: every stat of the Blaze reforges equals NEU per rarity, except Vitality, which is not a Blaze stat', () => {
  for (const [name, row] of Object.entries(neu)) {
    for (const [i, rarity] of RARITIES.entries()) {
      const want = Object.fromEntries(Object.entries(row.stats[rarity]).map(([k, v]) => [key(k), v]).filter(([k]) => k !== 'VITALITY'));
      const have = Object.fromEntries(Object.entries(REFORGES[name]).map(([k, values]) => [k, values[i]]));
      assert.deepEqual(have, want, `${name} ${rarity}`);
    }
  }
});

test('reforges: the targets are NEU itemTypes', () => {
  assert.deepEqual(REFORGE_TARGETS.fabled.category, ['SWORD']);
  assert.deepEqual(REFORGE_TARGETS.ancient.category, ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS']);
  assert.deepEqual(REFORGE_TARGETS.bloodshot.category, ['BELT']);
  assert.deepEqual(REFORGE_TARGETS.blood_soaked.category, ['CLOAK']);
  assert.deepEqual(REFORGE_TARGETS.glistening.category, REFORGE_TARGETS.strengthened.category);
  assert.deepEqual([...REFORGE_TARGETS.coldfused.ids].sort(), [...neu.coldfused.itemTypes].sort());
});

test('reforges: Withered and Ancient carry a Catacombs bonus', () => {
  assert.deepEqual(CATACOMBS_REFORGE, { withered: { STRENGTH: 1 }, ancient: { CRITICAL_DAMAGE: 1 } });
});

test('gear constants: potato books, Crimson stars, Dominus at ten stacks', () => {
  assert.deepEqual(HPB.armor, { DEFENSE: 2, HEALTH: 4 });
  assert.deepEqual(HPB.weapon, { STRENGTH: 2, DAMAGE: 2 });
  assert.equal(HPB.max + HPB.fumingMax, 15);
  assert.deepEqual(CRIMSON_STAR, { percent: 2, max: 10 });
  assert.equal(DOMINUS.INFERNAL_CRIMSON.FEROCITY, 20);
  assert.equal(DOMINUS.BURNING_CRIMSON.FEROCITY, 10);
  assert.equal(DOMINUS.CRIMSON.FEROCITY, undefined);
});

test('enchants: the 46 open ones are described, conditional ones read as a line', () => {
  assert.equal(enchantLine('smite', 6), 'smite 6: 40 % damage against Skeletal, Wither and Undead mobs');
  assert.equal(enchantLine('ultimate_chimera', 5), 'ultimate chimera 5: 100 % of the active pet stats');
  assert.equal(enchantLine('cayenne', 3), null);
  for (const name of ['pyroclasm', 'execute', 'fire_aspect', 'giant_killer', 'gravity', 'lethality', 'smite', 'thunderlord', 'triple_strike', 'strong_vitality', 'cayenne', 'ultimate_swarm', 'ultimate_chimera', 'ultimate_last_stand', 'ultimate_refrigerate', 'ultimate_habanero_tactics']) assert.ok(ENCHANT_EFFECTS[name], name);
});

// ---- pieces: stars, potato books, Bling Armor
import { gearOf } from '../guide/gear.js';
import { rulesOf, pieceExtra, pieceTotal, dressDaggers } from '../pieces.js';
import { setPet, setGear, setPetItem, emptyBuild } from '../guide/build.js';
import { miningSettings } from '../optimizer.js';

const petData = JSON.parse(fs.readFileSync(new URL('../gamedata/pets.json', import.meta.url), 'utf8'));
const blazePet = petData.pets.find((p) => p.id === 'BLAZE');
const ITEMS = {
  FROZEN_BLAZE_HELMET: { category: 'HELMET', stats: { DEFENSE: 105, STRENGTH: 40, SPEED: 2 } },
  INFERNAL_CRIMSON_HELMET: { category: 'HELMET', stats: { DEFENSE: 126, HEALTH: 403, STRENGTH: 76, CRITICAL_DAMAGE: 50, INTELLIGENCE: 38 } },
  INFERNAL_CRIMSON_BOOTS: { category: 'BOOTS', stats: { DEFENSE: 101, STRENGTH: 76 } },
  HEARTFIRE_DAGGER: { category: 'SWORD', stats: { DAMAGE: 300, STRENGTH: 100 } },
  NECK: { category: 'NECKLACE', stats: { STRENGTH: 10 } },
};

test('pieces: Frozen Blaze with the Lv 100 Blaze pet is (item + books) × 1.4, the books count 2 × 1.4 = 2.8 times', () => {
  const rules = rulesOf(emptyBuild(), blazePet);
  assert.equal(rules.potato, 2);
  assert.equal(rules.bling, 40);
  const total = pieceTotal('FROZEN_BLAZE_HELMET', ITEMS, rules);
  assert.equal(total.STRENGTH, 56); // 40 × 1.4, the wiki value of the Frozen Blaze Helmet with the pet
  assert.equal(total.SPEED, 2.8);
  assert.ok(Math.abs(total.DEFENSE - (105 + 40) * 1.4) < 1e-9); // 20 books × 2 Defense
  assert.ok(Math.abs(total.HEALTH - 80 * 1.4) < 1e-9); // 20 books × 4 Health
});

test('pieces: without the pet the books count once and Bling Armor does nothing', () => {
  const rules = rulesOf(emptyBuild(), null);
  assert.deepEqual(pieceExtra('FROZEN_BLAZE_HELMET', ITEMS, rules), { DEFENSE: 20, HEALTH: 40 });
  assert.deepEqual(pieceExtra('FROZEN_BLAZE_HELMET', ITEMS, rulesOf(setGear(emptyBuild(), { hpb: false }), null)), {});
});

test('pieces: Fuming books count with the others, stars lift the Crimson item stats only', () => {
  const rules = rulesOf(setGear(emptyBuild(), { stars: 5, fuming: 5 }), null);
  const helmet = pieceExtra('INFERNAL_CRIMSON_HELMET', ITEMS, rules);
  assert.ok(Math.abs(helmet.DEFENSE - (12.6 + 30)) < 1e-9); // 10 % of 126, 15 books × 2
  assert.ok(Math.abs(helmet.HEALTH - (40.3 + 60)) < 1e-9);
  assert.ok(Math.abs(helmet.STRENGTH - 7.6) < 1e-9);
  assert.deepEqual(pieceExtra('NECK', ITEMS, rules), {}); // equipment takes neither
  const dagger = pieceExtra('HEARTFIRE_DAGGER', ITEMS, rules);
  assert.deepEqual(dagger, { STRENGTH: 30, DAMAGE: 30 });
});

test('pieces: the daggers carry their books in the lore, other ids and no rules change nothing', () => {
  const rules = rulesOf(emptyBuild(), null);
  const dressed = dressDaggers({ ashen: { id: 'HEARTFIRE_DAGGER', lore: { DAMAGE: 300, STRENGTH: 100 } }, spirit: null }, ITEMS, rules);
  assert.deepEqual(dressed.ashen.lore, { DAMAGE: 320, STRENGTH: 120 });
  assert.equal(dressed.spirit, null);
  assert.deepEqual(pieceExtra('HEARTFIRE_DAGGER', ITEMS, null), {});
  assert.deepEqual(pieceExtra('MISSING', ITEMS, rules), {});
});

test('gear: worn Blaze armor takes stars, books and the pet doubling, the Plushie and the pet add to it', () => {
  const guide = { id: 'z', area: 'blaze', sections: [] };
  const run = (build) => gearOf({ guides: [guide], checks: {}, owned: ['FROZEN_BLAZE_HELMET', 'INFERNAL_CRIMSON_BOOTS'], items: ITEMS, area: 'blaze', build, settings: miningSettings(), pets: petData.pets, petItems: petData.items });
  const plain = run(emptyBuild()).gear;
  assert.equal(plain.STRENGTH, 40 + 76);
  assert.equal(plain.DEFENSE, 105 + 101 + 40);
  let build = setPetItem(setPet(setGear(emptyBuild(), { stars: 10 }), { id: 'BLAZE', rarity: 'LEGENDARY' }), 'CROCHET_TIGER_PLUSHIE');
  const g = run(build).gear;
  assert.ok(Math.abs(g.STRENGTH - (56 + 76 * 1.2)) < 1e-9);
  assert.equal(g.ATTACK_SPEED, 35);
  assert.equal(g.INTELLIGENCE, 100);
  assert.ok(Math.abs(g.DEFENSE - ((105 + 40) * 1.4 + 101 * 1.2 + 40 + 30)) < 1e-9); // boots: 20 books ×2 = 40 on top of the stars
});

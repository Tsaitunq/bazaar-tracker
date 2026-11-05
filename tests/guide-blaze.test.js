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

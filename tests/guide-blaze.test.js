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

// ---- set bonus
import { setBonusOf, dominusOf } from '../blaze.js';

test('set bonus: Dominus needs two pieces of one tier, mixed sets take the tier with most pieces, a tie the higher one', () => {
  const inf = (...p) => p.map((x) => `INFERNAL_CRIMSON_${x}`);
  assert.equal(setBonusOf(inf('HELMET')).tier, null);
  assert.deepEqual(setBonusOf(inf('HELMET', 'BOOTS')).add, { SWING_RANGE: 1, FEROCITY: 20 });
  assert.equal(setBonusOf(inf('HELMET', 'BOOTS')).additive, 100);
  const mixed = [...inf('HELMET'), 'FIERY_CRIMSON_CHESTPLATE', 'FIERY_CRIMSON_LEGGINGS', 'FIERY_CRIMSON_BOOTS'];
  assert.equal(setBonusOf(mixed).tier, 'FIERY_CRIMSON');
  assert.equal(dominusOf(mixed), 0);
  const tie = [...inf('HELMET', 'BOOTS'), 'FIERY_CRIMSON_CHESTPLATE', 'FIERY_CRIMSON_LEGGINGS'];
  assert.equal(setBonusOf(tie).tier, 'INFERNAL_CRIMSON');
  assert.deepEqual(setBonusOf(['BURNING_CRIMSON_HELMET', 'BURNING_CRIMSON_BOOTS']).add, { SWING_RANGE: 1, FEROCITY: 10 });
  assert.deepEqual(setBonusOf(['CRIMSON_HELMET', 'CRIMSON_BOOTS']).add, { SWING_RANGE: 0.5 });
  assert.deepEqual(setBonusOf(['HOT_CRIMSON_HELMET', 'HOT_CRIMSON_BOOTS']).add, { SWING_RANGE: 1 });
  assert.deepEqual(setBonusOf(['HOT_CRIMSON_HELMET', 'CRIMSON_BOOTS']).add, {}); // one piece of each tier
});

test('gear: two Infernal pieces give Ferocity 20 and Swing Range 1 as gear', () => {
  const guide = { id: 'z', area: 'blaze', sections: [] };
  const g = gearOf({ guides: [guide], checks: {}, owned: ['INFERNAL_CRIMSON_HELMET', 'INFERNAL_CRIMSON_BOOTS'], items: ITEMS, area: 'blaze', build: setGear(emptyBuild(), { hpb: false }), settings: miningSettings(), pets: petData.pets }).gear;
  assert.equal(g.FEROCITY, 20);
  assert.equal(g.SWING_RANGE, 1);
  const one = gearOf({ guides: [guide], checks: {}, owned: ['INFERNAL_CRIMSON_HELMET'], items: ITEMS, area: 'blaze', build: setGear(emptyBuild(), { hpb: false }), settings: miningSettings(), pets: petData.pets }).gear;
  assert.equal(one.FEROCITY, undefined);
});

// ---- reforges with the Catacombs level and their targets
import { blazeDelta } from '../optimizer.js';
import { blazeState } from '../blaze.js';

const piece = (id, extra = {}) => ({ id, where: 'inventory', gems: [], enchants: {}, parts: {}, reforge: null, recomb: false, polarvoid: 0, coating: false, scrolls: [], lore: {}, ...extra });
const REF_ITEMS = {
  PLATE: { category: 'CHESTPLATE', tier: 'LEGENDARY', stats: {} },
  RING: { category: 'ACCESSORY', tier: 'LEGENDARY', stats: {} },
  FIREDUST_DAGGER: { category: 'SWORD', tier: 'LEGENDARY', stats: { DAMAGE: 1 } },
  MAWDUST_DAGGER: { category: 'SWORD', tier: 'LEGENDARY', stats: { DAMAGE: 1 } },
  GAUNTLET_X: { category: 'GLOVES', tier: 'LEGENDARY', stats: {} },
};
const refGuide = { groups: { armor: [['PLATE']], gloves: [['GAUNTLET_X']], weapons: [['FIREDUST_DAGGER'], ['MAWDUST_DAGGER']] } };
function reforgeOf(detect, rules, ownedIds = ['PLATE', 'GAUNTLET_X']) {
  const armor = [piece('PLATE')];
  const equipment = ownedIds.includes('GAUNTLET_X') ? [piece('GAUNTLET_X')] : [];
  const daggers = { ashen: piece('FIREDUST_DAGGER'), spirit: piece('MAWDUST_DAGGER') };
  const loadout = { armor, equipment, held: null, accessories: [], pet: null, gaps: [], daggers };
  const profile = { items: [...armor, ...equipment, ...Object.values(daggers)], pets: [], hotm: null, attrs: {}, mp: 900, selectedPower: null };
  const state = blazeState({ STRENGTH: 100 }, loadout, daggers);
  return blazeDelta({ text: 's', detect }, state, loadout, profile, REF_ITEMS, miningSettings(null), refGuide, rules);
}

test('reforge: Ancient on a Legendary chestplate carries Intelligence and +1 Crit Damage per Catacombs level', () => {
  const detect = { kind: 'reforge', on: 'armor', value: ['ancient'] };
  const known = reforgeOf(detect, rulesOf(setGear(emptyBuild(), { catacombs: 40 }), null)).common;
  assert.deepEqual(known, { STRENGTH: 25, CRITICAL_CHANCE: 12, HEALTH: 7, DEFENSE: 7, INTELLIGENCE: 20, CRITICAL_DAMAGE: 40 });
  const unknown = reforgeOf(detect, rulesOf(emptyBuild(), null)).common;
  assert.equal(unknown.CRITICAL_DAMAGE, undefined);
  assert.equal(unknown.INTELLIGENCE, 20);
});

test('reforge: Withered counts the Catacombs level, Glistening adds Intelligence on equipment, Coldfused adds Magic Find', () => {
  assert.equal(reforgeOf({ kind: 'reforge', on: 'weapons', value: ['withered'], need: 1 }, rulesOf(setGear(emptyBuild(), { catacombs: 30 }), null)).lines.ashen.STRENGTH, 135 + 30);
  assert.deepEqual(reforgeOf({ kind: 'reforge', on: 'gloves', value: ['glistening'] }, rulesOf(emptyBuild(), null)).common, { TRUE_DEFENSE: 4, INTELLIGENCE: 12 });
  assert.equal(reforgeOf({ kind: 'reforge', on: 'weapons', value: ['coldfused'], need: 1 }, rulesOf(emptyBuild(), null)).lines.ashen.MAGIC_FIND, 2);
});

test('reforge: a reforge on the wrong kind of piece is unknown', () => {
  assert.equal(reforgeOf({ kind: 'reforge', on: 'gloves', value: ['ancient'] }, rulesOf(emptyBuild(), null)), null);
  assert.equal(reforgeOf({ kind: 'reforge', on: 'armor', value: ['bloodshot'] }, rulesOf(emptyBuild(), null)), null);
});

// ---- Chimera and the conditional lines
test('Chimera: a share of the pet stats goes onto the dagger in the lore and in the ranking step', () => {
  const rules = rulesOf(emptyBuild(), blazePet, { DEFENSE: 30, INTELLIGENCE: 100 });
  const dressed = dressDaggers({ ashen: { id: 'HEARTFIRE_DAGGER', lore: { DAMAGE: 300 }, enchants: { ultimate_chimera: 3 } }, spirit: null }, ITEMS, { ...rules, gear: { ...rules.gear, hpb: false } });
  assert.equal(dressed.ashen.lore.DEFENSE, 18); // 60 %
  assert.equal(dressed.ashen.lore.INTELLIGENCE, 60);
  const step = (level) => reforgeOf({ kind: 'enchant', on: 'weapons', enchant: 'ultimate_chimera', level, need: 2 }, rules);
  assert.deepEqual(step(5).lines.ashen, { DEFENSE: 30, INTELLIGENCE: 100 });
  assert.deepEqual(step(5).enchants.ashen, { ultimate_chimera: 5 });
});

test('gear: ticked conditional enchants are listed with their level and never added', () => {
  const guide = { id: 'z', area: 'blaze', sections: [{ name: 'S', steps: [
    { text: 'a', detect: { kind: 'enchant', on: 'weapons', enchant: 'smite', level: 5, need: 2 } },
    { text: 'b', detect: { kind: 'enchant', on: 'weapons', enchant: 'smite', level: 6, need: 2 } },
    { text: 'c', detect: { kind: 'reforge', on: 'armor', value: ['ancient'] } },
  ] }], groups: { weapons: [['FIREDUST_DAGGER'], ['MAWDUST_DAGGER']], armor: [['PLATE']] } };
  const w = gearOf({ guides: [guide], checks: { z: ['S|a', 'S|b', 'S|c'] }, owned: ['PLATE', 'FIREDUST_DAGGER', 'MAWDUST_DAGGER'], items: REF_ITEMS, area: 'blaze', build: emptyBuild(), settings: miningSettings(), pets: petData.pets });
  assert.deepEqual(w.listed.map((l) => l.text), ['smite 6: 40 % damage against Skeletal, Wither and Undead mobs', 'Withered and Ancient: +1 per Catacombs level, set your level under Power → Gear']);
  assert.equal(w.gear.STRENGTH, 25); // the Ancient reforge, nothing from smite
});

// ---- accessories: in the base, a change only when ticked after the measurement
import { accessoryGain } from '../guide/gear.js';

const ACC = {
  TALI: { category: 'ACCESSORY', family: 'TOOTH', tier: 'COMMON', stats: { STRENGTH: 5 } },
  RING: { category: 'ACCESSORY', family: 'TOOTH', tier: 'UNCOMMON', stats: { STRENGTH: 10 } },
  ART: { category: 'ACCESSORY', family: 'TOOTH', tier: 'RARE', stats: { STRENGTH: 18, CRITICAL_DAMAGE: 4 } },
  SOLO: { category: 'ACCESSORY', tier: 'RARE', stats: { MAGIC_FIND: 3, HEALTH_REGEN: 9 } },
};
const accGuide = { id: 'g', area: 'blaze', sections: [{ name: 'S', steps: [
  { text: 'a', detect: { kind: 'owned', on: [['TALI']] } },
  { text: 'b', detect: { kind: 'owned', on: [['RING']] } },
  { text: 'c', detect: { kind: 'owned', on: [['ART']] } },
  { text: 'd', detect: { kind: 'owned', on: [['SOLO']] } },
] }] };
const gain = (dates, owned, measuredAt = 1000) => accessoryGain({ guides: [accGuide], area: 'blaze', dates: { g: dates }, measuredAt, owned, items: ACC });

test('accessories: ticked before the measurement they are part of the base', () => {
  assert.deepEqual(gain({ 'S|a': 500, 'S|d': 0 }, ['TALI', 'SOLO']), { gain: {}, after: 0 });
});

test('accessories: ticked after the measurement the item stats count, a ladder only by the step from the rung that was there', () => {
  const r = gain({ 'S|a': 500, 'S|b': 2000, 'S|d': 3000 }, ['TALI', 'RING', 'SOLO']);
  assert.deepEqual(r.gain, { STRENGTH: 5, MAGIC_FIND: 3 }); // Ring − Talisman; Health Regen is no Blaze stat
  assert.equal(r.after, 2);
  const two = gain({ 'S|a': 500, 'S|b': 1500, 'S|c': 2000 }, ['TALI', 'RING', 'ART']);
  assert.deepEqual(two.gain, { STRENGTH: 13, CRITICAL_DAMAGE: 4 }); // Artifact − Talisman, the Ring is skipped over
  assert.deepEqual(gain({ 'S|b': 2000 }, ['RING']).gain, { STRENGTH: 10 }); // no rung before: the full stats
});

test('accessories: a new measurement makes everything base again; no measurement, no change', () => {
  const dates = { 'S|a': 500, 'S|b': 2000 };
  assert.deepEqual(gain(dates, ['TALI', 'RING'], 5000).gain, {});
  assert.deepEqual(gain(dates, ['TALI', 'RING'], null).gain, {});
  assert.deepEqual(gain({}, ['SOLO']).gain, {}); // a tick without a date is older than the app
});

test('gear: the accessory gain is in the gear of the area, the hint tells to adjust Magical Power', () => {
  const g = gearOf({ guides: [accGuide], checks: {}, owned: ['TALI', 'RING'], items: ACC, area: 'blaze', build: emptyBuild(), settings: miningSettings(), pets: petData.pets, dates: { g: { 'S|a': 500, 'S|b': 2000 } }, measuredAt: 1000 });
  assert.equal(g.gear.STRENGTH, 5);
  assert.deepEqual(g.hints, ['An accessory changes your Magical Power: adjust it under Power.']);
  const before = gearOf({ guides: [accGuide], checks: {}, owned: ['TALI', 'RING'], items: ACC, area: 'blaze', build: emptyBuild(), settings: miningSettings(), pets: petData.pets, dates: { g: { 'S|a': 500, 'S|b': 800 } }, measuredAt: 1000 });
  assert.equal(before.gear.STRENGTH, undefined);
  assert.deepEqual(before.hints, []);
});

// ---- totals: Nether Embodiment, attribute families
import { loadGameData } from '../guide/gamedata.js';
import { totalFor, statsOf, statsFor } from '../guide/totals.js';

const DATA = await loadGameData((f) => JSON.parse(fs.readFileSync(new URL(`../gamedata/${f}.json`, import.meta.url), 'utf8')));
const blazeBuild = (extra = {}) => ({ ...emptyBuild(), pet: { id: 'BLAZE', rarity: 'LEGENDARY', level: 100 }, ...extra });
const entry = (values, snapshot = emptyBuild()) => ({ at: 1, values, snapshot });
const totals = (build, values, gear, area = 'blaze', pet) => totalFor({ area, entry: entry(values), build, gear, data: DATA, stats: Object.keys(values), pet }).total;

test('Nether Embodiment: +10 % on the sum of base and gear for Combat and Misc stats, not on wisdoms', () => {
  const t = totals(blazeBuild(), { STRENGTH: 100, MAGIC_FIND: 50, COMBAT_WISDOM: 10 }, { STRENGTH: 20, MAGIC_FIND: 10, COMBAT_WISDOM: 10 });
  assert.ok(Math.abs(t.STRENGTH - 132) < 1e-9);
  assert.ok(Math.abs(t.MAGIC_FIND - 66) < 1e-9);
  assert.equal(t.COMBAT_WISDOM, 20); // a wisdom: neither Combat nor Misc
  assert.equal(statsOf(blazeBuild(), DATA, 'blaze').mult.STRENGTH, 1.1);
  assert.equal(statsOf(blazeBuild(), DATA, 'blaze').mult.COMBAT_WISDOM, undefined);
});

test('Nether Embodiment: no pet, another area, and a base measured with the pet on', () => {
  assert.equal(totals(emptyBuild(), { STRENGTH: 100 }, { STRENGTH: 20 }).STRENGTH, 120);
  assert.equal(statsOf(blazeBuild(), DATA, 'mining').mult.STRENGTH, undefined);
  const measuredWith = totalFor({ area: 'blaze', entry: entry({ STRENGTH: 110 }, blazeBuild()), build: blazeBuild(), gear: { STRENGTH: 10 }, data: DATA, stats: ['STRENGTH'] }).total;
  assert.ok(Math.abs(measuredWith.STRENGTH - 121) < 1e-9); // 110 / 1.1 + 10, then × 1.1
});

test('Nether Embodiment: a pet from a ticked step is used in place of the build pet', () => {
  const blaze = DATA.pets.pets.find((p) => p.id === 'BLAZE');
  assert.ok(Math.abs(totals(emptyBuild(), { STRENGTH: 100 }, {}, 'blaze', blaze).STRENGTH - 110) < 1e-9);
  assert.equal(totals(blazeBuild(), { STRENGTH: 100 }, {}, 'blaze', null).STRENGTH, 100);
});

test('attributes: against Infernal counts for Blaze, other families are listed; Unlimited Fortitude is a percent of Defense', () => {
  const build = { ...emptyBuild(), attrs: { blazing_resistance: 10, undead_resistance: 10, unlimited_fortitude: 10, attack_speed: 4, infernal_ruler: 5, flying_fortune: 10 } };
  const out = statsOf(build, DATA, 'blaze');
  assert.equal(out.add.DEFENSE, 40); // 4 per level against Infernal, the Undead one is not
  assert.equal(out.add.ATTACK_SPEED, 4);
  assert.ok(Math.abs(out.mult.DEFENSE - 1.02) < 1e-9);
  assert.equal(out.add.MAGIC_FIND, undefined);
  assert.ok(out.listed.some((l) => /Undead Resistance/.test(l.text)));
  assert.ok(out.listed.some((l) => l.text === 'Infernal Ruler 5: +15% damage against Infernal mobs'));
  assert.equal(statsOf(build, DATA, 'mining').listed.some((l) => /Infernal Ruler/.test(l.text)), false);
});

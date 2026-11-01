import test from 'node:test';
import assert from 'node:assert/strict';
import { miningScore, blazeScore, blazeConstraints, gearStats, loadoutOf, computeStats, powerMultiplier, petLevel, compareStats, statsEntry, statsView, GEMSTONE } from '../stats.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} is not ${b}`);
const base = { MINING_FORTUNE: 1000, MINING_SPEED: 6000, PRISTINE: 5 };

// derived from the wiki formula: the wiki has no worked numbers
test('miningScore matches the derived spec values', () => {
  near(miningScore(base, { MINING_FORTUNE: 10 }, GEMSTONE), 10 / 1100);
  near(miningScore(base, { MINING_SPEED: 50 }, GEMSTONE), 50 / 6000);
  near(miningScore(base, { PRISTINE: 1 }, GEMSTONE), 0.79 / 4.95);
});

test('gemstone fortune counts like mining fortune', () => {
  near(miningScore({ GEMSTONE_FORTUNE: 1000 }, { GEMSTONE_FORTUNE: 10 }), 10 / 1100);
});

test('speed above the softcap counts nothing', () => {
  near(miningScore({ MINING_SPEED: 20000 }, { MINING_SPEED: 100 }), 0);
  near(miningScore({ MINING_SPEED: 19950 }, { MINING_SPEED: 100 }), 50 / 19950);
});

test('wP = 0 removes pristine', () => {
  near(miningScore(base, { PRISTINE: 1 }, { ...GEMSTONE, wP: 0 }), 0);
});

test('blazeScore is the hit of spec 4.2 and ignores true defense', () => {
  const s = { DAMAGE: 95, STRENGTH: 100, CRITICAL_CHANCE: 50, CRITICAL_DAMAGE: 100 };
  near(blazeScore(s), 100 * 2 * 1.5);
  near(blazeScore({ ...s, TRUE_DEFENSE: 500 }), blazeScore(s));
  near(blazeScore({ ...s, CRITICAL_CHANCE: 300 }), 100 * 2 * 2);
});

test('blazeConstraints: 140 TD and 800 MP pass, below is low, missing is unknown', () => {
  assert.deepEqual(blazeConstraints({ TRUE_DEFENSE: 140 }, 800), { trueDefense: 'ok', mp: 'ok' });
  assert.deepEqual(blazeConstraints({ TRUE_DEFENSE: 139 }, 799), { trueDefense: 'low', mp: 'low' });
  assert.deepEqual(blazeConstraints(null, null), { trueDefense: 'unknown', mp: 'unknown' });
});

const it = (id, where, lore = {}, sets) => ({ id, where, lore, ...(sets && { sets }) });
const prof = (items, extra = {}) => ({ items, pets: [], wardrobe: { armor: { equipped: 2, sets: [1, 2] }, equipment: { equipped: 1, sets: [1] } }, ...extra });
const data = { DRILL: { category: 'DRILL' }, PICK: { category: 'PICKAXE' }, SWORD_A: { category: 'SWORD' }, SWORD_B: { category: 'LONGSWORD' } };
const choice = { armor: 1, equipment: 1 };

test('loadoutOf takes the chosen wardrobe and equipment set', () => {
  const p = prof([it('A', 'wardrobe', {}, ['armor:1']), it('B', 'wardrobe', {}, ['armor:3']), it('E', 'wardrobe', {}, ['equipment:1']), it('INV', 'inventory')]);
  const out = loadoutOf(p, data, 'mining', choice);
  assert.deepEqual(out.armor.map((i) => i.id), ['A']);
  assert.deepEqual(out.equipment.map((i) => i.id), ['E']);
});

test('the worn set comes from the worn items', () => {
  const p = prof([it('WORN', 'armor', {}, ['armor:2']), it('A', 'wardrobe', {}, ['armor:1'])]);
  assert.deepEqual(loadoutOf(p, data, 'mining', { armor: 2, equipment: 1 }).armor.map((i) => i.id), ['WORN']);
});

test('an item shared by two sets belongs to both', () => {
  const p = prof([it('S', 'wardrobe', {}, ['armor:1', 'armor:3'])]);
  assert.equal(loadoutOf(p, data, 'mining', { armor: 3, equipment: 1 }).armor.length, 1);
  assert.equal(loadoutOf(p, data, 'mining', choice).armor.length, 1);
});

test('no choice falls back to the worn set and says so in gaps', () => {
  const out = loadoutOf(prof([it('WORN', 'armor', {}, ['armor:2'])]), data, 'mining');
  assert.deepEqual(out.armor.map((i) => i.id), ['WORN']);
  assert.ok(out.gaps.some((g) => /No wardrobe slot picked/.test(g)));
});

test('a saved profile without sets asks for a new sync in gaps', () => {
  const out = loadoutOf({ items: [it('A', 'armor')], pets: [] }, data, 'mining');
  assert.deepEqual(out.armor, []);
  assert.ok(out.gaps.some((g) => /Sync again/.test(g)));
});

test('two accessories of a family count once, the stronger one', () => {
  const p = prof([it('LOW', 'accessory', { HEALTH: 1 }), it('TOP', 'accessory', { HEALTH: 5 }), it('LONE', 'accessory', { HEALTH: 2 })]);
  const out = loadoutOf(p, { LOW: { family: 'TOP' }, TOP: { family: 'TOP' } }, 'mining', choice);
  assert.deepEqual(out.accessories.map((i) => i.id).sort(), ['LONE', 'TOP']);
});

test('a full armor set is named in gaps, three pieces are not', () => {
  const piece = (slot) => it(`X_${slot}`, 'wardrobe', {}, ['armor:1']);
  const named = (armor) => loadoutOf(prof(armor), data, 'mining', choice).gaps.filter((g) => /Full set/.test(g));
  assert.deepEqual(named(['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'].map(piece)), ['Full set X: its bonus is not counted.']);
  assert.deepEqual(named(['HELMET', 'CHESTPLATE', 'LEGGINGS'].map(piece)), []);
});

test('the held item is the best owned tool or the weapon with the most lore damage', () => {
  const p = prof([it('DRILL', 'inventory', { MINING_SPEED: 1000 }), it('PICK', 'backpack', { MINING_SPEED: 100 }), it('SWORD_A', 'ender', { DAMAGE: 100 }), it('SWORD_B', 'inventory', { DAMAGE: 300 })]);
  assert.equal(loadoutOf(p, data, 'mining', choice).held.id, 'DRILL');
  assert.equal(loadoutOf(p, data, 'blaze', choice).held.id, 'SWORD_B');
  assert.equal(loadoutOf(prof([]), data, 'blaze', choice).held, null);
  assert.ok(loadoutOf(prof([]), data, 'blaze', choice).gaps.includes('No weapon found.'));
});

test('without item data there is no held item and gaps say so', () => {
  const out = loadoutOf(prof([it('DRILL', 'inventory')]), null, 'mining', choice);
  assert.equal(out.held, null);
  assert.ok(out.gaps.some((g) => /Item data missing/.test(g)));
});

test('the active pet is the pet of the loadout', () => {
  const p = prof([], { pets: [{ type: 'A', active: false }, { type: 'B', active: true }] });
  assert.equal(loadoutOf(p, data, 'mining', choice).pet.type, 'B');
});

test('gearStats adds lore', () => {
  assert.deepEqual(gearStats([it('A', 'x', { HEALTH: 1 }), it('B', 'x', { HEALTH: 2, DEFENSE: 3 })]), { HEALTH: 3, DEFENSE: 3 });
});

const empty = { armor: [], equipment: [], held: null, accessories: [], pet: null, gaps: [] };
const part = (profile, name, loadout = empty) => computeStats({ items: [], ...profile }, {}, loadout, 'mining').parts[name];

test('HOTM adds 20 speed, 2 fortune and 0.1 pristine per level of the matching perk', () => {
  assert.deepEqual(part({ hotm: { nodes: { mining_speed: 10, mining_fortune: 5, pristine: 3 } } }, 'hotm'), { MINING_SPEED: 200, MINING_FORTUNE: 10, PRISTINE: 0.30000000000000004 });
});

test('skills follow the wiki totals at the top levels', () => {
  const top = 111672425;
  const s = part({ skills: { SKILL_MINING: top, SKILL_FARMING: top, SKILL_FISHING: top, SKILL_FORAGING: top, SKILL_COMBAT: top }, farmingCap: 10 }, 'skills');
  assert.deepEqual(s, { MINING_FORTUNE: 240, DEFENSE: 106, HEALTH: 242 + 192, STRENGTH: 100, CRITICAL_CHANCE: 30 });
});

test('farming stops at level 50 without the cap perk', () => {
  assert.equal(part({ skills: { SKILL_FARMING: 111672425 } }, 'skills').HEALTH, 192);
});

test('the MP multiplier follows the wiki formula', () => {
  near(powerMultiplier(250), 9.64, 0.01);
  const s = part({ selectedPower: 'fortuitous', mp: 250 }, 'power');
  near(s.HEALTH, 32, 0.5);
  near(s.STRENGTH, 46, 0.5);
});

test('a flat power bonus does not scale, and the stone values match the wiki at 250', () => {
  near(part({ selectedPower: 'silky', mp: 250 }, 'power').CRITICAL_DAMAGE, 219.84, 0.1);
  assert.equal(part({ selectedPower: 'silky', mp: 250 }, 'power').ATTACK_SPEED, 5);
  near(part({ selectedPower: 'scorching', mp: 250 }, 'power').ATTACK_SPEED, 17.36, 0.05);
});

test('an unknown power is named in gaps, not guessed', () => {
  const out = computeStats({ items: [], selectedPower: 'mystery', mp: 900 }, {}, empty, 'mining');
  assert.deepEqual(out.parts.power, {});
  assert.ok(out.gaps.includes('Power mystery has no stat table yet.'));
});

test('tuning points add their stats, and a second filled slot is named', () => {
  assert.deepEqual(part({ tuning: { slot_0: { strength: 3, critical_damage: 10 } } }, 'power'), { STRENGTH: 3, CRITICAL_DAMAGE: 10 });
  const out = computeStats({ items: [], tuning: { slot_0: {}, slot_1: { strength: 1 }, highest_unlocked_slot: 1 } }, {}, empty, 'mining');
  assert.ok(out.gaps.includes('Tuning: only slot 0 is counted.'));
});

test('the fortune collections add once per reached tier', () => {
  assert.deepEqual(part({ collTiers: ['GLACITE_1', 'GLACITE_2', 'GLACITE_6', 'OBSIDIAN_10', 'WHEAT_1'] }, 'collections'), { MINING_FORTUNE: 3 });
});

test('skills off leaves the part out and names it in gaps', () => {
  const out = computeStats({ items: [] }, {}, empty, 'mining');
  assert.deepEqual(out.parts.skills, {});
  assert.ok(out.gaps.some((g) => /Skills API/.test(g)));
});

test('petLevel: the rarity offset picks the costs, the top stops it, past 100 the last cost repeats', () => {
  assert.equal(petLevel({ tier: 'LEGENDARY', exp: 0 }), 1);
  assert.equal(petLevel({ tier: 'COMMON', exp: 100 }), 2);
  assert.equal(petLevel({ tier: 'LEGENDARY', exp: 660 }), 2);
  assert.equal(petLevel({ tier: 'LEGENDARY', exp: 1e12 }), 100);
  assert.equal(petLevel({ tier: 'LEGENDARY', exp: 1e12 }, 200), 200);
});

test('a pet in the table adds its stats, one not in the table is named in gaps', () => {
  const lion = { type: 'LION', tier: 'LEGENDARY', exp: 1e12, heldItem: 'X' };
  const known = computeStats({ items: [] }, {}, { ...empty, pet: lion }, 'mining');
  assert.deepEqual(known.parts.pet, { STRENGTH: 50 });
  assert.ok(known.gaps.includes('The pet item is not counted.'));
  const other = computeStats({ items: [] }, {}, { ...empty, pet: { type: 'WOLF', tier: 'EPIC', exp: 1 } }, 'mining');
  assert.deepEqual(other.parts.pet, {});
  assert.ok(other.gaps.includes('Pet WOLF EPIC has no stat table yet.'));
});

test('the Golden Dragon has no stats as an egg and full ones at 200', () => {
  const stats = (exp) => computeStats({ items: [] }, {}, { ...empty, pet: { type: 'GOLDEN_DRAGON', tier: 'LEGENDARY', exp } }, 'blaze').parts.pet;
  assert.deepEqual(stats(0), {});
  assert.deepEqual(stats(1e12), { STRENGTH: 50, ATTACK_SPEED: 50 });
});

test('the total adds every part, and DAMAGE comes from the weapon lore only in Blaze', () => {
  const held = it('S', 'inventory', { DAMAGE: 200, STRENGTH: 10 });
  const armor = [it('A', 'wardrobe', { HEALTH: 50, DAMAGE: 5 })];
  const blaze = computeStats({ items: [] }, {}, { ...empty, held, armor }, 'blaze').total;
  assert.equal(blaze.HEALTH, 150);
  assert.equal(blaze.STRENGTH, 10);
  assert.equal(blaze.DAMAGE, 200);
  assert.equal(blaze.CRITICAL_CHANCE, 30);
  assert.equal(computeStats({ items: [] }, {}, empty, 'mining').total.DAMAGE, 0);
});

test('a loadout gap carries through', () => {
  assert.ok(computeStats({ items: [] }, {}, { ...empty, gaps: ['Full set X: its bonus is not counted.'] }, 'mining').gaps.includes('Full set X: its bonus is not counted.'));
});

test('compareStats flags from 5 percent', () => {
  const row = (calc, game) => compareStats({ X: calc }, { X: game })[0];
  assert.equal(row(100, 95).flag, true);
  assert.equal(row(100, 96).flag, false);
  assert.equal(row(96, 100).flag, false);
  assert.equal(row(95, 100).flag, true);
  near(row(110, 100).percent, 10);
  assert.equal(row(110, 100).diff, 10);
});

test('an in-game value of 0 gives no division by zero', () => {
  assert.deepEqual(compareStats({ X: 3 }, { X: 0 })[0], { stat: 'X', calculated: 3, inGame: 0, diff: 3, percent: null, flag: true });
  assert.equal(compareStats({}, { X: 0 })[0].flag, false);
});

test('statsEntry keeps real numbers of known stats and leaves empty fields out', () => {
  const e = statsEntry('mining', { armor: '3', equipment: '', boost: true, values: { MINING_SPEED: '1200.5', PRISTINE: '', MINING_FORTUNE: 'abc', STRENGTH: '9', GEMSTONE_FORTUNE: '0' } }, 7);
  assert.deepEqual(e, { choice: { armor: 3, equipment: null, pet: null, emptyHand: false }, values: { GEMSTONE_FORTUNE: 0, MINING_SPEED: 1200.5 }, boost: true, at: 7 });
});

test('DAMAGE is not a field of the form', () => {
  assert.equal(statsEntry('blaze', { values: { DAMAGE: '500' } }, 1).values.DAMAGE, undefined);
  assert.ok(!view(state()).includes('data-stats-stat="DAMAGE"'));
});

const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const view = (s, items = data) => statsView(s, items, escHtml);
const state = (extra = {}, summary = {}) => ({ syncedAt: 100, summary: prof([it('A_HELMET', 'wardrobe', { HEALTH: 900 }, ['armor:1']), it('SWORD_A', 'inventory', { DAMAGE: 321 })], { mp: 900, ...summary }), ...extra });
const areaOf = (html, area) => html.slice(html.indexOf(`data-stats-area="${area}"`)).split('</section>')[0];

test('the view lists the slots by index and marks the worn one', () => {
  const html = areaOf(view(state()), 'mining');
  assert.match(html, /<option value="1">Slot 1<\/option>/);
  assert.match(html, /<option value="2" selected>Slot 2 \(worn\)<\/option>/);
});

test('a picked slot is selected and drives the numbers', () => {
  const html = areaOf(view(state({ statsInput: { blaze: { choice: { armor: 1, equipment: 1 }, values: {} } } })), 'blaze');
  assert.match(html, /<option value="1" selected>Slot 1<\/option>/);
  assert.match(html, /Health<\/th><td>1000</);
});

test('DAMAGE is shown from the lore and is not compared', () => {
  const html = areaOf(view(state()), 'blaze');
  assert.match(html, /Weapon damage from lore: 321/);
  assert.ok(!/<th scope="row">Damage/.test(html));
});

test('the constraints show in Blaze only', () => {
  const html = view(state());
  assert.match(areaOf(html, 'blaze'), /True Defense 140: too low · Magical Power 800: ok/);
  assert.ok(!/Magical Power 800/.test(areaOf(html, 'mining')));
});

test('the boost box is stored per measurement and shown at a flagged stat', () => {
  const s = state({ statsInput: { blaze: { choice: { armor: 1, equipment: 1 }, boost: true, values: { HEALTH: 2000, STRENGTH: 0 }, at: 200 } } });
  const html = areaOf(view(s), 'blaze');
  assert.match(html, /data-stats-boost checked/);
  assert.match(html.split('stats-flag')[1], /God Potion \/ Booster Cookie active/);
  assert.ok(!/God Potion/.test(areaOf(view(s), 'mining').split('<table')[1]));
  assert.equal(statsEntry('blaze', { boost: 'yes' }, 1).boost, false);
});

test('values older than the last sync are marked, newer ones not', () => {
  const at = (t) => areaOf(view(state({ statsInput: { mining: { values: {}, at: t } } })), 'mining');
  assert.match(at(50), /older than the last sync/);
  assert.ok(!/older than the last sync/.test(at(200)));
});

test('the view escapes and lists the gaps', () => {
  const html = view(state({}, { selectedPower: '<img>' }));
  assert.ok(!html.includes('<img>'));
  assert.match(html, /Power &lt;img&gt; has no stat table yet/);
});

test('without a summary the view asks for a sync', () => {
  assert.match(statsView(null, data, escHtml), /Sync your profile/);
  assert.match(statsView({ uuid: 'x' }, data, escHtml), /Sync your profile/);
});

test('a saved profile without a wardrobe still draws', () => {
  assert.match(view({ syncedAt: 1, summary: { items: [], pets: [] } }), /Sync again to read your wardrobe/);
});

const owned = [{ type: 'LION', tier: 'EPIC', exp: 1e12 }, { type: 'LION', tier: 'EPIC', exp: 1 }, { type: 'BAL', tier: 'LEGENDARY', exp: 1e12, active: true }];

test('a picked pet wins over the active one, the most levelled of its kind', () => {
  const out = loadoutOf(prof([], { pets: owned }), data, 'blaze', { ...choice, pet: 'LION:EPIC' });
  assert.equal(out.pet.exp, 1e12);
  assert.equal(out.pet.type, 'LION');
  assert.ok(!out.gaps.some((g) => /No pet picked/.test(g)));
});

test('no pick uses the active pet and says so, a pet gone from the sync is named', () => {
  const none = loadoutOf(prof([], { pets: owned }), data, 'blaze', choice);
  assert.equal(none.pet.type, 'BAL');
  assert.ok(none.gaps.includes('No pet picked, using the active one.'));
  const gone = loadoutOf(prof([], { pets: owned }), data, 'blaze', { ...choice, pet: 'WOLF:EPIC' });
  assert.equal(gone.pet, null);
  assert.ok(gone.gaps.includes('The picked pet is not in the last sync.'));
});

test('the table follows the wiki pages at level 100, per rarity', () => {
  const stats = (type, tier) => computeStats({ items: [] }, {}, { ...empty, pet: { type, tier, exp: 1e12 } }, 'mining').parts.pet;
  assert.deepEqual(stats('LION', 'EPIC'), { STRENGTH: 50 });
  assert.deepEqual(stats('DROPLET_WISP', 'UNCOMMON'), { HEALTH: 100 });
  assert.deepEqual(stats('SUBZERO_WISP', 'LEGENDARY'), { HEALTH: 600, TRUE_DEFENSE: 35 });
  assert.deepEqual(stats('BAL', 'LEGENDARY'), { MINING_FORTUNE: 100 });
  assert.deepEqual(stats('GOBLIN', 'LEGENDARY'), { ORE_FORTUNE: 100 });
  assert.deepEqual(stats('DROPLET_WISP', 'LEGENDARY'), {});
});

test('abilities are named in gaps for any pet', () => {
  for (const type of ['LION', 'WOLF']) {
    assert.ok(computeStats({ items: [] }, {}, { ...empty, pet: { type, tier: 'EPIC', exp: 1 } }, 'mining').gaps.includes('Pet abilities are not counted.'));
  }
});

test('the view offers the pets of the profile once each and keeps the pick', () => {
  const s = state({ statsInput: { blaze: { choice: { armor: 1, equipment: 1, pet: 'LION:EPIC' }, values: {} } } }, { pets: owned });
  const blaze = areaOf(view(s), 'blaze');
  assert.equal(blaze.match(/value="LION:EPIC"/g).length, 1);
  assert.match(blaze, /<option value="LION:EPIC" selected>Lion Epic<\/option>/);
  assert.match(areaOf(view(s), 'mining'), /<option value="BAL:LEGENDARY" selected>/);
});

test('statsEntry keeps a well-formed pet only', () => {
  assert.equal(statsEntry('mining', { pet: 'LION:EPIC' }, 1).choice.pet, 'LION:EPIC');
  assert.equal(statsEntry('mining', { pet: '<x>' }, 1).choice.pet, null);
});

test('the SkyBlock level adds 5 health a level and 1 strength every 5', () => {
  assert.deepEqual(part({ skyblockXp: 25341 }, 'level'), { HEALTH: 1265, STRENGTH: 50 });
  assert.deepEqual(part({}, 'level'), { HEALTH: 0, STRENGTH: 0 });
  assert.ok(computeStats({ items: [] }, {}, empty, 'mining').gaps.includes('Sync again to read your SkyBlock level.'));
  assert.ok(!computeStats({ items: [], skyblockXp: 0 }, {}, empty, 'mining').gaps.includes('Sync again to read your SkyBlock level.'));
});

test('slayer levels add the wiki rewards up to the level reached', () => {
  assert.deepEqual(part({ slayer: { zombie: 102120, spider: 102880, wolf: 100255, enderman: 24036, blaze: 1655, vampire: 99 } }, 'slayer'), { HEALTH: 23 + 7 + 6 + 7, CRITICAL_DAMAGE: 10 + 3, STRENGTH: 1, TRUE_DEFENSE: 1 });
  assert.deepEqual(part({ slayer: { blaze: 1e7, wolf: 9 } }, 'slayer'), { HEALTH: 25, STRENGTH: 3, TRUE_DEFENSE: 3 });
  assert.deepEqual(part({}, 'slayer'), {});
});

test('attack speed stops at 100, and the part stays as it is', () => {
  const held = it('S', 'inventory', { ATTACK_SPEED: 150 });
  const out = computeStats({ items: [] }, {}, { ...empty, held }, 'blaze');
  assert.equal(out.total.ATTACK_SPEED, 100);
  assert.equal(out.parts.gear.ATTACK_SPEED, 150);
});

test('what has no table is named in gaps', () => {
  assert.ok(computeStats({ items: [] }, {}, empty, 'mining').gaps.some((g) => /essence perks/.test(g)));
});

test('nothing in hand counts no tool, without a gap, and the box stays ticked', () => {
  const p = prof([it('DRILL', 'inventory', { MINING_SPEED: 1000 })]);
  const out = loadoutOf(p, data, 'mining', { ...choice, emptyHand: true });
  assert.equal(out.held, null);
  assert.ok(!out.gaps.includes('No mining tool found.'));
  assert.equal(statsEntry('mining', { emptyHand: true }, 1).choice.emptyHand, true);
  const html = areaOf(view({ syncedAt: 1, summary: p, statsInput: { mining: { choice: { ...choice, emptyHand: true }, values: {} } } }), 'mining');
  assert.match(html, /data-stats-empty-hand checked/);
  assert.match(html, /In hand: nothing/);
});

const shards = (attrs) => part({ attrs }, 'shards');

test('the shard count gives the level by rarity, and the wiki range sets the value', () => {
  assert.deepEqual(shards({ veil: 32 }), { TRUE_DEFENSE: 10 });
  assert.deepEqual(shards({ veil: 31 }), { TRUE_DEFENSE: 9 });
  assert.deepEqual(shards({ veil: 1000 }), { TRUE_DEFENSE: 10 });
  assert.deepEqual(shards({ rotten_pickaxe: 96 }), { MINING_SPEED: 30 });
  assert.deepEqual(shards({ rotten_pickaxe: 95 }), { MINING_SPEED: 27 });
  assert.deepEqual(shards({ shadow_elemental: 24, nature_elemental: 1 }), { HEALTH: 22 });
  assert.deepEqual(shards({ ultimate_dna: 24, fortunate_miner: 96 }), { MINING_FORTUNE: 35 });
  assert.deepEqual(shards({ attack_speed: 32 }), { ATTACK_SPEED: 10 });
  assert.deepEqual(shards({ gold_box: 96, mossy_box: 96 }), { ORE_FORTUNE: 50, BLOCK_FORTUNE: 50 });
});

test('a key we do not know adds nothing', () => {
  assert.deepEqual(shards({ crop_speed: 96 }), {});
});

test('a condition keeps a shard out of the numbers and names it in gaps', () => {
  const out = computeStats({ items: [], attrs: { forest_strength: 96, blazing_resistance: 96, lifeline: 0 } }, {}, empty, 'blaze');
  assert.deepEqual(out.parts.shards, {});
  assert.equal(out.total.DEFENSE, undefined);
  assert.ok(out.gaps.includes('Shards with a condition are not counted: forest_strength, blazing_resistance.'));
});

test('an Unlimited shard raises the whole stat, and Almighty Echo raises that', () => {
  const armor = [it('A', 'wardrobe', { STRENGTH: 1000, DEFENSE: 1000 })];
  const stat = (attrs) => computeStats({ items: [], attrs }, {}, { ...empty, armor }, 'blaze').total;
  near(stat({ unlimited_power: 24 }).STRENGTH, 1010);
  near(stat({ unlimited_power: 24, almighty: 24 }).STRENGTH, 1015);
  near(stat({ fortitude: 24 }).DEFENSE, 1020);
  near(stat({ unlimited_energy: 24 }).CRITICAL_DAMAGE, 50.5);
});

test('shards count before the attack speed cap', () => {
  const held = it('S', 'inventory', { ATTACK_SPEED: 95 });
  assert.equal(computeStats({ items: [], attrs: { attack_speed: 32 } }, {}, { ...empty, held }, 'blaze').total.ATTACK_SPEED, 100);
});

test('a saved profile without shards asks for a sync', () => {
  assert.ok(computeStats({ items: [] }, {}, empty, 'mining').gaps.includes('Sync again to read your shards.'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { miningScore, blazeScore, blazeConstraints, gearStats, loadoutOf, GEMSTONE } from '../stats.js';

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

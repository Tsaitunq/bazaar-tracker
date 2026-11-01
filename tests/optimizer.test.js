import test from 'node:test';
import assert from 'node:assert/strict';
import { stepDelta } from '../optimizer.js';
import { GEMSTONE } from '../stats.js';

const piece = (id, extra = {}) => ({ id, where: 'armor', gems: [], enchants: {}, parts: {}, reforge: null, recomb: false, polarvoid: 0, coating: false, lore: {}, ...extra });
const DRILL = 'TITANIUM_DRILL_4';
const items = {
  [DRILL]: { category: 'DRILL', tier: 'LEGENDARY', stats: { MINING_SPEED: 1600 }, gemstone_slots: [{ slot_type: 'AMBER' }, { slot_type: 'JADE' }, { slot_type: 'MINING' }] },
  DIVAN_DRILL: { category: 'DRILL', tier: 'MYTHIC', stats: { MINING_SPEED: 1800, MINING_FORTUNE: 150 } },
  OLD_HELMET: { category: 'HELMET', tier: 'RARE', stats: { MINING_FORTUNE: 10, HEALTH: 50 } },
  NEW_HELMET: { category: 'HELMET', tier: 'LEGENDARY', stats: { MINING_FORTUNE: 30, MINING_SPEED: 5 } },
  LANTERN_A: { category: 'DEPLOYABLE', tier: 'RARE', stats: { MINING_SPEED: 10 } },
  LANTERN_B: { category: 'DEPLOYABLE', tier: 'EPIC', stats: { MINING_SPEED: 25 } },
  LOW_RING: { category: 'ACCESSORY', tier: 'RARE', family: 'TOP_RING', stats: { MINING_FORTUNE: 2 } },
  TOP_RING: { category: 'ACCESSORY', tier: 'EPIC', family: 'TOP_RING', stats: { MINING_FORTUNE: 5 } },
};
const held = piece(DRILL, { where: 'inventory' });
const setup = (over = {}) => ({ armor: [piece('OLD_HELMET')], equipment: [], held, accessories: [], pet: null, gaps: [], ...over });
const profile = (list = [held, piece('OLD_HELMET')], over = {}) => ({ items: list, pets: [], hotm: { experience: 0, nodes: {} }, skills: null, collTiers: null, attrs: {}, slayer: null, ...over });
const guide = { groups: { drill: [[DRILL, 'DIVAN_DRILL']], armor: [['OLD_HELMET']] } };
const delta = (detect, { loadout = setup(), prof = profile(), settings = GEMSTONE, gain } = {}) => stepDelta({ text: 's', detect, ...(gain && { gain }) }, loadout, prof, items, settings, guide);
const enchant = (name, level) => ({ kind: 'enchant', on: 'drill', enchant: name, level });

test('enchant gain is the difference to the level on the tool', () => {
  const on5 = setup({ held: piece(DRILL, { enchants: { efficiency: 5 } }) });
  assert.deepEqual(delta(enchant('efficiency', 10), { loadout: on5 }), { MINING_SPEED: 100 });
  assert.deepEqual(delta(enchant('efficiency', 5), { loadout: on5 }), {});
  assert.deepEqual(delta(enchant('efficiency', 10)), { MINING_SPEED: 210 });
});

test('fortune and pristine follow the wiki table', () => {
  assert.deepEqual(delta(enchant('fortune', 4)), { MINING_FORTUNE: 45 });
  assert.deepEqual(delta(enchant('pristine', 5)), { PRISTINE: 2.5 });
});

test('lapidary counts on gemstones only', () => {
  assert.deepEqual(delta(enchant('lapidary', 5)), { GEMSTONE_FORTUNE: 50, MINING_SPEED: 100 });
  assert.equal(delta(enchant('lapidary', 5), { settings: { ...GEMSTONE, gemFortune: false } }), null);
});

test('an enchant without a stat of ours gives {}', () => {
  for (const name of ['experience', 'compact', 'smelting_touch', 'paleontologist']) assert.deepEqual(delta(enchant(name, 1)), {});
});

test('flowstate has no fixed value and gives null', () => {
  assert.equal(delta(enchant('ultimate_flowstate', 3)), null);
});

test('a level past the table gives null', () => {
  assert.equal(delta(enchant('fortune', 9)), null);
});

test('a swap is new minus old base stats, reforge and gems carry over', () => {
  const d = { kind: 'owned', on: [['NEW_HELMET']] };
  const fancy = piece('OLD_HELMET', { reforge: 'jaded', gems: [{ slot: 'JADE_0', type: 'JADE', quality: 'PERFECT' }], lore: { MINING_FORTUNE: 999 } });
  assert.deepEqual(delta(d, { loadout: setup({ armor: [fancy] }) }), { MINING_FORTUNE: 20, MINING_SPEED: 5 });
});

test('an owned rung counts as done and gives no gain', () => {
  assert.deepEqual(delta({ kind: 'owned', on: [['OLD_HELMET']] }), {});
});

test('an item in no slot compares with the best owned item of its category', () => {
  const owned = profile([held, piece('LANTERN_A')]);
  assert.deepEqual(delta({ kind: 'owned', on: [['LANTERN_B']] }, { prof: owned }), { MINING_SPEED: 15 });
});

test('an accessory subtracts the weaker one of its family', () => {
  const ring = piece('LOW_RING', { where: 'accessory' });
  assert.deepEqual(delta({ kind: 'owned', on: [['TOP_RING']] }, { loadout: setup({ accessories: [ring] }), prof: profile([held, ring]) }), { MINING_FORTUNE: 3 });
});

test('a gem upgrade replaces the lower quality, by the rarity of the item', () => {
  const tool = piece(DRILL, { gems: [{ slot: 'AMBER_0', type: 'AMBER', quality: 'FLAWLESS' }, { slot: 'MINING_0', type: 'JADE', quality: 'PERFECT' }, { slot: 'JADE_0', type: 'JADE', quality: 'PERFECT' }] });
  assert.deepEqual(delta({ kind: 'gem', on: 'drill', type: 'AMBER', quality: 'PERFECT', need: 1 }, { loadout: setup({ held: tool }) }), { MINING_SPEED: 80 - 58 });
});

test('a gem counts only for the slots still open', () => {
  const tool = piece(DRILL, { gems: [{ slot: 'JADE_0', type: 'JADE', quality: 'PERFECT' }] });
  // one of two wanted is in: only one more, in the free MINING slot
  assert.deepEqual(delta({ kind: 'gem', on: 'drill', type: 'JADE', quality: 'PERFECT', need: 2 }, { loadout: setup({ held: tool }) }), { MINING_FORTUNE: 40 });
  assert.deepEqual(delta({ kind: 'gem', on: 'drill', type: 'JADE', quality: 'PERFECT', need: 1 }, { loadout: setup({ held: tool }) }), {});
});

test('a gem step without a type has no value', () => {
  assert.equal(delta({ kind: 'gem', on: 'drill', quality: 'PERFECT' }), null);
});

test('a gem step on an item not owned yet uses the rarity of the new item', () => {
  const noTool = setup({ held: null });
  const wanted = { ...items, FUTURE: { category: 'BELT', tier: 'EPIC', gemstone_slots: [{ slot_type: 'AMBER' }] } };
  const d = stepDelta({ text: 's', detect: { kind: 'gem', on: [['FUTURE']], type: 'AMBER', quality: 'PERFECT', need: 1 } }, noTool, profile([]), wanted, GEMSTONE, guide);
  assert.deepEqual(d, { MINING_SPEED: 60 });
});

test('recomb raises the rarity for gems', () => {
  const tool = piece(DRILL, { gems: [{ slot: 'AMBER_0', type: 'AMBER', quality: 'PERFECT' }] });
  assert.deepEqual(delta({ kind: 'recomb', on: 'drill' }, { loadout: setup({ held: tool }) }), { MINING_SPEED: 100 - 80 });
  assert.deepEqual(delta({ kind: 'recomb', on: 'drill' }, { loadout: setup({ held: { ...tool, recomb: true } }) }), {});
});

test('recomb lifts a known reforge and leaves an unknown one out', () => {
  const tool = piece(DRILL, { reforge: 'jaded' });
  assert.deepEqual(delta({ kind: 'recomb', on: 'drill' }, { loadout: setup({ held: tool }) }), { MINING_SPEED: 15, MINING_FORTUNE: 5 });
  assert.deepEqual(delta({ kind: 'recomb', on: 'drill' }, { loadout: setup({ held: { ...tool, reforge: 'nothing_known' } }) }), {});
});

test('a reforge is new minus old, by rarity', () => {
  const r = { kind: 'reforge', on: 'armor', value: ['jaded'] };
  assert.deepEqual(delta(r), { MINING_SPEED: 20, MINING_FORTUNE: 15 });
  assert.deepEqual(delta(r, { loadout: setup({ armor: [piece('OLD_HELMET', { reforge: 'fierce' })] }) }), { MINING_SPEED: 20, MINING_FORTUNE: 15 });
  assert.deepEqual(delta(r, { loadout: setup({ armor: [piece('OLD_HELMET', { reforge: 'dimensional' })] }) }), { MINING_SPEED: 0, MINING_FORTUNE: 15 });
  assert.deepEqual(delta(r, { loadout: setup({ armor: [piece('OLD_HELMET', { reforge: 'jaded' })] }) }), {});
});

test('a reforge without a known value gives null, also when the old one is unknown', () => {
  assert.equal(delta({ kind: 'reforge', on: 'armor', value: ['nothing_known'] }), null);
  assert.equal(delta({ kind: 'reforge', on: 'armor', value: ['jaded'] }, { loadout: setup({ armor: [piece('OLD_HELMET', { reforge: 'nothing_known' })] }) }), null);
});

test('an engine replaces the old one, a tank gives {}', () => {
  const tool = piece(DRILL, { parts: { engine: 'titanium_drill_engine' } });
  assert.deepEqual(delta({ kind: 'part', on: 'drill', ids: ['AMBER_POLISHED_DRILL_ENGINE'] }, { loadout: setup({ held: tool }) }), { MINING_SPEED: 450, MINING_FORTUNE: 85 });
  assert.deepEqual(delta({ kind: 'part', on: 'drill', ids: ['PERFECTLY_CUT_FUEL_TANK'] }), {});
  assert.deepEqual(delta({ kind: 'part', on: 'drill', ids: ['TITANIUM_DRILL_ENGINE', 'AMBER_POLISHED_DRILL_ENGINE'] }, { loadout: setup({ held: tool }) }), {});
});

test('sunny side gives 50 fortune, blue cheese one level on all perks', () => {
  assert.deepEqual(delta({ kind: 'part', on: 'drill', ids: ['GOBLIN_OMELETTE_SUNNY_SIDE'] }), { MINING_FORTUNE: 50 });
  const prof = profile(undefined, { hotm: { experience: 0, nodes: { mining_speed: 10, mining_fortune: 5, mining_master: 0 } } });
  assert.deepEqual(delta({ kind: 'part', on: 'drill', ids: ['GOBLIN_OMELETTE_BLUE_CHEESE'] }, { prof }), { MINING_SPEED: 20, MINING_FORTUNE: 2 });
});

test('an unknown old module gives null', () => {
  const tool = piece(DRILL, { parts: { upgrade_module: 'something_else' } });
  assert.equal(delta({ kind: 'part', on: 'drill', ids: ['GOBLIN_OMELETTE_SUNNY_SIDE'] }, { loadout: setup({ held: tool }) }), null);
});

test('polarvoid counts the open books and the fortune once', () => {
  const d = { kind: 'polarvoid', on: 'drill', need: 5 };
  assert.deepEqual(delta(d), { MINING_SPEED: 50, MINING_FORTUNE: 5 });
  assert.deepEqual(delta(d, { loadout: setup({ held: piece(DRILL, { polarvoid: 2 }) }) }), { MINING_SPEED: 30 });
  assert.deepEqual(delta(d, { loadout: setup({ held: piece(DRILL, { polarvoid: 5 }) }) }), {});
});

test('coating gives 500 speed on a drill and 10 fortune on armor', () => {
  assert.deepEqual(delta({ kind: 'coating', on: 'drill', need: 1 }), { MINING_SPEED: 500 });
  assert.deepEqual(delta({ kind: 'coating', on: 'armor' }), { MINING_FORTUNE: 10 });
  assert.deepEqual(delta({ kind: 'coating', on: 'drill', need: 1 }, { loadout: setup({ held: piece(DRILL, { coating: true }) }) }), {});
});

test('the amber power scroll gives null', () => {
  assert.equal(delta({ kind: 'scroll', on: 'drill', value: 'AMBER_POWER_SCROLL', need: 1 }), null);
});

test('perk and attr steps come from computeStats on a changed copy', () => {
  assert.deepEqual(delta({ kind: 'perk', perk: 'mining_speed', level: 10 }), { MINING_SPEED: 200 });
  assert.deepEqual(delta({ kind: 'attr', attr: 'rotten_pickaxe', need: 96 }), { MINING_SPEED: 30 });
  assert.equal(delta({ kind: 'perk', perk: 'maniac_miner', level: 10 }), null);
  assert.equal(delta({ kind: 'perk', perk: 'mining_speed', level: 10 }, { prof: profile(undefined, { hotm: null }) }), null);
});

test('the gain field is the fallback, never on top of a computed delta', () => {
  assert.deepEqual(delta({ kind: 'scroll', on: 'drill', value: 'X' }, { gain: { MINING_SPEED: 7 } }), { MINING_SPEED: 7 });
  assert.deepEqual(delta(enchant('experience', 1), { gain: { MINING_SPEED: 7 } }), { MINING_SPEED: 7 });
  assert.deepEqual(delta(enchant('fortune', 1), { gain: { MINING_SPEED: 7 } }), { MINING_FORTUNE: 10 });
  assert.deepEqual(stepDelta({ text: 's', gain: { PRISTINE: 1 } }, setup(), profile(), items, GEMSTONE, guide), { PRISTINE: 1 });
});

test('a step with nothing to go on gives null', () => {
  assert.equal(stepDelta({ text: 's' }, setup(), profile(), items, GEMSTONE, guide), null);
});

test('parts of a step add up, one part with null makes the whole step null', () => {
  assert.deepEqual(delta([enchant('fortune', 1), enchant('efficiency', 1)]), { MINING_FORTUNE: 10, MINING_SPEED: 30 });
  assert.equal(delta([enchant('fortune', 1), { kind: 'scroll', on: 'drill', value: 'X' }]), null);
});

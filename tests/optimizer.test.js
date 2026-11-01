import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { blazeOutput, blazeState, OFA } from '../blaze.js';
import { SCORES, rankArea, bestBlaze, blazeDelta, applyBlaze, accessoryPower, stepDelta, PRESETS, miningSettings, rankUpgrades, netCost, bestLoadout, bestValueView } from '../optimizer.js';
import { summarize } from '../profile.js';
import { GEMSTONE, miningScore, loadoutOf } from '../stats.js';
import { guideStats, progressView, validGuide, exportData } from '../progress.js';

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

const softcap = (s) => Math.ceil((20 * s.blockStrength) / 3);
const pick = ({ blockStrength, wF, wS, wP }) => ({ blockStrength, wF, wS, wP });

test('presets hold the spec values', () => {
  assert.deepEqual(pick(PRESETS.gemstone), { blockStrength: 3000, wF: 1, wS: 1, wP: 1 });
  assert.deepEqual(pick(PRESETS.mithril), { blockStrength: 500, wF: 1, wS: 1, wP: 0 });
  assert.deepEqual(pick(PRESETS.glacite), { blockStrength: 6000, wF: 1, wS: 1, wP: 0 });
  assert.equal(softcap(PRESETS.gemstone), 20000);
  assert.equal(softcap(PRESETS.mithril), 3334);
  assert.equal(softcap(PRESETS.glacite), 40000);
});

test('gemFortune false leaves gemstone fortune out of the score', () => {
  assert.equal(miningScore({ GEMSTONE_FORTUNE: 900 }, { GEMSTONE_FORTUNE: 10 }, PRESETS.mithril), 0);
  assert.equal(miningScore({ GEMSTONE_FORTUNE: 900 }, { MINING_FORTUNE: 10 }, PRESETS.mithril), 10 / 100);
});

test('gemFortune left out counts it, so old calls stay the same', () => {
  assert.equal(miningScore({ GEMSTONE_FORTUNE: 900 }, { GEMSTONE_FORTUNE: 10 }, GEMSTONE), 10 / 1000);
});

test('miningSettings replaces an empty, negative or unreadable field by the preset value', () => {
  const s = miningSettings({ preset: 'mithril', wF: '', wS: -2, wP: 'x', blockStrength: '750' });
  assert.deepEqual(s, { preset: 'mithril', wF: 1, wS: 1, wP: 0, blockStrength: 750, gemFortune: false });
  assert.equal(miningSettings(null).preset, 'gemstone');
  assert.equal(miningSettings({ preset: 'constructor' }).preset, 'gemstone');
  assert.equal(miningSettings({ wF: 0 }).wF, 0);
});

test('a block strength of 0 falls back to the preset', () => {
  assert.equal(miningSettings({ preset: 'glacite', blockStrength: 0 }).blockStrength, 6000);
});

test('with the mithril preset the tool is picked by its mithril score', () => {
  const gemTool = piece('GEM_TOOL', { where: 'inventory', lore: { GEMSTONE_FORTUNE: 200 } });
  const oreTool = piece('ORE_TOOL', { where: 'inventory', lore: { MINING_FORTUNE: 20 } });
  const data = { GEM_TOOL: { category: 'DRILL' }, ORE_TOOL: { category: 'DRILL' } };
  const prof = { items: [gemTool, oreTool], pets: [], wardrobe: { armor: { equipped: 1, sets: [1] }, equipment: { equipped: 1, sets: [1] } } };
  assert.equal(loadoutOf(prof, data, 'mining', null).held.id, 'GEM_TOOL');
  assert.equal(loadoutOf(prof, data, 'mining', null, PRESETS.mithril).held.id, 'ORE_TOOL');
});

const speed = (n, extra = {}) => ({ detect: { kind: 'perk', perk: 'mining_speed', level: n }, ...extra });
const bought = (id) => ({ items: [{ id, qty: 1 }] });
const sold = (price) => ({ buy_summary: [{ pricePerUnit: price, amount: 100 }] });
const rankGuide = (...steps) => ({ groups: guide.groups, sections: [{ name: 'Main', steps: steps.map((s, i) => ({ text: s.text ?? `step ${i}`, ...s })) }] });
const rank = (g, { products = {}, base = { MINING_SPEED: 1000 }, checked = new Set(), prof = profile(), data = items, opts } = {}) =>
  rankUpgrades(g, checked, { products, profile: prof, items: data }, setup(), GEMSTONE, base, opts);
const texts = (rows) => rows.map((r) => r.step.text);
const gainOf = (stats) => ({ gain: stats });

test('ranked by gain per million, best first', () => {
  const g = rankGuide({ text: 'dear', ...gainOf({ MINING_SPEED: 100 }), ...bought('A') }, { text: 'cheap', ...gainOf({ MINING_SPEED: 50 }), ...bought('B') });
  const out = rank(g, { products: { A: sold(10e6), B: sold(1e6) } });
  assert.deepEqual(texts(out.ranked), ['cheap', 'dear']);
  assert.ok(Math.abs(out.ranked[0].gain - 0.05) < 1e-9);
  assert.ok(Math.abs(out.ranked[0].perMillion - 0.05) < 1e-9);
});

test('a table step with a gain is free, no rank', () => {
  const out = rank(rankGuide({ text: 't', table: true, ...gainOf({ MINING_SPEED: 10 }) }));
  assert.deepEqual(texts(out.free), ['t']);
  assert.equal(out.ranked.length, 0);
});

test('a score of 0 or less goes to zero, no rank and not free', () => {
  const g = rankGuide({ text: 'tank', detect: { kind: 'part', on: 'drill', ids: ['PERFECTLY_CUT_FUEL_TANK'] }, table: true }, { text: 'worse', ...gainOf({ MINING_SPEED: -5 }), ...bought('A') });
  const out = rank(g, { products: { A: sold(1e6) } });
  assert.deepEqual(texts(out.zero).sort(), ['tank', 'worse']);
  assert.equal(out.free.length + out.ranked.length, 0);
});

test('speed above the softcap goes to zero', () => {
  const out = rank(rankGuide({ text: 'x', ...gainOf({ MINING_SPEED: 100 }), ...bought('A') }), { products: { A: sold(1e6) }, base: { MINING_SPEED: 20000 } });
  assert.deepEqual(texts(out.zero), ['x']);
});

test('a sum missing a price goes to noPrice, never ranked', () => {
  const out = rank(rankGuide({ text: 'x', ...gainOf({ MINING_SPEED: 10 }), items: [{ id: 'A', qty: 1 }, { id: 'NO_PRICE', qty: 1 }] }), { products: { A: sold(1e6) } });
  assert.deepEqual(texts(out.noPrice), ['x']);
  assert.equal(out.noPrice[0].unpriced, 1);
});

test('a step with a gain and nothing to buy goes to noPrice', () => {
  assert.deepEqual(texts(rank(rankGuide({ text: 'x', ...gainOf({ MINING_SPEED: 10 }) })).noPrice), ['x']);
});

test('a delta of null goes to noGain', () => {
  assert.deepEqual(texts(rank(rankGuide({ text: 'x', detect: { kind: 'scroll', on: 'drill', value: 'A' }, ...bought('A') }), { products: { A: sold(1) } }).noGain), ['x']);
});

const lockedData = { ...items, HARD: { requirements: [{ type: 'HEART_OF_THE_MOUNTAIN', tier: 7 }] } };

test('locked goes to its own group with its reason', () => {
  const out = rank(rankGuide({ text: 'x', ...gainOf({ MINING_SPEED: 10 }), ...bought('HARD') }), { products: { HARD: sold(1e6) }, data: lockedData });
  assert.deepEqual(texts(out.locked), ['x']);
  assert.match(out.locked[0].reasons[0], /HOTM 7 needed/);
  assert.equal(out.ranked.length, 0);
});

test('unknown stays in the ranking and is marked', () => {
  const data = { ...items, ODD: { requirements: [{ type: 'GARDEN_LEVEL', tier: 2 }] } };
  const out = rank(rankGuide({ text: 'x', ...gainOf({ MINING_SPEED: 10 }), ...bought('ODD') }), { products: { ODD: sold(1e6) }, data });
  assert.deepEqual(texts(out.ranked), ['x']);
  assert.equal(out.ranked[0].status, 'unknown');
});

test('a step of 0 gain in a line adds up to the first step with a gain', () => {
  const g = rankGuide(
    { text: 'first', line: 'L', detect: { kind: 'part', on: 'drill', ids: ['PERFECTLY_CUT_FUEL_TANK'] }, ...bought('A') },
    { text: 'second', line: 'L', ...gainOf({ MINING_SPEED: 100 }), ...bought('B') },
    { text: 'third', line: 'L', ...gainOf({ MINING_SPEED: 900 }), ...bought('C') },
  );
  const [row] = rank(g, { products: { A: sold(1e6), B: sold(2e6), C: sold(1) } }).ranked;
  assert.equal(row.step.text, 'first');
  assert.equal(row.ahead.text, 'second');
  assert.equal(row.coins, 3e6);
  assert.ok(Math.abs(row.gain - 0.1) < 1e-9);
});

test('a line of books counts the last book only', () => {
  const book = (level) => ({ items: [{ id: `ENCHANTMENT_X_${level}`, qty: 1, combine: 0 }] });
  const g = rankGuide(
    { text: 'I', line: 'B', detect: enchant('experience', 1), ...book(1) },
    { text: 'II', line: 'B', ...gainOf({ MINING_SPEED: 10 }), ...book(2) },
  );
  const [row] = rank(g, { products: { ENCHANTMENT_X_1: sold(1e6), ENCHANTMENT_X_2: sold(4e6) } }).ranked;
  assert.equal(row.coins, 4e6);
});

test('a locked step ahead in the line locks the row', () => {
  const g = rankGuide({ text: 'first', line: 'L', detect: enchant('experience', 1), ...bought('A') }, { text: 'second', line: 'L', ...gainOf({ MINING_SPEED: 1 }), ...bought('HARD') });
  assert.deepEqual(texts(rank(g, { products: { A: sold(1), HARD: sold(1) }, data: lockedData }).locked), ['first']);
});

test('a line with no gain at all goes to zero', () => {
  const g = rankGuide({ text: 'first', line: 'L', detect: enchant('experience', 1) }, { text: 'second', line: 'L', detect: enchant('compact', 1) });
  assert.deepEqual(texts(rank(g).zero), ['first']);
});

test('the score uses the base with the offset', () => {
  const g = rankGuide({ text: 'fort', ...gainOf({ MINING_FORTUNE: 10 }), ...bought('A') }, { text: 'spd', ...gainOf({ MINING_SPEED: 50 }), ...bought('A') });
  const products = { A: sold(1e6) };
  const low = { MINING_SPEED: 500, MINING_FORTUNE: 900 }; // speed leads
  const offset = { MINING_SPEED: 10000, MINING_FORTUNE: 0 }; // what /stats added makes fortune lead
  assert.equal(rank(g, { products, base: low }).ranked[0].step.text, 'spd');
  assert.equal(rank(g, { products, base: { MINING_SPEED: low.MINING_SPEED + offset.MINING_SPEED, MINING_FORTUNE: 900 } }).ranked[0].step.text, 'fort');
});

test('priority does not change the order', () => {
  const g = rankGuide({ text: 'pinned', priority: 5, ...gainOf({ MINING_SPEED: 1 }), ...bought('A') }, { text: 'good', ...gainOf({ MINING_SPEED: 100 }), ...bought('A') });
  assert.deepEqual(texts(rank(g, { products: { A: sold(1e6) } }).ranked), ['good', 'pinned']);
});

test('a new tick moves the line on to its next step', () => {
  const g = rankGuide({ text: 'one', line: 'L', ...gainOf({ MINING_SPEED: 10 }), ...bought('A') }, { text: 'two', line: 'L', ...gainOf({ MINING_SPEED: 10 }), ...bought('A') });
  assert.deepEqual(texts(rank(g, { products: { A: sold(1e6) }, checked: new Set(['Main|one']) }).ranked), ['two']);
});

const swap = { detect: { kind: 'owned', on: [['NEW_HELMET']] }, items: [{ id: 'NEW_HELMET', qty: 1 }] };
const orders = (price) => ({ sell_summary: [{ pricePerUnit: price, amount: 10 }] });
const netOf = ({ step = swap, gross = 20e6, loadout = setup(), other = null, ctx = {}, keep = false, data = items } = {}) =>
  netCost(step, gross, loadout, other, data, { profile: profile(), guide, tax: 0.0125, products: {}, ...ctx }, keep);

test('net is the price minus the bazaar sell price after the bazaar tax', () => {
  const out = netOf({ ctx: { products: { OLD_HELMET: orders(8e6) } } });
  assert.equal(out.resale, 8e6 * 0.9875);
  assert.equal(out.net, 20e6 - 8e6 * 0.9875);
  assert.deepEqual(out.soldIds, ['OLD_HELMET']);
});

test('without a bazaar price it takes the BIN after ahNet', () => {
  // 10M: 2 % listing fee and 1 % tax on collecting
  assert.equal(netOf({ ctx: { ah: { OLD_HELMET: 10e6 } } }).resale, 10e6 - 200000 - 100000);
  assert.equal(netOf({ ctx: { cofl: { OLD_HELMET: 10e6 }, derpy: true } }).resale, 10e6 - 200000 - 400000);
});

test('a forge ingredient or prestige step sells nothing', () => {
  const products = { OLD_HELMET: orders(8e6) };
  assert.equal(netOf({ ctx: { products, forge: { NEW_HELMET: { d: 1, i: { OLD_HELMET: 1 } } } } }).resale, 0);
  assert.equal(netOf({ ctx: { products }, step: { ...swap, items: [{ id: 'NEW_HELMET', qty: 1, without: ['OLD_HELMET'] }] } }).resale, 0);
  const data = { ...items, NEW_HELMET: { ...items.NEW_HELMET, prestige: { item_id: 'OLD_HELMET' } } };
  assert.equal(netCost(swap, 20e6, setup(), null, data, { profile: profile(), guide, products, items: data }, false).resale, 0);
});

test('a piece in the other area loadout sells nothing', () => {
  const other = setup({ armor: [piece('OLD_HELMET')] });
  assert.equal(netOf({ other, ctx: { products: { OLD_HELMET: orders(8e6) } } }).resale, 0);
});

test('a piece without a price or marked nt sells nothing', () => {
  assert.equal(netOf().resale, 0);
  assert.equal(netOf({ ctx: { products: { OLD_HELMET: orders(8e6) }, nt: new Set(['OLD_HELMET']) } }).resale, 0);
});

test('a piece not owned or no sync means the gross price', () => {
  assert.equal(netOf({ loadout: setup({ armor: [] }), ctx: { products: { OLD_HELMET: orders(8e6) } } }).net, 20e6);
  assert.equal(netCost(swap, 20e6, setup(), null, items, { profile: null, guide, products: { OLD_HELMET: orders(8e6) } }, false).net, 20e6);
});

test('keepOldGear means the gross price', () => {
  assert.equal(netOf({ keep: true, ctx: { products: { OLD_HELMET: orders(8e6) } } }).net, 20e6);
});

test('only an item swap has a resale, an enchant keeps the gross price', () => {
  assert.equal(netOf({ step: { detect: enchant('fortune', 1) }, ctx: { products: { OLD_HELMET: orders(8e6) } } }).net, 20e6);
});

test('net is never below 0', () => {
  const out = netOf({ gross: 1e6, ctx: { products: { OLD_HELMET: orders(8e6) } } });
  assert.equal(out.net, 0);
});

test('a resale above the price makes the step free', () => {
  const g = rankGuide({ text: 'x', ...swap });
  const out = rank(g, { products: { NEW_HELMET: sold(1e6), OLD_HELMET: orders(8e6) }, base: { MINING_FORTUNE: 100 } });
  assert.deepEqual(texts(out.free), ['x']);
  assert.equal(out.free[0].net, 0);
});

test('By slot sums stay gross', () => {
  const g = rankGuide({ text: 'x', ...swap });
  const ctx = { products: { NEW_HELMET: sold(5e6), OLD_HELMET: orders(1e6) }, profile: profile(), items };
  assert.equal(guideStats(g, new Set(), ctx).sections[0].coins, 5e6);
});

const armorItems = { H1: { category: 'HELMET' }, H2: { category: 'HELMET' }, B1: { category: 'BOOTS' }, B2: { category: 'BOOTS' }, RING: { category: 'ACCESSORY' }, HELM_ACC: { category: 'HELMET' } };
const stat = (id, lore, where = 'armor') => piece(id, { where, lore });

test('bestLoadout picks per slot the owned item with the highest score', () => {
  const h1 = stat('H1', { MINING_FORTUNE: 10 });
  const h2 = stat('H2', { MINING_FORTUNE: 40 }, 'ender_chest');
  const out = bestLoadout({ items: [h1, h2] }, armorItems, setup({ armor: [h1], held: null }), { MINING_FORTUNE: 100, MINING_SPEED: 1000 }, GEMSTONE);
  assert.deepEqual(out.slots, [{ slot: 'HELMET', current: h1, best: h2 }]);
  assert.ok(Math.abs(out.gain - 30 / 200) < 1e-9);
});

test('each pick builds on the ones before it', () => {
  const h = stat('H2', { MINING_SPEED: 1000 }, 'backpack');
  const b = stat('B1', { MINING_SPEED: 500 }, 'backpack');
  const b2 = stat('B2', { MINING_FORTUNE: 5 }, 'backpack');
  // with 1000 speed from the helmet the softcap makes the boots with speed worth nothing
  const out = bestLoadout({ items: [h, b, b2] }, armorItems, setup({ armor: [], held: null }), { MINING_SPEED: 19000, MINING_FORTUNE: 0 }, GEMSTONE);
  assert.equal(out.slots.find((s) => s.slot === 'BOOTS').best.id, 'B2');
});

test('a slot already best is not listed and the gain is 0', () => {
  const h1 = stat('H1', { MINING_FORTUNE: 40 });
  const out = bestLoadout({ items: [h1, stat('H2', { MINING_FORTUNE: 40 }, 'backpack')] }, armorItems, setup({ armor: [h1], held: null }), { MINING_FORTUNE: 40 }, GEMSTONE);
  assert.deepEqual(out, { slots: [], gain: 0 });
});

test('an item in the chest or a backpack counts, an accessory does not', () => {
  const inBag = stat('HELM_ACC', { MINING_FORTUNE: 99 }, 'accessory');
  assert.equal(bestLoadout({ items: [inBag] }, armorItems, setup({ armor: [], held: null }), {}, GEMSTONE).slots.length, 0);
  assert.equal(bestLoadout({ items: [stat('H1', { MINING_FORTUNE: 9 }, 'ender_chest')] }, armorItems, setup({ armor: [], held: null }), {}, GEMSTONE).slots.length, 1);
});

const mineGuide = (over = {}) => ({ id: 'm', title: 'Mine', area: 'mining', groups: guide.groups, sections: [{ name: 'Main', steps: [{ text: 'cheap', gain: { MINING_FORTUNE: 10, MINING_SPEED: 40 }, items: [{ id: 'A', qty: 1 }] }] }], ...over });
const summary = () => ({ ...profile([piece(DRILL, { where: 'inventory', lore: { MINING_SPEED: 1000 } })]), wardrobe: { armor: { equipped: 1, sets: [1] }, equipment: { equipped: 1, sets: [1] } } });
const view = (g, { state = { summary: summary(), syncedAt: 1 }, products = { A: sold(5e6) }, data = items } = {}) => progressView({ guides: [g], current: g.id, checked: new Set(), products, prices: { items: data }, name: (id) => id, mode: 'best', profile: state?.summary ?? null,
  bestValue: (v) => bestValueView({ ...v, state, settings: miningSettings(null) }) });

test('the mode button shows only on a guide with area mining', () => {
  assert.match(view(mineGuide()), /data-guide-mode="best" aria-pressed="true"/);
  assert.doesNotMatch(view(mineGuide({ area: undefined })), /data-guide-mode="best"/);
});

test('a saved best mode on a guide without area shows By slot', () => {
  const html = view(mineGuide({ area: undefined }));
  assert.match(html, /data-guide-mode="slot" aria-pressed="true"/);
  assert.match(html, /Next step/);
});

test('without a sync the mode says what is missing and links to the settings', () => {
  const html = view(mineGuide(), { state: null });
  assert.match(html, /Sync your profile/);
  assert.match(html, /data-open-settings/);
});

test('without item data the mode waits and does not throw', () => {
  assert.match(view(mineGuide(), { data: null }), /Loading item data/);
});

test('the row shows yield, per million, raw stats and the net line', () => {
  const html = view(mineGuide({ sections: [{ name: 'Main', steps: [{ text: 's', detect: { kind: 'owned', on: [['NEW_HELMET']] }, items: [{ id: 'NEW_HELMET', qty: 1 }] }] }] }), {
    products: { NEW_HELMET: sold(20e6), OLD_HELMET: orders(8e6) },
    state: { summary: { ...profile([piece('OLD_HELMET', { sets: ['armor:1'] })]), wardrobe: { armor: { equipped: 1, sets: [1] }, equipment: { equipped: 1, sets: [1] } } }, syncedAt: 1 },
  });
  assert.match(html, /\+\d+(\.\d+)? % yield · \d+(\.\d+)? %\/1M/);
  assert.match(html, /\+20 Fortune, \+5 Speed/);
  assert.match(html, /Net .* \(buy .* − resale .*\)/);
  assert.match(view(mineGuide()), /\+10 Fortune, \+40 Speed/);
});

test('locked rows stand under the ranking with their reason, no rank', () => {
  const html = view(mineGuide({ sections: [{ name: 'Main', steps: [{ text: 'open', gain: { MINING_SPEED: 10 }, items: [{ id: 'A', qty: 1 }] }, { text: 'hard', gain: { MINING_SPEED: 10 }, items: [{ id: 'HARD', qty: 1 }] }] }] }), { products: { A: sold(1e6), HARD: sold(1e6) }, data: lockedData });
  const best = html.indexOf('aria-label="Best value"');
  const locked = html.indexOf('aria-label="Locked"');
  assert.ok(best > 0 && locked > best);
  assert.match(html.slice(locked), /hard/);
  assert.match(html.slice(locked), /HOTM 7 needed/);
  assert.doesNotMatch(html.slice(locked), /%\/1M/);
  assert.doesNotMatch(html.slice(best, locked), /hard/);
});

test('the best card names the slot of the wardrobe and what stays out', () => {
  const worn1 = piece('OLD_HELMET', { sets: ['armor:1'], lore: { MINING_FORTUNE: 1 } });
  const spare = piece('NEW_HELMET', { where: 'ender_chest', lore: { MINING_FORTUNE: 100 } });
  const state = { summary: { ...profile([worn1, spare]), wardrobe: { armor: { equipped: 1, sets: [1] }, equipment: { equipped: 1, sets: [1] } } }, syncedAt: 1 };
  const html = view(mineGuide(), { state });
  assert.match(html, /Best possible/);
  assert.match(html, /OLD_HELMET → NEW_HELMET/);
  assert.match(html, /Pet stays as picked/);
});

test('the notes say when the offset is not in use', () => {
  const base = { summary: summary(), syncedAt: 5 };
  assert.match(view(mineGuide(), { state: base }), /Save your \/stats/);
  const entry = { choice: { armor: 1, equipment: 1, pet: null }, values: {}, offset: {}, offsetFor: { armor: 1, equipment: 1, pet: null }, offsetNote: 'boost', at: 1 };
  const html = view(mineGuide(), { state: { ...base, statsInput: { mining: entry } } });
  assert.match(html, /do not match the God Potion/);
  assert.match(html, /older than the last sync/);
});

test('the mithril preset warns that fortune reads low', () => {
  const html = progressView({ guides: [mineGuide()], current: 'm', checked: new Set(), products: {}, prices: { items }, name: String, mode: 'best', profile: summary(),
    bestValue: (v) => bestValueView({ ...v, state: { summary: summary(), syncedAt: 1 }, settings: miningSettings({ preset: 'mithril' }) }) });
  assert.match(html, /Target: Mithril/);
  assert.match(html, /fortune steps read low/);
});

test('names and reasons are escaped', () => {
  const data = { ...items, HARD: { requirements: [{ type: 'COLLECTION', collection: '<b>', tier: 1 }] } };
  const html = view(mineGuide({ sections: [{ name: 'Main', steps: [{ text: '<i>x', line: 'L', gain: { MINING_SPEED: 1 }, items: [{ id: 'HARD', qty: 1 }] }] }] }), { products: { HARD: sold(1) }, data, state: { summary: { ...summary(), collTiers: [] }, syncedAt: 1 } });
  assert.doesNotMatch(html, /<i>x|<b>/);
});

test('the export after a sync still holds no offset or in-game value', () => {
  const text = exportData([mineGuide()], { m: ['Main|cheap'] });
  assert.doesNotMatch(text, /offset|statsInput|inGame/);
});

test('a piece in the picked Blaze slot keeps its resale out of the view', () => {
  const helmet = piece('OLD_HELMET', { sets: ['armor:1'] });
  const steps = [{ text: 's', detect: { kind: 'owned', on: [['NEW_HELMET']] }, items: [{ id: 'NEW_HELMET', qty: 1 }] }];
  const state = { summary: { ...profile([helmet]), wardrobe: { armor: { equipped: 1, sets: [1] }, equipment: { equipped: 1, sets: [1] } } }, syncedAt: 1, statsInput: { blaze: { choice: { armor: 1, equipment: 1 } } } };
  const html = view(mineGuide({ sections: [{ name: 'Main', steps }] }), { state, products: { NEW_HELMET: sold(20e6), OLD_HELMET: orders(8e6) } });
  assert.doesNotMatch(html, /resale/);
});

const FIXTURE = 'personal/fixtures/profile-fixture.json';
const ITEMS = 'personal/items.json';
const GUIDE = 'personal/guides/mining.json';
test('the real mining guide ranks without error and every group is an array', { skip: !(existsSync(FIXTURE) && existsSync(ITEMS) && existsSync(GUIDE)) }, async () => {
  const realGuide = validGuide(JSON.parse(readFileSync(GUIDE, 'utf8')));
  const prof = await summarize(JSON.parse(readFileSync(FIXTURE, 'utf8')).members.self);
  const data = JSON.parse(readFileSync(ITEMS, 'utf8')).r;
  const settings = miningSettings(null);
  const loadout = loadoutOf(prof, data, 'mining', null, settings);
  const out = rankUpgrades(realGuide, new Set(), { products: {}, profile: prof, items: data }, loadout, settings, {});
  for (const rows of Object.values(out)) assert.ok(Array.isArray(rows));
  assert.equal(realGuide.area, 'mining');
});

// Blaze
const DAGGERS_TEST = new Set(['FIREDUST_DAGGER', 'MAWDUST_DAGGER']);
const FIRE = 'FIREDUST_DAGGER'; const KINDLE = 'BURSTFIRE_DAGGER'; const MAW = 'MAWDUST_DAGGER';
const blazeItems = {
  [FIRE]: { category: 'SWORD', tier: 'EPIC', stats: { DAMAGE: 90, STRENGTH: 45, CRITICAL_DAMAGE: 15 } },
  [KINDLE]: { category: 'SWORD', tier: 'EPIC', stats: { DAMAGE: 130, STRENGTH: 55, CRITICAL_DAMAGE: 20, ATTACK_SPEED: 10 } },
  [MAW]: { category: 'SWORD', tier: 'EPIC', stats: { DAMAGE: 90, STRENGTH: 45, CRITICAL_DAMAGE: 15 } },
  PLATE: { category: 'CHESTPLATE', tier: 'LEGENDARY', gemstone_slots: [{ slot_type: 'DEFENSIVE' }, { slot_type: 'JADE' }], stats: { TRUE_DEFENSE: 10, STRENGTH: 5, HEALTH: 7 } },
  BOOT: { category: 'BOOTS', tier: 'RARE', stats: {} },
  INFERNAL_CRIMSON_CHESTPLATE: { category: 'CHESTPLATE', tier: 'MYTHIC', stats: { STRENGTH: 60 } },
  INFERNAL_CRIMSON_BOOTS: { category: 'BOOTS', tier: 'MYTHIC', stats: { STRENGTH: 40 } },
  RARE_RING: { category: 'ACCESSORY', tier: 'RARE', family: 'RING', stats: { STRENGTH: 1 } },
  TOP_RING: { category: 'ACCESSORY', tier: 'LEGENDARY', family: 'RING', stats: { STRENGTH: 3 } },
  NEW_ONE: { category: 'ACCESSORY', tier: 'EPIC', stats: {} },
  HEGEMONY_ARTIFACT: { category: 'ACCESSORY', tier: 'LEGENDARY' },
  RIFT_PRISM: { category: 'ACCESSORY', tier: 'RARE' },
};
const blazeGuide = { groups: { weapons: [[FIRE, KINDLE], [MAW]], armor: [['PLATE'], ['BOOT']] } };
const fire = (extra = {}) => piece(FIRE, { where: 'inventory', lore: { DAMAGE: 90, STRENGTH: 45 }, ...extra });
const maw = (extra = {}) => piece(MAW, { where: 'inventory', lore: { DAMAGE: 90, STRENGTH: 45 }, ...extra });
const blazeWorld = ({ daggers = { ashen: fire(), spirit: maw() }, armor = [piece('PLATE')], prof = {}, pet = null } = {}) => {
  const list = [...Object.values(daggers).filter(Boolean), ...armor];
  const loadout = { armor, equipment: [], held: null, accessories: [], pet, gaps: [], daggers };
  const profile2 = { items: list, pets: [], hotm: null, skills: null, collTiers: null, attrs: {}, slayer: null, mp: 900, selectedPower: null, tuning: null, ...prof };
  return { loadout, profile: profile2, state: blazeState({ STRENGTH: 100, CRITICAL_CHANCE: 100, CRITICAL_DAMAGE: 100, TRUE_DEFENSE: 150 }, loadout, daggers) };
};
const blazeOf = (detect, world = blazeWorld(), gain) => blazeDelta({ text: 's', ...(detect && { detect }), ...(gain && { gain }) }, world.state, world.loadout, world.profile, blazeItems, miningSettings(null), blazeGuide);
const onDaggers = (name, level) => ({ kind: 'enchant', on: 'weapons', enchant: name, level, need: 2 });

test('sharpness on both daggers raises the additive of both lines', () => {
  const w = blazeWorld();
  const after = applyBlaze(w.state, blazeOf(onDaggers('sharpness', 7), w));
  assert.ok(Math.abs(blazeOutput(after) / blazeOutput(w.state) - 1.5) < 1e-9);
});

test('smoldering adds like sharpness', () => {
  const w = blazeWorld();
  const after = applyBlaze(w.state, blazeOf(onDaggers('smoldering', 5), w));
  assert.ok(Math.abs(blazeOutput(after) / blazeOutput(w.state) - 1.3) < 1e-9);
});

test('with one for all active a sharpness step gives 0 and a hint', () => {
  const w = blazeWorld({ daggers: { ashen: fire({ enchants: { [OFA]: 1 } }), spirit: maw({ enchants: { [OFA]: 1 } }) } });
  const change = blazeOf(onDaggers('sharpness', 7), w);
  assert.equal(blazeOutput(applyBlaze(w.state, change)), blazeOutput(w.state));
  assert.ok(change.notes.includes('Not used with One For All.'));
});

test('the one for all step removes the guide enchants and adds 500', () => {
  const w = blazeWorld({ daggers: { ashen: fire({ enchants: { sharpness: 7 } }), spirit: maw({ enchants: { sharpness: 7 } }) } });
  const after = applyBlaze(w.state, blazeOf(onDaggers(OFA, 1), w));
  assert.equal(after.path, 'ofa');
  assert.equal(w.state.path, 'guide');
  assert.ok(Math.abs(blazeOutput(after) / blazeOutput(w.state) - 6 / 1.5) < 1e-9);
});

test('critical adds crit damage on the dagger it goes on', () => {
  const change = blazeOf(onDaggers('critical', 7));
  assert.deepEqual(change.lines.ashen, { CRITICAL_DAMAGE: 100 });
  assert.deepEqual(change.lines.spirit, { CRITICAL_DAMAGE: 100 });
  assert.deepEqual(change.common, {});
});

test('an enchant without a fixed value gives null, a proven non-damage one nothing', () => {
  for (const name of ['giant_killer', 'execute', 'thunderlord', 'fire_aspect', 'smite', 'pyroclasm', 'ultimate_chimera']) assert.equal(blazeOf(onDaggers(name, 1)), null, name);
  const w = blazeWorld();
  assert.equal(blazeOutput(applyBlaze(w.state, blazeOf(onDaggers('looting', 5), w))), blazeOutput(w.state));
});

test('a dagger upgrade replaces the stats and multiplier of its line only', () => {
  const w = blazeWorld();
  const change = blazeDelta({ text: 's', detect: { kind: 'owned', on: [[KINDLE, 'HEARTFIRE_DAGGER']] } }, w.state, w.loadout, w.profile, blazeItems, miningSettings(null), blazeGuide);
  const after = applyBlaze(w.state, change);
  assert.equal(after.daggers.ashen.id, KINDLE);
  assert.equal(after.daggers.ashen.lore.DAMAGE, 130);
  assert.equal(after.daggers.spirit.id, MAW);
  assert.equal(after.daggers.ashen.lore.ATTACK_SPEED, 10);
});

test('the missing dagger is named', () => {
  const w = blazeWorld({ daggers: { ashen: fire(), spirit: null } });
  const change = blazeOf({ kind: 'owned', on: [[MAW]] }, w);
  assert.deepEqual(change.missing, ['spirit']);
  assert.equal(applyBlaze(w.state, change).daggers.spirit.lore.DAMAGE, 90);
});

test('fabled, withered and coldfused follow the table, coldfused adds its bonus with a wisp', () => {
  const r = (name) => ({ kind: 'reforge', on: 'weapons', value: [name] });
  assert.deepEqual(blazeOf(r('fabled')).lines.ashen, { STRENGTH: 50, CRITICAL_DAMAGE: 32 });
  assert.deepEqual(blazeOf(r('withered')).lines.ashen, { STRENGTH: 110 });
  assert.deepEqual(blazeOf(r('coldfused')).lines.ashen, { STRENGTH: 35, CRITICAL_DAMAGE: 50 });
  const wisp = blazeWorld({ pet: { type: 'SUBZERO_WISP', tier: 'LEGENDARY' } });
  assert.deepEqual(blazeOf(r('coldfused'), wisp).lines.ashen, { STRENGTH: 110, CRITICAL_DAMAGE: 105 });
});

test('a reforge outside the table is unknown for blaze, also on the old piece', () => {
  assert.equal(blazeOf({ kind: 'reforge', on: 'weapons', value: ['heavy'] }), null);
  assert.equal(blazeOf({ kind: 'reforge', on: 'weapons', value: ['fabled'] }, blazeWorld({ daggers: { ashen: fire({ reforge: 'heavy' }), spirit: maw() } })), null);
});

test('perfect opal on a legendary piece gives 11 true defense', () => {
  assert.deepEqual(blazeOf({ kind: 'gem', on: [['PLATE']], type: 'OPAL', quality: 'PERFECT', need: 1 }).common, { TRUE_DEFENSE: 11 });
});

test('opal on a divine piece has no wiki value', () => {
  const data = { ...blazeItems, PLATE: { ...blazeItems.PLATE, tier: 'DIVINE' } };
  const w = blazeWorld();
  assert.equal(blazeDelta({ text: 's', detect: { kind: 'gem', on: [['PLATE']], type: 'OPAL', quality: 'PERFECT', need: 1 } }, w.state, w.loadout, w.profile, data, miningSettings(null), blazeGuide), null);
});

test('true protection gives 5 true defense on a chestplate, once', () => {
  assert.deepEqual(blazeOf({ kind: 'enchant', on: 'armor', enchant: 'true_protection', level: 1 }).common, { TRUE_DEFENSE: 5 });
  assert.deepEqual(blazeOf({ kind: 'enchant', on: [['BOOT']], enchant: 'true_protection', level: 1 }, blazeWorld({ armor: [piece('BOOT')] })).common, {});
});

const mpWorld = (accessories = [], extra = {}) => { const w = blazeWorld({ prof: { selectedPower: 'strong', ...extra } }); return { ...w, loadout: { ...w.loadout, accessories }, profile: { ...w.profile, items: [...w.profile.items, ...accessories] } }; };

test('a new accessory family gives its full power, a replacement the difference', () => {
  assert.equal(blazeOf({ kind: 'owned', on: [['NEW_ONE']] }, mpWorld()).mp, 12);
  assert.equal(blazeOf({ kind: 'owned', on: [['TOP_RING']] }, mpWorld([piece('RARE_RING', { where: 'accessory' })])).mp, 16 - 8);
});

test('recomb on an accessory gives one rarity step of power', () => {
  const w = mpWorld([piece('NEW_ONE', { where: 'accessory' })]);
  assert.equal(blazeOf({ kind: 'recomb', on: [['NEW_ONE']] }, w).mp, 16 - 12);
  assert.equal(accessoryPower('NEW_ONE', true, blazeItems), 16);
});

test('hegemony counts double, rift prism gives null', () => {
  assert.equal(accessoryPower('HEGEMONY_ARTIFACT', false, blazeItems), 32);
  assert.equal(blazeOf({ kind: 'owned', on: [['RIFT_PRISM']] }, mpWorld()), null);
});

test('power gain goes through the multiplier', () => {
  const stats = blazeOf({ kind: 'owned', on: [['NEW_ONE']] }, mpWorld()).common;
  // strong: 12 strength per multiplier point, and the new ring has no stat of its own
  const m = (mp) => 29.97 * Math.log(0.0019 * mp + 1) ** 1.2;
  assert.ok(Math.abs(stats.STRENGTH - 12 * (m(912) - m(900))) < 1e-9);
});

test('switching power counts its stats, the three new powers follow the wiki', () => {
  const w = mpWorld([], { selectedPower: null });
  const m = 29.97 * Math.log(0.0019 * 900 + 1) ** 1.2;
  const hurtful = blazeOf({ kind: 'power', value: 'hurtful' }, w).common;
  assert.ok(Math.abs(hurtful.CRITICAL_DAMAGE - 19.2 * m) < 1e-9);
  assert.equal(hurtful.ATTACK_SPEED, 15);
  assert.equal(blazeOf({ kind: 'power', value: 'shaded' }, w).common.ATTACK_SPEED, 3);
  assert.ok(Math.abs(blazeOf({ kind: 'power', value: 'strong' }, w).common.STRENGTH - (12 * m + 25)) < 1e-9);
  assert.deepEqual(blazeOf({ kind: 'power', value: 'strong' }, mpWorld()).common, {});
});

test('a pet step compares max level with the picked pet, without a table null', () => {
  const change = blazeOf({ kind: 'pet', types: ['LION'], tier: 'LEGENDARY' });
  assert.deepEqual(change.common, { STRENGTH: 50 });
  assert.ok(change.notes[0].includes('max level'));
  assert.equal(blazeOf({ kind: 'pet', types: ['UNKNOWN'], tier: 'LEGENDARY' }), null);
});

test('a guide step without a detect falls back on its gain', () => {
  assert.equal(blazeOf(null), null);
  assert.deepEqual(blazeOf(null, blazeWorld(), { STRENGTH: 9, MINING_SPEED: 3 }).common, { STRENGTH: 9 });
});

test('dominus comes into the output with the second infernal piece', () => {
  const w = blazeWorld({ armor: [piece('INFERNAL_CRIMSON_CHESTPLATE')] });
  const after = applyBlaze(w.state, blazeOf({ kind: 'owned', on: [['INFERNAL_CRIMSON_BOOTS']] }, w));
  assert.equal(after.armorIds.length, 2);
  assert.ok(blazeOutput(after) / blazeOutput(w.state) > 2);
});

test('a mining step gives the same delta as before', () => {
  assert.deepEqual(delta({ kind: 'owned', on: [['NEW_HELMET']] }), { MINING_FORTUNE: 20, MINING_SPEED: 5 });
  assert.deepEqual(delta({ kind: 'reforge', on: 'armor', value: ['jaded'] }, { loadout: setup({ armor: [piece('OLD_HELMET', { reforge: 'fierce' })] }) }), { MINING_SPEED: 20, MINING_FORTUNE: 15 });
});

const rankBlaze = (steps, { world = blazeWorld(), products = {}, opts = {} } = {}) => {
  const g = { groups: blazeGuide.groups, sections: [{ name: 'Main', steps: steps.map((s, i) => ({ text: s.text ?? `step ${i}`, ...s })) }] };
  return rankUpgrades(g, new Set(), { products, profile: world.profile, items: blazeItems }, world.loadout, miningSettings(null), null, { area: 'blaze', state: world.state, ...opts });
};
const lowTd = () => { const w = blazeWorld(); return { ...w, state: { ...w.state, common: { ...w.state.common, TRUE_DEFENSE: 100 } } }; };
const buy = (id) => ({ items: [{ id, qty: 1 }] });

test('blaze rows rank by damage gain per million', () => {
  const out = rankBlaze([
    { text: 'sharp', detect: onDaggers('sharpness', 7), ...buy('A') },
    { text: 'crit', detect: onDaggers('critical', 1), ...buy('B') },
  ], { products: { A: sold(10e6), B: sold(1e6) } });
  assert.deepEqual(texts(out.ranked).sort(), ['crit', 'sharp']);
  const sharp = out.ranked.find((r) => r.step.text === 'sharp');
  assert.ok(Math.abs(sharp.gain - 0.5) < 1e-9);
  assert.ok(Math.abs(sharp.perMillion - 0.05) < 1e-9);
});

test('a dagger of one line never takes the place of the other line', () => {
  const w = blazeWorld();
  const data = { profile: w.profile, guide: { groups: {} }, products: { [MAW]: orders(8e6) } };
  const step = { detect: { kind: 'owned', on: [[KINDLE]] }, items: [{ id: KINDLE, qty: 1 }] };
  assert.equal(netCost(step, 20e6, w.loadout, null, blazeItems, data, false).soldIds.includes(MAW), false);
});

test('a dagger upgrade sells nothing even without a forge recipe', () => {
  const w = blazeWorld();
  const data = { profile: w.profile, guide: { groups: {} }, products: { [FIRE]: orders(8e6) } };
  assert.equal(netCost({ detect: { kind: 'owned', on: [[KINDLE]] } }, 20e6, w.loadout, null, blazeItems, data, false).resale, 0);
});

test('a look ahead works for blaze lines and a line of books', () => {
  const book = (level) => ({ items: [{ id: `ENCHANTMENT_S_${level}`, qty: 1, combine: 0 }] });
  const out = rankBlaze([
    { text: 'first', line: 'L', detect: onDaggers('looting', 1), ...book(1) },
    { text: 'second', line: 'L', detect: onDaggers('sharpness', 7), ...book(2) },
  ], { products: { ENCHANTMENT_S_1: sold(1e6), ENCHANTMENT_S_2: sold(4e6) } });
  assert.equal(out.ranked[0].step.text, 'first');
  assert.equal(out.ranked[0].ahead.text, 'second');
  assert.equal(out.ranked[0].coins, 4e6);
});

test('a step that helps a missed limit goes to requirements with its reason', () => {
  const out = rankBlaze([{ text: 'gem', detect: { kind: 'gem', on: [['PLATE']], type: 'OPAL', quality: 'PERFECT', need: 1 }, ...buy('A') }], { world: lowTd(), products: { A: sold(1e6) } });
  assert.deepEqual(texts(out.requirements), ['gem']);
  assert.deepEqual(out.requirements[0].helps, ['trueDefense']);
  assert.equal(out.ranked.length, 0);
});

test('requirements sort by progress on the limit per million, then damage', () => {
  const out = rankBlaze([
    { text: 'small', gain: { TRUE_DEFENSE: 4 }, ...buy('A') },
    { text: 'big', gain: { TRUE_DEFENSE: 20 }, ...buy('A') },
    { text: 'noprice', gain: { TRUE_DEFENSE: 40 }, ...buy('NOPE') },
  ], { world: lowTd(), products: { A: sold(1e6) } });
  assert.deepEqual(texts(out.requirements), ['big', 'small', 'noprice']);
});

test('a step that would break a met limit is locked with the reason', () => {
  const out = rankBlaze([{ text: 'swap', gain: { TRUE_DEFENSE: -20, STRENGTH: 50 }, ...buy('A') }], { products: { A: sold(1e6) } });
  assert.deepEqual(texts(out.locked), ['swap']);
  assert.match(out.locked[0].reasons[0], /below 140/);
});

test('a step that lifts a met limit further stays in the ranking', () => {
  const out = rankBlaze([{ text: 'x', gain: { TRUE_DEFENSE: 20, STRENGTH: 50 }, ...buy('A') }], { products: { A: sold(1e6) } });
  assert.deepEqual(texts(out.ranked), ['x']);
});

test('the missing dagger goes to requirements as dagger pair incomplete', () => {
  const out = rankBlaze([{ text: 'maw', detect: { kind: 'owned', on: [[MAW]] }, ...buy(MAW) }], { world: blazeWorld({ daggers: { ashen: fire(), spirit: null } }), products: { [MAW]: sold(1e6) } });
  assert.deepEqual(out.requirements[0].helps, ['dagger']);
});

test('magical power between 800 and 1100 locks nothing and helps nothing', () => {
  const out = rankBlaze([{ text: 'x', detect: { kind: 'owned', on: [['NEW_ONE']] }, ...buy('A') }], { world: mpWorld(), products: { A: sold(1e6) } });
  assert.equal(out.locked.length, 0);
  assert.equal(out.requirements.length, 0);
  const low = mpWorld([], { mp: 700 });
  assert.deepEqual(rankBlaze([{ text: 'x', detect: { kind: 'owned', on: [['NEW_ONE']] }, ...buy('A') }], { world: low, products: { A: sold(1e6) } }).requirements[0].helps, ['mp']);
});

test('a limit that cannot be read locks nothing', () => {
  const w = blazeWorld({ prof: { missing: { inventory: true }, mp: null } });
  const out = rankBlaze([{ text: 'x', gain: { TRUE_DEFENSE: -500, STRENGTH: 50 }, ...buy('A') }], { world: w, products: { A: sold(1e6) } });
  assert.equal(out.locked.length, 0);
  assert.deepEqual(texts(out.ranked), ['x']);
});

test('a step left out by one for all goes to zero with its hint', () => {
  const w = blazeWorld({ daggers: { ashen: fire({ enchants: { [OFA]: 1 } }), spirit: maw({ enchants: { [OFA]: 1 } }) } });
  const out = rankBlaze([{ text: 'x', detect: onDaggers('sharpness', 7), ...buy('A') }], { world: w, products: { A: sold(1e6) } });
  assert.deepEqual(texts(out.zero), ['x']);
  assert.ok(out.zero[0].notes.includes('Not used with One For All.'));
});

const blazeProfile = (over = {}) => ({ ...profile([piece(FIRE, { where: 'inventory', lore: { DAMAGE: 90, STRENGTH: 45 } }), piece(MAW, { where: 'inventory', lore: { DAMAGE: 90, STRENGTH: 45 } }), piece('PLATE', { sets: ['armor:1'], lore: { TRUE_DEFENSE: 200 } })]), wardrobe: { armor: { equipped: 1, sets: [1] }, equipment: { equipped: 1, sets: [1] } }, mp: 1200, attrs: {}, ...over });
const blazeG = (steps, over = {}) => ({ id: 'b', title: 'Blaze', area: 'blaze', groups: blazeGuide.groups, sections: [{ name: 'Main', steps }], ...over });
const blazeHtml = (g, { state = { summary: blazeProfile(), syncedAt: 1 }, products = { A: sold(5e6) }, data = blazeItems } = {}) => progressView({ guides: [g], current: g.id, checked: new Set(), products, prices: { items: data }, name: (id) => id, mode: 'best', profile: state?.summary ?? null,
  bestValue: (v) => bestValueView({ ...v, state, settings: miningSettings(null) }) });
const sharpStep = { text: 'sharp', detect: onDaggers('sharpness', 7), items: [{ id: 'A', qty: 1 }] };

test('the mode button shows on a guide with area blaze', () => {
  assert.match(blazeHtml(blazeG([sharpStep])), /data-guide-mode="best" aria-pressed="true"/);
});

test('the row says damage, marks the estimate and shows the raw stats', () => {
  const html = blazeHtml(blazeG([{ text: 'x', detect: onDaggers('critical', 7), items: [{ id: 'A', qty: 1 }] }]));
  assert.match(html, /\+\d+(\.\d+)? % damage · \d+(\.\d+)? %\/1M/);
  assert.match(html, /Ashen: \+100 Crit Damage/);
  assert.match(html, /Estimate/);
});

test('below a limit the page warns and shows both values', () => {
  const summary = blazeProfile({ mp: 700 });
  summary.items = summary.items.map((i) => (i.id === 'PLATE' ? { ...i, lore: { TRUE_DEFENSE: 100 } } : i));
  const html = blazeHtml(blazeG([sharpStep]), { state: { summary, syncedAt: 1 } });
  assert.match(html, /Below the limit: True Defense 100 \/ 140 · Magical Power 700 \/ 800/);
  assert.match(html, /role="alert"/);
});

test('steps that close a gap stand first, the rest keeps its rank', () => {
  const summary = blazeProfile();
  summary.items = summary.items.map((i) => (i.id === 'PLATE' ? { ...i, lore: { TRUE_DEFENSE: 100 } } : i));
  const html = blazeHtml(blazeG([sharpStep, { text: 'gem', detect: { kind: 'gem', on: [['PLATE']], type: 'OPAL', quality: 'PERFECT', need: 1 }, items: [{ id: 'A', qty: 1 }] }]), { state: { summary, syncedAt: 1 } });
  const req = html.indexOf('aria-label="Requirements first"');
  const best = html.indexOf('aria-label="Best value"');
  assert.ok(req > 0 && best > req);
  assert.match(html.slice(req, best), /gem/);
  assert.match(html.slice(req, best), /data-src="locked">True Defense/);
  assert.match(html.slice(best), /sharp/);
});

test('magical power under the target of 1100 is a note only', () => {
  const html = blazeHtml(blazeG([sharpStep]), { state: { summary: blazeProfile({ mp: 900 }), syncedAt: 1 } });
  assert.match(html, /under the target of 1100/);
  assert.doesNotMatch(html, /Below the limit/);
});

test('a missing value shows unknown with a warning and ranks on', () => {
  const html = blazeHtml(blazeG([sharpStep]), { state: { summary: blazeProfile({ mp: null, missing: { inventory: true } }), syncedAt: 1 } });
  assert.match(html, /True Defense unknown/);
  assert.match(html, /could not be read/);
  assert.match(html, /aria-label="Best value"/);
});

test('the path line compares enchants and one for all', () => {
  const html = blazeHtml(blazeG([sharpStep]));
  assert.match(html, /Enchants: ×1\.00 · One For All: ×6\.00 · One For All leads by 500\.0 %/);
  assert.match(html, /In use: Enchants/);
});

test('the active path is named and never changes by itself', () => {
  const summary = blazeProfile();
  summary.items = summary.items.map((i) => (DAGGERS_TEST.has(i.id) ? { ...i, enchants: { [OFA]: 1 } } : i));
  const html = blazeHtml(blazeG([sharpStep]), { state: { summary, syncedAt: 1 } });
  assert.match(html, /In use: One For All/);
  assert.match(html, /Not used with One For All/);
  assert.match(html, /aria-label="No damage gain"/);
});

test('the offset moves the blaze base, also in the limits', () => {
  const entry = { choice: { armor: 1, equipment: 1, pet: null }, values: {}, offset: { TRUE_DEFENSE: -120 }, offsetFor: { armor: 1, equipment: 1, pet: null }, offsetNote: null, at: 2 };
  const html = blazeHtml(blazeG([sharpStep]), { state: { summary: blazeProfile(), syncedAt: 1, statsInput: { blaze: entry } } });
  assert.match(html, /True Defense 80 \/ 140/);
  assert.match(html, /Below the limit/);
});

test('best possible keeps true defense at the limit', () => {
  const armor = piece('PLATE', { lore: { TRUE_DEFENSE: 150 } });
  const glass = piece('INFERNAL_CRIMSON_CHESTPLATE', { where: 'backpack', lore: { STRENGTH: 500 } });
  const tank = piece('OTHER_PLATE', { where: 'backpack', lore: { STRENGTH: 200, TRUE_DEFENSE: 150 } });
  const data = { ...blazeItems, OTHER_PLATE: { category: 'CHESTPLATE' } };
  const loadout = { armor: [armor], equipment: [], held: null, daggers: { ashen: null, spirit: null } };
  const s = { common: { TRUE_DEFENSE: 150, STRENGTH: 0 }, daggers: loadout.daggers, armorIds: [armor.id], path: 'guide' };
  const out = bestBlaze({ items: [armor, glass, tank] }, data, loadout, s);
  assert.equal(out.slots[0].best.id, 'OTHER_PLATE');
  assert.ok(out.gain > 0);
});

test('best possible does not list a dagger swap between the lines', () => {
  const html = blazeHtml(blazeG([sharpStep]));
  assert.doesNotMatch(html, /FIREDUST_DAGGER →|MAWDUST_DAGGER →/);
  assert.match(html, /Pet and daggers stay/);
});

test('the page names what the model leaves out', () => {
  assert.match(blazeHtml(blazeG([sharpStep])), /Not modelled: Thunderlord/);
});

test('the fourth crimson piece says set bonus not fully rated', () => {
  const crimson = ['HELMET', 'CHESTPLATE', 'LEGGINGS'].map((s) => piece(`INFERNAL_CRIMSON_${s}`, { sets: ['armor:1'], lore: { TRUE_DEFENSE: 100 } }));
  const data = { ...blazeItems, ...Object.fromEntries(crimson.map((p) => [p.id, { category: p.id.split('_').pop(), tier: 'MYTHIC', stats: {} }])) };
  const summary = { ...blazeProfile(), items: [...blazeProfile().items.filter((i) => i.id !== 'PLATE'), ...crimson] };
  const html = blazeHtml(blazeG([{ text: 'x', detect: { kind: 'owned', on: [['INFERNAL_CRIMSON_BOOTS']] }, items: [{ id: 'A', qty: 1 }] }]), { state: { summary, syncedAt: 1 }, data });
  assert.match(html, /Set bonus not fully rated/);
});

test('blaze names and reasons are escaped', () => {
  const data = { ...blazeItems, HARD: { requirements: [{ type: 'COLLECTION', collection: '<b>', tier: 1 }] } };
  const html = blazeHtml(blazeG([{ text: '<i>x', detect: onDaggers('critical', 1), items: [{ id: 'HARD', qty: 1 }] }]), { data, products: { HARD: sold(1) }, state: { summary: { ...blazeProfile(), collTiers: [] }, syncedAt: 1 } });
  assert.doesNotMatch(html, /<i>x|<b>/);
});

test('a guide without any dagger still draws', () => {
  const summary = { ...blazeProfile(), items: [piece('PLATE', { sets: ['armor:1'], lore: { TRUE_DEFENSE: 200 } })] };
  const html = blazeHtml(blazeG([{ text: 'maw', detect: { kind: 'owned', on: [[MAW]] }, items: [{ id: 'A', qty: 1 }] }]), { state: { summary, syncedAt: 1 } });
  assert.match(html, /Dagger pair incomplete/);
  assert.match(html, /aria-label="Requirements first"/);
});

const BLAZE = 'personal/guides/blaze-slayer.json';
test('the real blaze guide ranks without error', { skip: !(existsSync(FIXTURE) && existsSync(ITEMS) && existsSync(BLAZE)) }, async () => {
  const realGuide = validGuide(JSON.parse(readFileSync(BLAZE, 'utf8')));
  assert.equal(realGuide.area, 'blaze');
  const summary = await summarize(JSON.parse(readFileSync(FIXTURE, 'utf8')).members.self);
  const data = JSON.parse(readFileSync(ITEMS, 'utf8')).r;
  const html = bestValueView({ guide: realGuide, checked: new Set(), ctx: { products: {}, profile: summary, items: data, have: new Map() }, name: String, state: { summary, syncedAt: 1 }, settings: miningSettings(null) });
  assert.match(html, /Estimate/);
  assert.doesNotMatch(html, /NaN/);
});

const rankArgs = (g, state, data, products = { A: sold(5e6) }) => ({ guide: g, checked: new Set(), ctx: { products, profile: state?.summary ?? null, items: data }, name: String, state, settings: miningSettings(null) });

test('rankArea gives the same groups as the view for mining and blaze', () => {
  const m = rankArea(rankArgs(mineGuide(), { summary: summary(), syncedAt: 1 }, items));
  assert.equal(m.area, 'mining');
  assert.deepEqual(m.groups.ranked.map((r) => r.step.text), ['cheap']);
  const b = rankArea(rankArgs(blazeG([sharpStep]), { summary: blazeProfile(), syncedAt: 1 }, blazeItems));
  assert.equal(b.area, 'blaze');
  assert.deepEqual(b.groups.ranked.map((r) => r.step.text), ['sharp']);
});

test('rankArea says what is missing without profile or item data', () => {
  assert.deepEqual(rankArea(rankArgs(mineGuide(), null, items)), { missing: 'profile' });
  assert.deepEqual(rankArea(rankArgs(mineGuide(), { summary: summary() }, null)), { missing: 'items' });
  assert.deepEqual(rankArea(rankArgs(mineGuide({ area: 'farming' }), { summary: summary() }, items)), { missing: 'score' });
});

test('limits and paths are data', () => {
  const { limits, paths } = rankArea(rankArgs(blazeG([sharpStep]), { summary: blazeProfile({ mp: 900 }), syncedAt: 1 }, blazeItems));
  assert.equal(limits.mp, 900);
  assert.equal(limits.underTarget, true);
  assert.equal(limits.lowTrueDefense, false);
  assert.equal(paths.leader, 'One For All');
  assert.equal(paths.ofa, 6);
  assert.equal(paths.inUse, 'Enchants');
});

test('each area has its score texts, and a swapped score changes the unit in the result', () => {
  assert.equal(SCORES.mining.gainText(0.024), '+2.4 % yield');
  assert.equal(SCORES.mining.rateText(0.0033), '0.3 % / 1M');
  assert.equal(SCORES.mining.rateLong(0.0061), '0.6 % per 1M');
  assert.equal(SCORES.blaze.gainText(0.034), '+3.4 % damage');
  assert.equal(SCORES.blaze.rateLong(0.0009), '0.09 % dmg per 1M');
  const coinsPerHour = { mining: { gainText: () => 'x coins/h', rateText: () => 'y', rateLong: () => 'z' } };
  assert.equal(rankArea(rankArgs(mineGuide(), { summary: summary(), syncedAt: 1 }, items), coinsPerHour).score.gainText(1), 'x coins/h');
});

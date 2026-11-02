import test from 'node:test';
import assert from 'node:assert/strict';
import { detectStep, detectGuide, validDetect } from '../detect.js';
import { stepKey } from '../progress.js';

const item = (id, extra = {}) => ({ id, enchants: {}, gems: [], parts: {}, ...extra });
const profile = (items, extra = {}) => ({ items, pets: [], ...extra });
const groups = { armor: [['A_HELM'], ['A_CHEST'], ['A_LEGS'], ['A_BOOTS']], daggers: [['D1', 'D2'], ['S1']] };

test('each group is one slot, so a spare piece does not stand in for another', () => {
  const step = { detect: { kind: 'owned', on: 'armor' } };
  assert.deepEqual(detectStep(step, profile([item('A_HELM'), item('A_HELM'), item('A_BOOTS')]), groups), { have: 2, need: 4 });
});

test('enchant counts from the minimum level, on the best item of a slot', () => {
  const step = { detect: { kind: 'enchant', on: 'daggers', enchant: 'sharpness', level: 6, need: 2 } };
  assert.deepEqual(detectStep(step, profile([item('D1', { enchants: { sharpness: 5 } }), item('D2', { enchants: { sharpness: 7 } }), item('S1')]), groups), { have: 1, need: 2 });
});

test('gem counts the type from the quality up and caps at need', () => {
  const step = { detect: { kind: 'gem', on: [['X']], type: 'JADE', quality: 'FLAWLESS', need: 2 } };
  const gems = [{ type: 'JADE', quality: 'PERFECT' }, { type: 'JADE', quality: 'FLAWLESS' }, { type: 'JADE', quality: 'PERFECT' }, { type: 'JADE', quality: 'FINE' }, { type: 'AMBER', quality: 'PERFECT' }];
  assert.deepEqual(detectStep(step, profile([item('X', { gems })]), {}), { have: 2, need: 2 });
});

test('reforge ignores case and a missing reforge never matches', () => {
  const step = { detect: { kind: 'reforge', on: [['X']], value: ['jaderald'] } };
  assert.equal(detectStep(step, profile([item('X', { reforge: 'JADERALD' })]), {}).have, 1);
  assert.equal(detectStep(step, profile([item('X', { reforge: null })]), {}).have, 0);
});

test('a drill part counts on the drill in any case, and as a loose item', () => {
  const step = { detect: { kind: 'part', on: [['DRILL']], ids: ['TANK_B'], need: 1 } };
  assert.equal(detectStep(step, profile([item('DRILL', { parts: { fuel_tank: 'tank_b' } })]), {}).have, 1);
  assert.equal(detectStep(step, profile([item('DRILL', { parts: { fuel_tank: 'tank_a' } })]), {}).have, 0);
  assert.equal(detectStep(step, profile([item('DRILL'), item('TANK_B')]), {}).have, 1);
});

test('a step of several parts adds them up and is only met with all', () => {
  const step = { detect: [{ kind: 'owned', on: [['X']] }, { kind: 'recomb', on: [['X']] }] };
  assert.deepEqual(detectStep(step, profile([item('X')]), {}), { have: 1, need: 2 });
  assert.deepEqual(detectStep(step, profile([item('X', { recomb: true })]), {}), { have: 2, need: 2 });
});

test('pet needs type and rarity; held, power, attribute, tier and skill read their fields', () => {
  const p = profile([], { pets: [{ type: 'LION', tier: 'EPIC', heldItem: 'CLAW' }], powers: ['silky'], attrs: { combo: 10 }, collTiers: ['GLACITE_9'], skills: { SKILL_MINING: 100 } });
  const has = (detect) => detectStep({ detect }, p, {});
  assert.equal(has({ kind: 'pet', types: ['LION'], tier: 'LEGENDARY' }).have, 0);
  assert.equal(has({ kind: 'pet', types: ['LION'], tier: 'RARE' }).have, 1);
  assert.equal(has({ kind: 'held', item: 'CLAW' }).have, 1);
  assert.equal(has({ kind: 'power', value: 'silky' }).have, 1);
  assert.deepEqual(has({ kind: 'attr', attr: 'combo', need: 64 }), { have: 10, need: 64 });
  assert.equal(has({ kind: 'coll', id: 'GLACITE', tier: 9 }).have, 1);
  assert.equal(has({ kind: 'skill', skill: 'SKILL_MINING', xp: 101 }).have, 0);
});

test('without a rule or without the data there is no answer', () => {
  assert.equal(detectStep({ text: 'x' }, profile([]), {}), null);
  assert.equal(detectStep({ detect: { kind: 'owned', on: [['X']] } }, null, {}), null);
  assert.equal(detectStep({ detect: { kind: 'coll', id: 'X', tier: 1 } }, profile([], { collTiers: null }), {}), null);
  assert.equal(detectStep({ detect: { kind: 'owned', on: 'missing' } }, profile([]), {}), null);
  assert.equal(detectStep({ detect: { kind: 'unknown' } }, profile([]), {}), null);
});

test('detectGuide answers per step, and only an item in the rule counts', () => {
  const guide = { sections: [{ name: 'S', steps: [{ text: 'low', detect: { kind: 'owned', on: [['A', 'B']] } }, { text: 'other', detect: { kind: 'owned', on: [['C']] } }, { text: 'none' }] }] };
  const found = detectGuide(guide, profile([item('B')]), stepKey);
  assert.equal(found.get('S|low').have, 1);
  assert.equal(found.get('S|other').have, 0);
  assert.equal(found.has('S|none'), false);
});

test('an essence perk needs its level', () => {
  const p = profile([], { perks: { eager_miner: 9, high_roller: 1 } });
  assert.equal(detectStep({ detect: { kind: 'perk', perk: 'eager_miner', level: 10 } }, p, {}).have, 0);
  assert.equal(detectStep({ detect: { kind: 'perk', perk: 'high_roller', level: 1 } }, p, {}).have, 1);
  assert.equal(detectStep({ detect: { kind: 'perk', perk: 'eager_miner', level: 1 } }, profile([], { perks: null }), {}), null);
});

test('inventory API off with nothing kept gives no answer, so nothing gets unticked', () => {
  const step = { detect: { kind: 'owned', on: [['X']] } };
  assert.equal(detectStep(step, { items: [], pets: [], missing: { inventory: true } }, {}), null);
  assert.deepEqual(detectStep(step, { items: [item('X')], pets: [], missing: { inventory: true } }, {}), { have: 1, need: 1 });
});

test('anything found of a later step settles the earlier ones of its slot, across lines', () => {
  const step = (id, line, slot, need) => ({ text: id, line, detect: { kind: 'owned', on: [[id], [`${id}2`]], ...(slot && { slot }), ...(need && { need }) } });
  const guide = { sections: [
    { name: 'A', steps: [step('OLD', 'x', 'gear'), step('MID', 'y', 'gear')] },
    { name: 'B', steps: [step('NEW', 'z', 'gear'), step('TOP', 'z', 'gear'), step('FREE', 'f'), step('OTHER', 'o', 'else')] },
  ] };
  const found = detectGuide(guide, profile([item('NEW'), item('FREE')]), stepKey);
  assert.deepEqual(found.get('A|OLD'), { have: 2, need: 2 });
  assert.deepEqual(found.get('A|MID'), { have: 2, need: 2 });
  assert.deepEqual(found.get('B|NEW'), { have: 1, need: 2 });
  assert.equal(found.get('B|TOP').have, 0);
  assert.equal(found.get('B|OTHER').have, 0);
});

test('a shard counts by its profile key, at the full amount of its rarity', () => {
  const rule = (attr, need) => ({ detect: { kind: 'attr', attr, need } });
  const p = profile([], { attrs: { blazing_resistance: 96, blazing: 32, warrior: 32, shell: 32, veil: 32, elite: 24, undead: 63 } });
  for (const [attr, need] of [['blazing_resistance', 96], ['blazing', 32], ['warrior', 32], ['shell', 32], ['veil', 32], ['elite', 24]]) {
    assert.deepEqual(detectStep(rule(attr, need), p, {}), { have: need, need }, attr);
  }
  assert.deepEqual(detectStep(rule('undead', 64), p, {}), { have: 63, need: 64 });
  assert.deepEqual(detectStep(rule('fortitude', 24), p, {}), { have: 0, need: 24 });
});

test('essence reads the perk level, pet item the item on a pet of the type; without data no answer', () => {
  const p = profile([], { perks: { forge_time: 3 }, pets: [{ type: 'MOLE', heldItem: 'TIN' }, { type: 'BEE', heldItem: 'GOLD' }] });
  const has = (detect, who = p) => detectStep({ detect }, who, {});
  assert.deepEqual(has({ kind: 'essence', perk: 'forge_time', level: 5 }), { have: 3, need: 5 });
  assert.deepEqual(has({ kind: 'essence', perk: 'forge_time', level: 2 }), { have: 2, need: 2 });
  assert.equal(has({ kind: 'essence', perk: 'forge_time', level: 1 }, profile([], { perks: null })), null);
  assert.deepEqual(has({ kind: 'petItem', types: ['MOLE'], item: 'TIN' }), { have: 1, need: 1 });
  assert.deepEqual(has({ kind: 'petItem', types: ['MOLE'], item: 'GOLD' }), { have: 0, need: 1 });
  assert.equal(has({ kind: 'petItem', types: ['MOLE'], item: 'TIN' }, profile([], { pets: undefined })), null);
  assert.equal(validDetect({ kind: 'petItem', item: 'TIN' }), null);
  assert.equal(validDetect({ kind: 'essence', perk: 'x' }), null);
});

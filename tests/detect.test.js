import test from 'node:test';
import assert from 'node:assert/strict';
import { detectStep, detectGuide } from '../detect.js';
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

test('a later rung settles the earlier ones of a ladder, but not outside it', () => {
  const rung = (id) => ({ text: id, line: 'L', detect: { kind: 'owned', on: [[id]], ladder: true } });
  const free = { text: 'free', line: 'M', detect: { kind: 'owned', on: [['F']] } };
  const free2 = { text: 'free2', line: 'M', detect: { kind: 'owned', on: [['G']] } };
  const guide = { sections: [{ name: 'S', steps: [rung('A'), rung('B'), rung('C'), free, free2] }] };
  const found = detectGuide(guide, profile([item('B'), item('G')]), stepKey);
  assert.equal(found.get('S|A').have, 1);
  assert.equal(found.get('S|B').have, 1);
  assert.equal(found.get('S|C').have, 0);
  assert.equal(found.get('S|free').have, 0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { checkStep, levelOf, HOTM_XP } from '../../apps/guide/requires.js';

const step = (...ids) => ({ text: 's', items: ids.map((id) => ({ id, qty: 1 })) });
const item = (...requirements) => ({ X: { requirements } });
const profile = (extra = {}) => ({ hotm: { experience: 0 }, ...extra });
const check = (req, p) => checkStep(step('X'), item(req), profile(p));

test('HOTM below the tier locks with a reason', () => {
  assert.deepEqual(check({ type: 'HEART_OF_THE_MOUNTAIN', tier: 7 }, { hotm: { experience: 97000 } }), { status: 'locked', reasons: ['HOTM 7 needed, you have 5'] });
  assert.equal(check({ type: 'HEART_OF_THE_MOUNTAIN', tier: 7 }, { hotm: { experience: 347000 } }).status, 'ok');
});

test('ANY_OF and ONE_OF pass with one met entry', () => {
  for (const type of ['ANY_OF', 'ONE_OF']) {
    const req = { type, requirements: [{ type: 'HEART_OF_THE_MOUNTAIN', tier: 9 }, { type: 'HEART_OF_THE_MOUNTAIN', tier: 3 }] };
    assert.equal(check(req, { hotm: { experience: 12000 } }).status, 'ok');
    assert.equal(check(req, {}).status, 'locked');
  }
});

test('an unreadable type is unknown, never locked', () => {
  assert.deepEqual(check({ type: 'GARDEN_LEVEL', level: 7 }), { status: 'unknown', reasons: [] });
  assert.equal(check({ type: 'ANY_OF', requirements: [{ type: 'PROFILE_TYPE', profile_type: 'ISLAND' }] }).status, 'unknown');
  // an entry we cannot read may be the one that is met
  assert.equal(check({ type: 'ANY_OF', requirements: [{ type: 'PROFILE_TYPE', profile_type: 'ISLAND' }, { type: 'HEART_OF_THE_MOUNTAIN', tier: 9 }] }).status, 'unknown');
});

test('a part of the profile that is off gives unknown', () => {
  assert.equal(check({ type: 'HEART_OF_THE_MOUNTAIN', tier: 1 }, { hotm: null }).status, 'unknown');
  // skills, slayers, Kuudra and collections cannot be read from a build
  for (const req of [{ type: 'SKILL', skill: 'MINING', level: 1 }, { type: 'SLAYER', slayer_boss_type: 'blaze', level: 1 }, { type: 'KUUDRA_COMPLETION', kuudra_tier: 'HOT' }, { type: 'COLLECTION', collection: 'A', tier: 1 }]) assert.equal(check(req).status, 'unknown');
});

test('no items.json or no profile gives unknown', () => {
  assert.equal(checkStep(step('X'), null, profile()).status, 'unknown');
  assert.equal(checkStep(step('X'), item({ type: 'HEART_OF_THE_MOUNTAIN', tier: 1 }), null).status, 'unknown');
});

test('locked beats unknown across the items of a step', () => {
  const items = { A: { requirements: [{ type: 'GARDEN_LEVEL', level: 1 }] }, B: { requirements: [{ type: 'HEART_OF_THE_MOUNTAIN', tier: 9 }] } };
  assert.equal(checkStep(step('A', 'B'), items, profile()).status, 'locked');
});

test('a step without items and an item without requirements are ok', () => {
  assert.equal(checkStep({ text: 's' }, {}, profile()).status, 'ok');
  assert.equal(checkStep(step('X'), { X: {} }, profile()).status, 'ok');
  assert.equal(checkStep(step('NOT_THERE'), { X: {} }, profile()).status, 'ok');
});

test('the choices of an anyOf item lock only when all are locked', () => {
  const items = { A: { requirements: [{ type: 'HEART_OF_THE_MOUNTAIN', tier: 9 }] }, B: {} };
  assert.equal(checkStep({ text: 's', items: [{ name: 'n', qty: 1, anyOf: ['A', 'B'] }] }, items, profile()).status, 'ok');
  assert.equal(checkStep({ text: 's', items: [{ name: 'n', qty: 1, anyOf: ['A'] }] }, items, profile()).status, 'locked');
});

test('levelOf stops at the top of the table', () => {
  assert.equal(levelOf(HOTM_XP, 0), 1);
  assert.equal(levelOf(HOTM_XP, 1e12), HOTM_XP.length);
});

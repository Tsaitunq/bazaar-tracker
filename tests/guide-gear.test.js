import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gearOf } from '../guide/gear.js';
import { miningSettings } from '../optimizer.js';

const items = {
  DRILL_1: { category: 'DRILL', stats: { MINING_SPEED: 100, MINING_FORTUNE: 10 } },
  HELM_1: { category: 'HELMET', stats: { MINING_FORTUNE: 5 } },
};
const A = { id: 'a', area: 'mining', sections: [{ name: 'S', steps: [
  { text: 'Drill', detect: { kind: 'owned', on: [['DRILL_1']] } },
  { text: 'Bal', detect: { kind: 'pet', types: ['BAL'], tier: 'LEGENDARY' } },
] }] };
const B = { id: 'b', area: 'mining', sections: [{ name: 'T', steps: [{ text: 'Helm', detect: { kind: 'owned', on: [['HELM_1']] } }] }] };
const run = (o) => gearOf({ guides: [A, B], checks: {}, owned: [], items, area: 'mining', build: null, settings: miningSettings(), ...o });

test('nothing ticked: no gear', () => {
  assert.deepEqual(run({}).gear, {});
});

test('an owned item counts in every guide of the area', () => {
  const g = run({ owned: ['DRILL_1', 'HELM_1'] }).gear;
  assert.equal(g.MINING_SPEED, 100);
  assert.equal(g.MINING_FORTUNE, 15);
});

test('the pet: a ticked step wins over the build, never both', () => {
  const build = { pet: { id: 'BAL', rarity: 'LEGENDARY', level: 50 } };
  assert.equal(run({ build }).gear.MINING_FORTUNE, 50);
  const ticked = run({ build, checks: { a: ['S|Bal'] } }).gear;
  assert.equal(ticked.MINING_FORTUNE, 100); // level 100 Bal, not 150
});

test('another area is left out', () => {
  const blaze = { id: 'z', area: 'blaze', sections: [] };
  assert.deepEqual(gearOf({ guides: [blaze], checks: {}, owned: [], items, area: 'blaze', build: null, settings: miningSettings() }).gear, {});
});

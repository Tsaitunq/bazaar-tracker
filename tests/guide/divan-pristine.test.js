import test from 'node:test';
import assert from 'node:assert/strict';
import { stepDelta, miningSettings } from '../../apps/guide/optimizer.js';
import { virtualProfile, virtualLoadout, applyStep } from '../../apps/guide/virtual.js';

const ids = ['DIVAN_HELMET'];
const items = { DIVAN_HELMET: { category: 'HELMET', tier: 'LEGENDARY', stats: { MINING_SPEED: 80, MINING_FORTUNE: 30 }, gemstone_slots: [{ slot_type: 'AMBER' }, { slot_type: 'JADE' }, { slot_type: 'TOPAZ' }] } };
const item = { text: "Divan's Helmet", gain: { MINING_SPEED: 80, MINING_FORTUNE: 30 }, detect: { kind: 'owned', on: [['DIVAN_HELMET']] }, items: [{ id: 'DIVAN_HELMET', qty: 1 }] };
const gem = (quality) => ({ text: `topaz ${quality}`, calc: true, detect: { kind: 'gem', on: [['DIVAN_HELMET']], type: 'TOPAZ', quality, need: 1 } });
const guide = { id: 'g', area: 'mining', order: 'fixed', sections: [{ name: 'S', steps: [item, gem('FLAWLESS'), gem('PERFECT')] }] };

function walk(steps) {
  let profile = virtualProfile({ sections: [] }, new Set(), new Set(), items, 1000);
  const total = {};
  for (const step of steps) {
    const loadout = virtualLoadout(profile, items, 'mining');
    const delta = stepDelta(step, loadout, profile, items, miningSettings(), guide) ?? {};
    for (const [k, v] of Object.entries(delta)) total[k] = Math.round(((total[k] ?? 0) + v) * 100) / 100;
    profile = applyStep(profile, step, guide, items);
  }
  return { total, profile };
}

test('a Divan piece: clean has no Pristine, Flawless Topaz 1.6, Perfect Topaz exactly 2 (Legendary values), never added up', () => {
  assert.equal(walk([item]).total.PRISTINE, undefined);
  assert.equal(walk([item, gem('FLAWLESS')]).total.PRISTINE, 1.6);
  const full = walk([item, gem('FLAWLESS'), gem('PERFECT')]);
  assert.equal(full.total.PRISTINE, 2);
  assert.equal(full.total.MINING_SPEED, 80);
  const piece = full.profile.items.find((i) => i.id === ids[0]);
  assert.equal(piece.gems.filter((g) => g.type === 'TOPAZ').length, 1);
  assert.equal(piece.gems[0].quality, 'PERFECT');
});

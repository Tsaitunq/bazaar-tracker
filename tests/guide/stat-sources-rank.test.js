import test from 'node:test';
import assert from 'node:assert/strict';
import { guideModel, worldFor } from '../../apps/guide/model.js';
import { statsModel } from '../../apps/guide/stats-model.js';
import { guideView } from '../../apps/guide/views/guide.js';
import { stepKey } from '../../apps/guide/progress.js';
import { miningSettings } from '../../apps/guide/optimizer.js';
import { measure } from '../../apps/guide/build.js';
import { gamedata, emptyBuild } from '../fixtures/guide-world.js';

const sold = (price) => ({ buy_summary: [{ pricePerUnit: price, amount: 100 }] });
const DRILL = 'TITANIUM_DRILL_4';
const items = {
  [DRILL]: { category: 'DRILL', tier: 'LEGENDARY', stats: { MINING_SPEED: 1600 } },
  RING: { category: 'ACCESSORY', tier: 'EPIC', stats: { HEALTH: 10 } },
};
const step = (text, id = 'A', gain = { MINING_FORTUNE: 8 }) => ({ text, gain, items: [{ id, qty: 1 }] });
const mining = { id: 'mine', title: 'Mining', area: 'mining', groups: { drill: [[DRILL]] }, sections: [{ name: 'Main', steps: [step('Jade'), step('Topaz', 'B')] }] };
const ringStep = { text: 'Ring', detect: { kind: 'owned', on: [['RING']] }, items: [{ id: 'RING', qty: 1 }] };
const fire = { id: 'fire', title: 'Blaze Slayer', area: 'blaze', groups: {}, sections: [{ name: 'Start', steps: [ringStep] }] };
const profile = { profileId: 'p', fetchedAt: 1, skills: { SKILL_MINING: 3022425 }, slayer: null, skyblockXp: null, items: [{ id: 'RING', at: ['Accessory Bag'], enrichment: null }] };
const world = (over = {}) => ({
  guides: [mining, fire], checks: {}, dates: {}, owned: [DRILL], base: {}, build: emptyBuild(), gamedata, products: { A: sold(1e6), B: sold(2e6) }, prices: { items }, items,
  settings: miningSettings(null), keepOldGear: false, now: 1e12, armed: null, name: String, ...over,
});
const model = (w) => guideModel(mining, worldFor(w, mining));

test('ranking without a measurement: with an import it ranks from the summed sources', () => {
  const m = model(world({ profile }));
  assert.equal(m.missing, null);
  assert.ok(m.leader, 'a step leads the path');
  assert.doesNotMatch(guideView(world({ profile }), 'mine', 'path'), /Measure your base/);
});

test('ranking without an import and without a measurement keeps the hint', () => {
  const w = world();
  assert.equal(model(w).missing, 'stats');
  assert.match(guideView(w, 'mine', 'path'), /Measure your base/);
});

test('a typed measurement still wins over the sums', () => {
  const base = measure({}, 'mining', { values: { MINING_FORTUNE: 1000 } }, emptyBuild(), 5);
  assert.equal(model(world({ profile, base })).missing, null);
});

test('with an import an accessory ticked after the measurement is counted once, not twice', () => {
  const key = stepKey(fire.sections[0], ringStep);
  const dates = { fire: { [key]: 10 } }; // ticked after the measurement at 5
  const base = measure({}, 'blaze', { values: { HEALTH: 1000 } }, emptyBuild(), 5);
  const total = (w) => Number(statsModel(w, 'blaze').rows.find((r) => r.id === 'HEALTH').total.replace(/,/g, ''));
  const owned = ['RING'];
  // control: without an import the ticked ring is the gear gain on top of the measurement
  assert.equal(total(world({ base, dates, owned, profile: null })), 1010);
  // with the import the ring is in the bag, hence in the sources, and gear adds nothing more
  assert.equal(total(world({ base, dates, owned, profile })), 1000);
  // not measured: the ring is in the sum once (base 100 + ring 10)
  assert.equal(total(world({ dates, owned, profile })), 110);
});

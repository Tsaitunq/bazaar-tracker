import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { checkEssence, checkStats } from '../../apps/guide/gamedata.js';
import { gearOf } from '../../apps/guide/gear.js';
import { priceItem } from '../../apps/guide/progress.js';
import { miningSettings } from '../../apps/guide/optimizer.js';

const read = (f) => JSON.parse(fs.readFileSync(`gamedata/${f}.json`, 'utf8'));
const perks = read('essence-perks').perks;
const stats = checkStats(read('stats'));

test('the five perks: levels, costs and the bazaar id of their essence', () => {
  checkEssence(read('essence-perks'), stats);
  const by = Object.fromEntries(perks.map((p) => [p.id, p]));
  assert.equal(by.eager_miner.costs.reduce((a, b) => a + b), 5500);
  assert.equal(by.rhinestone_infusion.costs.reduce((a, b) => a + b), 5500);
  assert.equal(by.dwarven_expertise.costs.reduce((a, b) => a + b), 5500);
  assert.equal(by.cut_loose.costs.reduce((a, b) => a + b), 7500);
  assert.deepEqual(by.frozen_skin.costs, [1000, 1500, 2000, 3000, 5000]);
  assert.equal(by.frozen_skin.costs.reduce((a, b) => a + b), 12500);
  assert.deepEqual(Object.fromEntries(perks.map((p) => [p.id, p.bazaar])), { eager_miner: 'ESSENCE_GOLD', rhinestone_infusion: 'ESSENCE_DIAMOND', dwarven_expertise: 'ESSENCE_FOSSIL', cut_loose: 'ESSENCE_FOSSIL', frozen_skin: 'ESSENCE_ICE' });
});

test('a level costs its essence times the bazaar price', () => {
  const products = { ESSENCE_GOLD: { buy_summary: [{ amount: 100000, pricePerUnit: 20, orders: 1 }] } };
  const eager = perks.find((p) => p.id === 'eager_miner');
  assert.equal(priceItem({ id: eager.bazaar, qty: eager.costs[2] }, { products }).coins, 300 * 20);
});

const eager = (level) => ({ text: `Eager Miner ${level}`, gain: { MINING_SPEED: 10 }, detect: { kind: 'essence', perk: 'eager_miner', level } });
const shop = { id: 'g', area: 'mining', sections: [{ name: 'S', steps: [1, 2, 3, 4, 5].map(eager) }] };
const gearAt = (ticked, measuredAt, dates) => gearOf({ guides: [shop], checks: { g: ticked.map((l) => `S|Eager Miner ${l}`) }, owned: [], items: {}, area: 'mining', build: null, settings: miningSettings(), dates: { g: dates }, measuredAt });
const stamp = (entries) => Object.fromEntries(Object.entries(entries).map(([l, at]) => [`S|Eager Miner ${l}`, at]));

test('Eager Miner III before the measurement, IV and V after: +20 Mining Speed', () => {
  const g = gearAt([3, 4, 5], 100, stamp({ 3: 50, 4: 150, 5: 160 }));
  assert.equal(g.gear.MINING_SPEED, 20);
  assert.deepEqual(g.essence, { MINING_SPEED: 20 });
});

test('everything ticked before the measurement is in the base: nothing added', () => {
  assert.equal(gearAt([1, 2, 3], 100, stamp({ 1: 10, 2: 20, 3: 30 })).gear.MINING_SPEED, undefined);
  assert.equal(gearAt([1, 2, 3], 100, {}).gear.MINING_SPEED, undefined); // a tick without a date is older than the app
});

test('a new measurement makes everything base again; without a measurement nothing is added', () => {
  const dates = stamp({ 3: 50, 4: 150, 5: 160 });
  assert.equal(gearAt([3, 4, 5], 200, dates).gear.MINING_SPEED, undefined);
  assert.equal(gearAt([3, 4, 5], null, dates).gear.MINING_SPEED, undefined);
});

test('level V ticked alone after the measurement counts the levels below it too', () => {
  assert.equal(gearAt([5], 100, stamp({ 5: 150 })).gear.MINING_SPEED, 50);
});

test('Cut Loose is only described, never a stat', () => {
  assert.equal(perks.find((p) => p.id === 'cut_loose').effect, undefined);
});

test('a perk with a wrong bazaar id or cost list is rejected', () => {
  const bad = structuredClone(read('essence-perks'));
  bad.perks[0].bazaar = 'ESSENCE_WRONG';
  assert.throws(() => checkEssence(bad, stats), /bazaar id/);
  const short = structuredClone(read('essence-perks'));
  short.perks[0].costs.pop();
  assert.throws(() => checkEssence(short, stats), /one positive cost/);
});

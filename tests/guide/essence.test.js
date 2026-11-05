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

test('Cut Loose is only described; Dwarven Metal Fortune counts as a stat from a ticked level', () => {
  assert.equal(perks.find((p) => p.id === 'cut_loose').effect, undefined);
  const guide = { id: 'g', area: 'mining', sections: [{ name: 'S', steps: [
    { text: 'Dwarven Expertise I', gain: { DWARVEN_METAL_FORTUNE: 2 }, detect: { kind: 'essence', perk: 'dwarven_expertise', level: 1 } },
  ] }] };
  const g = gearOf({ guides: [guide], checks: { g: ['S|Dwarven Expertise I'] }, owned: [], items: {}, area: 'mining', build: null, settings: miningSettings() }).gear;
  assert.equal(g.DWARVEN_METAL_FORTUNE, 2);
});

test('a perk with a wrong bazaar id or cost list is rejected', () => {
  const bad = structuredClone(read('essence-perks'));
  bad.perks[0].bazaar = 'ESSENCE_WRONG';
  assert.throws(() => checkEssence(bad, stats), /bazaar id/);
  const short = structuredClone(read('essence-perks'));
  short.perks[0].costs.pop();
  assert.throws(() => checkEssence(short, stats), /one positive cost/);
});

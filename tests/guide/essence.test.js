import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { checkEssence, checkStats } from '../../apps/guide/gamedata.js';
import { totalFor } from '../../apps/guide/totals.js';
import { emptyBuild, editPart, commitDraft, needsDraft, essenceLevel, withEssence } from '../../apps/guide/build.js';
import { migrateEssence } from '../../apps/guide/migrate.js';
import { priceItem } from '../../apps/guide/progress.js';

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

test('Cut Loose is only described, never a stat', () => {
  assert.equal(perks.find((p) => p.id === 'cut_loose').effect, undefined);
});

// the essence shop is a part of the build: levels count as a change only after the measurement
const data = { stats: read('stats'), essence: read('essence-perks'), hotm: { perks: [] }, attributes: { attributes: [] }, power: { powerStones: [], tuning: { stats: [] }, boosterCookie: { effects: [] }, multiplier: { a: 0, b: 0, exp: 1 } } };
const entry = (snapshot) => ({ at: 100, values: { MINING_SPEED: 1000 }, snapshot });
const total = (build, snapshot) => totalFor({ area: 'mining', entry: entry(snapshot), build, gear: {}, data, stats: ['MINING_SPEED'] });

test('a level above the snapshot adds its stat; the same level in both adds nothing', () => {
  assert.equal(total({ essence: { eager_miner: 5 } }, { essence: { eager_miner: 3 } }).total.MINING_SPEED, 1020);
  assert.equal(total({ essence: { eager_miner: 3 } }, { essence: { eager_miner: 3 } }).total.MINING_SPEED, 1000);
  const t = total({ essence: { eager_miner: 5 } }, { essence: { eager_miner: 3 } });
  assert.deepEqual(t.moved.MINING_SPEED, [{ part: 'essence', value: 20 }]);
});

test('Cut Loose is listed as text and adds nothing', () => {
  const t = total({ essence: { cut_loose: 3 } }, { essence: {} });
  assert.equal(t.total.MINING_SPEED, 1000);
  assert.ok(t.listed.some((l) => /Cut Loose 3/.test(l.text)));
});

test('first entry after a measurement is a draft; saving backfills the snapshot, later changes are a delta', () => {
  let st = { build: { ...emptyBuild() }, base: withEssence({ mining: entry({ hotm: null, essence: undefined }) }), draft: {} };
  assert.ok(needsDraft(st.build, st.base, 'essence'));
  st = editPart(st, 'essence', essenceLevel(perks[0], 4));
  assert.equal(st.build.essence, null); // still a draft
  st = commitDraft(st, 'essence');
  assert.deepEqual(st.build.essence, { eager_miner: 4 });
  assert.deepEqual(st.base.mining.snapshot.essence, { eager_miner: 4 });
  assert.equal(total(st.build, st.base.mining.snapshot).total.MINING_SPEED, 1000); // base already holds it
  st = editPart(st, 'essence', essenceLevel(perks[0], 6));
  assert.equal(total(st.build, st.base.mining.snapshot).total.MINING_SPEED, 1020);
});

test('migration: the highest ticked level per perk becomes the base, the ticks go, nothing is counted twice', () => {
  const keys = ['perk:eager_miner:1', 'perk:eager_miner:2', 'perk:eager_miner:3', 'perk:frozen_skin:2', 'undone:perk:eager_miner:4', 'gem:x:JADE:FLAWLESS:1'];
  const out = migrateEssence({ keys, build: { hotm: null }, base: { mining: entry({ hotm: null }) } });
  assert.deepEqual(out.keys, ['gem:x:JADE:FLAWLESS:1']);
  assert.deepEqual(out.build.essence, { eager_miner: 3, frozen_skin: 2 });
  assert.deepEqual(out.base.mining.snapshot.essence, { eager_miner: 3, frozen_skin: 2 });
  assert.equal(total(out.build, out.base.mining.snapshot).total.MINING_SPEED, 1000);
  assert.equal(totalFor({ area: 'mining', entry: out.base.mining, build: { ...out.build, essence: { ...out.build.essence, eager_miner: 4 } }, gear: {}, data, stats: ['MINING_SPEED'] }).total.MINING_SPEED, 1010);
  // again: no change
  assert.deepEqual(migrateEssence({ keys: out.keys, build: out.build, base: out.base }), out);
  // no tick: the part stays unknown and the snapshot says so
  const none = migrateEssence({ keys: [], build: {}, base: { mining: { at: 1, values: {}, snapshot: { hotm: null } } } });
  assert.equal(none.build.essence, null);
  assert.equal(none.base.mining.snapshot.essence, null);
});

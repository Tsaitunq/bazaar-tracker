import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadGameData, checkStats, checkHotm, checkAttributes } from '../guide/gamedata.js';

const read = (f) => JSON.parse(fs.readFileSync(new URL(`../gamedata/${f}.json`, import.meta.url), 'utf8'));
const copy = (o) => structuredClone(o);

test('all four files load and validate', async () => {
  const d = await loadGameData(read);
  assert.equal(d.hotm.perks.length, 46);
  assert.equal(d.attributes.attributes.length, 325);
  assert.equal(d.hotm.tiers[9].cumulativeXp, 1247000);
});

test('hotm: an asymmetric or diagonal connection is rejected', () => {
  const stats = checkStats(read('stats'));
  const h = copy(read('hotm'));
  h.perks.find((p) => p.id === 'mining_speed').neighbors.pop();
  assert.throws(() => checkHotm(h, stats), /not symmetric/);
  const diag = copy(read('hotm'));
  const a = diag.perks.find((p) => p.id === 'mining_speed');
  const b = diag.perks.find((p) => p.id === 'luck_of_the_cave');
  a.neighbors.push(b.id); b.neighbors.push(a.id);
  assert.throws(() => checkHotm(diag, stats), /not horizontal\/vertical/);
});

test('hotm: an effect on an unknown stat is rejected', () => {
  const stats = checkStats(read('stats'));
  const h = copy(read('hotm'));
  h.perks.find((p) => p.id === 'mining_speed').effects[0].stat = 'NOPE';
  assert.throws(() => checkHotm(h, stats), /unknown stat NOPE/);
});

test('attributes: an attribute without effect needs unknown or other', () => {
  const stats = checkStats(read('stats'));
  const a = copy(read('attributes'));
  const x = a.attributes.find((e) => e.unknown);
  delete x.unknown;
  assert.throws(() => checkAttributes(a, stats), /not marked unknown/);
});

test('shards per level match the wiki table totals', () => {
  const t = read('attributes').shardsPerLevel;
  const sum = (r) => t[r].reduce((s, n) => s + n, 0);
  assert.deepEqual(['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'].map(sum), [96, 64, 48, 32, 24]);
});

test('accessory power multiplier gives 9.64 at 250', () => {
  assert.equal(read('power').multiplier.checkAt250, 9.64);
});

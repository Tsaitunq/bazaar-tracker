import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadGameData, checkStats, checkHotm, checkAttributes } from '../guide/gamedata.js';

const read = (f) => JSON.parse(fs.readFileSync(new URL(`../gamedata/${f}.json`, import.meta.url), 'utf8'));
const copy = (o) => structuredClone(o);

test('all four files load and validate', async () => {
  const d = await loadGameData(read);
  assert.equal(d.hotm.perks.length, 45);
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

// Occupied columns (1..7) per tier, read from the in-game HOTM menu on 2026-11-04. Positions only.
const GAME_GRID = { 10: [1, 2, 3, 4, 5, 6, 7], 9: [2, 4, 6], 8: [1, 2, 3, 4, 5, 6, 7], 7: [2, 4, 6], 6: [1, 2, 3, 4, 5, 6, 7], 5: [2, 4, 6], 4: [1, 2, 3, 4, 5, 6], 3: [2, 4, 6], 2: [2, 3, 4, 5, 6], 1: [4] };

test('hotm: perk positions match the in-game grid', () => {
  const perks = read('hotm').perks;
  for (const [tier, cols] of Object.entries(GAME_GRID)) {
    assert.deepEqual(perks.filter((p) => p.tier === Number(tier)).map((p) => p.col + 1).sort((a, b) => a - b), cols, `tier ${tier}`);
  }
});

test('hotm: neighbours are exactly the occupied orthogonal fields', () => {
  const perks = read('hotm').perks;
  const at = new Map(perks.map((p) => [`${p.col},${p.row}`, p.id]));
  for (const p of perks) {
    const want = [[0, 1], [0, -1], [1, 0], [-1, 0]].map(([x, y]) => at.get(`${p.col + x},${p.row + y}`)).filter(Boolean).sort();
    assert.deepEqual([...p.neighbors].sort(), want, p.id);
  }
});

test('attributes: in-game checked entries', () => {
  const a = (id) => read('attributes').attributes.find((x) => x.shardId === id);
  assert.equal(a('C36').effects[0].perLevel, 3);
  const f = a('E66').effects[0];
  assert.deepEqual([f.stat, f.value, f.per.stat, f.per.every.level10, f.cond], ['GEMSTONE_SPREAD', 0.5, 'COLD_RESISTANCE', 20, 'in_mineshaft']);
  assert.equal(a('E8').effectKind, 'other');
  for (const id of ['C36', 'E66', 'E8']) assert.equal(a(id).src, 'ingame tooltip 2026-11-04');
});

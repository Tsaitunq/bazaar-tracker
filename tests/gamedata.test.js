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

// Occupied columns (1..7) per tier, read from the in-game HOTM menu on 2026-11-04. Positions only.
const GAME_GRID = { 10: [1, 2, 3, 4, 5, 6, 7], 9: [2, 4, 6], 8: [1, 2, 3, 4, 5, 6, 7], 7: [2, 4, 6], 6: [1, 2, 3, 4, 5, 6, 7], 5: [2, 4, 6], 4: [1, 2, 3, 4, 5, 6, 7], 3: [2, 4, 6], 2: [2, 3, 4, 5, 6], 1: [4] };

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

const perk = (id) => read('hotm').perks.find((p) => p.id === id);

test('hotm: Front Loaded sits at tier 4, column 7 and needs Seasoned Mineman next to it', () => {
  const f = perk('front_loaded');
  assert.deepEqual([f.tier, f.col + 1, f.requires, f.neighbors], [4, 7, ['seasoned_mineman'], ['seasoned_mineman']]);
});

test('hotm: every required perk is a direct neighbour', () => {
  for (const p of read('hotm').perks) for (const r of p.requires ?? []) assert.ok(p.neighbors.includes(r), p.id);
});

test('hotm: abilities sit at T2/2, T2/6, T6/1, T6/7, T10/1, T10/7 and hold no permanent stat', () => {
  const abilities = read('hotm').perks.filter((p) => p.type === 'ability');
  assert.deepEqual(abilities.map((p) => `T${p.tier}/${p.col + 1}`).sort(), ['T10/1', 'T10/7', 'T2/2', 'T2/6', 'T6/1', 'T6/7']);
  assert.ok(abilities.every((p) => p.effects.length === 0));
  assert.equal(perk('tunnel_vision').name, 'Tunnel Vision');
});

test('hotm: max levels match the in-game check', () => {
  const MAX = { mining_speed: 50, mining_fortune: 50, titanium_insanium: 50, luck_of_the_cave: 45, efficient_miner: 100, quick_forge: 20, old_school: 20, professional: 140, mole: 200, gem_lover: 20, seasoned_mineman: 100, blockhead: 20, subterranean_fisher: 40, keep_it_cool: 50, lonesome_miner: 45, great_explorer: 20, speedy_mineman: 50, powder_buff: 50, fortunate_mineman: 50, strong_arm: 100, steady_hand: 100, warm_heart: 50, surveyor: 20, no_stone_unturned: 50, metal_head: 20, rags_to_riches: 50, eager_adventurer: 100, mining_master: 10, crystalline: 50, gifts_from_the_departed: 100, dead_mans_chest: 50, vanguard_seeker: 50, core_of_the_mountain: 10, miners_blessing: 1, mineshaft_mayhem: 1, front_loaded: 1, daily_grind: 1, daily_powder: 1, sky_mall: 1, precision_mining: 1 };
  for (const [id, max] of Object.entries(MAX)) assert.equal(perk(id).maxLevel, max, id);
});

test('hotm: per-level values and conditions', () => {
  const at = (id, stat, level) => { const e = perk(id).effects.find((x) => x.stat === stat); return e.a + e.b * level; };
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);
  near(at('mining_speed', 'MINING_SPEED', 3), 60);
  near(at('professional', 'MINING_SPEED', 1), 55);
  near(at('gem_lover', 'GEMSTONE_FORTUNE', 1), 24);
  near(at('seasoned_mineman', 'MINING_WISDOM', 1), 5.1);
  near(at('subterranean_fisher', 'FISHING_SPEED', 1), 5.5);
  near(at('subterranean_fisher', 'SEA_CREATURE_CHANCE', 1), 1.1);
  near(at('mole', 'MINING_SPREAD', 10), 20);
  const ox = perk('titanium_insanium').otherEffects[0];
  near(ox.a + ox.b * 27, 4.7);
  const q = perk('quick_forge').otherEffects[0];
  near(q.a + q.b * 1, 10.5);
  assert.ok(perk('lonesome_miner').effects.every((e) => e.kind === 'percent_multiplier' && e.b === 0.6 && e.cond === 'on_mining_islands'));
  assert.deepEqual(perk('miners_blessing').effects[0], { stat: 'MAGIC_FIND', a: 30, b: 0, cond: 'on_mining_islands' });
  for (const [id, cond] of [['professional', 'mining_gemstones'], ['mole', 'mining_hard_stone'], ['strong_arm', 'mining_dwarven_metals'], ['steady_hand', 'in_mineshaft'], ['rags_to_riches', 'in_mineshaft'], ['eager_adventurer', 'in_mineshaft']]) {
    assert.ok(perk(id).effects.every((e) => e.cond === cond), id);
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadGameData, checkStats, checkHotm, checkAttributes, checkPets } from '../guide/gamedata.js';

const read = (f) => JSON.parse(fs.readFileSync(new URL(`../gamedata/${f}.json`, import.meta.url), 'utf8'));
const copy = (o) => structuredClone(o);

test('all five files load and validate', async () => {
  const d = await loadGameData(read);
  assert.equal(d.hotm.perks.length, 46);
  assert.equal(d.pets.pets.length, 8);
  assert.ok(!d.pets.pets.some((p) => p.id === 'CROW'));
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

// Wiki table "Bereich": [level 1, max level, max level + omelette], read from the first effect that holds the value.
const RANGE = {
  mining_speed: [20, 1000, 1020], mining_fortune: [2, 100, 102], titanium_insanium: [2.1, 7, 7.1], luck_of_the_cave: [6, 50, 51], efficient_miner: [3, 300, 303],
  quick_forge: [10.5, 30, 30], old_school: [5, 100, 105], professional: [55, 750, 755], mole: [50, 400, 401.76], gem_lover: [24, 100, 104],
  seasoned_mineman: [5.1, 15, 15.1], blockhead: [5, 100, 105], keep_it_cool: [0.4, 20, 20.4], lonesome_miner: [5, 27, 27.5], great_explorer: [20, 96, 100],
  speedy_mineman: [40, 2000, 2040], powder_buff: [1, 50, 51], fortunate_mineman: [3, 150, 153], no_stone_unturned: [0.5, 25, 25.5], strong_arm: [5, 500, 505],
  steady_hand: [0.1, 10, 10.1], warm_heart: [0.4, 20, 20.4], surveyor: [0.75, 15, 15.75], metal_head: [5, 100, 105], rags_to_riches: [4, 200, 204],
  eager_adventurer: [4, 400, 404], crystalline: [0.5, 25, 25.5], gifts_from_the_departed: [0.2, 20, 20.2], mining_master: [0.1, 1, 1.1],
  dead_mans_chest: [0.5, 25, 25.5], vanguard_seeker: [1, 50, 51],
};
const valueOf = (e, level) => {
  let v = e.a + e.b * level + (e.stepEvery ? Math.floor(level / e.stepEvery) * e.stepAdd : 0);
  if (e.floor) v = Math.floor(v);
  return e.cap === undefined ? v : Math.min(e.cap, v);
};
const near = (a, b, w) => assert.ok(Math.abs(a - b) < 0.01, `${w}: ${a} vs ${b}`);

test('hotm: formula value at level 1, max level and with the omelette matches the wiki range', () => {
  for (const [id, [lv1, max, ome]] of Object.entries(RANGE)) {
    const p = perk(id);
    const e = p.effects[0] ?? p.otherEffects[0];
    near(valueOf(e, 1), lv1, `${id} lv1`);
    near(valueOf(e, p.maxLevel), max, `${id} max`);
    near(valueOf(e, p.maxLevel + 1), ome, `${id} omelette`);
    assert.equal(p.omeletteBonus, true, id);
  }
});

test('hotm: the second values of multi-effect perks', () => {
  const f = perk('subterranean_fisher').effects;
  near(valueOf(f[0], 1), 5.5, 'fishing speed lv1'); near(valueOf(f[0], 40), 25, 'fishing speed max'); near(valueOf(f[0], 41), 25.5, 'fishing speed omelette');
  near(valueOf(f[1], 1), 1.1, 'scc lv1'); near(valueOf(f[1], 40), 5, 'scc max'); near(valueOf(f[1], 41), 5.1, 'scc omelette');
  const locks = perk('great_explorer').otherEffects[1];
  assert.deepEqual([1, 20, 21].map((l) => valueOf(locks, l)), [1, 5, 5]);
});

test('hotm: Strong Arm has three effects, the hidden ones are capped', () => {
  const [metals, ores, air] = perk('strong_arm').effects;
  assert.deepEqual([metals.cond, metals.b, metals.cap], ['mining_dwarven_metals', 5, undefined]);
  assert.deepEqual([ores.cond, ores.b, ores.cap, ores.hidden], ['mining_pure_ores', 5, 500, true]);
  assert.deepEqual([air.cond, air.b, air.cap, air.hidden], ['mining_hard_stone_off_ground', 25, 2500, true]);
  assert.equal(valueOf(ores, 101), 500); assert.equal(valueOf(air, 100), 2500);
});

test('hotm: conditions and Lonesome Miner multiplier', () => {
  assert.ok(perk('lonesome_miner').effects.every((e) => e.kind === 'percent_multiplier' && e.cond === 'on_mining_islands'));
  assert.deepEqual(perk('lonesome_miner').effects.map((e) => e.stat).sort(), ['CRITICAL_CHANCE', 'CRITICAL_DAMAGE', 'DEFENSE', 'HEALTH', 'STRENGTH']);
  assert.deepEqual(perk('miners_blessing').effects[0], { stat: 'MAGIC_FIND', a: 30, b: 0, cond: 'on_mining_islands' });
  for (const [id, cond] of [['professional', 'mining_gemstones'], ['mole', 'mining_hard_stone'], ['steady_hand', 'in_mineshaft'], ['rags_to_riches', 'in_mineshaft'], ['eager_adventurer', 'in_mineshaft'], ['subterranean_fisher', 'on_mining_islands']]) {
    assert.ok(perk(id).effects.every((e) => e.cond === cond), id);
  }
});

const levelCost = (c, n) => Math.floor((n + c.offset) ** c.exp);
const total = (id, from, to) => { const c = perk(id).cost; let s = 0; for (let n = from; n <= to; n++) s += levelCost(c, n); return s; };

test('hotm: cost samples', () => {
  assert.equal(total('mole', 2, 10), 727);
  assert.equal(perk('mole').cost.powder, 'gemstone');
  assert.equal(levelCost(perk('mining_master').cost, 2), 59049);
  assert.equal(perk('mining_master').cost.powder, 'glacite');
  assert.equal(total('speedy_mineman', 2, 10), 6745);
  assert.equal(perk('mining_speed').cost, null);
  assert.equal(perk('mining_speed').unknown, true);
});

test('hotm: omelette is a global flag and no perk of its own', () => {
  const h = read('hotm');
  assert.equal(h.omelette.maxLevelBonus, 1);
  assert.ok(!h.perks.some((p) => /omelette/i.test(p.id)));
  assert.ok(h.perks.filter((p) => p.omeletteBonus).every((p) => p.maxLevel > 1 && p.type === 'perk'));
  assert.ok(h.perks.filter((p) => p.maxLevel === 1 && p.type === 'perk').every((p) => !p.omeletteBonus));
});

test('hotm: Core of the Mountain table', () => {
  const core = perk('core_of_the_mountain');
  assert.equal(core.levels.length, 10);
  assert.deepEqual(core.levels.map((l) => l.cost?.amount ?? 0), [0, 50000, 100000, 200000, 300000, 400000, 500000, 750000, 1000000, 1250000]);
  assert.deepEqual(core.levels.map((l) => l.cost?.powder ?? null), [null, 'mithril', 'mithril', 'gemstone', 'gemstone', 'gemstone', 'gemstone', 'glacite', 'glacite', 'glacite']);
  assert.deepEqual(core.levels.map((l) => l.sbXp), [25, 35, 50, 65, 75, 100, 125, 150, 175, 200]);
  assert.deepEqual(core.levels[9].reward, { tokens: 2 });
});

test('hotm: no wikiAlt and no top-level powder are left', () => {
  assert.ok(read('hotm').perks.every((p) => p.wikiAlt === undefined && p.powder === undefined));
});

test('pets: Scatha has three rarities, a bad stat or rarity fails with a path', () => {
  const stats = checkStats(read('stats'));
  const p = read('pets');
  assert.deepEqual(p.pets.filter((x) => x.id === 'SCATHA').map((x) => x.rarity), ['LEGENDARY', 'EPIC', 'RARE']);
  const bad = copy(p);
  bad.pets[0].stats.NOPE = 1;
  assert.throws(() => checkPets(bad, stats), /pets.BAL:LEGENDARY: bad stat NOPE/);
  const rare = copy(p);
  rare.pets[0].rarity = 'SHINY';
  assert.throws(() => checkPets(rare, stats), /bad rarity SHINY/);
  const twice = copy(p);
  twice.pets.push(copy(twice.pets[0]));
  assert.throws(() => checkPets(twice, stats), /duplicate id BAL:LEGENDARY/);
  const perk = copy(p);
  perk.pets[0].perks[0].value = 'x';
  assert.throws(() => checkPets(perk, stats), /Furnace/);
});

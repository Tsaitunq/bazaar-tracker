import test from 'node:test';
import assert from 'node:assert/strict';
import { checkStatSources, loadGameData } from '../../apps/guide/gamedata.js';
import { SKILL_XP, SLAYER_XP } from '../../apps/guide/requires.js';
import { GOD_POTION } from '../../apps/guide/stats.js';
import { gamedata } from '../fixtures/guide-world.js';

const data = gamedata.statSources;
const ids = new Set(gamedata.stats.stats.map((s) => s.id));
const clone = () => structuredClone(data);

test('the loader gives the stat sources and checks them with the rest', async () => {
  assert.ok(data.skills.mining && data.slayers.zombie && data.fairySouls && data.skyblockLevel && data.boosterCookie && data.godPotion && data.accessories);
  checkStatSources(clone(), ids);
  const read = (f) => JSON.parse(JSON.stringify(f === 'stat-sources' ? { ...data, skills: { ...data.skills, mining: { ...data.skills.mining, maxLevel: 61 } } } : gamedata[{ 'essence-perks': 'essence' }[f] ?? f]));
  await assert.rejects(loadGameData(read), /stat-sources.skills.mining.xp: needs 61 values/);
});

test('a broken file is named with its path', () => {
  const bad = (change, message) => {
    const d = clone();
    change(d);
    assert.throws(() => checkStatSources(d, ids), message);
  };
  bad((d) => { d.skills.mining.stats.NOT_A_STAT = d.skills.mining.stats.DEFENSE; }, /unknown stat NOT_A_STAT/);
  bad((d) => { d.skills.mining.stats.DEFENSE.confidence = 'maybe'; }, /bad confidence maybe/);
  bad((d) => { d.skills.mining.xp.src = ['wiki']; d.skills.mining.xp.confidence = 'safe'; }, /safe needs two sources/);
  bad((d) => { d.skills.mining.xp.values[3] = -1; }, /xp not rising at level 4/);
  bad((d) => { d.skills.mining.xpTotal[10] += 1; }, /xpTotal: level 11/);
  bad((d) => { d.skills.mining.stats.DEFENSE.values.pop(); }, /needs 60 values, has 59/);
  bad((d) => { d.skills.mining.stats.MINING_FORTUNE.diff = [99]; }, /diff must list levels/);
  bad((d) => { d.slayers.zombie.xp.values[2] = 1; }, /xp not rising at level 3/);
  bad((d) => { d.godPotion.stats.STRENGTH.value = 'x'; }, /value must be a number/);
  bad((d) => { delete d.fairySouls; }, /missing "fairySouls"/);
});

test('skill XP agree with the table the app already holds (wiki Skills, cumulative)', () => {
  for (const id of ['mining', 'combat', 'farming', 'enchanting']) assert.deepEqual(data.skills[id].xpTotal, SKILL_XP.slice(0, 60), id);
  for (const id of ['fishing', 'alchemy', 'carpentry', 'hunting']) assert.deepEqual(data.skills[id].xpTotal, SKILL_XP.slice(0, 50), id);
  // the wiki Mining page names these totals in its text
  assert.equal(data.skills.mining.xpTotal[24], 3022425);
  assert.equal(data.skills.mining.xpTotal[49], 55172425);
  assert.equal(data.skills.mining.xpTotal[59], 111672425);
});

test('level from XP: the first level above each total', () => {
  const levelOf = (skill, xp) => data.skills[skill].xpTotal.filter((t) => xp >= t).length;
  assert.equal(levelOf('mining', 0), 0);
  assert.equal(levelOf('mining', 49), 0);
  assert.equal(levelOf('mining', 50), 1);
  assert.equal(levelOf('mining', 3022425), 25);
  assert.equal(levelOf('mining', 1e12), 60);
  assert.equal(levelOf('social', 1e12), 25);
});

test('skill rewards: what the wiki and NEU agree on is safe, what only one source has is not', () => {
  const m = data.skills.mining;
  assert.equal(m.stats.DEFENSE.confidence, 'safe');
  assert.deepEqual(m.stats.DEFENSE.values.slice(0, 2), [1, 1]);
  assert.equal(m.stats.DEFENSE.values[59], 2);
  assert.equal(m.stats.MINING_FORTUNE.confidence, 'unsafe'); // NEU has no Mining Fortune per level
  assert.ok(m.stats.MINING_FORTUNE.values.every((v) => v === 4));
  assert.equal(data.skills.farming.stats.HEALTH.values[0], 2);
  assert.equal(data.skills.farming.stats.HEALTH.values[59], 5);
  assert.equal(data.skills.taming.stats.PET_LUCK.confidence, 'safe');
  assert.equal(data.skills.taming.xp.confidence, 'unsafe');
  assert.deepEqual(data.skills.runecrafting.stats, {});
  assert.equal(data.skills.combat.other.bonusDamage.unit, 'percent');
  assert.equal(data.skills.combat.other.bonusDamage.values[0], 4);
  assert.equal(data.skills.combat.other.bonusDamage.values[50], 1);
});

test('a series with two sources that differ says where', () => {
  const unsafeWithDiff = [];
  const walk = (node, path) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return;
    if (node.diff) { unsafeWithDiff.push(path); assert.equal(node.confidence, 'unsafe', path); assert.ok(node.src.length >= 2, path); }
    for (const [k, v] of Object.entries(node)) walk(v, `${path}.${k}`);
  };
  walk(data, '');
  assert.ok(unsafeWithDiff.includes('.slayers.spider.xp')); // wiki page 10, wiki overview 5, NEU 5
  assert.deepEqual(data.slayers.spider.xp.diff, [1, 2]);
});

test('slayer XP: thresholds rise, and where the app has a table the two are told apart', () => {
  for (const id of ['zombie', 'wolf', 'enderman']) assert.deepEqual(data.slayers[id].xp.values, SLAYER_XP[id], id);
  assert.deepEqual(data.slayers.vampire.xp.values, SLAYER_XP.vampire);
  assert.equal(data.slayers.zombie.stats.HEALTH.confidence, 'safe');
  assert.deepEqual(data.slayers.zombie.stats.HEALTH.values, [2, 2, 3, 3, 4, 4, 5, 5, 6]);
  assert.equal(data.slayers.vampire.maxLevel, 5);
  assert.ok(data.slayers.vampire.unknown.length); // the Rift time reward is not a stat of the app
});

test('fairy souls: no permanent stats, the exchange gives SkyBlock XP', () => {
  assert.deepEqual(data.fairySouls.statsPerExchange, {});
  assert.equal(data.fairySouls.perExchange.sbXp, 10);
  assert.equal(data.fairySouls.perExchange.souls, 5);
  assert.equal(data.fairySouls.total.value, 289);
  assert.equal(data.fairySouls.total.confidence, 'safe'); // the wiki and NEU
  assert.equal(data.fairySouls.statsNote.confidence, 'unsafe'); // the wiki alone: check in the game
});

test('SkyBlock level: health per level, strength per 5 levels, 100 XP a level; one source', () => {
  const l = data.skyblockLevel;
  assert.equal(l.perLevel.HEALTH.value, 5);
  assert.equal(l.perFiveLevels.STRENGTH.value, 1);
  assert.equal(l.xpPerLevel.value, 100);
  assert.equal(l.maxLevel.value, 500);
  for (const v of [l.perLevel.HEALTH, l.perFiveLevels.STRENGTH, l.xpPerLevel, l.maxLevel]) assert.equal(v.confidence, 'unsafe');
});

test('cookie and god potion against what the app already has', () => {
  const cookie = Object.fromEntries(gamedata.power.boosterCookie.effects.map((e) => [e.stat, e.value]));
  for (const [stat, v] of Object.entries(data.boosterCookie.stats)) assert.equal(v.value, cookie[stat], stat);
  assert.equal(Object.keys(data.boosterCookie.stats).length, Object.keys(cookie).length);
  // safe means the wiki and the typed value of the app agree; the two that differ are named
  for (const [stat, v] of Object.entries(data.godPotion.stats)) {
    if (v.confidence === 'safe') assert.equal(v.value, GOD_POTION[stat], stat);
    if (v.app !== undefined) assert.equal(v.app, GOD_POTION[stat], stat);
  }
  assert.equal(data.godPotion.stats.STRENGTH.confidence, 'unsafe');
  assert.equal(data.godPotion.stats.STRENGTH.app, 95);
  assert.equal(data.godPotion.stats.DEFENSE.app, 60);
  assert.deepEqual(data.godPotion.notInWikiSum, []);
});

test('accessories: the gaps are counted, enrichments are flat and one source', () => {
  const a = data.accessories;
  assert.ok(a.items.total > a.items.withStats && a.items.withStats > 0);
  assert.equal(a.enrichments.perRarity, null); // not found in either source
  assert.equal(a.enrichments.minRarity, 'LEGENDARY');
  assert.equal(a.enrichments.values.HEALTH.value, 3);
  assert.equal(a.enrichments.values.SPEED.value, 1);
  assert.ok(Object.values(a.enrichments.values).every((v) => v.confidence === 'unsafe'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { statDetail, statsModel } from '../../apps/guide/stats-model.js';
import { statsView } from '../../apps/guide/views/stats.js';
import { statsOf } from '../../apps/guide/totals.js';
import { gamedata, emptyBuild } from '../fixtures/guide-world.js';

const items = {
  DRILL: { name: 'Test Drill', category: 'DRILL', tier: 'LEGENDARY', stats: { MINING_SPEED: 1000, MINING_FORTUNE: 10 } },
  HELM: { name: 'Test Helm', category: 'HELMET', tier: 'EPIC', stats: { MINING_FORTUNE: 5, HEALTH: 50 } },
};
const world = (over = {}) => ({ guides: [], checks: {}, owned: ['DRILL', 'HELM'], build: emptyBuild(), base: {}, draft: {}, gamedata, items, now: 2e12, profile: null, ...over });
const group = (d, title) => d.groups.find((g) => g.title === title);

test('gear is split into Armor, Held Item and the parts of each piece, with sums', () => {
  const d = statDetail(world(), 'mining', 'MINING_FORTUNE');
  assert.equal(group(d, 'Armor').sum, 5);
  assert.equal(group(d, 'Held Item').lines[0].label, 'Test Drill');
  assert.equal(group(d, 'Held Item').lines[0].note, 'calculated');
  assert.deepEqual(group(d, 'Held Item').lines[0].parts.map((p) => p.label), ['Base']);
  assert.equal(group(d, 'Other gear'), undefined); // every point is placed
});

test('a real item with a tooltip counts its tooltip; both figures show when they differ', () => {
  const profile = { fetchedAt: 1, skills: null, slayer: null, skyblockXp: null, items: [{ id: 'DRILL', at: ['Getragen'], tip: { MINING_SPEED: 1500, MINING_FORTUNE: 10 } }] };
  const w = world({ profile });
  const speed = group(statDetail(w, 'mining', 'MINING_SPEED'), 'Held Item').lines[0];
  assert.equal(speed.value, 1500);
  assert.equal(speed.differs, true);
  assert.match(speed.note, /game \(tooltip\) ≠ calculated \+1,?000/);
  const fortune = group(statDetail(w, 'mining', 'MINING_FORTUNE'), 'Held Item').lines[0];
  assert.equal(fortune.note, 'game (tooltip)'); // both agree
  assert.equal(statsModel(w, 'mining').rows.find((r) => r.id === 'MINING_SPEED').total, '1,500');
});

test('the detail page opens a gear line into its parts and marks ≠', () => {
  const profile = { fetchedAt: 1, skills: null, slayer: null, skyblockXp: null, items: [{ id: 'DRILL', at: ['Getragen'], tip: { MINING_SPEED: 1500 } }] };
  const html = statsView(world({ profile }), { page: 'stats', tab: 'detail', area: 'mining', stat: 'MINING_SPEED' });
  assert.match(html, /<details class="detail-part">/);
  assert.match(html, /Test Drill ≠/);
  assert.match(html, /Held Item/);
});

const lonesome = () => {
  const b = emptyBuild();
  b.hotm = { tier: 10, levels: { lonesome_miner: 10 }, omelette: false, disabled: [], ability: null };
  return b;
};

test('a multiplier is its own row with its condition; the switch decides whether it counts', () => {
  const b = lonesome();
  const m = statDetail(world({ build: b }), 'blaze', 'STRENGTH').multipliers.find((x) => x.label === 'Lonesome Miner');
  assert.equal(m.key, 'on_mining_islands');
  assert.equal(m.holds, false); // Blaze is fought on the Crimson Isle, not on a mining island
  const on = { ...b, conditions: { on_mining_islands: true } };
  assert.equal(statDetail(world({ build: on }), 'blaze', 'STRENGTH').multipliers.find((x) => x.label === 'Lonesome Miner').holds, true);
  assert.equal(statsOf(b, gamedata, 'blaze').mult.STRENGTH, undefined);
  assert.ok(statsOf(on, gamedata, 'blaze').mult.STRENGTH > 1);
  const html = statsView(world({ build: on }), { page: 'stats', tab: 'detail', area: 'blaze', stat: 'STRENGTH' });
  assert.match(html, /data-condition="on_mining_islands" checked/);
});

test('Nether Embodiment is a row of the Blaze pet; Blaze counts the Crimson Isle by default and the switch turns it off', () => {
  const pet = gamedata.pets.pets.find((p) => p.id === 'BLAZE');
  const b = { ...emptyBuild(), pet: { id: pet.id, rarity: pet.rarity, level: 100 } };
  const d = statDetail(world({ build: b }), 'blaze', 'STRENGTH');
  const m = d.multipliers.find((x) => /Nether Embodiment/.test(x.label));
  assert.ok(m, 'the pet perk is listed');
  assert.equal(m.condition, 'Crimson Isle');
  assert.equal(m.holds, true);
  assert.equal(statDetail(world({ build: { ...b, conditions: { crimson_isle: false } } }), 'blaze', 'STRENGTH').multipliers.find((x) => /Nether Embodiment/.test(x.label)).holds, false);
});

test('the stats page names the buffs counted as active', () => {
  const build = { ...emptyBuild(), buffs: { godPotion: true, boosterCookie: false }, consumables: { ore_oats: 5 } };
  const profile = { profileId: 'p', fetchedAt: 1, skills: null, slayer: null, skyblockXp: null, items: [] };
  const m = statsModel(world({ build, profile }), 'mining');
  assert.deepEqual(m.buffsOn.map((b) => b.name), ['God Potion', 'Consumables']);
  assert.match(m.buffsOn[0].text, /\+200 Mining Speed/);
  assert.match(statsView(world({ build, profile }), { page: 'stats', tab: 'overview', area: 'mining' }), /Counted as active:.*God Potion/);
  assert.doesNotMatch(statsView(world(), { page: 'stats', tab: 'overview', area: 'mining' }), /Counted as active/);
});

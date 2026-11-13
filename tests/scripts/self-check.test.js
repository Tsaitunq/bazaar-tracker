import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parseLore, loreEnchants, hotmCosts, checkItems, tooltips, checkHotm, checkPlausible } from '../../scripts/lib/self-check.mjs';
import { encodeInventory } from '../fixtures/guide/nbt-encode.js';

test('parseLore: the total and its parts by colour, the rarity from the bold line', () => {
  const { stats, rarity } = parseLore(['§7Mining Speed: §6+2,160 §9[+50] §9(+75) §d(+75)', '§7Pristine: §5+3.1 §d(+1.6)', '§d§l§ka§r §d§lMYTHIC DRILL §d§l§ka']);
  assert.deepEqual(stats.MINING_SPEED, { total: 2160, reforge: 75, gems: 75, hpb: 0, bracket: 50, other: 0 });
  assert.equal(stats.PRISTINE.gems, 1.6);
  assert.equal(rarity, 'MYTHIC');
});

test('loreEnchants: roman levels, a counter after the level, Prismatic is pristine', () => {
  assert.deepEqual(loreEnchants(['§7x', '§9§d§lFlowstate III', '§9Compact V §88,608', '§9Efficiency X, §9Prismatic III', '', '§7text']), { flowstate: 3, compact: 5, efficiency: 10, pristine: 3 });
});

test('hotmCosts: (N+1)^3 for Mining Speed, the Core costs a token but no powder in powder_spent', () => {
  const data = { hotm: { perks: [
    { id: 'mining_speed', type: 'perk', maxLevel: 50, cost: { powder: 'mithril', exp: 3, offset: 1 } },
    { id: 'core_of_the_mountain', type: 'core', maxLevel: 10, levels: [{ level: 2, cost: { powder: 'mithril', amount: 50000 } }] },
    { id: 'pickobulus', type: 'ability', maxLevel: 1 },
  ] } };
  const got = hotmCosts({ nodes: { mining: { mining_speed: 43, core_of_the_mountain: 2, pickobulus: 1 } } }, data);
  assert.equal(got.spent.mithril, 980091);
  assert.equal(got.tokens, 2);
});

test('checkItems: a gem and reforge part that differs is a row, a stat the app does not model is not', async () => {
  const nbt = { id: 1, Count: 1, tag: { ExtraAttributes: { id: 'DIVAN_HELMET', modifier: 'jaded', gems: { AMBER_0: 'FLAWLESS' } }, display: { Name: '§dJaded Divan Helmet', Lore: ['§7Mining Speed: §6+290 §9(+60) §d(+99)', '§7Strength: §c+5 §9(+9)', '§d§lMYTHIC HELMET'] } } };
  const list = await tooltips({ inventory: encodeInventory([nbt]) });
  const rows = checkItems(list, { DIVAN_HELMET: { stats: { MINING_SPEED: 80 } } });
  assert.deepEqual(rows.map((r) => r.field), ['MINING_SPEED gems', 'MINING_SPEED total']); // reforge 60 is right (jaded Mythic); Strength jaded is not in the table
  assert.equal(rows[0].tooltip, 99);
  assert.equal(rows[0].ours, 75);
});

// With the private answer (personal/fixtures/api-profile.json, never in git) every item, the HOTM costs and the plausibility checks must hold.
const FIXTURE = new URL('../../personal/fixtures/api-profile.json', import.meta.url);
const PRIVATE = existsSync(FIXTURE) && existsSync(new URL('../../personal/items.json', import.meta.url));
test('private profile: no difference to the tooltips, the HOTM powder or the plausibility checks', { skip: !PRIVATE && 'no private fixture' }, async () => {
  const json = (u) => JSON.parse(readFileSync(u, 'utf8'));
  const { loadGameData } = await import('../../apps/guide/gamedata.js');
  const answer = json(FIXTURE);
  const data = await loadGameData(async (f) => json(new URL(`../../gamedata/${f}.json`, import.meta.url)));
  const items = json(new URL('../../personal/items.json', import.meta.url)).r;
  const list = await tooltips(answer.inventories);
  const rows = [...checkItems(list, items), ...checkHotm(answer, data), ...checkPlausible(answer, list, data, items)];
  const text = rows.map((r) => `${r.area} ${r.id} ${r.field}: game ${r.tooltip}, app ${r.ours}`);
  assert.deepEqual(text, []);
});

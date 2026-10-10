import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MINIONS, FUELS, UPGRADES, MAX_TIER, ACTIONS_PER_HARVEST, minionYield, minionRows } from '../minions.js';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(b)), `${a} != ${b}`);
const minion = (key) => MINIONS.find((m) => m.key === key);
const product = (buy, sell) => ({ sell_summary: buy == null ? [] : [{ pricePerUnit: buy }], buy_summary: sell == null ? [] : [{ pricePerUnit: sell }] });

test('the data has the shape the calculator expects', () => {
  assert.equal(ACTIONS_PER_HARVEST, 2);
  assert.ok(MINIONS.length >= 12);
  assert.equal(new Set(MINIONS.map((m) => m.key)).size, MINIONS.length);
  for (const m of MINIONS) {
    assert.ok(m.delays.length >= 11 && m.delays.length <= MAX_TIER, m.key);
    assert.equal(m.storage.length, m.delays.length, m.key);
    // a higher tier is never slower and never holds less
    for (let i = 1; i < m.delays.length; i++) assert.ok(m.delays[i] <= m.delays[i - 1] && m.storage[i] >= m.storage[i - 1], `${m.key} tier ${i + 1}`);
    for (const d of m.drops) assert.ok(d.id && d.qty > 0 && d.compact[0] && d.compact[1] >= 160, `${m.key} ${d.id}`);
  }
  assert.deepEqual([FUELS[0].key, UPGRADES[0].key], ['none', 'none']);
  for (const f of FUELS.slice(1)) assert.ok(f.id && (f.speed > 0 || f.mult > 1), f.key);
});

test('every minion, fuel and upgrade is listed with its source', () => {
  const doc = fs.readFileSync(new URL('../docs/minions-sources.md', import.meta.url), 'utf8');
  for (const x of [...MINIONS, ...FUELS.slice(1), ...UPGRADES.slice(1)]) assert.ok(doc.includes(x.name), x.name);
  // the table in the document carries the same numbers as the code
  for (const m of MINIONS) assert.ok(doc.includes(m.delays.join(', ')), `${m.name}: times between actions`);
});

test('a minion harvests every second action: Snow XI without anything', () => {
  // tier XI: 6.5 s between actions, so a harvest every 13 s and 4 Snowballs each
  const made = minionYield(minion('snow'), { tier: 11 });
  near(made.items.SNOW_BALL, 86400 / 13 * 4);
  assert.equal(made.storage, 960);
  assert.deepEqual(made.unsure, []);
  // tier I of the Cobblestone Minion: one Cobblestone every 28 seconds (the example on the wiki)
  near(minionYield(minion('cobblestone'), { tier: 1 }).items.COBBLESTONE, 86400 / 28);
});

test('speed bonuses add up and shorten the time between actions', () => {
  const base = minionYield(minion('clay'), { tier: 11 }).items.CLAY_BALL;
  // the wiki's example: tier XI Clay, 16 s, +10% gives 14.55 s
  near(minionYield(minion('clay'), { tier: 11, fuel: 'lava' }).items.CLAY_BALL, base * 1.25);
  near(minionYield(minion('clay'), { tier: 11, fuel: 'lava', upgrades: ['flycatcher', 'expander'] }).items.CLAY_BALL, base * 1.5);
  near(minionYield(minion('clay'), { tier: 11, upgrades: ['flycatcher', 'flycatcher'] }).items.CLAY_BALL, base * 1.4);
  // a catalyst multiplies the items instead
  near(minionYield(minion('clay'), { tier: 11, fuel: 'hyper' }).items.CLAY_BALL, base * 4);
});

test('Diamond Spreading adds a Diamond per ten items, the Super Compactor makes the enchanted form', () => {
  const snow = minionYield(minion('snow'), { tier: 11, upgrades: ['spreading', 'none'] });
  near(snow.items.DIAMOND, snow.items.SNOW_BALL / 10);
  const both = minionYield(minion('snow'), { tier: 11, upgrades: ['spreading', 'compactor'] });
  assert.deepEqual(Object.keys(both.items).sort(), ['ENCHANTED_DIAMOND', 'ENCHANTED_SNOW_BLOCK']);
  near(both.items.ENCHANTED_SNOW_BLOCK, snow.items.SNOW_BALL / 640);
  near(both.items.ENCHANTED_DIAMOND, snow.items.DIAMOND / 160);
  // chosen twice it still counts once
  near(minionYield(minion('snow'), { tier: 11, upgrades: ['spreading', 'spreading'] }).items.DIAMOND, snow.items.DIAMOND);
  // in a Diamond Minion the extra Diamonds join its own
  const diamond = minionYield(minion('diamond'), { tier: 11, upgrades: ['spreading'] });
  near(diamond.items.DIAMOND, 86400 / 30 * 1.1);
  // with a catalyst the sources leave open whether the extra Diamonds are multiplied: counted once and said so
  const hyper = minionYield(minion('snow'), { tier: 11, fuel: 'hyper', upgrades: ['spreading'] });
  near(hyper.items.DIAMOND, snow.items.DIAMOND);
  assert.equal(hyper.unsure.length, 1);
});

test('what the wiki leaves open is marked, and a tier the minion lacks becomes its highest', () => {
  const tarantula = minionYield(minion('tarantula'), { tier: 12 });
  near(tarantula.items.STRING, 86400 / 16 * 3.5);
  near(tarantula.items.IRON_INGOT, 86400 / 16 * 0.2);
  assert.match(tarantula.unsure[0], /2 to 5 per harvest.*middle \(3\.5\)/);
  assert.equal(minionYield(minion('slime'), { tier: 12 }).tier, 11);
  assert.equal(minionYield(minion('slime'), { tier: 0 }).tier, 1);
  // a Slime drops one ball always and two more at 50% each
  near(minionYield(minion('slime'), { tier: 11 }).items.SLIME_BALL, 86400 / 24 * 2);
});

test('minionRows: Bazaar against NPC, fuel taken off, the best minion first', () => {
  const products = { SNOW_BALL: product(2, 3), COBBLESTONE: product(1, 2), ENCHANTED_BREAD: product(90, 100), CLAY_BALL: product(null, 5) };
  const npc = { SNOW_BALL: 1, COBBLESTONE: 3, CLAY_BALL: 3 };
  const rows = minionRows(products, npc, { tier: 11, count: 2, fuel: 'bread', upgrades: ['none', 'none'] }, { tax: 0.0125 });
  assert.equal(rows.length, MINIONS.length);
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].net >= rows[i].net);
  const snow = rows.find((r) => r.key === 'snow');
  const perDay = 86400 / 13 * 4 * 1.05;
  near(snow.itemsDay, perDay * 2);
  near(snow.bazaar, perDay * 2 * (1 - 0.0125) * 2);      // sold to the buy order at 2, two minions
  near(snow.npcCoins, perDay * 1 * 2);
  near(snow.fuelCost, 2 * 100 * 2);                      // two breads a day at the sell offer, two minions
  assert.equal(snow.best, 'bazaar');
  near(snow.net, snow.bazaar - snow.fuelCost);
  near(snow.fillHours, 960 / (perDay / 24));
  // the NPC pays more for Cobblestone
  const cobble = rows.find((r) => r.key === 'cobblestone');
  assert.equal(cobble.best, 'npc');
  near(cobble.net, cobble.npcCoins - cobble.fuelCost);
  // no buy order: counted as 0 at the Bazaar and said so
  const clay = rows.find((r) => r.key === 'clay');
  assert.equal(clay.bazaar, 0);
  assert.ok(clay.unsure.some((u) => u.includes('No buy order for CLAY_BALL')));
  // a permanent fuel costs nothing per day; a fuel without a price is said to be missing
  assert.equal(minionRows(products, npc, { tier: 11, count: 1, fuel: 'lava' }, { tax: 0 })[0].fuelCost, 0);
  const noFuelPrice = minionRows(products, npc, { tier: 11, count: 1, fuel: 'hyper' }, { tax: 0 })[0];
  assert.ok(noFuelPrice.unsure.some((u) => u.includes('No sell offer for Hyper Catalyst')));
});

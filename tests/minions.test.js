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
    for (const d of m.drops) assert.ok(d.id && d.qty > 0 && d.compact[0] && d.compact[1] >= 40, `${m.key} ${d.id}`);
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
  near(tarantula.items.STRING, 86400 / 16 * 3.16);
  near(tarantula.items.IRON_INGOT, 86400 / 16 * 0.2);
  assert.deepEqual(tarantula.unsure, []);
  // the wiki gives a string compactor of 160, not 192
  near(minionYield(minion('tarantula'), { tier: 12, upgrades: ['compactor'] }).items.ENCHANTED_STRING, 86400 / 16 * 3.16 / 160);
  assert.match(minionYield(minion('melon'), { tier: 12 }).unsure.join(' '), /replant/);
  // a fishing minion only harvests: one action per catch, and it holds 640 to 960
  near(minionYield(minion('fishing'), { tier: 12 }).items.RAW_FISH, 86400 / 30 * 0.54);
  assert.equal(minion('fishing').storage[0], 640);
  assert.equal(minion('wheat').storage[0], 128);
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

test('a lone order far above the enchanted form is not a price: raw Raw Fish counts at what it makes', () => {
  // the case of the live Bazaar: Raw Fish topped at 310 while Enchanted Raw Fish (160) was worth 5 per fish
  const products = { RAW_FISH: product(310, 400), ENCHANTED_RAW_FISH: product(800, 1000) };
  const row = minionRows(products, {}, { tier: 12, count: 1, fuel: 'none', upgrades: ['none', 'none'] }, { tax: 0 }).find((r) => r.key === 'fishing');
  near(row.bazaar, 86400 / 30 * 0.54 * (800 / 160));
  assert.ok(row.unsure.some((u) => u.includes('RAW_FISH is far above')));
  // the real item ids of the other three catches exist on the Bazaar
  assert.deepEqual(minion('fishing').drops.map((d) => d.id).slice(0, 4), ['RAW_FISH', 'RAW_FISH:1', 'RAW_FISH:3', 'RAW_FISH:2']);
});

test('the better of item and block is sold, a thin market is marked and sorted last', () => {
  const vol = (week) => ({ quick_status: { buyMovingWeek: week, sellMovingWeek: week } });
  const clay = (block) => ({
    ENCHANTED_CLAY_BALL: { ...product(400, 500), ...vol(1e7) },
    ENCHANTED_CLAY_BLOCK: { ...product(block, block * 1.2), ...vol(1e6) },
  });
  const setup = { tier: 12, count: 1, fuel: 'none', upgrades: ['compactor', 'none'] };
  const perDay = 86400 / 28 * 4 / 160;
  // a block worth 160 × 450 beats the item at 400
  near(minionRows(clay(72000), {}, setup, { tax: 0 }).find((r) => r.key === 'clay').bazaar, perDay * 450);
  // a block worth less is not used
  near(minionRows(clay(40000), {}, setup, { tax: 0 }).find((r) => r.key === 'clay').bazaar, perDay * 400);
  // too thin: the block pays more, but trades under 20 weeks of output, so the item is sold
  const thin = clay(72000); thin.ENCHANTED_CLAY_BLOCK.quick_status = { buyMovingWeek: 5, sellMovingWeek: 5 };
  near(minionRows(thin, {}, setup, { tax: 0 }).find((r) => r.key === 'clay').bazaar, perDay * 400);
  // only a thin form left: flagged and listed after the minions that are not
  const only = { ENCHANTED_CLAY_BALL: { ...product(400, 500), ...vol(10) }, ENCHANTED_COBBLESTONE: { ...product(300, 400), ...vol(1e7) } };
  const rows = minionRows(only, {}, setup, { tax: 0 });
  const flagged = rows.find((r) => r.key === 'clay');
  assert.deepEqual(flagged.lowVolume, ['ENCHANTED_CLAY_BALL']);
  assert.ok(flagged.unsure.some((u) => u.startsWith('Low volume – price unreliable')));
  assert.ok(rows.findIndex((r) => r.key === 'clay') > rows.findIndex((r) => r.key === 'cobblestone'));
});

test('Slayer requirements: Tarantula and Revenant lock below V, tier XII below IX, and can be hidden', () => {
  const setup = { tier: 11, count: 1, fuel: 'none', upgrades: ['none', 'none'] };
  const rows = (o) => minionRows({}, {}, { ...setup, ...o }, { tax: 0 });
  const get = (r, key) => r.find((x) => x.key === key);
  // nothing is locked until the levels are given
  assert.equal(get(rows({}), 'tarantula').locked, false);
  assert.equal(get(rows({}), 'tarantula').requires, 'Spider Slayer V (tiers I to XI), IX (tier XII)');
  assert.equal(get(rows({ spider: 4 }), 'tarantula').locked, true);
  assert.equal(get(rows({ spider: 4 }), 'revenant').locked, false);
  assert.equal(get(rows({ zombie: 5, tier: 11 }), 'revenant').locked, false);
  assert.equal(get(rows({ zombie: 8, tier: 12 }), 'revenant').locked, true);
  assert.equal(get(rows({ zombie: 9, tier: 12 }), 'revenant').locked, false);
  // other minions have no Slayer requirement
  assert.equal(get(rows({ spider: 0, zombie: 0 }), 'diamond').locked, false);
  assert.equal(get(rows({}), 'diamond').requires, null);
  // hidden when the player cannot craft them
  const hidden = rows({ spider: 0, zombie: 0, hide: true }).map((r) => r.key);
  assert.ok(!hidden.includes('tarantula') && !hidden.includes('revenant') && hidden.includes('diamond'));
});

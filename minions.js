// Minion calculator: what a minion setup earns per day. All game data here is static and comes from
// the wiki; every number has its source in docs/minions-sources.md. Nothing is estimated: where the
// sources leave something open, the entry carries `unsure` and the app shows it.
import { bookPrices } from './flips.js';

const DAY_S = 86400;
// A minion works in turns: one action places a block or spawns a mob, the next one harvests it.
export const ACTIONS_PER_HARVEST = 2;
export const SPREADING_CHANCE = 0.1; // Diamond Spreading: one Diamond per 10 items collected

const RANGE = (from, to) => `The wiki gives ${from} to ${to} per harvest and no average; the middle (${(from + to) / 2}) is used.`;
// tiers I to V share storage and speed in pairs, so every list has one entry per tier
const STORAGE = [64, 192, 192, 384, 384, 576, 576, 768, 768, 960, 960, 960];

// delays: seconds between two actions per tier, tier I first. storage: items a minion holds per tier.
// drops: items per harvest. qty is the expected amount (amount × chance); compact: [enchanted item, how
// many of the drop make one] for the Super Compactor 3000.
export const MINIONS = [
  { key: 'snow', name: 'Snow Minion', delays: [13, 13, 12, 12, 11, 11, 9.5, 9.5, 8, 8, 6.5, 5.8],
    drops: [{ id: 'SNOW_BALL', qty: 4, compact: ['ENCHANTED_SNOW_BLOCK', 640] }] },
  { key: 'clay', name: 'Clay Minion', delays: [32, 32, 30, 30, 27.5, 27.5, 24, 24, 20, 20, 16, 14],
    drops: [{ id: 'CLAY_BALL', qty: 4, compact: ['ENCHANTED_CLAY_BALL', 160] }] },
  { key: 'cobblestone', name: 'Cobblestone Minion', delays: [14, 14, 12, 12, 10, 10, 9, 9, 8, 8, 7, 6],
    drops: [{ id: 'COBBLESTONE', qty: 1, compact: ['ENCHANTED_COBBLESTONE', 160] }] },
  { key: 'coal', name: 'Coal Minion', delays: [15, 15, 13, 13, 12, 12, 10, 10, 9, 9, 7, 6],
    drops: [{ id: 'COAL', qty: 1, compact: ['ENCHANTED_COAL', 160] }] },
  { key: 'diamond', name: 'Diamond Minion', delays: [29, 29, 27, 27, 25, 25, 22, 22, 19, 19, 15, 12],
    drops: [{ id: 'DIAMOND', qty: 1, compact: ['ENCHANTED_DIAMOND', 160] }] },
  { key: 'lapis', name: 'Lapis Minion', delays: [29, 29, 27, 27, 25, 25, 23, 23, 21, 21, 18, 16],
    drops: [{ id: 'INK_SACK:4', qty: 4.5, unsure: RANGE(3, 6), compact: ['ENCHANTED_LAPIS_LAZULI', 160] }] },
  { key: 'redstone', name: 'Redstone Minion', delays: [29, 29, 27, 27, 25, 25, 23, 23, 21, 21, 18, 16],
    drops: [{ id: 'REDSTONE', qty: 4.5, unsure: RANGE(3, 6), compact: ['ENCHANTED_REDSTONE', 160] }] },
  { key: 'emerald', name: 'Emerald Minion', delays: [28, 28, 26, 26, 24, 24, 21, 21, 18, 18, 14, 12],
    drops: [{ id: 'EMERALD', qty: 1, compact: ['ENCHANTED_EMERALD', 160] }] },
  { key: 'obsidian', name: 'Obsidian Minion', delays: [45, 45, 42, 42, 39, 39, 35, 35, 30, 30, 24, 21],
    drops: [{ id: 'OBSIDIAN', qty: 1, compact: ['ENCHANTED_OBSIDIAN', 160] }] },
  { key: 'sugarcane', name: 'Sugar Cane Minion', delays: [22, 22, 20, 20, 18, 18, 16, 16, 14.5, 14.5, 12, 9],
    drops: [{ id: 'SUGAR_CANE', qty: 3, compact: ['ENCHANTED_SUGAR', 160] }] },
  // a slime drops one Slimeball always and two more at 50% each; the wiki lists tiers I to XI only
  { key: 'slime', name: 'Slime Minion', delays: [26, 26, 24, 24, 22, 22, 19, 19, 16, 16, 12],
    drops: [{ id: 'SLIME_BALL', qty: 2, compact: ['ENCHANTED_SLIME_BALL', 160] }] },
  { key: 'tarantula', name: 'Tarantula Minion', delays: [29, 29, 26, 26, 23, 23, 19, 19, 14.5, 14.5, 10, 8],
    drops: [
      { id: 'STRING', qty: 3.5, unsure: RANGE(2, 5), compact: ['ENCHANTED_STRING', 192] },
      { id: 'SPIDER_EYE', qty: 1, compact: ['ENCHANTED_SPIDER_EYE', 160] },
      { id: 'IRON_INGOT', qty: 0.2, compact: ['ENCHANTED_IRON', 160] },
    ] },
  { key: 'revenant', name: 'Revenant Minion', delays: [29, 29, 26, 26, 23, 23, 19, 19, 14.5, 14.5, 10, 8],
    drops: [
      { id: 'ROTTEN_FLESH', qty: 3.5, unsure: RANGE(2, 5), compact: ['ENCHANTED_ROTTEN_FLESH', 160] },
      { id: 'DIAMOND', qty: 0.2, compact: ['ENCHANTED_DIAMOND', 160] },
    ] },
].map((m) => ({ ...m, storage: STORAGE.slice(0, m.delays.length) }));
export const MAX_TIER = 12;

// speed: added to the minion's speed (0.25 = 25%). mult: every item is generated this many times instead.
// hours: how long one piece lasts; without it the fuel is permanent and costs nothing per day.
export const FUELS = [
  { key: 'none', name: 'No fuel' },
  { key: 'bread', name: 'Enchanted Bread', id: 'ENCHANTED_BREAD', speed: 0.05, hours: 12 },
  { key: 'charcoal', name: 'Enchanted Charcoal', id: 'ENCHANTED_CHARCOAL', speed: 0.2, hours: 36 },
  { key: 'lava', name: 'Enchanted Lava Bucket', id: 'ENCHANTED_LAVA_BUCKET', speed: 0.25 },
  { key: 'magma', name: 'Magma Bucket', id: 'MAGMA_BUCKET', speed: 0.3 },
  { key: 'plasma', name: 'Plasma Bucket', id: 'PLASMA_BUCKET', speed: 0.35 },
  { key: 'hamster', name: 'Hamster Wheel', id: 'HAMSTER_WHEEL', speed: 0.5, hours: 24 },
  { key: 'foul', name: 'Foul Flesh', id: 'FOUL_FLESH', speed: 0.9, hours: 5 },
  { key: 'catalyst', name: 'Catalyst', id: 'CATALYST', mult: 3, hours: 3 },
  { key: 'hyper', name: 'Hyper Catalyst', id: 'HYPER_CATALYST', mult: 4, hours: 6 },
];

// A minion has two upgrade slots. Speed upgrades add up, also twice the same; the other two count once.
export const UPGRADES = [
  { key: 'none', name: 'No upgrade' },
  { key: 'spreading', name: 'Diamond Spreading' },
  { key: 'compactor', name: 'Super Compactor 3000' },
  { key: 'flycatcher', name: 'Flycatcher', speed: 0.2 },
  { key: 'expander', name: 'Minion Expander', speed: 0.05 },
];

const SPREADING_WITH_MULT = 'The sources do not say whether a Catalyst also multiplies the Diamonds of Diamond Spreading; they are counted once.';
const byKey = (list, key) => list.find((x) => x.key === key) ?? list[0];

// What one minion generates per day: { tier, items: { itemId: amount }, storage, unsure: [notes] }.
// setup: { tier: 1 to 12, fuel: key, upgrades: [key, key] }. A tier the minion does not have becomes its highest.
// Speed bonuses add up and shorten the time between actions: time = base / (1 + bonus).
export function minionYield(minion, { tier = 1, fuel = 'none', upgrades = [] } = {}) {
  const t = Math.min(Math.max(1, Math.floor(tier) || 1), minion.delays.length);
  const fuelUsed = byKey(FUELS, fuel);
  const used = upgrades.map((key) => byKey(UPGRADES, key));
  const has = (key) => used.some((u) => u.key === key);
  const speed = (fuelUsed.speed ?? 0) + used.reduce((sum, u) => sum + (u.speed ?? 0), 0);
  const mult = fuelUsed.mult ?? 1;
  const harvests = DAY_S / (ACTIONS_PER_HARVEST * minion.delays[t - 1] / (1 + speed));

  const unsure = minion.drops.map((d) => d.unsure).filter(Boolean);
  const raw = {};
  for (const d of minion.drops) raw[d.id] = (raw[d.id] ?? 0) + d.qty * harvests * mult;
  const compact = Object.fromEntries(minion.drops.map((d) => [d.id, d.compact]));
  if (has('spreading')) {
    // per item collected, so a minion that harvests four items at once gets four chances
    const collected = minion.drops.reduce((sum, d) => sum + d.qty, 0) * harvests;
    raw.DIAMOND = (raw.DIAMOND ?? 0) + collected * SPREADING_CHANCE;
    compact.DIAMOND = ['ENCHANTED_DIAMOND', 160];
    if (mult > 1) unsure.push(SPREADING_WITH_MULT);
  }
  const items = {};
  for (const [id, amount] of Object.entries(raw)) {
    const [to, per] = has('compactor') ? compact[id] : [id, 1];
    items[to] = (items[to] ?? 0) + amount / per;
  }
  return { tier: t, items, storage: minion.storage[t - 1], unsure };
}

// Every minion with the same setup, the one that earns most first.
// setup: as for minionYield, plus count (minions placed). npc: NPC sell price per item id. tax: fraction.
// Per row, for all `count` minions and per day: bazaar (sold to the highest buy orders, tax taken off),
// npcCoins, fuelCost (fuel that is used up, bought at the lowest sell offer), best ('bazaar' or 'npc') and
// net = the better of the two minus the fuel. fillHours: until one minion's storage is full.
// A price that is missing counts as 0 and adds a note to `unsure`.
export function minionRows(products, npc, setup, { tax }) {
  const count = Math.max(1, Math.floor(setup.count) || 1);
  const fuel = byKey(FUELS, setup.fuel);
  const fuelPrice = fuel.hours ? (products[fuel.id] && bookPrices(products[fuel.id])?.sell) ?? null : 0;
  return MINIONS.map((minion) => {
    const made = minionYield(minion, setup);
    const unsure = [...made.unsure];
    let bazaar = 0, npcCoins = 0, perDay = 0;
    for (const [id, amount] of Object.entries(made.items)) {
      const price = products[id] && bookPrices(products[id])?.buy;
      if (!price) unsure.push(`No buy order for ${id} right now; it counts as 0 at the Bazaar.`);
      bazaar += amount * (price ?? 0) * (1 - tax);
      npcCoins += amount * (npc[id] ?? 0);
      perDay += amount;
    }
    if (fuelPrice === null) unsure.push(`No sell offer for ${fuel.name} right now; its cost is missing.`);
    const fuelCost = fuel.hours ? (24 / fuel.hours) * (fuelPrice ?? 0) : 0;
    const best = npcCoins > bazaar ? 'npc' : 'bazaar';
    return {
      key: minion.key, name: minion.name, id: minion.drops[0].id, tier: made.tier, maxTier: minion.delays.length,
      bazaar: bazaar * count, npcCoins: npcCoins * count, fuelCost: fuelCost * count, best,
      net: (Math.max(bazaar, npcCoins) - fuelCost) * count,
      itemsDay: perDay * count, fillHours: made.storage / (perDay / 24), unsure,
    };
  }).sort((a, b) => b.net - a.net);
}

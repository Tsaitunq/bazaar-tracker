// Minion calculator: what a minion setup earns per day. All game data here is static and comes from
// the wiki; every number has its source in docs/minions-sources.md. Nothing is estimated: where the
// sources leave something open, the entry carries `unsure` and the app shows it.
import { bookPrices, statOf, MEDIAN_SPIKE } from './flips.js';

const DAY_S = 86400;
// A minion works in turns: one action places a block or spawns a mob, the next one harvests it.
export const ACTIONS_PER_HARVEST = 2;
export const SPREADING_CHANCE = 0.1; // Diamond Spreading: one Diamond per 10 items collected

// tiers I to V share storage and speed in pairs, so every list has one entry per tier
const STORAGE = [64, 192, 192, 384, 384, 576, 576, 768, 768, 960, 960, 960];
const STORAGE_WHEAT = [128, 256, 256, 384, 384, 576, 576, 768, 768, 960, 960, 960];
const STORAGE_FISH = [640, 640, 640, 704, 704, 768, 768, 832, 832, 896, 960, 960];
const SC = 160; // items of a drop that one Super Compactor 3000 turns into one enchanted item
const SEEDS_NOTE = 'Online, once the seeds are planted, the minion needs no planting action and would harvest twice as fast; the wiki says offline it is counted with a replant after every harvest, so two actions are used.';

// delays: seconds between two actions per tier, tier I first. storageList: items a minion holds per tier
// (default STORAGE). drops: items per harvest. qty is the expected amount (amount × chance); compact:
// [enchanted item, how many of the drop make one] for the Super Compactor 3000. actions: actions per
// harvest (default ACTIONS_PER_HARVEST). note: shown with the minion as a "not confirmed" remark.
export const MINIONS = [
  { key: 'snow', name: 'Snow Minion', delays: [13, 13, 12, 12, 11, 11, 9.5, 9.5, 8, 8, 6.5, 5.8],
    drops: [{ id: 'SNOW_BALL', qty: 4, compact: ['ENCHANTED_SNOW_BLOCK', 640] }] },
  { key: 'clay', name: 'Clay Minion', delays: [32, 32, 30, 30, 27.5, 27.5, 24, 24, 20, 20, 16, 14],
    drops: [{ id: 'CLAY_BALL', qty: 4, compact: ['ENCHANTED_CLAY_BALL', SC] }] },
  { key: 'cobblestone', name: 'Cobblestone Minion', delays: [14, 14, 12, 12, 10, 10, 9, 9, 8, 8, 7, 6],
    drops: [{ id: 'COBBLESTONE', qty: 1, compact: ['ENCHANTED_COBBLESTONE', SC] }] },
  { key: 'coal', name: 'Coal Minion', delays: [15, 15, 13, 13, 12, 12, 10, 10, 9, 9, 7, 6],
    drops: [{ id: 'COAL', qty: 1, compact: ['ENCHANTED_COAL', SC] }] },
  { key: 'diamond', name: 'Diamond Minion', delays: [29, 29, 27, 27, 25, 25, 22, 22, 19, 19, 15, 12],
    drops: [{ id: 'DIAMOND', qty: 1, compact: ['ENCHANTED_DIAMOND', SC] }] },
  { key: 'lapis', name: 'Lapis Minion', delays: [29, 29, 27, 27, 25, 25, 23, 23, 21, 21, 18, 16],
    drops: [{ id: 'INK_SACK:4', qty: 6, compact: ['ENCHANTED_LAPIS_LAZULI', SC] }] },
  { key: 'redstone', name: 'Redstone Minion', delays: [29, 29, 27, 27, 25, 25, 23, 23, 21, 21, 18, 16],
    drops: [{ id: 'REDSTONE', qty: 4.5, compact: ['ENCHANTED_REDSTONE', SC] }] },
  { key: 'emerald', name: 'Emerald Minion', delays: [28, 28, 26, 26, 24, 24, 21, 21, 18, 18, 14, 12],
    drops: [{ id: 'EMERALD', qty: 1, compact: ['ENCHANTED_EMERALD', SC] }] },
  { key: 'obsidian', name: 'Obsidian Minion', delays: [45, 45, 42, 42, 39, 39, 35, 35, 30, 30, 24, 21],
    drops: [{ id: 'OBSIDIAN', qty: 1, compact: ['ENCHANTED_OBSIDIAN', SC] }] },
  { key: 'sugarcane', name: 'Sugar Cane Minion', delays: [22, 22, 20, 20, 18, 18, 16, 16, 14.5, 14.5, 12, 9],
    drops: [{ id: 'SUGAR_CANE', qty: 3, compact: ['ENCHANTED_SUGAR', SC] }] },
  // a slime drops one Slimeball always and two more at 50% each; the wiki lists tiers I to XI only
  { key: 'slime', name: 'Slime Minion', delays: [26, 26, 24, 24, 22, 22, 19, 19, 16, 16, 12],
    drops: [{ id: 'SLIME_BALL', qty: 2, compact: ['ENCHANTED_SLIME_BALL', SC] }] },
  { key: 'tarantula', name: 'Tarantula Minion', delays: [29, 29, 26, 26, 23, 23, 19, 19, 14.5, 14.5, 10, 8],
    drops: [
      { id: 'STRING', qty: 3.16, compact: ['ENCHANTED_STRING', SC] },
      { id: 'SPIDER_EYE', qty: 1, compact: ['ENCHANTED_SPIDER_EYE', SC] },
      { id: 'IRON_INGOT', qty: 0.2, compact: ['ENCHANTED_IRON', SC] },
    ] },
  { key: 'revenant', name: 'Revenant Minion', delays: [29, 29, 26, 26, 23, 23, 19, 19, 14.5, 14.5, 10, 8],
    drops: [
      { id: 'ROTTEN_FLESH', qty: 3.16, compact: ['ENCHANTED_ROTTEN_FLESH', SC] },
      { id: 'DIAMOND', qty: 0.2, compact: ['ENCHANTED_DIAMOND', SC] },
    ] },
  { key: 'wheat', name: 'Wheat Minion', delays: [15, 15, 13, 13, 11, 11, 10, 10, 9, 9, 8, 7], storageList: STORAGE_WHEAT,
    drops: [
      { id: 'WHEAT', qty: 1, compact: ['ENCHANTED_WHEAT', SC] },
      { id: 'SEEDS', qty: 1.5, compact: ['ENCHANTED_SEEDS', SC] },
    ] },
  { key: 'carrot', name: 'Carrot Minion', delays: [20, 20, 18, 18, 16, 16, 14, 14, 12, 12, 10, 8],
    drops: [{ id: 'CARROT_ITEM', qty: 3, compact: ['ENCHANTED_CARROT', SC] }] },
  { key: 'potato', name: 'Potato Minion', delays: [20, 20, 18, 18, 16, 16, 14, 14, 12, 12, 10, 8],
    drops: [{ id: 'POTATO_ITEM', qty: 3, compact: ['ENCHANTED_POTATO', SC] }] },
  { key: 'melon', name: 'Melon Minion', delays: [24, 24, 22.5, 22.5, 21, 21, 18.5, 18.5, 16, 16, 13, 10], note: SEEDS_NOTE,
    drops: [{ id: 'MELON', qty: 5, compact: ['ENCHANTED_MELON', SC],
      unsure: 'The wiki names the 160-slice item "Enchanted Melon Slice"; it is matched to the Bazaar item ENCHANTED_MELON by its price ratio, not by a name.' }] },
  { key: 'pumpkin', name: 'Pumpkin Minion', delays: [32, 32, 30, 30, 27, 27, 24, 24, 20, 20, 16, 12], note: SEEDS_NOTE,
    drops: [{ id: 'PUMPKIN', qty: 1, compact: ['ENCHANTED_PUMPKIN', SC] }] },
  { key: 'cactus', name: 'Cactus Minion', delays: [27, 27, 25, 25, 23, 23, 21, 21, 18, 18, 15, 12],
    drops: [{ id: 'CACTUS', qty: 3, compact: ['ENCHANTED_CACTUS_GREEN', SC],
      unsure: 'Cactus is compacted as Cactus Green: that needs an Auto Smelter as well (or a Dwarven Super Compactor), which takes the second slot.' }] },
  { key: 'glowstone', name: 'Glowstone Minion', delays: [25, 25, 23, 23, 21, 21, 19, 19, 16, 16, 13, 11],
    drops: [{ id: 'GLOWSTONE_DUST', qty: 3, compact: ['ENCHANTED_GLOWSTONE_DUST', SC] }] },
  // a fishing minion only harvests: one action is one catch
  { key: 'fishing', name: 'Fishing Minion', delays: [75, 75, 67, 67, 59, 59, 51, 51, 43, 43, 35, 30], storageList: STORAGE_FISH, actions: 1,
    drops: [
      { id: 'RAW_FISH', qty: 0.54, compact: ['ENCHANTED_RAW_FISH', SC] },
      { id: 'RAW_FISH:1', qty: 0.225, compact: ['ENCHANTED_RAW_SALMON', SC] },
      { id: 'RAW_FISH:3', qty: 0.117, compact: ['ENCHANTED_PUFFERFISH', SC] },
      { id: 'RAW_FISH:2', qty: 0.036, compact: ['ENCHANTED_CLOWNFISH', SC] },
      { id: 'PRISMARINE_CRYSTALS', qty: 0.02734, compact: ['ENCHANTED_PRISMARINE_CRYSTALS', SC] },
      { id: 'PRISMARINE_SHARD', qty: 0.02734, compact: ['ENCHANTED_PRISMARINE_SHARD', SC] },
      { id: 'SPONGE', qty: 0.02734, compact: ['ENCHANTED_SPONGE', 40] },
    ] },
].map((m) => ({ ...m, storage: (m.storageList ?? STORAGE).slice(0, m.delays.length) }));
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
  const harvests = DAY_S / ((minion.actions ?? ACTIONS_PER_HARVEST) * minion.delays[t - 1] / (1 + speed));

  const unsure = [...minion.drops.map((d) => d.unsure), minion.note].filter(Boolean);
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

// The second step of the Super Compactor 3000: [item, how many of the first make one]. Only the ones the
// wiki lists on the minion pages; where it lists none (Cobblestone, Obsidian, Snow) there is no entry.
const BLOCKS = {
  ENCHANTED_CLAY_BALL: ['ENCHANTED_CLAY_BLOCK', 160], ENCHANTED_DIAMOND: ['ENCHANTED_DIAMOND_BLOCK', 160],
  ENCHANTED_LAPIS_LAZULI: ['ENCHANTED_LAPIS_LAZULI_BLOCK', 160], ENCHANTED_EMERALD: ['ENCHANTED_EMERALD_BLOCK', 160],
  ENCHANTED_REDSTONE: ['ENCHANTED_REDSTONE_BLOCK', 160], ENCHANTED_SUGAR: ['ENCHANTED_SUGAR_CANE', 160],
  ENCHANTED_IRON: ['ENCHANTED_IRON_BLOCK', 160], ENCHANTED_PUMPKIN: ['POLISHED_PUMPKIN', 160],
  ENCHANTED_WHEAT: ['ENCHANTED_HAY_BALE', 160], ENCHANTED_SEEDS: ['BOX_OF_SEEDS', 160],
  ENCHANTED_CARROT: ['ENCHANTED_GOLDEN_CARROT', 160], ENCHANTED_POTATO: ['ENCHANTED_BAKED_POTATO', 160],
  ENCHANTED_CACTUS_GREEN: ['ENCHANTED_CACTUS', 160], ENCHANTED_GLOWSTONE_DUST: ['ENCHANTED_GLOWSTONE', 160],
  ENCHANTED_SPONGE: ['ENCHANTED_WET_SPONGE', 40],
};
// A form counts as thin when its weekly volume is less than this many times what the minions make in a week.
export const LOW_VOLUME_FACTOR = 20;
// raw item -> [enchanted item, how many make one], to tell a raw price that no one could really get
const COMPACT_OF = Object.fromEntries(MINIONS.flatMap((m) => m.drops.map((d) => [d.id, d.compact])));
const weekVolume = (p) => { const q = p?.quick_status; return q ? Math.min(q.buyMovingWeek, q.sellMovingWeek) : null; };

// Sells perDay of one item at the Bazaar: the item itself or, with a Super Compactor 3000, the block of it,
// whichever pays more among the forms that trade enough. A buy order far above the 7 day median counts at the
// median, and a raw item never above what its enchanted form is worth per piece (plus the same margin): a lone
// order far above that is not a price one can sell at. { form, id, coins (after tax), low: true when no form trades enough, notes }.
function bestForm(id, perDay, products, { tax, stats, count }) {
  const forms = [[id, perDay, 'item']];
  if (BLOCKS[id]) forms.push([BLOCKS[id][0], perDay / BLOCKS[id][1], 'block']);
  const options = [];
  for (const [fid, amount, form] of forms) {
    const price = products[fid] && bookPrices(products[fid])?.buy;
    if (!price) continue;
    const median = statOf(stats, fid).median;
    let cap = median > 0 ? median : Infinity;
    const [ench, per] = COMPACT_OF[fid] ?? [];
    const enchBuy = ench && products[ench] && bookPrices(products[ench])?.buy;
    if (enchBuy) cap = Math.min(cap, enchBuy / per);
    const spike = price > cap * (1 + MEDIAN_SPIKE);
    const vol = weekVolume(products[fid]);
    options.push({ form, id: fid, amount, coins: amount * (spike ? cap : price) * (1 - tax), spike,
      low: vol !== null && vol < LOW_VOLUME_FACTOR * amount * count * 7 });
  }
  const sorted = options.sort((x, y) => y.coins - x.coins);
  return sorted.find((o) => !o.low) ?? sorted[0] ?? null;
}

// Every minion with the same setup, the one that earns most first, minions that rely on a thin market last.
// setup: as for minionYield, plus count (minions placed). npc: NPC sell price per item id. tax: fraction.
// stats: the app's stats (7 day medians) or null. Per row, for all `count` minions and per day: bazaar (sold to
// the highest buy orders, tax taken off, in the better of item and block), npcCoins, fuelCost (fuel that is used
// up, bought at the lowest sell offer), best ('bazaar' or 'npc') and net = the better of the two minus the fuel.
// fillHours: until one minion's storage is full. lowVolume: ids whose market is too thin for the amount.
// A price that is missing counts as 0 and adds a note to `unsure`.
export function minionRows(products, npc, setup, { tax, stats = null }) {
  const count = Math.max(1, Math.floor(setup.count) || 1);
  const fuel = byKey(FUELS, setup.fuel);
  const fuelPrice = fuel.hours ? (products[fuel.id] && bookPrices(products[fuel.id])?.sell) ?? null : 0;
  const rows = MINIONS.map((minion) => {
    const made = minionYield(minion, setup);
    const unsure = [...made.unsure];
    const lowVolume = [];
    let bazaar = 0, npcCoins = 0, perDay = 0;
    for (const [id, amount] of Object.entries(made.items)) {
      const sold = bestForm(id, amount, products, { tax, stats, count });
      if (!sold) unsure.push(`No buy order for ${id} right now; it counts as 0 at the Bazaar.`);
      else {
        bazaar += sold.coins;
        if (sold.low) { lowVolume.push(sold.id); unsure.push(`Low volume – price unreliable: ${sold.id} trades too little for this amount.`); }
        if (sold.spike) unsure.push(`${sold.id} is far above its 7 day median or above its enchanted form; counted at that value.`);
      }
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
      itemsDay: perDay * count, fillHours: made.storage / (perDay / 24), unsure, lowVolume,
    };
  });
  return rows.sort((a, b) => (a.lowVolume.length > 0) - (b.lowVolume.length > 0) || b.net - a.net);
}

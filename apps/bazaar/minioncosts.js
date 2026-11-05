// What it costs to craft each minion tier. Static wiki data, every list checked against the page's own
// "Total Cumulative Cost" table; sources and the per-tier recipes are in docs/minions-sources.md.
//
// COSTS[key][tier - 1] is what the step to that tier adds: [[item id, amount], ...]. The minion of the tier
// before is always part of the step and is not listed; the cost up to a tier is the sum of its steps. Where the
// wiki's ingredient is another minion (Tarantula needs a Spider Minion, Revenant a Zombie Minion, Inferno XI an
// Inferno Minion VIII) it is written out as the items that minion is made of, as the wiki's cumulative cost does.
// COINS is a coin amount. An id the Bazaar does not list is shown as "not on Bazaar" and counts as 0.
export const COINS = 'COINS';
export const XII_COINS = 2_000_000;

// one step per amount, all of the same item
const steps = (id, ...amounts) => amounts.map((n) => [[id, n]]);
const TOOL = (id) => [[id, 1]];
const stone = (key) => [[`GENERATOR_UPGRADE_STONE_${key}_12`, 1]];
const PELTS = ['PELT', 75];
// the first six steps of the common pattern: raw items 80, 160, 320, 512, then enchanted 8, 16, 32 ...
const plain = (raw, ench) => [
  [[raw, 80]], ...steps(raw, 160, 320, 512), ...steps(ench, 8, 16, 32, 64, 128, 256, 512),
];
// the farm pattern: raw items 128, 256, 512 (tiers I to III), enchanted 8, 24, 64, 128, 256, 512 (IV to IX)
const farm = (raw, ench) => [...steps(raw, 128, 256, 512), ...steps(ench, 8, 24, 64, 128, 256, 512)];
// the Spider Minion / Zombie Minion that tier N+1 of Tarantula and Revenant is built with, as items
const SLAYER_CHAIN = (string, ench) => [[], [[string, 80]], [[string, 240]], [[string, 560]],
  ...[0, 8, 24, 56, 120, 248, 504].map((n) => [[string, 1072], ...(n ? [[ench, n]] : [])])];
const slayer = (web, silk, string, ench, first) => {
  const own = [[[web, 80], ...first], ...steps(web, 140, 280, 448), ...steps(silk, 7, 14, 28, 56, 112, 224, 448)];
  return own.map((s, i) => [...s, ...(SLAYER_CHAIN(string, ench)[i] ?? [])]);
};

export const COSTS = {
  // tier I comes from gifts and costs nothing (wiki: "upgrade cost 0 Coins")
  snow: [[], ...steps('SNOW_BLOCK', 32, 64, 128, 256, 512), ...steps('ENCHANTED_SNOW_BLOCK', 8, 16, 32, 64, 128),
    [['ENCHANTED_SNOW_BLOCK', 1024], [COINS, XII_COINS], ['NORTH_STAR', 500]]],
  clay: [[['CLAY_BALL', 80], ...TOOL('WOODEN_SHOVEL')], ...plain('CLAY_BALL', 'ENCHANTED_CLAY_BALL').slice(1, 11), stone('CLAY')],
  cobblestone: [[['COBBLESTONE', 80], ...TOOL('WOODEN_PICKAXE')], ...plain('COBBLESTONE', 'ENCHANTED_COBBLESTONE').slice(1, 11),
    [['ENCHANTED_COBBLESTONE', 1024], [COINS, XII_COINS]]],
  coal: [[['COAL', 80], ...TOOL('WOODEN_PICKAXE')], ...steps('COAL', 160, 320, 512), ...steps('ENCHANTED_COAL', 8, 24, 64, 128, 256, 512),
    ...steps('ENCHANTED_COAL_BLOCK', 8), [['ENCHANTED_COAL_BLOCK', 16], [COINS, XII_COINS]]],
  diamond: [[['DIAMOND', 80], ...TOOL('WOODEN_PICKAXE')], ...steps('DIAMOND', 160, 320, 512), ...steps('ENCHANTED_DIAMOND', 8, 24, 64, 128, 256, 512),
    ...steps('ENCHANTED_DIAMOND_BLOCK', 8), [['ENCHANTED_DIAMOND_BLOCK', 16], [COINS, XII_COINS]]],
  lapis: [[['INK_SACK:4', 256], ...TOOL('WOODEN_PICKAXE')], ...steps('INK_SACK:4', 512), ...steps('ENCHANTED_LAPIS_LAZULI', 8, 24, 64, 128, 256, 512),
    ...steps('ENCHANTED_LAPIS_LAZULI_BLOCK', 8, 16, 32), [['ENCHANTED_LAPIS_LAZULI_BLOCK', 64], [COINS, XII_COINS]]],
  redstone: [[['REDSTONE', 128], ...TOOL('WOODEN_PICKAXE')], ...steps('REDSTONE', 256, 512), ...steps('ENCHANTED_REDSTONE', 8, 24, 64, 128, 256, 512),
    ...steps('ENCHANTED_REDSTONE_BLOCK', 8, 16), [['ENCHANTED_REDSTONE_BLOCK', 32], [COINS, XII_COINS]]],
  emerald: [[['EMERALD', 80], ...TOOL('WOODEN_PICKAXE')], ...steps('EMERALD', 160, 320, 512), ...steps('ENCHANTED_EMERALD', 8, 24, 64, 128, 256, 512),
    ...steps('ENCHANTED_EMERALD_BLOCK', 8), [['ENCHANTED_EMERALD_BLOCK', 16], [COINS, XII_COINS]]],
  obsidian: [[['OBSIDIAN', 80], ...TOOL('WOODEN_PICKAXE')], ...plain('OBSIDIAN', 'ENCHANTED_OBSIDIAN').slice(1, 11),
    [['ENCHANTED_OBSIDIAN', 1024], [COINS, XII_COINS]]],
  sugarcane: [[['SUGAR_CANE', 128], ...TOOL('WOODEN_HOE')], ...steps('SUGAR_CANE', 256, 512), ...steps('ENCHANTED_SUGAR', 8, 24, 64, 128, 256, 512),
    ...steps('ENCHANTED_SUGAR_CANE', 8, 16), [['ENCHANTED_SUGAR_CANE', 32], PELTS]],
  // the wiki lists tiers I to XI; every step is 8 stacks of the item ("8x Slimeball (10 each)" is 80)
  slime: [[['SLIME_BALL', 80], ...TOOL('WOODEN_SWORD')], ...steps('SLIME_BALL', 160, 320, 512), ...steps('ENCHANTED_SLIME_BALL', 8, 24, 64, 128, 256, 512),
    ...steps('ENCHANTED_SLIME_BLOCK', 8)],
  tarantula: [...slayer('TARANTULA_WEB', 'TARANTULA_SILK', 'STRING', 'ENCHANTED_STRING', [['ENCHANTED_FERMENTED_SPIDER_EYE', 1]]), stone('TARANTULA')],
  revenant: [...slayer('REVENANT_FLESH', 'REVENANT_VISCERA', 'ROTTEN_FLESH', 'ENCHANTED_ROTTEN_FLESH', TOOL('CRYSTALLIZED_HEART')), stone('REVENANT')],
  wheat: [[['WHEAT', 80], ...TOOL('WOODEN_HOE')], ...plain('WHEAT', 'ENCHANTED_WHEAT').slice(1, 11), [['ENCHANTED_WHEAT', 1024], PELTS]],
  carrot: [[...farm('CARROT_ITEM', 'ENCHANTED_CARROT')[0], ...TOOL('WOODEN_HOE')], ...farm('CARROT_ITEM', 'ENCHANTED_CARROT').slice(1),
    ...steps('ENCHANTED_GOLDEN_CARROT', 8, 16), [['ENCHANTED_GOLDEN_CARROT', 32], PELTS]],
  potato: [[...farm('POTATO_ITEM', 'ENCHANTED_POTATO')[0], ...TOOL('WOODEN_HOE')], ...farm('POTATO_ITEM', 'ENCHANTED_POTATO').slice(1),
    ...steps('ENCHANTED_BAKED_POTATO', 8, 16), [['ENCHANTED_BAKED_POTATO', 32], PELTS]],
  // "Melon Slice" is MELON, the wiki's "Melon" is MELON_BLOCK; the enchanted slice is ENCHANTED_MELON (see minions.js)
  melon: [[['MELON', 256], ...TOOL('WOODEN_HOE')], ...steps('MELON', 512), ...steps('MELON_BLOCK', 128, 256, 512), ...steps('ENCHANTED_MELON', 64, 128, 256, 512),
    ...steps('ENCHANTED_MELON_BLOCK', 8, 16), [['ENCHANTED_MELON_BLOCK', 32], PELTS]],
  pumpkin: [[['PUMPKIN', 80], ...TOOL('WOODEN_HOE')], ...plain('PUMPKIN', 'ENCHANTED_PUMPKIN').slice(1, 11), [['ENCHANTED_PUMPKIN', 1024], PELTS]],
  cactus: [[...farm('CACTUS', 'ENCHANTED_CACTUS_GREEN')[0], ...TOOL('WOODEN_HOE')], ...farm('CACTUS', 'ENCHANTED_CACTUS_GREEN').slice(1),
    ...steps('ENCHANTED_CACTUS', 8, 16), [['ENCHANTED_CACTUS', 32], PELTS]],
  glowstone: [[...farm('GLOWSTONE_DUST', 'ENCHANTED_GLOWSTONE_DUST')[0], ...TOOL('WOODEN_PICKAXE')], ...farm('GLOWSTONE_DUST', 'ENCHANTED_GLOWSTONE_DUST').slice(1),
    ...steps('ENCHANTED_GLOWSTONE', 8, 16), [['ENCHANTED_GLOWSTONE', 32], [COINS, XII_COINS]]],
  fishing: [[['RAW_FISH', 64], ...TOOL('FISHING_ROD')], ...steps('RAW_FISH', 128, 256, 512), ...steps('ENCHANTED_RAW_FISH', 8, 24, 64, 128, 256, 512),
    ...steps('ENCHANTED_COOKED_FISH', 8), stone('FISHING')],
  // Blaze Minion I (tier I) and Inferno Minion VIII (tier XI) written out as items, see docs/minions-sources.md
  inferno: [[['DERELICT_ASHE', 80], ['BLAZE_ROD', 80]], ...steps('DERELICT_ASHE', 320), ...steps('MOLTEN_POWDER', 8, 16, 32, 64, 128, 256),
    [['MOLTEN_POWDER', 256], ['INFERNO_VERTEX', 16]], [['MOLTEN_POWDER', 256], ['INFERNO_VERTEX', 48]],
    [['MOLTEN_POWDER', 760], ['INFERNO_VERTEX', 48], ['INFERNO_APEX', 1], ['DERELICT_ASHE', 400], ['BLAZE_ROD', 80]]],
};

// Everything up to and including `tier`: { id: amount }.
export function costUpTo(key, tier) {
  const total = {};
  for (const step of (COSTS[key] ?? []).slice(0, tier)) for (const [id, n] of step) total[id] = (total[id] ?? 0) + n;
  return total;
}

// What a guide step adds to the mining stats, read on hypixelskyblock.minecraft.wiki on 2026-11-01. Columns of a rarity table:
// Common, Uncommon, Rare, Epic, Legendary, Mythic, Divine. A value only NEU knows would carry src: 'not confirmed'; there is none yet.
export const RARITIES = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC', 'DIVINE'];

// wiki Enchantments. Prismatic has the id pristine.
export const ENCHANTS = {
  efficiency: { stats: { MINING_SPEED: [30, 50, 70, 90, 110, 130, 150, 170, 190, 210] } },
  fortune: { stats: { MINING_FORTUNE: [10, 20, 30, 45] } },
  pristine: { stats: { PRISTINE: [0.5, 1, 1.5, 2, 2.5] } },
  lapidary: { gemstonesOnly: true, stats: { GEMSTONE_FORTUNE: [10, 20, 30, 40, 50], MINING_SPEED: [20, 40, 60, 80, 100] } },
};
// wiki Enchantments: these give none of our stats. Flowstate is left out on purpose, its speed depends on the mining streak.
export const ENCHANTS_NO_STAT = new Set(['experience', 'compact', 'smelting_touch', 'paleontologist']);

// wiki Gemstone
export const GEM_STAT = { AMBER: 'MINING_SPEED', JADE: 'MINING_FORTUNE', TOPAZ: 'PRISTINE' };
export const GEMS = {
  AMBER: {
    ROUGH: [4, 8, 12, 16, 20, 24, 28], FLAWED: [6, 10, 14, 18, 24, 30, 36], FINE: [10, 14, 20, 28, 36, 45, 54],
    FLAWLESS: [14, 20, 30, 44, 58, 75, 92], PERFECT: [20, 28, 40, 60, 80, 100, 120],
  },
  JADE: {
    ROUGH: [2, 4, 6, 8, 10, 12, 14], FLAWED: [3, 5, 7, 10, 14, 18, 22], FINE: [5, 7, 10, 15, 20, 25, 30],
    FLAWLESS: [7, 10, 15, 20, 27, 35, 44], PERFECT: [10, 14, 20, 30, 40, 50, 60],
  },
  TOPAZ: {
    ROUGH: [0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.5], FLAWED: [0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.9], FINE: [1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.3],
    FLAWLESS: [1.6, 1.6, 1.6, 1.6, 1.6, 1.6, 1.8], PERFECT: [2, 2, 2, 2, 2, 2, 2.2],
  },
};

// wiki Reforging/Armor, Reforging/Mining Tool, Blazing Reforge. Only the stats of ours; effects that need a condition stay out.
const FORTUNE_LOW = [3, 6, 9, 13, 16, 20, 25];
const SPEED_LOW = [5, 10, 15, 25, 40, 55, 70];
const SPEED_MID = [10, 20, 30, 40, 50, 75, 100];
export const REFORGES = {
  jaded: { MINING_SPEED: [5, 12, 20, 30, 45, 60, 75], MINING_FORTUNE: [5, 10, 15, 20, 25, 30, 35] },
  dimensional: { MINING_SPEED: [10, 15, 20, 30, 40, 50, 60] },
  blazing: { MINING_FORTUNE: [3, 4, 5, 6, 7, 8, 9] },
  unyielding: { MINING_FORTUNE: [1, 2, 3, 4, 5, 6, 7] },
  excellent: { MINING_SPEED: [4, 8, 12, 16, 20, 25, 30] },
  sturdy: { MINING_SPEED: [3, 6, 9, 12, 15, 20, 25] },
  fortunate: { MINING_SPEED: [1, 2, 3, 4, 6, 8, 10], MINING_FORTUNE: [1, 1, 1, 2, 2, 3, 4] },
  ambered: { MINING_SPEED: [25, 35, 50, 75, 100, 150, 200] },
  auspicious: { MINING_FORTUNE: FORTUNE_LOW, MINING_SPEED: SPEED_MID },
  fleet: { BLOCK_FORTUNE: [25, 30, 35, 45, 55, 65, 75], MINING_SPEED: SPEED_MID },
  fruitful: { MINING_FORTUNE: [2, 4, 6, 8, 10, 12, 15], MINING_SPEED: SPEED_LOW },
  glacial: { MINING_FORTUNE: FORTUNE_LOW },
  heated: { MINING_FORTUNE: FORTUNE_LOW, MINING_SPEED: SPEED_LOW },
  lustrous: { MINING_SPEED: [10, 20, 30, 40, 50, 60, 75], MINING_FORTUNE: [10, 20, 30, 40, 50, 60, 75] },
  magnetic: { MINING_SPEED: SPEED_MID },
  mithraic: { MINING_FORTUNE: FORTUNE_LOW },
  stellar: { MINING_FORTUNE: [5, 10, 15, 20, 25, 35, 50], MINING_SPEED: SPEED_LOW },
};
// wiki Reforging/Armor and Mining Tool: no mining stat of ours. A reforge in neither list is unknown, so a step replacing it has no value.
export const REFORGES_NO_STAT = new Set(['clean', 'fierce', 'heavy', 'light', 'mythic', 'pure', 'smart', 'titanic', 'wise', 'perfect', 'necrotic', 'ancient', 'spiked', 'renowned', 'cubic', 'hyper', 'reinforced', 'loving', 'ridiculous', 'empowered', 'giant', 'undead', 'submerged', 'mossy', 'mantid', 'festive', 'groovy', 'geometric', 'calcified', 'sunny', 'candied', 'greater_spook', 'bustling', 'refined', 'scraped']);

// wiki, the page of each part. Fuel tanks give capacity and cooldown only. Blue Cheese: +1 level on all unlocked HOTM perks while held.
export const PARTS = {
  MITHRIL_DRILL_ENGINE: { kind: 'engine', stats: { MINING_SPEED: 75, MINING_FORTUNE: 5 } },
  TITANIUM_DRILL_ENGINE: { kind: 'engine', stats: { MINING_SPEED: 150, MINING_FORTUNE: 15 } },
  RUBY_POLISHED_DRILL_ENGINE: { kind: 'engine', stats: { MINING_SPEED: 250, MINING_FORTUNE: 30 } },
  SAPPHIRE_POLISHED_DRILL_ENGINE: { kind: 'engine', stats: { MINING_SPEED: 400, MINING_FORTUNE: 50 } },
  AMBER_POLISHED_DRILL_ENGINE: { kind: 'engine', stats: { MINING_SPEED: 600, MINING_FORTUNE: 100 } },
  MITHRIL_FUEL_TANK: { kind: 'fuel_tank', stats: {} },
  TITANIUM_FUEL_TANK: { kind: 'fuel_tank', stats: {} },
  GEMSTONE_FUEL_TANK: { kind: 'fuel_tank', stats: {} },
  PERFECTLY_CUT_FUEL_TANK: { kind: 'fuel_tank', stats: {} },
  GOBLIN_OMELETTE_SUNNY_SIDE: { kind: 'upgrade_module', stats: { MINING_FORTUNE: 50 } },
  GOBLIN_OMELETTE_BLUE_CHEESE: { kind: 'upgrade_module', hotmLevels: 1 },
};

// wiki Polarvoid Book: +10 Mining Speed per book up to 5, and +5 Mining Fortune once one is on. The wiki does not say the fortune stacks.
export const POLARVOID = { speed: 10, fortune: 5, max: 5 };
// wiki Powder Coating
export const COATING = { drill: { MINING_SPEED: 500 }, other: { MINING_FORTUNE: 10 } };

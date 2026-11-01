// What a guide step adds to the mining stats, read on hypixelskyblock.minecraft.wiki on 2026-11-01. Columns of a rarity table:
// Common, Uncommon, Rare, Epic, Legendary, Mythic, Divine. A value only NEU knows would carry src: 'not confirmed'; there is none yet.
export const RARITIES = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC', 'DIVINE'];

// wiki Enchantments. Prismatic has the id pristine.
export const ENCHANTS = {
  efficiency: { stats: { MINING_SPEED: [30, 50, 70, 90, 110, 130, 150, 170, 190, 210] } },
  fortune: { stats: { MINING_FORTUNE: [10, 20, 30, 45] } },
  pristine: { stats: { PRISTINE: [0.5, 1, 1.5, 2, 2.5] } },
  critical: { stats: { CRITICAL_DAMAGE: [10, 20, 30, 40, 50, 70, 100] } },
  growth: { stats: { HEALTH: [15, 30, 45, 60, 75, 90, 105] } },
  protection: { stats: { DEFENSE: [4, 8, 12, 16, 20, 25, 30] } },
  prosperity: { stats: { HEALTH: [3, 6, 9, 12, 15] } },
  // wiki True Protection: chestplates only
  true_protection: { only: 'CHESTPLATE', stats: { TRUE_DEFENSE: [5] } },
  lapidary: { gemstonesOnly: true, stats: { GEMSTONE_FORTUNE: [10, 20, 30, 40, 50], MINING_SPEED: [20, 40, 60, 80, 100] } },
};
// wiki Enchantments: these give none of our stats. Flowstate is left out on purpose, its speed depends on the mining streak.
export const ENCHANTS_NO_STAT = new Set(['experience', 'compact', 'smelting_touch', 'paleontologist', 'looting', 'vampirism', 'life_steal', 'rejuvenate', 'transylvanian', 'quantum']);

// wiki Gemstone
export const GEM_STAT = { AMBER: 'MINING_SPEED', JADE: 'MINING_FORTUNE', TOPAZ: 'PRISTINE', OPAL: 'TRUE_DEFENSE' };
// wiki Gemstone Slot: the shared slots a type fits next to its own
export const GEM_SHARED_SLOTS = { AMBER: ['MINING', 'UNIVERSAL'], JADE: ['MINING', 'UNIVERSAL'], TOPAZ: ['MINING', 'UNIVERSAL'], OPAL: ['COMBAT', 'DEFENSIVE', 'UNIVERSAL'] };
export const GEMS = {
  AMBER: {
    ROUGH: [4, 8, 12, 16, 20, 24, 28], FLAWED: [6, 10, 14, 18, 24, 30, 36], FINE: [10, 14, 20, 28, 36, 45, 54],
    FLAWLESS: [14, 20, 30, 44, 58, 75, 92], PERFECT: [20, 28, 40, 60, 80, 100, 120],
  },
  JADE: {
    ROUGH: [2, 4, 6, 8, 10, 12, 14], FLAWED: [3, 5, 7, 10, 14, 18, 22], FINE: [5, 7, 10, 15, 20, 25, 30],
    FLAWLESS: [7, 10, 15, 20, 27, 35, 44], PERFECT: [10, 14, 20, 30, 40, 50, 60],
  },
  // no Divine column on the wiki
  OPAL: {
    ROUGH: [1, 1, 1, 2, 2, 3], FLAWED: [2, 2, 2, 3, 3, 4], FINE: [3, 3, 3, 4, 4, 5],
    FLAWLESS: [4, 4, 5, 6, 8, 9], PERFECT: [5, 6, 7, 9, 11, 13],
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
  // wiki Reforging/Sword. Conditions stay out; the Coldfused bonus with a Wisp is below.
  fabled: { STRENGTH: [30, 35, 40, 50, 60, 75, 90], CRITICAL_DAMAGE: [15, 20, 25, 32, 40, 50, 65] },
  withered: { STRENGTH: [60, 75, 90, 110, 135, 170, 220] },
  coldfused: { STRENGTH: [15, 20, 25, 35, 45, 55, 65], CRITICAL_DAMAGE: [20, 30, 40, 50, 60, 70, 90] },
  // wiki Reforging/Armor
  ancient: { STRENGTH: [4, 8, 12, 18, 25, 35, 50], CRITICAL_CHANCE: [3, 5, 7, 9, 12, 15, 20], HEALTH: [7, 7, 7, 7, 7, 7, 7], DEFENSE: [7, 7, 7, 7, 7, 7, 7] },
  fierce: { STRENGTH: [2, 4, 6, 8, 10, 12, 14], CRITICAL_CHANCE: [2, 3, 4, 5, 6, 8, 10], CRITICAL_DAMAGE: [4, 7, 10, 14, 18, 24, 30] },
  renowned: { STRENGTH: [3, 4, 6, 8, 10, 12, 15], CRITICAL_CHANCE: [2, 4, 6, 8, 10, 12, 15], CRITICAL_DAMAGE: [3, 4, 6, 8, 10, 12, 15], ATTACK_SPEED: [1, 1, 2, 3, 4, 5, 6], HEALTH: [2, 3, 4, 6, 8, 10, 12], DEFENSE: [2, 3, 4, 6, 8, 10, 12] },
  titanic: { HEALTH: [10, 15, 20, 25, 35, 50, 65], DEFENSE: [10, 15, 20, 25, 35, 50, 65] },
  mythic: { STRENGTH: [2, 4, 6, 8, 10, 12, 14], CRITICAL_CHANCE: [1, 2, 3, 4, 5, 6, 7], DEFENSE: [2, 4, 6, 8, 10, 12, 14], HEALTH: [2, 4, 6, 8, 10, 12, 14] },
  // wiki Reforging/Equipment
  strengthened: { STRENGTH: [2, 3, 4, 5, 6, 7, 8], DEFENSE: [3, 4, 5, 6, 8, 10, 12] },
  glistening: { TRUE_DEFENSE: [2, 2.5, 3, 3.5, 4, 4.5, 5] },
  blood_soaked: { HEALTH: [6, 8, 8, 9, 10, 12, 14], DEFENSE: [1, 2, 3, 4, 5, 6, 7] },
  bloodshot: { STRENGTH: [1, 2, 3, 4, 5, 6, 7], CRITICAL_CHANCE: [1, 2, 3, 4, 5, 6, 7], CRITICAL_DAMAGE: [1, 2, 3, 4, 5, 6, 7] },
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
REFORGES['blood-soaked'] = REFORGES.blood_soaked;
REFORGES.bloodsoaked = REFORGES.blood_soaked;
// wiki Reforging/Sword: "+75 Strength +55 Crit Damage" while a Wisp is active
export const COLDFUSED_WISP = { STRENGTH: 75, CRITICAL_DAMAGE: 55 };
// wiki Accessory Power, per rarity. Hegemony counts double. Rift Prism and the Abicases follow their own rules.
export const ACCESSORY_POWER = { COMMON: 3, UNCOMMON: 5, RARE: 8, EPIC: 12, LEGENDARY: 16, MYTHIC: 22, DIVINE: 28, SPECIAL: 3, VERY_SPECIAL: 5 };
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

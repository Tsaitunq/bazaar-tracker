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
// Enchants whose stat builds up while mining and /stats shows only the active stacks: never added to the gear, listed under the conditions. text(level) is the sentence.
export const ENCHANTS_CONDITIONAL = {
  ultimate_flowstate: { name: 'Flowstate', text: (level) => `+${level} Mining Speed per block mined in a row, up to 200 blocks (${200 * level} at full stacks)` },
};
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
  coldfused: { STRENGTH: [15, 20, 25, 35, 45, 55, 65], CRITICAL_DAMAGE: [20, 30, 40, 50, 60, 70, 90], MAGIC_FIND: [2, 2, 2, 2, 2, 2, 2] },
  // wiki Reforging/Armor
  ancient: { STRENGTH: [4, 8, 12, 18, 25, 35, 50], CRITICAL_CHANCE: [3, 5, 7, 9, 12, 15, 20], HEALTH: [7, 7, 7, 7, 7, 7, 7], DEFENSE: [7, 7, 7, 7, 7, 7, 7], INTELLIGENCE: [6, 9, 12, 16, 20, 25, 30] },
  fierce: { STRENGTH: [2, 4, 6, 8, 10, 12, 14], CRITICAL_CHANCE: [2, 3, 4, 5, 6, 8, 10], CRITICAL_DAMAGE: [4, 7, 10, 14, 18, 24, 30] },
  renowned: { STRENGTH: [3, 4, 6, 8, 10, 12, 15], CRITICAL_CHANCE: [2, 4, 6, 8, 10, 12, 15], CRITICAL_DAMAGE: [3, 4, 6, 8, 10, 12, 15], ATTACK_SPEED: [1, 1, 2, 3, 4, 5, 6], HEALTH: [2, 3, 4, 6, 8, 10, 12], DEFENSE: [2, 3, 4, 6, 8, 10, 12] },
  titanic: { HEALTH: [10, 15, 20, 25, 35, 50, 65], DEFENSE: [10, 15, 20, 25, 35, 50, 65] },
  mythic: { STRENGTH: [2, 4, 6, 8, 10, 12, 14], CRITICAL_CHANCE: [1, 2, 3, 4, 5, 6, 7], DEFENSE: [2, 4, 6, 8, 10, 12, 14], HEALTH: [2, 4, 6, 8, 10, 12, 14] },
  // wiki Reforging/Equipment
  strengthened: { STRENGTH: [2, 3, 4, 5, 6, 7, 8], DEFENSE: [3, 4, 5, 6, 8, 10, 12] },
  glistening: { TRUE_DEFENSE: [2, 2.5, 3, 3.5, 4, 4.5, 5], INTELLIGENCE: [5, 6, 8, 10, 12, 15, 18] },
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

// ---- Blaze gear (wiki 2026-11-05, NEU constants/reforgestones.json for the targets)

// Where a reforge can go: NEU itemTypes. ids = only these items; category = item categories (EQUIPMENT is the four equipment slots).
const EQUIPMENT_SLOTS = ['NECKLACE', 'CLOAK', 'BELT', 'GLOVES'];
export const REFORGE_TARGETS = {
  fabled: { category: ['SWORD'] }, withered: { category: ['SWORD'] },
  coldfused: { ids: ['BURSTFIRE_DAGGER', 'BURSTMAW_DAGGER', 'FIREDUST_DAGGER', 'HEARTFIRE_DAGGER', 'HEARTMAW_DAGGER', 'MAWDUST_DAGGER'] },
  ancient: { category: ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'] },
  strengthened: { category: EQUIPMENT_SLOTS }, glistening: { category: EQUIPMENT_SLOTS },
  bloodshot: { category: ['BELT'] }, blood_soaked: { category: ['CLOAK'] },
};
// Withered +1 Strength and Ancient +1 Crit Damage per Catacombs level (wiki, not limited to dungeons: not confirmed)
export const CATACOMBS_REFORGE = { withered: { STRENGTH: 1 }, ancient: { CRITICAL_DAMAGE: 1 } };

// NEU Hot Potato Book / Fuming Potato Book: armor and weapons, 10 books, Fuming up to 15 in all
export const HPB = { armor: { DEFENSE: 2, HEALTH: 4 }, weapon: { STRENGTH: 2, DAMAGE: 2 }, max: 10, fumingMax: 5 };
// Gear options of a build: Catacombs level (null = unknown), Crimson stars, all pieces with 10 Hot Potato Books, Fuming books
export const DEFAULT_GEAR = { catacombs: null, stars: 0, hpb: true, fuming: 0 };
// wiki Essence: +2 % stat per star on items that are not Dungeon items; the star count is one number for the whole Crimson set
export const CRIMSON_STAR = { percent: 2, max: 10 };
export const CRIMSON_TIERS = ['CRIMSON', 'HOT_CRIMSON', 'BURNING_CRIMSON', 'FIERY_CRIMSON', 'INFERNAL_CRIMSON'];
// wiki Crimson Armor, Dominus at 10 stacks: Swing Range 0.05 (Crimson) or 0.1 per stack, Ferocity 1 (Burning) or 2 (Fiery, Infernal) per stack
export const DOMINUS = {
  CRIMSON: { SWING_RANGE: 0.5 }, HOT_CRIMSON: { SWING_RANGE: 1 },
  BURNING_CRIMSON: { SWING_RANGE: 1, FEROCITY: 10 }, FIERY_CRIMSON: { SWING_RANGE: 1, FEROCITY: 20 }, INFERNAL_CRIMSON: { SWING_RANGE: 1, FEROCITY: 20 },
};
export const BLAZE_ARMOR = ['BLAZE_HELMET', 'BLAZE_CHESTPLATE', 'BLAZE_LEGGINGS', 'BLAZE_BOOTS', 'FROZEN_BLAZE_HELMET', 'FROZEN_BLAZE_CHESTPLATE', 'FROZEN_BLAZE_LEGGINGS', 'FROZEN_BLAZE_BOOTS'];

// What the Blaze enchants do beyond the tables above. kind: damage (a multiplier under a condition), stat (a stat under a condition),
// none (no permanent stat). values: per level, text(v) the sentence. Only listed, never added, except where the tables or blaze.js count it.
const pct = (what) => (v) => `${v} % ${what}`;
export const ENCHANT_EFFECTS = {
  pyroclasm: { kind: 'damage', values: [10, 20, 30, 40, 60, 80], text: pct('damage against Magmatic mobs'), cond: 'Magmatic mobs' },
  execute: { kind: 'damage', values: [0.2, 0.4, 0.6, 0.8, 1, 1.25], text: pct('damage per 1 % missing health of the target'), cond: 'missing health' },
  fire_aspect: { kind: 'damage', values: [3, 6, 9], text: pct('of your damage per second as fire'), cond: 'fire' },
  giant_killer: { kind: 'damage', values: [0.1, 0.2, 0.3, 0.4, 0.6, 0.9, 1.2], text: pct('damage per 1 % more health than you'), cond: 'target health above yours' },
  gravity: { kind: 'damage', values: [5, 10, 15, 20, 30, 40], text: pct('damage against Airborne mobs'), cond: 'Airborne mobs' },
  lethality: { kind: 'damage', values: [1.2, 2.4, 3.6, 4.8, 6, 9], text: pct('Defense of the target per hit (4 s, 4 stacks)'), cond: 'melee hits' },
  smite: { kind: 'damage', values: [5, 10, 15, 20, 30, 40, 50], text: pct('damage against Skeletal, Wither and Undead mobs'), cond: 'Skeletal, Wither, Undead mobs' },
  thunderlord: { kind: 'damage', values: [8, 16, 24, 32, 40, 50, 60], text: pct('of the hit as lightning on every third hit'), cond: 'every third hit' },
  triple_strike: { kind: 'damage', values: [10, 20, 30, 40, 50], text: pct('damage on the first three hits on a mob'), cond: 'first three hits' },
  cayenne: { kind: 'stat', values: [null, null, null, '0.8 Health and 0.4 True Defense', '1 Health and 0.5 True Defense'], text: (v) => `${v} per digit of Accessory Power`, cond: 'Accessory Power digits' },
  strong_vitality: { kind: 'none', note: 'turns Vitality into Strength; Vitality is not a Blaze stat' },
  ultimate_swarm: { kind: 'damage', values: [2, 4, 6, 8, 10], text: pct('damage per enemy within 10 blocks (up to 10)'), cond: 'enemies nearby' },
  ultimate_last_stand: { kind: 'damage', values: [5, 10, 15, 20, 25], text: pct('Defense below 40 % health (30 s cooldown)'), cond: 'below 40 % health' },
  ultimate_refrigerate: { kind: 'stat', values: [3, 3.75, 4.5, 5.25, 6], text: pct('of the mana used as Defense for 10 s (up to 150 per piece)'), cond: 'mana used' },
  ultimate_habanero_tactics: { kind: 'damage', values: [null, null, null, 20, 25], text: pct('damage with Slayer weapons'), cond: 'Slayer weapons' },
  // Chimera copies this share of the active pet's stats; it is counted on the weapon (guide/pieces.js)
  ultimate_chimera: { kind: 'pet', values: [20, 40, 60, 80, 100], text: pct('of the active pet stats') },
  life_steal: { kind: 'none' }, looting: { kind: 'none' }, vampirism: { kind: 'none' }, rejuvenate: { kind: 'none', note: 'Health Regen is not a Blaze stat' },
  transylvanian: { kind: 'none' }, quantum: { kind: 'none' },
};
export const enchantLine = (name, level) => {
  const e = ENCHANT_EFFECTS[name];
  const v = e?.values?.[level - 1];
  return e && v !== undefined && v !== null ? `${name.replace(/_/g, ' ')} ${level}: ${e.text(v)}` : null;
};

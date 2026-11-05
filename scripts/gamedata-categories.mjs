// The /stats menu category of every stat (confirmed in game). Wisdoms are their own category and not part of Nether Embodiment.
export const CATEGORIES = new Set(['combat', 'misc', 'wisdom', 'mining', 'farming', 'foraging', 'fishing', 'hunting']);
const COMBAT = ['HEALTH', 'DEFENSE', 'TRUE_DEFENSE', 'STRENGTH', 'CRITICAL_CHANCE', 'CRITICAL_DAMAGE', 'ATTACK_SPEED', 'FEROCITY', 'SWING_RANGE', 'INTELLIGENCE', 'ABILITY_DAMAGE', 'HEALTH_REGEN', 'VITALITY', 'MENDING', 'DAMAGE'];
const MISC = ['SPEED', 'MAGIC_FIND', 'PET_LUCK', 'HEAT_RESISTANCE', 'COLD_RESISTANCE', 'RESPIRATION', 'PRESSURE_RESISTANCE', 'FEAR'];
const FISHING = ['FISHING_SPEED', 'SEA_CREATURE_CHANCE', 'TREASURE_CHANCE'];
const MINING = ['MINING_FORTUNE', 'MINING_SPEED', 'MINING_SPREAD', 'GEMSTONE_SPREAD', 'PRISTINE', 'GEMSTONE_FORTUNE', 'ORE_FORTUNE', 'BLOCK_FORTUNE', 'DWARVEN_METAL_FORTUNE', 'BREAKING_POWER'];

// id: stat id. Crop fortunes, Bonus Pest Chance and Overbloom are farming; every *_WISDOM is wisdom.
export function categoryOf(id) {
  if (/_WISDOM$/.test(id)) return 'wisdom';
  if (COMBAT.includes(id)) return 'combat';
  if (MISC.includes(id)) return 'misc';
  if (FISHING.includes(id)) return 'fishing';
  if (MINING.includes(id)) return 'mining';
  if (id === 'TRACKING') return 'hunting';
  if (id === 'FORAGING_FORTUNE') return 'foraging';
  return 'farming';
}

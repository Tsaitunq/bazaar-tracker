// Parts of gamedata/stat-sources.json that are typed in, not read from a page: the stats every player starts with and what an accessory reforge gives.
const given = (value) => ({ value, src: ['/stats in the game, given by the player (Swing Range 3 matches the player\'s /stats)'], confidence: 'unsafe', note: 'one source, not on a wiki page checked' });
const twice = (value) => ({ value, src: ['wiki Stats', 'apps/guide/stats.js BASE'], confidence: 'safe' });

export const BASE_STATS = {
  HEALTH: twice(100), CRITICAL_CHANCE: twice(30), CRITICAL_DAMAGE: twice(50),
  SPEED: given(100), SEA_CREATURE_CHANCE: given(20), HEALTH_REGEN: given(100), VITALITY: given(100), MENDING: given(100), SWING_RANGE: given(3),
};

// NEU constants/reforges.json (50) and reforgestones.json (86) hold no accessory reforge: the stones that name "EQUIPMENT" are for necklace, cloak, belt and gloves
// worn as equipment. The wiki says accessory reforges were removed and replaced by Thaumaturgy (the power stone, already part of the build).
export const ACCESSORY_REFORGES = {
  stats: 'none',
  src: ['wiki Reforging/Accessory (removal notice)'],
  confidence: 'unsafe',
  note: 'one source; NEU has no accessory reforge either. A reforge name on a bag accessory is read as no stat.',
};

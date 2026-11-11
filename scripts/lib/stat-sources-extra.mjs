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

// Values the player confirmed in the game (/stats and the menus). A second source: the series turns safe. date: when it was checked.
// path: where the value sits in stat-sources.json.
export const GAME_CONFIRMED = [
  { path: ['skills', 'mining', 'stats', 'MINING_FORTUNE'], text: 'Mining 39 gives 156 Mining Fortune (4 per level)' },
  { path: ['skyblockLevel', 'perLevel', 'HEALTH'], text: 'SkyBlock level 280 gives 1,400 Health (5 per level)' },
  { path: ['skyblockLevel', 'perFiveLevels', 'STRENGTH'], text: 'SkyBlock level 280 gives 56 Strength (1 per 5 levels)' },
  { path: ['collections'], text: 'collections give 9 Mining Fortune (Glacite 4, Umber 2, Tungsten 2, Obsidian 1)' },
  { path: ['bestiary', 'perMilestone', 'HEALTH'], text: 'the Bestiary milestones give 179 Health at 179 claimed (1 each)' },
  { path: ['consumables', 5], text: 'Ore Oats, 5 uses, give 10 Mining Fortune' },
];

export function confirmByGame(data, list = GAME_CONFIRMED) {
  for (const { path, text } of list) {
    const node = path.reduce((o, k) => o?.[k], data);
    if (!node) throw new Error(`confirmByGame: ${path.join('.')} not found`);
    if (!node.src.some((s) => s.startsWith('game: '))) node.src.push(`game: ${text}`);
    node.confidence = 'safe';
    delete node.note;
  }
  return data;
}

const wiki = (page, note = 'one source') => ({ src: [`wiki ${page}`], confidence: 'unsafe', note });

// wiki Mining Fortune: +1 Mining Fortune at each of these collection tiers. The player's /stats confirms the sum (see GAME_CONFIRMED).
export const COLLECTIONS = {
  rewards: [
    { collection: 'GLACITE', tiers: [1, 6, 7, 8], stat: 'MINING_FORTUNE', value: 1 },
    { collection: 'TUNGSTEN', tiers: [1, 5, 7, 8, 9], stat: 'MINING_FORTUNE', value: 1 },
    { collection: 'UMBER', tiers: [1, 5, 7, 8], stat: 'MINING_FORTUNE', value: 1 },
    { collection: 'OBSIDIAN', tiers: [5, 7, 8, 10], stat: 'MINING_FORTUNE', value: 1 },
  ],
  ...wiki('Mining Fortune', 'one source; only the Mining Fortune rewards are listed, other collections give stats the app does not track yet'),
};

// wiki Bestiary (Milestone Rewards): each family milestone gives +1 Health. The profile gives the claimed milestone count.
export const BESTIARY = { perMilestone: { HEALTH: { value: 1, ...wiki('Bestiary (Milestone Rewards)') } } };

// wiki Consumables (Permanent): per use, up to max uses. Not in the API: the player ticks the uses in the build.
// Ore Oats are listed as Ore Fortune on the wiki; /stats shows them under Mining Fortune, so the app counts them there.
const use = (id, name, stat, value, max = 5, note = null) => ({ id, name, stat, value, max, ...wiki('Consumables (Permanent)', note ?? 'one source') });
export const CONSUMABLES = [
  use('reaper_pepper', 'Reaper Pepper', 'HEALTH', 1),
  use('vial_of_venom', 'Vial of Venom', 'CRITICAL_DAMAGE', 1),
  use('festering_maggot', 'Festering Maggot', 'DEFENSE', 1),
  use('refined_bottle_of_jyrre', 'Refined Bottle of Jyrre', 'INTELLIGENCE', 1),
  use('spotlite', 'Spotlite', 'HEALTH', 5),
  use('ore_oats', "Dwarven O's Ore Oats", 'MINING_FORTUNE', 2, 5, 'one source; the wiki says Ore Fortune, /stats shows it as Mining Fortune'),
  use('gemstone_grahams', "Dwarven O's Gemstone Grahams", 'GEMSTONE_FORTUNE', 2),
  use('filled_rosewater_flask', 'Filled Rosewater Flask', 'FARMING_FORTUNE', 1),
  use('brain_food', 'Brain Food', 'TRACKING', 1),
  use('wriggling_larva', 'Wriggling Larva', 'BONUS_PEST_CHANCE', 2),
];

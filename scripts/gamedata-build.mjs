// Builds gamedata/*.json. Usage: node scripts/gamedata-build.mjs <NEU-REPO>/constants [outDir=gamedata]
// Clone the NEU repo first: git clone --depth 1 https://github.com/NotEnoughUpdates/NotEnoughUpdates-REPO
//
// Sources (hypixelskyblock.minecraft.wiki unless noted; wiki values were checked on 2026-11-04):
//   stats.json      Wiki "Stats" (names, areas). Icons and colours: guide/model.js, docs/design-guide-app.md. No icon = unknown.
//   hotm.json       Wiki "Heart of the Mountain" perk table (stat formulas, cost exponents, powder, Core of the Mountain table; read from
//                   wiki screenshots 2026-11-04), ability table, tier XP. NEU constants/hotmlayout.json only for grid x/y and max level.
//                   Positions, max levels and per-level values checked against the in-game HOTM menu (2026-11-04). Neighbours are derived
//                   from the grid (orthogonal, occupied fields only).
//   attributes.json NEU constants/attribute_shards.json (shard, rarity, level table); effects: Wiki "Attribute Shards" list;
//                   Rotten Pickaxe, Freezing Spread, Pickaxe Cooldown checked on the in-game tooltip (2026-11-04).
//   power.json      Wiki "Power Stones"/"Powers" (stats at 250 AP, unique bonus), "Accessory Power" (multiplier, AP per rarity),
//                   "Maxwell" (tuning points, templates), "Booster Cookie", "God Potion".
// Anything the sources do not settle carries unknown:true; never fill it with a guess.
import fs from 'node:fs';
import { categoryOf } from './gamedata-categories.mjs';
const NEU = process.argv[2];
const OUT = process.argv[3];
const read = (f) => JSON.parse(fs.readFileSync(`${NEU}/${f}`, 'utf8'));
const write = (f, o) => fs.writeFileSync(`${OUT}/${f}`, JSON.stringify(o, null, 1) + '\n');

// ---------- stats ----------
const C = { orange: '#FFAA00', pink: '#D255D2', red: '#FF5555', blue: '#8C96FF', yellow: '#FFFF55', green: '#55FF55', white: '#FFFFFF', cyan: '#55FFFF' };
// [id, name, areas, icon, colour, percent]; icon/colour from guide/model.js + docs/design-guide-app.md (repo), else null = unknown.
const S = [
  ['MINING_FORTUNE', 'Mining Fortune', ['mining'], '☘', C.orange],
  ['MINING_SPEED', 'Mining Speed', ['mining'], '⸕', C.orange],
  ['MINING_SPREAD', 'Mining Spread', ['mining']],
  ['GEMSTONE_SPREAD', 'Gemstone Spread', ['mining'], '☘', C.orange],
  ['PRISTINE', 'Pristine', ['mining'], '✧', C.pink],
  ['GEMSTONE_FORTUNE', 'Gemstone Fortune', ['mining'], '☘', C.orange],
  ['ORE_FORTUNE', 'Ore Fortune', ['mining'], '☘', C.orange],
  ['BLOCK_FORTUNE', 'Block Fortune', ['mining'], '☘', C.orange],
  ['DWARVEN_METAL_FORTUNE', 'Dwarven Metal Fortune', ['mining']],
  ['BREAKING_POWER', 'Breaking Power', ['mining']],
  ['COLD_RESISTANCE', 'Cold Resistance', ['mining'], '❄', C.cyan],
  ['HEAT_RESISTANCE', 'Heat Resistance', ['mining']],
  ['MINING_WISDOM', 'Mining Wisdom', ['mining'], '☯', C.cyan],
  ['STRENGTH', 'Strength', ['combat'], '❁', C.red],
  ['CRITICAL_DAMAGE', 'Crit Damage', ['combat'], '☠', C.blue, true],
  ['CRITICAL_CHANCE', 'Crit Chance', ['combat'], '☣', C.blue, true],
  ['ATTACK_SPEED', 'Attack Speed', ['combat'], '⚔', C.yellow, true],
  ['HEALTH', 'Health', ['combat'], '❤', C.red],
  ['DEFENSE', 'Defense', ['combat'], '❈', C.green],
  ['TRUE_DEFENSE', 'True Defense', ['combat'], '❂', C.white],
  ['DAMAGE', 'Damage', ['combat'], '❁', C.red],
  ['INTELLIGENCE', 'Intelligence', ['combat']],
  ['FEROCITY', 'Ferocity', ['combat']],
  ['ABILITY_DAMAGE', 'Ability Damage', ['combat']],
  ['HEALTH_REGEN', 'Health Regen', ['combat']],
  ['VITALITY', 'Vitality', ['combat']],
  ['MENDING', 'Mending', ['combat']],
  ['SWING_RANGE', 'Swing Range', ['combat']],
  ['COMBAT_WISDOM', 'Combat Wisdom', ['combat'], '☯', C.cyan],
  ['FARMING_FORTUNE', 'Farming Fortune', ['farming'], '☘', C.orange],
  ['BONUS_PEST_CHANCE', 'Bonus Pest Chance', ['farming']],
  ['OVERBLOOM', 'Overbloom', ['farming']],
  ['FARMING_WISDOM', 'Farming Wisdom', ['farming'], '☯', C.cyan],
  ...['Wheat', 'Carrot', 'Potato', 'Pumpkin', 'Sugar Cane', 'Melon Slice', 'Cactus', 'Cocoa Beans', 'Mushroom', 'Nether Wart', 'Sunflower', 'Moonflower', 'Wild Rose'].map((c) => [`${c.toUpperCase().replace(/ /g, '_')}_FORTUNE`, `${c} Fortune`, ['farming']]),
  ['SPEED', 'Speed', ['general']],
  ['MAGIC_FIND', 'Magic Find', ['general']],
  ['PET_LUCK', 'Pet Luck', ['general']],
  ['FEAR', 'Fear', ['general']],
  ['TRACKING', 'Tracking', ['general']],
  ['TREASURE_CHANCE', 'Treasure Chance', ['general']],
  ['FISHING_SPEED', 'Fishing Speed', ['general']],
  ['SEA_CREATURE_CHANCE', 'Sea Creature Chance', ['general']],
  ['PRESSURE_RESISTANCE', 'Pressure Resistance', ['general']],
  ['RESPIRATION', 'Respiration', ['general']],
  ['FORAGING_FORTUNE', 'Foraging Fortune', ['general']],
  ['SOCIAL_WISDOM', 'Social Wisdom', ['general'], '☯', C.cyan],
  ['ENCHANTING_WISDOM', 'Enchanting Wisdom', ['general'], '☯', C.cyan],
  ['ALCHEMY_WISDOM', 'Alchemy Wisdom', ['general'], '☯', C.cyan],
  ['FORAGING_WISDOM', 'Foraging Wisdom', ['general'], '☯', C.cyan],
  ['FISHING_WISDOM', 'Fishing Wisdom', ['general'], '☯', C.cyan],
];
const stats = S.map(([id, name, areas, icon, color, percent]) => {
  const e = { id, name, icon: icon ?? null, color: color ?? null, areas, category: categoryOf(id), unit: percent ? '%' : '', percent: !!percent, src: icon ? 'repo' : 'wiki' };
  // wiki stats page: names and area lists only, icons are images with no text; repo = guide/model.js + docs/design-guide-app.md.
  if (!icon) e.unknown = true;
  if (percent) e.percentSrc = 'not confirmed'; // wiki stats page shows Crit base values as %, not stated per stat otherwise
  return e;
});
write('stats.json', { stats });
const STAT = new Set(stats.map((s) => s.id));

// ---------- hotm ----------
const L = read('hotmlayout.json').hotm;
// Effect value at level L = a + b * L (+ floor(L / stepEvery) * stepAdd if set; floor if floor:true; then capped at cap). cond = where it applies.
// Formulas and costs: wiki Heart of the Mountain perk table (screenshots, 2026-11-04); positions and max levels: NEU, checked in game.
const E = (stat, a, b, cond = 'always', extra = {}) => ({ stat, a, b, cond, ...extra });
const X = (key, unit, a, b, cond = 'always', extra = {}) => ({ key, unit, a, b, cond, ...extra }); // effect that is not a stat
const MULT = ['STRENGTH', 'CRITICAL_CHANCE', 'CRITICAL_DAMAGE', 'DEFENSE', 'HEALTH'];
// id: [powder, exponent, effects, otherEffects, extra]. Cost to reach level N = floor((N + offset) ^ exp), offset 1 unless given.
const PERKS = {
  mining_speed: [null, null, [E('MINING_SPEED', 0, 20)], [], { note: 'cost exponent not read yet' }],
  mining_fortune: ['mithril', 3.05, [E('MINING_FORTUNE', 0, 2)]],
  titanium_insanium: ['mithril', 3.1, [], [X('titanium_replace_chance', '%', 2, 0.1, 'always', { note: 'Mithril to Titanium' })]],
  luck_of_the_cave: ['mithril', 3.07, [], [X('rare_spawn_chance', '%', 5, 1, 'dwarven_mines', { formula: 'final = base * (1 + TunnelVisionLevel / 100 + x / 100)', note: 'Golden Goblin only when also in Glacite Tunnels; not affected by Tracking' })]],
  efficient_miner: ['mithril', 2.6, [E('MINING_SPREAD', 0, 3)]],
  quick_forge: ['mithril', 3.2, [], [X('forge_time_reduction', '%', 10, 0.5, 'always', { cap: 30, stepEvery: 20, stepAdd: 10, formula: 'min(30, 10 + 0.5 L + floor(0.05 L) * 10)', note: 'value = a + b L + floor(L / stepEvery) * stepAdd, then capped' })]],
  old_school: ['gemstone', 4, [E('ORE_FORTUNE', 0, 5)]],
  professional: ['gemstone', 2.3, [E('MINING_SPEED', 50, 5, 'mining_gemstones')]],
  mole: ['gemstone', 2.17883, [E('MINING_SPREAD', 50 - 350 / 199, 350 / 199, 'mining_hard_stone', { formula: '50 + (L - 1) * 350 / 199' })]],
  gem_lover: ['gemstone', 4, [E('GEMSTONE_FORTUNE', 20, 4)]],
  seasoned_mineman: ['gemstone', 2.3, [E('MINING_WISDOM', 5, 0.1)]],
  blockhead: ['gemstone', 4, [E('BLOCK_FORTUNE', 0, 5)]],
  subterranean_fisher: ['gemstone', 3.07, [E('FISHING_SPEED', 5, 0.5, 'on_mining_islands'), E('SEA_CREATURE_CHANCE', 1, 0.1, 'on_mining_islands')]],
  keep_it_cool: ['gemstone', 3.07, [E('HEAT_RESISTANCE', 0, 0.4)]],
  lonesome_miner: ['gemstone', 3.07, MULT.map((s) => E(s, 4.5, 0.5, 'on_mining_islands', { kind: 'percent_multiplier', formula: '5 + (L - 1) * 0.5' }))],
  great_explorer: ['gemstone', 4, [], [X('crystal_hollows_chest_chance', '%', 16, 4, 'crystal_hollows', { formula: '20 + 4 * (L - 1)', note: 'effective chance is 5 * x' }), X('crystal_hollows_locks_removed', 'count', 1, 0.2, 'crystal_hollows', { floor: true, formula: 'floor(1 + L / 5)' })]],
  speedy_mineman: ['gemstone', 3.2, [E('MINING_SPEED', 0, 40)]],
  powder_buff: ['gemstone', 3.2, [], [X('powder_gain', '%', 0, 1)]],
  fortunate_mineman: ['gemstone', 3.2, [E('MINING_FORTUNE', 0, 3)]],
  no_stone_unturned: ['glacite', 3.05, [], [X('suspicious_scrap_chance', '%', 0, 0.5, 'in_mineshaft')]],
  strong_arm: ['glacite', 2.3, [E('MINING_SPEED', 0, 5, 'mining_dwarven_metals'), E('MINING_SPEED', 0, 5, 'mining_pure_ores', { cap: 500, hidden: true }), E('MINING_SPEED', 0, 25, 'mining_hard_stone_off_ground', { cap: 2500, hidden: true })]],
  steady_hand: ['glacite', 2.6, [E('GEMSTONE_SPREAD', 0, 0.1, 'in_mineshaft')]],
  warm_heart: ['glacite', 3.1, [E('COLD_RESISTANCE', 0, 0.4)]],
  surveyor: ['glacite', 4, [], [X('mineshaft_chance', '%', 0, 0.75, 'in_glacite_tunnels')]],
  metal_head: ['glacite', 4, [E('DWARVEN_METAL_FORTUNE', 0, 5)]],
  rags_to_riches: ['glacite', 3.05, [E('MINING_FORTUNE', 0, 4, 'in_mineshaft')]],
  eager_adventurer: ['glacite', 2.3, [E('MINING_SPEED', 0, 4, 'in_mineshaft')]],
  crystalline: ['glacite', 3.3, [], [X('mineshaft_with_crystal_chance', '%', 0, 0.5)]],
  gifts_from_the_departed: ['glacite', 2.45, [], [X('frozen_corpse_extra_item_chance', '%', 0, 0.2)]],
  mining_master: ['glacite', 5, [E('PRISTINE', 0, 0.1)], [], { offset: 7 }],
  dead_mans_chest: ['glacite', 3.2, [], [X('extra_frozen_corpse_chance', '%', 0, 0.5, 'in_mineshaft')]],
  vanguard_seeker: ['glacite', 3.1, [], [X('vanguard_corpse_mineshaft_chance', '%', 0, 1)]],
  // no powder level, value from the in-game tooltip
  miners_blessing: [null, null, [E('MAGIC_FIND', 30, 0, 'on_mining_islands')]],
};
const RENAME = { anomalous_desire: { id: 'tunnel_vision', name: 'Tunnel Vision' } }; // in-game name; NEU calls it Anomalous Desire
const REQUIRES = { front_loaded: ['seasoned_mineman'] }; // in-game: needs a direct neighbour to be unlocked
const TYPE = { mining_speed_boost: 'ability', pickobulus: 'ability', tunnel_vision: 'ability', maniac_miner: 'ability', gemstone_infusion: 'ability', sheer_force: 'ability', core_of_the_mountain: 'core' };
// Core of the Mountain: fixed cost and reward per level (wiki). cost null = free.
const CORE = [
  [1, null, { tokens: 1 }, 25], [2, ['mithril', 50000], { abilityLevel: 1 }, 35], [3, ['mithril', 100000], { commissionSlots: 1 }, 50],
  [4, ['gemstone', 200000], { basePowder: { mithril: 1 } }, 65], [5, ['gemstone', 300000], { tokens: 1 }, 75], [6, ['gemstone', 400000], { basePowder: { gemstone: 2 } }, 100],
  [7, ['gemstone', 500000], { tokens: 1 }, 125], [8, ['glacite', 750000], { basePowder: { glacite: 3 } }, 150], [9, ['glacite', 1000000], { mineshaftSpawnPercent: 10 }, 175], [10, ['glacite', 1250000], { tokens: 2 }, 200],
].map(([level, c, reward, sbXp]) => ({ level, cost: c && { powder: c[0], amount: c[1] }, reward, sbXp }));

const perks = Object.entries(L.perks).map(([neuId, p]) => {
  const id = RENAME[neuId]?.id ?? neuId;
  const type = TYPE[id] ?? 'perk';
  const tier = 10 - p.y;
  const e = { id, name: RENAME[neuId]?.name ?? p.name, tier, col: p.x, row: p.y, type, maxLevel: type === 'ability' ? 1 : p.maxLevel, requiresTier: tier, src: 'wiki+neu' };
  if (REQUIRES[id]) e.requires = REQUIRES[id];
  const spec = PERKS[id];
  if (type === 'core') {
    e.cost = { kind: 'table' };
    e.levels = CORE;
    e.effects = [];
  } else if (spec) {
    const [powder, exp, effects, other = [], extra = {}] = spec;
    e.effects = effects;
    if (other.length) e.otherEffects = other;
    if (powder) e.cost = { powder, exp, offset: extra.offset ?? 1 };
    else if (id === 'mining_speed') { e.cost = null; e.unknown = true; }
    else e.cost = { kind: 'none' };
    if (extra.note) e.note = extra.note;
    if (p.maxLevel > 1) e.omeletteBonus = true; // Blue Cheese Goblin Omelette: max level + 1
  } else {
    e.effects = []; e.cost = { kind: 'none' }; e.note = type === 'ability' ? 'ability, no permanent stat' : 'one-level utility perk, no stat';
  }
  return e;
});

// Abilities: level comes from Core of the Mountain, wiki ability table.
const AB = {
  mining_speed_boost: { effects: [{ stat: 'MINING_SPEED', kind: 'percent', values: [200, 250, 300], cond: 'ability_active' }], duration: [10, 15, 20], cooldown: [120, 120, 120] },
  pickobulus: { effects: [], note: '3-block radius explosion', cooldown: [60, 50, 40] },
  tunnel_vision: { effects: [], note: 'Tunnel Vision: rare event chance +30/40/50 %', duration: [30, 30, 30], cooldown: [120, 110, 110] },
  maniac_miner: { effects: [{ stat: 'BREAKING_POWER', kind: 'flat', values: [1, 1, 1], cond: 'ability_active' }, { stat: 'MINING_FORTUNE', kind: 'per_block', values: [5, 10, 15], cap: 500, cond: 'ability_active' }], duration: [25, 30, 35], cooldown: [120, 120, 120] },
  gemstone_infusion: { effects: [], note: '+100 % gemstone effectiveness', duration: [20, 25, 30], cooldown: [120, 120, 120] },
  sheer_force: { effects: [{ stat: 'MINING_SPREAD', kind: 'flat', values: [200, 200, 200], cond: 'ability_active' }], duration: [20, 25, 30], cooldown: [120, 120, 120] },
};
for (const p of perks) {
  const a = AB[p.id];
  if (!a) continue;
  const { effects, ...rest } = a;
  Object.assign(p, { abilityLevels: 3, coreLevelNeeded: [1, 2, null], effects: [], activeEffects: effects, ...rest });
  p.unknown = true; // core level for ability level 3 is not on the wiki page read (NEU only knows level 1 and 2)
}
// neighbours: same-row/column grid neighbours that are perks
const at = new Map(perks.map((p) => [`${p.col},${p.row}`, p.id]));
for (const p of perks) {
  p.neighbors = [[0, -1], [0, 1], [-1, 0], [1, 0]].map(([dx, dy]) => at.get(`${p.col + dx},${p.row + dy}`)).filter(Boolean).sort();
}
const hotmXp = [0, 3000, 12000, 37000, 97000, 197000, 347000, 557000, 847000, 1247000];
write('hotm.json', { omelette: { name: 'Blue Cheese Goblin Omelette', maxLevelBonus: 1, appliesTo: 'perks with omeletteBonus: true', note: 'global switch, not a perk' }, costNote: 'cost to reach level N = floor((N + offset) ^ exp) of cost.powder; Core of the Mountain has a fixed table in levels', tiers: hotmXp.map((xp, i) => ({ tier: i + 1, cumulativeXp: xp })), grid: { cols: 7, rows: 10, tierOfRow: 'tier = 10 - row' }, neighborNote: 'neighbors = orthogonal grid neighbours that exist; derived from the grid; positions checked against the in-game grid 2026-11-04', perks });

// ---------- attributes ----------
const A = read('attribute_shards.json');
// [stat, perLevel(level 1 value), condition]; a stat list means all of them. Source: wiki Attribute Shards table (range min-max, linear over 10 levels).
const ELEM = { 1: ['HEALTH', 2], 2: ['INTELLIGENCE', 1], 3: ['STRENGTH', 1] };
const SE = {}; // id -> {effects}
const eff = (stat, per, cond = 'always') => ({ stat, perLevel: per, cond });
for (const r of 'CUREL') for (const n of [1, 2, 3]) SE[`${r}${n}`] = [eff(...ELEM[n])];
const add = (id, ...e) => { SE[id] = e; };
add('C33', eff('HEAT_RESISTANCE', 1)); add('U18', eff('SPEED', 1)); add('R44', eff('PRESSURE_RESISTANCE', 1)); add('R50', eff('RESPIRATION', 1));
add('E58', eff('SOCIAL_WISDOM', 0.5)); add('L15', eff('VITALITY', 1)); add('L28', eff('MAGIC_FIND', 0.5)); add('L34', eff('TRACKING', 0.5)); add('L38', eff('TREASURE_CHANCE', 0.1));
add('L41', eff('MINING_FORTUNE', 1), eff('FARMING_FORTUNE', 1), eff('FORAGING_FORTUNE', 1)); add('L60', eff('COLD_RESISTANCE', 0.5));
add('C49', eff('SPEED', 3, 'on_foraging_islands')); add('R4', eff('FORAGING_FORTUNE', 10));
add('C10', eff('BLOCK_FORTUNE', 5)); add('C36', eff('MINING_SPEED', 3)); add('C37', eff('MINING_FORTUNE', 2.5)); add('C43', eff('ORE_FORTUNE', 5));
add('U73', eff('GEMSTONE_FORTUNE', 5, 'mining_fiesta_active')); add('R66', eff('MINING_SPREAD', 1)); add('E36', eff('MINING_WISDOM', 0.5)); add('E45', eff('GEMSTONE_SPREAD', 0.25));
// Freezing Spread: tooltip at level 10: +0.5 Gemstone Spread per 20 Cold Resistance in Glacite Mineshafts. Wiki range 29-20 for level 1-10; levels 2-9 not read.
SE.E66 = [{ stat: 'GEMSTONE_SPREAD', kind: 'per_stat', value: 0.5, per: { stat: 'COLD_RESISTANCE', every: { level1: 29, level10: 20 }, everyBetween: 'unknown' }, cond: 'in_mineshaft' }];
add('E63', eff('MINING_SPEED', 5, 'in_mines_of_divan'), eff('ORE_FORTUNE', 2.5, 'in_mines_of_divan'));
add('C29', eff('STRENGTH', 5, 'on_foraging_islands')); add('E33', eff('TRUE_DEFENSE', 1)); add('E48', eff('ATTACK_SPEED', 1)); add('L23', eff('HEALTH_REGEN', 1.25)); add('L33', eff('COMBAT_WISDOM', 1)); add('L12', eff('ENCHANTING_WISDOM', 0.5));
for (const id of ['C6', 'C8', 'C15', 'C18', 'C21', 'C30', 'C31', 'C39', 'C42', 'C44', 'C47', 'C58', 'C46']) add(id, eff('DEFENSE', 4, 'vs_mob_family'));
for (const id of ['R18', 'R46', 'R55', 'R62', 'R63', 'R64', 'R67', 'R73', 'R75', 'R76', 'R78', 'R79', 'R87', 'R89']) add(id, eff('MAGIC_FIND', 0.5, 'vs_mob_family'));
add('R56', eff('MAGIC_FIND', 1, 'vs_mob_family')); add('E44', eff('MAGIC_FIND', 0.5, 'on_foraging_islands')); add('U51', eff('TRACKING', 0.5, 'vs_special_zealots')); add('E39', eff('TRACKING', 0.5, 'griffin_burrows'));
add('C13', eff('FARMING_FORTUNE', 2.5)); add('U10', eff('OVERBLOOM', 0.5, 'on_pest')); add('U19', eff('FARMING_FORTUNE', 5, 'on_pest')); add('U40', eff('FARMING_FORTUNE', 3, 'pest_in_plot'));
add('U94', eff('BONUS_PEST_CHANCE', 1)); add('R16', eff('OVERBLOOM', 1)); add('E13', eff('FARMING_FORTUNE', 5, 'night')); add('E31', eff('FARMING_FORTUNE', 5, 'day')); add('E37', eff('FARMING_WISDOM', 0.5));
const FIXED = { R33: { stat: 'MINING_SPEED', value: 100, cond: 'weather_on_mining_islands' } }; // fixed, no level scaling
// Seen on the wiki list with a non-stat effect (damage %, drop chance, essence, discounts ...).
const OTHER = new Set(('C16 C22 C27 C48 C61 U61 U64 U85 U97 U106 R6 R11 R13 R22 R23 R24 R25 R26 R27 R34 R35 R38 R49 R57 R59 R60 R68 R70 R86 R91 R94 E16 E19 E21 E34 E43 E46 L10 L18 L20 L21 L24 L25 L32 L35 L36 L39 L42 L44 L49 ' +
  'C12 U12 U14 U15 U22 U24 U27 U29 U30 U33 U36 U38 U42 U46 U48 U55 U58 U60 U71 U75 U79 R28 R30 R36 R39 R42 E12 E18 E24 E25 E26 E27 E42 E51 E54 E57 L9 L14 L17 L27 L30 L45 L54 ' +
  'U17 C9 R15 C25 C28 U44 U52 U63 U67 U70 U88 U91 U100 U103 R10 R43 R84 L13 L52 L57 U6 U7 U26 U78 R21 R29 R31 R51 R52 R72 R81 E8 E15 E60 E66 R77 ' +
  'U4 U5 U8 U9 U11 U16 U20 U21 U23 U25 U28 U31 U32 U34 U39 U41 U43 U45 U47 U49 U50 U53 U56 U57 U59 U62 U65 U68 U69 U72 U76 U82 R5 R7 R8 R9 R19 R32 R37 R40 R45 R47 R53 R54 R58 R61 R65').split(' '));
const MINING_IDS = new Set(['C10', 'C36', 'C37', 'C43', 'U6', 'U7', 'U26', 'U73', 'U78', 'R21', 'R29', 'R31', 'R33', 'R51', 'R52', 'R66', 'R72', 'R81', 'E8', 'E15', 'E36', 'E45', 'E60', 'E63', 'E66']);
// Checked on the in-game tooltip. Pickaxe Cooldown: level 10 = -10 % ability cooldown (wiki range 1-10 %, level 2-9 not read).
const INGAME = {
  C36: {},
  E66: { note: 'Gemstone Spread only in Glacite Mineshafts, scales with Cold Resistance; every-N for level 2-9 unknown' },
  E8: { effectKind: 'other', note: 'Pickaxe ability cooldown -10 % at level 10' },
};
const attributes = A.attributes.map((a) => {
  const e = { id: a.internalName.replace(/;\d+$/, ''), key: a.abilityName.toLowerCase().replace(/[^a-z0-9]+/g, '_'), shardId: a.shardId, shard: a.displayName, name: a.abilityName, rarity: a.rarity, maxLevel: 10, icon: a.bazaarName, src: 'neu' };
  if (A.unconsumable_attributes.includes(a.bazaarName)) e.unconsumable = true;
  const fx = SE[a.shardId];
  if (fx) { e.effects = fx; e.src = 'neu+wiki'; }
  else if (FIXED[a.shardId]) { e.effects = [{ stat: FIXED[a.shardId].stat, fixed: FIXED[a.shardId].value, cond: FIXED[a.shardId].cond }]; e.src = 'neu+wiki'; }
  else if (OTHER.has(a.shardId)) { e.effects = []; e.effectKind = 'other'; e.src = 'neu+wiki'; }
  else { e.effects = []; e.unknown = true; }
  if (INGAME[a.shardId]) { e.src = 'ingame tooltip 2026-11-04'; Object.assign(e, INGAME[a.shardId]); }
  const areas = new Set();
  for (const f of e.effects) for (const ar of stats.find((s) => s.id === f.stat).areas) if (ar !== 'general') areas.add(ar);
  if (MINING_IDS.has(a.shardId)) areas.add('mining');
  e.areas = [...areas].sort();
  return e;
});
// Blaze (wiki "Attributes", 2026-11-05; the ranges there are level I to X, linear per level is an assumption): the mob family a resistance or
// fortune works against, the damage attributes as plain notes (shown, never added), Unlimited Fortitude as a percent of Defense.
const FAMILY_ALIAS = { blazing: 'infernal' };
const NOTES = {
  skeletal_ruler: [3, '% damage against Skeletal mobs'], humanoid_ruler: [3, '% damage against Humanoid mobs'], undead_ruler: [3, '% damage against Undead mobs'],
  airborne_ruler: [3, '% damage against Airborne mobs'], infernal_ruler: [3, '% damage against Infernal mobs'], elite: [3, '% damage against bosses and mini-bosses'],
  warrior: [2.5, '% melee damage'], dominance: [1.5, '% damage at full health'], lifeline: [2.5, '% damage and Defense below 20 % health'],
  payback: [2, '% damage on the next hit after you were hit'], combo: [0.1, '% damage per Grandma Wolf combo (up to 50)'],
  mana_steal: [0.5, ' Mana per hit (0.5 s cooldown)'], ignition: [30, '% longer fire damage'], shell: [10, '% chance to negate knockback'],
};
for (const a of attributes) {
  for (const f of a.effects) if (f.cond === 'vs_mob_family') { const fam = a.key.replace(/_[^_]+$/, ''); f.family = FAMILY_ALIAS[fam] ?? fam; }
  if (NOTES[a.key]) a.note = { perLevel: NOTES[a.key][0], text: NOTES[a.key][1] };
  if (a.key === 'unlimited_fortitude') { a.effects = [{ stat: 'DEFENSE', kind: 'percent_multiplier', perLevel: 0.2, cond: 'always' }]; delete a.unknown; }
}
write('attributes.json', { shardsPerLevel: A.attribute_levelling, shardsPerLevelNote: 'index 0 = shards for level 1; same table on the wiki Attribute Shards page', effectNote: 'effect = perLevel x level (linear, level 1..10); fixed = no scaling; per_stat = value per `every` points of another stat', attributes });

// ---------- power ----------
const P = [
  ['ACACIA_BIRDHOUSE', 'Acacia Birdhouse', 'Forceful', { CRITICAL_DAMAGE: 46.28, STRENGTH: 173.56, HEALTH: 16.2 }, { FEROCITY: 4 }],
  ['BEATING_HEART', 'Beating Heart', 'Bloody', { CRITICAL_DAMAGE: 104.13, STRENGTH: 104.13, INTELLIGENCE: 34.71 }, { ATTACK_SPEED: 10 }],
  ['BUBBA_BLISTER', 'Bubba Blister', 'Bubba', { DEFENSE: -92.56, HEALTH: 48.6, CRITICAL_DAMAGE: 104.13, TRUE_DEFENSE: 7.87, STRENGTH: 46.28, ATTACK_SPEED: 17.36, CRITICAL_CHANCE: 9.26 }, { COMBAT_WISDOM: 2 }],
  ['DARK_ORB', 'Dark Orb', 'Shaded', { SPEED: 5.79, CRITICAL_DAMAGE: 173.56, STRENGTH: 46.28 }, { ATTACK_SPEED: 3, FEROCITY: 3 }],
  ['DISPLACED_LEECH', 'Displaced Leech', 'Sanguisuge', { CRITICAL_CHANCE: 9.26, CRITICAL_DAMAGE: 46.28, HEALTH: 32.4, STRENGTH: 138.85 }, { INTELLIGENCE: 100 }],
  ['ECCENTRIC_PAINTING', 'Eccentric Painting', 'Bizarre', { CRITICAL_DAMAGE: -23.14, INTELLIGENCE: 416.54, STRENGTH: -23.14 }, { ABILITY_DAMAGE: 5 }],
  ['END_STONE_SHULKER', 'End Stone Shulker', 'Adept', { DEFENSE: 92.56, INTELLIGENCE: 34.71, HEALTH: 161.99 }, { HEALTH: 100, DEFENSE: 50 }],
  ['ENDER_MONOCLE', 'Ender Monocle', 'Sighted', { INTELLIGENCE: 347.11 }, { ABILITY_DAMAGE: 3 }],
  ['FANG_TASTIC_CHOCOLATE_CHIP', 'Fang-tastic Chocolate Chip', 'Crumbly', { HEALTH: 97.19, CRITICAL_CHANCE: 4.63, ATTACK_SPEED: 6.94, INTELLIGENCE: 52.07, TRUE_DEFENSE: 15.74 }, { SPEED: 25 }],
  ['FURBALL', 'Furball', 'Itchy', { SPEED: 5.79, CRITICAL_DAMAGE: 80.99, STRENGTH: 69.42, ATTACK_SPEED: 20.83 }, { STRENGTH: 15, CRITICAL_DAMAGE: 15 }],
  ['GLACITE_CHUNK', 'Glacite Chunk', 'Frozen', { TRUE_DEFENSE: 17.7, DEFENSE: 127.27 }, { TRUE_DEFENSE: 10, CRITICAL_DAMAGE: 25, STRENGTH: 25 }],
  ['HAZMAT_ENDERMAN', 'Hazmat Enderman', 'Slender', { CRITICAL_DAMAGE: 57.85, HEALTH: 80.99, ATTACK_SPEED: 10.41, SPEED: 5.79, INTELLIGENCE: 86.78, STRENGTH: 57.85, DEFENSE: 57.85 }, { STRENGTH: 50, DEFENSE: 100 }],
  ['HORNS_OF_TORMENT', 'Horns of Torment', 'Demonic', { STRENGTH: 53.22, INTELLIGENCE: 267.28 }, { CRITICAL_DAMAGE: 50 }],
  ['LUXURIOUS_SPOOL', 'Luxurious Spool', 'Silky', { SPEED: 5.79, CRITICAL_DAMAGE: 219.84 }, { ATTACK_SPEED: 5 }],
  ['MAGMA_URCHIN', 'Magma Urchin', 'Hurtful', { STRENGTH: 46.28, CRITICAL_DAMAGE: 185.13 }, { ATTACK_SPEED: 15 }],
  ['MANDRAA', 'Mandraa', 'Strong', { STRENGTH: 115.7, CRITICAL_DAMAGE: 115.7 }, { STRENGTH: 25, CRITICAL_DAMAGE: 25 }],
  ['OBSIDIAN_TABLET', 'Obsidian Tablet', 'Mythical', { DEFENSE: 39.34, HEALTH: 55.08, CRITICAL_DAMAGE: 39.34, SPEED: 9.26, STRENGTH: 39.34, INTELLIGENCE: 59.01, CRITICAL_CHANCE: 15.74 }, { STRENGTH: 40, HEALTH: 150 }],
  ['PRECIOUS_PEARL', 'Precious Pearl', 'Pleasant', { HEALTH: 129.59, DEFENSE: 138.85 }, {}],
  ['ROCK_CANDY', 'Rock Candy', 'Sweet', { SPEED: 11.57, DEFENSE: 104.13, HEALTH: 145.79 }, { SPEED: 5 }],
  ['SCORCHED_BOOKS', 'Scorched Books', 'Scorching', { CRITICAL_DAMAGE: 92.56, STRENGTH: 80.99, ATTACK_SPEED: 17.36 }, { FEROCITY: 7 }],
  ['SUNFLOWER_BUTTER', 'Sunflower Butter', 'Buttery', { SPEED: 23.14, ATTACK_SPEED: 20.83 }, { ATTACK_SPEED: 5 }],
  ['VITAMIN_DEATH', 'Vitamin Death', 'Healthy', { HEALTH: 323.97 }, { HEALTH: 200 }],
];
const MULT250 = 29.97 * Math.log(0.0019 * 250 + 1) ** 1.2; // 9.64 on the wiki Powers page
const r2 = (n) => Math.round(n * 100) / 100;
const powerStones = P.map(([id, item, power, at250, bonus]) => ({
  id, item, power, statsAt250: at250,
  base: Object.fromEntries(Object.entries(at250).map(([k, v]) => [k, r2(v / 9.64)])),
  baseDerived: true, uniqueBonus: bonus, uniqueScales: false, src: 'wiki',
}));
const wisdoms = ['COMBAT', 'MINING', 'FARMING', 'FORAGING', 'FISHING', 'ENCHANTING', 'ALCHEMY'];
write('power.json', {
  stoneNote: 'statsAt250 = wiki Powers page value at 250 Accessory Power. base = statsAt250 / 9.64, derived (the page lists no base values). uniqueBonus does not scale with Accessory Power.',
  multiplier: { formula: 'a * ln(b * ap + 1) ^ exp', a: 29.97, b: 0.0019, exp: 1.2, checkAt250: Number(MULT250.toFixed(2)), src: 'wiki Accessory Power' },
  accessoryPower: { COMMON: 3, UNCOMMON: 5, RARE: 8, EPIC: 12, LEGENDARY: 16, MYTHIC: 22, DIVINE: 28, SPECIAL: 3, VERY_SPECIAL: 5, ULTIMATE: 1, ADMIN: 22, src: 'wiki Accessory Power' },
  powerStones,
  tuning: {
    pointsPerAccessoryPower: 0.1, templateCostBits: 10000, maxTemplates: 8, src: 'wiki Maxwell',
    stats: [
      { stat: 'HEALTH', perPoint: null, unknown: true }, { stat: 'DEFENSE', perPoint: null, unknown: true }, { stat: 'SPEED', perPoint: null, unknown: true },
      { stat: 'STRENGTH', perPoint: null, unknown: true }, { stat: 'CRITICAL_CHANCE', perPoint: null, unknown: true }, { stat: 'CRITICAL_DAMAGE', perPoint: null, unknown: true },
      { stat: 'ATTACK_SPEED', perPoint: 0.3, src: 'wiki Attack Speed page, found via search snippet only, not confirmed' }, { stat: 'INTELLIGENCE', perPoint: null, unknown: true },
    ],
  },
  boosterCookie: { days: 4, effects: [...wisdoms.map((w) => ({ stat: `${w}_WISDOM`, value: 25 })), { stat: 'MAGIC_FIND', value: 15 }], src: 'wiki Booster Cookie' },
  godPotion: {
    src: 'wiki God Potion (effect names and levels only)', unknown: true,
    note: 'Wiki lists effect names and levels, no stat amounts; per-level values not read',
    effects: [['Critical', 'IV'], ['Regeneration', 'IX'], ['Strength', 'VIII'], ['Agility', 'IV'], ['Night Vision', 'I'], ['Absorption', 'VIII'], ['Burning', 'IV'], ['Stun', 'IV'], ['Dodge', 'IV'], ['Experience', 'IV'], ['Mana', 'VIII'], ['Speed', 'VIII'], ['Water Breathing', 'VI'], ['Alchemy XP Boost', 'III'], ['Combat XP Boost', 'III'], ['Enchanting XP Boost', 'III'], ['Farming XP Boost', 'III'], ['Fishing XP Boost', 'III'], ['Foraging XP Boost', 'III'], ['Mining XP Boost', 'III'], ['Rabbit', 'VI'], ['Resistance', 'VIII'], ['Archery', 'IV'], ['Jump Boost', 'IV'], ['Magic Find', 'IV'], ['Pet Luck', 'IV'], ['Spirit', 'IV'], ['Spelunker', 'V'], ['Adrenaline', 'VIII'], ['Fire Resistance', 'I'], ['Haste', 'IV'], ['True Resistance', 'IV'], ['Jerry Candy', null]].map(([name, level]) => ({ name, level })),
  },
});
console.log('ok', stats.length, perks.length, attributes.length, powerStones.length);

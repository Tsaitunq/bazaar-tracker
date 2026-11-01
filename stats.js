// What the player's stats are in a chosen setup, added up from item lore and the synced profile.
// Potions, mayor, cake and museum are not readable, shards and essence perks have no table yet; the /stats comparison shows them.
import { levelOf, SKILL_XP, SLAYER_XP } from './requires.js';

export const AREA_STATS = {
  mining: ['MINING_FORTUNE', 'GEMSTONE_FORTUNE', 'ORE_FORTUNE', 'BLOCK_FORTUNE', 'MINING_SPEED', 'PRISTINE'],
  blaze: ['STRENGTH', 'CRITICAL_DAMAGE', 'CRITICAL_CHANCE', 'ATTACK_SPEED', 'HEALTH', 'DEFENSE', 'TRUE_DEFENSE'],
};
export const GEMSTONE = { wF: 1, wS: 1, wP: 1, blockStrength: 3000 };
const TOOLS = new Set(['DRILL', 'PICKAXE', 'GAUNTLET']);
const WEAPONS = new Set(['SWORD', 'LONGSWORD']);
const MIN_TRUE_DEFENSE = 140;
const MIN_MP = 800;

const fortune = (s) => (s.MINING_FORTUNE ?? 0) + (s.GEMSTONE_FORTUNE ?? 0);

// Spec 4.1, the derivative of the yield. wiki Pristine: Base Drop × (1 + Pristine × 79/100) × (1 + (Mining Fortune + Gemstone Fortune) / 100).
export function miningScore(stats, delta, settings = GEMSTONE) {
  const { wF, wS, wP, blockStrength } = settings;
  const cap = Math.ceil((20 * blockStrength) / 3);
  const speed = Math.min(stats.MINING_SPEED ?? 0, cap);
  const nextSpeed = Math.min((stats.MINING_SPEED ?? 0) + (delta.MINING_SPEED ?? 0), cap);
  return wF * fortune(delta) / (100 + fortune(stats))
    + wS * (nextSpeed - speed) / Math.max(speed, 1)
    + wP * 0.79 * (delta.PRISTINE ?? 0) / (1 + 0.79 * (stats.PRISTINE ?? 0));
}

// Spec 4.2 without the enchant and dagger factors, which come with the Blaze model. The crit term is the expected value.
export function blazeScore(s) {
  return (5 + (s.DAMAGE ?? 0)) * (1 + (s.STRENGTH ?? 0) / 100) * (1 + Math.min(s.CRITICAL_CHANCE ?? 0, 100) / 100 * (s.CRITICAL_DAMAGE ?? 0) / 100);
}

const atLeast = (value, min) => (value === null || value === undefined ? 'unknown' : value >= min ? 'ok' : 'low');
export const blazeConstraints = (stats, mp) => ({ trueDefense: atLeast(stats?.TRUE_DEFENSE, MIN_TRUE_DEFENSE), mp: atLeast(mp, MIN_MP) });

function add(sum, stats, times = 1) {
  for (const [k, v] of Object.entries(stats ?? {})) sum[k] = (sum[k] ?? 0) + v * times;
  return sum;
}
export const gearStats = (items) => items.reduce((sum, i) => add(sum, i.lore), {});

const loreSize = (i) => Object.values(i.lore ?? {}).reduce((sum, v) => sum + Math.abs(v), 0);

// One accessory per family counts, the stronger one. An accessory without a family is its own.
function accessoriesOf(profile, items) {
  const best = new Map();
  for (const item of profile.items.filter((i) => i.where === 'accessory')) {
    const family = items?.[item.id]?.family ?? item.id;
    if (!best.has(family) || loreSize(item) > loreSize(best.get(family))) best.set(family, item);
  }
  return [...best.values()];
}

// A wardrobe slot holds no tool or weapon, so the strongest owned one is taken and shown.
function heldOf(profile, items, area, gear) {
  const of = (group) => profile.items.filter((i) => group.has(items?.[i.id]?.category) && i.where !== 'accessory');
  const rate = area === 'mining' ? (i) => miningScore(gear, i.lore) : (i) => i.lore.DAMAGE ?? 0;
  return of(area === 'mining' ? TOOLS : WEAPONS).reduce((best, i) => (!best || rate(i) > rate(best) ? i : best), null);
}

function fullSets(armor) {
  const pieces = new Map();
  for (const { id } of armor) {
    const [, stem] = id.match(/^(.+)_(?:HELMET|CHESTPLATE|LEGGINGS|BOOTS)$/) ?? [];
    if (stem) pieces.set(stem, (pieces.get(stem) ?? 0) + 1);
  }
  return [...pieces].filter(([, n]) => n === 4).map(([stem]) => stem);
}

// The pet of a pick like LION:EPIC, the most levelled of them. Without a pick the active one.
function petOf(profile, pick, gaps) {
  const pets = profile.pets ?? [];
  if (!pick) {
    gaps.push('No pet picked, using the active one.');
    return pets.find((p) => p.active) ?? null;
  }
  const pet = pets.filter((p) => `${p.type}:${p.tier}` === pick).reduce((best, p) => (!best || (p.exp ?? 0) > (best.exp ?? 0) ? p : best), null);
  if (!pet) gaps.push('The picked pet is not in the last sync.');
  return pet;
}

// choice: the wardrobe slot, equipment slot and pet the player picked. Accessories and power are what the sync found.
export function loadoutOf(profile, items, area, choice) {
  const gaps = [];
  const setOf = (kind) => {
    const known = profile.wardrobe?.[kind];
    if (!known) return [];
    const n = choice?.[kind] ?? known.equipped;
    return profile.items.filter((i) => i.sets?.includes(`${kind}:${n}`));
  };
  if (!profile.wardrobe) gaps.push('Sync again to read your wardrobe.');
  else if (!choice?.armor || !choice?.equipment) gaps.push('No wardrobe slot picked, using what is worn.');
  const armor = setOf('armor');
  const equipment = setOf('equipment');
  if (!items) gaps.push('Item data missing: no tool or weapon, and accessory families count twice.');
  const held = items && !choice?.emptyHand ? heldOf(profile, items, area, gearStats([...armor, ...equipment])) : null;
  if (items && !held && !choice?.emptyHand) gaps.push(area === 'mining' ? 'No mining tool found.' : 'No weapon found.');
  for (const stem of fullSets(armor)) gaps.push(`Full set ${stem}: its bonus is not counted.`);
  return { armor, equipment, held, accessories: accessoriesOf(profile, items), pet: petOf(profile, choice?.pet, gaps), gaps };
}

// wiki Stats
const BASE = { HEALTH: 100, CRITICAL_CHANCE: 30, CRITICAL_DAMAGE: 50 };
// wiki Heart of the Mountain, per perk level. gem_lover as the node of +20 and +4 per level is not confirmed.
const HOTM_PERKS = { mining_speed: { MINING_SPEED: 20 }, mining_fortune: { MINING_FORTUNE: 2 }, pristine: { PRISTINE: 0.1 } };
// wiki Mining Fortune: +1 at each of these collection tiers
const FORTUNE_TIERS = { GLACITE: [1, 6, 7, 8], TUNGSTEN: [1, 5, 7, 8, 9], UMBER: [1, 5, 7, 8], OBSIDIAN: [5, 7, 8, 10] };
// wiki Powers: Fortuitous as listed. The other three are its values at 250 power divided by the multiplier there, plus the flat bonus.
const POWERS = {
  fortuitous: { scaled: { HEALTH: 3.35, DEFENSE: 1.2, STRENGTH: 4.8, CRITICAL_CHANCE: 4.35, CRITICAL_DAMAGE: 4.8 } },
  scorching: { scaled: { CRITICAL_DAMAGE: 9.6, STRENGTH: 8.4, ATTACK_SPEED: 1.8 } },
  silky: { scaled: { CRITICAL_DAMAGE: 22.8 }, flat: { ATTACK_SPEED: 5 } },
  bloody: { scaled: { CRITICAL_DAMAGE: 10.8, STRENGTH: 10.8 }, flat: { ATTACK_SPEED: 10 } },
};
// not confirmed: the wiki pages Maxwell, Accessory Bag and Tuning Points give no value per point. The closed wiki.hypixel.net Powers page, seen
// only as a search excerpt, gave health 5, crit chance 0.2, attack speed 0.3. Defense, strength and crit damage 1 have no source: /stats decides.
const TUNING = { health: { HEALTH: 5 }, defense: { DEFENSE: 1 }, strength: { STRENGTH: 1 }, critical_damage: { CRITICAL_DAMAGE: 1 }, critical_chance: { CRITICAL_CHANCE: 0.2 }, attack_speed: { ATTACK_SPEED: 0.3 } };

export const powerMultiplier = (mp) => 29.97 * Math.log(0.0019 * mp + 1) ** 1.2;

// wiki Farming and Fishing: +2 to level 14, +3 to 19, +4 to 25, then +5
const healthOf = (l) => Math.min(l, 14) * 2 + Math.max(Math.min(l, 19) - 14, 0) * 3 + Math.max(Math.min(l, 25) - 19, 0) * 4 + Math.max(l - 25, 0) * 5;
// wiki Mining and Foraging: +1 to level 14, then +2
const steppedOf = (l) => Math.min(l, 14) + Math.max(l - 14, 0) * 2;

const skillLevel = (profile, name, cap) => Math.min(levelOf(SKILL_XP, profile.skills?.[`SKILL_${name}`] ?? 0), cap);

function skillStats(profile) {
  const mining = skillLevel(profile, 'MINING', 60);
  return {
    MINING_FORTUNE: mining * 4, // wiki Mining Fortune
    DEFENSE: steppedOf(mining),
    HEALTH: healthOf(skillLevel(profile, 'FARMING', 50 + (profile.farmingCap ?? 0))) + healthOf(skillLevel(profile, 'FISHING', 50)),
    STRENGTH: steppedOf(skillLevel(profile, 'FORAGING', 57)), // wiki Foraging: 57 is the top
    CRITICAL_CHANCE: skillLevel(profile, 'COMBAT', 60) * 0.5, // wiki Combat
  };
}

// wiki SkyBlock Levels: 100 experience a level, +5 Health each, +1 Strength every 5
function levelStats(xp) {
  const level = Math.floor(xp / 100);
  return { HEALTH: level * 5, STRENGTH: Math.floor(level / 5) };
}

// wiki Zombie, Spider, Wolf, Enderman and Blaze Slayer: what each level from 1 adds. Vampire has no stat of ours.
const SLAYER_REWARDS = {
  zombie: [{ HEALTH: 2 }, { HEALTH: 2 }, { HEALTH: 3 }, { HEALTH: 3 }, { HEALTH: 4 }, { HEALTH: 4 }, { HEALTH: 5 }, { HEALTH: 5 }, { HEALTH: 6 }],
  spider: [{ CRITICAL_DAMAGE: 1 }, { CRITICAL_DAMAGE: 1 }, { CRITICAL_DAMAGE: 1 }, { CRITICAL_DAMAGE: 1 }, { CRITICAL_DAMAGE: 2 }, { CRITICAL_DAMAGE: 2 }, { CRITICAL_DAMAGE: 2 }, { CRITICAL_DAMAGE: 3 }, { CRITICAL_DAMAGE: 3 }],
  wolf: [{}, { HEALTH: 2 }, {}, { HEALTH: 2 }, { CRITICAL_DAMAGE: 1 }, { HEALTH: 3 }, { CRITICAL_DAMAGE: 2 }, {}, { HEALTH: 5 }],
  enderman: [{ HEALTH: 1 }, {}, { HEALTH: 2 }, {}, { HEALTH: 3 }, {}, { HEALTH: 4 }, {}, { HEALTH: 5 }],
  blaze: [{ HEALTH: 3 }, { STRENGTH: 1 }, { HEALTH: 4 }, { TRUE_DEFENSE: 1 }, { HEALTH: 5 }, { STRENGTH: 2 }, { HEALTH: 6 }, { TRUE_DEFENSE: 2 }, { HEALTH: 7 }],
};

function slayerStats(slayer) {
  const out = {};
  for (const [boss, rewards] of Object.entries(SLAYER_REWARDS)) {
    for (const reward of rewards.slice(0, levelOf(SLAYER_XP[boss], slayer[boss] ?? 0))) add(out, reward);
  }
  return out;
}

function hotmStats(profile) {
  const out = {};
  for (const [node, stats] of Object.entries(HOTM_PERKS)) add(out, stats, profile.hotm.nodes?.[node] ?? 0);
  const gem = profile.hotm.nodes?.gem_lover;
  if (gem > 0) add(out, { GEMSTONE_FORTUNE: 20 + 4 * gem });
  return out;
}

function collectionStats(profile) {
  const have = new Set(profile.collTiers);
  const count = Object.entries(FORTUNE_TIERS).reduce((sum, [c, tiers]) => sum + tiers.filter((t) => have.has(`${c}_${t}`)).length, 0);
  return { MINING_FORTUNE: count };
}

function powerStats(profile, gaps) {
  const out = {};
  const power = POWERS[profile.selectedPower];
  if (profile.selectedPower && !power) gaps.push(`Power ${profile.selectedPower} has no stat table yet.`);
  if (power && profile.mp !== null && profile.mp !== undefined) {
    add(out, power.scaled, powerMultiplier(profile.mp));
    add(out, power.flat);
  }
  // shortcut: the active tuning slot is not in the data, so slot 0 counts; read it once a field for it turns up.
  const points = profile.tuning?.slot_0 ?? {};
  for (const [name, stats] of Object.entries(TUNING)) if (points[name]) add(out, stats, points[name]);
  const others = Object.entries(profile.tuning ?? {}).filter(([k, v]) => /^slot_[1-9]/.test(k) && Object.values(v ?? {}).some((n) => n > 0));
  if (others.length) gaps.push('Tuning: only slot 0 is counted.');
  return out;
}

// NEU constants/pets.json, not on the wiki as a table: not confirmed. XP per level, an offset per rarity picks the start.
const PET_LEVELS = [100, 110, 120, 130, 145, 160, 175, 190, 210, 230, 250, 275, 300, 330, 360, 400, 440, 490, 540, 600, 660, 730, 800, 880, 960, 1050, 1150, 1260, 1380, 1510, 1650, 1800, 1960, 2130, 2310, 2500, 2700, 2920, 3160, 3420, 3700, 4000, 4350, 4750, 5200, 5700, 6300, 7000, 7800, 8700, 9700, 10800, 12000, 13300, 14700, 16200, 17800, 19500, 21300, 23200, 25200, 27400, 29800, 32400, 35200, 38200, 41400, 44800, 48400, 52200, 56200, 60400, 64800, 69400, 74200, 79200, 84700, 90700, 97200, 104200, 111700, 119700, 128200, 137200, 146700, 156700, 167700, 179700, 192700, 206700, 221700, 237700, 254700, 272700, 291700, 311700, 333700, 357700, 383700, 411700, 441700, 476700, 516700, 561700, 611700, 666700, 726700, 791700, 861700, 936700, 1016700, 1101700, 1191700, 1286700, 1386700, 1496700, 1616700, 1746700, 1886700];
const PET_OFFSET = { COMMON: 0, UNCOMMON: 6, RARE: 11, EPIC: 16, LEGENDARY: 20, MYTHIC: 20 };

// wiki Pets: past level 100 each level costs what level 99 to 100 did.
export function petLevel(pet, top = 100) {
  const start = PET_OFFSET[pet.tier] ?? 0;
  let left = pet.exp ?? 0;
  let level = 1;
  while (level < top) {
    const cost = PET_LEVELS[start + Math.min(level - 1, 98)];
    if (left < cost) break;
    left -= cost;
    level++;
  }
  return level;
}

// The pets owned or named in the guides, from their wiki pages (Lion, Blaze, Golden Dragon, Droplet to Subzero Wisp, Bal, Goblin).
// Stat as a function of the level. Pet Damage stays out: DAMAGE here means the weapon in hand. Abilities are not counted.
const WISP = (tier, health, td) => ({ tiers: [tier], stats: (l) => ({ HEALTH: health * l, ...(td && { TRUE_DEFENSE: td * l }) }) });
const PETS = {
  LION: { tiers: ['RARE', 'EPIC', 'LEGENDARY'], stats: (l) => ({ STRENGTH: 0.5 * l }) },
  BLAZE: { tiers: ['LEGENDARY'], stats: (l) => ({ DEFENSE: 0.3 * l }) },
  GOLDEN_DRAGON: { tiers: ['LEGENDARY'], top: 200, stats: (l) => (l > 100 ? { STRENGTH: 25.25 + 0.25 * (l - 101), ATTACK_SPEED: 25.25 + 0.25 * (l - 101) } : {}) },
  DROPLET_WISP: WISP('UNCOMMON', 1),
  FROST_WISP: WISP('RARE', 2.5, 0.15),
  GLACIAL_WISP: WISP('EPIC', 4, 0.3),
  SUBZERO_WISP: WISP('LEGENDARY', 6, 0.35),
  BAL: { tiers: ['LEGENDARY'], stats: (l) => ({ MINING_FORTUNE: l }) },
  GOBLIN: { tiers: ['LEGENDARY'], stats: (l) => ({ ORE_FORTUNE: l }) },
};

function petStats(pet, gaps) {
  if (!pet) return {};
  gaps.push('Pet abilities are not counted.');
  if (pet.heldItem) gaps.push('The pet item is not counted.');
  const known = PETS[pet.type];
  if (!known?.tiers.includes(pet.tier)) {
    gaps.push(`Pet ${pet.type} ${pet.tier} has no stat table yet.`);
    return {};
  }
  return known.stats(petLevel(pet, known.top));
}

export function computeStats(profile, items, loadout, area) {
  const gaps = [...loadout.gaps];
  if (!profile.skills) gaps.push('Skills API is off: skill stats are missing.');
  if (!profile.hotm) gaps.push('No Heart of the Mountain data.');
  if (!profile.collTiers) gaps.push('Collections API is off: collection stats are missing.');
  if (profile.skyblockXp === null || profile.skyblockXp === undefined) gaps.push('Sync again to read your SkyBlock level.');
  gaps.push('Not counted: shards, essence perks, potions, mayor, cake and museum.');
  const parts = {
    gear: gearStats([...loadout.armor, ...loadout.equipment, ...(loadout.held ? [loadout.held] : [])]),
    accessories: gearStats(loadout.accessories),
    power: powerStats(profile, gaps),
    pet: petStats(loadout.pet, gaps),
    hotm: profile.hotm ? hotmStats(profile) : {},
    skills: profile.skills ? skillStats(profile) : {},
    collections: profile.collTiers ? collectionStats(profile) : {},
    level: levelStats(profile.skyblockXp ?? 0),
    slayer: profile.slayer ? slayerStats(profile.slayer) : {},
    base: BASE,
  };
  const total = Object.values(parts).reduce((sum, part) => add(sum, part), {});
  // wiki Stats: Attack Speed stops at 100
  if (total.ATTACK_SPEED > 100) total.ATTACK_SPEED = 100;
  // the damage of a weapon counts only while it is in hand
  total.DAMAGE = area === 'blaze' ? loadout.held?.lore.DAMAGE ?? 0 : 0;
  return { total, parts, gaps };
}

const FLAG_PERCENT = 5;

// One row per stat the player typed in; an empty field is no measurement.
export function compareStats(calculated, inGame) {
  return Object.entries(inGame ?? {}).filter(([, v]) => Number.isFinite(v)).map(([stat, value]) => {
    const mine = calculated[stat] ?? 0;
    const diff = mine - value;
    const percent = value ? Math.abs(diff / value) * 100 : null;
    return { stat, calculated: mine, inGame: value, diff, percent, flag: percent === null ? diff !== 0 : percent >= FLAG_PERCENT };
  });
}

// What the form hands in, as it is stored: only known stats with real numbers, and the slots as numbers.
export function statsEntry(area, { armor, equipment, pet, emptyHand, boost, values }, at) {
  const slot = (v) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null);
  const kept = AREA_STATS[area].flatMap((stat) => {
    const raw = values?.[stat];
    const n = raw === '' || raw === null || raw === undefined ? NaN : Number(raw);
    return Number.isFinite(n) ? [[stat, n]] : [];
  });
  return { choice: { armor: slot(armor), equipment: slot(equipment), pet: /^[A-Z_]+:[A-Z_]+$/.test(pet ?? '') ? pet : null, emptyHand: emptyHand === true }, values: Object.fromEntries(kept), boost: boost === true, at };
}

const AREA_TITLE = { mining: 'Mining', blaze: 'Blaze' };
const STAT_NAME = { MINING_FORTUNE: 'Mining Fortune', GEMSTONE_FORTUNE: 'Gemstone Fortune', ORE_FORTUNE: 'Ore Fortune', BLOCK_FORTUNE: 'Block Fortune', MINING_SPEED: 'Mining Speed', PRISTINE: 'Pristine', STRENGTH: 'Strength', CRITICAL_DAMAGE: 'Crit Damage', CRITICAL_CHANCE: 'Crit Chance', ATTACK_SPEED: 'Attack Speed', HEALTH: 'Health', DEFENSE: 'Defense', TRUE_DEFENSE: 'True Defense' };
const num = (v) => String(Math.round(v * 100) / 100);
const LOW = { ok: 'ok', low: 'too low', unknown: 'unknown' };

function slotPicker(kind, label, known, picked, esc) {
  const options = (known?.sets ?? []).map((n) => `<option value="${esc(n)}"${n === (picked ?? known.equipped) ? ' selected' : ''}>Slot ${esc(n)}${n === known.equipped ? ' (worn)' : ''}</option>`);
  return `<label>${label}<select data-stats-set="${kind}">${options.join('')}</select></label>`;
}

const words = (s) => String(s).toLowerCase().split('_').map((w) => (w[0]?.toUpperCase() ?? '') + w.slice(1)).join(' ');

function petPicker(pets, picked, esc) {
  const keys = [...new Set((pets ?? []).map((p) => `${p.type}:${p.tier}`))].sort();
  const active = (pets ?? []).find((p) => p.active);
  const chosen = picked ?? (active ? `${active.type}:${active.tier}` : null);
  const options = keys.map((key) => {
    const [type, tier] = key.split(':');
    return `<option value="${esc(key)}"${key === chosen ? ' selected' : ''}>${esc(words(type))} ${esc(words(tier))}</option>`;
  });
  return `<label>Pet<select data-stats-set="pet">${options.join('')}</select></label>`;
}

function areaView(area, state, items, esc) {
  const profile = state.summary;
  const entry = state.statsInput?.[area] ?? {};
  const loadout = loadoutOf(profile, items, area, entry.choice);
  const { total, gaps } = computeStats(profile, items, loadout, area);
  const rows = new Map(compareStats(total, entry.values).map((r) => [r.stat, r]));
  const stale = entry.at && entry.at < state.syncedAt;
  const boost = entry.boost ? ' · God Potion / Booster Cookie active' : '';
  const table = AREA_STATS[area].map((stat) => {
    const r = rows.get(stat);
    return `<tr${r?.flag ? ' class="stats-flag"' : ''}><th scope="row">${STAT_NAME[stat]}</th><td>${esc(num(total[stat] ?? 0))}</td><td>${r ? esc(num(r.inGame)) : ''}</td><td>${r ? `${esc(num(r.diff))}${r.percent === null ? '' : ` (${esc(num(r.percent))} %)`}${r.flag ? esc(boost) : ''}` : ''}</td></tr>`;
  }).join('');
  // no True Defense in any lore is 0, unless the inventory could not be read at all
  const limits = area === 'blaze' ? blazeConstraints(profile.missing?.inventory ? null : { TRUE_DEFENSE: total.TRUE_DEFENSE ?? 0 }, profile.mp) : null;
  return `<section class="stats-area" data-stats-area="${area}"><strong>${AREA_TITLE[area]}</strong>
    ${slotPicker('armor', 'Wardrobe slot', profile.wardrobe?.armor, entry.choice?.armor, esc)}
    ${slotPicker('equipment', 'Equipment slot', profile.wardrobe?.equipment, entry.choice?.equipment, esc)}
    ${petPicker(profile.pets, entry.choice?.pet, esc)}
    <small>Measure with the setup you actually play with. In hand: ${loadout.held ? esc(loadout.held.id) : 'nothing'}.</small>
    <label class="check"><input type="checkbox" data-stats-empty-hand${entry.choice?.emptyHand ? ' checked' : ''}> Nothing in hand when measuring</label>
    <label class="check"><input type="checkbox" data-stats-boost${entry.boost ? ' checked' : ''}> God Potion / Booster Cookie active</label>
    ${AREA_STATS[area].map((stat) => `<label>${STAT_NAME[stat]} in /stats<input type="number" step="any" inputmode="decimal" data-stats-stat="${stat}" value="${entry.values?.[stat] ?? ''}"></label>`).join('')}
    <div class="actions"><button type="button" data-stats-save>Save ${AREA_TITLE[area]} stats</button></div>
    ${stale ? '<small class="stats-stale">Your /stats values are older than the last sync.</small>' : ''}
    <table class="stats-table"><thead><tr><th scope="col">Stat</th><th scope="col">Calculated</th><th scope="col">/stats</th><th scope="col">Difference</th></tr></thead><tbody>${table}</tbody></table>
    ${area === 'blaze' ? `<small>Weapon damage from lore: ${esc(num(total.DAMAGE))}</small><small>True Defense 140: ${LOW[limits.trueDefense]} · Magical Power 800: ${LOW[limits.mp]}</small>` : ''}
    ${gaps.length ? `<ul class="stats-gaps">${gaps.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>` : ''}
  </section>`;
}

// The settings block: pick the slots, type in /stats, read the difference.
export function statsView(state, items, esc) {
  if (!state?.summary) return '<small>Sync your profile to see your stats.</small>';
  return ['mining', 'blaze'].map((area) => areaView(area, state, items, esc)).join('');
}

// What the player's stats are in a chosen setup, added up from item lore and the synced profile.
// Potions, mayor, cake, fairy souls, museum and essence perks are not readable; the /stats comparison shows them.

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

// choice: the wardrobe and equipment slot the player picked. Accessories and pet are what the sync found.
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
  const held = items ? heldOf(profile, items, area, gearStats([...armor, ...equipment])) : null;
  if (items && !held) gaps.push(area === 'mining' ? 'No mining tool found.' : 'No weapon found.');
  for (const stem of fullSets(armor)) gaps.push(`Full set ${stem}: its bonus is not counted.`);
  return { armor, equipment, held, accessories: accessoriesOf(profile, items), pet: profile.pets?.find((p) => p.active) ?? null, gaps };
}

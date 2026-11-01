// The Blaze Slayer damage model of spec 4.2: only relative values, it compares upgrades and predicts no kill time.
// Not modelled: Thunderlord, Fire Aspect, Crimson swipe, Burning Vengeance, Venomous, demon phases, pillars.
import { blazeScore } from './stats.js';

// wiki Firedust, Kindlebane, Pyrochaos, Twilight, Mawdredge and Deathripper Dagger: damage against Infernal mobs
export const DAGGERS = {
  FIREDUST_DAGGER: { line: 'ashen', m: 1.2 }, BURSTFIRE_DAGGER: { line: 'ashen', m: 1.5 }, HEARTFIRE_DAGGER: { line: 'ashen', m: 2 },
  MAWDUST_DAGGER: { line: 'spirit', m: 1.5 }, BURSTMAW_DAGGER: { line: 'spirit', m: 2.5 }, HEARTMAW_DAGGER: { line: 'spirit', m: 3.5 },
};
export const OFA = 'ultimate_one_for_all';
// wiki Enchantments
const SHARPNESS = [5, 10, 15, 20, 30, 40, 50];
// wiki Smoldering: against Infernal mobs, on all weapons. The page does not say how it stacks; additive like Sharpness is an assumption.
const SMOLDERING = [5, 10, 15, 20, 30];
const percentOf = (table, level) => (level ? table[Math.min(level, table.length) - 1] : 0);
export const ADDITIVE_ENCHANTS = new Set(['sharpness', 'smoldering']);
// wiki One For All: 500 % additive, removes all other enchants
const OFA_ADDITIVE = 500;
// wiki Crimson Armor: only the Infernal tier has damage, 10 % additive per stack, 10 stacks, from 2 pieces. Mixed sets are not described, so two Infernal pieces it is.
const DOMINUS_ADDITIVE = 100;
const DOMINUS_PIECES = 2;
const MAX_ATTACK_SPEED = 100; // wiki Attack Speed

export const dominusOf = (armorIds) => (armorIds.filter((id) => id.startsWith('INFERNAL_CRIMSON_')).length >= DOMINUS_PIECES ? DOMINUS_ADDITIVE : 0);

// The strongest dagger owned per line. A dagger missing leaves null: the pair is incomplete.
export function daggersOf(profile) {
  const out = { ashen: null, spirit: null };
  for (const item of profile.items) {
    const known = DAGGERS[item.id];
    if (known && item.where !== 'accessory' && (!out[known.line] || known.m > DAGGERS[out[known.line].id].m)) out[known.line] = item;
  }
  return out;
}

export const activePath = (daggers) => (Object.values(daggers).some((d) => d?.enchants?.[OFA]) ? 'ofa' : 'guide');

export function additiveOf(dagger, armorIds, path) {
  const enchants = dagger?.enchants ?? {};
  return (path === 'ofa' ? OFA_ADDITIVE : percentOf(SHARPNESS, enchants.sharpness) + percentOf(SMOLDERING, enchants.smoldering)) + dominusOf(armorIds);
}

// wiki Attack Speed: ticks between hits, rounded. hits per second is derived from it.
export function hitsPerSecond(attackSpeed) {
  return 20 / Math.round(10 / (1 + Math.min(attackSpeed, MAX_ATTACK_SPEED) / 100));
}

export const hitOf = (stats, additive, multiplier) => blazeScore(stats) * (1 + additive / 100) * multiplier;

const merged = (common, lore) => {
  const out = { ...common };
  for (const [k, v] of Object.entries(lore ?? {})) out[k] = (out[k] ?? 0) + v;
  return out;
};

// state: { common: stats without a weapon, daggers: { ashen, spirit }, armorIds, path }.
// Spec 4.2: perfect swapping, so the mean of both lines. Without any dagger a bare line still compares the rest.
export function blazeOutput({ common, daggers, armorIds, path }, forced = null) {
  const way = forced ?? path;
  const lines = Object.values(daggers).filter(Boolean);
  const rate = (d) => {
    const stats = merged(common, d?.lore);
    return hitOf(stats, additiveOf(d, armorIds, way), DAGGERS[d?.id]?.m ?? 1) * hitsPerSecond(stats.ATTACK_SPEED ?? 0);
  };
  return lines.length ? lines.reduce((sum, d) => sum + rate(d), 0) / lines.length : rate(null);
}

// The state of a loadout. base holds the held weapon, and that belongs to its line, not to all of them.
export function blazeState(base, loadout, daggers) {
  const common = { ...base };
  for (const [k, v] of Object.entries(loadout.held?.lore ?? {})) common[k] = (common[k] ?? 0) - v;
  delete common.DAMAGE;
  return { common, daggers, armorIds: loadout.armor.map((i) => i.id), path: activePath(daggers) };
}

// A profile worked out of the ticks, in the shape of profile.js, so the ranking runs without a sync. Pure functions.
import { AREA_STATS } from './stats.js';
import { daggersOf, DAGGERS } from './blaze.js';
import { idsToOwn } from './owned.js';
import { GEM_SHARED_SLOTS, PARTS, POLARVOID } from './optimizer-data.js';

const QUALITY = ['ROUGH', 'FLAWED', 'FINE', 'FLAWLESS', 'PERFECT'];
const TOOLS = new Set(['DRILL', 'PICKAXE', 'GAUNTLET']);
const ARMOR = ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'];
const EQUIPMENT = ['NECKLACE', 'CLOAK', 'BELT', 'GLOVES', 'BRACELET'];
const PET_TOP_XP = 1e9;

const pieceOf = (id, items) => ({ id, where: items?.[id]?.category === 'ACCESSORY' ? 'accessory' : 'inventory', gems: [], enchants: {}, parts: {}, reforge: null, recomb: false, polarvoid: 0, coating: false, scrolls: [], lore: { ...items?.[id]?.stats } });
const slotsOf = (d, guide) => (typeof d.on === 'string' ? guide.groups?.[d.on] : d.on) ?? [];

// The piece a step works on, per slot: the highest rung owned. A piece not owned gets nothing.
// shortcut: an enchant ticked before its item is not carried onto the item later; tick the item first if that shows.
function targets(d, guide, profile) {
  return slotsOf(d, guide).flatMap((ids) => {
    const id = [...ids].reverse().find((one) => profile.items.some((i) => i.id === one));
    return id ? [profile.items.find((i) => i.id === id)] : [];
  });
}

// An upgraded tool keeps what sits on it. Armor is a new piece.
function addPiece(profile, id, items) {
  const category = items?.[id]?.category;
  const old = TOOLS.has(category) ? [...profile.items].reverse().find((i) => items?.[i.id]?.category === category) : null;
  profile.items.push(old ? { ...structuredClone(old), id, lore: { ...items[id].stats } } : pieceOf(id, items));
}

function addGems(d, guide, profile, items) {
  if (!d.type) return;
  const list = targets(d, guide, profile);
  const rank = (q) => QUALITY.indexOf(q);
  const reached = list.flatMap((t) => (t.gems ??= [])).filter((g) => g.type === d.type && rank(g.quality) >= rank(d.quality)).length;
  let left = (d.need ?? list.length) - reached;
  for (const t of list) {
    for (const g of t.gems) if (left > 0 && g.type === d.type && rank(g.quality) < rank(d.quality)) { g.quality = d.quality; left--; }
    const seen = {};
    for (const { slot_type: type } of items?.[t.id]?.gemstone_slots ?? []) {
      const slot = `${type}_${seen[type] = (seen[type] ?? -1) + 1}`;
      if (left > 0 && (type === d.type || GEM_SHARED_SLOTS[d.type]?.includes(type)) && !t.gems.some((g) => g.slot === slot)) { t.gems.push({ type: d.type, quality: d.quality, slot }); left--; }
    }
  }
}

function applyPart(p, d, guide, items) {
  const on = () => targets(d, guide, p).slice(0, d.need ?? Infinity);
  switch (d.kind) {
    case 'owned': for (const id of idsToOwn({ detect: d }, guide, new Set(p.items.map((i) => i.id)))) addPiece(p, id, items); break;
    case 'enchant': for (const t of on()) t.enchants[d.enchant] = Math.max(t.enchants[d.enchant] ?? 0, d.level); break;
    case 'gem': addGems(d, guide, p, items); break;
    case 'reforge': for (const t of on()) if (!d.value.includes(t.reforge)) t.reforge = d.value[0]; break;
    case 'recomb': for (const t of on()) t.recomb = true; break;
    case 'coating': for (const t of on()) t.coating = true; break;
    case 'polarvoid': for (const t of on()) t.polarvoid = Math.max(t.polarvoid ?? 0, Math.min(d.need ?? POLARVOID.max, POLARVOID.max)); break;
    case 'scroll': for (const t of targets(d, guide, p)) if (!(t.scrolls ??= []).includes(d.value)) t.scrolls.push(d.value); break;
    case 'part': for (const t of targets(d, guide, p)) if (PARTS[d.ids[0]]) t.parts[PARTS[d.ids[0]].kind] = d.ids[0]; break;
    case 'pet':
      p.pets ??= [];
      for (const pet of p.pets) pet.active = false;
      p.pets = [...p.pets.filter((pet) => pet.type !== d.types[0]), { type: d.types[0], tier: d.tier ?? 'LEGENDARY', exp: PET_TOP_XP, active: true }];
      break;
    case 'attr': if (p.attrs) p.attrs[d.attr] = Math.max(p.attrs[d.attr] ?? 0, d.need); break;
    case 'power': p.selectedPower = d.value; break;
    case 'perk':
      if (p.hotm) p.hotm.nodes[d.perk] = Math.max(p.hotm.nodes?.[d.perk] ?? 0, d.level);
      if (p.perks) p.perks[d.perk] = Math.max(p.perks[d.perk] ?? 0, d.level);
      break;
    default: // held, coll, skill: nothing the ranking reads
  }
}

// The profile with a step done. The one handed in stays as it is.
export function applyStep(profile, step, guide, items) {
  const next = structuredClone(profile);
  for (const d of [step.detect ?? []].flat()) applyPart(next, d, guide, items);
  return next;
}

// mp: typed in by the player, null when not known. Item ticks come first, so what the marks put on a piece finds it.
export function virtualProfile(guide, marks, owned, items, mp = null) {
  let profile = { items: [...owned].map((id) => pieceOf(id, items)), pets: [], hotm: { experience: 0, nodes: {} }, perks: {}, attrs: {}, mp, selectedPower: null, skills: null, collTiers: null, slayer: null, wardrobe: null, missing: { inventory: false }, virtual: true };
  for (const section of guide.sections) {
    for (const step of section.steps) if (marks.has(`${section.name}|${step.text}`)) profile = applyStep(profile, step, guide, items);
  }
  return profile;
}

const strength = (piece, items, area) => AREA_STATS[area].reduce((sum, stat) => sum + (items?.[piece.id]?.stats?.[stat] ?? 0), 0);

// Per kind the strongest piece: the setup the typed-in /stats are taken to be measured in.
export function virtualLoadout(profile, items, area) {
  const best = (categories) => categories.flatMap((category) => {
    const list = profile.items.filter((i) => items?.[i.id]?.category === category && !DAGGERS[i.id]);
    return list.length ? [list.reduce((a, b) => (strength(b, items, area) >= strength(a, items, area) ? b : a))] : [];
  });
  const tools = area === 'mining' ? best([...TOOLS]) : [];
  return {
    armor: best(ARMOR), equipment: best(EQUIPMENT),
    held: tools.length ? tools.reduce((a, b) => (strength(b, items, area) >= strength(a, items, area) ? b : a)) : null,
    accessories: profile.items.filter((i) => items?.[i.id]?.category === 'ACCESSORY'),
    pet: profile.pets.find((p) => p.active) ?? null, gaps: [],
    ...(area === 'blaze' && { daggers: daggersOf(profile) }),
  };
}

// Keys of what was done after the stats were saved, oldest first. A stamp of 0 is older than the app, no date means no stats to follow.
export const doneSince = (stamps, at) => (at ? Object.entries(stamps ?? {}).filter(([, when]) => when > at).sort((a, b) => a[1] - b[1]).map(([key]) => key) : []);

export function baseStats(typed, deltas) {
  const out = { ...typed };
  for (const delta of deltas) for (const [stat, v] of Object.entries(delta)) out[stat] = (out[stat] ?? 0) + v;
  return out;
}

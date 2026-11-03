// Which guide steps a synced profile already fulfils. A step's detect says what to look for, a guide's groups name
// the item slots it looks in. No detect, or data the profile lacks, means no answer; the step stays manual.
const QUALITY = ['ROUGH', 'FLAWED', 'FINE', 'FLAWLESS', 'PERFECT'];
const TIER = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'];
const atLeast = (order, have, want) => order.indexOf(have) >= order.indexOf(want);

const VALUE = {
  owned: () => 1,
  enchant: (i, d) => ((i.enchants?.[d.enchant] ?? 0) >= d.level ? 1 : 0),
  reforge: (i, d) => (d.value.includes(String(i.reforge).toLowerCase()) ? 1 : 0),
  recomb: (i) => (i.recomb ? 1 : 0),
  coating: (i) => (i.coating ? 1 : 0),
  polarvoid: (i) => i.polarvoid ?? 0,
  scroll: (i, d) => ((i.scrolls ?? []).includes(d.value) ? 1 : 0),
  // a drill part sits on the drill; part kinds are handled where the loose item counts too
  part: (i, d) => (Object.values(i.parts ?? {}).some((p) => d.ids.includes(String(p).toUpperCase())) ? 1 : 0),
  gem: (i, d) => (i.gems ?? []).filter((g) => (!d.type || g.type === d.type) && atLeast(QUALITY, g.quality, d.quality)).length,
};

// A guide can come from a file, so a rule only counts in full: a broken one leaves the step manual.
const text = (v) => typeof v === 'string' && v.length > 0;
const texts = (v) => Array.isArray(v) && v.every(text);
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const slots = (v) => text(v) || (Array.isArray(v) && v.every(texts));
const NEEDS = {
  owned: { on: slots }, recomb: { on: slots }, coating: { on: slots }, polarvoid: { on: slots },
  enchant: { on: slots, enchant: text, level: num }, reforge: { on: slots, value: texts }, scroll: { on: slots, value: text },
  part: { on: slots, ids: texts }, gem: { on: slots, quality: text }, pet: { types: texts }, held: { item: text },
  perk: { perk: text, level: num }, essence: { perk: text, level: num }, petItem: { types: texts, item: text }, power: { value: text }, attr: { attr: text, need: num }, coll: { id: text, tier: num }, skill: { skill: text, xp: num },
};
const OPTIONAL = { need: num, type: text, tier: text, slot: text };

function validPart(d) {
  const needs = Object.hasOwn(NEEDS, d?.kind) ? NEEDS[d.kind] : null;
  if (!needs || !Object.entries(needs).every(([k, ok]) => ok(d[k]))) return null;
  const out = { kind: d.kind };
  for (const k of Object.keys(needs)) out[k] = d[k];
  for (const [k, ok] of Object.entries(OPTIONAL)) if (ok(d[k])) out[k] = d[k];
  return out;
}

export function validDetect(d) {
  if (!Array.isArray(d)) return validPart(d);
  const parts = d.map(validPart);
  return parts.length && !parts.includes(null) ? parts : null;
}

export function validGroups(g) {
  if (!g || typeof g !== 'object' || Array.isArray(g)) return null;
  const entries = Object.entries(g).filter(([, v]) => Array.isArray(v) && v.every(texts));
  return entries.length ? Object.fromEntries(entries) : null;
}

// Each group is one slot: its best item counts, so a spare piece never stands in for another slot.
function itemPart(d, profile, groups) {
  // Inventory API off and nothing kept from before: that says nothing about what is owned.
  if (profile.missing?.inventory && !profile.items.length) return null;
  const slots = typeof d.on === 'string' ? groups?.[d.on] : d.on;
  if (!Array.isArray(slots)) return null;
  const value = VALUE[d.kind];
  let have = 0;
  for (const ids of slots) {
    const found = profile.items.filter((i) => ids.includes(i.id)).map((i) => value(i, d));
    have += found.length ? Math.max(...found) : 0;
  }
  if (d.kind === 'part' && profile.items.some((i) => d.ids.includes(i.id))) have = 1;
  const need = d.need ?? slots.length;
  return { have: Math.min(have, need), need };
}

function dataPart(d, profile) {
  const flag = (ok) => ({ have: ok ? 1 : 0, need: 1 });
  switch (d.kind) {
    case 'pet': return flag(profile.pets?.some((p) => d.types.includes(p.type) && atLeast(TIER, p.tier, d.tier ?? 'COMMON')));
    case 'held': return flag(profile.pets?.some((p) => p.heldItem === d.item));
    case 'petItem': return profile.pets ? flag(profile.pets.some((p) => d.types.includes(p.type) && p.heldItem === d.item)) : null;
    case 'essence': return profile.perks ? { have: Math.min(profile.perks[d.perk] ?? 0, d.level), need: d.level } : null;
    case 'perk': return profile.perks ? flag((profile.perks[d.perk] ?? 0) >= d.level) : null;
    case 'power': return profile.powers ? flag(profile.powers.includes(d.value)) : null;
    case 'attr': return profile.attrs ? { have: Math.min(profile.attrs[d.attr] ?? 0, d.need), need: d.need } : null;
    case 'coll': return profile.collTiers ? flag(profile.collTiers.includes(`${d.id}_${d.tier}`)) : null;
    case 'skill': return profile.skills ? flag((profile.skills[d.skill] ?? 0) >= d.xp) : null;
    default: return null;
  }
}

// One step: { have, need }, or null when there is nothing to say about it.
export function detectStep(step, profile, groups) {
  if (!step.detect || !profile) return null;
  const parts = [step.detect].flat().map((d) => (VALUE[d.kind] ? itemPart(d, profile, groups) : dataPart(d, profile)));
  if (!parts.length || parts.includes(null)) return null;
  return { have: parts.reduce((n, p) => n + p.have, 0), need: parts.reduce((n, p) => n + p.need, 0) };
}

// All steps of a guide by key. Anything found of a later step in a slot settles the earlier steps of that slot, also
// across lines: nobody goes back to worse gear once better is on hand.
export function detectGuide(guide, profile, keyOf) {
  const out = new Map();
  const reached = new Set();
  for (const section of [...guide.sections].reverse()) {
    for (const step of [...section.steps].reverse()) {
      const found = detectStep(step, profile, guide.groups);
      if (!found) continue;
      const slot = [step.detect].flat().find((d) => d.slot)?.slot;
      if (slot && reached.has(slot)) found.have = found.need;
      if (slot && found.have) reached.add(slot);
      out.set(keyOf(section, step), found);
    }
  }
  return out;
}

// The detection report: what the profile shows for each rule of a step. detectStep stays the judge of have and need;
// this only says which piece or entry it looked at, so a wrong tick can be traced.
const PET_RULES = { pet: (p, d) => d.types.includes(p.type), held: (p, d) => p.heldItem === d.item, petItem: (p, d) => d.types.includes(p.type) };
const DATA_VALUE = {
  essence: (p, d) => p.perks?.[d.perk] ?? 0, perk: (p, d) => p.perks?.[d.perk] ?? 0, attr: (p, d) => p.attrs?.[d.attr] ?? 0, skill: (p, d) => p.skills?.[d.skill] ?? 0,
  power: (p, d) => !!p.powers?.includes(d.value), coll: (p, d) => !!p.collTiers?.includes(`${d.id}_${d.tier}`),
};

function explainPart(d, profile, groups) {
  const found = VALUE[d.kind] ? itemPart(d, profile, groups) : dataPart(d, profile);
  if (!found) return null;
  const out = { rule: d, ...found };
  if (VALUE[d.kind]) {
    const value = VALUE[d.kind];
    out.slots = (typeof d.on === 'string' ? groups[d.on] : d.on).map((ids) => {
      const best = profile.items.filter((i) => ids.includes(i.id)).reduce((b, i) => (!b || value(i, d) > value(b, d) ? i : b), null);
      return { ids, item: best, value: best ? value(best, d) : 0 };
    });
    if (d.kind === 'part') out.loose = profile.items.find((i) => d.ids.includes(i.id)) ?? null;
  } else if (PET_RULES[d.kind]) out.pets = (profile.pets ?? []).filter((p) => PET_RULES[d.kind](p, d));
  else out.value = DATA_VALUE[d.kind](profile, d);
  return out;
}

// By key, as detectGuide walks: { have, need, parts, by }. by: the later step of the same slot that settled this one.
export function explainGuide(guide, profile, keyOf) {
  const out = new Map();
  const reached = new Map();
  for (const section of [...guide.sections].reverse()) {
    for (const step of [...section.steps].reverse()) {
      if (!step.detect || !profile) continue;
      const parts = [step.detect].flat().map((d) => explainPart(d, profile, guide.groups));
      if (!parts.length || parts.includes(null)) continue;
      const entry = { have: parts.reduce((n, p) => n + p.have, 0), need: parts.reduce((n, p) => n + p.need, 0), parts, by: null };
      const slot = [step.detect].flat().find((d) => d.slot)?.slot;
      if (slot && reached.has(slot)) { entry.by = reached.get(slot); entry.have = entry.need; }
      if (slot && entry.have && !reached.has(slot)) reached.set(slot, step.text);
      out.set(keyOf(section, step), entry);
    }
  }
  return out;
}

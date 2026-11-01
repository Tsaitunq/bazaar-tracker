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

// Each group is one slot: its best item counts, so a spare piece never stands in for another slot.
function itemPart(d, profile, groups) {
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

// All steps of a guide by key. In a line marked ladder, a later rung that is met settles the earlier ones.
export function detectGuide(guide, profile, keyOf) {
  const out = new Map();
  const reached = new Set();
  for (const section of [...guide.sections].reverse()) {
    for (const step of [...section.steps].reverse()) {
      const found = detectStep(step, profile, guide.groups);
      const ladder = step.line && [step.detect].flat()[0]?.ladder;
      if (found && found.have < found.need && ladder && reached.has(step.line)) found.have = found.need;
      if (found && found.have >= found.need && ladder) reached.add(step.line);
      if (found) out.set(keyOf(section, step), found);
    }
  }
  return out;
}

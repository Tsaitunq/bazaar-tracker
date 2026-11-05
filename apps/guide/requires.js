// Can the player use this step's items yet? Reads item requirements against the synced profile.
// locked needs proof: what cannot be read stays unknown, so a step never disappears because an API is off.

// wiki Heart of the Mountain, cumulative. Tier 1 needs no experience.
export const HOTM_XP = [0, 3000, 12000, 37000, 97000, 197000, 347000, 557000, 847000, 1247000];
// wiki Skills, cumulative, level 1 to 60 (not Runecrafting, Social, Dungeoneering)
export const SKILL_XP = [50, 175, 375, 675, 1175, 1925, 2925, 4425, 6425, 9925, 14925, 22425, 32425, 47425, 67425, 97425, 147425, 222425, 322425, 522425, 822425, 1222425, 1722425, 2322425, 3022425, 3822425, 4722425, 5722425, 6822425, 8022425, 9322425, 10722425, 12222425, 13822425, 15522425, 17322425, 19222425, 21222425, 23322425, 25522425, 27822425, 30222425, 32722425, 35322425, 38072425, 40972425, 44072425, 47472425, 51172425, 55172425, 59472425, 64072425, 68972425, 74172425, 79672425, 85472425, 91572425, 97972425, 104672425, 111672425];
// wiki Slayer: the table merges equal cells, so enderman and blaze read as wolf. It does not say the values are cumulative, NEU reads them so: not confirmed.
const WOLF = [10, 30, 250, 1500, 5000, 20000, 100000, 400000, 1000000];
export const SLAYER_XP = { zombie: [5, 15, 200, 1000, 5000, 20000, 100000, 400000, 1000000], spider: [5, 25, 200, 1000, 5000, 20000, 100000, 400000, 1000000], wolf: WOLF, enderman: WOLF, blaze: WOLF, vampire: [20, 75, 240, 840, 2400] };
const SLAYER_NAME = { zombie: 'Revenant', spider: 'Tarantula', wolf: 'Sven', enderman: 'Voidgloom', blaze: 'Blaze', vampire: 'Vampire' };
const OWN_TABLE = new Set(['RUNECRAFTING', 'SOCIAL']);

// How many steps of a cumulative table this much experience has reached.
export const levelOf = (table, xp) => table.filter((need) => xp >= need).length;

const title = (s) => String(s).toLowerCase().split('_').map((w) => (w[0]?.toUpperCase() ?? '') + w.slice(1)).join(' ');
const UNKNOWN = { status: 'unknown' };
const OK = { status: 'ok' };
const locked = (reason) => ({ status: 'locked', reason });

function checkOne(req, p) {
  switch (req.type) {
    case 'HEART_OF_THE_MOUNTAIN': {
      if (!p.hotm) return UNKNOWN;
      const have = levelOf(HOTM_XP, p.hotm.experience ?? 0);
      return have >= req.tier ? OK : locked(`HOTM ${req.tier} needed, you have ${have}`);
    }
    case 'SKILL': {
      if (!p.skills || OWN_TABLE.has(req.skill)) return UNKNOWN;
      const have = levelOf(SKILL_XP, p.skills[`SKILL_${req.skill}`] ?? 0);
      return have >= req.level ? OK : locked(`${title(req.skill)} ${req.level} needed, you have ${have}`);
    }
    case 'SLAYER': {
      const table = SLAYER_XP[req.slayer_boss_type];
      if (!table || !p.slayer) return UNKNOWN;
      const have = levelOf(table, p.slayer[req.slayer_boss_type] ?? 0);
      return have >= req.level ? OK : locked(`${SLAYER_NAME[req.slayer_boss_type]} Slayer ${req.level} needed, you have ${have}`);
    }
    case 'KUUDRA_COMPLETION':
      if (!p.kuudra) return UNKNOWN;
      return p.kuudra[String(req.kuudra_tier).toLowerCase()] > 0 ? OK : locked(`Kuudra ${title(req.kuudra_tier)} needed`);
    case 'COLLECTION':
      if (!p.collTiers) return UNKNOWN;
      return p.collTiers.includes(`${req.collection}_${req.tier}`) ? OK : locked(`Collection ${title(req.collection)} ${req.tier} needed`);
    case 'ANY_OF':
    case 'ONE_OF': {
      const all = (req.requirements ?? []).map((r) => checkOne(r, p));
      if (all.some((r) => r.status === 'ok')) return OK;
      if (!all.length || all.some((r) => r.status === 'unknown')) return UNKNOWN;
      return locked(all.map((r) => r.reason).join(' or '));
    }
    default:
      return UNKNOWN;
  }
}

const merge = (results) => ({
  status: results.some((r) => r.status === 'locked') ? 'locked' : results.some((r) => r.status === 'unknown') ? 'unknown' : 'ok',
  reasons: [...new Set(results.filter((r) => r.status === 'locked').flatMap((r) => r.reasons))],
});

const checkId = (id, items, profile) => merge((items[id]?.requirements ?? []).map((req) => {
  const r = checkOne(req, profile);
  return { status: r.status, reasons: r.reason ? [r.reason] : [] };
}));

// One line of a guide step: an anyOf item is open as long as one of its choices is.
function checkLine(line, items, profile) {
  if (!line.anyOf) return line.id ? checkId(line.id, items, profile) : merge([]);
  const all = line.anyOf.map((id) => checkId(id, items, profile));
  if (all.some((r) => r.status === 'ok')) return merge([]);
  return merge(all.some((r) => r.status === 'unknown') ? all.filter((r) => r.status === 'unknown') : all);
}

export function checkStep(step, items, profile) {
  if (!items || !profile) return { status: 'unknown', reasons: [] };
  return merge((step.items ?? []).map((line) => checkLine(line, items, profile)));
}

// What the build alone can prove: the HOTM tier typed in the editor (null = unknown = never locked).
// Skills, slayers and collections cannot be read from a build, so they stay unknown.
export function lockProfile(build) {
  const tier = build?.hotm?.tier;
  return Number.isInteger(tier) && tier >= 1 && tier <= 10 ? { hotm: { experience: HOTM_XP[tier - 1] } } : null;
}

export const lockedByBuild = (step, items, build) => checkStep(step, items, lockProfile(build));

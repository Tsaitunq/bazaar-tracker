// Loads and checks the game data in gamedata/*.json (stats, HOTM, attributes, power, pets). A broken file throws with a path to the fault.
export const FILES = ['stats', 'hotm', 'attributes', 'power', 'pets', 'essence-perks'];
const AREAS = new Set(['mining', 'combat', 'farming', 'general']);
// the /stats menu category of a stat (scripts/gamedata-categories.mjs); Nether Embodiment multiplies combat and misc
const CATEGORIES = new Set(['combat', 'misc', 'wisdom', 'mining', 'farming', 'foraging', 'fishing', 'hunting']);
const RARITIES = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'];
export const EFFECT_KINDS = ['flat', 'per_stat', 'conditional', 'chance', 'other'];
const POWDERS = new Set(['mithril', 'gemstone', 'glacite']);
const TYPES = new Set(['perk', 'ability', 'core']);
const HEX = /^#[0-9A-Fa-f]{6}$/;

const fail = (where, msg) => { throw new Error(`gamedata ${where}: ${msg}`); };
const need = (where, o, keys) => { for (const k of keys) if (o?.[k] === undefined) fail(where, `missing "${k}"`); };
const unique = (where, ids) => { const seen = new Set(); for (const id of ids) { if (seen.has(id)) fail(where, `duplicate id ${id}`); seen.add(id); } };

export function checkStats(d) {
  need('stats', d, ['stats']);
  unique('stats', d.stats.map((s) => s.id));
  for (const s of d.stats) {
    const w = `stats.${s.id}`;
    need(w, s, ['id', 'name', 'areas', 'category', 'unit', 'percent', 'src']);
    if (!CATEGORIES.has(s.category)) fail(w, `bad category ${s.category}`);
    if (!/^[A-Z_]+$/.test(s.id)) fail(w, 'id must be UPPER_SNAKE');
    if (!s.areas.length || s.areas.some((a) => !AREAS.has(a))) fail(w, 'bad areas');
    if (s.icon === null || s.color === null) { if (!s.unknown) fail(w, 'null icon/color needs unknown:true'); } else if (!HEX.test(s.color)) fail(w, 'bad colour');
  }
  return new Set(d.stats.map((s) => s.id));
}

const checkEffect = (w, e, stats) => {
  need(w, e, ['stat', 'cond']);
  if (!stats.has(e.stat)) fail(w, `unknown stat ${e.stat}`);
};

const checkCost = (w, p) => {
  const c = p.cost;
  if (c === undefined || (c === null && !p.unknown)) fail(w, 'cost missing (null needs unknown:true)');
  if (c === null) return;
  if (c.kind === 'none') return;
  if (c.kind === 'table') {
    if (p.type !== 'core' || p.levels?.length !== p.maxLevel) fail(w, 'table cost needs a levels entry per level');
    for (const l of p.levels) if (l.cost && (!POWDERS.has(l.cost.powder) || !(l.cost.amount > 0))) fail(w, `bad core cost at level ${l.level}`);
    return;
  }
  if (!POWDERS.has(c.powder) || !(c.exp > 0) || !(c.offset > 0)) fail(w, 'cost needs powder, exp and offset');
};

export function checkHotm(d, stats) {
  need('hotm', d, ['tiers', 'perks']);
  unique('hotm', d.perks.map((p) => p.id));
  if (d.tiers.length !== 10) fail('hotm', 'need 10 tiers');
  if (d.omelette?.maxLevelBonus !== 1) fail('hotm', 'omelette.maxLevelBonus must be 1');
  const byId = new Map(d.perks.map((p) => [p.id, p]));
  const cell = new Set();
  for (const p of d.perks) {
    const w = `hotm.${p.id}`;
    need(w, p, ['id', 'name', 'tier', 'col', 'row', 'type', 'maxLevel', 'effects', 'neighbors', 'requiresTier']);
    if (!TYPES.has(p.type)) fail(w, `bad type ${p.type}`);
    if (p.tier < 1 || p.tier > 10 || p.tier !== 10 - p.row) fail(w, 'tier must be 10 - row');
    if (p.requiresTier !== p.tier) fail(w, 'requiresTier must equal tier');
    const key = `${p.col},${p.row}`;
    if (cell.has(key)) fail(w, `grid cell ${key} used twice`);
    cell.add(key);
    if (p.wikiAlt !== undefined || p.powder !== undefined) fail(w, 'wikiAlt/powder are gone: the wiki is the source, powder lives in cost');
    checkCost(w, p);
    for (const e of [...p.effects, ...(p.activeEffects ?? [])]) checkEffect(w, e, stats);
    for (const o of p.otherEffects ?? []) need(w, o, ['key', 'unit', 'a', 'b', 'cond']);
    if (p.omeletteBonus && p.maxLevel < 2) fail(w, 'omeletteBonus on a one-level perk');
    for (const r of p.requires ?? []) if (!p.neighbors.includes(r)) fail(w, `requires ${r}, which is not a direct neighbour`);
    for (const n of p.neighbors) {
      const o = byId.get(n);
      if (!o) fail(w, `neighbour ${n} does not exist`);
      if (Math.abs(o.col - p.col) + Math.abs(o.row - p.row) !== 1) fail(w, `neighbour ${n} is not horizontal/vertical`);
      if (!o.neighbors.includes(p.id)) fail(w, `connection to ${n} is not symmetric`);
    }
  }
}

export function checkAttributes(d, stats) {
  need('attributes', d, ['shardsPerLevel', 'attributes']);
  for (const r of RARITIES) if (d.shardsPerLevel[r]?.length !== 10) fail('attributes', `shardsPerLevel.${r} needs 10 levels`);
  unique('attributes', d.attributes.map((a) => a.id));
  for (const a of d.attributes) {
    const w = `attributes.${a.id}`;
    need(w, a, ['id', 'shard', 'name', 'rarity', 'maxLevel', 'effects', 'areas', 'icon']);
    if (!RARITIES.includes(a.rarity)) fail(w, `bad rarity ${a.rarity}`);
    if (!EFFECT_KINDS.includes(a.effectKind)) fail(w, `effectKind must be one of ${EFFECT_KINDS.join(', ')}`);
    if (!a.effects.length && !a.desc && !a.note && !a.unknown) fail(w, 'no effect, no desc and not marked unknown');
    if (['flat', 'per_stat'].includes(a.effectKind) && !a.effects.length) fail(w, `${a.effectKind} needs effects`);
    if (a.desc && !(a.desc.text?.includes('{v}') && a.desc.perLevel > 0) && typeof a.desc.level1 !== 'string') fail(w, 'desc needs perLevel and a text with {v}, or level1');
    if (a.mcIcon !== undefined && !/^[a-z_]+$/.test(a.mcIcon)) fail(w, 'bad mcIcon');
    for (const e of a.effects) {
      checkEffect(w, e, stats);
      if (e.kind === 'per_stat') {
        if (!stats.has(e.per?.stat) || typeof e.value !== 'number') fail(w, 'per_stat needs value and a known per.stat');
      } else if ((e.perLevel === undefined) === (e.fixed === undefined)) fail(w, 'effect needs exactly one of perLevel/fixed');
    }
  }
}

export function checkPower(d, stats) {
  need('power', d, ['multiplier', 'accessoryPower', 'powerStones', 'tuning', 'boosterCookie', 'godPotion']);
  for (const p of d.powerStones) {
    const w = `power.${p.id}`;
    need(w, p, ['id', 'power', 'base', 'uniqueBonus']);
    for (const s of [...Object.keys(p.base), ...Object.keys(p.uniqueBonus)]) if (!stats.has(s)) fail(w, `unknown stat ${s}`);
  }
  for (const t of d.tuning.stats) {
    if (!stats.has(t.stat)) fail('power.tuning', `unknown stat ${t.stat}`);
    if (t.perPoint === null && !t.unknown) fail('power.tuning', `${t.stat} null needs unknown:true`);
  }
  for (const e of d.boosterCookie.effects) if (!stats.has(e.stat)) fail('power.boosterCookie', `unknown stat ${e.stat}`);
}

// A pet is one entry per id and rarity. stats are always on; a perk with a condition is only shown.
export function checkPets(d, stats) {
  need('pets', d, ['pets']);
  unique('pets', d.pets.map((p) => `${p.id}:${p.rarity}`));
  for (const p of d.pets) {
    const w = `pets.${p.id}:${p.rarity}`;
    need(w, p, ['id', 'name', 'rarity', 'level', 'stats', 'perks']);
    if (!RARITIES.includes(p.rarity)) fail(w, `bad rarity ${p.rarity}`);
    for (const [s, v] of Object.entries(p.stats)) if (!stats.has(s) || typeof v !== 'number') fail(w, `bad stat ${s}`);
    for (const k of p.perks) {
      need(`${w}.${k.name}`, k, ['name', 'text']);
      if (k.stat !== undefined && (!stats.has(k.stat) || typeof k.value !== 'number')) fail(`${w}.${k.name}`, 'stat needs a known stat and a number value');
      if (k.effect !== undefined) checkPerkEffect(`${w}.${k.name}`, k.effect);
    }
  }
  unique('pets.items', (d.items ?? []).map((i) => i.id));
  for (const i of d.items ?? []) {
    need(`pets.items.${i.id}`, i, ['id', 'name', 'stats']);
    for (const [s, v] of Object.entries(i.stats)) if (!stats.has(s) || typeof v !== 'number') fail(`pets.items.${i.id}`, `bad stat ${s}`);
  }
}

// The essence shop: every perk has a cost per level; an effect adds a stat, a conditional is only described.
export function checkEssence(d, stats) {
  need('essence', d, ['perks']);
  unique('essence', d.perks.map((p) => p.id));
  for (const p of d.perks) {
    const w = `essence.${p.id}`;
    need(w, p, ['id', 'name', 'essence', 'bazaar', 'max', 'costs']);
    if (p.bazaar !== `ESSENCE_${p.essence}`) fail(w, 'bazaar id must be ESSENCE_<essence>');
    if (p.costs.length !== p.max || !p.costs.every((c) => c > 0)) fail(w, 'needs one positive cost per level');
    if ((p.effect === undefined) === (p.conditional === undefined)) fail(w, 'needs exactly one of effect/conditional');
    const stat = (p.effect ?? p.conditional).stat;
    if (!stats.has(stat)) fail(w, `unknown stat ${stat}`);
    if (p.effect && !(p.effect.perLevel > 0)) fail(w, 'effect needs perLevel');
    if (p.conditional && !p.conditional.text) fail(w, 'conditional needs text');
  }
}

// An effect the stats model computes (not a stat that is simply added). percent is the value at Level 100.
const PERK_EFFECTS = {
  category_multiplier: (w, e) => { if (!Array.isArray(e.categories) || !e.categories.length || !(e.percent > 0)) fail(w, 'category_multiplier needs categories and percent'); },
  set_multiplier: (w, e) => { if (typeof e.family !== 'string' || !(e.percent > 0)) fail(w, 'set_multiplier needs family and percent'); },
  potato_multiplier: (w, e) => { if (!(e.factor > 1)) fail(w, 'potato_multiplier needs a factor above 1'); },
};
function checkPerkEffect(w, e) {
  if (!PERK_EFFECTS[e?.kind]) fail(w, `unknown effect kind ${e?.kind}`);
  PERK_EFFECTS[e.kind](w, e);
}

// The one place that evaluates an effect formula: a + b·L, plus a step every stepEvery levels, rounded down on floor, capped on cap.
// Level 0 gives nothing. Everything that adds up perk values calls this.
export function valueAt(e, level) {
  if (!(level > 0)) return 0;
  let v = e.a + e.b * level + (e.stepEvery ? Math.floor(level / e.stepEvery) * e.stepAdd : 0);
  if (e.floor) v = Math.floor(v);
  return e.cap === undefined ? v : Math.min(v, e.cap);
}

// read: (name) -> parsed JSON (or a promise of it).
export async function loadGameData(read) {
  const [stats, hotm, attributes, power, pets, essence] = await Promise.all(FILES.map((f) => read(f)));
  const ids = checkStats(stats);
  checkHotm(hotm, ids);
  checkAttributes(attributes, ids);
  checkPower(power, ids);
  checkPets(pets, ids);
  checkEssence(essence, ids);
  return { stats, hotm, attributes, power, pets, essence };
}

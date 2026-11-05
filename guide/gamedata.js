// Loads and checks the game data in gamedata/*.json (stats, HOTM, attributes, power, pets). A broken file throws with a path to the fault.
export const FILES = ['stats', 'hotm', 'attributes', 'power', 'pets'];
const AREAS = new Set(['mining', 'combat', 'farming', 'general']);
// the /stats menu category of a stat (scripts/gamedata-categories.mjs); Nether Embodiment multiplies combat and misc
const CATEGORIES = new Set(['combat', 'misc', 'wisdom', 'mining', 'farming', 'foraging', 'fishing', 'hunting']);
const RARITIES = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'];
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
    if (!a.effects.length && !a.unknown && a.effectKind !== 'other') fail(w, 'no effect and not marked unknown/other');
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
    }
  }
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
  const [stats, hotm, attributes, power, pets] = await Promise.all(FILES.map((f) => read(f)));
  const ids = checkStats(stats);
  checkHotm(hotm, ids);
  checkAttributes(attributes, ids);
  checkPower(power, ids);
  checkPets(pets, ids);
  return { stats, hotm, attributes, power, pets };
}

// Loads and checks the game data in gamedata/*.json (stats, HOTM, attributes, power, pets). A broken file throws with a path to the fault.
export const FILES = ['stats', 'hotm', 'attributes', 'power', 'pets', 'essence-perks', 'stat-sources'];
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
  if (d.leveling !== undefined) {
    const l = d.leveling;
    if (!Array.isArray(l.levels) || !l.levels.every((n) => Number.isFinite(n) && n > 0)) fail('pets.leveling', 'levels must be positive numbers');
    for (const r of RARITIES) if (!Number.isInteger(l.rarityOffset?.[r]) || l.rarityOffset[r] + 99 > l.levels.length) fail('pets.leveling', `bad rarityOffset ${r}`);
  }
  unique('pets.items', (d.items ?? []).map((i) => i.id));
  for (const i of d.items ?? []) {
    need(`pets.items.${i.id}`, i, ['id', 'name', 'stats']);
    for (const [s, v] of Object.entries(i.stats)) if (!stats.has(s) || typeof v !== 'number') fail(`pets.items.${i.id}`, `bad stat ${s}`);
  }
}

// The level of a pet from its experience: the table of its rarity (from its offset, 99 steps to level 100), plus the steps after
// 100 of a pet that goes higher. Gives { level, max, toNext } or null without the table. toNext is the experience still missing.
export function petLevel(exp, rarity, type, leveling) {
  const offset = leveling?.custom?.[type]?.rarityOffset?.[rarity] ?? leveling?.rarityOffset?.[rarity];
  if (!Array.isArray(leveling?.levels) || !Number.isInteger(offset) || !Number.isFinite(exp)) return null;
  const custom = leveling.custom?.[type] ?? {};
  const mult = custom.xpMultiplier ?? 1;
  const steps = [...leveling.levels.slice(offset, offset + 99), ...(custom.extra ?? [])].map((n) => n * mult);
  const max = custom.maxLevel ?? 100;
  let level = 1;
  let left = exp;
  while (level < max && level <= steps.length && left >= steps[level - 1]) left -= steps[level - 1], level++;
  return { level, max, toNext: level >= max ? null : Math.ceil(steps[level - 1] - left) };
}

// gamedata/stat-sources.json: skills, slayers, fairy souls, SkyBlock level, cookie, god potion, accessories. A series is { values, src, confidence }:
// values[i] is level i + 1; safe needs two sources that agree, unsafe may carry the levels that differ.
const CONFIDENCE = new Set(['safe', 'unsafe']);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function checkConfidence(w, s) {
  if (!Array.isArray(s.src) || !s.src.length || !s.src.every((x) => typeof x === 'string' && x)) fail(w, 'src must be a list of texts');
  if (!CONFIDENCE.has(s.confidence)) fail(w, `bad confidence ${s.confidence}`);
  if (s.confidence === 'safe' && s.src.length < 2) fail(w, 'safe needs two sources');
  if (s.confidence === 'safe' && s.diff !== undefined) fail(w, 'safe has no diff');
}

function checkSeries(w, s, levels) {
  if (!Array.isArray(s?.values) || !s.values.every(isNum)) fail(w, 'values must be numbers');
  if (levels !== undefined && s.values.length !== levels) fail(w, `needs ${levels} values, has ${s.values.length}`);
  checkConfidence(w, s);
  if (s.diff !== undefined && (!Array.isArray(s.diff) || !s.diff.every((l) => Number.isInteger(l) && l >= 1 && l <= s.values.length))) fail(w, 'diff must list levels');
}

function checkValue(w, v) {
  if (!isNum(v?.value)) fail(w, 'value must be a number');
  checkConfidence(w, v);
}

const increasing = (w, values) => values.forEach((v, i) => { if (!(v > 0) || (i && !(v >= values[i - 1]))) fail(w, `xp not rising at level ${i + 1}`); });

export function checkStatSources(d, stats) {
  for (const key of ['skills', 'slayers', 'fairySouls', 'skyblockLevel', 'boosterCookie', 'godPotion', 'accessories', 'baseStats']) need('stat-sources', d, [key]);
  const group = (kind, list, cumulativeXp) => {
    for (const [id, e] of Object.entries(list)) {
      const w = `stat-sources.${kind}.${id}`;
      need(w, e, ['maxLevel', 'xp', 'stats', 'other']);
      if (!Number.isInteger(e.maxLevel) || e.maxLevel < 1) fail(w, 'bad maxLevel');
      checkSeries(`${w}.xp`, e.xp, e.maxLevel);
      if (!cumulativeXp) increasing(`${w}.xp`, e.xp.values);
      for (const [stat, s] of Object.entries(e.stats)) {
        if (!stats.has(stat)) fail(w, `unknown stat ${stat}`);
        checkSeries(`${w}.stats.${stat}`, s, e.maxLevel);
      }
      for (const [name, s] of Object.entries(e.other)) checkSeries(`${w}.other.${name}`, s, e.maxLevel);
      if (e.sbXp !== undefined) checkSeries(`${w}.sbXp`, e.sbXp, e.maxLevel);
      if (e.xpTotal !== undefined) {
        let sum = 0;
        e.xp.values.forEach((v, i) => { sum += v; if (e.xpTotal[i] !== sum) fail(`${w}.xpTotal`, `level ${i + 1} is ${e.xpTotal[i]}, the sum is ${sum}`); });
        if (e.xpTotal.length !== e.maxLevel) fail(`${w}.xpTotal`, 'wrong length');
      }
    }
  };
  group('skills', d.skills, false);
  group('slayers', d.slayers, true); // a slayer's xp are the totals needed, already cumulative
  for (const [id, e] of Object.entries(d.slayers)) increasing(`stat-sources.slayers.${id}.xp`, e.xp.values);
  checkValue('stat-sources.fairySouls.total', d.fairySouls.total);
  if (!isNum(d.fairySouls.perExchange?.sbXp)) fail('stat-sources.fairySouls', 'perExchange.sbXp must be a number');
  checkConfidence('stat-sources.fairySouls.perExchange', d.fairySouls.perExchange);
  for (const [stat, v] of Object.entries(d.fairySouls.statsPerExchange ?? {})) { if (!stats.has(stat)) fail('stat-sources.fairySouls', `unknown stat ${stat}`); checkValue(`stat-sources.fairySouls.statsPerExchange.${stat}`, v); }
  checkValue('stat-sources.skyblockLevel.xpPerLevel', d.skyblockLevel.xpPerLevel);
  checkValue('stat-sources.skyblockLevel.maxLevel', d.skyblockLevel.maxLevel);
  for (const part of ['perLevel', 'perFiveLevels']) {
    for (const [stat, v] of Object.entries(d.skyblockLevel[part])) { if (!stats.has(stat)) fail(`stat-sources.skyblockLevel.${part}`, `unknown stat ${stat}`); checkValue(`stat-sources.skyblockLevel.${part}.${stat}`, v); }
  }
  for (const [stat, v] of Object.entries(d.boosterCookie.stats)) { if (!stats.has(stat)) fail('stat-sources.boosterCookie', `unknown stat ${stat}`); checkValue(`stat-sources.boosterCookie.${stat}`, v); }
  for (const [stat, v] of Object.entries(d.godPotion.stats)) { if (!stats.has(stat)) fail('stat-sources.godPotion', `unknown stat ${stat}`); checkValue(`stat-sources.godPotion.${stat}`, v); }
  for (const [stat, v] of Object.entries(d.baseStats)) { if (!stats.has(stat)) fail('stat-sources.baseStats', `unknown stat ${stat}`); checkValue(`stat-sources.baseStats.${stat}`, v); }
  checkConfidence('stat-sources.accessories.reforges', d.accessories.reforges);
  checkConfidence('stat-sources.collections', d.collections);
  for (const r of d.collections.rewards) { if (!stats.has(r.stat)) fail('stat-sources.collections', `unknown stat ${r.stat}`); if (!r.tiers.length || !isNum(r.value)) fail('stat-sources.collections', `${r.collection} needs tiers and a value`); }
  for (const [stat, v] of Object.entries(d.bestiary.perMilestone)) { if (!stats.has(stat)) fail('stat-sources.bestiary', `unknown stat ${stat}`); checkValue(`stat-sources.bestiary.${stat}`, v); }
  unique('stat-sources.consumables', d.consumables.map((c) => c.id));
  for (const c of d.consumables) { if (!stats.has(c.stat)) fail(`stat-sources.consumables.${c.id}`, `unknown stat ${c.stat}`); if (!isNum(c.value) || !(c.max > 0)) fail(`stat-sources.consumables.${c.id}`, 'needs a value and a max'); checkConfidence(`stat-sources.consumables.${c.id}`, c); }
  for (const [stat, v] of Object.entries(d.accessories.enrichments?.values ?? {})) { if (!stats.has(stat)) fail('stat-sources.accessories', `unknown stat ${stat}`); checkValue(`stat-sources.accessories.enrichments.${stat}`, v); }
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
  const [stats, hotm, attributes, power, pets, essence, statSources] = await Promise.all(FILES.map((f) => read(f)));
  const ids = checkStats(stats);
  checkHotm(hotm, ids);
  checkAttributes(attributes, ids);
  checkPower(power, ids);
  checkPets(pets, ids);
  checkEssence(essence, ids);
  checkStatSources(statSources, ids);
  return { stats, hotm, attributes, power, pets, essence, statSources };
}

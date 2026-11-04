// Loads and checks the game data in gamedata/*.json (stats, HOTM, attributes, power). A broken file throws with a path to the fault.
export const FILES = ['stats', 'hotm', 'attributes', 'power'];
const AREAS = new Set(['mining', 'combat', 'farming', 'general']);
const RARITIES = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'];
const POWDERS = new Set(['MITHRIL', 'GEMSTONE', 'GLACITE']);
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
    need(w, s, ['id', 'name', 'areas', 'unit', 'percent', 'src']);
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

export function checkHotm(d, stats) {
  need('hotm', d, ['tiers', 'perks']);
  unique('hotm', d.perks.map((p) => p.id));
  if (d.tiers.length !== 10) fail('hotm', 'need 10 tiers');
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
    if (p.type !== 'core' && !POWDERS.has(p.powder)) fail(w, `bad powder ${p.powder}`);
    if (p.cost === undefined || (p.cost === null && !p.unknown)) fail(w, 'cost missing (null needs unknown:true)');
    for (const e of p.effects) checkEffect(w, e, stats);
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
      if ((e.perLevel === undefined) === (e.fixed === undefined)) fail(w, 'effect needs exactly one of perLevel/fixed');
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

// read: (name) -> parsed JSON (or a promise of it).
export async function loadGameData(read) {
  const [stats, hotm, attributes, power] = await Promise.all(FILES.map((f) => read(f)));
  const ids = checkStats(stats);
  checkHotm(hotm, ids);
  checkAttributes(attributes, ids);
  checkPower(power, ids);
  return { stats, hotm, attributes, power };
}

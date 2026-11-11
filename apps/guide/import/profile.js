// The worker's answer for one profile as the app keeps it: the form detect.js reads, plus the parts of the build the import can propose.
// Nothing of the raw answer is kept (no inventory text, no item uuid, no names). Numbers and ids only.
import { readItems } from './items.js';
import { HOTM_XP, levelOf } from '../requires.js';

const numbers = (o) => Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => typeof v === 'number' && Number.isFinite(v)));

// Shards applied -> level. stacks is the number of shards put in, not the level: the level is the highest one whose shards
// (the table of its rarity, cumulative) have all been paid. Gives 0 for no shards and stops at the maximum.
export function attrLevel(stacks, attr, data) {
  const table = data.attributes.shardsPerLevel[attr.rarity];
  let paid = 0;
  let level = 0;
  for (const cost of table.slice(0, attr.maxLevel)) {
    paid += cost;
    if (stacks < paid) break;
    level++;
  }
  return level;
}

// { levels: key -> level (only what is above 0), unknown: how many keys the app has no attribute for }
// The API still names many attributes by the shard id (Flare is "blazing", the app says infernal_ruler): the id without its
// ATTRIBUTE_SHARD_ prefix is the second name. Checked against a live profile: all 23 keys that were unknown matched it.
const attrOf = (data) => {
  const byKey = new Map(data.attributes.attributes.map((a) => [a.key, a]));
  const byId = new Map(data.attributes.attributes.map((a) => [a.id.replace(/^ATTRIBUTE_SHARD_/, '').toLowerCase(), a]));
  return (key) => byKey.get(key) ?? byId.get(key);
};

// The stacks under the app's keys, which the guides' attr steps use. A key the app does not know stays as it is.
export function attrStacks(stacks, data) {
  const find = attrOf(data);
  const out = {};
  for (const [key, n] of Object.entries(numbers(stacks))) {
    const k = find(key)?.key ?? key;
    out[k] = Math.max(out[k] ?? 0, n);
  }
  return out;
}

export function attrLevels(stacks, data) {
  const find = attrOf(data);
  const levels = {};
  let unknown = 0;
  for (const [key, n] of Object.entries(numbers(stacks))) {
    const attr = find(key);
    if (!attr) { unknown++; continue; }
    const level = attrLevel(n, attr, data);
    if (level > (levels[attr.key] ?? 0)) levels[attr.key] = level;
  }
  return { levels, unknown };
}

// skill_tree: nodes.mining = { <perk>: level, toggle_<perk>: on/off }. Older profiles: nodes flat, experience a number.
function hotmOf(h, data) {
  if (!h?.nodes) return null;
  const nodes = h.nodes.mining ?? h.nodes;
  const xp = typeof h.experience === 'number' ? h.experience : h.experience?.mining ?? 0;
  const perks = new Map(data.hotm.perks.map((p) => [p.id, p]));
  const levels = {};
  const disabled = [];
  let unknown = 0;
  for (const [key, v] of Object.entries(nodes)) {
    if (key.startsWith('toggle_')) {
      if (v === false && perks.get(key.slice(7))?.type === 'perk') disabled.push(key.slice(7));
      continue;
    }
    if (typeof v !== 'number') continue;
    if (!perks.has(key)) { unknown++; continue; }
    if (v > 0) levels[key] = Math.min(v, perks.get(key).maxLevel);
  }
  const ability = perks.get(h.selectedAbility)?.type === 'ability' ? h.selectedAbility : null;
  const powder = {};
  for (const [kind, p] of Object.entries(h.powder ?? {})) {
    const have = Number.isFinite(p.current) ? p.current : Number.isFinite(p.total) && Number.isFinite(p.spent) ? p.total - p.spent : null;
    if (have !== null) powder[kind] = have;
  }
  return { levels, tier: Math.min(Math.max(levelOf(HOTM_XP, xp), 1), 10), experience: xp, ability, disabled, powder, unknown };
}

// The tuning slot in use. The answer has one block per slot and no mark for the one in use, so only an unambiguous case counts:
// exactly one slot holds points. Several slots with points: null (shown, not taken).
const TUNING = { walk_speed: 'SPEED' };
function tuningOf(t) {
  const slots = Object.entries(t ?? {}).filter(([k, v]) => /^slot_\d+$/.test(k) && v && typeof v === 'object');
  const used = slots.map(([, s]) => Object.fromEntries(Object.entries(numbers(s)).filter(([, n]) => n > 0).map(([k, n]) => [TUNING[k] ?? k.toUpperCase(), n]))).filter((s) => Object.keys(s).length);
  if (used.length > 1) return null;
  return used[0] ?? {};
}

const MISSING_INVENTORY = (answer) => !answer.inventories || Object.keys(answer.inventories).length === 0;

// answer: the body of /v1/profile/<name>/<id>. data: the game data (gamedata/*.json as loadGameData gives it).
export async function summarize(answer, data, fetchedAt = Date.now()) {
  const missing = Array.isArray(answer.missing) ? answer.missing.filter((m) => typeof m === 'string') : [];
  const noInventory = MISSING_INVENTORY(answer);
  const { items, skipped } = noInventory ? { items: [], skipped: 0 } : await readItems(answer.inventories);
  const attrs = answer.attributes?.stacks ? attrLevels(answer.attributes.stacks, data) : null;
  const perkIds = new Set((data.essence?.perks ?? []).map((p) => p.id));
  const perks = answer.essencePerks ? numbers(answer.essencePerks) : null;
  const bag = answer.accessoryBag ?? null;
  const stone = data.power.powerStones.find((s) => s.power.toLowerCase() === String(bag?.selectedPower ?? '').toLowerCase());
  return {
    profileId: answer.profileId, profileName: answer.cute_name, fetchedAt,
    items, skipped,
    pets: Array.isArray(answer.pets) ? answer.pets.map(({ type, tier, exp, heldItem, active }) => ({ type, tier, exp: exp ?? 0, heldItem: heldItem ?? null, active: !!active })) : null,
    // the guides' attr steps count shards (stacks), the build counts levels
    attrs: answer.attributes?.stacks ? attrStacks(answer.attributes.stacks, data) : null,
    attrLevels: attrs?.levels ?? null, attrUnknown: attrs?.unknown ?? 0,
    huntingBox: Object.fromEntries((Array.isArray(answer.attributes?.huntingBox) ? answer.attributes.huntingBox : []).filter((s) => s?.type).map((s) => [s.type, s.amount_owned ?? 0])),
    perks, essence: perks ? Object.fromEntries(Object.entries(perks).filter(([id]) => perkIds.has(id))) : null,
    essenceUnknown: perks ? Object.keys(perks).filter((id) => !perkIds.has(id)).length : 0,
    hotm: hotmOf(answer.hotm, data),
    mp: Number.isFinite(bag?.highestMagicalPower) ? bag.highestMagicalPower : null,
    // only the selected power is known: "unlocked" cannot be answered, so detect gets no list
    powers: null, selectedPower: bag?.selectedPower ?? null, stone: stone?.id ?? null,
    tuning: bag ? tuningOf(bag.tuning) : null,
    skills: answer.skills ? numbers(answer.skills) : null,
    // xp per slayer boss
    slayer: answer.slayer ? numbers(answer.slayer) : null,
    // SkyBlock XP (leveling.experience); null until the worker sends it
    skyblockXp: Number.isFinite(answer.skyblockXp) ? answer.skyblockXp : null,
    collTiers: null,
    missing: { inventory: noInventory, list: missing },
  };
}

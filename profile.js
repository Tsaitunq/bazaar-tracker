// Turns the player's profile member into what the app keeps: what is owned and what its stats say, with no item uuid,
// no lore text and nothing of the raw answer.
import { decodeInventory } from './nbt.js';

// no prototype, so a lore line called "constructor" is no stat
const STATS = {
  __proto__: null,
  Damage: 'DAMAGE', Strength: 'STRENGTH', 'Crit Chance': 'CRITICAL_CHANCE', 'Crit Damage': 'CRITICAL_DAMAGE', 'Attack Speed': 'ATTACK_SPEED',
  Health: 'HEALTH', Defense: 'DEFENSE', 'True Defense': 'TRUE_DEFENSE', 'Magic Find': 'MAGIC_FIND',
  'Mining Speed': 'MINING_SPEED', 'Mining Fortune': 'MINING_FORTUNE', 'Gemstone Fortune': 'GEMSTONE_FORTUNE', 'Ore Fortune': 'ORE_FORTUNE', 'Block Fortune': 'BLOCK_FORTUNE', Pristine: 'PRISTINE',
};

// The first number of a line is the stat; the brackets after it say where parts of it come from.
export function parseLore(lines) {
  const out = {};
  for (const line of lines ?? []) {
    const [, name, value] = String(line).replace(/§./g, '').match(/^([A-Za-z ]+): ([+-][\d,.]+)/) ?? [];
    const number = Number(value?.replaceAll(',', ''));
    if (STATS[name] && !(STATS[name] in out) && Number.isFinite(number)) out[STATS[name]] = number;
  }
  return out;
}

// A slot is JADE_0 with its type in the name, or COMBAT_0 with the type in COMBAT_0_gem; a quality is a text or { uuid, quality }.
function readGems(gems) {
  return Object.entries(gems ?? {}).filter(([k]) => k !== 'unlocked_slots' && !k.endsWith('_gem')).map(([k, v]) => ({
    slot: k,
    type: gems[`${k}_gem`] ?? k.replace(/_\d+$/, ''),
    quality: v?.quality ?? v,
  }));
}

export function readItem(raw, where, slot = null) {
  const e = raw?.tag?.ExtraAttributes;
  if (!e?.id) return null;
  const parts = Object.fromEntries(['engine', 'fuel_tank', 'upgrade_module'].filter((p) => e[`drill_part_${p}`]).map((p) => [p, e[`drill_part_${p}`]]));
  return {
    id: e.id, slot, where, reforge: e.modifier ?? null, enchants: e.enchantments ?? {}, gems: readGems(e.gems),
    recomb: e.rarity_upgrades > 0, stars: e.upgrade_level ?? e.dungeon_item_level ?? 0, parts, lore: parseLore(raw.tag.display?.Lore),
  };
}

// Worn first, so a set that is worn and also in its wardrobe slot counts as worn.
function storages(member) {
  const inv = member.inventory ?? {};
  const list = [
    ['armor', inv.inv_armor], ['equipment', inv.equipment_contents], ['inventory', inv.inv_contents], ['ender', inv.ender_chest_contents], ['vault', inv.personal_vault_contents],
    ...Object.values(inv.backpack_contents ?? {}).map((s) => ['backpack', s]),
    ['accessory', inv.bag_contents?.talisman_bag],
  ];
  for (const sets of [member.loadout?.armor, member.loadout?.equipment]) {
    for (const set of Object.values(sets ?? {})) {
      for (const [slot, s] of Object.entries(set ?? {})) if (s?.data) list.push(['wardrobe', s, slot]);
    }
  }
  return list.filter(([, s]) => s?.data);
}

async function readItems(member) {
  const list = storages(member);
  const items = [];
  const seen = new Set();
  let readable = 0;
  let skipped = 0;
  // One broken inventory or item must not cost the others. They run one after the other, so the page stays responsive.
  for (const [where, store, slot] of list) {
    let slots;
    try {
      slots = await decodeInventory(store.data);
    } catch {
      skipped++;
      continue;
    }
    readable++;
    for (const raw of slots) {
      try {
        const item = readItem(raw, where, slot ?? null);
        const uuid = raw.tag?.ExtraAttributes?.uuid;
        if (!item || (uuid && seen.has(uuid))) continue;
        if (uuid) seen.add(uuid);
        items.push(item);
      } catch {
        skipped++;
      }
    }
  }
  // Nothing readable at all replaces no stored items: the run fails and the last stand stays.
  if (list.length && !readable) throw new Error('No inventory could be read');
  return { items, skipped };
}

const numbers = (o) => Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => typeof v === 'number'));

export async function summarize(member, previous = null) {
  const missing = { inventory: !member.inventory, collections: !member.collection, skills: !member.player_data?.experience };
  const bag = member.accessory_bag_storage ?? {};
  const tree = member.skill_tree;
  const { items, skipped } = missing.inventory ? { items: previous?.items ?? [], skipped: 0 } : await readItems(member);
  return {
    items,
    skipped,
    pets: (member.pets_data?.pets ?? []).map(({ type, exp, tier, active, heldItem }) => ({ type, exp, tier, active, heldItem })),
    mp: bag.highest_magical_power ?? null,
    selectedPower: bag.selected_power ?? null,
    tuning: bag.tuning ?? null,
    hotm: tree ? { experience: tree.experience?.mining ?? 0, nodes: numbers(tree.nodes?.mining), tokens: tree.tokens_spent?.mining ?? 0 } : null,
    collections: member.collection ?? null,
    skills: member.player_data?.experience ?? null,
    slayer: Object.fromEntries(Object.entries(member.slayer?.slayer_bosses ?? {}).map(([boss, s]) => [boss, s.xp ?? 0])),
    kuudra: member.nether_island_player_data?.kuudra_completed_tiers ?? null,
    missing,
  };
}

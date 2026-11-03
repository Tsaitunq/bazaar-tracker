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
    recomb: e.rarity_upgrades > 0, stars: e.upgrade_level ?? e.dungeon_item_level ?? 0, parts, polarvoid: e.polarvoid ?? 0, coating: !!e.divan_powder_coating,
    scrolls: [...(e.ability_scroll ?? []), ...(e.power_ability_scroll ? [e.power_ability_scroll] : [])], lore: parseLore(raw.tag.display?.Lore),
  };
}

// Worn first, so a set that is worn and also in its wardrobe slot counts as worn.
function storages(member) {
  const inv = member.inventory ?? {};
  const list = [
    ['armor', inv.inv_armor], ['equipment', inv.equipment_contents], ['inventory', inv.inv_contents], ['ender', inv.ender_chest_contents], ['vault', inv.personal_vault_contents],
    // the number of a backpack as the game shows it, 1 to 18, for the detection report
    ...Object.entries(inv.backpack_contents ?? {}).map(([n, s]) => ['backpack', s, null, null, Number(n) + 1]),
    ['accessory', inv.bag_contents?.talisman_bag],
  ];
  for (const kind of ['armor', 'equipment']) {
    for (const [n, set] of Object.entries(member.loadout?.[kind] ?? {})) {
      for (const [slot, s] of Object.entries(set ?? {})) if (s?.data) list.push(['wardrobe', s, slot, `${kind}:${n}`]);
    }
  }
  return list.filter(([, s]) => s?.data);
}

async function readItems(member) {
  const list = storages(member);
  const items = [];
  const seen = new Map();
  // the slot of a worn set is empty in the wardrobe: what is worn belongs to it
  const worn = { armor: member.loadout?.armor?.equipped_set, equipment: member.loadout?.equipment?.equipped_set };
  let readable = 0;
  let skipped = 0;
  // One broken inventory or item must not cost the others. They run one after the other, so the page stays responsive.
  for (const [where, store, slot, wardrobeSet, bag] of list) {
    const set = wardrobeSet ?? (where in worn && worn[where] ? `${where}:${worn[where]}` : null);
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
        if (!item) continue;
        if (bag) item.bag = bag;
        // the same item in two places is one item, and it stays in each set
        const known = uuid && seen.get(uuid);
        const kept = known || item;
        if (set) kept.sets = [...new Set([...(kept.sets ?? []), set])];
        if (known) continue;
        if (uuid) seen.set(uuid, item);
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

// Which wardrobe and equipment slots hold anything, by index. Names of loadouts stay out.
function wardrobeOf(loadout) {
  if (!loadout?.armor && !loadout?.equipment) return null;
  const read = (group) => ({
    equipped: group?.equipped_set ?? null,
    sets: [...new Set([...Object.entries(group ?? {}).filter(([, set]) => Object.values(set ?? {}).some((s) => s?.data)).map(([n]) => Number(n)), ...(group?.equipped_set ? [group.equipped_set] : [])])].sort((a, b) => a - b),
  });
  return { armor: read(loadout.armor), equipment: read(loadout.equipment) };
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
    wardrobe: missing.inventory ? previous?.wardrobe ?? null : wardrobeOf(member.loadout),
    farmingCap: member.jacobs_contest?.perks?.farming_level_cap ?? 0,
    skyblockXp: member.leveling?.experience ?? null,
    pets: (member.pets_data?.pets ?? []).map(({ type, exp, tier, active, heldItem }) => ({ type, exp, tier, active, heldItem })),
    mp: bag.highest_magical_power ?? null,
    selectedPower: bag.selected_power ?? null,
    tuning: bag.tuning ?? null,
    hotm: tree ? { experience: tree.experience?.mining ?? 0, nodes: numbers(tree.nodes?.mining), tokens: tree.tokens_spent?.mining ?? 0 } : null,
    collections: member.collection ?? null,
    skills: member.player_data?.experience ?? null,
    slayer: Object.fromEntries(Object.entries(member.slayer?.slayer_bosses ?? {}).map(([boss, s]) => [boss, s.xp ?? 0])),
    kuudra: member.nether_island_player_data?.kuudra_completed_tiers ?? null,
    attrs: member.attributes?.stacks ? numbers(member.attributes.stacks) : null,
    powers: bag.unlocked_powers ?? null,
    // essence shop perks by level
    perks: member.player_data?.perks ? numbers(member.player_data.perks) : null,
    // tiers are unlocked for the whole coop, the member's own collection counts are not
    collTiers: member.player_data?.unlocked_coll_tiers ?? null,
    missing,
  };
}

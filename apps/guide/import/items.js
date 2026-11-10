// Turns the inventories of a worker answer into the items the app keeps: what detect.js asks for and where the item was
// found. No uuid, no lore, no name and nothing of the raw NBT is kept. Format checked with scripts/probe-items.mjs:
// tag.ExtraAttributes holds everything; the item's `components` are ignored.
import { decodeInventory, newBudget } from '../nbt.js';

const DRILL_PARTS = ['engine', 'fuel_tank', 'upgrade_module'];
const text = (v) => (typeof v === 'string' && v ? v : null);
const whole = (v) => (Number.isFinite(v) && v > 0 ? Math.trunc(v) : 0);

// A gem slot is AMBER_0 (the type is in the name) or MINING_0 / COMBAT_0 / UNIVERSAL_0 (the type is in MINING_0_gem).
// Its value is { quality, uuid } or just the quality as text. A slot without an entry is free. unlocked_slots lists the open ones.
export function readGems(gems) {
  const list = [];
  for (const [slot, v] of Object.entries(gems ?? {})) {
    if (slot === 'unlocked_slots' || slot.endsWith('_gem')) continue;
    const quality = text(v?.quality ?? v);
    if (!quality) continue;
    list.push({ slot, type: text(gems[`${slot}_gem`]) ?? slot.replace(/_\d+$/, ''), quality: quality.toUpperCase() });
  }
  const unlocked = Array.isArray(gems?.unlocked_slots) ? gems.unlocked_slots.map(String) : [];
  return { gems: list, unlocked };
}

// A drill part is drill_part_engine (text) or engine.id (a compound with an id); upgrade_module is the Goblin Omelette.
function readParts(e) {
  const parts = {};
  for (const p of DRILL_PARTS) {
    const id = text(e[`drill_part_${p}`]) ?? text(e[p]?.id);
    if (id) parts[p] = id;
  }
  return parts;
}

// at: where it was found (shown as is). Gives null for an empty slot or one without an id.
export function readItem(raw, at) {
  const e = raw?.tag?.ExtraAttributes;
  if (!text(e?.id)) return null;
  const hot = whole(e.hot_potato_count);
  return {
    id: e.id,
    reforge: text(e.modifier),
    enchants: Object.fromEntries(Object.entries(e.enchantments ?? {}).filter(([, v]) => typeof v === 'number')),
    ...readGems(e.gems),
    // rarity_upgrades is the Recombobulator; upgraded_rarity is another rise of the rarity (Safari Belt): its own field
    recomb: whole(e.rarity_upgrades) > 0,
    upgradedRarity: text(e.upgraded_rarity),
    // 1 to 10 hot potato books, 11 to 15 are the fuming books
    hpb: Math.min(hot, 10),
    fuming: Math.max(hot - 10, 0),
    stars: whole(e.upgrade_level ?? e.dungeon_item_level),
    parts: readParts(e),
    polarvoid: whole(e.polarvoid),
    coating: !!e.divan_powder_coating,
    scrolls: [...(Array.isArray(e.ability_scroll) ? e.ability_scroll : []), ...(text(e.power_ability_scroll) ? [e.power_ability_scroll] : [])].filter(text),
    at: [at],
    uuid: text(e.uuid),
  };
}

// Sets are numbered like the API does; if there is a set 0 (worn sets are empty in the wardrobe, so the worn one counts) the game's slot is one more.
const offsetOf = (group) => (Object.keys(group?.sets ?? {}).some((k) => Number(k) === 0) || group?.equipped === 0 ? 1 : 0);

// Every inventory of the answer: { at, data }. Worn pieces come first: a worn set is empty in the wardrobe, what is worn belongs to it.
export function sourcesOf(inv) {
  const out = [];
  const add = (at, data, extra = []) => typeof data === 'string' && out.push({ at: [at, ...extra], data });
  const worn = (group) => (group?.equipped !== undefined && group?.equipped !== null ? group.equipped : null);
  const [shift, equipShift] = [offsetOf(inv.wardrobe), offsetOf(inv.equipmentWardrobe)];
  const wornArmor = worn(inv.wardrobe);
  const wornEquip = worn(inv.equipmentWardrobe);
  add('Getragen', inv.armor, wornArmor !== null ? [`Wardrobe Set ${wornArmor + shift}`] : []);
  add('Getragen', inv.equipment, wornEquip !== null ? [`Equipment-Set ${wornEquip + equipShift}`] : []);
  add('Inventar', inv.inventory);
  for (const [n, parts] of Object.entries(inv.wardrobe?.sets ?? {})) for (const data of Object.values(parts)) add(`Wardrobe Set ${Number(n) + shift}`, data);
  for (const [n, parts] of Object.entries(inv.equipmentWardrobe?.sets ?? {})) for (const data of Object.values(parts)) add(`Equipment-Set ${Number(n) + equipShift}`, data);
  add('Accessory Bag', inv.accessoryBag);
  add('Ender Chest', inv.enderChest);
  add('Personal Vault', inv.personalVault);
  for (const [slot, data] of Object.entries(inv.storage ?? {})) add(`Backpack ${Number(slot) + 1}`, data);
  for (const [crop, list] of Object.entries(inv.farmingToolkit ?? {})) for (const data of list) add(`Farming-Toolkit ${crop}`, data);
  return out;
}

// Reads them one after the other so the page stays usable. One broken inventory or item costs only itself. Nothing readable at all rejects:
// the last stored stand then stays.
export async function readItems(inv) {
  const sources = sourcesOf(inv ?? {});
  const budget = newBudget();
  const items = [];
  const seen = new Map();
  let readable = 0;
  let skipped = 0;
  for (const { at, data } of sources) {
    let slots;
    try {
      slots = await decodeInventory(data, budget);
    } catch {
      skipped++;
      continue;
    }
    readable++;
    for (const raw of slots) {
      try {
        const item = readItem(raw, at[0]);
        if (!item) continue;
        item.at = [...at];
        // the same item in two places is one item, found in both
        const known = item.uuid && seen.get(item.uuid);
        if (known) {
          known.at = [...new Set([...known.at, ...item.at])];
          continue;
        }
        if (item.uuid) seen.set(item.uuid, item);
        items.push(item);
      } catch {
        skipped++;
      }
    }
  }
  if (sources.length && !readable) throw new Error('No inventory could be read');
  for (const item of items) delete item.uuid;
  return { items, skipped };
}

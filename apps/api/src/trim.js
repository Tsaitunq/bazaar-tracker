// Cuts one Hypixel profile down to one member's guide fields. Plain key picks, no deep walks, no decoding:
// inventory fields stay raw base64 (the app decodes them). A field Hypixel does not send is left out and listed in `missing`.

const has = (v) => v !== undefined && v !== null;

export function trimList(profiles) {
  return (profiles || []).map((p) => ({ id: p.profile_id, cute_name: p.cute_name, game_mode: p.game_mode, selected: !!p.selected }));
}

function hotm(m) {
  // Current format: skill_tree. Older profiles: mining_core. Powder is always in mining_core.
  const st = m.skill_tree, mc = m.mining_core || {};
  const src = st && st.nodes ? st : mc.nodes ? mc : null;
  const out = {};
  if (src) {
    out.nodes = src.nodes;
    out.experience = src.experience;
    out.tokensSpent = src.tokens_spent;
    out.selectedAbility = src.selected_ability ?? src.selected_pickaxe_ability;
  }
  const powder = {};
  for (const kind of ['mithril', 'gemstone', 'glacite']) {
    const p = { current: mc[`powder_${kind}`], total: mc[`powder_${kind}_total`], spent: mc[`powder_spent_${kind}`] };
    if (Object.values(p).some(has)) powder[kind] = p;
  }
  if (Object.keys(powder).length) out.powder = powder;
  return Object.keys(out).length ? out : undefined;
}

function pets(m) {
  const list = m.pets_data && m.pets_data.pets;
  return Array.isArray(list) ? list.map((p) => ({ type: p.type, tier: p.tier, exp: p.exp, heldItem: p.heldItem ?? null, active: !!p.active })) : undefined;
}

function slayer(m) {
  const b = m.slayer && m.slayer.slayer_bosses;
  if (!b) return undefined;
  const out = {};
  for (const k of Object.keys(b)) out[k] = b[k].xp ?? 0;
  return out;
}

function fairySouls(m) {
  const f = m.fairy_soul;
  return f ? { collected: f.total_collected, unspent: f.unspent_souls, exchanges: f.fairy_exchanges } : undefined;
}

function accessoryBag(m) {
  const a = m.accessory_bag_storage;
  return a ? { selectedPower: a.selected_power, tuning: a.tuning, highestMagicalPower: a.highest_magical_power } : undefined;
}

// Attributes: members.<uuid>.attributes.stacks = shards applied per attribute (not the level; the app converts it with the shard table per rarity).
// shards.owned is the Hunting Box (type + amount_owned).
function attributes(m) {
  if (!m.attributes || !m.attributes.stacks) return undefined;
  return { stacks: m.attributes.stacks, huntingBox: m.shards && m.shards.owned };
}

const data = (x) => (x && typeof x.data === 'string' ? x.data : undefined);

// loadout.armor / loadout.equipment: numbered sets plus equipped_set. Parts are raw base64; missing parts are left out.
function sets(group, parts) {
  if (!group || typeof group !== 'object') return undefined;
  const out = { sets: {} };
  if (has(group.equipped_set)) out.equipped = group.equipped_set;
  for (const n of Object.keys(group)) {
    if (n === 'equipped_set' || !group[n] || typeof group[n] !== 'object') continue;
    const set = {};
    for (const [name, src] of Object.entries(parts)) if (data(group[n][src])) set[name] = group[n][src].data;
    if (Object.keys(set).length) out.sets[n] = set;
  }
  return out;
}

// garden_player_data.farming_toolkit.<CROP>.<n> = {type,data}
function farmingToolkit(m) {
  const kit = m.garden_player_data && m.garden_player_data.farming_toolkit;
  if (!kit || typeof kit !== 'object') return undefined;
  const out = {};
  for (const crop of Object.keys(kit)) {
    const tools = kit[crop] && typeof kit[crop] === 'object' ? Object.keys(kit[crop]).sort((a, b) => a - b).map((n) => data(kit[crop][n])).filter(Boolean) : [];
    if (tools.length) out[crop] = tools;
  }
  return Object.keys(out).length ? out : undefined;
}

// loadout.loadouts.<n> = { armor_set_id, equipment_set_id }
function loadouts(m) {
  const l = m.loadout && m.loadout.loadouts;
  if (!l || typeof l !== 'object') return undefined;
  return Object.keys(l).filter((id) => l[id] && typeof l[id] === 'object').map((id) => ({ id, armorSet: l[id].armor_set_id, equipmentSet: l[id].equipment_set_id }));
}

function inventories(m, missing) {
  const inv = m.inventory || {};
  const out = {};
  const put = (name, v) => (has(v) ? (out[name] = v) : missing.push(`inventories.${name}`));
  put('inventory', data(inv.inv_contents));
  put('armor', data(inv.inv_armor));
  put('equipment', data(inv.equipment_contents));
  put('wardrobe', sets(m.loadout && m.loadout.armor, { helmet: 'HELMET', chestplate: 'CHESTPLATE', leggings: 'LEGGINGS', boots: 'BOOTS' }));
  put('equipmentWardrobe', sets(m.loadout && m.loadout.equipment, { slot1: 'EQUIPMENT_SLOT_1', slot2: 'EQUIPMENT_SLOT_2', slot3: 'EQUIPMENT_SLOT_3', slot4: 'EQUIPMENT_SLOT_4' }));
  put('farmingToolkit', farmingToolkit(m));
  put('personalVault', data(inv.personal_vault_contents));
  put('accessoryBag', data(inv.bag_contents && inv.bag_contents.talisman_bag));
  put('enderChest', data(inv.ender_chest_contents));
  let storage;
  if (inv.backpack_contents) {
    storage = {};
    for (const slot of Object.keys(inv.backpack_contents)) if (data(inv.backpack_contents[slot])) storage[slot] = inv.backpack_contents[slot].data;
  }
  put('storage', storage);
  return out;
}

// Returns null when the player is not a member of the profile.
export function trimProfile(profile, uuid) {
  const m = profile.members && profile.members[uuid];
  if (!m) return null;
  const missing = [];
  const out = { profileId: profile.profile_id, cute_name: profile.cute_name };
  const take = (name, v) => (has(v) ? (out[name] = v) : missing.push(name));
  take('hotm', hotm(m));
  take('essencePerks', m.player_data && m.player_data.perks);
  take('pets', pets(m));
  take('skills', m.player_data && m.player_data.experience);
  take('slayer', slayer(m));
  take('skyblockXp', m.leveling && typeof m.leveling.experience === 'number' ? m.leveling.experience : undefined);
  take('fairySouls', fairySouls(m));
  take('accessoryBag', accessoryBag(m));
  take('attributes', attributes(m));
  take('loadouts', loadouts(m));
  out.inventories = inventories(m, missing);
  out.missing = missing;
  return out;
}

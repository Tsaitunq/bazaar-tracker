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

function inventories(m, missing) {
  const inv = m.inventory || {};
  const out = {};
  const put = (name, v) => (has(v) ? (out[name] = v) : missing.push(`inventories.${name}`));
  put('inventory', data(inv.inv_contents));
  put('armor', data(inv.inv_armor));
  put('equipment', data(inv.equipment_contents));
  put('wardrobe', data(inv.wardrobe_contents));
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
  take('fairySouls', fairySouls(m));
  take('accessoryBag', accessoryBag(m));
  take('attributes', attributes(m));
  out.inventories = inventories(m, missing);
  out.missing = missing;
  return out;
}

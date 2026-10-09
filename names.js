const ITEMS_URL = 'https://api.hypixel.net/v2/resources/skyblock/items';
const KEY = 'bt.items';
const TTL = 7 * 24 * 3600 * 1000;

const title = (s) => s.toLowerCase().split('_').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

// The items resource has no entry for enchantments, shards, essences and a few others.
export function fallbackName(id) {
  const m = /^(ENCHANTMENT|SHARD|ESSENCE)_(.+)$/.exec(id);
  if (!m) return title(id);
  return m[1] === 'ENCHANTMENT' ? title(m[2]) : `${title(m[2])} ${title(m[1])}`;
}

export function nameMap(items) {
  return Object.fromEntries(items.map((i) => [i.id, String(i.name).replace(/§./g, '')]));
}

export function npcMap(items) {
  return Object.fromEntries(items.filter((i) => i.npc_sell_price > 0).map((i) => [i.id, i.npc_sell_price]));
}

export async function loadItems() {
  try { localStorage.removeItem('bt.names'); } catch {}
  let cached;
  try { cached = JSON.parse(localStorage.getItem(KEY)); } catch {}
  const old = cached?.names ? { names: cached.names, npc: cached.npc ?? {} } : null;
  if (old && Date.now() - cached.t < TTL) return old;
  try {
    const { items } = await (await fetch(ITEMS_URL)).json();
    const r = { names: nameMap(items), npc: npcMap(items) };
    try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), ...r })); } catch {}
    return r;
  } catch {
    return old ?? { names: {}, npc: {} };
  }
}

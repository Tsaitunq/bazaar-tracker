const ITEMS_URL = 'https://api.hypixel.net/v2/resources/skyblock/items';
const KEY = 'bt.names';
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

export async function loadNames() {
  let cached;
  try { cached = JSON.parse(localStorage.getItem(KEY)); } catch {}
  if (cached?.m && Date.now() - cached.t < TTL) return cached.m;
  try {
    const m = nameMap((await (await fetch(ITEMS_URL)).json()).items);
    try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), m })); } catch {}
    return m;
  } catch {
    return cached?.m ?? {};
  }
}

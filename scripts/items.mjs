// The item resource is 4.8 MB. The app needs these fields of it, and nothing here belongs to a player.
const FIELDS = ['name', 'category', 'sword_type', 'tier', 'gemstone_slots', 'requirements', 'prestige'];

const upperKeys = (o) => (o ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toUpperCase(), v])) : undefined);

// parents: NEU constants/parents.json, the top of a family to its lower pieces. Not on the wiki, so not confirmed.
export function compactItems(resource, parents) {
  const family = {};
  for (const [top, lower] of Object.entries(parents ?? {})) for (const id of [top, ...lower]) family[id] = top;
  const out = {};
  for (const item of resource.items ?? []) {
    const row = {};
    for (const f of FIELDS) if (item[f] !== undefined) row[f] = item[f];
    const stats = upperKeys(item.stats), tiered = upperKeys(item.tiered_stats), parent = item.museum_data?.parent;
    out[item.id] = { ...row, ...(stats && { stats }), ...(tiered && { tiered_stats: tiered }), ...(parent && { parent }), ...(family[item.id] && { family: family[item.id] }) };
  }
  return out;
}

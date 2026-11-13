// The item resource is 4.8 MB. The app needs these fields of it, and nothing here belongs to a player.
const FIELDS = ['name', 'category', 'sword_type', 'tier', 'gemstone_slots', 'requirements', 'prestige'];

// the resource says HEALTH_REGENERATION and WALK_SPEED, the game menu (and gamedata/stats.json) Health Regen and Speed
const NAME = { HEALTH_REGENERATION: 'HEALTH_REGEN', WALK_SPEED: 'SPEED' };
const upperKeys = (o) => (o ? Object.fromEntries(Object.entries(o).map(([k, v]) => [NAME[k.toUpperCase()] ?? k.toUpperCase(), v])) : undefined);

// consumed: upgrading the item uses it up (the Drill Forge takes the lower drill), so a higher piece of its line means it was owned. Set for drills only;
// other lines (pickaxes, gauntlets, Kuudra armor) are not known to use the lower piece up, so they keep the old rule: an owned step looks for exactly that item.
// parents: NEU constants/parents.json, the top of a family to its lower pieces. Not on the wiki, so not confirmed.
export function compactItems(resource, parents) {
  const family = {};
  for (const [top, lower] of Object.entries(parents ?? {})) for (const id of [top, ...lower]) family[id] = top;
  const out = {};
  for (const item of resource.items ?? []) {
    const row = {};
    for (const f of FIELDS) if (item[f] !== undefined) row[f] = item[f];
    const stats = upperKeys(item.stats), tiered = upperKeys(item.tiered_stats), parent = item.museum_data?.parent;
    out[item.id] = { ...row, ...(stats && { stats }), ...(tiered && { tiered_stats: tiered }), ...(parent && { parent }), ...(family[item.id] && { family: family[item.id] }), ...(item.category === 'DRILL' && { consumed: true }) };
  }
  return out;
}

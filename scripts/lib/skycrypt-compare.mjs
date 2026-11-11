// Local check tool, not part of the app: reads a profile from the worker answer and from SkyCrypt's JSON with the same
// readItem and compares them. Output rows carry item ids and numbers only: no names, no uuids.
import { readItem, sourcesOf } from '../../apps/guide/import/items.js';
import { decodeInventory, newBudget } from '../../apps/guide/nbt.js';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sorted = (o) => Object.entries(o ?? {}).map(([k, v]) => `${k}:${v}`).sort();

// where an item was found, reduced to the kind of place so both sides can be compared
const place = (at) => String(at).replace(/\s*(Set\s*)?\d+$/, '').replace(/-Set$/, '').replace(/^Equipment$/, 'Wardrobe').replace(/^Farming-Toolkit.*/, 'Farming-Toolkit');
const SKY_PLACE = { armor: 'Getragen', equipment: 'Getragen', inventory: 'Inventar', wardrobe: 'Wardrobe', enderchest: 'Ender Chest', ender_chest: 'Ender Chest', accessory_bag: 'Accessory Bag', talismans: 'Accessory Bag', personal_vault: 'Personal Vault', backpack: 'Backpack', storage: 'Backpack' };

// the fields of an item that are compared, in the form a row shows
const FIELDS = {
  gems: (i) => i.gems.map((g) => `${g.slot}=${g.type}:${g.quality}`).sort(),
  enchants: (i) => sorted(i.enchants),
  reforge: (i) => i.reforge,
  recomb: (i) => `${i.recomb}${i.upgradedRarity ? `+${i.upgradedRarity}` : ''}`,
  polarvoid: (i) => i.polarvoid,
  parts: (i) => sorted(i.parts),
  coating: (i) => i.coating,
  hpb: (i) => `${i.hpb}+${i.fuming}`,
  stars: (i) => i.stars,
  scrolls: (i) => [...i.scrolls].sort(),
  places: (i) => [...new Set(i.at.map(place))].sort(),
};

// Our side: every item of a worker answer with its uuid kept (only for matching; it never reaches a row).
export async function ourItems(inventories) {
  const budget = newBudget();
  const out = [];
  for (const { at, data } of sourcesOf(inventories ?? {})) {
    let slots;
    try { slots = await decodeInventory(data, budget); } catch { continue; }
    for (const raw of slots) {
      const item = readItem(raw, at[0]);
      if (!item) continue;
      item.at = [...at];
      const known = item.uuid && out.find((o) => o.uuid === item.uuid);
      if (known) known.at = [...new Set([...known.at, ...item.at])]; else out.push(item);
    }
  }
  return out;
}

// SkyCrypt's side: every object holding tag.ExtraAttributes.id, under the top-level key of data.items it sits in.
export function skycryptItems(data) {
  const out = [];
  const walk = (node, top) => {
    if (!node || typeof node !== 'object') return;
    if (node.tag?.ExtraAttributes?.id) {
      const item = readItem(node, SKY_PLACE[top] ?? top);
      if (item) out.push(item);
    }
    for (const v of Object.values(node)) walk(v, top);
  };
  for (const [top, v] of Object.entries(data?.items ?? {})) walk(v, top);
  const merged = [];
  for (const item of out) {
    const known = item.uuid && merged.find((m) => m.uuid === item.uuid);
    if (known) known.at = [...new Set([...known.at, ...item.at])]; else merged.push(item);
  }
  return merged;
}

// Items by uuid; one without a uuid (a stack) can only be counted per id.
export function diffItems(ours, theirs) {
  const rows = [];
  const row = (id, field, a, b) => rows.push({ area: 'item', id, field, ours: a, theirs: b });
  const theirsLeft = new Map(theirs.filter((i) => i.uuid).map((i) => [i.uuid, i]));
  for (const a of ours.filter((i) => i.uuid)) {
    const b = theirsLeft.get(a.uuid);
    if (!b) { row(a.id, 'present', 'yes', 'no'); continue; }
    theirsLeft.delete(a.uuid);
    if (a.id !== b.id) row(a.id, 'id', a.id, b.id);
    for (const [field, read] of Object.entries(FIELDS)) if (!same(read(a), read(b))) row(a.id, field, read(a), read(b));
  }
  for (const b of theirsLeft.values()) row(b.id, 'present', 'no', 'yes');
  const count = (list) => list.filter((i) => !i.uuid).reduce((m, i) => m.set(i.id, (m.get(i.id) ?? 0) + 1), new Map());
  const [ca, cb] = [count(ours), count(theirs)];
  for (const id of new Set([...ca.keys(), ...cb.keys()])) if ((ca.get(id) ?? 0) !== (cb.get(id) ?? 0)) row(id, 'count (no uuid)', ca.get(id) ?? 0, cb.get(id) ?? 0);
  return rows;
}

// ---- the rest of the profile -------------------------------------------------------------------------------------------------
// SkyCrypt's layout of these parts is not documented; a part that is not where it is looked for says so, so that the first run
// shows which path to correct.
const pick = (o, ...paths) => { for (const p of paths) { const v = p.split('.').reduce((n, k) => n?.[k], o); if (v !== undefined && v !== null) return v; } return undefined; };

function mapRows(area, ours, theirs, name) {
  if (theirs === undefined) return [{ area, id: name, field: 'SkyCrypt side not found', ours: '', theirs: '?' }];
  const rows = [];
  for (const key of new Set([...Object.keys(ours ?? {}), ...Object.keys(theirs)])) {
    const [a, b] = [ours?.[key] ?? 0, theirs[key] ?? 0];
    if (a !== b) rows.push({ area, id: key, field: 'level', ours: a, theirs: b });
  }
  return rows;
}

// summary: summarize(...) of the worker answer; sky: the profile's data object of SkyCrypt
export function diffProfile(summary, sky) {
  const rows = [];
  const core = pick(sky, 'mining.core');
  if (summary.hotm && core) {
    const tier = pick(core, 'tier.level', 'tier');
    if (tier !== undefined && tier !== summary.hotm.tier) rows.push({ area: 'hotm', id: 'tier', field: 'tier', ours: summary.hotm.tier, theirs: tier });
    const ability = pick(core, 'selected_pickaxe_ability', 'selectedAbility');
    if (ability !== undefined && String(ability).toLowerCase() !== String(summary.hotm.ability ?? '').toLowerCase()) rows.push({ area: 'hotm', id: 'ability', field: 'ability', ours: summary.hotm.ability, theirs: ability });
    rows.push(...mapRows('hotm', summary.hotm.levels, pick(core, 'nodes.mining', 'nodes', 'perks'), 'perks'));
  } else if (summary.hotm) rows.push({ area: 'hotm', id: 'hotm', field: 'SkyCrypt side not found', ours: '', theirs: '?' });
  if (summary.attrLevels) rows.push(...mapRows('attribute', summary.attrLevels, pick(sky, 'attributes.levels', 'attribute_levels'), 'attributes'));
  if (summary.essence) rows.push(...mapRows('essence', summary.essence, pick(sky, 'essence.perks', 'essence_perks', 'perks'), 'essence'));
  if (summary.pets) {
    const theirs = pick(sky, 'pets.pets', 'pets');
    if (!Array.isArray(theirs)) rows.push({ area: 'pet', id: 'pets', field: 'SkyCrypt side not found', ours: '', theirs: '?' });
    else {
      const key = (t, tier) => `${String(t).toUpperCase()} ${String(tier).toUpperCase()}`;
      const tally = (list) => list.reduce((m, k) => m.set(k, (m.get(k) ?? 0) + 1), new Map());
      const [a, b] = [tally(summary.pets.map((p) => key(p.type, p.tier))), tally(theirs.map((p) => key(p.type, p.tier ?? p.rarity)))];
      for (const k of new Set([...a.keys(), ...b.keys()])) if ((a.get(k) ?? 0) !== (b.get(k) ?? 0)) rows.push({ area: 'pet', id: k, field: 'count', ours: a.get(k) ?? 0, theirs: b.get(k) ?? 0 });
      const [oa, ta] = [summary.pets.find((p) => p.active), theirs.find((p) => p.active)];
      if (key(oa?.type, oa?.tier) !== key(ta?.type, ta?.tier ?? ta?.rarity)) rows.push({ area: 'pet', id: 'active', field: 'active', ours: oa ? key(oa.type, oa.tier) : '-', theirs: ta ? key(ta.type, ta.tier ?? ta.rarity) : '-' });
    }
  }
  return rows;
}

const cell = (v) => (Array.isArray(v) ? (v.join(', ') || '-') : v === null || v === undefined || v === '' ? '-' : String(v));
export function renderTable(rows) {
  if (!rows.length) return 'No differences.\n';
  const lines = ['| area | id | field | app | SkyCrypt |', '|---|---|---|---|---|'];
  for (const r of rows) lines.push(`| ${r.area} | ${r.id} | ${r.field} | ${cell(r.ours)} | ${cell(r.theirs)} |`);
  return `${lines.join('\n')}\n`;
}

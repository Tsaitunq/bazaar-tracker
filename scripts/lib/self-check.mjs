// Local check of the import against the game's own tooltips and rules, no second site needed. Reads the private worker answer
// (personal/fixtures/api-profile.json) and reports differences as rows. A row holds item ids, stat ids and numbers: no names, no uuids.
import { readItem, sourcesOf, drillExtras } from '../../apps/guide/import/items.js';
import { decodeInventory, newBudget } from '../../apps/guide/nbt.js';
import { petLevel } from '../../apps/guide/gamedata.js';
import { RARITIES, ENCHANTS, GEMS, GEM_STAT, REFORGES, PARTS, POLARVOID, COATING, CATACOMBS_REFORGE } from '../../apps/guide/optimizer-data.js';

// the totals the app computes itself; the other stats are checked by their parts only
const TOTALS = new Set(['MINING_SPEED', 'MINING_FORTUNE', 'PRISTINE']);
const strip = (s) => String(s).replace(/§./g, '');
const num = (s) => Number(String(s).replace(/,/g, ''));
const statId = (name) => name.trim().toUpperCase().replace(/[' ]+/g, '_');

// ---- the tooltip -----------------------------------------------------------------------------------------------------------------
// "§7Mining Speed: §6+2,160 §9[+50] §9(+75) §d(+75)": the first number is the total, the rest are its parts by colour.
// (§9 round: reforge, §d round: gems, §e round: hot potato books, §9 square: bonuses of the item itself such as the Polarvoid books).
export function parseLore(lore) {
  const stats = {};
  let rarity = null;
  for (const raw of lore ?? []) {
    const m = /^§7([A-Za-z' ]+): §.\+?(-?[\d,.]+)(%?)(.*)$/.exec(raw);
    if (m) {
      const parts = { reforge: 0, gems: 0, hpb: 0, bracket: 0, other: 0 };
      for (const t of m[4].matchAll(/§(.)([[(])\+?(-?[\d,.]+)%?[\])]/g)) {
        const key = t[2] === '[' ? 'bracket' : { 9: 'reforge', d: 'gems', e: 'hpb' }[t[1]] ?? 'other';
        parts[key] += num(t[3]);
      }
      stats[statId(m[1])] = { total: num(m[2]), ...parts };
    }
    const r = /(VERY SPECIAL|SPECIAL|COMMON|UNCOMMON|RARE|EPIC|LEGENDARY|MYTHIC|DIVINE)\b/.exec(strip(raw));
    if (r && /§l/.test(raw)) rarity = r[1].replace(' ', '_');
  }
  return { stats, rarity };
}

// the enchantments line(s): "Efficiency X, Fortune IV" -> { efficiency: 10, fortune: 4 }
// the tooltip says Prismatic where the item data says pristine
const ALIAS = { prismatic: 'pristine' };
const ROMAN = { I: 1, V: 5, X: 10, L: 50 };
const roman = (s) => (/^\d+$/.test(s) ? Number(s) : [...s].reduce((n, c, i, a) => (ROMAN[c] < (ROMAN[a[i + 1]] ?? 0) ? n - ROMAN[c] : n + ROMAN[c]), 0));
export function loreEnchants(lore) {
  const out = {};
  const start = (lore ?? []).findIndex((l) => /^§9/.test(l) && /(?: [IVXL]+|\d+)(?:§9)?(?:,|$)/.test(strip(l)));
  if (start < 0) return out;
  for (const line of lore.slice(start)) {
    if (!strip(line).trim()) break;
    // Compact and Cultivating show a counter after the level ("Compact V 8,608")
    for (const tok of strip(line).replace(/ [\d,]{3,}$/, '').split(/,\s*/)) {
      const m = /^([A-Za-z' -]+?) ([IVXL]+|\d+)$/.exec(tok.trim());
      if (!m) continue;
      const key = m[1].toLowerCase().replace(/[ -]+/g, '_');
      out[ALIAS[key] ?? key] = roman(m[2]);
    }
  }
  return out;
}

// ---- what the app computes for an item -----------------------------------------------------------------------------------------
function ours(item, rarity, e, items) {
  const at = RARITIES.indexOf(rarity);
  const out = {};
  const add = (stat, part, v) => { if (v === undefined || !Number.isFinite(v)) return; (out[stat] ??= { reforge: 0, gems: 0, rest: 0, base: 0 })[part] += v; };
  for (const [s, v] of Object.entries(items?.[item.id]?.stats ?? {})) add(s, 'base', v);
  if (at >= 0) {
    for (const [s, list] of Object.entries(REFORGES[item.reforge] ?? {})) add(s, 'reforge', list[at]);
    for (const g of item.gems) if (GEM_STAT[g.type]) add(GEM_STAT[g.type], 'gems', GEMS[g.type]?.[g.quality]?.[at]);
  }
  // lapidary adds its speed only while mining gemstones: the tooltip total does not hold it
  for (const [name, level] of Object.entries(item.enchants)) if (!ENCHANTS[name]?.gemstonesOnly) for (const [s, list] of Object.entries(ENCHANTS[name]?.stats ?? {})) add(s, 'rest', list[level - 1]);
  for (const id of Object.values(item.parts)) for (const [s, v] of Object.entries(PARTS[String(id).toUpperCase()]?.stats ?? {})) add(s, 'rest', v);
  if (item.polarvoid) { add('MINING_SPEED', 'rest', POLARVOID.speed * Math.min(item.polarvoid, POLARVOID.max)); add('MINING_FORTUNE', 'rest', POLARVOID.fortune); }
  if (item.coating) for (const [s, v] of Object.entries(items?.[item.id]?.category === 'DRILL' ? COATING.drill : COATING.other)) add(s, 'rest', v);
  return out;
}

// All items of the answer with their tooltip: { item (readItem), rarity, stats (tooltip), enchants (tooltip), name part }.
export async function tooltips(inventories) {
  const budget = newBudget();
  const out = [];
  for (const { at, data } of sourcesOf(inventories ?? {})) {
    let slots;
    try { slots = await decodeInventory(data, budget); } catch { continue; }
    for (const raw of slots) {
      const item = readItem(raw, at[0]);
      if (!item) continue;
      const lore = parseLore(raw.tag.display?.Lore);
      out.push({ item, place: at[0], e: raw.tag.ExtraAttributes, rarity: lore.rarity, stats: lore.stats, extras: drillExtras(raw.tag.display?.Lore), loreEnchants: loreEnchants(raw.tag.display?.Lore), name: strip(raw.tag.display?.Name ?? '') });
    }
  }
  return out;
}

// a) item against tooltip. A row per item id, stat and part; the same row from several copies of an item is counted once with n.
export function checkItems(list, items) {
  const rows = new Map();
  const skipped = new Set();
  const tooltipOnly = new Set();
  const row = (id, stat, part, tooltip, mine, extra = '') => {
    const key = `${id}|${stat}|${part}|${tooltip}|${mine}`;
    rows.set(key, { area: 'item', id, field: `${stat} ${part}`.trim(), tooltip, ours: mine, note: extra, n: (rows.get(key)?.n ?? 0) + 1 });
  };
  for (const t of list) {
    const { item } = t;
    // reforge prefix in the name and the enchantments of the tooltip
    if (item.reforge && !t.name.toLowerCase().includes(item.reforge.toLowerCase())) row(item.id, 'name', 'reforge prefix', t.name.split(' ')[0].toLowerCase(), item.reforge);
    for (const [name, level] of Object.entries(t.loreEnchants)) {
      const have = item.enchants[name] ?? item.enchants[`ultimate_${name}`];
      if (have === undefined) tooltipOnly.add(`${item.id} ${name}`);
      else if (have !== level) row(item.id, `enchant ${name}`, 'level', level, have);
    }
    if (!t.rarity) continue;
    const mine = ours(item, t.rarity, t.e, items);
    for (const [stat, tip] of Object.entries(t.stats)) {
      const m = mine[stat];
      // The app models some stats only: a gem type with a stat, a reforge with a table, the bracket of the Polarvoid books. A part it
      // does not model is no difference; it is counted as not modelled.
      const gemsKnown = !tip.gems || Object.values(GEM_STAT).includes(stat);
      const reforgeKnown = !tip.reforge || !!REFORGES[item.reforge]?.[stat];
      const restKnown = !tip.hpb && !tip.other && (!tip.bracket || (item.polarvoid && (stat === 'MINING_SPEED' || stat === 'MINING_FORTUNE')));
      // withered and ancient add one point per Catacombs level; the answer has no Catacombs level
      const levelBound = !!CATACOMBS_REFORGE[item.reforge]?.[stat];
      if (!gemsKnown || !reforgeKnown || levelBound) { skipped.add(`${item.id} ${stat}`); continue; }
      if (tip.gems || m?.gems) if ((m?.gems ?? 0) !== tip.gems) row(item.id, stat, 'gems', tip.gems, m?.gems ?? 0, t.rarity);
      if (tip.reforge || m?.reforge) if ((m?.reforge ?? 0) !== tip.reforge) row(item.id, stat, 'reforge', tip.reforge, m?.reforge ?? 0, t.rarity);
      // the total: only for a stat the app has a base for, with every part of it modelled
      if (m && m.base && restKnown && TOTALS.has(stat) && !item.stars) {
        const sum = m.base + m.reforge + m.gems + m.rest;
        // what the total leaves out (drillExtras): the Polarvoid bracket, the engine's line, a module's grant
        const game = tip.total + (t.extras?.[stat] ?? 0);
        if (Math.abs(sum - game) > 0.051) row(item.id, stat, 'total', game, Math.round(sum * 100) / 100, t.rarity);
      }
    }
  }
  const out = [...rows.values()];
  out.skipped = skipped.size;
  out.tooltipOnly = tooltipOnly.size;
  return out;
}

// ---- b) HOTM -----------------------------------------------------------------------------------------------------------------------
// Cost to reach level N of a perk = floor((N + offset) ^ exp); Core of the Mountain has its own table. Levels the API gives are
// capped at the perk's maximum, as the import does.
export function hotmCosts(hotm, data) {
  const spent = { mithril: 0, gemstone: 0, glacite: 0 };
  let tokens = 0;
  let unknown = 0;
  const nodes = hotm.nodes?.mining ?? hotm.nodes ?? {};
  for (const p of data.hotm.perks) {
    const level = Math.min(nodes[p.id] ?? 0, p.maxLevel);
    if (!level) continue;
    // The Core of the Mountain costs a token, but its powder is not in powder_spent (checked: all three kinds match to the coin without it).
    if (p.type !== 'ability') tokens++;
    if (p.id === 'core_of_the_mountain') continue;
    if (!p.cost?.powder) { if (p.unknown) unknown++; continue; }
    for (let n = 2; n <= level; n++) spent[p.cost.powder] += Math.floor((n + p.cost.offset) ** p.cost.exp);
  }
  return { spent, tokens, unknown };
}

export function checkHotm(answer, data) {
  const h = answer.hotm;
  if (!h) return [];
  const { spent, tokens, unknown } = hotmCosts(h, data);
  const rows = [];
  for (const [kind, p] of Object.entries(h.powder ?? {})) if (Number.isFinite(p.spent) && spent[kind] !== p.spent) rows.push({ area: 'hotm', id: `powder_spent_${kind}`, field: 'powder', tooltip: p.spent, ours: spent[kind], note: unknown ? `${unknown} perks without a cost formula` : '' });
  const tokensSpent = Object.values(h.tokensSpent ?? {}).reduce((n, v) => n + (Number.isFinite(v) ? v : 0), 0);
  const ownTokens = h.tokensSpent?.mountain;
  if (Number.isFinite(ownTokens) && ownTokens !== tokens) rows.push({ area: 'hotm', id: 'tokens_spent', field: 'tokens', tooltip: ownTokens, ours: tokens, note: `all trees ${tokensSpent}` });
  return rows;
}

// ---- c) plausibility -----------------------------------------------------------------------------------------------------------
export function checkPlausible(answer, list, data, items) {
  const rows = [];
  const bad = (id, field, tooltip, mine, note = '') => rows.push({ area: 'plausible', id, field, tooltip, ours: mine, note });
  // attribute stacks never above what the rarity's table needs for the maximum
  const byKey = new Map(data.attributes.attributes.flatMap((a) => [[a.key, a], [a.id.replace(/^ATTRIBUTE_SHARD_/, '').toLowerCase(), a]]));
  for (const [key, n] of Object.entries(answer.attributes?.stacks ?? {})) {
    const a = byKey.get(key);
    if (!a) { bad(key, 'attribute', n, 'unknown key'); continue; }
    const max = data.attributes.shardsPerLevel[a.rarity].slice(0, a.maxLevel).reduce((x, y) => x + y, 0);
    if (n > max) bad(a.key, 'attribute stacks above the maximum', n, max);
  }
  // a gem sits only in a slot the item has unlocked
  for (const t of list) {
    for (const g of t.item.gems) {
      const [, type, n] = /^(.*)_(d+)$/.exec(g.slot) ?? [];
      const slots = (items?.[t.item.id]?.gemstone_slots ?? []).filter((s) => s.slot_type === type);
      const slot = slots[Number(n)];
      // a slot without a cost is open from the start
      if (slot?.costs && !t.item.unlocked.includes(g.slot)) bad(t.item.id, 'gem in a locked slot', g.slot, 'unlocked: ' + t.item.unlocked.join(','));
    }
  }
  // the worn set of the wardrobe is empty there and the armor is worn
  const w = answer.inventories?.wardrobe;
  if (w?.equipped !== undefined && w.equipped !== null) {
    const worn = list.filter((t) => t.place === 'Getragen').length;
    if (!worn) bad('wardrobe', 'a set is marked worn but no armor is worn', w.equipped, 0);
  }
  // pets never above their level cap
  for (const p of answer.pets ?? []) {
    const l = petLevel(p.exp ?? 0, p.tier, p.type, data.pets.leveling);
    if (l && l.level > l.max) bad(p.type, 'pet level above the cap', l.level, l.max);
    if (!l) bad(p.type, 'pet level not computable', p.tier, '-');
  }
  return rows;
}

const cell = (v) => (v === undefined || v === null || v === '' ? '-' : String(v));
export function renderTable(rows) {
  if (!rows.length) return 'No differences.\n';
  const lines = ['| area | id | field | game | app | n | note |', '|---|---|---|---|---|---|---|'];
  for (const r of rows) lines.push(`| ${r.area} | ${r.id} | ${r.field} | ${cell(r.tooltip)} | ${cell(r.ours)} | ${r.n ?? 1} | ${cell(r.note)} |`);
  return `${lines.join('\n')}\n`;
}

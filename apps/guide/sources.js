// What the import adds up by itself from gamedata/stat-sources.json: skills, slayers, SkyBlock level, the accessory bag, the game's base stats,
// and the buff values (God Potion, Booster Cookie). Pure functions, no DOM. Every contribution says whether its value is safe (two sources agree).
// Without a profile nothing in here is used: the stats stay as the measurement and the build give them.

const count = (totals, xp) => totals.filter((t) => xp >= t).length;
const sum = (values, n) => values.slice(0, n).reduce((a, b) => a + b, 0);
const upper = (k) => String(k).toUpperCase();
const safe = (s) => s?.confidence === 'safe';

// The skills of the game's skill average (wiki Skill Average): Carpentry, Runecrafting and Social do not count.
export const AVERAGE_SKILLS = ['farming', 'mining', 'combat', 'foraging', 'fishing', 'enchanting', 'alchemy', 'taming'];

// Level from the XP, the first level above each cumulative total.
export const levelFor = count;

function collector() {
  const add = {};
  const contrib = {};
  const put = (stat, part, label, value, series, note = null) => {
    if (!Number.isFinite(value) || Math.abs(value) < 1e-9) return;
    add[stat] = (add[stat] ?? 0) + value;
    (contrib[stat] ??= []).push({ part, label, value, unsafe: !(Array.isArray(series) ? series.every(safe) : safe(series)), note: note ?? [series].flat().map((s) => s?.note).find(Boolean) ?? null });
  };
  return { add, contrib, put };
}

// The buffs of the build with the values of stat-sources.json. { add, contrib }: contrib in the same form as sourcesOf gives.
export function buffsOf(buffs, ss) {
  const { add, contrib, put } = collector();
  if (buffs?.godPotion) for (const [stat, s] of Object.entries(ss.godPotion.stats)) put(stat, 'godPotion', 'God Potion', s.value, s);
  if (buffs?.boosterCookie) for (const [stat, s] of Object.entries(ss.boosterCookie.stats)) put(stat, 'cookie', 'Booster Cookie', s.value, s);
  return { add, contrib };
}

// profile: the summary of the import (numbers and ids only). ss: gamedata.statSources. items: items.json (stats and family per id), null while it loads.
// buffs: build.buffs. Gives
//   add      flat stats of skills, slayers, level and accessories (no base, no buffs)
//   base     the stats every player starts with
//   buffs    what the buffs switched on give
//   contrib  per stat: every part with its value and whether it is unsafe
//   levels   { skills: {id: {level, max}}, slayers: {boss: {level, max}}, skyblock: {xp, level, max} | null }
//   unknown  accessories without stats in the item list, enrichments without a value
//   off      what could not be counted at all and why
export function sourcesOf({ profile, ss, items = null, buffs = null }) {
  const { add, contrib, put } = collector();
  const levels = { skills: {}, slayers: {}, skyblock: null };
  const unknown = { accessories: [], enrichments: [] };
  const off = [];

  if (profile.skills) {
    for (const [id, e] of Object.entries(ss.skills)) {
      const xp = profile.skills[`SKILL_${upper(id)}`];
      if (typeof xp !== 'number') continue;
      const level = count(e.xpTotal, xp);
      levels.skills[id] = { level, max: e.maxLevel };
      for (const [stat, s] of Object.entries(e.stats)) put(stat, 'skills', `${id[0].toUpperCase()}${id.slice(1)} ${level}`, sum(s.values, level), [s, e.xp]);
    }
  } else off.push('Skills API is off: skill stats are missing.');

  if (profile.slayer) {
    for (const [boss, e] of Object.entries(ss.slayers)) {
      const xp = profile.slayer[boss];
      if (typeof xp !== 'number') continue;
      const level = count(e.xp.values, xp);
      levels.slayers[boss] = { level, max: e.maxLevel };
      for (const [stat, s] of Object.entries(e.stats)) put(stat, 'slayer', `${boss[0].toUpperCase()}${boss.slice(1)} slayer ${level}`, sum(s.values, level), [s, e.xp]);
    }
  } else off.push('Sync again to read your slayer levels.');

  const sb = ss.skyblockLevel;
  if (typeof profile.skyblockXp === 'number') {
    const level = Math.min(Math.floor(profile.skyblockXp / sb.xpPerLevel.value), sb.maxLevel.value);
    levels.skyblock = { xp: profile.skyblockXp, level, max: sb.maxLevel.value };
    for (const [stat, s] of Object.entries(sb.perLevel)) put(stat, 'level', `SkyBlock level ${level}`, s.value * level, [s, sb.xpPerLevel]);
    for (const [stat, s] of Object.entries(sb.perFiveLevels)) put(stat, 'level', `SkyBlock level ${level}`, s.value * Math.floor(level / 5), [s, sb.xpPerLevel]);
  } else off.push('SkyBlock level: the worker does not send it yet (deploy the updated worker, then sync).');

  // The accessory bag: one accessory per family counts, the one with the larger stats. Reforges give nothing (stat-sources accessories.reforges).
  const bag = (profile.items ?? []).filter((i) => i.at?.includes('Accessory Bag'));
  if (!items) off.push('Item data missing: accessories are not counted.');
  else {
    const weight = (id) => Object.values(items[id]?.stats ?? {}).reduce((n, v) => n + Math.abs(v), 0);
    const best = new Map();
    for (const item of bag) {
      const family = items[item.id]?.family ?? item.id;
      if (!best.has(family) || weight(item.id) > weight(best.get(family).id)) best.set(family, item);
    }
    const missing = new Set();
    for (const item of best.values()) {
      const stats = items[item.id]?.stats;
      if (!stats || !Object.keys(stats).length) missing.add(item.id);
      for (const [stat, v] of Object.entries(stats ?? {})) put(upper(stat), 'accessories', 'Accessories', v, null);
      if (item.enrichment) {
        const stat = upper(item.enrichment);
        const e = ss.accessories.enrichments.values[stat];
        if (e) put(stat, 'accessories', 'Enrichments', e.value, e);
        else unknown.enrichments.push(item.enrichment);
      }
    }
    unknown.accessories = [...missing].sort();
    unknown.enrichments = [...new Set(unknown.enrichments)].sort();
  }

  const base = {};
  for (const [stat, s] of Object.entries(ss.baseStats)) {
    base[stat] = s.value;
    (contrib[stat] ??= []).push({ part: 'base', label: 'Game base', value: s.value, unsafe: !safe(s), note: s.note ?? null });
  }
  const b = buffsOf(buffs, ss);
  for (const [stat, list] of Object.entries(b.contrib)) (contrib[stat] ??= []).push(...list);
  return { add, base, buffs: b.add, contrib, levels, unknown, off };
}

// The unsafe contributions behind a stat, as text lines, for a stat that still shows a gap after the measurement.
export function unsafeLines(contrib, stat) {
  return (contrib[stat] ?? []).filter((c) => c.unsafe).map((c) => ({ ...c, text: `${c.label} ${c.value > 0 ? '+' : ''}${Math.round(c.value * 100) / 100}${c.note ? ` (${c.note})` : ''}` }));
}

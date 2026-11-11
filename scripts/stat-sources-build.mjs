// Collects the stat sources (skills, slayers, fairy souls, SkyBlock level, cookie, god potion, accessories) into gamedata/stat-sources.json
// and writes docs/stat-sources-report.md. Needs the network: node scripts/stat-sources-build.mjs
// Primary source is hypixelskyblock.minecraft.wiki, the second is the NEU repo (constants/) or, where there is none, data the app already has.
// A value is "safe" when two sources agree, otherwise "unsafe" with the sources and the levels that differ. Nothing is guessed.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { BASE_STATS, ACCESSORY_REFORGES, confirmByGame } from './lib/stat-sources-extra.mjs';
import {
  statId, parseRewardTable, parseSlayerLevels, parseSlayerOverview, parseCookie, parseGodPotionEffects, parseEnrichments, expandNeu, series, cumulative,
} from './lib/stat-sources.mjs';

const UA = { 'User-Agent': 'bazaar-tracker-gamedata/1.0' };
const DATE = new Date().toISOString().slice(0, 10);
const wikiText = async (title) => {
  const url = `https://hypixelskyblock.minecraft.wiki/api.php?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&format=json&redirects=1`;
  const j = await (await fetch(url, { headers: UA })).json();
  if (!j.parse) throw new Error(`wiki page ${title}: ${JSON.stringify(j.error)}`);
  return j.parse.wikitext['*'];
};
const neu = async (file) => (await fetch(`https://raw.githubusercontent.com/NotEnoughUpdates/NotEnoughUpdates-REPO/master/constants/${file}.json`, { headers: UA })).json();
const read = (f) => JSON.parse(readFileSync(new URL(`../gamedata/${f}.json`, import.meta.url), 'utf8'));

const statIds = new Set(read('stats').stats.map((s) => s.id));
const NEU_STAT = { defence: 'DEFENSE', health: 'HEALTH', strength: 'STRENGTH', intelligence: 'INTELLIGENCE', crit_chance: 'CRITICAL_CHANCE', crit_damage: 'CRITICAL_DAMAGE', speed: 'SPEED', pet_luck: 'PET_LUCK', ability_damage: 'ABILITY_DAMAGE' };
const slug = (name) => name.replace(/\[\[|\]\]/g, '').split(/\s+/).map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w[0].toLowerCase() + w.slice(1))).join('');
const fill = (values, n) => Array.from({ length: n }, (_, i) => values?.[i] ?? 0);

const [leveling, bonuses, fairy] = await Promise.all([neu('leveling'), neu('bonuses'), neu('fairy_souls')]);
const neuStats = (key, levels) => {
  const expanded = expandNeu(bonuses.bonus_stats[key] ?? {}, levels);
  return Object.fromEntries(Object.entries(expanded).filter(([k]) => NEU_STAT[k]).map(([k, v]) => [NEU_STAT[k], fill(v, levels)]));
};

// ---- skills ---------------------------------------------------------------------------------------------------------------------

const SKILLS = { mining: 'Mining', combat: 'Combat', farming: 'Farming', foraging: 'Foraging', fishing: 'Fishing', enchanting: 'Enchanting', alchemy: 'Alchemy', carpentry: 'Carpentry', social: 'Social', hunting: 'Hunting' };
const skills = {};
for (const [key, page] of Object.entries(SKILLS)) {
  const table = parseRewardTable(await wikiText(`${page}/Leveling Rewards`));
  const wikiName = `wiki ${page}/Leveling Rewards`;
  const col = (re) => Object.entries(table.columns).find(([n]) => re.test(n))?.[1];
  const xp = col(/^xp/i);
  const n = table.levels;
  const entry = {
    maxLevel: n,
    xp: series([{ name: wikiName, values: xp.perLevel }, { name: 'NEU leveling.json', values: key === 'social' ? leveling.social : leveling.leveling_xp }]),
    stats: {}, other: {},
  };
  entry.xpTotal = cumulative(entry.xp.values);
  if (table.problems.length) entry.problems = table.problems;
  const neuS = neuStats(`skill_${key}`, n);
  for (const [name, c] of Object.entries(table.columns)) {
    if (c === xp || /^coins$/i.test(name)) continue;
    if (/^skyblock xp$/i.test(name)) { entry.sbXp = series([{ name: wikiName, values: c.perLevel }]); continue; }
    const id = c.stat ? statId(c.stat) : null;
    if (id && statIds.has(id)) {
      entry.stats[id] = series([{ name: wikiName, values: c.perLevel }, ...(neuS[id] ? [{ name: 'NEU bonuses.json', values: neuS[id] }] : [])]);
    } else {
      const neuDamage = key === 'combat' && /damage/i.test(name) ? fill(expandNeu(bonuses.bonus_stats.skill_combat, n).damage_increase, n).map((v) => v * 100) : null;
      entry.other[slug(name)] = { unit: c.percent ? 'percent' : 'points', ...series([{ name: wikiName, values: c.perLevel }, ...(neuDamage ? [{ name: 'NEU bonuses.json (damage_increase x100)', values: neuDamage }] : [])]) };
    }
  }
  skills[key] = entry;
}

// Taming and Runecrafting have no reward table on the wiki: the XP come from NEU alone, the stats from the Zoologist text and NEU.
{
  const taming = await wikiText('Taming');
  const pl = /each level of Zoologist grants \+(\d+)% Pet XP gained and \{\{stat\|pl\|\+(\d+)\}\}/i.exec(taming);
  const n = 60; // wiki Skills: Taming goes to 60; NEU leveling_caps says 50
  skills.taming = {
    maxLevel: n,
    xp: series([{ name: 'NEU leveling.json', values: leveling.leveling_xp.slice(0, n) }], 'no XP table on the wiki Taming page; NEU leveling_caps.taming is 50, the wiki Skills page says 60'),
    stats: pl ? { PET_LUCK: series([{ name: 'wiki Taming (Zoologist)', values: fill([], n).map(() => Number(pl[2])) }, { name: 'NEU bonuses.json', values: neuStats('skill_taming', n).PET_LUCK }]) } : {},
    other: pl ? { petXpPercent: { unit: 'percent', ...series([{ name: 'wiki Taming (Zoologist)', values: fill([], n).map(() => Number(pl[1])) }]) } } : {},
  };
  skills.taming.xpTotal = cumulative(skills.taming.xp.values);
  const rc = leveling.runecrafting_xp;
  skills.runecrafting = {
    maxLevel: rc.length,
    xp: series([{ name: 'NEU leveling.json runecrafting_xp', values: rc }], 'no XP table on the wiki Runecrafting page'),
    stats: {}, other: {}, note: 'wiki Runecrafting: leveling unlocks runes only; NEU bonuses.json has no stats for it either',
  };
  skills.runecrafting.xpTotal = cumulative(rc);
}

// ---- slayers --------------------------------------------------------------------------------------------------------------------

const BOSS = { zombie: 'Zombie Slayer', spider: 'Spider Slayer', wolf: 'Wolf Slayer', enderman: 'Enderman Slayer', blaze: 'Blaze Slayer', vampire: 'Vampire Slayer' };
const overview = parseSlayerOverview(await wikiText('Slayer'));
const slayers = {};
for (const [key, page] of Object.entries(BOSS)) {
  const levels = parseSlayerLevels(await wikiText(page));
  const n = levels.length;
  const sources = [{ name: `wiki ${page}`, values: levels.map((l) => l.xp) }, { name: 'wiki Slayer (overview table)', values: overview[key] ?? [] }];
  if (leveling.slayer_xp[key]) sources.push({ name: 'NEU leveling.json slayer_xp', values: leveling.slayer_xp[key] });
  const entry = { maxLevel: n, xp: series(sources, 'XP needed in total for each level'), stats: {}, other: {} };
  const ids = [...new Set(levels.flatMap((l) => Object.keys(l.stats)))];
  const neuS = neuStats(`slayer_${key}`, n);
  for (const id of ids) {
    const values = levels.map((l) => l.stats[id] ?? 0);
    const target = statIds.has(id) ? entry.stats : entry.other;
    target[id] = series([{ name: `wiki ${page}`, values }, ...(neuS[id] ? [{ name: 'NEU bonuses.json', values: neuS[id] }] : [])]);
  }
  // a stat that NEU lists and the wiki table does not
  for (const id of Object.keys(neuS)) if (!ids.includes(id)) entry.stats[id] = series([{ name: `wiki ${page}`, values: fill([], n) }, { name: 'NEU bonuses.json', values: neuS[id] }]);
  const unknown = levels.flatMap((l) => l.unknown.map((u) => `${u} at level ${l.level}`));
  if (unknown.length) entry.unknown = unknown;
  entry.sbXp = series([{ name: `wiki ${page}`, values: levels.map((l) => l.sbXp ?? 0) }]);
  slayers[key] = entry;
}

// ---- fairy souls, SkyBlock level -----------------------------------------------------------------------------------------------

const fairyPage = await wikiText('Fairy Souls');
const tiaPage = await wikiText('Tia the Fairy');
const exchangeXp = (t) => Number(/receive \{\{SkyBlock XP\|(\d+)\}\}/.exec(t)?.[1]);
const fairySouls = {
  total: { value: Number(/currently \{\{Green\|(\d+)\}\} Fairy Souls/.exec(fairyPage)?.[1]), src: ['wiki Fairy Souls', 'NEU fairy_souls.json (Max Souls)'], confidence: fairy['Max Souls'] === Number(/currently \{\{Green\|(\d+)\}\} Fairy Souls/.exec(fairyPage)?.[1]) ? 'safe' : 'unsafe', neu: fairy['Max Souls'] },
  perExchange: { souls: 5, sbXp: exchangeXp(fairyPage), src: ['wiki Fairy Souls', 'wiki Tia the Fairy'], confidence: exchangeXp(fairyPage) === exchangeXp(tiaPage) ? 'safe' : 'unsafe', note: 'both are wiki pages; NEU has no exchange data' },
  statsPerExchange: {},
  statsNote: { src: ['wiki Fairy Souls (History 0.15)'], confidence: 'unsafe', text: /Removed permanent stats from '''Fairy Souls'''/.test(fairyPage) ? 'Since 0.15 fairy souls give no permanent stats, only SkyBlock XP and backpack slots. Fairy Armor (Fairy\'s Outfit) gives +1 Health per soul found as a set bonus (wiki Health).' : 'not found' },
};

const levelsPage = await wikiText('SkyBlock Levels');
const sbHealth = /For every level:<br>\{\{DG\|\+\}\}\{\{Green\|(\d+)\}\} \{\{stat\|health\}\}/.exec(levelsPage)?.[1];
const sbStrength = /For every 5 levels:<br>\{\{DG\|\+\}\}\{\{Green\|(\d+)\}\} \{\{stat\|strength\}\}/.exec(levelsPage)?.[1];
const sbXpPer = /\{\{DarkAqua\|1 SkyBlock Level\}\} for every \{\{SkyBlock XP\|(\d+)\}\}/.exec(levelsPage)?.[1];
const skyblockLevel = {
  xpPerLevel: { value: Number(sbXpPer), src: ['wiki SkyBlock Levels'], confidence: 'unsafe', note: 'one source' },
  maxLevel: { value: 500, src: ['wiki SkyBlock Levels (bug note: "the cap of 500")'], confidence: 'unsafe', note: 'one source; the cap of 500 is named in a bug note, not in the rewards section' },
  perLevel: { HEALTH: { value: Number(sbHealth), src: ['wiki SkyBlock Levels'], confidence: 'unsafe', note: 'one source' } },
  perFiveLevels: { STRENGTH: { value: Number(sbStrength), src: ['wiki SkyBlock Levels'], confidence: 'unsafe', note: 'one source; "for every 5 levels" is read as at levels 5, 10, 15 and so on' } },
};

// ---- booster cookie and god potion -----------------------------------------------------------------------------------------------

const cookie = parseCookie(await wikiText('Booster Cookie'));
const power = read('power');
const appCookie = Object.fromEntries(power.boosterCookie.effects.map((e) => [e.stat, e.value]));
const WISDOM = ['COMBAT_WISDOM', 'MINING_WISDOM', 'FARMING_WISDOM', 'FORAGING_WISDOM', 'FISHING_WISDOM', 'ENCHANTING_WISDOM', 'ALCHEMY_WISDOM'];
const cookieStats = { ...Object.fromEntries(WISDOM.map((id) => [id, cookie.wisdom])), MAGIC_FIND: cookie.magicFind };
const boosterCookie = {
  days: cookie.days,
  stats: Object.fromEntries(Object.entries(cookieStats).map(([id, value]) => [id, {
    value, src: ['wiki Booster Cookie', 'gamedata/power.json (taken from the same wiki page)'], confidence: 'unsafe',
    note: appCookie[id] === value ? 'agrees with gamedata/power.json, but that file comes from the same wiki page; NEU has nothing on the cookie' : `gamedata/power.json says ${appCookie[id]}`,
  }])),
  other: 'Also: Social Wisdom is not in the wiki list ("on all Wisdom stats" is read as the seven skills of gamedata/power.json); bits, keep coins on death and the commands are no stats.',
};

const effects = parseGodPotionEffects(await wikiText('God Potion Effect'));
const potionPage = await wikiText('God Potion');
const listed = [...potionPage.matchAll(/\{\{PotionName\|([^}]+)\}\}|\[\[Jerry Candy\|'''(Jerry Candy)'''\]\]/g)].map((m) => (m[1] ?? m[2]).trim());
const isListed = (name) => listed.some((l) => name === l || name.startsWith(`${l} `));
const inPotion = Object.fromEntries(Object.entries(effects).filter(([name]) => isListed(name)));
const { GOD_POTION } = await import('../apps/guide/stats.js');
const totals = {};
for (const [name, stats] of Object.entries(inPotion)) for (const [id, v] of Object.entries(stats)) if (!id.startsWith('?')) totals[id] = Math.round(((totals[id] ?? 0) + v) * 100) / 100;
const godStats = Object.fromEntries(Object.entries(totals).map(([id, value]) => {
  const app = GOD_POTION[id];
  const row = { value, src: ['wiki God Potion Effect (sum of the effects of the God Potion)'], confidence: 'unsafe', note: 'one source' };
  if (app !== undefined) {
    row.src.push('apps/guide/stats.js GOD_POTION (typed from the game)');
    if (Math.abs(app - value) < 1e-9) { row.confidence = 'safe'; delete row.note; } else { row.note = `the app has ${app}`; row.app = app; }
  }
  return [id, row];
}));
const godPotion = {
  effects: inPotion,
  stats: godStats,
  notInWikiSum: Object.keys(GOD_POTION).filter((id) => totals[id] === undefined),
  effectsWithoutStats: listed.filter((n) => !Object.keys(effects).some((e) => e === n || e.startsWith(`${n} `))),
  note: 'The wiki table lists the stat of each effect; Jerry Candy is counted because the potion page lists it. Speed and Health Regen are summed as listed and may be capped in the game. Effects with no stat (Absorption, Mana, dodge, ...) are not stats here.',
};

// ---- accessories and enrichments ---------------------------------------------------------------------------------------------------

const items = (await (await fetch('https://api.hypixel.net/v2/resources/skyblock/items', { headers: UA })).json()).items;
const EQUIPMENT = new Set(['ACCESSORY', 'NECKLACE', 'CLOAK', 'BELT', 'GLOVES']);
const gear = items.filter((i) => EQUIPMENT.has(i.category));
const hasStats = (i) => i.stats && Object.keys(i.stats).length > 0;
const byCategory = {};
for (const i of gear) {
  const c = (byCategory[i.category] ??= { total: 0, withStats: 0 });
  c.total++;
  if (hasStats(i)) c.withStats++;
}
let guideGaps = null;
if (existsSync('personal/guides')) {
  const ids = new Set();
  for (const f of readdirSync('personal/guides').filter((x) => x.endsWith('.json'))) {
    const g = JSON.parse(readFileSync(`personal/guides/${f}`, 'utf8'));
    for (const s of g.sections) for (const st of s.steps) for (const d of [st.detect ?? []].flat()) for (const slot of (typeof d.on === 'string' ? g.groups?.[d.on] : d.on) ?? []) for (const id of slot) ids.add(id);
  }
  const byId = new Map(items.map((i) => [i.id, i]));
  const inGuides = [...ids].map((id) => byId.get(id)).filter((i) => i && EQUIPMENT.has(i.category));
  guideGaps = { inGuides: inGuides.length, withoutStats: inGuides.filter((i) => !hasStats(i)).map((i) => i.id).sort() };
}
const enrich = parseEnrichments(await wikiText('Enrichments'));
const accessories = {
  src: 'Hypixel resources/skyblock/items (read by the app at run time through shared/names.js; not stored in the repo)',
  collected: DATE,
  items: { total: gear.length, withStats: gear.filter(hasStats).length, byCategory },
  gaps: 'Items with no stats in the item list: the wiki infobox of each item is the only source found (not collected: ~270 pages).',
  guideGaps,
  statKeys: 'The item list mixes UPPER_SNAKE and lower_snake stat keys (for example MINING_FORTUNE and wheat_fortune); a reader must normalise them.',
  reforges: ACCESSORY_REFORGES,
  enrichments: {
    minRarity: 'LEGENDARY', perAccessory: 1, maxEnrichmentKinds: 68,
    values: Object.fromEntries(Object.entries(enrich).map(([id, value]) => [id, { value, src: ['wiki Enrichments'], confidence: 'unsafe', note: 'one source' }])),
    perRarity: null,
    note: 'The wiki gives one flat value per enrichment and no value per rarity; "Legendary or higher" is only the requirement. No value per rarity was found in either source.',
  },
};

// ---- write ----------------------------------------------------------------------------------------------------------------------

const data = {
  src: `hypixelskyblock.minecraft.wiki and NotEnoughUpdates-REPO constants/ (collected ${DATE}). Every series is { values, src, confidence }: safe = two sources agree, unsafe = one source or they differ (diff lists the levels). values[i] is the value of level i + 1.`,
  skills, slayers, fairySouls, skyblockLevel, boosterCookie, godPotion, accessories, baseStats: BASE_STATS,
};
confirmByGame(data);
writeFileSync(new URL('../gamedata/stat-sources.json', import.meta.url), `${JSON.stringify(data, null, 1)}\n`);

// the report: everything that is not safe, and what was not found
const rows = [];
const walk = (node, path) => {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return;
  if (node.confidence) {
    if (node.confidence === 'unsafe') rows.push({ path, src: node.src, why: node.diff ? `differs at level ${node.diff.length > 6 ? `${node.diff.slice(0, 6).join(', ')} … (${node.diff.length})` : node.diff.join(', ')}${node.app !== undefined ? '' : ''}` : node.note ?? '' });
    return;
  }
  for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
};
walk(data, '');
const problems = Object.entries(skills).flatMap(([k, v]) => (v.problems ?? []).map((p) => `skills.${k}: ${p}`));
const safe = JSON.stringify(data).split('"confidence":"safe"').length - 1;
const unsafe = rows.length;
const table = rows.map((r) => `| ${r.path} | ${r.src.join('; ')} | ${r.why} |`).join('\n');
const report = `# Stat sources: what is not safe

Generated by \`node scripts/stat-sources-build.mjs\` on ${DATE}. Data in \`gamedata/stat-sources.json\`. Safe means two sources agree (the wiki and NEU, or the wiki and a value the app already has); everything below is one source or the sources differ. ${safe} values are safe, ${unsafe} are not.

## Not found

- Fairy soul exchange stats: there are none. The wiki says fairy souls stopped giving permanent stats in 0.15 (SkyBlock XP and backpack slots only). One source, not checked in game.
- Taming: no XP table on the wiki; the XP come from NEU alone, and NEU gives the cap as 50 where the wiki says 60.
- Runecrafting: no XP table or reward table on the wiki; XP from NEU alone, no stats in either.
- Enrichment values per rarity: neither source has any; the wiki gives one flat value and "Legendary or higher" as the requirement.
- Base stats of accessories: the item list has stats for ${accessories.items.withStats} of ${accessories.items.total} accessories and equipment pieces. The rest are only on the wiki, one page each, and are not collected.${guideGaps ? ` Of the ${guideGaps.inGuides} accessory and equipment ids the guides use, these have no stats: ${guideGaps.withoutStats.join(', ') || 'none'}.` : ''}
- SkyBlock level rewards besides +${sbHealth} Health per level and +${sbStrength} Strength per 5 levels: none listed.
- Social Wisdom in the Booster Cookie: the wiki says "on all Wisdom stats"; the list of skills is not given.

## The wiki disagrees with itself

${problems.length ? problems.map((p) => `- ${p}`).join('\n') : 'none'}

## Not safe

| Value | Sources | Why |
|---|---|---|
${table}
`;
writeFileSync(new URL('../docs/stat-sources-report.md', import.meta.url), report);
console.log(`safe ${safe}, unsafe ${unsafe}`);

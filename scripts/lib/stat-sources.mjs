// Parsers and cross-checks for gamedata/stat-sources.json. Pure: text in, data out; the network is in scripts/stat-sources-build.mjs.
// A series is { values, src, confidence }: values[i] is the value of level i + 1; confidence is "safe" when two sources agree and
// "unsafe" otherwise (one source, or the sources differ; then diff lists the levels).

// Stat templates of the wiki use ids and abbreviations; these are the ids of gamedata/stats.json.
export const STAT_ID = {
  defense: 'DEFENSE', def: 'DEFENSE', defence: 'DEFENSE', health: 'HEALTH', hp: 'HEALTH', strength: 'STRENGTH', str: 'STRENGTH',
  crit_chance: 'CRITICAL_CHANCE', 'crit chance': 'CRITICAL_CHANCE', cc: 'CRITICAL_CHANCE', crit_damage: 'CRITICAL_DAMAGE', 'crit damage': 'CRITICAL_DAMAGE', cd: 'CRITICAL_DAMAGE',
  intelligence: 'INTELLIGENCE', int: 'INTELLIGENCE', speed: 'SPEED', spd: 'SPEED', mining_fortune: 'MINING_FORTUNE', mnf: 'MINING_FORTUNE', mining_speed: 'MINING_SPEED', mns: 'MINING_SPEED',
  farming_fortune: 'FARMING_FORTUNE', foraging_fortune: 'FORAGING_FORTUNE', treasure_chance: 'TREASURE_CHANCE', 'treasure chance': 'TREASURE_CHANCE', ability_damage: 'ABILITY_DAMAGE', ad: 'ABILITY_DAMAGE',
  pet_luck: 'PET_LUCK', pl: 'PET_LUCK', magic_find: 'MAGIC_FIND', mf: 'MAGIC_FIND', ferocity: 'FEROCITY', true_defense: 'TRUE_DEFENSE', td: 'TRUE_DEFENSE', 'attack speed': 'ATTACK_SPEED', bas: 'ATTACK_SPEED',
  'sea creature chance': 'SEA_CREATURE_CHANCE', scc: 'SEA_CREATURE_CHANCE', health_regen: 'HEALTH_REGEN', 'health regen': 'HEALTH_REGEN',
  'combat wisdom': 'COMBAT_WISDOM', 'mining wisdom': 'MINING_WISDOM', 'farming wisdom': 'FARMING_WISDOM', 'foraging wisdom': 'FORAGING_WISDOM', 'fishing wisdom': 'FISHING_WISDOM',
  'enchanting wisdom': 'ENCHANTING_WISDOM', 'alchemy wisdom': 'ALCHEMY_WISDOM', 'social wisdom': 'SOCIAL_WISDOM',
  'true def': 'TRUE_DEFENSE', 'true defense': 'TRUE_DEFENSE', tracking: 'TRACKING',
};
export const statId = (raw) => STAT_ID[String(raw).trim().toLowerCase()] ?? null;

const num = (s) => {
  const m = String(s).match(/-?\d[\d,]*(?:\.\d+)?/);
  return m ? Number(m[0].replaceAll(',', '')) : null;
};
const round = (n) => Math.round(n * 1e6) / 1e6;

// ---- reward tables of the skill pages --------------------------------------------------------------------------------------

const CELL_ATTRS = /^\|\s*(?:[a-z-]+\s*=\s*"[^"]*"\s*)+\|\s*/i;

// The first wikitable of a Leveling Rewards page: Level, then pairs (per level, total) for XP, Coins, stats and the rest, then a text cell.
// Gives { levels, columns: { name: { stat, percent, perLevel[], total[] } }, problems[] }. A total that is not the running sum of the
// per-level values is a problem (the wiki disagrees with itself).
export function parseRewardTable(text) {
  const start = text.indexOf('{|');
  const table = text.slice(start, text.indexOf('\n|}', start));
  const blocks = table.split(/\n\|-\s*\n/);
  const head = blocks[0].split('\n').filter((l) => l.startsWith('!'));
  const names = head.map((l) => {
    const m = l.match(/^!(?:([^|]*)\|)?\s*(.+)$/);
    return { name: m[2].replace(/\[\[|\]\]|<br>.*$/g, '').trim(), pair: /colspan\s*=\s*"?2/.test(m[1] ?? '') };
  });
  const cols = names.slice(1).filter((c) => !/^(unlock|other)/i.test(c.name));
  const out = { levels: 0, columns: {}, problems: [] };
  for (const c of cols) out.columns[c.name] = { stat: null, percent: false, perLevel: [], total: [] };
  for (const block of blocks.slice(2)) {
    const cells = block.split('\n').filter((l) => l.startsWith('|') && !l.startsWith('|}')).map((l) => l.replace(CELL_ATTRS, '|').replace(/^\|\s*/, ''));
    const level = num(cells[0]);
    if (!Number.isInteger(level)) continue;
    if (level !== out.levels + 1) out.problems.push(`level ${level} after ${out.levels}`);
    out.levels = level;
    let at = 1;
    for (const c of cols) {
      const col = out.columns[c.name];
      const [a, b] = c.pair ? [cells[at], cells[at + 1]] : [cells[at], cells[at]];
      at += c.pair ? 2 : 1;
      const stat = String(a).match(/\{\{\s*Stat\s*\|\s*([^|}]+)/i);
      if (stat && !col.stat) col.stat = stat[1].trim();
      if (/%/.test(a)) col.percent = true;
      col.perLevel.push(num(a));
      col.total.push(num(b));
    }
  }
  for (const [name, col] of Object.entries(out.columns)) {
    let sum = 0;
    col.perLevel.forEach((v, i) => {
      sum = round(sum + (v ?? 0));
      if (col.total[i] !== null && Math.abs(col.total[i] - sum) > 1e-6) out.problems.push(`${name}: total at level ${i + 1} is ${col.total[i]}, the sum is ${sum}`);
    });
  }
  return out;
}

// ---- slayer pages --------------------------------------------------------------------------------------------------------------

// "Leveling Rewards" of a Slayer page: a row starts with the level (Text anchor), then the XP (Pink), the rank and the stats cell.
export function parseSlayerLevels(text) {
  const from = text.indexOf('== Leveling Rewards ==');
  const body = text.slice(from, text.indexOf('\n== ', from + 10) >= 0 ? text.indexOf('\n== ', from + 10) : undefined);
  const levels = [];
  let cur = null;
  let step = 0;
  for (const line of body.split('\n')) {
    const lvl = line.match(/^\|(?:\s*rowspan="\d+"\s*\|)?\s*\{\{Text anchor\|[IVX]+\|(\d+)\}\}/i);
    if (lvl) { cur = { level: Number(lvl[1]), xp: null, stats: {}, sbXp: null, unknown: [] }; levels.push(cur); step = 1; continue; }
    if (!cur) continue;
    if (line.startsWith('|-')) { if (step >= 4) cur = null; continue; }
    if (step === 1 && /Pink\|/.test(line)) { cur.xp = num(line.replace(/.*Pink\|/, '')); step = 2; continue; }
    if (step === 2) { step = 3; continue; } // the rank
    if (step === 3) {
      for (const m of line.matchAll(/\{\{\s*stat\s*\|\s*([^|}]+)\|\s*\+?([\d.,]+)/gi)) {
        const id = statId(m[1]);
        if (id) cur.stats[id] = (cur.stats[id] ?? 0) + Number(m[2].replaceAll(',', ''));
        else cur.unknown.push(m[1]);
      }
      const sb = line.match(/\{\{\s*SBXP\s*\|\s*\+?([\d,]+)/i);
      if (sb) cur.sbXp = Number(sb[1].replaceAll(',', ''));
      step = 4;
    }
  }
  return levels;
}

// ---- NEU ---------------------------------------------------------------------------------------------------------------------

// NEU keeps a reward from the level where it starts until the next entry: { "1": {x: 1}, "15": {x: 2} } is 1 up to level 14 and 2 from 15.
export function expandNeu(entries, levels) {
  const keys = Object.keys(entries).map(Number).sort((a, b) => a - b);
  const out = {};
  for (let level = 1; level <= levels; level++) {
    const at = [...keys].reverse().find((k) => k <= level);
    for (const [stat, v] of Object.entries(entries[at] ?? {})) (out[stat] ??= [])[level - 1] = v;
  }
  return out;
}

// ---- series ------------------------------------------------------------------------------------------------------------------

const same = (a, b) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-9);

// sources: [{ name, values }]; the first is the main one. safe = at least two sources, all equal over the levels both have.
export function series(sources, note) {
  const main = sources[0];
  const out = { values: main.values.map((v) => (v === null || v === undefined ? 0 : round(v))), src: sources.map((s) => s.name), confidence: 'unsafe' };
  const others = sources.slice(1);
  if (others.length) {
    const over = Math.min(main.values.length, ...others.map((s) => s.values.length));
    const diff = [];
    for (let i = 0; i < over; i++) if (others.some((s) => Math.abs((s.values[i] ?? 0) - (main.values[i] ?? 0)) > 1e-9)) diff.push(i + 1);
    if (!diff.length) out.confidence = 'safe';
    else out.diff = diff;
    const short = others.filter((s) => s.values.length !== main.values.length);
    if (short.length) out.note = `${short.map((s) => s.name).join(', ')} has ${short.map((s) => s.values.length).join('/')} levels, the main source ${main.values.length}`;
  } else out.note = 'one source';
  if (note) out.note = out.note ? `${out.note}; ${note}` : note;
  return out;
}

export const cumulative = (perLevel) => perLevel.reduce((all, v) => [...all, round((all.at(-1) ?? 0) + v)], []);

// ---- booster cookie and god potion -------------------------------------------------------------------------------------------

// The effects list of the Booster Cookie page: "+25 on all wisdom stats", "+15 Magic Find".
export function parseCookie(text) {
  const wisdom = text.match(/\{\{stat\|wisdom\|\+(\d+)[^}]*\}\}\s*on all/i);
  const mf = text.match(/\{\{stat\|mf\|\+(\d+)\}\}/i);
  const days = text.match(/for (?:\{\{Green\|)?(\d+)\}?\}? days/i);
  return { wisdom: wisdom ? Number(wisdom[1]) : null, magicFind: mf ? Number(mf[1]) : null, days: days ? Number(days[1]) : null };
}

// The "Granted Bonus" column of the God Potion Effect table: effect -> { STAT: value }. Effects without a stat are left out.
export function parseGodPotionEffects(text) {
  const effects = {};
  const rows = text.split(/\n\|-\n/).slice(1);
  for (const row of rows) {
    const cells = row.split('\n').filter((l) => l.startsWith('|')).map((l) => l.slice(1).trim());
    const name = (cells[0] ?? '').match(/\{\{Potion\|([^}|]+)/i)?.[1]?.trim();
    if (!name) continue;
    const stats = {};
    for (const m of (cells[2] ?? '').matchAll(/\{\{\s*stat\s*\|\s*([^|}]+)\|\s*\+?(-?[\d.,]+)/gi)) {
      const id = statId(m[1]);
      if (id) stats[id] = Number(m[2].replaceAll(',', ''));
      else stats[`?${m[1].trim()}`] = Number(m[2].replaceAll(',', ''));
    }
    if (Object.keys(stats).length) effects[name] = stats;
  }
  return effects;
}

// The Enrichments table: "Enrich an accessory with the power of +1 {{Stat|Speed}}" per row.
export function parseEnrichments(text) {
  const out = {};
  for (const m of text.matchAll(/power of \+?([\d.]+)\s*(?:'''\s*)?\{\{\s*Stat\s*\|\s*([^|}]+)/gi)) {
    const id = statId(m[2]);
    if (id) out[id] = Number(m[1]);
  }
  return out;
}

// The "Leveling Slayer" table of the Slayer page: one row per boss, one column per level, cells that span rows are repeated.
// "20k XP" and "1m XP" are read as 20000 and 1000000. Gives { zombie: [..], ... } with the XP needed in total for each level.
export function parseSlayerOverview(text) {
  const from = text.indexOf('== Leveling Slayer ==');
  const table = text.slice(text.indexOf('{|', from), text.indexOf('\n|}', from));
  const rows = table.split(/\n\|-\s*\n/).slice(1);
  const carry = []; // column -> { value, left }
  const out = {};
  for (const row of rows) {
    const lines = row.split('\n').filter((l) => l.startsWith('!') || l.startsWith('|'));
    const name = lines[0].replace(/^!\s*/, '').trim().toLowerCase();
    const cells = lines.slice(1).map((l) => l.replace(/^\|\s*/, ''));
    const xp = [];
    for (let col = 0; col < 9; col++) {
      if (carry[col]?.left > 0) {
        xp[col] = carry[col].value;
        carry[col].left--;
        continue;
      }
      const cell = cells.shift();
      if (cell === undefined) break;
      const attrs = cell.match(/^((?:\w+="?\d+"?\s*)+)\|(.*)$/);
      const body = attrs ? attrs[2] : cell;
      const colspan = Number(attrs?.[1].match(/colspan="?(\d+)/)?.[1] ?? 1);
      const rowspan = Number(attrs?.[1].match(/rowspan="?(\d+)/)?.[1] ?? 1);
      const m = body.match(/([\d.,]+)\s*([km]?)\s*XP/i);
      const value = m ? Number(m[1].replaceAll(',', '')) * ({ k: 1e3, m: 1e6 }[m[2].toLowerCase()] ?? 1) : null;
      for (let i = 0; i < colspan; i++) xp[col + i] = value;
      if (rowspan > 1) carry[col] = { value, left: rowspan - 1 };
      col += colspan - 1;
    }
    out[name] = xp.filter((v) => v !== null && v !== undefined);
  }
  return out;
}

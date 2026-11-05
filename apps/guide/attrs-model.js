// What the attribute editor shows. No markup in here.

// The attributes the guides ask for (steps with detect kind attr): key -> the highest level any step needs.
export function usedAttrs(guides) {
  const used = new Map();
  for (const g of guides ?? []) {
    for (const s of g.sections ?? []) {
      for (const step of s.steps ?? []) {
        for (const d of [step.detect ?? []].flat()) if (d.kind === 'attr' && d.attr) used.set(d.attr, Math.max(used.get(d.attr) ?? 0, d.need ?? 0));
      }
    }
  }
  return used;
}

// Search over name, shard and key, case blind. Empty query keeps everything.
export function findAttrs(list, query) {
  const q = String(query ?? '').trim().toLowerCase();
  return q ? list.filter((a) => [a.name, a.shard, a.key].some((t) => String(t).toLowerCase().includes(q))) : list;
}

// Shards the next level needs, null at the top.
export const nextShards = (data, attr, level) => (level >= attr.maxLevel ? null : data.attributes.shardsPerLevel[attr.rarity][level]);

const round = (v) => Math.round(v * 100) / 100;

// A per_stat effect at a level. "value" is what the top level gives per "every" points of the other stat; the levels below
// scale the value linearly and the points linearly between the two known ones, so those are only approximate.
export function perStatAt(e, level, maxLevel, have) {
  const value = (e.value * level) / maxLevel;
  const every = e.per.every;
  const [lo, hi] = typeof every === 'number' ? [every, every] : [every.level1, every['level' + maxLevel]];
  const at = round(lo + ((hi - lo) * (level - 1)) / Math.max(maxLevel - 1, 1));
  const exact = typeof every === 'number' || level === 1 || level === maxLevel;
  return { value, every: at, approx: !exact, now: typeof have === 'number' ? round((value * have) / at) : null };
}

// What an attribute says in words where it has no stat to add (desc: perLevel and a text with {v}, or the text of level I only).
function descLine(attr, level) {
  const d = attr.desc;
  if (d?.text) return level > 1 ? d.text.replace('{v}', round(d.perLevel * level)) + ' (ca.)' : d.text.replace('{v}', d.perLevel);
  if (d?.level1) return level > 1 ? `Level I: ${d.level1}` : d.level1;
  const n = attr.note;
  if (n && typeof n === 'object') return `+${round(n.perLevel * level)}${n.text}`;
  return typeof n === 'string' ? n : null;
}

// The effects at a level as lines. summed: counts in the totals. Only flat effects that always hold do; per_stat gets "now"
// from have (stat id -> current value), the rest is described. stats: gamedata.stats.
export function effectLines(data, attr, level, have = {}) {
  const name = (id) => data.stats.stats.find((s) => s.id === id)?.name ?? id;
  const lines = attr.effects.map((e) => {
    if (e.kind === 'per_stat') {
      const p = perStatAt(e, level, attr.maxLevel, have[e.per.stat]);
      const text = `+${round(p.value)} ${name(e.stat)} per ${p.every} ${name(e.per.stat)}${p.approx ? ' (ca.)' : ''}`;
      return { stat: e.stat, cond: e.cond, text, summed: false, now: p.now === null ? null : `now: +${p.now} ${name(e.stat)}` };
    }
    const v = e.fixed !== undefined ? e.fixed : (e.perLevel ?? 0) * level;
    const sign = e.kind === 'percent_multiplier' ? '%' : '';
    return { stat: e.stat, cond: e.cond, text: `${v >= 0 ? '+' : ''}${round(v)}${sign} ${name(e.stat)}`, summed: e.cond === 'always' && !e.kind, now: null };
  });
  const text = descLine(attr, level);
  if (text) lines.push({ stat: null, cond: attr.effectKind, text, summed: false, now: null });
  return lines;
}

// Shards from the current level up to the maximum (0 at the top).
export const shardsToMax = (data, attr, level) => data.attributes.shardsPerLevel[attr.rarity].slice(level, attr.maxLevel).reduce((a, b) => a + b, 0);

// The short line of a list row: every effect at the level, at level 1 while the attribute is not set.
export const effectShort = (data, attr, level) => effectLines(data, attr, Math.max(level, 1)).map((l) => l.text).join(' · ');

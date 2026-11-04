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

// The effects at a level as plain text per stat. per_stat ones depend on another stat and are only described.
export function effectLines(data, attr, level) {
  const name = (id) => data.stats.stats.find((s) => s.id === id)?.name ?? id;
  return attr.effects.map((e) => {
    if (e.kind === 'per_stat') return { stat: e.stat, cond: e.cond, text: `${name(e.stat)}: ${e.value} per ${e.every ?? 1} ${name(e.per.stat)}` };
    const v = e.fixed !== undefined ? e.fixed : (e.perLevel ?? 0) * level;
    return { stat: e.stat, cond: e.cond, text: `${v >= 0 ? '+' : ''}${Math.round(v * 100) / 100} ${name(e.stat)}` };
  });
}

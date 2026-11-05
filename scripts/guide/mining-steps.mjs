// Game logic for the mining guides, kept out of personal/ so it can be tested: the shared step keys, the essence shop
// steps and the jaded/clean stat hints. The private build scripts in personal/ call this. Pure functions.
import { REFORGES } from '../../apps/guide/optimizer-data.js';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
export const RARITY_LIST = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC', 'DIVINE'];
const cap = (s) => s[0].toUpperCase() + s.slice(1).toLowerCase();
const STAT_NAME = { MINING_SPEED: 'Mining Speed', MINING_FORTUNE: 'Mining Fortune', GEMSTONE_FORTUNE: 'Gemstone Fortune', COLD_RESISTANCE: 'Cold Resistance', DEFENSE: 'Defense', HEALTH: 'Health', HEAT_RESISTANCE: 'Heat Resistance', PRISTINE: 'Pristine', DWARVEN_METAL_FORTUNE: 'Dwarven Metal Fortune' };
const name = (stat) => STAT_NAME[stat] ?? stat.split('_').map(cap).join(' ');

// Where a step's piece sits: the drills are one slot (enchants, gems and the reforge go with the upgrade), everything else its own id.
export const pieceOf = (id, items) => (items?.[id]?.category === 'DRILL' ? 'drill' : id.toLowerCase());

// The first id of the first slot a detect part names; `on` is a list of slots or the name of a group of the guide.
export const firstId = (part, guide) => (typeof part.on === 'string' ? guide?.groups?.[part.on] : part.on)?.[0]?.[0] ?? null;

// The shared key of a step, or null when it has none. The gem slot number is read from the step text ("Slot 2").
export function keyOf(step, { guide, items }) {
  const d = [step.detect ?? []].flat();
  if (d.length !== 1) return null;
  const [p] = d;
  const id = firstId(p, guide);
  const piece = id && pieceOf(id, items);
  switch (p.kind) {
    case 'owned': return step.items?.[0]?.id ? `item:${step.items[0].id}` : id && `item:${id}`;
    case 'gem': return piece && `gem:${piece}:${p.type}:${p.quality}:${Number(step.text.match(/Slot (\d+)/)?.[1] ?? 1)}`;
    case 'reforge': return piece && `reforge:${piece}:${p.value[0]}`;
    case 'recomb': return piece && `recomb:${piece}`;
    case 'enchant': return piece && `enchant:${piece}:${p.enchant}:${p.level}`;
    case 'coating': return piece && `coating:${piece}`;
    case 'polarvoid': return piece && `polarvoid:${piece}:${p.need ?? 1}`;
    case 'essence': return `perk:${p.perk}:${p.level}`;
    case 'pet': return `pet:${p.types[0]}:${p.tier ?? 'LEGENDARY'}`;
    case 'petItem': return `petitem:${p.item}:${p.types[0]}`;
    case 'part': return `part:${p.ids[0]}`;
    default: return null;
  }
}

// Keys for all steps of a guide. A key that came before stays with its first step; a later step with the same meaning has none.
export function assignKeys(guide, items) {
  const seen = new Set();
  const sections = guide.sections.map((s) => ({ ...s, steps: s.steps.map((step) => {
    const key = step.key ?? keyOf(step, { guide, items });
    if (!key || seen.has(key)) return step;
    seen.add(key);
    return { ...step, key };
  }) }));
  return { ...guide, sections };
}

// Old "section|text" marks and the keys they mean now. A mark of an old step with a key the new guide has moves there.
export function legacyMap(oldGuide, newKeys, items) {
  const out = {};
  for (const s of oldGuide.sections) {
    for (const step of s.steps) {
      const key = keyOf(step, { guide: oldGuide, items });
      if (key && newKeys.has(key)) out[`${s.name}|${step.text}`] = key;
    }
  }
  return out;
}

// One step per level of every perk of the essence shop. Cost = essence of the shop times its bazaar price (the item id is in the step).
export function essenceSteps(data) {
  return data.perks.flatMap((p) => Array.from({ length: p.max }, (_, i) => {
    const level = i + 1;
    const step = {
      text: `${cap(p.essence)} Essence Shop: ${p.name} ${ROMAN[level]}`,
      key: `perk:${p.id}:${level}`,
      detect: { kind: 'essence', perk: p.id, level },
      items: [{ id: p.bazaar, qty: p.costs[i] }],
    };
    if (p.effect) step.gain = { [p.effect.stat]: p.effect.perLevel };
    else step.hint = `${p.conditional.text} (${p.conditional.where}). Shown only, not counted in your stats.`;
    if (level > 1) step.after = [`${cap(p.essence)} Essence Shop: ${p.name} ${ROMAN[level - 1]}`];
    return { perk: p.id, level, step };
  }));
}

const line = (stats) => Object.entries(stats).map(([stat, v]) => `+${v} ${name(stat)}`).join(' ');

// What a reforge gives at the rarity of the piece and one above it (the Recombobulator), from the wiki table.
export function reforgeHint(value, rarity) {
  const table = REFORGES[value];
  if (!table) return null;
  const at = (r) => Object.fromEntries(Object.entries(table).map(([stat, list]) => [stat, list[r]]));
  const i = RARITY_LIST.indexOf(rarity);
  if (i < 0 || !Object.values(at(i)).every(Number.isFinite)) return null;
  const next = i + 1 < RARITY_LIST.length ? `, ${cap(RARITY_LIST[i + 1])} (after the Recombobulator) ${line(at(i + 1))}` : '';
  return `${cap(value)} at ${cap(rarity)}: ${line(at(i))}${next}`;
}

// The stats of a piece as it drops, without reforge, gems or stars.
export const cleanHint = (stats) => `Clean: ${Object.entries(stats).map(([stat, v]) => `${name(stat)} ${v}`).join(', ')}`;

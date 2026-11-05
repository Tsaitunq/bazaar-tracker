// Game logic for the mining guides, kept out of personal/ so it can be tested: the shared step keys, the essence shop
// steps and the jaded/clean stat hints. The private build scripts in personal/ call this. Pure functions.
import { REFORGES, GEMS, GEM_STAT } from '../../apps/guide/optimizer-data.js';

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

// A list line like "Divan's Helmet (mit Perfect Topaz)" bundles a gem into the item. Gives the clean item: the text without the
// bracket and the gain without the stone (at the rarity of the item), plus what the bracket named. null for a line without a gem.
export function cleanItem(text, gain, tier) {
  const m = text.match(/ \(mit (Rough|Flawed|Fine|Flawless|Perfect) (Jade|Amber|Topaz)[^)]*\)$/);
  if (!m) return null;
  const quality = m[1].toUpperCase();
  const type = m[2].toUpperCase();
  const value = GEMS[type]?.[quality]?.[RARITY_LIST.indexOf(tier)];
  const next = { ...gain };
  if (value !== undefined && next[GEM_STAT[type]] !== undefined) {
    const left = Math.round((next[GEM_STAT[type]] - value) * 100) / 100;
    if (left > 0) next[GEM_STAT[type]] = left; else delete next[GEM_STAT[type]];
  }
  return { text: text.slice(0, m.index), gain: next, gem: { type, quality } };
}

// Every gem slot holds one stone in the model: per piece, type and slot number one Flawless step and one Perfect step, the Perfect one
// after the Flawless one, and no item step that carries a stone of its own. Gives a list of problems (empty = fine).
export function gemConflicts(guide, items) {
  const problems = [];
  const seen = new Map();
  const steps = guide.sections.flatMap((s) => s.steps);
  for (const step of steps) {
    const d = [step.detect ?? []].flat();
    if (d.length === 1 && d[0].kind === 'gem') {
      const key = keyOf(step, { guide, items });
      if (seen.has(key)) problems.push(`slot twice: ${key}`);
      seen.set(key, step);
    }
    if (/\(mit (Rough|Flawed|Fine|Flawless|Perfect) /.test(step.text)) problems.push(`stone inside an item step: ${step.text}`);
  }
  for (const [key, step] of seen) {
    if (step.detect.quality === 'PERFECT' && !seen.has(key.replace(':PERFECT:', ':FLAWLESS:'))) problems.push(`Perfect without Flawless: ${key}`);
  }
  return problems;
}

import { readFileSync } from 'node:fs';
export const ENCHANT_LEVELS = JSON.parse(readFileSync(new URL('./enchant-levels.json', import.meta.url), 'utf8')).enchants;

const statsAt = (e, level) => Object.fromEntries(Object.entries(e.table ?? Object.fromEntries(Object.entries(e.perLevel).map(([s, v]) => [s, Array.from({ length: e.max }, (_, i) => v * (i + 1))]))).map(([s, list]) => [s, level ? list[level - 1] : 0]));
const r2 = (v) => Math.round(v * 100) / 100;

// For every enchant a guide already holds on a piece (its highest level), one step per level up to the maximum.
// Gain = the stats of the level minus those of the level below. Cost = the book of the level (the app prices the cheapest of
// buying it or combining two of the level below, `combine`), or one Silex. A level never comes before the one below it (`line`, `after`).
// onFor(piece): the ids of the item slot the enchant sits on. Gives the new steps; none for an enchant at its maximum.
export function enchantUpgrades(guide, onFor, levels = ENCHANT_LEVELS) {
  const best = new Map(); // key without level -> highest step
  for (const step of guide.sections.flatMap((s) => s.steps)) {
    const m = step.key?.match(/^enchant:(.+):(.+):(\d+)$/);
    if (!m || !levels[m[2]]) continue;
    const k = `${m[1]}:${m[2]}`;
    if (!best.has(k) || Number(m[3]) > best.get(k).level) best.set(k, { piece: m[1], id: m[2], level: Number(m[3]), step });
  }
  const out = [];
  for (const { piece, id, level, step } of best.values()) {
    const e = levels[id];
    const label = piece === 'drill' ? 'Drill' : step.text.split(': ')[0];
    for (let l = level + 1; l <= e.max; l++) {
      const gain = Object.fromEntries(Object.entries(statsAt(e, l)).map(([s, v]) => [s, r2(v - statsAt(e, l - 1)[s])]).filter(([, v]) => v));
      const items = e.source === 'silex' ? [{ id: e.silex, qty: 1 }] : [{ id: `ENCHANTMENT_${id.toUpperCase()}_${l}`, qty: 1, combine: e.combine }];
      const hint = [e.fullStacks && 'At full stacks', e.note].filter(Boolean).join('. ');
      out.push({
        text: `${label}: ${e.name} ${ROMAN[l]}`, gain, key: `enchant:${piece}:${id}:${l}`, line: `enchant:${piece}:${id}`,
        detect: { kind: 'enchant', on: onFor(piece, step), enchant: id, level: l }, items,
        ...(l === level + 1 && { after: [step.text] }), ...(hint && { hint }),
      });
    }
  }
  return out;
}

// Which open guide step brings the most per coin (spec 4 and 5). Pure functions over the guide, the prices and the synced profile.
import { AREA_STATS, computeStats, miningScore, loadoutOf, withOffset, offsetStale } from './stats.js';
import { nextUpgrades, stepCost, openStep, bookOf, stepKey, stepRow } from './progress.js';
import { esc, coins } from './render.js';
import { checkStep } from './requires.js';
import { walkBook } from './craft.js';
import { ahNet } from './forge.js';
import { RARITIES, ENCHANTS, ENCHANTS_NO_STAT, GEMS, GEM_STAT, REFORGES, REFORGES_NO_STAT, PARTS, POLARVOID, COATING } from './optimizer-data.js';

// Spec 4.1. Gemstone Fortune applies on gemstones only (wiki Pristine), and the other fortunes are not counted, so mithril and glacite read low.
export const PRESETS = {
  gemstone: { blockStrength: 3000, wF: 1, wS: 1, wP: 1, gemFortune: true },
  mithril: { blockStrength: 500, wF: 1, wS: 1, wP: 0, gemFortune: false },
  glacite: { blockStrength: 6000, wF: 1, wS: 1, wP: 0, gemFortune: false },
};

// What the settings hold is typed in by the player: anything unusable takes the value of the preset.
export function miningSettings(raw) {
  const preset = Object.hasOwn(PRESETS, raw?.preset ?? '') ? raw.preset : 'gemstone';
  const base = PRESETS[preset];
  const number = (key, ok) => {
    const v = raw?.[key] === '' || raw?.[key] === null ? NaN : Number(raw?.[key]);
    return Number.isFinite(v) && ok(v) ? v : base[key];
  };
  const weight = (key) => number(key, (v) => v >= 0);
  return { preset, wF: weight('wF'), wS: weight('wS'), wP: weight('wP'), blockStrength: number('blockStrength', (v) => v > 0), gemFortune: base.gemFortune };
}

const QUALITY = ['ROUGH', 'FLAWED', 'FINE', 'FLAWLESS', 'PERFECT'];
const TOOLS = new Set(['DRILL', 'PICKAXE', 'GAUNTLET']);
const GEM_SLOTS = ['MINING', 'UNIVERSAL'];

function plus(sum, stats, times = 1) {
  for (const [k, v] of Object.entries(stats ?? {})) if (AREA_STATS.mining.includes(k)) sum[k] = (sum[k] ?? 0) + v * times;
  return sum;
}
const difference = (next, old) => plus(plus({}, next), old, -1);
const total = (list) => list.reduce((sum, stats) => plus(sum, stats), {});
const worn = (loadout) => [...loadout.armor, ...loadout.equipment, ...(loadout.held ? [loadout.held] : [])];
const slotsOf = (d, guide) => (typeof d.on === 'string' ? guide.groups?.[d.on] : d.on);

// The piece a step works on: the one in the loadout, else one owned, else the one it will be.
function targetOf(ids, loadout, profile) {
  return worn(loadout).find((i) => ids.includes(i.id)) ?? profile.items.find((i) => ids.includes(i.id))
    ?? { id: ids[0], gems: [], enchants: {}, parts: {}, reforge: null, recomb: false, polarvoid: 0, coating: false };
}
const targetsOf = (d, guide, loadout, profile) => slotsOf(d, guide)?.map((ids) => targetOf(ids, loadout, profile)) ?? null;
const rarityOf = (item, items) => {
  const i = RARITIES.indexOf(items?.[item.id]?.tier);
  return i < 0 ? -1 : Math.min(i + (item.recomb ? 1 : 0), RARITIES.length - 1);
};

// The piece a new item takes the place of, and whether it is really in use.
export function replaced(id, loadout, profile, items) {
  const category = items[id]?.category;
  if (category === 'ACCESSORY') {
    const family = items[id].family ?? id;
    return { item: loadout.accessories.find((a) => (items[a.id]?.family ?? a.id) === family) ?? null, inUse: true };
  }
  if (TOOLS.has(category)) return { item: loadout.held, inUse: true };
  const inSlot = worn(loadout).find((i) => items[i.id]?.category === category);
  if (inSlot) return { item: inSlot, inUse: true };
  if ([...loadout.armor, ...loadout.equipment].length && ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS', 'NECKLACE', 'CLOAK', 'BELT', 'GLOVES', 'BRACELET'].includes(category)) return { item: null, inUse: true };
  // no slot for it, like a lantern: the strongest one owned is what it improves on
  const strength = (i) => Object.values(plus({}, items[i.id]?.stats)).reduce((sum, v) => sum + v, 0);
  const owned = profile.items.filter((i) => items[i.id]?.category === category);
  return { item: owned.reduce((best, i) => (!best || strength(i) > strength(best) ? i : best), null), inUse: false };
}

// The ids a step of owned still has to bring: the first of each slot nothing is owned of, as many as it needs.
function openRungs(d, guide, profile) {
  const slots = slotsOf(d, guide);
  if (!slots) return null;
  const open = slots.filter((ids) => !profile.items.some((i) => ids.includes(i.id)));
  return open.slice(0, Math.max((d.need ?? slots.length) - (slots.length - open.length), 0)).map(([id]) => id);
}

function ownedDelta(d, guide, loadout, profile, items) {
  const rungs = openRungs(d, guide, profile);
  if (!rungs || !items) return null;
  const deltas = [];
  for (const id of rungs) {
    if (!items[id]) return null;
    deltas.push(difference(items[id].stats, items[replaced(id, loadout, profile, items).item?.id]?.stats));
  }
  return total(deltas);
}

function enchantDelta(d, guide, loadout, profile, settings) {
  if (ENCHANTS_NO_STAT.has(d.enchant)) return {};
  const table = ENCHANTS[d.enchant];
  const targets = targetsOf(d, guide, loadout, profile);
  if (!table || !targets || (table.gemstonesOnly && settings.gemFortune === false)) return null;
  const at = (level) => Object.fromEntries(Object.entries(table.stats).map(([stat, values]) => [stat, level ? values[level - 1] : 0]));
  if (Object.values(at(d.level)).includes(undefined)) return null;
  const open = targets.filter((t) => (t.enchants?.[d.enchant] ?? 0) < d.level).slice(0, d.need ?? targets.length);
  return total(open.map((t) => difference(at(d.level), at(t.enchants?.[d.enchant] ?? 0))));
}

// shortcut: two gem parts of one step can both count the same free MINING slot; split the slots if a step shows too much.
function gemDelta(d, guide, loadout, profile, items) {
  const table = GEMS[d.type];
  const targets = targetsOf(d, guide, loadout, profile);
  if (!table || !targets || !items) return null;
  const gains = [];
  let have = 0;
  for (const t of targets) {
    const r = rarityOf(t, items);
    if (r < 0) return null;
    for (const g of (t.gems ?? []).filter((gem) => gem.type === d.type)) {
      if (QUALITY.indexOf(g.quality) >= QUALITY.indexOf(d.quality)) have++;
      else gains.push(table[d.quality][r] - (table[g.quality]?.[r] ?? 0));
    }
    const seen = {};
    for (const { slot_type: type } of items[t.id]?.gemstone_slots ?? []) {
      const key = `${type}_${seen[type] = (seen[type] ?? -1) + 1}`;
      if ((type === d.type || GEM_SLOTS.includes(type)) && !t.gems?.some((g) => g.slot === key)) gains.push(table[d.quality][r]);
    }
  }
  const open = Math.max((d.need ?? targets.length) - have, 0);
  const sum = gains.sort((a, b) => b - a).slice(0, open).reduce((n, v) => n + v, 0);
  return sum ? { [GEM_STAT[d.type]]: sum } : {};
}

const reforgeAt = (name, rarity) => {
  if (REFORGES_NO_STAT.has(name)) return {};
  const table = REFORGES[name];
  return table ? Object.fromEntries(Object.entries(table).map(([stat, values]) => [stat, values[rarity]])) : null;
};

function reforgeDelta(d, guide, loadout, profile, items) {
  const targets = targetsOf(d, guide, loadout, profile);
  if (!targets || !items) return null;
  const deltas = [];
  for (const t of targets) {
    const old = t.reforge ? String(t.reforge).toLowerCase() : null;
    if (d.value.includes(old)) continue;
    const r = rarityOf(t, items);
    const next = reforgeAt(d.value[0], r);
    const before = old ? reforgeAt(old, r) : {};
    if (r < 0 || !next || !before) return null;
    deltas.push(difference(next, before));
  }
  return total(deltas.slice(0, d.need ?? targets.length));
}

// Only what the higher rarity lifts of gems and reforge. A reforge without a known value stays out of it.
function recombDelta(d, guide, loadout, profile, items) {
  const targets = targetsOf(d, guide, loadout, profile);
  if (!targets || !items) return null;
  const deltas = [];
  for (const t of targets.filter((item) => !item.recomb)) {
    const r = rarityOf(t, items);
    if (r < 0) return null;
    const next = Math.min(r + 1, RARITIES.length - 1);
    const sum = {};
    for (const g of t.gems ?? []) {
      const values = GEMS[g.type]?.[g.quality];
      if (values) plus(sum, { [GEM_STAT[g.type]]: values[next] - values[r] });
    }
    const name = String(t.reforge).toLowerCase();
    if (REFORGES[name]) plus(sum, difference(reforgeAt(name, next), reforgeAt(name, r)));
    deltas.push(sum);
  }
  return total(deltas.slice(0, d.need ?? targets.length));
}

// What a change of the profile does to the calculated stats. No visible change means the data has no value for it.
function recomputed(change, profile, items, loadout) {
  const before = computeStats(profile, items, loadout, 'mining').total;
  const after = computeStats({ ...profile, ...change }, items, loadout, 'mining').total;
  const delta = Object.fromEntries(Object.entries(difference(after, before)).filter(([, v]) => v));
  return Object.keys(delta).length ? delta : null;
}

function partStats(id, profile, items, loadout) {
  const part = PARTS[id];
  if (!part) return null;
  if (!part.hotmLevels) return part.stats;
  if (!profile.hotm) return null;
  const nodes = Object.fromEntries(Object.entries(profile.hotm.nodes ?? {}).map(([k, v]) => [k, v > 0 ? v + part.hotmLevels : v]));
  return recomputed({ hotm: { ...profile.hotm, nodes } }, profile, items, loadout);
}

function partDelta(d, loadout, profile, items) {
  const next = PARTS[d.ids[0]];
  if (!next) return null;
  const old = loadout.held?.parts?.[next.kind] ? String(loadout.held.parts[next.kind]).toUpperCase() : null;
  if (d.ids.includes(old)) return {};
  const after = partStats(d.ids[0], profile, items, loadout);
  const before = old ? partStats(old, profile, items, loadout) : {};
  return after && before ? difference(after, before) : null;
}

function polarvoidDelta(d, guide, loadout, profile) {
  const [tool] = targetsOf(d, guide, loadout, profile) ?? [];
  if (!tool) return null;
  const have = tool.polarvoid ?? 0;
  const books = Math.max(Math.min(d.need ?? POLARVOID.max, POLARVOID.max) - have, 0);
  return { ...(books && { MINING_SPEED: books * POLARVOID.speed }), ...(books && !have && { MINING_FORTUNE: POLARVOID.fortune }) };
}

function coatingDelta(d, guide, loadout, profile, items) {
  const targets = targetsOf(d, guide, loadout, profile);
  if (!targets || !items) return null;
  const open = targets.filter((t) => !t.coating).slice(0, d.need ?? targets.length);
  return total(open.map((t) => (items[t.id]?.category === 'DRILL' ? COATING.drill : COATING.other)));
}

function partOf(d, guide, loadout, profile, items, settings) {
  switch (d.kind) {
    case 'owned': return ownedDelta(d, guide, loadout, profile, items);
    case 'enchant': return enchantDelta(d, guide, loadout, profile, settings);
    case 'gem': return gemDelta(d, guide, loadout, profile, items);
    case 'reforge': return reforgeDelta(d, guide, loadout, profile, items);
    case 'recomb': return recombDelta(d, guide, loadout, profile, items);
    case 'part': return partDelta(d, loadout, profile, items);
    case 'polarvoid': return polarvoidDelta(d, guide, loadout, profile);
    case 'coating': return coatingDelta(d, guide, loadout, profile, items);
    case 'perk': return profile.hotm ? recomputed({ hotm: { ...profile.hotm, nodes: { ...profile.hotm.nodes, [d.perk]: d.level } } }, profile, items, loadout) : null;
    case 'attr': return profile.attrs ? recomputed({ attrs: { ...profile.attrs, [d.attr]: d.need } }, profile, items, loadout) : null;
    // scroll: wiki Amber Power Scroll, +30 Mining Speed for 5 s after an ability, no uptime known. held, coll, skill: no table.
    default: return null;
  }
}

// What a step adds to the stats of the loadout. null: nothing known about it. {}: known to add nothing of ours.
export function stepDelta(step, loadout, profile, items, settings, guide) {
  const parts = [step.detect ?? []].flat().map((d) => partOf(d, guide, loadout, profile, items, settings));
  const known = parts.length && !parts.includes(null) ? total(parts) : null;
  // the guide's own number stands in only where the data has nothing to say
  if (step.gain && (!known || !Object.keys(known).length)) return plus({}, step.gain);
  return known;
}

// What the replaced piece brings: sold to the buy orders minus the bazaar tax, else its BIN minus the auction fees. 0 without a price.
function resaleOf(id, ctx) {
  const book = walkBook(ctx.products?.[id]?.sell_summary, 1, false);
  if (book) return book * (1 - (ctx.tax ?? 0));
  const bin = ctx.ah?.[id] > 0 ? ctx.ah[id] : ctx.cofl?.[id];
  if (bin === undefined && ctx.products) ctx.wants?.add(id);
  return bin > 0 ? ahNet(bin, ctx.derpy) : 0;
}

// The recipe takes the old piece in: it cannot also be sold.
function consumes(id, old, step, ctx) {
  const lines = (step.items ?? []).filter((i) => i.id === id);
  const recipes = [...lines.map((i) => i.forge), ctx.forge?.[id]].filter(Boolean);
  return recipes.some((r) => old in r.i) || lines.some((i) => i.without?.includes(old))
    || ctx.items?.[id]?.prestige?.item_id === old || Object.values(ctx.items?.[id]?.parent ?? {}).includes(old);
}

// Spec 5.7. Only an item swap sells something: reforges, gems and enchants carry over, so the base price is on the careful side.
export function netCost(step, gross, loadout, other, items, ctx, keepOldGear) {
  const soldIds = [];
  let resale = 0;
  if (!keepOldGear && ctx.profile && items) {
    const elsewhere = new Set(other ? [...worn(other), ...other.accessories].map((i) => i.id) : []);
    for (const d of [step.detect ?? []].flat().filter((part) => part.kind === 'owned')) {
      for (const id of openRungs(d, ctx.guide, ctx.profile) ?? []) {
        const { item, inUse } = replaced(id, loadout, ctx.profile, items);
        if (!item || !inUse || elsewhere.has(item.id) || ctx.nt?.has(item.id) || consumes(id, item.id, step, ctx)) continue;
        const price = resaleOf(item.id, ctx);
        if (price > 0) { resale += price; soldIds.push(item.id); }
      }
    }
  }
  return { net: Math.max(gross - resale, 0), resale, soldIds };
}

// Spec 5.3: from the first open step of a line up to the first one that brings something. What stands in the way decides.
function walkLine(chain, ctx, loadout, settings, base, guide) {
  const steps = [];
  let unknown = false;
  for (const entry of chain) {
    steps.push(entry);
    const { status, reasons } = checkStep(entry.step, ctx.items, ctx.profile);
    if (status === 'locked') return { group: 'locked', reasons };
    unknown ||= status === 'unknown';
    const delta = stepDelta(entry.step, loadout, ctx.profile, ctx.items, settings, guide);
    if (!delta) return { group: 'noGain', unknown };
    const gain = miningScore(base, delta, settings);
    if (gain > 0) return { steps, target: entry, delta, gain, unknown };
  }
  return { group: 'zero', unknown };
}

// A line of books pays only for its last one: that price is the cheapest way there, so the levels between are in it.
function chainCost({ steps, target }, ctx) {
  const list = bookOf(target.step) ? [target] : steps;
  const costs = list.map(({ section, step }) => stepCost(openStep(section, step, ctx), ctx));
  return { coins: costs.reduce((n, c) => n + c.coins, 0), unpriced: costs.reduce((n, c) => n + c.unpriced, 0) };
}

// Spec 5.1. score and gain are shares: 0.012 is 1.2 %. A sum missing a price never gets a rank, it would look cheaper than it is.
export function rankUpgrades(guide, checked, ctx, loadout, settings, base, { other = null, keepOldGear = false } = {}) {
  const groups = { free: [], ranked: [], noPrice: [], noGain: [], zero: [], locked: [] };
  const firsts = nextUpgrades(guide, checked, ctx);
  const rest = (line) => guide.sections.flatMap((section) => section.steps.filter((step) => step.line === line && !checked.has(stepKey(section, step))).map((step) => ({ section, step })));
  const nt = new Set(guide.sections.flatMap((s) => s.steps.flatMap((step) => (step.items ?? []).filter((i) => i.nt && i.id).map((i) => i.id))));
  const sellCtx = { ...ctx, guide, nt };
  for (const first of firsts) {
    const row = { section: first.section, step: first.step, coins: first.coins, unpriced: first.unpriced, status: 'ok', reasons: [] };
    const walked = walkLine(first.step.line ? rest(first.step.line) : [first], ctx, loadout, settings, base, guide);
    if (walked.unknown) row.status = 'unknown';
    if (walked.group) {
      groups[walked.group].push(walked.group === 'locked' ? { ...row, status: 'locked', reasons: walked.reasons } : row);
      continue;
    }
    const { coins, unpriced } = chainCost(walked, ctx);
    const { net, resale } = netCost(walked.target.step, coins, loadout, other, ctx.items, sellCtx, keepOldGear);
    const rated = { ...row, coins, unpriced, delta: walked.delta, gain: walked.gain, net, resale, ahead: walked.target === walked.steps[0] ? null : walked.target.step };
    if (unpriced) groups.noPrice.push(rated);
    else if (net > 0) groups.ranked.push({ ...rated, perMillion: walked.gain / (net / 1e6) });
    else if (coins > 0 || walked.target.step.table) groups.free.push({ ...rated, net: 0 });
    else groups.noPrice.push(rated);
  }
  groups.ranked.sort((a, b) => b.perMillion - a.perMillion);
  groups.free.sort((a, b) => b.gain - a.gain);
  return groups;
}

const SLOT_GROUPS = [['HELMET'], ['CHESTPLATE'], ['LEGGINGS'], ['BOOTS'], ['NECKLACE'], ['CLOAK'], ['BELT'], ['GLOVES', 'BRACELET'], ['DRILL', 'PICKAXE', 'GAUNTLET']];

// Greedy per slot from everything owned, each pick on top of the ones before. The pet stays as picked: abilities are not in the tables.
export function bestLoadout(profile, items, loadout, base, settings) {
  const slots = [];
  let stats = plus({}, base);
  for (const group of SLOT_GROUPS) {
    const of = (i) => group.includes(items[i.id]?.category);
    const current = worn(loadout).find(of) ?? null;
    const without = difference(stats, current?.lore);
    const score = (i) => miningScore(without, i?.lore ?? {}, settings);
    let best = current;
    for (const i of profile.items.filter((item) => of(item) && item.where !== 'accessory')) if (score(i) > score(best) + 1e-12) best = i;
    stats = plus(without, best?.lore);
    if (best !== current) slots.push({ slot: group[0], current, best });
  }
  return { slots, gain: slots.length ? miningScore(base, difference(stats, base), settings) : 0 };
}

const share = (v) => { const p = v * 100; return Math.abs(p) >= 0.1 ? p.toFixed(1) : p.toPrecision(1); };
const RAW = { MINING_FORTUNE: 'Fortune', GEMSTONE_FORTUNE: 'Gemstone Fortune', ORE_FORTUNE: 'Ore Fortune', BLOCK_FORTUNE: 'Block Fortune', MINING_SPEED: 'Speed', PRISTINE: 'Pristine' };
const rawLine = (delta) => Object.entries(delta).filter(([, v]) => v).map(([k, v]) => `${v > 0 ? '+' : ''}${Math.round(v * 100) / 100} ${RAW[k]}`).join(', ');
const words = (s) => s[0].toUpperCase() + s.slice(1).toLowerCase();

function rowExtra(row, ctx) {
  const parts = [];
  if (row.gain !== undefined) {
    const rate = row.perMillion === undefined ? '' : ` · ${share(row.perMillion)} %/1M`;
    parts.push(`<small class="guide-hint"><strong>+${share(row.gain)} % yield${rate}</strong></small><small class="guide-hint">${esc(rawLine(row.delta))}</small>`);
  }
  if (row.resale > 0) parts.push(`<small class="guide-hint">Net ${coins(row.net)} (buy ${coins(row.coins)} − resale ${coins(row.resale)})</small>`);
  if (row.ahead) parts.push(`<small class="guide-hint">Counted up to: ${esc(row.ahead.text)}</small>`);
  if (row.status === 'unknown') parts.push('<small class="guide-hint">Requirements could not be checked.</small>');
  // stepRow shows the reason of its own step, not one further along the line
  if (row.status === 'locked' && checkStep(row.step, ctx.items, ctx.profile).status !== 'locked') parts.push(`<small class="guide-hint">${esc(row.reasons.join(' · '))}</small>`);
  return parts.join('');
}

const NOTES = {
  boost: 'Your /stats do not match the God Potion / Booster Cookie settings, so they are left out.',
  noitems: 'Save your /stats again: item data was missing, so they are left out.',
  setup: 'Measure /stats again: the slot or pet changed, so they are left out.',
};

function bestCard(best, name) {
  const pick = (i) => (i ? esc(name(i.id)) : 'nothing');
  const body = best.slots.length
    ? `<strong>+${share(best.gain)} % yield compared with your wardrobe slot</strong><ul class="stats-gaps">${best.slots.map((s) => `<li>${esc(words(s.slot))}: ${pick(s.current)} → ${pick(s.best)}</li>`).join('')}</ul>`
    : '<small class="guide-hint">Your wardrobe slot already is the best of what you own.</small>';
  return `<section class="guide-next" aria-label="Best possible"><h2>Best possible from what you own</h2>${body}<small class="guide-hint">Pet stays as picked. Set bonuses are not counted.</small></section>`;
}

export function bestValueView({ guide, checked, ctx, name, state, settings, keepOldGear, boosts = {}, preset = null }) {
  const profile = state?.summary;
  if (!profile) return '<section class="guide-next" aria-label="Best value"><h2>Best value</h2><p class="muted">Sync your profile to rank the upgrades against what you have.</p><div class="actions"><button type="button" data-open-settings>Open settings</button></div></section>';
  if (!ctx.items) return '<p class="muted">Loading item data…</p>';
  const entry = state.statsInput?.mining ?? preset?.mining ?? null;
  const loadout = loadoutOf(profile, ctx.items, 'mining', entry?.choice, settings);
  // without a picked Blaze slot both areas fall back to what is worn, which says nothing about what Blaze still needs
  const blazeChoice = state.statsInput?.blaze?.choice ?? preset?.blaze?.choice;
  const other = blazeChoice ? loadoutOf(profile, ctx.items, 'blaze', blazeChoice) : null;
  const base = withOffset(computeStats(profile, ctx.items, loadout, 'mining', boosts).total, entry);
  const groups = rankUpgrades(guide, checked, ctx, loadout, settings, base, { other, keepOldGear });
  const notes = [
    ...(settings.gemFortune ? [] : ['Gemstone Fortune does not count here, and Ore, Block and Dwarven Metal Fortune are not counted, so fortune steps read low.']),
    ...(entry?.offset && NOTES[entry.offsetNote] ? [NOTES[entry.offsetNote]] : []),
    ...(!entry?.offset ? ['Save your /stats in Settings to include what the app cannot read.'] : []),
    ...(offsetStale(entry, entry?.choice) ? ['Measure /stats again: the slot or pet changed.'] : []),
    ...(entry?.at && entry.at < state.syncedAt ? ['Your /stats values are older than the last sync.'] : []),
    ...loadout.gaps,
  ];
  const list = (title, rows, note = '', label = () => '') => (rows.length
    ? `<section class="guide-next" aria-label="${title}"><h2>${title}</h2>${note ? `<small class="guide-hint">${note}</small>` : ''}<ul class="guide-steps">${rows.map((r) => stepRow(r.section, r.step, checked, ctx, name, label(r) + rowExtra(r, ctx))).join('')}</ul></section>` : '');
  const free = () => '<span class="guide-src" data-src="free">free</span>';
  const open = Object.values(groups).reduce((n, rows) => n + rows.length, 0);
  return `<p class="guide-hint">Target: ${words(settings.preset)}</p>
  ${notes.length ? `<ul class="stats-gaps">${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
  ${bestCard(bestLoadout(profile, ctx.items, loadout, base, settings), name)}
  ${open ? '' : '<p class="muted">All steps are done.</p>'}
  ${list('Best value', [...groups.free, ...groups.ranked], '', (r) => (r.perMillion === undefined ? free() : ''))}
  ${list('Locked', groups.locked)}
  ${list('No price', groups.noPrice, 'A sum that leaves out an item would look cheaper than it is.')}
  ${list('No gain data', groups.noGain, 'Nothing known gives this step a fixed value.')}
  ${list('No mining gain', groups.zero, 'These add none of the stats counted here right now.')}`;
}

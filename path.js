// The order of a guide's open steps, round by round on a copy of the profile: each pick changes what the next one is worth. Pure.
import { miningScore } from './stats.js';
import { blazeOutput, daggersOf } from './blaze.js';
import { stepKey, bookOf } from './progress.js';
import { stepDelta, walkLine, chainCost, netCost, blazeRules, applyBlaze, limitsOf } from './optimizer.js';
import { applyStep, baseStats } from './virtual.js';

const FLOOR = 1e6;
const DEFAULT_BRAKE = 5;
const REST = ['noPrice', 'noGain', 'zero', 'locked'];
const ARMOR = ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'];
const EQUIPMENT = ['NECKLACE', 'CLOAK', 'BELT', 'GLOVES', 'BRACELET'];
const TOOLS = ['DRILL', 'PICKAXE', 'GAUNTLET'];

const isBlaze = (world) => !!world.state;

// What a step does, for one state of the plan.
const rulesOf = (world, env) => (isBlaze(world)
  ? blazeRules(world.state, world.loadout, { ...env.ctx, profile: world.profile }, env.settings, env.guide)
  : { deltaOf: (step) => stepDelta(step, world.loadout, world.profile, env.ctx.items, env.settings, env.guide), gainOf: (delta) => miningScore(world.base, delta, env.settings) });

// The loadout after a step: the same slots with the pieces of the new profile, and what came new in its slot.
function nextLoadout(loadout, before, profile, items, area) {
  // by place: a profile can hold two pieces with one id, and the worn one must stay the worn one
  const fresh = (piece) => piece && (profile.items[before.items.indexOf(piece)] ?? profile.items.find((i) => i.id === piece.id) ?? piece);
  const out = { ...loadout, armor: loadout.armor.map(fresh), equipment: loadout.equipment.map(fresh), held: fresh(loadout.held), accessories: loadout.accessories.map(fresh) };
  const swap = (list, piece, same) => [...list.filter((i) => !same(i)), piece];
  for (const piece of profile.items.slice(before.items.length)) {
    const category = items?.[piece.id]?.category;
    const sameCategory = (i) => items?.[i.id]?.category === category;
    if (ARMOR.includes(category)) out.armor = swap(out.armor, piece, sameCategory);
    else if (EQUIPMENT.includes(category)) out.equipment = swap(out.equipment, piece, sameCategory);
    else if (category === 'ACCESSORY') out.accessories = swap(out.accessories, piece, (i) => (items[i.id]?.family ?? i.id) === (items[piece.id].family ?? piece.id));
    else if (area === 'mining' && TOOLS.includes(category)) out.held = piece;
  }
  if (area === 'blaze') out.daggers = daggersOf(profile);
  const pet = profile.pets.find((p) => p.active);
  if (pet && !before.pets.some((old) => old.active && old.type === pet.type)) out.pet = pet;
  return out;
}

// The state of the plan after the steps of a unit, the last of which brought delta.
function advance(world, steps, delta, env) {
  let { profile, loadout } = world;
  for (const { step } of steps) {
    const next = applyStep(profile, step, env.guide, env.ctx.items);
    loadout = nextLoadout(loadout, profile, next, env.ctx.items, env.guide.area);
    profile = next;
  }
  if (!delta) return { ...world, profile, loadout };
  if (isBlaze(world)) {
    if (delta.mp && profile.mp !== null && profile.mp !== undefined) profile = { ...profile, mp: profile.mp + delta.mp };
    return { ...world, profile, loadout, state: applyBlaze(world.state, delta) };
  }
  return { ...world, profile, loadout, base: baseStats(world.base, [delta]) };
}

function addChange(sum, more) {
  if (!sum) return more;
  if (!more) return sum;
  if (!more.common) return baseStats(sum, [more]);
  const line = (name, of) => baseStats(sum[of][name], [more[of][name]]);
  const swaps = { ...sum.swaps };
  for (const [name, swap] of Object.entries(more.swaps)) swaps[name] = { id: swap.id, lore: baseStats(swaps[name]?.lore ?? {}, [swap.lore]) };
  return {
    common: baseStats(sum.common, [more.common]), lines: { ashen: line('ashen', 'lines'), spirit: line('spirit', 'lines') },
    enchants: { ashen: { ...sum.enchants.ashen, ...more.enchants.ashen }, spirit: { ...sum.enchants.spirit, ...more.enchants.spirit } },
    swaps, armor: [...sum.armor, ...more.armor], ofa: sum.ofa || more.ofa, mp: sum.mp + more.mp, missing: [...sum.missing, ...more.missing], notes: [...sum.notes, ...more.notes],
  };
}

// What a unit costs right now. Also for a price that came in after the plan was made.
function unitPrice(unit, env) {
  const { coins, unpriced } = chainCost(unit, { ...env.ctx, profile: unit.profile });
  const { net, resale } = netCost(unit.target.step, coins, unit.loadout, env.other, env.ctx.items, { ...env.ctx, profile: unit.profile, guide: env.guide, nt: env.nt }, env.keepOldGear);
  return { coins, unpriced, net, resale };
}

const sumPrices = (prices) => prices.reduce((sum, p) => ({ coins: sum.coins + p.coins, unpriced: sum.unpriced + p.unpriced, net: sum.net + p.net, resale: sum.resale + p.resale }), { coins: 0, unpriced: 0, net: 0, resale: 0 });

const tableStep = (units) => units.some((u) => u.target.step.table);

function tierOf(move) {
  if (move.helps.length) return 'requirement';
  if (move.unpriced) return 'noPrice';
  if (move.net > 0) return 'value';
  return move.coins > 0 || tableStep(move.units) ? 'free' : 'noPrice';
}

// One thing to pick: a line up to its first value, or a whole group, each step on top of the ones before it.
function moveOf(list, world, env) {
  const start = world;
  let now = world;
  const units = [];
  const notes = [];
  const helps = new Set();
  let delta = null;
  let progress = 0;
  let unknown = false;
  let leftover = null;
  let shown = null;
  let valued = 0;
  const isGroup = list.length > 1 || !!list[0][0].step.group;
  for (const chain of list) {
    const rules = rulesOf(now, env);
    // a profile out of the ticks does not know skills and collections, so it cannot say a step is locked
    const walked = walkLine(chain, { ...env.ctx, profile: now.profile.virtual ? null : now.profile }, rules);
    unknown ||= !!walked.unknown;
    notes.push(...(walked.notes ?? []));
    if (walked.group === 'locked') return { list, tier: 'locked', status: 'locked', reasons: walked.reasons, notes };
    if (walked.group) {
      leftover ??= walked.group;
      shown = addChange(shown, rules.deltaOf(chain[0].step));
      // a member with no value is still bought with the group, and what follows builds on it
      if (isGroup) {
        units.push({ steps: chain, target: chain[0], loadout: now.loadout, profile: now.profile });
        now = advance(now, chain, null, env);
      }
      continue;
    }
    valued++;
    units.push({ steps: walked.steps, target: walked.target, loadout: now.loadout, profile: now.profile });
    walked.helps.forEach((h) => helps.add(h));
    progress = Math.min(progress + walked.progress, 1);
    delta = addChange(delta, walked.delta);
    now = advance(now, walked.steps, walked.delta, env);
  }
  const status = unknown ? 'unknown' : 'ok';
  if (!valued) return { list, tier: leftover ?? 'zero', status, reasons: [], notes, delta: shown };
  const gain = isBlaze(start)
    ? (blazeOutput(start.state) > 0 ? blazeOutput(now.state) / blazeOutput(start.state) - 1 : 0)
    : miningScore(start.base, delta, env.settings);
  const price = sumPrices(units.map((u) => unitPrice(u, env)));
  const ahead = !isGroup && units[0].target !== units[0].steps[0] ? units[0].target.step : null;
  const move = { list, units, delta: addChange(delta, shown), gain, helps: [...helps], progress, status, reasons: [], notes, ahead, after: now, ...price };
  move.perMillion = move.net > 0 ? gain / (move.net / 1e6) : null;
  move.pace = !move.unpriced && (move.coins > 0 || tableStep(units)) ? (move.net > 0 ? progress / (move.net / 1e6) : Infinity) : -1;
  move.tier = tierOf(move);
  return move;
}

const indexOfMove = (move) => move.list[0][0].index;

// shortcut: a line head with no value right before a group member waits for the rest phase and takes the group with it; pull it into the group if a guide shows that.
function candidates(open, env, world) {
  const seenLines = new Set();
  const seenGroups = new Set();
  const moves = [];
  for (const entry of open) {
    const { line, group } = entry.step;
    if (group) {
      // the line waits behind its member, also when an earlier member stood for the group
      if (line) seenLines.add(line);
      if (seenGroups.has(group)) continue;
      seenGroups.add(group);
      const members = open.filter((e) => e.step.group === group);
      const reachable = members.every((m) => !m.step.line || open.filter((e) => e.step.line === m.step.line && e.index < m.index).every((e) => e.step.group === group));
      if (reachable) moves.push(moveOf(members.map((m) => [m]), world, env));
      continue;
    }
    if (line) {
      if (seenLines.has(line)) continue;
      seenLines.add(line);
      const rest = open.filter((e) => e.step.line === line);
      const end = rest.findIndex((e) => e.step.group);
      moves.push(moveOf([end < 0 ? rest : rest.slice(0, end)], world, env));
      continue;
    }
    moves.push(moveOf([[entry]], world, env));
  }
  return moves;
}

const best = (moves, better) => moves.reduce((a, b) => (!a || better(b, a) ? b : a), null);
const earlier = (a, b) => indexOfMove(a) < indexOfMove(b);

// The next move: see the plan's order of tiers. overCap is a tier of its own only once it is picked.
function pick(moves, cap) {
  const prioritized = moves.filter((m) => m.tier !== 'locked' && m.list.flat().some((e) => e.step.priority));
  const rank = (m) => Math.max(...m.list.flat().map((e) => e.step.priority ?? 0));
  if (prioritized.length) return { move: best(prioritized, (a, b) => rank(a) > rank(b) || (rank(a) === rank(b) && earlier(a, b))), tier: 'priority' };
  const ofTier = (tier) => moves.filter((m) => m.tier === tier);
  const requirement = best(ofTier('requirement'), (a, b) => a.pace > b.pace || (a.pace === b.pace && ((a.perMillion ?? 0) > (b.perMillion ?? 0) || ((a.perMillion ?? 0) === (b.perMillion ?? 0) && earlier(a, b)))));
  if (requirement) return { move: requirement, tier: 'requirement' };
  const free = best(ofTier('free').filter((m) => m.gain > 0), (a, b) => a.gain > b.gain || (a.gain === b.gain && earlier(a, b)));
  if (free) return { move: free, tier: 'free' };
  const inCap = ofTier('value').filter((m) => m.net <= cap);
  const value = best(inCap, (a, b) => a.perMillion > b.perMillion || (a.perMillion === b.perMillion && earlier(a, b)));
  if (value) return { move: value, tier: 'value' };
  const over = best(ofTier('value'), (a, b) => a.net < b.net || (a.net === b.net && earlier(a, b)));
  if (over) return { move: over, tier: 'overCap' };
  const tierAt = (m) => REST.indexOf(m.tier);
  const rest = best(moves, (a, b) => tierAt(a) < tierAt(b) || (tierAt(a) === tierAt(b) && earlier(a, b)));
  return rest ? { move: rest, tier: rest.tier, rest: true } : null;
}

// The steps a move puts on the path. A group goes whole. A line goes as far as it was walked, and in the rest only its head: the next step gets its own round.
function stepsOfMove(move, rest) {
  const [first] = move.list[0];
  if (move.list.length > 1 || first.step.group) return move.list.flat();
  return move.units && !rest ? move.units[0].steps : [first];
}

// The rows of one move. Its first row carries the sum, a group counts down what is left of it.
function entriesOf(move, tier, rest = false) {
  const list = stepsOfMove(move, rest);
  return list.map((e, i) => ({
    key: e.key, section: e.section, step: e.step,
    group: e.step.group ? { id: e.step.group, left: list.length - 1 - i, head: i === 0 } : null,
    gain: i === 0 ? move.gain ?? 0 : 0, delta: i === 0 ? move.delta ?? null : null,
    coins: i === 0 ? move.coins ?? 0 : 0, net: i === 0 ? move.net ?? 0 : 0, resale: i === 0 ? move.resale ?? 0 : 0, unpriced: i === 0 ? move.unpriced ?? 0 : 0,
    tier, status: move.status, reasons: move.reasons, notes: i === 0 ? move.notes : [], ahead: i === 0 ? move.ahead ?? null : null,
    helps: i === 0 ? move.helps ?? [] : [], units: i === 0 ? move.units ?? null : null,
  }));
}

function nextRound(open, picked) {
  const taken = new Set(picked.map((e) => e.key));
  return open.filter((e) => !taken.has(e.key));
}

// Guide order with no pick: a fixed guide, and any guide while no prices are in. What each step brings still adds up.
function inGuideOrder(open, world, env) {
  const order = [];
  let now = world;
  let left = open;
  while (left.length) {
    const entry = left[0];
    const members = entry.step.group ? left.filter((e) => e.step.group === entry.step.group) : [entry];
    const move = moveOf(members.map((m) => [m]), now, env);
    const entries = entriesOf(move, move.tier);
    order.push(...entries);
    now = move.after ?? (move.tier === 'locked' ? now : advance(now, entries, null, env));
    left = nextRound(left, entries);
  }
  return order;
}

function byValue(open, world, env, doneCost) {
  const order = [];
  let now = world;
  let left = open;
  let spent = doneCost;
  while (left.length) {
    const moves = candidates(left, env, now);
    // groups blocking each other: the first open step goes on its own, so the path always ends
    const chosen = pick(moves.length ? moves : [moveOf([[left[0]]], now, env)], env.brake * Math.max(spent, FLOOR));
    const entries = entriesOf(chosen.move, chosen.tier, chosen.rest);
    order.push(...entries);
    if (!chosen.rest) {
      spent += chosen.move.net ?? 0;
      now = chosen.move.after ?? advance(now, entries, null, env);
    }
    left = nextRound(left, entries);
  }
  return order;
}

// The guide's coins of what is done count as spent, whatever they were worth then.
function spentSoFar(guide, checked, env) {
  const done = guide.sections.filter((section) => !section.extra).flatMap((section) => section.steps.filter((step) => checked.has(stepKey(section, step))).map((step) => ({ section, step, index: 0, key: stepKey(section, step) })));
  // the last level of a book line holds the price of the levels below it
  const lastBook = new Map(done.filter((e) => e.step.line && bookOf(e.step)).map((e) => [e.step.line, e]));
  return done.filter((e) => !e.step.line || !bookOf(e.step) || lastBook.get(e.step.line) === e)
    .reduce((sum, e) => sum + chainCost({ steps: [e], target: e }, env.ctx).coins, 0);
}

export function pathOf({ guide, checked, ctx, profile, loadout, base, settings, brake = DEFAULT_BRAKE, other = null, keepOldGear = false, state = null }) {
  const nt = new Set(guide.sections.flatMap((s) => s.steps.flatMap((step) => (step.items ?? []).filter((i) => i.nt && i.id).map((i) => i.id))));
  const env = { guide, ctx: { ...ctx, profile }, settings, other, keepOldGear, nt, brake: brake > 0 ? brake : DEFAULT_BRAKE };
  let index = 0;
  const open = guide.sections.flatMap((section) => (section.extra ? [] : section.steps.flatMap((step) => {
    const key = stepKey(section, step);
    index++;
    return checked.has(key) ? [] : [{ section, step, key, index }];
  })));
  const world = { profile, loadout, base, state };
  const order = guide.order === 'fixed' || !ctx.products ? inGuideOrder(open, world, env) : byValue(open, world, env, spentSoFar(guide, checked, env));
  const notes = [...new Set(order.flatMap((e) => e.notes))];
  return { order, limits: state ? limitsOf(profile, state) : null, notes };
}

// The cost of a row right now: a later price changes this number, not the place in the plan.
export function entryPrice(entry, { guide, ctx, other = null, keepOldGear = false }) {
  if (!entry.units) return { coins: 0, unpriced: 0, net: 0, resale: 0 };
  const nt = new Set(guide.sections.flatMap((s) => s.steps.flatMap((step) => (step.items ?? []).filter((i) => i.nt && i.id).map((i) => i.id))));
  return sumPrices(entry.units.map((u) => unitPrice(u, { guide, ctx, other, keepOldGear, nt })));
}

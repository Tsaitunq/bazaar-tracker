// What the profile suggests, against what the app holds now: rows by area, each new / different / same / conflict, and the
// way to apply a chosen set of rows and to take them back. Pure: nothing here reads or writes the stores.
// A row is only a suggestion. Nothing is ticked or changed without the player picking it. A tick the player made is never removed.
import { detectGuide, lineOf } from '../detect.js';
import { doneSet, stepKey } from '../progress.js';
import { autoOf, tickStep, stampAll } from '../model.js';
import { commitGuide, expandChecks } from '../keys.js';
import { EMPTY_PART, setPart, setPet, setPetItem, hotmPowder } from '../build.js';
import { drillOmelette } from './profile.js';

export const AREAS = [['hotm', 'HOTM'], ['attributes', 'Attributes'], ['essence', 'Essence'], ['pets', 'Pets'], ['power', 'Power'], ['gear', 'Gear']];

// The data can be up to an hour old on the server and a few minutes on the device.
export const STALE_MS = 70 * 60e3;

const clone = (v) => (v === undefined ? v : structuredClone(v));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---- the measurement guard -------------------------------------------------------------------------------------------------

// A part the build already holds is compared with the snapshot of each measurement: a change is then a change since that
// measurement. A measurement younger than the profile data may already contain what is newer than the data, so a value that
// differs from the build is not taken then. A part that is still unknown (null) is always safe: setPart writes it into the
// snapshots too, so nothing is counted twice.
export function guardOf(world, profile, part) {
  if (world.build?.[part] === null || world.build?.[part] === undefined) return { delta: false, blocked: null, since: null };
  const entries = Object.values(world.base ?? {}).filter((e) => e?.snapshot?.[part] !== undefined && e.snapshot[part] !== null);
  if (!entries.length) return { delta: false, blocked: null, since: null };
  const since = Math.max(...entries.map((e) => e.at ?? 0));
  const blocked = entries.some((e) => (e.at ?? 0) > profile.fetchedAt - STALE_MS) ? 'Your measurement is newer than the profile data. Load the profile again later.' : null;
  return { delta: true, blocked, since };
}

// ---- rows ------------------------------------------------------------------------------------------------------------------

// A map part (HOTM levels, attributes, essence): level per key. Lower in the profile than in the app is a conflict, shown only.
function levelRows({ area, part, now, incoming, nameOf, change, world, profile }) {
  const rows = [];
  let equal = 0;
  const guard = guardOf(world, profile, part);
  for (const key of new Set([...Object.keys(now), ...Object.keys(incoming)])) {
    const have = now[key] ?? 0;
    const want = incoming[key] ?? 0;
    if (have === want) { if (want > 0) equal++; continue; }
    const base = { id: `${part}:${key}`, area, label: nameOf(key), from: have, to: want };
    if (want < have) { rows.push({ ...base, status: 'conflict', note: 'The profile has less than you entered. Not changed.' }); continue; }
    rows.push({ ...base, status: have === 0 ? 'new' : 'different', kind: 'part', part, change: change(key, want), ...guardNote(guard) });
  }
  return { rows, equal };
}

const guardNote = (guard) => ({ blocked: guard.blocked, note: guard.delta && !guard.blocked ? `Counts as a change since your measurement on ${new Date(guard.since).toISOString().slice(0, 10)}.` : undefined });

function hotmRows(world, profile) {
  const h = profile.hotm;
  if (!h) return { rows: [], equal: 0, notes: profile.missing.list.includes('hotm') ? ['The HOTM API is off in the game.'] : [] };
  const data = world.gamedata;
  const now = world.build.hotm ?? EMPTY_PART.hotm();
  const perkName = (id) => data.hotm.perks.find((p) => p.id === id)?.name ?? id;
  const guard = guardOf(world, profile, 'hotm');
  const out = levelRows({ area: 'hotm', part: 'hotm', now: now.levels ?? {}, incoming: h.levels, nameOf: perkName, world, profile, change: (id, level) => (p) => ({ ...p, levels: { ...p.levels, [id]: level } }) });
  const rows = out.rows.map((r) => ({ ...r, id: `hotm:level:${r.id.split(':')[1]}` }));
  const extra = (id, label, have, want, change) => {
    if (want === null || want === undefined || same(have, want)) { if (want !== null && want !== undefined) out.equal++; return; }
    if (typeof want === 'number' && typeof have === 'number' && want < have) rows.push({ id, area: 'hotm', label, from: have, to: want, status: 'conflict', note: 'The profile has less than you entered. Not changed.' });
    else rows.push({ id, area: 'hotm', label, from: have ?? '–', to: want, status: have === null || have === undefined ? 'new' : 'different', kind: 'part', part: 'hotm', change, ...guardNote(guard) });
  };
  extra('hotm:tier', 'HOTM tier', now.tier, h.tier, (p) => ({ ...p, tier: h.tier }));
  extra('hotm:ability', 'Selected ability', now.ability ? perkName(now.ability) : null, h.ability ? perkName(h.ability) : null, (p) => ({ ...p, ability: h.ability }));
  // switched off in the game: each one by itself
  const off = new Set(now.disabled ?? []);
  for (const id of h.disabled) if (!off.has(id)) rows.push({ id: `hotm:off:${id}`, area: 'hotm', label: `${perkName(id)} switched off`, from: 'on', to: 'off', status: 'different', kind: 'part', part: 'hotm', change: (p) => ({ ...p, disabled: [...new Set([...(p.disabled ?? []), id])] }), ...guardNote(guard) });
  for (const id of off) if (h.levels[id] > 0 && !h.disabled.includes(id)) rows.push({ id: `hotm:on:${id}`, area: 'hotm', label: `${perkName(id)} switched on`, from: 'off', to: 'on', status: 'different', kind: 'part', part: 'hotm', change: (p) => ({ ...p, disabled: (p.disabled ?? []).filter((x) => x !== id) }), ...guardNote(guard) });
  // powder is no stat: it carries no guard
  if (Object.keys(h.powder).length) {
    const have = now.powder ?? null;
    if (same(have, h.powder)) out.equal++;
    else rows.push({ id: 'hotm:powder', area: 'hotm', label: 'Powder you have', from: have ? Object.entries(have).map(([k, v]) => `${k} ${v}`).join(', ') : '–', to: Object.entries(h.powder).map(([k, v]) => `${k} ${v}`).join(', '), status: have ? 'different' : 'new', kind: 'part', part: 'hotm', change: hotmPowder(h.powder) });
  }
  // the Goblin Omelette sits on the drill in use as its upgrade module: the import says whether it counts, on or off
  const want = drillOmelette(profile.items, world.items);
  if (want !== null) {
    if ((now.omelette === true) === want) out.equal++;
    else rows.push({ id: 'hotm:omelette', area: 'hotm', label: 'Goblin Omelette (upgrade module on your drill)', from: now.omelette === true ? 'on' : 'off', to: want ? 'on' : 'off', status: 'different', kind: 'part', part: 'hotm', change: (p) => ({ ...p, omelette: want }), ...guardNote(guard) });
  }
  return { rows: [...rows], equal: out.equal, notes: h.unknown ? [`${h.unknown} HOTM entries are not in the app's data.`] : [] };
}

function attrRows(world, profile) {
  if (!profile.attrLevels) return { rows: [], equal: 0, notes: profile.missing.list.includes('attributes') ? ['The attribute data is not in the profile.'] : [] };
  const data = world.gamedata;
  const name = (key) => data.attributes.attributes.find((a) => a.key === key)?.name ?? key;
  const out = levelRows({ area: 'attributes', part: 'attrs', now: world.build.attrs ?? {}, incoming: profile.attrLevels, nameOf: name, world, profile, change: (key, level) => (a) => ({ ...a, [key]: level }) });
  const notes = [];
  if (profile.attrUnknown) notes.push(`${profile.attrUnknown} attributes are not in the app's data.`);
  const spare = Object.values(profile.huntingBox).reduce((n, v) => n + v, 0);
  if (spare > 0) notes.push(`Hunting Box: ${spare} shards you could still apply.`);
  return { ...out, notes };
}

function essenceRows(world, profile) {
  if (!profile.essence) return { rows: [], equal: 0, notes: profile.missing.list.includes('essencePerks') ? ['The essence shop data is not in the profile.'] : [] };
  const data = world.gamedata;
  const perks = data.essence?.perks ?? [];
  const out = levelRows({ area: 'essence', part: 'essence', now: world.build.essence ?? {}, incoming: Object.fromEntries(Object.entries(profile.essence).map(([id, n]) => [id, Math.min(n, perks.find((p) => p.id === id)?.max ?? n)])), nameOf: (id) => perks.find((p) => p.id === id)?.name ?? id, world, profile, change: (id, level) => (e) => ({ ...e, [id]: level }) });
  return { ...out, notes: profile.essenceUnknown ? [`${profile.essenceUnknown} essence perks are not in the app's data.`] : [] };
}

function petRows(world, profile) {
  if (!profile.pets) return { rows: [], equal: 0, notes: profile.missing.list.includes('pets') ? ['The pets API is off in the game.'] : [] };
  const data = world.gamedata;
  const rows = [];
  const notes = [`${profile.pets.length} pets in the profile.`];
  const active = profile.pets.find((p) => p.active);
  if (active) {
    const known = data.pets?.pets?.find((p) => p.id === active.type && p.rarity === active.tier);
    const chosen = world.build.pet;
    if (!known) notes.push(`The active pet (${active.type}, ${active.tier}) is not in the app's pet data.`);
    else if (chosen?.id === active.type && chosen?.rarity === active.tier) { /* already chosen */ } else rows.push({ id: 'pet:active', area: 'pets', label: `Active pet: ${known.name}`, from: chosen ? `${chosen.id} ${chosen.rarity}` : 'none', to: `${known.id} ${known.rarity}`, status: 'suggest', kind: 'pet', pet: { id: known.id, rarity: known.rarity, item: active.heldItem && data.pets.items?.some((i) => i.id === active.heldItem) ? active.heldItem : undefined } });
  }
  return { rows, equal: 0, notes };
}

function powerRows(world, profile) {
  const now = world.build.power ?? EMPTY_PART.power();
  const rows = [];
  let equal = 0;
  const guard = guardOf(world, profile, 'power');
  const notes = [];
  if (profile.mp !== null) {
    if (now.mp === profile.mp) equal++;
    else if (now.mp !== null && profile.mp < now.mp) rows.push({ id: 'power:mp', area: 'power', label: 'Magical Power', from: now.mp, to: profile.mp, status: 'conflict', note: 'The profile has less than you entered. Not changed.' });
    else rows.push({ id: 'power:mp', area: 'power', label: 'Magical Power', from: now.mp ?? '–', to: profile.mp, status: now.mp === null ? 'new' : 'different', kind: 'part', part: 'power', change: (p) => ({ ...p, mp: profile.mp }), ...guardNote(guard) });
  }
  if (profile.tuning === null) notes.push('More than one tuning slot holds points, so none is taken.');
  else if (profile.tuning) {
    const stats = new Map(world.gamedata.power.tuning.stats.map((s) => [s.stat, s]));
    const out = levelRows({ area: 'power', part: 'power', now: now.tuning ?? {}, incoming: Object.fromEntries(Object.entries(profile.tuning).filter(([stat]) => stats.has(stat))), nameOf: (stat) => `Tuning ${stat}`, world, profile, change: (stat, n) => (p) => ({ ...p, tuning: { ...p.tuning, [stat]: n } }) });
    rows.push(...out.rows.map((r) => ({ ...r, id: `power:tuning:${r.id.split(':')[1]}` })));
    equal += out.equal;
  }
  // the stone is a choice the player makes per guide: only offered on its own
  if (profile.stone && now.stone !== profile.stone) {
    const stone = world.gamedata.power.powerStones.find((s) => s.id === profile.stone);
    rows.push({ id: 'power:stone', area: 'power', label: `Power stone in use: ${stone?.power ?? profile.selectedPower}`, from: now.stone ?? 'none', to: stone?.item ?? profile.stone, status: 'suggest', kind: 'part', part: 'power', change: (p) => ({ ...p, stone: profile.stone }), ...guardNote(guard) });
  } else if (!profile.stone && profile.selectedPower) notes.push(`The power in use (${profile.selectedPower}) is not in the app's data.`);
  return { rows, equal, notes };
}

// The part of the profile each detect part looked at, for "where": the items on the step's slots.
// A trait found on a higher piece of the line says so: "on DR-X655, Inventar".
const idsOf = (step, guide) => [step.detect ?? []].flat().flatMap((d) => (typeof d.on === 'string' ? guide.groups?.[d.on] : d.on) ?? []).flat();
const shortName = (name) => /[A-Z]{2}-[A-Z]?\d+/.exec(name ?? '')?.[0] ?? name;
function whereOf(step, guide, profile, items) {
  const own = new Set(idsOf(step, guide));
  const reach = new Set([...own].flatMap((id) => (step.detect && [step.detect].flat().every((d) => d.kind === 'owned') ? [id] : lineOf(id, items))));
  const places = profile.items.filter((i) => reach.has(i.id)).flatMap((i) => (i.at ?? []).map((at) => (own.has(i.id) ? at : `on ${shortName(items?.[i.id]?.name) ?? i.id}, ${at}`)));
  return [...new Set(places)].slice(0, 4);
}

function gearRows(world, profile) {
  const rows = [];
  let equal = 0;
  const live = world.checks;
  for (const guide of world.guides) {
    const found = detectGuide(guide, profile, stepKey, world.items);
    if (!found.size) continue;
    const marks = new Set(live[guide.id] ?? []);
    const done = doneSet(guide, marks, autoOf(guide, world.owned, world.build));
    for (const section of guide.sections) {
      for (const step of section.steps) {
        const key = stepKey(section, step);
        const f = found.get(key);
        if (!f) continue;
        const ticked = done.has(key);
        const base = { id: `gear:${guide.id}:${key}`, area: 'gear', guide: guide.id, title: guide.title, section: section.name, label: step.text, key, where: whereOf(step, guide, profile, world.items) };
        if (f.have >= f.need) {
          if (ticked) equal++;
          else rows.push({ ...base, status: 'new', kind: 'tick', from: 'open', to: 'done' });
        } else if (ticked) {
          rows.push({ ...base, status: 'conflict', from: 'done', to: `${f.have}/${f.need}`, note: 'Checked in the app, but not found in the profile. Not changed.' });
        } else if (f.have > 0) {
          rows.push({ ...base, status: 'partial', from: 'open', to: `${f.have}/${f.need}` });
        }
      }
    }
  }
  return { rows, equal, notes: profile.missing.inventory ? ['The inventory API is off in the game, so no gear is suggested.'] : profile.items.length ? [] : ['No items were found in the profile.'] };
}

// world: { guides, checks (as the app reads them: live), owned, build, base, gamedata, items }; profile: summarize(...)
export function proposals(world, profile) {
  const make = { hotm: hotmRows, attributes: attrRows, essence: essenceRows, pets: petRows, power: powerRows, gear: gearRows };
  return AREAS.map(([id, name]) => {
    const { rows, equal, notes } = make[id](world, profile);
    return { id, name, rows, equal, notes, pick: rows.filter(isPickable).length };
  });
}

// A row the player can choose: new or different (not blocked), the open suggestions only through their own button.
export const isPickable = (r) => (r.status === 'new' || r.status === 'different') && !r.blocked;
export const isSuggestion = (r) => r.status === 'suggest' && !r.blocked;

// ---- applying ----------------------------------------------------------------------------------------------------------------

const adds = (before, after) => after.filter((x) => !before.includes(x));

// state: { guides, checks (the app's own list), keys, owned, build, base, draft, dates }. rows: the chosen ones.
// opts.newSince: the ticks count as new since the measurement (they get today's date); default they do not (no date).
// Gives { state, undo, counts }. undo is plain data (it is stored).
export function applyRows(state, rows, { now = Date.now(), newSince = false } = {}) {
  const chosen = rows.filter((r) => isPickable(r) || isSuggestion(r));
  let { checks, keys, owned, build, base, draft } = state;
  checks = { ...checks };
  const undo = { at: now, marks: {}, keys: [], owned: [], parts: {}, pet: null };
  let ticks = 0;
  let values = 0;

  // ticks, one guide after another: the same route as a tick in the list
  const byGuide = new Map();
  for (const r of chosen.filter((x) => x.kind === 'tick')) byGuide.set(r.guide, [...(byGuide.get(r.guide) ?? []), r]);
  for (const [id, list] of byGuide) {
    const guide = state.guides.find((g) => g.id === id);
    if (!guide) continue;
    const before = { marks: checks[id] ?? [], keys, owned };
    const marks = new Set(expandChecks(state.guides, checks, keys)[id] ?? []);
    let nextOwned = owned;
    for (const r of list) {
      nextOwned = [...tickStep({ guide, key: r.key, on: true, marks, owned: nextOwned, build })];
      ticks++;
    }
    const out = commitGuide(state.guides, guide, marks, checks, keys);
    checks = out.checks;
    undo.marks[id] = adds(before.marks, checks[id] ?? []);
    undo.keys.push(...adds(before.keys, out.keys));
    undo.owned.push(...adds(before.owned, nextOwned));
    keys = out.keys;
    owned = nextOwned;
  }

  // build parts: all chosen rows of a part together
  const byPart = new Map();
  for (const r of chosen.filter((x) => x.kind === 'part')) byPart.set(r.part, [...(byPart.get(r.part) ?? []), r]);
  for (const [part, list] of byPart) {
    const before = clone(build[part]);
    const draftBefore = clone(draft?.[part]);
    // an unknown part is written once, whole, through setPart (it fills the snapshots); a known one changes in place
    const start = build[part] ?? draft?.[part] ?? EMPTY_PART[part]();
    const value = list.reduce((v, r) => r.change(v), clone(start));
    ({ build, base } = setPart(build, base, part, value));
    if (draft?.[part] !== undefined) {
      const { [part]: _gone, ...rest } = draft;
      draft = rest;
    }
    undo.parts[part] = { before, after: clone(value), draftBefore: draftBefore ?? null };
    values += list.length;
  }

  // the pet is gear: it needs no draft and touches no measurement
  const pet = chosen.find((r) => r.kind === 'pet');
  if (pet) {
    const before = clone(build.pet ?? null);
    build = setPet(build, { id: pet.pet.id, rarity: pet.pet.rarity });
    if (pet.pet.item) build = setPetItem(build, pet.pet.item);
    undo.pet = { before, after: clone(build.pet) };
    values++;
  }

  // a tick without a date counts as older than the app, so it is inside a measurement; today's date makes it a change since
  // a guide with no dates yet would count as a first run (everything 0): give it an empty list so the new ticks are stamped
  const known = Object.fromEntries(state.guides.map((g) => [g.id, state.dates?.[g.id] ?? {}]));
  const dates = stampAll(state.guides, expandChecks(state.guides, checks, keys), { ...state.dates, ...known }, newSince ? now : 0, owned);
  return { state: { ...state, checks, keys, owned, build, base, draft, dates }, undo, counts: { ticks, values } };
}

// One step back: what the import added goes, whatever the player did after stays. A part the player changed since is kept and named.
export function undoImport(state, undo) {
  const kept = [];
  const checks = { ...state.checks };
  for (const [id, added] of Object.entries(undo.marks ?? {})) checks[id] = (checks[id] ?? []).filter((m) => !added.includes(m));
  const keys = state.keys.filter((k) => !(undo.keys ?? []).includes(k));
  const owned = state.owned.filter((id) => !(undo.owned ?? []).includes(id));
  let { build, base, draft } = state;
  for (const [part, { before, after, draftBefore }] of Object.entries(undo.parts ?? {})) {
    if (!same(build[part], after)) { kept.push(part); continue; }
    build = { ...build, [part]: clone(before) };
    // a part that was unknown: the snapshots it filled are unknown again
    if (before === null) base = Object.fromEntries(Object.entries(base ?? {}).map(([area, e]) => [area, same(e.snapshot?.[part], after) ? { ...e, snapshot: { ...e.snapshot, [part]: null } } : e]));
    if (draftBefore) draft = { ...draft, [part]: clone(draftBefore) };
  }
  if (undo.pet) {
    if (same(build.pet ?? null, undo.pet.after)) build = { ...build, pet: clone(undo.pet.before) };
    else kept.push('pet');
  }
  const next = { ...state, checks, keys, owned, build, base, draft };
  const dates = stampAll(state.guides, expandChecks(state.guides, checks, keys), state.dates ?? {}, Date.now(), owned);
  return { state: { ...next, dates }, kept };
}

export const hasUndo = (undo) => !!undo && (Object.values(undo.marks ?? {}).some((m) => m.length) || undo.keys?.length || undo.owned?.length || Object.keys(undo.parts ?? {}).length || undo.pet);

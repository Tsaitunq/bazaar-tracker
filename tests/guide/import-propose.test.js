import test from 'node:test';
import assert from 'node:assert/strict';
import { proposals, applyRows, undoImport, guardOf, isPickable, isSuggestion, STALE_MS, hasUndo } from '../../apps/guide/import/propose.js';
import { expandChecks } from '../../apps/guide/keys.js';
import { stepKey } from '../../apps/guide/progress.js';
import { gamedata, emptyBuild, baseOf } from '../fixtures/guide-world.js';

const guide = {
  id: 'g1', title: 'Test guide', area: 'mining',
  sections: [
    { name: 'Armor', steps: [
      { text: 'Divan Helmet', detect: { kind: 'owned', on: [['DIVAN_HELMET']] } },
      { text: 'Divan Chestplate', detect: { kind: 'owned', on: [['DIVAN_CHESTPLATE']] } },
      { text: 'Jaded helmet', key: 'reforge:jaded-helmet', detect: { kind: 'reforge', on: [['DIVAN_HELMET']], value: ['jaded'] } },
      { text: 'Both gloves', detect: { kind: 'owned', on: [['GLOVE_A'], ['GLOVE_B']] } },
    ] },
  ],
};
const item = (id, at, extra = {}) => ({ id, at, reforge: null, enchants: {}, gems: [], unlocked: [], recomb: false, upgradedRarity: null, hpb: 0, fuming: 0, stars: 0, parts: {}, polarvoid: 0, coating: false, scrolls: [], ...extra });
const profile = (extra = {}) => ({
  profileId: 'p', profileName: 'Apple', fetchedAt: 10 * STALE_MS, items: [], pets: null, attrs: null, attrLevels: null, attrUnknown: 0, huntingBox: {},
  perks: null, essence: null, essenceUnknown: 0, hotm: null, mp: null, powers: null, selectedPower: null, stone: null, tuning: null, skills: null, collTiers: null,
  missing: { inventory: false, list: [] }, ...extra,
});
const world = (extra = {}) => ({ guides: [guide], checks: { g1: [] }, owned: [], build: emptyBuild(), base: {}, draft: {}, gamedata, ...extra });
const state = (w, extra = {}) => ({ guides: w.guides, checks: { g1: [] }, keys: [], owned: [], build: w.build, base: w.base, draft: {}, dates: {}, ...extra });
const area = (list, id) => list.find((a) => a.id === id);
const key = (text) => stepKey(guide.sections[0], guide.sections[0].steps.find((s) => s.text === text));

test('gear: a found item is new with its place, a part of a set is partial, nothing is guessed', () => {
  const p = profile({ items: [item('DIVAN_HELMET', ['Getragen', 'Wardrobe Set 3']), item('GLOVE_A', ['Backpack 5'])] });
  const gear = area(proposals(world(), p), 'gear');
  const by = Object.fromEntries(gear.rows.map((r) => [r.label, r]));
  assert.equal(by['Divan Helmet'].status, 'new');
  assert.deepEqual(by['Divan Helmet'].where, ['Getragen', 'Wardrobe Set 3']);
  assert.equal(by['Both gloves'].status, 'partial');
  assert.equal(by['Both gloves'].to, '1/2');
  assert.equal(by['Divan Chestplate'], undefined); // not found and not ticked: no row
  assert.equal(by['Jaded helmet'], undefined); // the helmet is not jaded: no row
});

test('gear: what is already done is "same", and a tick the profile does not back is a conflict that stays', () => {
  const w = world({ checks: { g1: [key('Divan Helmet'), key('Divan Chestplate')] }, owned: [] });
  const gear = area(proposals(w, profile({ items: [item('DIVAN_HELMET', ['Getragen'])] })), 'gear');
  assert.equal(gear.equal, 1);
  const conflict = gear.rows.find((r) => r.label === 'Divan Chestplate');
  assert.equal(conflict.status, 'conflict');
  assert.equal(isPickable(conflict), false);
  // even when handed in by mistake, a conflict changes nothing
  const out = applyRows(state(w, { checks: { g1: [key('Divan Helmet'), key('Divan Chestplate')] } }), [conflict]);
  assert.deepEqual(out.state.checks.g1, [key('Divan Helmet'), key('Divan Chestplate')]);
  assert.deepEqual(out.counts, { ticks: 0, values: 0 });
});

test('gear: nothing is suggested when the inventory API is off', () => {
  const gear = area(proposals(world(), profile({ missing: { inventory: true, list: ['inventories.armor'] } })), 'gear');
  assert.deepEqual(gear.rows, []);
  assert.match(gear.notes[0], /inventory API is off/);
});

test('applying a gear row ticks the item for all guides and a keyed step by its key; existing ticks stay', () => {
  const w = world({ checks: { g1: ['Armor|a manual mark'] } });
  const p = profile({ items: [item('DIVAN_HELMET', ['Getragen'], { reforge: 'jaded' })] });
  const rows = area(proposals(w, p), 'gear').rows.filter(isPickable);
  assert.deepEqual(rows.map((r) => r.label).sort(), ['Divan Helmet', 'Jaded helmet']);
  const out = applyRows(state(w, { checks: { g1: ['Armor|a manual mark'] } }), rows);
  assert.ok(out.state.owned.includes('DIVAN_HELMET'));
  assert.ok(out.state.keys.includes('reforge:jaded-helmet'));
  assert.ok(out.state.checks.g1.includes('Armor|a manual mark'));
  assert.deepEqual(out.counts, { ticks: 2, values: 0 });
});

test('applied ticks have no date by default and today only on request', () => {
  const w = world();
  const rows = area(proposals(w, profile({ items: [item('DIVAN_HELMET', ['Getragen'])] })), 'gear').rows.filter(isPickable);
  const k = key('Divan Helmet');
  assert.equal(applyRows(state(w), rows, { now: 5000 }).state.dates.g1[k], 0);
  assert.equal(applyRows(state(w), rows, { now: 5000, newSince: true }).state.dates.g1[k], 5000);
});

const hotm = (extra = {}) => ({ levels: { mining_speed: 10, mining_fortune: 5 }, tier: 4, experience: 40000, ability: null, disabled: [], powder: {}, unknown: 0, ...extra });

test('HOTM: an unknown part is written whole and fills the snapshots, so the base is not counted twice', () => {
  const base = baseOf({ mining: { values: { MINING_SPEED: 1000 } } }); // measured with an empty build: hotm unknown (null)
  const w = world({ base });
  assert.equal(base.mining.snapshot.hotm, null);
  const rows = area(proposals(w, profile({ hotm: hotm() })), 'hotm').rows;
  assert.ok(rows.every((r) => r.blocked === null || r.blocked === undefined));
  const out = applyRows(state(w), rows.filter(isPickable));
  assert.equal(out.state.build.hotm.levels.mining_speed, 10);
  assert.equal(out.state.build.hotm.tier, 4);
  assert.deepEqual(out.state.base.mining.snapshot.hotm, out.state.build.hotm); // no change since the measurement
  assert.equal(guardOf(w, profile(), 'hotm').delta, false);
});

test('HOTM: a known part against a measurement is a change since it, and blocked when the measurement is younger than the data', () => {
  const known = { ...emptyBuild(), hotm: { tier: 3, levels: { mining_speed: 5 }, omelette: false, disabled: [], ability: null } };
  const old = { mining: { at: 1, values: {}, snapshot: known } };
  const w = world({ build: known, base: old });
  const p = profile({ hotm: hotm() });
  const row = area(proposals(w, p), 'hotm').rows.find((r) => r.id === 'hotm:level:mining_speed');
  assert.equal(row.status, 'different');
  assert.equal(row.blocked, null);
  assert.match(row.note, /change since your measurement/);
  const fresh = world({ build: known, base: { mining: { at: p.fetchedAt - 5 * 60e3, values: {}, snapshot: known } } });
  const blocked = area(proposals(fresh, p), 'hotm').rows.find((r) => r.id === 'hotm:level:mining_speed');
  assert.match(blocked.blocked, /newer than the profile data/);
  assert.equal(isPickable(blocked), false);
});

test('levels: lower in the profile than in the app is a conflict that is only shown', () => {
  const have = { ...emptyBuild(), attrs: { forest_strength: 8, bucket_lover: 1 } };
  const rows = area(proposals(world({ build: have }), profile({ attrLevels: { forest_strength: 3, bucket_lover: 4 } })), 'attributes').rows;
  const by = Object.fromEntries(rows.map((r) => [r.id, r]));
  assert.equal(by['attrs:forest_strength'].status, 'conflict');
  assert.equal(by['attrs:bucket_lover'].status, 'different');
  assert.equal(by['attrs:bucket_lover'].from, 1);
  assert.equal(by['attrs:bucket_lover'].to, 4);
});

test('attributes: the Hunting Box is an info line, not a level', () => {
  const a = area(proposals(world(), profile({ attrLevels: { forest_strength: 2 }, huntingBox: { C1: 4, C2: 3 } })), 'attributes');
  assert.ok(a.notes.some((n) => n.includes('7 shards')));
  assert.equal(a.rows.length, 1);
});

test('power: MP and tuning are rows; the stone, the pet and the omelette are suggestions, never part of "all"', () => {
  const stone = gamedata.power.powerStones[0];
  const p = profile({
    mp: 1200, stone: stone.id, selectedPower: stone.power.toLowerCase(), tuning: { STRENGTH: 3 },
    pets: [{ type: gamedata.pets.pets[0].id, tier: gamedata.pets.pets[0].rarity, exp: 5, heldItem: null, active: true }],
    items: [item('GEMSTONE_DRILL_4', ['Inventar'], { parts: { upgrade_module: 'GOBLIN_OMELETTE' } })],
    hotm: hotm(),
  });
  const list = proposals(world(), p);
  const power = area(list, 'power').rows;
  assert.equal(power.find((r) => r.id === 'power:mp').status, 'new');
  assert.equal(power.find((r) => r.id === 'power:tuning:STRENGTH').to, 3);
  assert.equal(power.find((r) => r.id === 'power:stone').status, 'suggest');
  assert.equal(area(list, 'pets').rows[0].status, 'suggest');
  assert.equal(area(list, 'hotm').rows.find((r) => r.id === 'hotm:omelette').status, 'suggest');
  for (const r of [...power, ...area(list, 'pets').rows, ...area(list, 'hotm').rows]) if (r.status === 'suggest') assert.equal(isPickable(r), false);
  // "apply all" of Power = the pickable rows: the stone stays as it was
  const out = applyRows(state(world()), power.filter(isPickable));
  assert.equal(out.state.build.power.mp, 1200);
  assert.equal(out.state.build.power.stone, null);
  // its own button takes the suggestion
  const set = applyRows(state(world()), power.filter(isSuggestion));
  assert.equal(set.state.build.power.stone, stone.id);
});

test('the active pet is chosen only through its own row', () => {
  const pet = gamedata.pets.pets[0];
  const rows = area(proposals(world(), profile({ pets: [{ type: pet.id, tier: pet.rarity, exp: 1, heldItem: null, active: true }] })), 'pets').rows;
  const out = applyRows(state(world()), rows.filter(isSuggestion));
  assert.equal(out.state.build.pet.id, pet.id);
  assert.equal(out.state.build.pet.rarity, pet.rarity);
  assert.equal(applyRows(state(world()), rows.filter(isPickable)).state.build.pet, emptyBuild().pet);
});

test('a field the profile lacks gives a note and no rows', () => {
  const list = proposals(world(), profile({ missing: { inventory: false, list: ['hotm', 'pets'] } }));
  assert.deepEqual(area(list, 'hotm').rows, []);
  assert.match(area(list, 'hotm').notes[0], /HOTM API is off/);
  assert.match(area(list, 'pets').notes[0], /pets API is off/);
});

test('undo takes back what the import added and keeps what the player did after', () => {
  const base = baseOf({ mining: { values: { MINING_SPEED: 1000 } } });
  const w = world({ base });
  const p = profile({ hotm: hotm(), items: [item('DIVAN_HELMET', ['Getragen'])] });
  const rows = proposals(w, p).flatMap((a) => a.rows).filter(isPickable);
  const done = applyRows(state(w), rows);
  assert.ok(hasUndo(done.undo));
  // the player ticks something else afterwards
  const later = { ...done.state, checks: { g1: [...done.state.checks.g1, 'Armor|my own tick'] }, owned: [...done.state.owned, 'SOMETHING_ELSE'] };
  const { state: back, kept } = undoImport(later, done.undo);
  assert.deepEqual(kept, []);
  assert.ok(!back.owned.includes('DIVAN_HELMET'));
  assert.ok(back.owned.includes('SOMETHING_ELSE'));
  assert.ok(back.checks.g1.includes('Armor|my own tick'));
  assert.equal(back.build.hotm, null);
  assert.equal(back.base.mining.snapshot.hotm, null); // the snapshot is unknown again
});

test('undo keeps a part the player changed after the import and names it', () => {
  const w = world();
  const done = applyRows(state(w), area(proposals(w, profile({ mp: 1200 })), 'power').rows.filter(isPickable));
  const changed = { ...done.state, build: { ...done.state.build, power: { ...done.state.build.power, mp: 1300 } } };
  const { state: back, kept } = undoImport(changed, done.undo);
  assert.deepEqual(kept, ['power']);
  assert.equal(back.build.power.mp, 1300);
});

test('an unknown part with a typed draft starts from the draft and gives it back on undo', () => {
  const base = baseOf({ mining: { values: { MINING_SPEED: 1000 } } });
  const draft = { power: { stone: null, mp: 900, tuning: {} } };
  const w = world({ base, draft });
  const rows = area(proposals(w, profile({ mp: 1200 })), 'power').rows.filter(isPickable);
  const done = applyRows(state(w, { draft }), rows);
  assert.equal(done.state.build.power.mp, 1200);
  assert.equal(done.state.draft.power, undefined);
  const { state: back } = undoImport(done.state, done.undo);
  assert.deepEqual(back.draft.power, draft.power);
});

test('the expanded marks of the app match what a tick leaves', () => {
  const w = world();
  const rows = area(proposals(w, profile({ items: [item('DIVAN_HELMET', ['Getragen'], { reforge: 'jaded' })] })), 'gear').rows.filter(isPickable);
  const out = applyRows(state(w), rows);
  const live = expandChecks(w.guides, out.state.checks, out.state.keys);
  assert.ok(live.g1.includes(key('Jaded helmet')));
});

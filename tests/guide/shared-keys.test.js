import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validGuide, doneSet, stepKey } from '../../apps/guide/progress.js';
import { expandChecks, collapseChecks, commitGuide, resetKeys } from '../../apps/guide/keys.js';
import { runMigration } from '../../apps/guide/migrate.js';

const A = { id: 'a', title: 'A', sections: [{ name: 'Gear', steps: [
  { text: 'Helmet gem', key: 'gem:divan_helmet:JADE:FLAWLESS:1' },
  { text: 'Own', key: 'perk:eager_miner:1' },
  { text: 'Plain' },
] }] };
const B = { id: 'b', title: 'B', legacy: { 'Old|Jade on helmet': 'gem:divan_helmet:JADE:FLAWLESS:1', 'Old|Perfect': ['gem:x:JADE:PERFECT:1', 'gem:x:JADE:FLAWLESS:1'] }, sections: [{ name: 'Other', steps: [
  { text: 'Jade somewhere else', key: 'gem:divan_helmet:JADE:FLAWLESS:1' },
  { text: 'Perfect', key: 'gem:x:JADE:PERFECT:1' },
  { text: 'Flawless', key: 'gem:x:JADE:FLAWLESS:1' },
] }] };

test('a tick in guide A is done in guide B with the same key', () => {
  const marks = new Set(['Gear|Helmet gem', 'Gear|Plain']);
  const { checks, keys } = commitGuide([A, B], A, marks, {}, []);
  assert.deepEqual(keys, ['gem:divan_helmet:JADE:FLAWLESS:1']);
  assert.deepEqual(checks.a, ['Gear|Plain']);
  const live = expandChecks([A, B], checks, keys);
  assert.ok(live.b.includes('Other|Jade somewhere else'));
  assert.ok(doneSet(B, new Set(live.b)).has('Other|Jade somewhere else'));
  assert.ok(!live.b.includes('Other|Perfect'));
});

test('an untick in A removes the tick for B too', () => {
  const first = commitGuide([A, B], A, new Set(['Gear|Helmet gem']), {}, []);
  const second = commitGuide([A, B], A, new Set(), first.checks, first.keys);
  assert.deepEqual(second.keys, []);
  assert.deepEqual(expandChecks([A, B], second.checks, second.keys).b, []);
});

test('reset of a guide takes its keys out for all guides', () => {
  assert.deepEqual(resetKeys(A, ['gem:divan_helmet:JADE:FLAWLESS:1', 'other:key']), ['other:key']);
});

test('migration loses no tick: moved or kept', () => {
  const checks = { a: ['Gear|Helmet gem', 'Gear|Plain', 'undone:Gear|Own'], mining: ['Old|Jade on helmet', 'Old|Perfect', 'Old|Unknown', 'undone:Old|Unknown 2'] };
  const before = Object.values(checks).flat().length;
  const out = collapseChecks([A, B], checks, []);
  assert.deepEqual(out.checks.a, ['Gear|Plain']);
  assert.deepEqual(out.checks.mining, ['Old|Unknown', 'undone:Old|Unknown 2']);
  assert.deepEqual(new Set(out.keys), new Set(['gem:divan_helmet:JADE:FLAWLESS:1', 'undone:perk:eager_miner:1', 'gem:x:JADE:PERFECT:1', 'gem:x:JADE:FLAWLESS:1']));
  // each old mark went to the list (one mark may become two keys) or stayed
  assert.equal(Object.values(out.checks).flat().length, 3);
  assert.ok(out.keys.length >= before - 3);
});

test('a tick beats an untick when old guides disagree, and a second run changes nothing', () => {
  const checks = { a: ['undone:Gear|Helmet gem'], mining: ['Old|Jade on helmet'] };
  const once = collapseChecks([A, B], checks, []);
  assert.deepEqual(once.keys, ['gem:divan_helmet:JADE:FLAWLESS:1']);
  const twice = collapseChecks([A, B], once.checks, once.keys);
  assert.deepEqual(twice, once);
});

test('runMigration moves the ticks and sets the schema', () => {
  const data = new Map(Object.entries({ 'pg.schema': 2, 'pg.checks': { a: ['Gear|Helmet gem'] } }));
  const io = { read: (k, d) => (data.has(k) ? structuredClone(data.get(k)) : d), write: (k, v) => { data.set(k, structuredClone(v)); return true; }, drop: (k) => data.delete(k) };
  assert.equal(runMigration(io, [A, B]), true);
  assert.deepEqual(data.get('pg.keys'), ['gem:divan_helmet:JADE:FLAWLESS:1']);
  assert.equal(data.get('pg.schema'), 4);
  assert.equal(runMigration(io, [A, B]), false);
});

test('validGuide keeps keys and legacy, refuses a duplicate or a bad key', () => {
  const ok = validGuide(B);
  assert.equal(ok.sections[0].steps[0].key, 'gem:divan_helmet:JADE:FLAWLESS:1');
  assert.deepEqual(ok.legacy['Old|Perfect'], ['gem:x:JADE:PERFECT:1', 'gem:x:JADE:FLAWLESS:1']);
  const dup = structuredClone(B);
  dup.sections[0].steps[1].key = dup.sections[0].steps[0].key;
  assert.equal(validGuide(dup), null);
  const bad = structuredClone(B);
  bad.sections[0].steps[0].key = 'no key';
  assert.equal(validGuide(bad), null);
});

test('an old Perfect tick means Perfect and Flawless, an old untick only Perfect', () => {
  const out = collapseChecks([B], { b: ['Old|Perfect'] }, []);
  assert.deepEqual(new Set(out.keys), new Set(['gem:x:JADE:PERFECT:1', 'gem:x:JADE:FLAWLESS:1']));
  const un = collapseChecks([B], { b: ['undone:Old|Perfect'] }, []);
  assert.deepEqual(un.keys, ['undone:gem:x:JADE:PERFECT:1']);
});

test('schema 4: an owned item that carried stones gets their keys ticked, once, and an untick stays', () => {
  const guide = { id: 'a', title: 'A', ownedKeys: { HELM: ['gem:helm:TOPAZ:FLAWLESS:1', 'gem:helm:TOPAZ:PERFECT:1'] }, sections: [{ name: 'S', steps: [{ text: 'Helm', key: 'item:HELM' }] }] };
  const data = new Map(Object.entries({ 'pg.schema': 3, 'pg.owned': ['HELM'], 'pg.keys': ['undone:gem:helm:TOPAZ:PERFECT:1'] }));
  const io = { read: (k, d) => (data.has(k) ? structuredClone(data.get(k)) : d), write: (k, v) => { data.set(k, structuredClone(v)); return true; }, drop: () => {} };
  assert.equal(runMigration(io, [guide]), true);
  assert.deepEqual(new Set(data.get('pg.keys')), new Set(['gem:helm:TOPAZ:FLAWLESS:1', 'undone:gem:helm:TOPAZ:PERFECT:1']));
  assert.deepEqual(data.get('pg.owned'), ['HELM']);
  const without = new Map(Object.entries({ 'pg.schema': 3, 'pg.owned': [] }));
  const io2 = { ...io, read: (k, d) => (without.has(k) ? structuredClone(without.get(k)) : d), write: (k, v) => { without.set(k, v); return true; } };
  runMigration(io2, [guide]);
  assert.deepEqual(without.get('pg.keys'), []);
  assert.equal(validGuide(guide).ownedKeys.HELM.length, 2);
});

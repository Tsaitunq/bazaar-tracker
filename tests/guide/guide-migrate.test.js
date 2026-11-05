import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runMigration, migrateTicks } from '../../apps/guide/migrate.js';
import { doneSet, stepKey } from '../../apps/guide/progress.js';
import { ownedAuto } from '../../apps/guide/owned.js';

const guide = {
  id: 'g', title: 'G', area: 'mining',
  sections: [{ name: 'Gear', steps: [
    { text: 'Drill', detect: { kind: 'owned', on: [['DRILL_1']], slot: 'tool' } },
    { text: 'Other', detect: { kind: 'owned', on: [['OTHER_1']] } },
    { text: 'By hand' },
  ] }],
};
const summary = { items: [{ id: 'DRILL_1', where: 'inventory' }] };

function io({ store = {} } = {}) {
  const data = new Map(Object.entries(store));
  return {
    data,
    read: (k, d) => (data.has(k) ? structuredClone(data.get(k)) : d),
    write: (k, v) => { data.set(k, structuredClone(v)); return true; },
    drop: (k) => data.delete(k),
  };
}

test('what the sync found becomes manual ticks, the rest stays open', () => {
  const { owned, checks } = migrateTicks({ guides: [guide], checks: {}, owned: [], summary });
  assert.deepEqual(owned, ['DRILL_1']);
  const done = doneSet(guide, new Set(checks.g), ownedAuto(guide, new Set(owned), stepKey));
  assert.ok(done.has('Gear|Drill') && !done.has('Gear|Other'));
});

test('a step the player unticked by hand stays open', () => {
  const { owned } = migrateTicks({ guides: [guide], checks: { g: ['undone:Gear|Drill'] }, owned: [], summary });
  assert.deepEqual(owned, []);
});

test('migration: ticks stored, profile and flags deleted, flag set last', async () => {
  const o = io({ store: { 'pg.profile': { uuid: 'x', summary }, 'pg.ownedV1': true, 'pg.settings': { personal: true, tax: 1 } } });
  assert.equal(runMigration(o, [guide]), true);
  assert.deepEqual(o.data.get('pg.owned'), ['DRILL_1']);
  assert.equal(o.data.has('pg.profile'), false);
  assert.equal(o.data.has('pg.ownedV1'), false);
  assert.deepEqual(o.data.get('pg.settings'), { tax: 1 });
  assert.equal(o.data.get('pg.schema'), 5);
});

test('second run changes nothing', async () => {
  const o = io({ store: { 'pg.profile': { summary } } });
  runMigration(o, [guide]);
  const before = JSON.stringify([...o.data]);
  assert.equal(runMigration(o, [guide]), false);
  assert.equal(JSON.stringify([...o.data]), before);
});

test('no guides loaded yet: waits', async () => {
  const o = io({ store: { 'pg.profile': { summary } } });
  assert.equal(runMigration(o, []), false);
  assert.equal(o.data.size, 1);
});

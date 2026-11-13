import test from 'node:test';
import assert from 'node:assert/strict';
import { fixtureOf, merge } from '../../scripts/guide/audit-to-fixture.mjs';
import { exportText } from '../../apps/guide/audit.js';

const text = exportText([
  { area: 'mining', stat: 'MINING_FORTUNE', name: 'Mining Fortune', category: 'Skills', app: 156, game: 150 },
  { area: 'blaze', stat: 'HEALTH', name: 'Health', category: 'Accessory Bag', app: 32.2, game: 32 },
]);

test('an export becomes a fixture with open entries and the app value of that moment', () => {
  const f = fixtureOf(text, '2026-11-13');
  assert.equal(f.date, '2026-11-13');
  assert.deepEqual(f.entries[0], { area: 'mining', stat: 'MINING_FORTUNE', category: 'Skills', game: 150, appThen: 156, open: true });
  assert.equal(f.entries.length, 2);
});

test('text without deviation lines gives no entries', () => {
  assert.deepEqual(fixtureOf('Stats audit: no deviations', 'x').entries, []);
});

test('merging keeps older entries and replaces the same stat and category', () => {
  const old = { date: 'a', entries: [{ area: 'mining', stat: 'MINING_FORTUNE', category: 'Skills', game: 1, open: false }, { area: 'mining', stat: 'DEFENSE', category: 'Armor', game: 5, open: false }] };
  const out = merge(old, fixtureOf(text, 'b'));
  assert.equal(out.entries.length, 3);
  assert.equal(out.entries.find((e) => e.stat === 'MINING_FORTUNE').game, 150);
  assert.equal(out.entries.find((e) => e.stat === 'DEFENSE').game, 5);
});

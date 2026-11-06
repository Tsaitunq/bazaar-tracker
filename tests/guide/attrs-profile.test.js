import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { attrCategory, ATTR_CATEGORIES } from '../../apps/guide/attrs-model.js';
import { profileLink } from '../../apps/guide/views/parts.js';

test('attribute categories are the ones of the game menu', () => {
  assert.deepEqual(ATTR_CATEGORIES, ['combat', 'fishing', 'farming', 'foraging', 'mining', 'taming', 'enchanting', 'hunting', 'global']);
  const data = { stats: { stats: [{ id: 'MINING_SPEED', category: 'mining' }] } };
  assert.equal(attrCategory(data, { key: 'x', effects: [{ stat: 'MINING_SPEED' }] }), 'mining');
  assert.equal(attrCategory(data, { key: 'x', effects: [{ stat: 'TAMING_WISDOM' }] }), 'taming');
  assert.equal(attrCategory(data, { key: 'lake_fishing', effects: [] }), 'fishing');
  assert.equal(attrCategory(data, { key: 'sack_size', effects: [] }), 'global');
});

test('the profile button carries a head canvas that the skin paints, hat layer included', () => {
  assert.match(profileLink(), /<canvas data-head/);
  const skin = readFileSync(new URL('../../apps/guide/skin.js', import.meta.url), 'utf8');
  assert.match(skin, /for \(const sx of \[8, 40\]\) g\.drawImage\(skin, sx, 8, 8, 8/);
  assert.match(readFileSync(new URL('../../apps/guide/guide.css', import.meta.url), 'utf8'), /\.profile canvas \{[^}]*image-rendering: pixelated/);
});

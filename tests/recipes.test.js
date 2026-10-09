import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseRecipe, toBazaarId, buildRecipes, recipesStale, loadNeuItems } from '../scripts/recipes.mjs';

const block = {
  internalname: 'ENCHANTED_DIAMOND_BLOCK',
  recipe: { A1: '', A2: 'ENCHANTED_DIAMOND:32', A3: '', B1: 'ENCHANTED_DIAMOND:32', B2: 'ENCHANTED_DIAMOND:32', B3: 'ENCHANTED_DIAMOND:32', C1: '', C2: 'ENCHANTED_DIAMOND:32', C3: '' },
};

test('parseRecipe sums equal ingredients', () => {
  assert.deepEqual(parseRecipe(block), { out: 'ENCHANTED_DIAMOND_BLOCK', n: 1, i: { ENCHANTED_DIAMOND: 160 } });
});

test('parseRecipe reads recipes[] with count and override', () => {
  const item = { internalname: 'A', recipes: [{ type: 'forge' }, { type: 'crafting', count: 2, overrideOutputId: 'X', A1: 'B:3' }] };
  assert.deepEqual(parseRecipe(item), { out: 'X', n: 2, i: { B: 3 } });
});

test('parseRecipe returns null without crafting recipe', () => {
  assert.equal(parseRecipe({ internalname: 'A' }), null);
  assert.equal(parseRecipe({ internalname: 'A', recipes: [{ type: 'forge', A1: 'B:1' }] }), null);
  assert.equal(parseRecipe({ internalname: 'A', recipe: { A1: '' } }), null);
});

test('parseRecipe handles variant ids and missing quantity', () => {
  const r = parseRecipe({ internalname: 'A', recipe: { A1: 'INK_SACK-4:16', A2: 'STICK' } });
  assert.deepEqual(r.i, { 'INK_SACK-4': 16, STICK: 1 });
});

test('toBazaarId', () => {
  assert.equal(toBazaarId('INK_SACK-4', new Set(['INK_SACK:4'])), 'INK_SACK:4');
  assert.equal(toBazaarId('A', new Set(['A'])), 'A');
  assert.equal(toBazaarId('Z', new Set(['A'])), null);
});

test('buildRecipes filters and normalises', () => {
  const ids = new Set(['OUT', 'ING', 'INK_SACK:4', 'SELF']);
  const mk = (internalname, recipe) => ({ internalname, recipe });
  const r = buildRecipes([
    mk('OUT', { A1: 'INK_SACK-4:2', A2: 'ING:3' }),
    mk('NOT_BZ', { A1: 'ING:1' }),
    mk('OUT2', { A1: 'ING:1' }),
    mk('SELF', { A1: 'SELF:1', A2: 'ING:1' }),
    mk('ING', { A1: 'UNKNOWN:1' }),
  ], ids);
  assert.deepEqual(r, { OUT: { n: 1, i: { 'INK_SACK:4': 2, ING: 3 } } });
});

test('loadNeuItems skips unparsable files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'neu-'));
  try {
    fs.mkdirSync(path.join(dir, 'items'));
    fs.writeFileSync(path.join(dir, 'items', 'a.json'), '{"internalname":"A"}');
    fs.writeFileSync(path.join(dir, 'items', 'b.json'), '{oops');
    assert.deepEqual(loadNeuItems(dir), [{ internalname: 'A' }]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('recipesStale', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rec-'));
  try {
    const f = path.join(dir, 'recipes.json');
    const now = 1e12;
    assert.equal(recipesStale(f, now), true);
    fs.writeFileSync(f, JSON.stringify({ t: now - 25 * 3600e3 }));
    assert.equal(recipesStale(f, now), true);
    fs.writeFileSync(f, JSON.stringify({ t: now - 3600e3 }));
    assert.equal(recipesStale(f, now), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

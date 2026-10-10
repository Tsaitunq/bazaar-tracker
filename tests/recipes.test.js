import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseForge, buildForge, parseRecipe, toBazaarId, buildRecipes, recipesStale, loadNeuItems } from '../scripts/recipes.mjs';

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

const forgeItem = (internalname, inputs, extra = {}) => ({
  internalname, crafttext: 'Requires: Mithril X & HotM 4',
  recipes: [{ type: 'forge', inputs, count: 1, overrideOutputId: internalname, duration: 21600 }], ...extra,
});

test('parseForge reads inputs, coins, duration and the HotM tier', () => {
  assert.deepEqual(parseForge(forgeItem('DRILL', ['PLATE:1', 'GEM:12.0', 'GEM:3', 'SKYBLOCK_COIN:50000'])),
    { out: 'DRILL', n: 1, d: 21600, h: 4, c: 50000, i: { PLATE: 1, GEM: 15 } });
  assert.equal(parseForge(forgeItem('A', ['B:1'], { crafttext: '' })).h, 0);
  assert.equal(parseForge(forgeItem('A', ['B:1'], { crafttext: 'Requires: HotM 10' })).h, 10);
  assert.equal(parseForge({ internalname: 'A', recipes: [{ type: 'crafting', A1: 'B:1' }] }), null);
  assert.equal(parseForge({ internalname: 'A', recipes: [{ type: 'forge', inputs: ['B:1'] }] }), null);
  assert.equal(parseForge(forgeItem('A', ['SKYBLOCK_COIN:5'])), null);
});

test('buildForge keeps bazaar ingredients only and any result that is not a pet', () => {
  const ids = new Set(['PLATE', 'GEM', 'INK_SACK:4', 'REFINED']);
  const r = buildForge([
    forgeItem('DRILL', ['PLATE:1', 'INK_SACK-4:2', 'SKYBLOCK_COIN:100']),
    forgeItem('REFINED', ['GEM:160']),
    forgeItem('BIG_DRILL', ['DRILL:1', 'GEM:1']),
    forgeItem('AMMONITE;4', ['GEM:1']),
    forgeItem('GEM', ['GEM:2', 'PLATE:1']),
  ], ids);
  assert.deepEqual(r, {
    DRILL: { n: 1, d: 21600, h: 4, c: 100, i: { PLATE: 1, 'INK_SACK:4': 2 } },
    REFINED: { n: 1, d: 21600, h: 4, i: { GEM: 160 } },
  });
});

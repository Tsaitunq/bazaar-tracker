import test from 'node:test';
import assert from 'node:assert/strict';
import { validGuide, loadBundled, mergeGuides, exportData, importData } from '../progress.js';

const guide = { title: 'Test guide', source: 'https://example.com/x', sections: [
  { name: 'First', goal: 'Goal', steps: [
    { text: 'One', items: [{ id: 'A', qty: 2 }, { id: 'B', qty: 1, ah: true }], hint: 'Note' },
    { text: 'Two' },
  ] },
  { name: 'Only a goal', goal: 'Reach it', steps: [] },
] };

test('validGuide keeps known fields and rejects a bad shape', () => {
  assert.deepEqual(validGuide({ ...guide, extra: 1 }), guide);
  assert.equal(validGuide({ title: 'x' }), null);
  assert.equal(validGuide({ ...guide, sections: [{ name: 'S', steps: [{ text: '' }] }] }), null);
  assert.equal(validGuide({ ...guide, sections: [{ name: 'S', steps: [{ text: 'a', items: [{ id: 'A', qty: 0 }] }] }] }), null);
});

test('validGuide drops a link that is not http(s)', () => {
  assert.equal(validGuide({ ...guide, source: 'javascript:alert(1)' }).source, undefined);
});

test('loadBundled reads the index; no index means no guides', async () => {
  const files = { 'personal/guides/index.json': ['a.json', 'bad.json'], 'personal/guides/a.json': guide, 'personal/guides/bad.json': {} };
  const get = async (url) => ({ json: async () => files[url] });
  assert.deepEqual(await loadBundled(get), [{ id: 'a', ...guide }]);
  assert.deepEqual(await loadBundled(async () => { throw new Error('404'); }), []);
  assert.deepEqual(await loadBundled(async () => ({ json: async () => { throw new SyntaxError('html'); } })), []);
});

test('an imported guide replaces the shipped one with its id', () => {
  const merged = mergeGuides([{ id: 'a', title: 'old' }, { id: 'b', title: 'b' }], [{ id: 'a', title: 'new' }]);
  assert.deepEqual(merged.map((g) => g.title), ['b', 'new']);
});

test('export and import round trip, also for a plain guide file', () => {
  const back = importData(exportData([{ id: 'a', ...guide }], { a: ['First|One'] }));
  assert.deepEqual(back, { guides: [{ id: 'a', ...guide }], progress: { a: ['First|One'] } });
  assert.equal(importData(JSON.stringify(guide)).guides[0].id, 'test-guide');
});

test('import refuses what is not a guide', () => {
  assert.throws(() => importData('{nope'), /not valid JSON/);
  assert.throws(() => importData('{"a":1}'), /wrong format/);
  assert.throws(() => importData('{"type":"bt-progress","guides":[]}'), /No guides/);
});

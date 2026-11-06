import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMethod, pickedOption, loadMethods } from '../../apps/guide/methods.js';

const MD = readFileSync(new URL('../fixtures/guide/method-sample.md', import.meta.url), 'utf8');

test('a method file becomes options, steps, loadouts, auto-pet, gear and tips', () => {
  const m = parseMethod('sample', MD);
  assert.equal(m.title, 'Sample Mining');
  assert.deepEqual(m.price, { name: 'Fine Peridot', id: 'FINE_PERIDOT_GEM' });
  assert.deepEqual(m.options.map((o) => [o.when, o.pick, o.below, o.above]), [['under 45k', 'Cheap route', 45000, undefined], ['over 45k', 'Rich route (BP 7)', undefined, 45000], ['only want rewards', 'Reward route', undefined, undefined]]);
  assert.equal(m.run.length, 5);
  assert.deepEqual(m.run[2], { title: 'Worth it?', text: 'check the resource (`!check`). No → leave', back: 2 });
  assert.deepEqual(m.run[4], { title: 'Mine', text: 'until −100 Cold → leave', back: 2 });
  assert.equal(m.run[0].back, undefined);
  assert.deepEqual(m.loadouts.columns, ['Outside', 'Inside']);
  assert.equal(m.loadouts.rows[0].label, 'Pet');
  assert.equal(m.note, 'One drill is enough.');
  assert.deepEqual(m.autopet[0], { trigger: 'Enter combat', pet: 'Mammoth' });
  assert.deepEqual(m.gear[1], { name: 'Armor', text: '4/4 · perfect gems' });
  assert.deepEqual(m.tips, ["**Ping over 250 ms?** Other methods work better."]);
});

test('the price picks the option whose limit it meets; no price and the third option pick nothing', () => {
  const m = parseMethod('sample', MD);
  assert.equal(pickedOption(m, 30000), 0);
  assert.equal(pickedOption(m, 45000), 1);
  assert.equal(pickedOption(m, 90000), 1);
  assert.equal(pickedOption(m, null), -1);
});

test('loadMethods reads the index, skips a file without a title, and gives none on a 404', async () => {
  const files = { 'personal/methods/index.json': JSON.stringify(['method-sample.md', 'method-bad.md']), 'personal/methods/method-sample.md': MD, 'personal/methods/method-bad.md': 'no title' };
  const get = async (u) => (u in files ? { json: async () => JSON.parse(files[u]), text: async () => files[u] } : Promise.reject(new Error('404')));
  assert.deepEqual((await loadMethods(get)).map((m) => m.id), ['sample']);
  assert.deepEqual(await loadMethods(async () => { throw new Error('404'); }), []);
});

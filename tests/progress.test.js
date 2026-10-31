import test from 'node:test';
import assert from 'node:assert/strict';
import { validGuide, loadBundled, mergeGuides, exportData, importData, stepKey, stepCost, guideStats, progressView } from '../progress.js';

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

const products = { A: { buy_summary: [{ pricePerUnit: 100 }] }, E: { buy_summary: [] } };
const priced = { id: 'p', title: 'Priced', sections: [
  { name: 'S1', steps: [
    { text: 'Buy', items: [{ id: 'A', qty: 3 }] },
    { text: 'Auction', items: [{ id: 'B', qty: 1, ah: true }, { id: 'A', qty: 1 }] },
    { text: 'Empty book', items: [{ id: 'E', qty: 2 }] },
  ] },
  { name: 'S2', goal: 'Only a goal', steps: [] },
] };

test('stepCost multiplies the insta-buy price and flags what it cannot price', () => {
  assert.deepEqual(stepCost(priced.sections[0].steps[0], products), { coins: 300, ah: false, unpriced: false });
  assert.deepEqual(stepCost(priced.sections[0].steps[1], products), { coins: 100, ah: true, unpriced: false });
  assert.deepEqual(stepCost(priced.sections[0].steps[2], products), { coins: 0, ah: false, unpriced: true });
});

test('guideStats counts only open steps towards what is left', () => {
  const done = new Set([stepKey(priced.sections[0], priced.sections[0].steps[0])]);
  const stats = guideStats(priced, done, products);
  assert.equal(stats.done, 1);
  assert.equal(stats.total, 3);
  assert.equal(stats.next.step.text, 'Auction');
  assert.deepEqual({ coins: stats.sections[0].coins, ah: stats.sections[0].ah, unpriced: stats.sections[0].unpriced }, { coins: 100, ah: true, unpriced: true });
  assert.equal(guideStats(priced, new Set(['S1|Buy', 'S1|Auction', 'S1|Empty book']), products).next, null);
});

test('progressView shows count, next step, prices and the AH note, and escapes guide text', () => {
  const html = progressView({ guides: [priced], current: 'p', checked: new Set(), products, name: (id) => id });
  assert.match(html, /0 \/ 3/);
  assert.match(html, /Next step/);
  assert.match(html, /A × 3 · <strong>300<\/strong>/);
  assert.match(html, /B × 1 · AH – not priced/);
  assert.match(html, /Left 400 \+ AH items \+ no offer/);
  assert.match(html, /Only a goal/);
  const evil = { ...priced, sections: [{ name: 'S', steps: [{ text: '<img src=x>' }] }] };
  assert.doesNotMatch(progressView({ guides: [evil], current: 'p', checked: new Set(), products, name: String }), /<img/);
});

test('progressView asks before a reset and unfolds the first open section by default', () => {
  const html = progressView({ guides: [priced], current: 'p', checked: new Set(), products, name: String });
  assert.match(html, /data-section="S1" open/);
  assert.match(html, /data-guide-act="reset"/);
  assert.match(progressView({ guides: [priced], current: 'p', checked: new Set(), products, name: String, armed: true }), /data-guide-act="reset-yes"/);
});

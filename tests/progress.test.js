import test from 'node:test';
import assert from 'node:assert/strict';
import { validGuide, loadBundled, mergeGuides, exportData, importData, stepKey, stepCost, priceItem, guideStats, progressView, personalVisibility, secretTap } from '../progress.js';

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
  assert.equal(validGuide({ ...guide, sections: [{ name: 'S', steps: [{ text: 'a', items: [{ id: 'A', forge: { d: 0, i: {} } }] }] }] }), null);
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

const products = {
  A: { buy_summary: [{ amount: 2, pricePerUnit: 100 }, { amount: 10, pricePerUnit: 150 }] },
  E: { buy_summary: [] },
  ING: { buy_summary: [{ amount: 100, pricePerUnit: 10 }] },
};
const priced = { id: 'p', title: 'Priced', sections: [
  { name: 'S1', steps: [
    { text: 'Buy', items: [{ id: 'A', qty: 3 }] },
    { text: 'Auction', items: [{ id: 'B', qty: 1, ah: true }, { id: 'A', qty: 1 }] },
    { text: 'Empty book', items: [{ id: 'E', qty: 2 }] },
    { text: 'Soulbound', items: [{ name: 'Badge', qty: 1, nt: true }] },
  ] },
  { name: 'S2', goal: 'Only a goal', steps: [] },
] };

test('stepCost walks the book, takes auction prices and counts what has no price', () => {
  const ctx = { products, ah: { B: 500 } };
  assert.deepEqual(stepCost(priced.sections[0].steps[0], ctx), { coins: 350, unpriced: 0 });
  assert.deepEqual(stepCost(priced.sections[0].steps[1], ctx), { coins: 600, unpriced: 0 });
  assert.deepEqual(stepCost(priced.sections[0].steps[2], ctx), { coins: 0, unpriced: 1 });
  assert.deepEqual(stepCost(priced.sections[0].steps[3], ctx), { coins: 0, unpriced: 0 });
});

test('a forge item shows the cheaper way next to the other, with the chain time', () => {
  const forge = { SUB: { n: 1, d: 3600, i: { ING: 2 } }, TOP: { n: 1, d: 7200, c: 5, i: { SUB: 1, ING: 1 } } };
  const p = priceItem({ id: 'TOP', qty: 1 }, { products, forge, ah: { TOP: 100, SUB: 999 } });
  assert.equal(p.source, 'forge');
  assert.equal(p.coins, 35);
  assert.equal(p.note, 'forge: 35 + 3h · AH: 100');
  assert.equal(priceItem({ id: 'TOP', qty: 1 }, { products, forge, ah: { TOP: 20 } }).source, 'ah');
});

test('an upgrade leaves out what the player owns and a guide recipe beats no recipe', () => {
  const item = { id: 'NEW', qty: 1, without: ['OLD'], forge: { d: 30, i: { OLD: 1, ING: 3 } } };
  assert.deepEqual(priceItem(item, { products }), { source: 'forge', coins: 30, nt: false, note: 'forge: 30 + 30s' });
});

test('a forge chain stops at a recipe loop and a missing ingredient', () => {
  const forge = { X: { n: 1, d: 1, i: { Y: 1 } }, Y: { n: 1, d: 1, i: { X: 1 } }, Z: { n: 1, d: 1, i: { NONE: 1 } } };
  assert.equal(priceItem({ id: 'X', qty: 1 }, { products, forge }).source, null);
  assert.equal(priceItem({ id: 'Z', qty: 1 }, { products, forge }).source, null);
});

test('not tradeable is its own state, and a forgeable one never looks at the auction house', () => {
  assert.deepEqual(priceItem({ name: 'Badge', qty: 1, nt: true }, { products }), { source: 'nt', coins: 0 });
  const relic = { id: 'R', qty: 1, nt: true, forge: { d: 60, i: { ING: 1 } } };
  const p = priceItem(relic, { products, ah: { R: 1 } });
  assert.deepEqual([p.source, p.coins, p.nt, p.note], ['forge', 10, true, 'forge: 10 + 1m']);
});

test('only what bazaar and ah.json lack is wanted from the service, never books or shards', () => {
  const wants = new Set();
  priceItem({ id: 'B', qty: 1 }, { products, ah: {}, cofl: {}, wants });
  priceItem({ id: 'A', qty: 1 }, { products, ah: {}, cofl: {}, wants });
  priceItem({ id: 'SHARD_X', qty: 1 }, { products, ah: {}, cofl: {}, wants });
  priceItem({ id: 'ENCHANTMENT_X_1', qty: 1 }, { products, ah: {}, cofl: {}, wants });
  priceItem({ id: 'C', qty: 1 }, { products, ah: { C: 5 }, cofl: {}, wants });
  priceItem({ id: 'D', qty: 1 }, { products, ah: {}, cofl: { D: 0 }, wants });
  assert.deepEqual([...wants], ['B']);
});

test('a book takes the cheaper of buying it and combining two of the level below, within the limit', () => {
  const book = (price) => ({ buy_summary: [{ amount: 9, pricePerUnit: price }] });
  const products = { E_3: book(10), E_4: book(50), E_5: book(70), F_5: book(5), F_6: book(90) };
  assert.deepEqual(priceItem({ id: 'E_4', qty: 1, combine: 5 }, { products }), { source: 'bazaar', coins: 20, nt: false, note: 'combine 2× III: 20 · book: 50' });
  // two of level 4 come cheapest from four of level 3
  assert.equal(priceItem({ id: 'E_5', qty: 1, combine: 5 }, { products }).coins, 40);
  assert.equal(priceItem({ id: 'E_5', qty: 1, combine: 5 }, { products }).note, 'combine 2× IV: 40 · book: 70');
  // above the limit only the book counts, however cheap the level below is
  assert.deepEqual(priceItem({ id: 'F_6', qty: 1, combine: 5 }, { products }), { source: 'bazaar', coins: 90, nt: false, note: 'book: 90' });
  assert.equal(priceItem({ id: 'G_6', qty: 1, combine: 5 }, { products }).source, null);
});

test('a table step has its mark and no price', () => {
  const g = { id: 't', title: 'T', sections: [{ name: 'S', steps: [{ text: 'Sharpness I-V', table: true }] }] };
  assert.equal(validGuide(g).sections[0].steps[0].table, true);
  assert.match(progressView({ guides: [g], current: 't', checked: new Set(), products: {}, name: String }), /data-src="table">table/);
});

test('guideStats counts only open steps towards what is left', () => {
  const done = new Set([stepKey(priced.sections[0], priced.sections[0].steps[0])]);
  const stats = guideStats(priced, done, { products, ah: { B: 500 } });
  assert.equal(stats.done, 1);
  assert.equal(stats.total, 4);
  assert.equal(stats.next.step.text, 'Auction');
  assert.deepEqual({ coins: stats.sections[0].coins, unpriced: stats.sections[0].unpriced }, { coins: 600, unpriced: 1 });
  assert.equal(guideStats(priced, new Set(['S1|Buy', 'S1|Auction', 'S1|Empty book', 'S1|Soulbound']), { products }).next, null);
});

test('progressView shows badges, the unpriced count and the credit, and escapes guide text', () => {
  const view = (cofl) => progressView({ guides: [priced], current: 'p', checked: new Set(), products, prices: { cofl }, name: (id) => id });
  const html = view({ B: 500 });
  assert.match(html, /0 \/ 4/);
  assert.match(html, /Next step/);
  assert.match(html, /A × 3 · <strong>350<\/strong> <span class="guide-src" data-src="bazaar">Bazaar/);
  assert.match(html, /data-src="ah">AH/);
  assert.match(html, /data-src="nt">not tradeable/);
  assert.match(html, /Left 950 \+ 1 unpriced/);
  assert.match(html, /Prices: <a [^>]*>SkyCofl/);
  assert.doesNotMatch(view({}), /SkyCofl/);
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

test('without a guide only the hidden unlock shows the import, and never the switch', () => {
  assert.deepEqual(personalVisibility(0, false), { section: false, toggle: false });
  assert.deepEqual(personalVisibility(0, true), { section: true, toggle: false });
  assert.deepEqual(personalVisibility(2, false), { section: true, toggle: true });
});

test('secretTap opens on the fifth quick tap only', () => {
  let taps = [];
  for (let i = 0; i < 4; i++) {
    const r = secretTap(taps, 1000 + i * 500);
    assert.equal(r.open, false);
    taps = r.taps;
  }
  assert.equal(secretTap(taps, 3000).open, true);
  assert.deepEqual(secretTap(taps, 3000).taps, []);
  // a pause starts the count again
  assert.deepEqual(secretTap(taps, 9000), { taps: [9000], open: false });
});

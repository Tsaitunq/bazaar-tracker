import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validGuide, loadBundled, mergeGuides, exportData, importData, stepKey, stepCost, priceItem, guideStats, nextUpgrades, doneSet, setMark, pushRecent, progressView, personalVisibility, secretTap } from '../progress.js';

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
  assert.match(html, /3× A · <strong>350<\/strong> <span class="guide-src" data-src="bazaar">Bazaar/);
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

const pieces = (extra) => ({ name: 'Piece', qty: 2, anyOf: ['H', 'C', 'L'], ...extra });
const binCtx = { products: {}, ah: { H: 30, C: 10, L: 20 } };

test('an open choice takes the cheapest pieces and a later step the next one', () => {
  assert.deepEqual(priceItem(pieces(), binCtx), { source: 'ah', coins: 30, picked: ['C', 'L'] });
  assert.deepEqual(priceItem(pieces({ qty: 1, skip: 2 }), binCtx), { source: 'ah', coins: 30, picked: ['H'] });
  assert.equal(priceItem(pieces({ qty: 2, skip: 2 }), binCtx).source, null);
});

test('an open choice asks for every piece and shows the quantity and what it picked', () => {
  const wants = new Set();
  priceItem(pieces(), { products: {}, wants });
  assert.deepEqual([...wants], ['H', 'C', 'L']);
  const g = { id: 'q', title: 'Q', sections: [{ name: 'S', steps: [{ text: 'Set', items: [pieces()] }, { text: 'Stones', items: [{ id: 'A', qty: 3 }] }] }] };
  const html = progressView({ guides: [g], current: 'q', checked: new Set(), products: { A: { buy_summary: [{ amount: 9, pricePerUnit: 5 }] } }, prices: { ah: binCtx.ah }, name: (id) => `N${id}` });
  assert.match(html, /2× Piece/);
  assert.match(html, /NC, NL/);
  assert.match(html, /3× NA/);
});

test('quantities multiply a set: pieces add up and a stack walks the book', () => {
  const step = { text: 'x', items: [{ id: 'A', qty: 4 }, pieces()] };
  const book = { A: { buy_summary: [{ amount: 2, pricePerUnit: 100 }, { amount: 10, pricePerUnit: 150 }] } };
  assert.deepEqual(stepCost(step, { ...binCtx, products: book }), { coins: 530, unpriced: 0 });
});

test('validGuide keeps an open choice only with a name', () => {
  const one = (i) => validGuide({ title: 't', sections: [{ name: 'S', steps: [{ text: 'a', items: [i] }] }] });
  assert.deepEqual(one(pieces({ skip: 1 })).sections[0].steps[0].items[0], pieces({ skip: 1 }));
  assert.equal(one({ qty: 1, anyOf: ['H'] }), null);
});

const lines = { id: 'n', title: 'N', sections: [
  { name: 'Gear', steps: [
    { text: 'Big', line: 'L', items: [{ id: 'X', qty: 3 }] },
    { text: 'Bigger', line: 'L', items: [{ id: 'X', qty: 1 }] },
    { text: 'Solo', items: [{ id: 'X', qty: 2 }] },
    { text: 'Table', table: true },
    { text: 'Missing', items: [{ id: 'X', qty: 1 }, { id: 'NOPE', qty: 1 }] },
  ] },
  { name: 'Must', steps: [{ text: 'Pinned', priority: 1, items: [{ id: 'X', qty: 9 }] }, { text: 'Top', priority: 2 }] },
] };
const flat = { products: { X: { buy_summary: [{ amount: 99, pricePerUnit: 10 }] } } };
const order = (checked) => nextUpgrades(lines, new Set(checked), flat).map((r) => r.step.text);

test('next upgrades: one step per line, pinned first, then by price, without a price last', () => {
  assert.deepEqual(order([]), ['Top', 'Pinned', 'Solo', 'Big', 'Table', 'Missing']);
});

test('next upgrades: checking a step moves its line up and sorts again', () => {
  assert.deepEqual(order(['Gear|Big']), ['Top', 'Pinned', 'Bigger', 'Solo', 'Table', 'Missing']);
  assert.deepEqual(order(['Gear|Big', 'Gear|Bigger', 'Must|Top', 'Must|Pinned', 'Gear|Solo', 'Gear|Table', 'Gear|Missing']), []);
});

test('next upgrades view totals the first five and notes what has no price', () => {
  const html = progressView({ guides: [lines], current: 'n', checked: new Set(), products: flat.products, name: (id) => id, mode: 'next' });
  assert.match(html, /Next 5 upgrades cost 150 \+ 1 unpriced</);
  assert.doesNotMatch(html, /No coins: enchanting table/);
  assert.match(progressView({ guides: [lines], current: 'n', checked: new Set(['undone:Gear|Table']), products: flat.products, name: (id) => id, mode: 'next' }), /No coins: enchanting table/);
  assert.match(html, /aria-pressed="true">Next upgrades/);
  assert.doesNotMatch(html, /<details/);
  assert.match(progressView({ guides: [lines], current: 'n', checked: new Set(), products: flat.products, name: (id) => id }), /<details/);
});

test('validGuide keeps line and a positive priority', () => {
  const step = (s) => validGuide({ title: 't', sections: [{ name: 'S', steps: [s] }] }).sections[0].steps[0];
  assert.deepEqual(step({ text: 'a', line: 'L', priority: 2 }), { text: 'a', line: 'L', priority: 2 });
  assert.deepEqual(step({ text: 'a', line: 3, priority: 0 }), { text: 'a' });
});

const ladder = { id: 'l', title: 'L', sections: [
  { name: 'Books', steps: [
    { text: 'Table', table: true, line: 'E' },
    { text: 'III', line: 'E', items: [{ id: 'B_3', qty: 4, combine: 5 }] },
    { text: 'IV', line: 'E', items: [{ id: 'B_4', qty: 4, combine: 5 }] },
    { text: 'V', line: 'E', items: [{ id: 'B_5', qty: 4, combine: 5 }] },
  ] },
] };
const level = (coins) => ({ buy_summary: [{ amount: 99, pricePerUnit: coins }] });
const books = { products: { B_3: level(10), B_4: level(100), B_5: level(150) } };
const keys = (...t) => new Set(['Books|Table', ...t.map((x) => `Books|${x}`)]);

test('what is left of a line of books is the cheapest way to its last level, not every level', () => {
  // 4x V from nothing: 16 IIIs at 10 beat the IV books and the V books
  assert.equal(guideStats(ladder, keys(), { ...books }).sections[0].coins, 160);
  // with 4x IV in hand only 4 more IVs are missing, 2 IIIs each
  assert.equal(guideStats(ladder, keys('III', 'IV'), { ...books }).sections[0].coins, 80);
  // only the top book on sale: 4 of it
  assert.equal(guideStats(ladder, keys(), { products: { B_5: level(150) } }).sections[0].coins, 600);
  assert.equal(guideStats(ladder, keys('III', 'IV', 'V'), { ...books }).sections[0].coins, 0);
});

test('a missing last level counts once as unpriced, the levels before it not at all', () => {
  const s = guideStats(ladder, keys(), { products: { B_3: level(10) } }).sections[0];
  assert.equal(s.unpriced, 0);
  assert.equal(s.coins, 160);
  const end = guideStats(ladder, keys(), { products: {} }).sections[0];
  assert.deepEqual([end.coins, end.unpriced], [0, 1]);
});

test('next upgrades shows the cost of the one jump from the level reached', () => {
  const top = (done) => { const r = nextUpgrades(ladder, done, { ...books })[0]; return [r.step.text, r.coins]; };
  assert.deepEqual(top(keys()), ['III', 40]);
  // IV from III: 4 more IIIs at 10 beat the book at 100
  assert.deepEqual(top(keys('III')), ['IV', 40]);
  assert.deepEqual(top(keys('III', 'IV')), ['V', 80]);
});

test('a table step is done by default, can be unticked and ticked again', () => {
  const done = () => doneSet(ladder, marks).has('Books|Table');
  const marks = new Set();
  assert.equal(done(), true);
  setMark(ladder, marks, 'Books|Table', false);
  assert.deepEqual([...marks], ['undone:Books|Table']);
  assert.equal(done(), false);
  setMark(ladder, marks, 'Books|Table', true);
  assert.deepEqual([...marks], ['Books|Table']);
  assert.equal(done(), true);
  setMark(ladder, marks, 'Books|III', true);
  assert.deepEqual([...marks], ['Books|Table', 'Books|III']);
  setMark(ladder, marks, 'Books|III', false);
  assert.deepEqual([...marks], ['Books|Table']);
});

test('recently checked keeps the last ten, newest first, without doubles', () => {
  let recent = [];
  for (let i = 0; i < 12; i++) recent = pushRecent(recent, `k${i}`);
  assert.equal(recent.length, 10);
  assert.equal(recent[0], 'k11');
  assert.deepEqual(pushRecent(['a', 'b'], 'b'), ['b', 'a']);
});

test('the view shows the undo bar and the recent list only for steps it knows', () => {
  const view = (extra) => progressView({ guides: [ladder], current: 'l', checked: new Set(['Books|III']), products: books.products, name: (id) => id, mode: 'next', ...extra });
  const html = view({ recent: ['Books|III', 'Gone|x'], undo: 'Books|III' });
  assert.match(html, /Checked: III/);
  assert.match(html, /Recently checked/);
  assert.equal(html.match(/data-guide-undo=/g).length, 2);
  assert.doesNotMatch(view(), /data-guide-undo|Recently checked/);
});

test('a sync refutes the default tick of a table step, but not one the player set', () => {
  const g = { title: 'T', sections: [{ name: 'S', steps: [{ text: 'Table', table: true }] }] };
  const key = 'S|Table';
  const refuted = new Map([[key, { have: 0, need: 1 }]]);
  const met = new Map([[key, { have: 1, need: 1 }]]);
  const marks = new Set();
  assert.equal(doneSet(g, marks).has(key), true);
  assert.equal(doneSet(g, marks, met).has(key), true);
  assert.equal(doneSet(g, marks, refuted).has(key), false);
  setMark(g, marks, key, true);
  assert.equal(doneSet(g, marks, refuted).has(key), true);
  setMark(g, marks, key, false);
  assert.equal(doneSet(g, marks, met).has(key), false);
});

test('sync: a mark wins, an untick stays open, and a sync never writes marks', () => {
  const g = { title: 'T', sections: [{ name: 'S', steps: [{ text: 'A' }] }] };
  const met = new Map([['S|A', { have: 1, need: 1 }]]);
  const not = new Map([['S|A', { have: 0, need: 1 }]]);
  const marks = new Set();
  assert.equal(doneSet(g, marks, met).has('S|A'), true);
  assert.deepEqual([...marks], []);
  assert.equal(doneSet(g, marks, not).has('S|A'), false);
  setMark(g, marks, 'S|A', false, met);
  assert.deepEqual([...marks], ['undone:S|A']);
  assert.equal(doneSet(g, marks, met).has('S|A'), false);
  setMark(g, marks, 'S|A', true, met);
  assert.equal(doneSet(g, marks, not).has('S|A'), true);
  setMark(g, marks, 'S|A', false, not);
  assert.deepEqual([...marks], []);
});

const synced = { title: 'S', groups: { armor: [['H'], ['C'], ['L'], ['B']] }, sections: [{ name: 'Gear', steps: [
  { text: 'Set', line: 'g', items: ['H', 'C', 'L', 'B'].map((id) => ({ id, qty: 1 })), detect: { kind: 'owned', on: 'armor' } },
  { text: 'Better', line: 'g', items: [{ id: 'X', qty: 1 }], detect: { kind: 'owned', on: [['X']] } },
  { text: 'Book', items: [{ id: 'ENCHANTMENT_A_6', qty: 4 }], detect: { kind: 'enchant', on: 'armor', enchant: 'a', level: 6, need: 4 } },
  { text: 'Sold', items: [{ id: 'S1', qty: 1 }], detect: { kind: 'owned', on: [['S1']] } },
] }] };
const own = (...ids) => ({ items: ids.map((id) => ({ id, enchants: {}, gems: [], parts: {} })), pets: [] });
const book = (price) => ({ buy_summary: [{ pricePerUnit: price, amount: 100 }] });
const synProducts = { H: book(10), C: book(20), L: book(40), B: book(80), X: book(5), ENCHANTMENT_A_6: book(1000), S1: book(1) };
const view = (profile, mode = 'slot', marks = new Set()) => progressView({ guides: [{ id: 's', ...synced }], current: 's', checked: marks, products: synProducts, name: (x) => x, mode, profile });

test('a partly owned step shows how far it is and prices only what is open', () => {
  const html = view(own('H', 'C'), 'next');
  assert.match(html, /2 \/ 4<\/span><span class="guide-src" data-src="api">API/);
  assert.ok(!/1× H /.test(html));
  assert.match(html, /1× L/);
  assert.match(html, /1× B/);
});

test('next upgrades and the total follow the sync', () => {
  assert.match(view(null, 'next'), /<h2>Next 3 upgrades cost/);
  const html = view(own('H', 'C', 'L', 'B', 'S1'), 'next');
  assert.ok(!html.includes('data-step="Gear|Set"'));
  assert.ok(html.includes('data-step="Gear|Better"'));
  assert.ok(html.includes('Checked by sync'));
  assert.ok(html.includes('data-guide-undo="Gear|Set"'));
});

test('an API check has a badge and undo, a tick of the player has neither', () => {
  const auto = view(own('S1'));
  assert.match(auto, /Sold<\/span><span class="guide-src" data-src="api">API<\/span><button type="button" class="guide-auto-undo" data-guide-undo="Gear\|Sold"/);
  const manual = view(own('S1'), 'slot', new Set(['Gear|Sold']));
  assert.ok(!manual.includes('data-guide-undo="Gear|Sold"'));
});

test('a sold item loses the API tick, a manual one stays', () => {
  assert.ok(!/data-step="Gear\|Sold" checked/.test(view(own('H'))));
  assert.match(view(own('H'), 'slot', new Set(['Gear|Sold'])), /data-step="Gear\|Sold" checked/);
});

test('validGuide keeps sound rules and groups and drops broken ones, the step stays', () => {
  const g = validGuide({ title: 'T', groups: { a: [['X']], bad: 'no' }, sections: [{ name: 'S', steps: [
    { text: 'ok', detect: { kind: 'owned', on: 'a', soft: 'x', need: 1 } },
    { text: 'bad kind', detect: { kind: 'constructor' } },
    { text: 'bad field', detect: { kind: 'reforge', on: 'a', value: 7 } },
    { text: 'bad part', detect: [{ kind: 'owned', on: 'a' }, { kind: 'held' }] },
  ] }] });
  assert.deepEqual(g.groups, { a: [['X']] });
  assert.deepEqual(g.sections[0].steps[0].detect, { kind: 'owned', on: 'a', need: 1 });
  for (const s of g.sections[0].steps.slice(1)) assert.equal(s.detect, undefined);
});

test('the export of a guide carries no profile', () => {
  const out = exportData([{ id: 's', ...synced }], { s: ['Gear|Set'] });
  assert.ok(!/summary|profile|uuid|API-Key|statsInput/i.test(out));
});

const slotGuide = { title: 'G', sections: [{ name: 'Armor', steps: [
  { text: 'Necron', line: 'a', detect: { kind: 'owned', on: [['N1'], ['N2'], ['N3'], ['N4']], slot: 'armor' } },
  { text: 'Frozen Blaze', line: 'a', detect: { kind: 'owned', on: [['F1'], ['F2'], ['F3'], ['F4']], slot: 'armor' } },
  { text: '3/4 Crimson', line: 'a', detect: { kind: 'owned', on: [['C1'], ['C2'], ['C3'], ['C4']], need: 3, slot: 'armor' } },
  { text: '4/4 Infernal', line: 'a', detect: { kind: 'owned', on: [['I1'], ['I2'], ['I3'], ['I4']], slot: 'armor' } },
  { text: 'Sharpness VI', line: 'e', detect: { kind: 'enchant', on: [['C1']], enchant: 'sharpness', level: 6 } },
] }, { name: 'Drill', steps: [
  { text: '555', line: 'd', detect: { kind: 'owned', on: [['DRILL_555']], slot: 'drill' } },
  { text: '655', line: 'd', detect: { kind: 'owned', on: [['DRILL_655']], slot: 'drill' } },
  { text: 'Divan', line: 'd', detect: { kind: 'owned', on: [['DIVAN']], slot: 'drill' } },
] }] };
const drawSlots = (...ids) => progressView({ guides: [{ id: 'g', ...slotGuide }], current: 'g', checked: new Set(), products: {}, name: (x) => x, mode: 'slot', profile: own(...ids) });
const rowOf = (html, key) => html.slice(html.indexOf(`data-step="${key}"`)).split('</li>')[0];

test('3/4 Crimson checks Frozen Blaze and Necron with the API badge, not the enchants', () => {
  const html = drawSlots('C1', 'C2', 'C3');
  for (const key of ['Armor|Necron', 'Armor|Frozen Blaze', 'Armor|3/4 Crimson']) {
    assert.match(rowOf(html, key), /" checked>/);
    assert.match(rowOf(html, key), /data-src="api"/);
    assert.match(rowOf(html, key), /data-guide-undo/);
  }
  assert.ok(!/" checked>/.test(rowOf(html, 'Armor|4/4 Infernal')));
  assert.ok(!/" checked>/.test(rowOf(html, 'Armor|Sharpness VI')));
});

test('part of a later step is enough for the earlier ones, and Divan checks the earlier drills', () => {
  assert.match(rowOf(drawSlots('F1'), 'Armor|Necron'), /" checked>/);
  assert.ok(!/" checked>/.test(rowOf(drawSlots('F1'), 'Armor|Frozen Blaze')));
  const html = drawSlots('DIVAN');
  for (const key of ['Drill|555', 'Drill|655', 'Drill|Divan']) assert.match(rowOf(html, key), /" checked>[\s\S]*data-src="api"/);
});

const lockGuide = { title: 'L', sections: [{ name: 'S', steps: [{ text: 'Drill', items: [{ id: 'D', qty: 1 }] }, { text: 'Free', items: [{ id: 'F', qty: 1 }] }, { text: 'Later', items: [{ id: 'U', qty: 1 }] }] }] };
const lockItems = { D: { requirements: [{ type: 'HEART_OF_THE_MOUNTAIN', tier: 7 }] }, U: { requirements: [{ type: 'GARDEN_LEVEL', level: 1 }] } };
const lockProfile = { items: [], pets: [], hotm: { experience: 97000 }, skills: {}, slayer: {}, kuudra: {}, collTiers: [] };
const lockView = (over = {}) => progressView({ guides: [{ id: 'l', ...lockGuide }], current: 'l', checked: new Set(), products: {}, name: (x) => x, prices: { items: lockItems }, profile: lockProfile, ...over });

test('a locked step shows a badge with its reason and stays checkable', () => {
  const row = rowOf(lockView(), 'S|Drill');
  assert.match(row, /data-src="locked"/);
  assert.match(row, /HOTM 7 needed, you have 5/);
  assert.ok(!/disabled/.test(row));
});

test('Next upgrades marks a locked step and leaves order and totals unchanged', () => {
  const texts = (html) => [...html.matchAll(/guide-text">([^<]+)/g)].map((m) => m[1]);
  const locked = lockView({ mode: 'next' });
  const plain = lockView({ mode: 'next', prices: {} });
  assert.deepEqual(texts(locked), texts(plain));
  assert.equal(locked.match(/<h2>[^<]+/)[0], plain.match(/<h2>[^<]+/)[0]);
  assert.match(rowOf(locked, 'S|Drill'), /data-src="locked"/);
});

test('an unknown or met step shows no lock, and neither does a done one', () => {
  assert.ok(!/data-src="locked"/.test(rowOf(lockView(), 'S|Later')));
  assert.ok(!/data-src="locked"/.test(rowOf(lockView(), 'S|Free')));
  assert.ok(!/data-src="locked"/.test(lockView({ prices: {} })));
  assert.ok(!/data-src="locked"/.test(lockView({ profile: null })));
  assert.ok(!/data-src="locked"/.test(rowOf(lockView({ checked: new Set(['S|Drill']) }), 'S|Drill')));
});

test('a reason with HTML is escaped', () => {
  const items = { D: { requirements: [{ type: 'COLLECTION', collection: '<b>x', tier: 1 }] } };
  const html = lockView({ prices: { items } });
  assert.ok(!html.includes('<b>'));
});

test('validGuide keeps area and numeric gain and drops anything else', () => {
  const g = validGuide({ title: 't', area: 'mining', sections: [{ name: 's', steps: [{ text: 'a', gain: { MINING_SPEED: 5, PRISTINE: 'x' } }, { text: 'b', gain: [1] }] }] });
  assert.equal(g.area, 'mining');
  assert.deepEqual(g.sections[0].steps[0].gain, { MINING_SPEED: 5 });
  assert.equal(g.sections[0].steps[1].gain, undefined);
  assert.equal(validGuide({ title: 't', area: 'nether', sections: [{ name: 's', steps: [] }] }).area, undefined);
});

test('progress.js does not pull the market views', () => {
  const src = readFileSync('progress.js', 'utf8');
  assert.doesNotMatch(src, /from '\.\/render\.js'/);
  assert.match(src, /from '\.\/format\.js'/);
});

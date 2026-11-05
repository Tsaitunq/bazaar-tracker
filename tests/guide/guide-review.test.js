// What the review of the whole branch found.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formEdited, guideModel, typedFields, restoreTyped, settled } from '../../guide/model.js';
import { stepCard } from '../../guide/views/parts.js';
import { guideView } from '../../guide/views/guide.js';
import { settingsView } from '../../guide/views/settings.js';
import { gamedata, baseOf, emptyBuild } from '../fixtures/guide-world.js';
import { miningSettings } from '../../optimizer.js';
import { coins } from '../../format.js';

const sold = (price) => ({ buy_summary: [{ pricePerUnit: price, amount: 100 }] });
const DRILL = 'TITANIUM_DRILL_4';
const items = { [DRILL]: { category: 'DRILL', tier: 'LEGENDARY', stats: {} }, A: { name: 'Nice Gem' } };
const guide = (steps) => ({ id: 'm', title: 'Mine', area: 'mining', groups: {}, sections: [{ name: 'Main', steps }] });
const step = (text, id = 'A') => ({ text, gain: { MINING_FORTUNE: 8 }, items: [{ id, qty: 2 }] });
const world = (over = {}) => ({ marks: new Set(), checks: {}, guides: [], owned: [DRILL], base: baseOf({ mining: { values: { MINING_SPEED: 1000, MINING_FORTUNE: 100 } } }), build: emptyBuild(), gamedata, products: { A: sold(1e6) }, prices: { items }, settings: miningSettings(null), name: (id) => items[id]?.name ?? id, now: 2, ...over });

test('the path never calls a step without a price free', () => {
  const sides = (w) => guideModel(guide([step('Z', 'Z')]), w).rows.map((r) => r.side);
  assert.deepEqual(sides(world()), ['no price']);
  assert.deepEqual(sides(world({ products: null })), ['…']);
});

test('a form with edits holds back a redraw, a clean one takes it', () => {
  const input = { tagName: 'INPUT', type: 'number', value: '1', defaultValue: '1' };
  assert.equal(formEdited([input], null), false);
  assert.equal(formEdited([input], input), true);
  assert.equal(formEdited([{ ...input, value: '2' }], null), true);
  assert.equal(formEdited([{ tagName: 'INPUT', type: 'checkbox', checked: true, defaultChecked: false }], null), true);
  assert.equal(formEdited([{ tagName: 'SELECT', options: [{ selected: true, defaultSelected: false }] }], null), true);
  assert.equal(formEdited([{ tagName: 'SELECT', options: [{ selected: true, defaultSelected: true }] }], null), false);
});

test('import from a file and from the text field are two buttons', () => {
  const html = settingsView({ guides: [], settings: miningSettings(null), now: 1 });
  assert.match(html, /data-act="import-file"/);
  assert.match(html, /data-act="import"/);
  const app = readFileSync(new URL('../../guide/app.js', import.meta.url), 'utf8');
  assert.match(app, /act === 'import-file'/);
});

test('an imported guide can be removed, a shipped one not', () => {
  const list = [{ id: 'mine', title: 'Mine' }, { id: 'own', title: 'Own' }];
  const html = settingsView({ guides: list, importedIds: ['own'], settings: miningSettings(null), now: 1 });
  assert.match(html, /data-remove-guide="own"/);
  assert.doesNotMatch(html, /data-remove-guide="mine"/);
});

test('the card says what to buy, with amount, price and source', () => {
  const { card } = guideModel(guide([step('a')]), world());
  assert.deepEqual(card.items.map((i) => i.text), ['2× Nice Gem · 2M · Bazaar']);
  assert.match(stepCard({ ...card, railTop: true, railBottom: false }), /card-item">2× Nice Gem · 2M · Bazaar</);
  assert.deepEqual(guideModel(guide([step('a')]), world({ products: null })).card.items.map((i) => i.text), ['2× Nice Gem · …']);
  assert.deepEqual(guideModel(guide([step('a', 'Z')]), world()).card.items.map((i) => i.text), ['2× Z · no price']);
});

test('prices from SkyCofl are credited', () => {
  const g = guide([{ text: 'a', gain: { MINING_FORTUNE: 8 }, items: [{ id: 'AUCTIONED', qty: 1 }] }]);
  const cofl = { AUCTIONED: 1e6 };
  const w = { ...world({ guides: [g], prices: { items, cofl } }) };
  assert.equal(guideModel(g, w).usedCofl, true);
  const html = guideView(w, 'm', 'path');
  // in the sheet behind the ⓘ, not as a bar under the path
  assert.match(html, /<dialog class="sheet">.*sky\.coflnet\.com.*<\/dialog>/s);
  assert.equal(html.split('</dialog>')[1], '</div>');
  assert.doesNotMatch(guideView(world({ guides: [g] }), 'm', 'path'), /coflnet/);
  assert.match(settingsView({ guides: [], settings: miningSettings(null) }), /sky\.coflnet\.com/);
});

test('the bazaar tax can be set', () => {
  const html = settingsView({ guides: [], settings: miningSettings(null), tax: 1, now: 1 });
  assert.match(html, /<select data-tax>/);
  assert.match(html, /<option value="1" selected>/);
});

test('the screen keeps clear of the system bars', () => {
  const css = readFileSync(new URL('../../guide/guide.css', import.meta.url), 'utf8');
  assert.match(css, /\.screen \{[^}]*safe-area-inset-top[^}]*safe-area-inset-bottom/);
  assert.match(css, /\.screen-home \{[^}]*safe-area-inset-top[^}]*safe-area-inset-bottom/);
});

test('the font licence comes along', () => {
  assert.match(readFileSync(new URL('../../guide/sw.js', import.meta.url), 'utf8'), /'fonts\/LICENSE'/);
});

test('the card shows the net cost beside the net rate', () => {
  const g = guide([{ text: 'new', detect: { kind: 'owned', on: [['NEW']] }, items: [{ id: 'NEW', qty: 1 }] }]);
  g.groups = { armor: [['NEW', 'OLD']] };
  const data = { ...items, NEW: { category: 'HELMET', tier: 'LEGENDARY', stats: { MINING_FORTUNE: 20 } }, OLD: { category: 'HELMET', tier: 'COMMON', stats: {} } };
  const products = { NEW: sold(20e6), OLD: { sell_summary: [{ pricePerUnit: 8e6, amount: 100 }], buy_summary: [] } };
  const { card, leader: row } = guideModel(g, world({ owned: [DRILL, 'OLD'], products, prices: { items: data } }));
  assert.ok(row.resale > 0 && row.net < row.coins);
  assert.ok(card.cost.startsWith('Net '));
  assert.ok(card.cost.includes(coins(row.net)));
  const plain = guideModel(guide([step('a')]), world()).card;
  assert.doesNotMatch(plain.cost, /Net/);
});

const field = (dataset, value, saved = value) => ({ tagName: 'INPUT', type: 'text', dataset, value, defaultValue: saved });

test('a redraw keeps what is typed and only that', () => {
  const typed = typedFields([field({ set: 'uuid' }, 'typed', ''), field({ mining: 'wF' }, '5')]);
  assert.deepEqual([...typed.values()], ['typed']);
  const after = [field({ set: 'uuid' }, ''), field({ mining: 'wF' }, '7')];
  restoreTyped(after, typed);
  assert.deepEqual(after.map((f) => f.value), ['typed', '7']);
});

test('an unsaved tick and a picker survive too, a settled field does not', () => {
  const box = { tagName: 'INPUT', type: 'checkbox', dataset: { flag: 'x' }, checked: true, defaultChecked: false };
  const pick = { tagName: 'SELECT', dataset: { s: 'a' }, value: '2', options: [{ selected: false, defaultSelected: true }, { selected: true, defaultSelected: false }] };
  const typed = typedFields([box, pick]);
  assert.deepEqual([...typed.values()], [true, '2']);
  settled(box);
  settled(pick);
  assert.equal(typedFields([box, pick]).size, 0);
  const done = field({ json: '' }, 'text', '');
  settled(done);
  assert.equal(typedFields([done]).size, 0);
});

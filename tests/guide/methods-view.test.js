import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMethod } from '../../apps/guide/methods.js';
import { guideView } from '../../apps/guide/views/guide.js';
import { parseRoute, swipeTarget } from '../../apps/guide/model.js';

const method = parseMethod('sample', readFileSync(new URL('../fixtures/guide/method-sample.md', import.meta.url), 'utf8'));
const guide = { id: 'shaft', title: 'Shafting', area: 'mining', sections: [] };
const book = (price) => ({ buy_summary: [{ pricePerUnit: price, amount: 9 }], sell_summary: [{ pricePerUnit: price - 100, amount: 9 }] });
const world = (price = 52000) => ({ guides: [guide], methods: [method], products: { FINE_PERIDOT_GEM: book(price) }, checks: {}, owned: [], dates: {}, base: {}, build: {}, ui: {}, prices: {}, settings: {}, now: 0 });

test('routes: the list, a method page, and swipes between Gear, list and page', () => {
  assert.deepEqual(parseRoute('#/guide/shaft/methods', [guide]), { page: 'guide', id: 'shaft', tab: 'methods' });
  assert.deepEqual(parseRoute('#/guide/shaft/methods/sample', [guide]), { page: 'guide', id: 'shaft', tab: 'methods', method: 'sample' });
  const gear = parseRoute('#/guide/shaft/path', [guide]);
  assert.equal(swipeTarget(gear, -50, ['shaft'], true).hash, '#/guide/shaft/methods');
  assert.equal(swipeTarget(gear, -50, ['shaft'], false), null);
  assert.equal(swipeTarget(gear, 50, ['shaft'], true).hash, '#/');
  const list = parseRoute('#/guide/shaft/methods', [guide]);
  assert.equal(swipeTarget(list, 50, ['shaft'], true).hash, '#/guide/shaft/path');
  assert.equal(swipeTarget(list, -50, ['shaft'], true), null);
  assert.equal(swipeTarget(parseRoute('#/guide/shaft/methods/sample', [guide]), 50, ['shaft'], true).hash, '#/guide/shaft/methods');
});

test('a mining guide gets Gear and Methods tabs only when methods exist', () => {
  assert.match(guideView(world(), 'shaft', { tab: 'path' }), /<nav class="switch"[^>]*>[^]*href="#\/guide\/shaft\/methods"/);
  assert.doesNotMatch(guideView({ ...world(), methods: [] }, 'shaft', { tab: 'path' }), /class="switch"/);
  assert.doesNotMatch(guideView(world(), 'shaft', { tab: 'path' }), /So läuft's/);
});

test('the list has one card per method; the page has all six sections', () => {
  const list = guideView(world(), 'shaft', { tab: 'methods' });
  assert.match(list, /class="m-pick" href="#\/guide\/shaft\/methods\/sample"/);
  assert.match(list, /<a href="#\/guide\/shaft\/methods" aria-current="page">Methods/);
  const page = guideView(world(), 'shaft', { tab: 'methods', method: 'sample' });
  for (const h of ['Which method?', 'Run', 'Loadouts', 'Auto-pet', 'Gear in short', 'Tips']) assert.ok(page.includes(`<h2>${h}</h2>`), h);
  assert.equal(page.match(/class="m-num"/g).length, 5);
  assert.equal(page.match(/class="m-back"/g).length, 2);
  assert.match(page, /pets\/GLACITE_GOLEM_LEGENDARY\.png/);
});

test('the price marks the matching option and shows beside it', () => {
  const on = (html) => html.match(/<div class="m-opt m-opt-on">.*?<\/div>/)?.[0] ?? '';
  assert.match(on(guideView(world(52000), 'shaft', { tab: 'methods', method: 'sample' })), /Rich route[^]*52k now/);
  assert.match(on(guideView(world(30000), 'shaft', { tab: 'methods', method: 'sample' })), /Cheap route[^]*30k now/);
  assert.equal(guideView({ ...world(), products: null }, 'shaft', { tab: 'methods', method: 'sample' }).includes('m-opt-on'), false);
});

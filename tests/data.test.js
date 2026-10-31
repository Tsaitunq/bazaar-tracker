import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { dataUrl, loadStats, loadRecipes, loadHistory, freshBins, fetchBins } from '../data.js';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });
const ok = (body) => ({ ok: true, json: async () => body });
const notFound = { ok: false, status: 404 };

test('dataUrl', () => {
  const raw = 'https://raw.githubusercontent.com/Tsaitunq/bazaar-tracker/data/';
  assert.equal(dataUrl('localhost', 'http:'), './data/');
  assert.equal(dataUrl('127.0.0.1', 'http:'), './data/');
  // the Android app runs on https://localhost and must read the published data
  assert.equal(dataUrl('localhost', 'https:'), raw);
  assert.equal(dataUrl('Tsaitunq.github.io', 'https:'), 'https://raw.githubusercontent.com/Tsaitunq/bazaar-tracker/data/');
});

test('loadStats', async () => {
  globalThis.fetch = async () => notFound;
  assert.equal(await loadStats(), null);
  globalThis.fetch = async () => ok({ t: 1, i: { A: [82, 100.5, 30] } });
  assert.deepEqual(await loadStats(), { A: [82, 100.5, 30] });
});

test('loadRecipes returns null on network error', async () => {
  globalThis.fetch = async () => { throw new TypeError('offline'); };
  assert.equal(await loadRecipes(), null);
});

test('loadHistory fetches two day files and survives one 404', async () => {
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(url);
    return url.includes('2026-10-09') ? ok({ t: [10, 20], p: { A: [[1, 2], [3, 4]] } }) : notFound;
  };
  const pts = await loadHistory('A', 1, Date.UTC(2026, 9, 9, 12));
  assert.deepEqual(urls.map((u) => u.replace(/^.*\/h\//, 'h/')).sort(), ['h/2026-10-08/1.json', 'h/2026-10-09/1.json']);
  assert.deepEqual(pts, [[10, 1, 3], [20, 2, 4]]);
});

test('fetchBins caches answers and no auction, stops when the service fails', async () => {
  const answers = { A: { ok: true, status: 200, json: async () => ({ lowest: 70 }) }, B: { ok: false, status: 404 }, C: { ok: false, status: 429 } };
  const asked = [];
  const get = async (url) => { const id = url.split('/').at(-2); asked.push(url); return answers[id]; };
  const cache = {};
  assert.equal(await fetchBins(['A', 'B', 'C', 'D'], cache, () => {}, { get, wait: async () => {}, now: () => 5 }), false);
  assert.deepEqual(cache, { A: { p: 70, t: 5 }, B: { p: 0, t: 5 } });
  assert.equal(asked.length, 3);
  assert.equal(asked[0], 'https://sky.coflnet.com/api/item/price/A/bin');
});

test('a price older than an hour no longer counts', () => {
  assert.deepEqual(freshBins({ A: { p: 1, t: 0 }, B: { p: 2, t: 3000e3 } }, 3600e3 + 1), { B: 2 });
});

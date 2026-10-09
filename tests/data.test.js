import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { dataUrl, loadScores, loadRecipes, loadHistory } from '../data.js';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });
const ok = (body) => ({ ok: true, json: async () => body });
const notFound = { ok: false, status: 404 };

test('dataUrl', () => {
  assert.equal(dataUrl('localhost'), './data/');
  assert.equal(dataUrl('127.0.0.1'), './data/');
  assert.equal(dataUrl('Tsaitunq.github.io'), 'https://raw.githubusercontent.com/Tsaitunq/bazaar-tracker/data/');
});

test('loadScores', async () => {
  globalThis.fetch = async () => notFound;
  assert.deepEqual(await loadScores(), {});
  globalThis.fetch = async () => ok({ t: 1, s: { A: 5 } });
  assert.deepEqual(await loadScores(), { A: 5 });
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

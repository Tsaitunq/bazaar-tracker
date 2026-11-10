import test from 'node:test';
import assert from 'node:assert/strict';
import { listProfiles, fetchProfile, defaultProfile, validName, ImportError, API } from '../../apps/guide/import/api.js';

const ID = '11111111-1111-4111-8111-111111111111';
const reply = (status, body, headers = {}) => async () => ({
  status, ok: status >= 200 && status < 300, headers: { get: (k) => headers[k] ?? null },
  json: async () => { if (body === undefined) throw new SyntaxError('bad json'); return body; },
});
const kindOf = (promise) => promise.then(() => 'ok', (e) => (e instanceof ImportError ? e.kind : `other:${e.message}`));

test('names: the worker rule, checked before any request', async () => {
  for (const bad of ['', 'ab', 'a'.repeat(17), 'with space', 'ü', null, undefined]) assert.equal(validName(bad), false, String(bad));
  assert.equal(validName('Abc_123'), true);
  let calls = 0;
  const fetch = async () => { calls++; return reply(200, {})(); };
  assert.equal(await kindOf(listProfiles('a b', { fetch })), 'name');
  assert.equal(await kindOf(fetchProfile('Valid_Name', 'not-an-id', { fetch })), 'name');
  assert.equal(calls, 0);
});

test('profiles: shape checked, ids and names kept, the default is the chosen or selected one', async () => {
  const seen = [];
  const body = { uuid: 'x', profiles: [{ id: ID, cute_name: 'Apple', game_mode: 'ironman', selected: false }, { id: 'bad', cute_name: 'Broken' }, { id: '22222222-2222-4222-8222-222222222222', cute_name: 'Pear', selected: true }] };
  const fetch = async (url, opts) => { seen.push([url, opts.cache]); return reply(200, body)(); };
  const list = await listProfiles('Abc', { fetch });
  assert.deepEqual(seen, [[`${API}/v1/profiles/Abc`, 'no-store']]);
  assert.deepEqual(list.map((p) => p.cute_name), ['Apple', 'Pear']);
  assert.equal(defaultProfile(list, ID).cute_name, 'Apple'); // the chosen one stays
  assert.equal(defaultProfile(list, 'gone').cute_name, 'Pear'); // else the selected one
  assert.equal(defaultProfile([{ id: ID, cute_name: 'Only', selected: false }], null).cute_name, 'Only');
  assert.equal(defaultProfile([], null), null);
});

test('every failure becomes an ImportError with a kind and a text', async () => {
  const run = (fetch) => fetchProfile('Abc', ID, { fetch });
  assert.equal(await kindOf(run(reply(404, {}))), 'notfound');
  assert.equal(await kindOf(run(reply(400, {}))), 'name');
  assert.equal(await kindOf(run(reply(500, {}))), 'server');
  assert.equal(await kindOf(run(reply(502, {}))), 'upstream');
  assert.equal(await kindOf(run(reply(200, undefined))), 'server'); // not JSON
  assert.equal(await kindOf(run(reply(200, [1]))), 'server'); // not an object
  assert.equal(await kindOf(run(async () => { throw new TypeError('Failed to fetch'); })), 'offline');
  const limit = await run(reply(429, {}, { 'Retry-After': '42' })).catch((e) => e);
  assert.equal(limit.kind, 'limit');
  assert.equal(limit.retryAfter, 42);
  assert.match(limit.message, /42 seconds/);
  assert.equal((await run(reply(429, {})).catch((e) => e)).retryAfter, 60);
  assert.equal((await run(reply(502, {}, { 'Retry-After': '7' })).catch((e) => e)).retryAfter, 7);
  assert.equal(await kindOf(listProfiles('Abc', { fetch: reply(200, { profiles: 'x' }) })), 'server');
});

test('a call that takes too long counts as offline', async () => {
  const slow = (url, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
  assert.equal(await kindOf(fetchProfile('Abc', ID, { fetch: slow, timeout: 20 })), 'offline');
});

test('no message names the player', async () => {
  for (const status of [400, 404, 429, 502, 500]) {
    const e = await fetchProfile('SecretName', ID, { fetch: reply(status, {}) }).catch((x) => x);
    assert.equal(e.message.includes('SecretName'), false, String(status));
  }
});

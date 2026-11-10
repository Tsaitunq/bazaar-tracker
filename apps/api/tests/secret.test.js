import test from 'node:test';
import assert from 'node:assert/strict';
import { call, fakeFetch, SENTINEL_KEY, UUID, PID } from './helpers.js';

const dump = async (res) => JSON.stringify([...res.headers]) + (await res.text());

test('key: sent only to api.hypixel.net as API-Key header, never in URLs', async () => {
  const f = fakeFetch();
  await call('/v1/profiles/Some_Name', { fetch: f });
  await call(`/v1/profile/Some_Name/${PID}`, { fetch: f });
  assert.ok(f.calls.length >= 3);
  for (const c of f.calls) {
    const host = new URL(c.url).host;
    assert.ok(!c.url.includes(SENTINEL_KEY));
    if (host === 'api.hypixel.net') assert.equal(c.headers['API-Key'], SENTINEL_KEY);
    else assert.ok(!JSON.stringify(c.headers).includes(SENTINEL_KEY), host);
  }
});

test('key: never in any response, success or error, nor in logs', async (t) => {
  const logs = [];
  t.mock.method(console, 'error', (...a) => logs.push(a.join(' ')));
  t.mock.method(console, 'log', (...a) => logs.push(a.join(' ')));
  const bad = fakeFetch({ 'api.hypixel.net': () => new Response(`echo ${SENTINEL_KEY}`, { status: 403 }) });
  for (const [p, f] of [['/v1/profiles/Some_Name', fakeFetch()], ['/v1/profiles/Some_Name', bad], ['/v1/profile/Some_Name/bad', fakeFetch()], ['/nope', fakeFetch()]]) {
    const { res } = await call(p, { fetch: f });
    assert.ok(!(await dump(res)).includes(SENTINEL_KEY), p);
  }
  assert.ok(logs.length > 0, 'the failure case logs');
  const all = logs.join('\n');
  assert.ok(!all.includes(SENTINEL_KEY));
  assert.ok(!all.includes('Some_Name') && !all.includes('some_name') && !all.includes(UUID), 'no name or uuid in logs');
});

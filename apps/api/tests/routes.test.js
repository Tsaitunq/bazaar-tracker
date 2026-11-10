import test from 'node:test';
import assert from 'node:assert/strict';
import { call, fakeFetch, fakeKV, json404, nameHosts, PID, UUID, profile } from './helpers.js';

const NOTICE = 'Not affiliated with or endorsed by Hypixel';

test('profiles: uuid and profile list, notice, cache headers', async () => {
  const { res } = await call('/v1/profiles/Some_Name');
  assert.equal(res.status, 200);
  const b = await res.json();
  assert.equal(b.uuid, UUID);
  assert.deepEqual(b.profiles, [{ id: PID, cute_name: 'Apple', game_mode: 'ironman', selected: true }]);
  assert.equal(b.notAffiliated, NOTICE);
  assert.equal(res.headers.get('X-Cache'), 'MISS');
  assert.equal(res.headers.get('X-Cache-Mojang'), 'MISS');
  assert.equal(res.headers.get('Content-Type'), 'application/json; charset=utf-8');
});

test('profile: trimmed data of the one member, raw base64', async () => {
  const { res } = await call(`/v1/profile/Some_Name/${PID}`);
  assert.equal(res.status, 200);
  const b = await res.json();
  assert.equal(b.uuid, UUID);
  assert.equal(b.inventories.enderChest, profile.members[UUID].inventory.ender_chest_contents.data);
  assert.deepEqual(b.missing, ['inventories.wardrobe']);
  assert.equal(b.notAffiliated, NOTICE);
  assert.ok(!JSON.stringify(b).includes('OTHER_MEMBER_SENTINEL'));
});

test('profile id without dashes works and shares the cache entry', async () => {
  const kv = fakeKV();
  const f = fakeFetch();
  await call(`/v1/profile/Some_Name/${PID}`, { env: { CACHE: kv }, fetch: f });
  const { res } = await call(`/v1/profile/some_name/${PID.replace(/-/g, '').toUpperCase()}`, { env: { CACHE: kv }, fetch: f });
  assert.equal(res.headers.get('X-Cache'), 'HIT');
  assert.equal(res.headers.get('X-Cache-Mojang'), 'HIT');
});

test('cache: keys, TTLs, second call hits and skips upstream', async () => {
  const kv = fakeKV();
  const f = fakeFetch();
  await call('/v1/profiles/Some_Name', { env: { CACHE: kv }, fetch: f });
  assert.deepEqual([...kv.m.keys()].sort(), ['mojang:some_name', `profiles:${UUID}`]);
  assert.equal(kv.m.ttl['mojang:some_name'], 86400);
  assert.equal(kv.m.ttl[`profiles:${UUID}`], 3600);
  const n = f.calls.length;
  const { res } = await call('/v1/profiles/SOME_NAME', { env: { CACHE: kv }, fetch: f });
  assert.equal(res.headers.get('X-Cache'), 'HIT');
  assert.equal(f.calls.length, n);
  await call(`/v1/profile/Some_Name/${PID}`, { env: { CACHE: kv }, fetch: f });
  assert.ok(kv.m.has(`profile:${UUID}:${PID.replace(/-/g, '')}`));
  assert.equal(kv.m.ttl[`profile:${UUID}:${PID.replace(/-/g, '')}`], 3600);
});

test('KV failure: still answers, without cache', async () => {
  for (const kv of [fakeKV({ failGet: true }), fakeKV({ failPut: true })]) {
    const { res } = await call('/v1/profiles/Some_Name', { env: { CACHE: kv } });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('X-Cache'), 'MISS');
  }
  const { res } = await call('/v1/profiles/Some_Name', { env: { CACHE: undefined } });
  assert.equal(res.status, 200);
});

test('validation: 400 before any upstream call', async () => {
  const f = fakeFetch();
  for (const p of ['/v1/profiles/ab', '/v1/profiles/' + 'a'.repeat(17), '/v1/profiles/a-b', '/v1/profiles/%E4bc', '/v1/profile/Some_Name/nope']) {
    const { res } = await call(p, { fetch: f });
    assert.equal(res.status, 400, p);
    assert.ok((await res.json()).error);
  }
  assert.equal(f.calls.length, 0);
});

test('routing: 404 unknown path, 405 other methods, 204 OPTIONS', async () => {
  for (const p of ['/', '/v1', '/v2/profiles/abc', '/v1/profiles', '/v1/profile/abc', '/v1/profiles/abc/extra', '/v1/profile/abc/' + PID + '/x']) {
    assert.equal((await call(p)).res.status, 404, p);
  }
  const post = (await call('/v1/profiles/abc', { method: 'POST' })).res;
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('Allow'), 'GET, OPTIONS');
  const opt = (await call('/v1/profiles/abc', { method: 'OPTIONS', headers: { Origin: 'https://localhost' } })).res;
  assert.equal(opt.status, 204);
  assert.equal(opt.headers.get('Access-Control-Allow-Origin'), 'https://localhost');
});

test('errors: unknown name 404, unknown profile 404, non-member 404', async () => {
  let r = await call('/v1/profiles/Some_Name', { fetch: fakeFetch(nameHosts(() => new Response(null, { status: 204 }))) });
  assert.equal(r.res.status, 404);
  r = await call('/v1/profiles/Some_Name', { fetch: fakeFetch(nameHosts(json404)) });
  assert.equal(r.res.status, 404);
  r = await call(`/v1/profile/Some_Name/${'2'.repeat(8)}-2222-4222-8222-${'2'.repeat(12)}`, { fetch: fakeFetch({ 'api.hypixel.net': () => Response.json({ success: true, profile: null }) }) });
  assert.equal(r.res.status, 404);
  r = await call(`/v1/profile/Some_Name/${PID}`, { fetch: fakeFetch(nameHosts(() => Response.json({ id: 'a'.repeat(32) }))) });
  assert.equal(r.res.status, 404);
});

test('errors: Hypixel/Mojang failures are 502, Retry-After passes through', async () => {
  const hx = (fn) => fakeFetch({ 'api.hypixel.net': fn });
  for (const fn of [() => new Response('x', { status: 500 }), () => Response.json({ success: false }), () => new Response('<html>', { status: 200 }), () => { throw new Error('net'); }]) {
    assert.equal((await call('/v1/profiles/Some_Name', { fetch: hx(fn) })).res.status, 502);
  }
  const r = await call('/v1/profiles/Some_Name', { fetch: hx(() => new Response('', { status: 429, headers: { 'Retry-After': '30' } })) });
  assert.equal(r.res.status, 502);
  assert.equal(r.res.headers.get('Retry-After'), '30');
  assert.equal((await call('/v1/profiles/Some_Name', { fetch: fakeFetch(nameHosts(() => new Response('', { status: 503 }))) })).res.status, 502);
  assert.equal((await call('/v1/profiles/Some_Name', { env: { HYPIXEL_KEY: undefined } })).res.status, 502);
});

test('errors are not cached', async () => {
  const kv = fakeKV();
  await call('/v1/profiles/Some_Name', { env: { CACHE: kv }, fetch: fakeFetch({ 'api.hypixel.net': () => new Response('', { status: 500 }) }) });
  assert.ok(!kv.m.has(`profiles:${UUID}`));
});

test('single-profile endpoint gone (404) -> falls back to the list', async () => {
  const f = fakeFetch({ 'api.hypixel.net': (u) => (u.pathname === '/v2/skyblock/profile' ? new Response('', { status: 404 }) : Response.json({ success: true, profiles: [profile] })) });
  const { res } = await call(`/v1/profile/Some_Name/${PID}`, { fetch: f });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).profileId, PID);
});

test('rate limit: 429 with Retry-After, no upstream call; limiter error lets through', async () => {
  const f = fakeFetch();
  const r = await call('/v1/profiles/Some_Name', { env: { LIMITER: { limit: async () => ({ success: false }) } }, fetch: f });
  assert.equal(r.res.status, 429);
  assert.equal(r.res.headers.get('Retry-After'), '60');
  assert.equal(f.calls.length, 0);
  const ok = await call('/v1/profiles/Some_Name', { env: { LIMITER: { limit: async () => { throw new Error('x'); } } } });
  assert.equal(ok.res.status, 200);
});

test('rate limit key is a hash, not the IP', async () => {
  let seen;
  await call('/v1/profiles/Some_Name', { env: { LIMITER: { limit: async (o) => ((seen = o.key), { success: true }) } }, headers: { 'CF-Connecting-IP': '203.0.113.7' } });
  assert.match(seen, /^[0-9a-f]{16}$/);
});

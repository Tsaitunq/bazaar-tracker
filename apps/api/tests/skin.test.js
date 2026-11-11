import test from 'node:test';
import assert from 'node:assert/strict';
import { call, fakeFetch, fakeKV, UUID } from './helpers.js';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const textures = (url) => ({ id: UUID, name: 'x', properties: [{ name: 'textures', value: btoa(JSON.stringify({ textures: { SKIN: { url } } })) }] });
const png = () => new Response(PNG, { status: 200, headers: { 'Content-Type': 'image/png' } });
const hosts = (over = {}) => ({
  'sessionserver.mojang.com': () => new Response(JSON.stringify(textures('https://textures.minecraft.net/texture/abc')), { status: 200 }),
  'textures.minecraft.net': png,
  ...over,
});
const bytes = async (res) => new Uint8Array(await res.arrayBuffer());

test('skin: the png from the session server, CORS, one day cache', async () => {
  const { res, fetch } = await call(`/v1/skin/${UUID}`, { fetch: fakeFetch(hosts()), headers: { Origin: 'https://localhost' } });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Content-Type'), 'image/png');
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://localhost');
  assert.equal(res.headers.get('Cache-Control'), 'private, max-age=86400');
  assert.deepEqual(await bytes(res), PNG);
  assert.ok(fetch.calls.some((c) => c.url.startsWith('https://sessionserver.mojang.com/session/minecraft/profile/')));
});

test('skin: the second call comes from KV for a day, dashes in the uuid are fine', async () => {
  const kv = fakeKV();
  const f = fakeFetch(hosts());
  await call(`/v1/skin/${UUID}`, { env: { CACHE: kv }, fetch: f });
  const n = f.calls.length;
  const { res } = await call(`/v1/skin/${UUID.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5')}`, { env: { CACHE: kv }, fetch: f });
  assert.equal(res.headers.get('X-Cache'), 'HIT');
  assert.equal(f.calls.length, n);
  assert.deepEqual(await bytes(res), PNG);
  assert.equal(kv.m.ttl[`skin:${UUID}`], 86400);
});

test('skin: PlayerDB answers when the session server does not', async () => {
  const f = fakeFetch(hosts({
    'sessionserver.mojang.com': () => new Response('', { status: 429 }),
    'playerdb.co': () => new Response(JSON.stringify({ data: { player: { skin_texture: 'https://textures.minecraft.net/texture/def' } } }), { status: 200 }),
  }));
  const { res } = await call(`/v1/skin/${UUID}`, { fetch: f });
  assert.equal(res.status, 200);
  assert.deepEqual(await bytes(res), PNG);
});

test('skin: a texture url that is not on textures.minecraft.net is never fetched', async () => {
  const f = fakeFetch(hosts({ 'sessionserver.mojang.com': () => new Response(JSON.stringify(textures('https://evil.example/x.png')), { status: 200 }) }));
  const { res } = await call(`/v1/skin/${UUID}`, { fetch: f });
  assert.ok(!f.calls.some((c) => c.url.includes('evil.example')));
  assert.equal(res.status, 404);
});

test('skin: not a png, or no skin at all, or every source down', async () => {
  const notPng = await call(`/v1/skin/${UUID}`, { fetch: fakeFetch(hosts({ 'textures.minecraft.net': () => new Response('<html>', { status: 200 }), 'playerdb.co': () => new Response('', { status: 500 }) })) });
  assert.equal(notPng.res.status, 502);
  const none = await call(`/v1/skin/${UUID}`, { fetch: fakeFetch(hosts({ 'sessionserver.mojang.com': () => new Response('', { status: 204 }), 'playerdb.co': () => new Response('', { status: 404 }) })) });
  assert.equal(none.res.status, 404);
  const down = await call(`/v1/skin/${UUID}`, { fetch: fakeFetch({ 'sessionserver.mojang.com': () => new Response('', { status: 500 }), 'playerdb.co': () => new Response('', { status: 500 }) }) });
  assert.equal(down.res.status, 502);
});

test('skin: a bad uuid, the rate limit and other methods', async () => {
  assert.equal((await call('/v1/skin/not-a-uuid')).res.status, 400);
  assert.equal((await call(`/v1/skin/${UUID}`, { env: { LIMITER: { limit: async () => ({ success: false }) } } })).res.status, 429);
  assert.equal((await call(`/v1/skin/${UUID}`, { method: 'POST' })).res.status, 405);
  assert.equal((await call(`/v1/skin/${UUID}/x`)).res.status, 404);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mojangUuid } from '../src/upstream.js';
import { UUID } from './helpers.js';

const DASHED = UUID.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
const bodies = {
  'api.minecraftservices.com': { id: UUID, name: 'x' },
  'api.mojang.com': { id: UUID, name: 'x' },
  'playerdb.co': { success: true, code: 'player.found', data: { player: { raw_id: UUID, id: DASHED, username: 'x' } } },
};
const HOSTS = Object.keys(bodies);

// answers[host] = status number | 'throw' | 'timeout' | 'garbage' | 'ok'. Records host order and init of every call.
function fake(answers) {
  const f = async (url, init) => {
    const host = new URL(url).host;
    f.hosts.push(host);
    f.inits.push(init);
    const a = answers[host] ?? 'ok';
    if (a === 'throw') throw new Error('net');
    if (a === 'timeout') throw Object.assign(new Error('t'), { name: 'TimeoutError' });
    if (a === 'garbage') return new Response('<html>', { status: 200 });
    if (a === 'ok') return Response.json(bodies[host]);
    return new Response(a === 204 ? null : '', { status: a, headers: a === 429 ? { 'Retry-After': '7' } : {} });
  };
  f.hosts = [];
  f.inits = [];
  return f;
}

const logs = (t) => {
  const l = [];
  t.mock.method(console, 'error', (...a) => l.push(a.join(' ')));
  return l;
};

test('order: minecraftservices first, and it wins when it answers', async () => {
  const f = fake({});
  assert.equal(await mojangUuid('Some_Name', { fetch: f }), UUID);
  assert.deepEqual(f.hosts, ['api.minecraftservices.com']);
});

test('each source parses to the same dashless lowercase uuid', async () => {
  for (const [i, host] of HOSTS.entries()) {
    const answers = Object.fromEntries(HOSTS.slice(0, i).map((h) => [h, 403]));
    const f = fake(answers);
    assert.equal(await mojangUuid('Some_Name', { fetch: f }), UUID, host);
    assert.equal(f.hosts.at(-1), host);
    assert.equal(f.hosts.length, i + 1);
  }
});

test('403, 429, 5xx, timeout, network error, bad body: next source', async () => {
  for (const bad of [403, 429, 500, 503, 'timeout', 'throw', 'garbage']) {
    const f = fake({ 'api.minecraftservices.com': bad, 'api.mojang.com': bad });
    assert.equal(await mojangUuid('Some_Name', { fetch: f }), UUID, String(bad));
    assert.deepEqual(f.hosts, HOSTS, String(bad));
  }
});

test('404 and 204 mean the name does not exist: stop, no further source', async () => {
  for (const status of [404, 204]) {
    for (const [i, host] of HOSTS.entries()) {
      const answers = { ...Object.fromEntries(HOSTS.slice(0, i).map((h) => [h, 403])), [host]: status };
      const f = fake(answers);
      await assert.rejects(mojangUuid('Some_Name', { fetch: f }), (e) => e.status === 404);
      assert.equal(f.hosts.length, i + 1, `${status} from ${host}`);
    }
  }
});

test('all sources failing: 502, Retry-After from upstream kept', async () => {
  const f = fake({ 'api.minecraftservices.com': 429, 'api.mojang.com': 403, 'playerdb.co': 500 });
  await assert.rejects(mojangUuid('Some_Name', { fetch: f }), (e) => e.status === 502 && e.retryAfter === '7');
});

test('every request: own User-Agent and a 3 s timeout signal', async () => {
  const f = fake({ 'api.minecraftservices.com': 403, 'api.mojang.com': 403 });
  await mojangUuid('Some_Name', { fetch: f });
  assert.equal(f.inits.length, 3);
  for (const init of f.inits) {
    assert.equal(init.headers['User-Agent'], 'progression-guides-api');
    assert.ok(init.signal instanceof AbortSignal);
  }
});

test('log per failed attempt: source and status only, no name or uuid', async (t) => {
  const l = logs(t);
  await mojangUuid('Some_Name', { fetch: fake({ 'api.minecraftservices.com': 403, 'api.mojang.com': 'timeout' }) });
  assert.deepEqual(l, ['name lookup failed: minecraftservices 403', 'name lookup failed: mojang timeout']);
  l.length = 0;
  await assert.rejects(mojangUuid('Some_Name', { fetch: fake({ 'api.minecraftservices.com': 'throw', 'api.mojang.com': 'garbage', 'playerdb.co': 502 }) }));
  assert.deepEqual(l, ['name lookup failed: minecraftservices network', 'name lookup failed: mojang bad body', 'name lookup failed: playerdb 502']);
  assert.ok(!l.join().includes('Some_Name') && !l.join().includes(UUID));
});

import { readFileSync } from 'node:fs';
import { handle } from '../src/index.js';

export const profile = JSON.parse(readFileSync(new URL('./fixtures/profile.anon.json', import.meta.url), 'utf8'));
export const UUID = '00000000000040008000000000000001';
export const PID = profile.profile_id;
export const SENTINEL_KEY = 'TEST_KEY_NOT_REAL';

export function fakeKV({ failGet = false, failPut = false } = {}) {
  const m = new Map();
  return {
    m,
    async get(k) { if (failGet) throw new Error('kv down'); return m.has(k) ? m.get(k) : null; },
    async put(k, v, o) { if (failPut) throw new Error('kv write limit'); m.set(k, v); m.ttl = { ...m.ttl, [k]: o.expirationTtl }; },
  };
}

// Routes by host/path; counts calls; records every call (url + headers) for the key checks.
export function fakeFetch(over = {}) {
  const calls = [];
  const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers });
  const f = async (url, init = {}) => {
    calls.push({ url: String(url), headers: init.headers || {} });
    const u = new URL(url);
    if (over[u.host]) return over[u.host](u);
    if (u.host === 'api.minecraftservices.com' || u.host === 'api.mojang.com') return json({ id: UUID, name: 'x' });
    if (u.host === 'playerdb.co') return json({ success: true, data: { player: { raw_id: UUID, id: UUID.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5') } } });
    if (u.pathname === '/v2/skyblock/profiles') return json({ success: true, profiles: [profile] });
    if (u.pathname === '/v2/skyblock/profile') return json({ success: true, profile });
    return new Response('?', { status: 500 });
  };
  f.calls = calls;
  return f;
}

// Same answer from all three name-lookup hosts.
export const nameHosts = (fn) => ({ 'api.minecraftservices.com': fn, 'api.mojang.com': fn, 'playerdb.co': fn });

export const json404 = () => new Response('', { status: 404 });

export function call(path, { env = {}, fetch = fakeFetch(), headers = {}, method = 'GET' } = {}) {
  const e = { HYPIXEL_KEY: SENTINEL_KEY, CACHE: fakeKV(), ...env };
  return handle(new Request('https://api.test' + path, { method, headers }), e, { fetch }).then((res) => ({ res, env: e, fetch }));
}

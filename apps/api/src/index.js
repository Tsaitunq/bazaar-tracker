import { corsHeaders } from './cors.js';
import { validName, validProfileId, validUuid, plainId, dashedId } from './validate.js';
import { allowed } from './limit.js';
import { cached, keys, TTL } from './cache.js';
import { HttpError, mojangUuid, hypixelProfiles, hypixelProfile, skinPng } from './upstream.js';
import { trimList, trimProfile } from './trim.js';

const NOTICE = 'Not affiliated with or endorsed by Hypixel';

const toBase64 = (bytes) => btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''));
const fromBase64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function handle(request, env, deps = { fetch: (...a) => fetch(...a) }) {
  const base = { ...corsHeaders(request.headers.get('Origin')), 'X-Content-Type-Options': 'nosniff' };
  const reply = (status, body, extra = {}) =>
    new Response(typeof body === 'string' ? body : JSON.stringify({ ...body, notAffiliated: NOTICE }), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8', ...base, ...extra },
    });
  const error = (status, message, extra) => reply(status, { error: message }, extra);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: base });
  if (request.method !== 'GET') return error(405, 'method not allowed', { Allow: 'GET, OPTIONS' });

  let parts;
  try {
    parts = new URL(request.url).pathname.split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    return error(400, 'bad path');
  }
  const [v, kind, name, pid, ...rest] = parts;
  if (v === 'v1' && kind === 'skin' && name && pid === undefined && !rest.length) return skin(name);
  const isList = kind === 'profiles' && name && pid === undefined;
  const isOne = kind === 'profile' && name && pid !== undefined;
  if (v !== 'v1' || rest.length || !(isList || isOne)) return error(404, 'not found');
  if (!validName(name)) return error(400, 'invalid player name');
  if (isOne && !validProfileId(pid)) return error(400, 'invalid profile id');

  async function skin(raw) {
    if (!validUuid(raw)) return error(400, 'invalid uuid');
    if (!(await allowed(env, request))) return error(429, 'too many requests', { 'Retry-After': '60' });
    try {
      // KV holds text, so the PNG is kept as base64
      const r = await cached(env, keys.skin(plainId(raw)), TTL.skin, async () => toBase64(await skinPng(plainId(raw), deps)));
      return new Response(fromBase64(r.value), {
        status: 200,
        headers: { 'Content-Type': 'image/png', ...base, 'Cache-Control': 'private, max-age=86400', 'X-Cache': r.hit ? 'HIT' : 'MISS' },
      });
    } catch (e) {
      if (e instanceof HttpError) return error(e.status, e.message, e.retryAfter ? { 'Retry-After': String(e.retryAfter) } : {});
      console.error('unexpected error');
      return error(500, 'internal error');
    }
  }

  if (!(await allowed(env, request))) return error(429, 'too many requests', { 'Retry-After': '60' });

  try {
    const mojang = await cached(env, keys.mojang(name), TTL.mojang, () => mojangUuid(name, deps));
    const uuid = mojang.value;
    let result;
    if (isList) {
      result = await cached(env, keys.profiles(uuid), TTL.profile, async () =>
        JSON.stringify({ uuid, profiles: trimList(await hypixelProfiles(uuid, env, deps)), notAffiliated: NOTICE }));
    } else {
      const id = dashedId(pid);
      result = await cached(env, keys.profile(uuid, plainId(pid)), TTL.profile, async () => {
        const profile = await hypixelProfile(id, uuid, env, deps);
        const trimmed = profile && trimProfile(profile, uuid);
        if (!trimmed) throw new HttpError(404, 'profile not found');
        return JSON.stringify({ uuid, ...trimmed, notAffiliated: NOTICE });
      });
    }
    return reply(200, result.value, {
      'Cache-Control': 'private, max-age=300',
      'X-Cache': result.hit ? 'HIT' : 'MISS',
      'X-Cache-Mojang': mojang.hit ? 'HIT' : 'MISS',
    });
  } catch (e) {
    if (e instanceof HttpError) return error(e.status, e.message, e.retryAfter ? { 'Retry-After': String(e.retryAfter) } : {});
    console.error('unexpected error');
    return error(500, 'internal error');
  }
}

export default { fetch: (request, env) => handle(request, env) };

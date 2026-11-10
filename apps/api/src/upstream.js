// Mojang and Hypixel clients. The key is read here only and sent only to api.hypixel.net.
// Error text never contains names, UUIDs or the key; log lines carry the endpoint kind and a status only.

export class HttpError extends Error {
  constructor(status, message, { retryAfter, upstream } = {}) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
    this.upstream = upstream;
  }
}

const fail = (kind, upstream, retryAfter) => {
  console.error(`upstream ${kind} failed: ${upstream}`);
  return new HttpError(502, `${kind} request failed`, { upstream, retryAfter });
};

const UA = 'progression-guides-api';
const TIMEOUT_MS = 3000;
const ID = /^[0-9a-f]{32}$/i;

// Sources in order; the first that answers wins. Only 404/204 means "name does not exist".
// Anything else (403, 429, 5xx, timeout, bad body) goes on to the next source.
export const NAME_SOURCES = [
  { id: 'minecraftservices', url: (n) => `https://api.minecraftservices.com/minecraft/profile/lookup/name/${n}`, uuid: (j) => j && j.id },
  { id: 'mojang', url: (n) => `https://api.mojang.com/users/profiles/minecraft/${n}`, uuid: (j) => j && j.id },
  // Community service; the id comes dashed.
  { id: 'playerdb', url: (n) => `https://playerdb.co/api/player/minecraft/${n}`, uuid: (j) => j && j.data && j.data.player && (j.data.player.raw_id || j.data.player.id) },
];

// name -> dashless lowercase UUID. Unknown name -> 404; every source failing -> 502.
export async function mojangUuid(name, deps) {
  let retryAfter;
  for (const s of NAME_SOURCES) {
    let status = 'network';
    try {
      const res = await deps.fetch(s.url(name), { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(TIMEOUT_MS) });
      status = res.status;
      if (status === 204 || status === 404) throw new HttpError(404, 'unknown player name');
      if (res.ok) {
        status = 'bad body';
        const id = String(s.uuid(await res.json()) || '').replace(/-/g, '');
        if (ID.test(id)) return id.toLowerCase();
      } else {
        retryAfter = res.headers.get('Retry-After') || retryAfter;
      }
    } catch (e) {
      if (e instanceof HttpError) throw e;
      if (e && e.name === 'TimeoutError') status = 'timeout';
    }
    console.error(`name lookup failed: ${s.id} ${status}`);
  }
  throw new HttpError(502, 'name lookup failed', { upstream: 'all', retryAfter });
}

export async function hypixelGet(path, env, deps) {
  if (!env.HYPIXEL_KEY) throw fail('hypixel', 'no key configured');
  let res;
  try {
    res = await deps.fetch(`https://api.hypixel.net${path}`, { headers: { 'API-Key': env.HYPIXEL_KEY } });
  } catch {
    throw fail('hypixel', 'network');
  }
  if (!res.ok) throw fail('hypixel', res.status, res.headers.get('Retry-After'));
  let j;
  try {
    j = await res.json();
  } catch {
    throw fail('hypixel', 'bad json');
  }
  if (!j || j.success !== true) throw fail('hypixel', 'success false');
  return j;
}

export async function hypixelProfiles(uuid, env, deps) {
  return (await hypixelGet(`/v2/skyblock/profiles?uuid=${uuid}`, env, deps)).profiles || [];
}

// Single-profile endpoint is smaller; if Hypixel no longer serves it (404/410), fall back to the list.
export async function hypixelProfile(profileId, uuid, env, deps) {
  try {
    return (await hypixelGet(`/v2/skyblock/profile?profile=${profileId}`, env, deps)).profile || null;
  } catch (e) {
    if (!(e instanceof HttpError) || (e.upstream !== 404 && e.upstream !== 410)) throw e;
  }
  const list = await hypixelProfiles(uuid, env, deps);
  return list.find((p) => p.profile_id === profileId) || null;
}

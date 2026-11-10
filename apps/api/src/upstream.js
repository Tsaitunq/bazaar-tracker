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

// name -> dashless lowercase UUID. Unknown name -> 404.
export async function mojangUuid(name, deps) {
  let res;
  try {
    res = await deps.fetch(`https://api.mojang.com/users/profiles/minecraft/${name}`);
  } catch {
    throw fail('mojang', 'network');
  }
  if (res.status === 204 || res.status === 404) throw new HttpError(404, 'unknown player name');
  if (!res.ok) throw fail('mojang', res.status, res.headers.get('Retry-After'));
  let j;
  try {
    j = await res.json();
  } catch {
    throw fail('mojang', 'bad json');
  }
  if (!j || typeof j.id !== 'string' || !/^[0-9a-f]{32}$/i.test(j.id)) throw fail('mojang', 'bad body');
  return j.id.toLowerCase();
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

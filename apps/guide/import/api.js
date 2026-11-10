// The two calls to the worker. Every failure becomes an ImportError with a kind and a text for the player; nothing here
// changes any state, so a failed call leaves the app as it was.
export const API = 'https://progression-guides-api.tsaitunq.workers.dev';
export const TIMEOUT_MS = 10000;

// the worker's rule too: a name that fails this never costs a request
export const validName = (name) => /^[A-Za-z0-9_]{3,16}$/.test(String(name ?? ''));
const validId = (id) => /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(String(id ?? ''));

const TEXT = {
  name: () => 'Enter a Minecraft name: 3 to 16 letters, digits or underscores.',
  notfound: () => 'Player or profile not found, or you are not a member of that profile.',
  limit: (s) => `Too many requests. Try again in ${s ?? 60} seconds.`,
  upstream: (s) => `Hypixel or Mojang does not answer right now. Try again${s ? ` in ${s} seconds` : ' later'}.`,
  offline: () => 'No connection. Your last import stays as it was.',
  server: () => 'The import has a problem right now. Try again later.',
};

export class ImportError extends Error {
  constructor(kind, retryAfter = null) {
    super(TEXT[kind](retryAfter));
    this.kind = kind;
    this.retryAfter = retryAfter;
  }
}

const seconds = (res) => {
  const n = Number(res.headers?.get?.('Retry-After'));
  return Number.isFinite(n) && n > 0 ? Math.ceil(n) : null;
};

async function call(path, { fetch = globalThis.fetch, timeout = TIMEOUT_MS } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  let res;
  try {
    res = await fetch(`${API}${path}`, { signal: ctl.signal, cache: 'no-store' });
  } catch {
    throw new ImportError('offline'); // no network, blocked, or too slow
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 400) throw new ImportError('name');
  if (res.status === 404) throw new ImportError('notfound');
  if (res.status === 429) throw new ImportError('limit', seconds(res) ?? 60);
  if (res.status === 502) throw new ImportError('upstream', seconds(res));
  if (!res.ok) throw new ImportError('server');
  try {
    return await res.json();
  } catch {
    throw new ImportError('server');
  }
}

// The profiles of a player: [{ id, cute_name, game_mode, selected }]
export async function listProfiles(name, deps) {
  if (!validName(name)) throw new ImportError('name');
  const body = await call(`/v1/profiles/${name}`, deps);
  if (!Array.isArray(body?.profiles)) throw new ImportError('server');
  return body.profiles
    .filter((p) => validId(p?.id) && typeof p.cute_name === 'string')
    .map((p) => ({ id: p.id, cute_name: p.cute_name, game_mode: typeof p.game_mode === 'string' ? p.game_mode : null, selected: p.selected === true }));
}

// The profile to show first: the one chosen before if it is still there, else the one selected in the game, else the first.
export const defaultProfile = (list, chosen) => list.find((p) => p.id === chosen) ?? list.find((p) => p.selected) ?? list[0] ?? null;

export async function fetchProfile(name, profileId, deps) {
  if (!validName(name) || !validId(profileId)) throw new ImportError('name');
  const body = await call(`/v1/profile/${name}/${profileId}`, deps);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ImportError('server');
  return body;
}

// "Sync profile": asks Hypixel for the player's own profile, only on a tap. The key stays out of messages and logs, and
// the coop mates in the answer go no further than this file.

const COOLDOWN = 60e3;

export function normalizeUuid(s) {
  const id = String(s ?? '').trim().replaceAll('-', '').toLowerCase();
  return /^[0-9a-f]{32}$/.test(id) ? id : null;
}

// Hypixel documents no key format, so only what pasting adds comes off.
export const cleanKey = (s) => String(s ?? '').trim() || null;

export async function fetchProfiles({ uuid, key, get = fetch }) {
  let res;
  try {
    res = await get(`https://api.hypixel.net/v2/skyblock/profiles?uuid=${uuid}`, { headers: { 'API-Key': key }, cache: 'no-store' });
  } catch {
    return { ok: false, error: 'network' };
  }
  if (res.status === 403) return { ok: false, error: 'key' };
  if (res.status === 400 || res.status === 422) return { ok: false, error: 'input' };
  if (res.status === 429) return { ok: false, error: 'limit', retryIn: Number(res.headers.get('RateLimit-Reset')) || 60 };
  if (!res.ok) return { ok: false, error: 'network' };
  try {
    const body = await res.json();
    if (body?.success !== true) return { ok: false, error: 'format' };
    return { ok: true, profiles: Array.isArray(body.profiles) ? body.profiles : [] };
  } catch {
    return { ok: false, error: 'format' };
  }
}

// Normal profiles this player still belongs to: no game_mode means no ironman, bingo or stranded.
export const eligibleProfiles = (profiles, uuid) => (profiles ?? []).filter((p) => {
  const member = p?.members?.[uuid];
  return member && !member.profile?.deletion_notice && !p.game_mode;
});

export function chooseProfile(list, savedId) {
  if (!list.length) return { none: true };
  const profile = list.find((p) => p.profile_id === savedId) ?? list.find((p) => p.selected) ?? (list.length === 1 ? list[0] : null);
  return profile ? { profile } : { choices: list };
}

const withDashes = (u) => `${u.slice(0, 8)}-${u.slice(8, 12)}-${u.slice(12, 16)}-${u.slice(16, 20)}-${u.slice(20)}`;

// shortcut: inventories stay encoded, so item uuids and names inside them remain; only for the gitignored field check, removed in Task 6.
export function anonymize(profile, uuid) {
  const { profile_id, cute_name, banking, community_upgrades, members, ...rest } = profile;
  const { coop_invitation, ...own } = members[uuid].profile ?? {};
  let text = JSON.stringify({ ...rest, members: { self: { ...members[uuid], profile: own } } });
  for (const id of Object.keys(members)) {
    const name = id === uuid ? 'self' : 'mate';
    text = text.replaceAll(id, name).replaceAll(withDashes(id), name);
  }
  return JSON.parse(text);
}

const MESSAGES = {
  nokey: 'Add your API key first.',
  nouuid: 'Add your Minecraft UUID first.',
  key: 'Hypixel rejected the key. Check it in the developer dashboard.',
  input: 'Check your UUID.',
  none: 'No normal profile found for this UUID.',
  network: 'No connection to Hypixel.',
  format: 'Could not read the profile.',
  store: 'Could not save the profile on this phone.',
};

export const syncMessage = (error, retryIn) => (error === 'limit' ? `Too many requests, try again in ${retryIn} s.` : MESSAGES[error]);

export function createSync({ store, get = fetch, now = Date.now, summarize }) {
  let busy = false;
  const fail = (error, extra = {}) => ({ status: 'error', error, ...extra });

  async function attempt(pick) {
    const state = await store.loadProfile();
    if (!state?.uuid) return fail('nouuid');
    const key = await store.getApiKey();
    if (!key) return fail('nokey');
    const wait = (state.syncedAt ?? -Infinity) + COOLDOWN - now();
    if (wait > 0) return fail('limit', { retryIn: Math.ceil(wait / 1000) });
    const answer = await fetchProfiles({ uuid: state.uuid, key, get });
    if (!answer.ok) return fail(answer.error, answer.retryIn ? { retryIn: answer.retryIn } : {});
    const chosen = chooseProfile(eligibleProfiles(answer.profiles, state.uuid), pick ?? state.profileId);
    if (chosen.none) return fail('none');
    if (chosen.choices) {
      return { status: 'choose', choices: chosen.choices.map((p) => ({ id: p.profile_id, name: p.cute_name, members: Object.keys(p.members).length })) };
    }
    const { profile } = chosen;
    let summary;
    try {
      summary = await summarize(profile.members[state.uuid], state.summary ?? null);
    } catch {
      return fail('format');
    }
    const next = { uuid: state.uuid, profileId: profile.profile_id, profileName: profile.cute_name, syncedAt: now(), summary };
    if (!await store.saveProfile(next)) return fail('store');
    return { status: 'ok', state: next, fixture: anonymize(profile, state.uuid) };
  }

  return {
    async run(pick) {
      if (busy) return { status: 'busy' };
      busy = true;
      try {
        return await attempt(pick);
      } finally {
        busy = false;
      }
    },
  };
}

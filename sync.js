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
    res = await get(`https://api.hypixel.net/v2/skyblock/profiles?uuid=${uuid}`, { headers: { 'API-Key': key }, cache: 'no-store', redirect: 'error' });
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

const MESSAGES = {
  nokey: 'Add your API key first.',
  keyread: 'Key could not be read – try again',
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
  // Raised by Remove and a new UUID: a run that started before must not write its old answer back.
  let generation = 0;
  const fail = (error, extra = {}) => ({ status: 'error', error, ...extra });

  async function attempt(pick, token) {
    const state = await store.loadProfile();
    if (!state?.uuid) return fail('nouuid');
    let key;
    try {
      key = await store.getApiKey();
    } catch {
      return fail('keyread');
    }
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
      // the items of another profile must not stay behind under this one
      summary = await summarize(profile.members[state.uuid], profile.profile_id === state.profileId ? state.summary ?? null : null);
    } catch {
      return fail('format');
    }
    const next = { uuid: state.uuid, profileId: profile.profile_id, profileName: profile.cute_name, syncedAt: now(), summary, ...(state.statsInput && (!state.profileId || profile.profile_id === state.profileId) && { statsInput: state.statsInput }) };
    if (token !== generation) return { status: 'stale' };
    if (!await store.saveProfile(next)) return fail('store');
    return { status: 'ok', state: next };
  }

  return {
    invalidate() {
      generation++;
    },
    async run(pick) {
      if (busy) return { status: 'busy' };
      busy = true;
      const token = generation;
      try {
        const result = await attempt(pick, token);
        return token === generation ? result : { status: 'stale' };
      } finally {
        busy = false;
      }
    },
  };
}

const DAY = 86400e3;
const REMINDER_DAYS = 21;
const API_NAMES = { inventory: 'API: Inventory', collections: 'API: Collections', skills: 'API: Skills' };

function seenLine(s, esc) {
  const count = (...where) => s.items.filter((i) => where.includes(i.where)).length;
  return `Seen: ${count('armor')} armor, ${count('equipment')} equipment, ${count('wardrobe')} wardrobe, ${count('inventory', 'ender', 'backpack', 'vault')} storage, ${count('accessory')} accessories, ${s.pets.length} pets${s.mp === null ? '' : ` · MP ${esc(s.mp)}`}${s.skipped ? ` · ${esc(s.skipped)} skipped` : ''}`;
}

// The line above the guides: when the last sync was, what it found, and what the player has to do about it.
export function syncView(state, now, esc, { message = '', choices = [] } = {}) {
  const days = state?.syncedAt ? Math.floor((now - state.syncedAt) / DAY) : null;
  const off = Object.keys(API_NAMES).filter((k) => state?.summary?.missing?.[k]).map((k) => API_NAMES[k]);
  const lines = days === null
    ? ['Not synced yet. Add your UUID and key in the settings.']
    : [
      `${esc(state.profileName)} · ${days ? `${days} d ago` : 'today'}`,
      seenLine(state.summary, esc),
      // a stand saved by an older version has no shards or perks yet
      ...(state.summary?.attrs === undefined ? ['Sync once more to read your shards and perks.'] : []),
      ...(off.length ? [`Turn on ${off.join(', ')} in SkyBlock Menu → Settings → API Settings.`] : []),
      ...(days >= REMINDER_DAYS ? ['Sync soon: Hypixel can disable an API application after 28 days without a request.'] : []),
    ];
  const picks = choices.map((c) => `<button type="button" data-sync-pick="${esc(c.id)}">${esc(c.name)} (${c.members})</button>`).join('');
  return `<section class="guide-sync" aria-label="Profile sync"><div class="actions"><button type="button" data-sync="run" class="primary">Sync profile</button>${picks}</div>${lines.map((l) => `<small>${l}</small>`).join('')}<small role="status">${esc(message)}</small></section>`;
}

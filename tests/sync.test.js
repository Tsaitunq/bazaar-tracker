import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUuid, cleanKey, fetchProfiles, eligibleProfiles, chooseProfile, anonymize, syncMessage, createSync } from '../sync.js';

const U = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const MATE = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const dashed = (u) => `${u.slice(0, 8)}-${u.slice(8, 12)}-${u.slice(12, 16)}-${u.slice(16, 20)}-${u.slice(20)}`;
const json = (status, body, headers = {}) => ({ status, ok: status < 400, headers: { get: (k) => headers[k] ?? null }, json: async () => body });

const coopProfile = {
  profile_id: 'profileid', cute_name: 'CuteName', selected: true, banking: { balance: 1, transactions: [{ initiator_name: MATE }] }, community_upgrades: {},
  members: {
    [U]: { player_id: U, ref: dashed(U), profile: { coop_invitation: { invited_by: MATE } }, friend: dashed(MATE), inventory: { x: 1 } },
    [MATE]: { player_id: MATE, inventory: { secret: 'mate stuff' } },
  },
};

test('normalizeUuid accepts dashes and rejects the rest', () => {
  assert.equal(normalizeUuid(dashed(U).toUpperCase()), U);
  assert.equal(normalizeUuid(` ${U} `), U);
  assert.equal(normalizeUuid('notch'), null);
  assert.equal(normalizeUuid(''), null);
});

test('a pasted key is trimmed', () => {
  assert.equal(cleanKey('  abc\n'), 'abc');
  assert.equal(cleanKey(' '), null);
});

test('fetchProfiles sends the key as a header, never caches and never puts it in the url', async () => {
  let seen;
  const out = await fetchProfiles({ uuid: U, key: 'K', get: async (url, o) => { seen = { url, o }; return json(200, { success: true, profiles: [{ a: 1 }] }); } });
  assert.equal(seen.url, `https://api.hypixel.net/v2/skyblock/profiles?uuid=${U}`);
  assert.deepEqual(seen.o, { headers: { 'API-Key': 'K' }, cache: 'no-store' });
  assert.deepEqual(out, { ok: true, profiles: [{ a: 1 }] });
});

test('HTTP errors map to error classes', async () => {
  const run = (get) => fetchProfiles({ uuid: U, key: 'K', get });
  assert.deepEqual(await run(async () => json(403, {})), { ok: false, error: 'key' });
  assert.deepEqual(await run(async () => json(400, {})), { ok: false, error: 'input' });
  assert.deepEqual(await run(async () => json(422, {})), { ok: false, error: 'input' });
  assert.deepEqual(await run(async () => json(429, {}, { 'RateLimit-Reset': '42' })), { ok: false, error: 'limit', retryIn: 42 });
  assert.deepEqual(await run(async () => { throw new Error('offline'); }), { ok: false, error: 'network' });
  assert.deepEqual(await run(async () => json(503, {})), { ok: false, error: 'network' });
  assert.deepEqual(await run(async () => json(200, { success: false })), { ok: false, error: 'format' });
  assert.deepEqual(await run(async () => ({ status: 200, ok: true, json: async () => { throw new Error('not json'); } })), { ok: false, error: 'format' });
});

test('a player without profiles is no error', async () => {
  assert.deepEqual(await fetchProfiles({ uuid: U, key: 'K', get: async () => json(200, { success: true, profiles: null }) }), { ok: true, profiles: [] });
});

test('no message contains the key or uuid', () => {
  for (const error of ['nokey', 'nouuid', 'key', 'input', 'limit', 'none', 'network', 'format', 'store']) {
    const text = syncMessage(error, 5);
    assert.ok(text.length > 0);
    assert.ok(!text.includes(U) && !text.includes('K3Y'));
  }
  assert.match(syncMessage('limit', 42), /42 s/);
  assert.equal(syncMessage('network'), 'No connection to Hypixel.');
});

test('normal profiles with this member only', () => {
  const mine = (extra = {}, member = {}) => ({ members: { [U]: member }, ...extra });
  const keep = mine({ cute_name: 'Keep' });
  const list = [keep, { members: { [MATE]: {} } }, mine({}, { profile: { deletion_notice: { timestamp: 1 } } }), mine({ game_mode: 'ironman' }), mine({ game_mode: 'bingo' }), mine({ game_mode: 'stranded' })];
  assert.deepEqual(eligibleProfiles(list, U), [keep]);
  assert.deepEqual(eligibleProfiles(null, U), []);
});

test('chooseProfile: saved id, then selected, then ask', () => {
  const a = { profile_id: 'a' }, b = { profile_id: 'b', selected: true }, c = { profile_id: 'c' };
  assert.deepEqual(chooseProfile([a, b], 'a'), { profile: a });
  assert.deepEqual(chooseProfile([a, b], 'gone'), { profile: b });
  assert.deepEqual(chooseProfile([a, c], 'gone'), { choices: [a, c] });
  assert.deepEqual(chooseProfile([a], null), { profile: a });
  assert.deepEqual(chooseProfile([], 'a'), { none: true });
});

test('anonymize keeps only this member and removes coop traces', () => {
  const copy = anonymize(coopProfile, U);
  const out = JSON.stringify(copy);
  for (const secret of [U, dashed(U), MATE, dashed(MATE), 'profileid', 'CuteName', 'banking', 'coop_invitation', 'mate stuff']) assert.ok(!out.includes(secret), secret);
  assert.deepEqual(Object.keys(copy.members), ['self']);
  assert.equal(copy.members.self.inventory.x, 1);
  // the input stays as it was
  assert.ok(coopProfile.members[U].profile.coop_invitation);
});

function setup({ state = { uuid: U }, key = 'K3Y', get, summarize = async () => ({ seen: 1 }), now = () => 1e9 } = {}) {
  const saved = [];
  let calls = 0;
  const sync = createSync({
    store: { getApiKey: async () => key, loadProfile: async () => state, saveProfile: async (s) => { saved.push(s); return true; } },
    get: async (...a) => { calls++; return (get ?? (async () => json(200, { success: true, profiles: [coopProfile] })))(...a); },
    now,
    summarize,
  });
  return { sync, saved, calls: () => calls };
}

test('a successful run stores the summary and no coop mate', async () => {
  let member;
  const { sync, saved } = setup({ summarize: async (m) => { member = m; return { seen: 1 }; } });
  const result = await sync.run();
  assert.equal(result.status, 'ok');
  assert.deepEqual(member, coopProfile.members[U]);
  assert.deepEqual(saved[0], { uuid: U, profileId: 'profileid', profileName: 'CuteName', syncedAt: 1e9, summary: { seen: 1 } });
  assert.ok(!JSON.stringify(saved).includes(MATE));
});

test('the copy for checking is anonymous already when the run returns', async () => {
  const { fixture } = await setup().sync.run();
  const out = JSON.stringify(fixture);
  assert.ok(!out.includes(U) && !out.includes(MATE));
  assert.ok(fixture.members.self);
});

test('the previous summary reaches summarize', async () => {
  let previous;
  await setup({ state: { uuid: U, summary: { old: 1 } }, summarize: async (_, p) => { previous = p; return {}; } }).sync.run();
  assert.deepEqual(previous, { old: 1 });
});

test('a missing key or uuid sends no request', async () => {
  const noKey = setup({ key: null });
  assert.deepEqual(await noKey.sync.run(), { status: 'error', error: 'nokey' });
  const noUuid = setup({ state: null });
  assert.deepEqual(await noUuid.sync.run(), { status: 'error', error: 'nouuid' });
  assert.equal(noKey.calls() + noUuid.calls(), 0);
});

test('a second run while one is busy sends no second request', async () => {
  const { sync, calls } = setup();
  const [a, b] = await Promise.all([sync.run(), sync.run()]);
  assert.equal(a.status, 'ok');
  assert.deepEqual(b, { status: 'busy' });
  assert.equal(calls(), 1);
});

test('a run within 60 s of the last success sends no request', async () => {
  const { sync, calls } = setup({ state: { uuid: U, syncedAt: 1e9 - 20e3 } });
  assert.deepEqual(await sync.run(), { status: 'error', error: 'limit', retryIn: 40 });
  assert.equal(calls(), 0);
  assert.equal((await setup({ state: { uuid: U, syncedAt: 1e9 - 60e3 } }).sync.run()).status, 'ok');
});

test('an error keeps the stored state', async () => {
  const { sync, saved } = setup({ get: async () => json(403, {}) });
  assert.deepEqual(await sync.run(), { status: 'error', error: 'key' });
  assert.deepEqual(saved, []);
});

test('an unreadable member keeps the stored state', async () => {
  const { sync, saved } = setup({ summarize: async () => { throw new Error('broken'); } });
  assert.deepEqual(await sync.run(), { status: 'error', error: 'format' });
  assert.deepEqual(saved, []);
});

test('no normal profile is an error of its own', async () => {
  const { sync } = setup({ get: async () => json(200, { success: true, profiles: [] }) });
  assert.deepEqual(await sync.run(), { status: 'error', error: 'none' });
});

test('several profiles without a selected one ask, and the pick is used', async () => {
  const p = (id) => ({ profile_id: id, cute_name: id.toUpperCase(), members: { [U]: {}, [MATE]: {} } });
  const { sync, saved } = setup({ get: async () => json(200, { success: true, profiles: [p('a'), p('b')] }) });
  assert.deepEqual(await sync.run(), { status: 'choose', choices: [{ id: 'a', name: 'A', members: 2 }, { id: 'b', name: 'B', members: 2 }] });
  assert.equal(saved.length, 0);
  assert.equal((await sync.run('b')).status, 'ok');
  assert.equal(saved[0].profileId, 'b');
});

test('a remembered profile that is gone is asked again, not guessed', async () => {
  const p = (id) => ({ profile_id: id, cute_name: id, members: { [U]: {} } });
  const { sync } = setup({ state: { uuid: U, profileId: 'gone' }, get: async () => json(200, { success: true, profiles: [p('a'), p('b')] }) });
  assert.equal((await sync.run()).status, 'choose');
});

test('a profile that cannot be stored is reported', async () => {
  const sync = createSync({
    store: { getApiKey: async () => 'K', loadProfile: async () => ({ uuid: U }), saveProfile: async () => false },
    get: async () => json(200, { success: true, profiles: [coopProfile] }), now: () => 1e9, summarize: async () => ({}),
  });
  assert.deepEqual(await sync.run(), { status: 'error', error: 'store' });
});

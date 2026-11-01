import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { normalizeUuid, cleanKey, fetchProfiles, eligibleProfiles, chooseProfile, syncMessage, createSync, syncView } from '../sync.js';
import { esc } from '../render.js';
import { exportData } from '../progress.js';

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
  assert.deepEqual(seen.o, { headers: { 'API-Key': 'K' }, cache: 'no-store', redirect: 'error' });
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

test('the previous summary reaches summarize', async () => {
  let previous;
  await setup({ state: { uuid: U, profileId: 'profileid', summary: { old: 1 } }, summarize: async (_, p) => { previous = p; return {}; } }).sync.run();
  assert.deepEqual(previous, { old: 1 });
});

test('the previous summary stays behind when the profile or UUID changed', async () => {
  for (const state of [{ uuid: U, profileId: 'other', summary: { old: 1 } }, { uuid: U }]) {
    let previous = 'not called';
    await setup({ state, summarize: async (_, p) => { previous = p; return {}; } }).sync.run();
    assert.equal(previous, null);
  }
});

test('a run overtaken by Remove or a new UUID stores nothing', async () => {
  let answer;
  const body = json(200, { success: true, profiles: [coopProfile] });
  const { sync, saved } = setup({ get: () => (answer ? body : new Promise((resolve) => { answer = resolve; })) });
  const running = sync.run();
  while (!answer) await new Promise((resolve) => setImmediate(resolve));
  sync.invalidate();
  answer(body);
  assert.deepEqual(await running, { status: 'stale' });
  assert.deepEqual(saved, []);
  assert.equal((await sync.run()).status, 'ok');
  assert.equal(saved.length, 1);
});

test('a missing key or uuid sends no request', async () => {
  const noKey = setup({ key: null });
  assert.deepEqual(await noKey.sync.run(), { status: 'error', error: 'nokey' });
  const noUuid = setup({ state: null });
  assert.deepEqual(await noUuid.sync.run(), { status: 'error', error: 'nouuid' });
  assert.equal(noKey.calls() + noUuid.calls(), 0);
});

test('a key that cannot be read stops the run with its own message', async () => {
  let calls = 0;
  const sync = createSync({
    store: { getApiKey: async () => { throw new Error('could not read the key'); }, loadProfile: async () => ({ uuid: U }), saveProfile: async () => true },
    get: async () => { calls++; }, now: () => 1e9, summarize: async () => ({}),
  });
  const result = await sync.run();
  assert.deepEqual(result, { status: 'error', error: 'keyread' });
  assert.equal(syncMessage(result.error), 'Key could not be read – try again');
  assert.equal(calls, 0);
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

const DAY = 86400e3;
const summary = {
  items: [...Array(4).fill({ where: 'armor' }), ...Array(3).fill({ where: 'equipment' }), { where: 'wardrobe' }, { where: 'ender' }, { where: 'backpack' }, ...Array(2).fill({ where: 'accessory' })],
  pets: [{}, {}], mp: 823, missing: { inventory: false, collections: false, skills: false },
};
const synced = { uuid: U, profileName: 'Apple', syncedAt: 1000 * DAY, summary };

test('syncView shows age, profile and what was seen', () => {
  const html = syncView(synced, 1000 * DAY + 3 * DAY, esc);
  assert.match(html, /data-sync="run"/);
  assert.match(html, /Apple/);
  assert.match(html, /3 d ago/);
  assert.match(html, /Seen: 4 armor, 3 equipment, 1 wardrobe, 2 storage, 2 accessories, 2 pets · MP 823/);
  assert.ok(!html.includes(U));
});

test('syncView says when nothing was synced yet', () => {
  assert.match(syncView(null, 0, esc), /Not synced yet/);
  assert.match(syncView({ uuid: U }, 0, esc), /Not synced yet/);
});

test('syncView warns after 21 days without a sync', () => {
  assert.ok(!syncView(synced, 1000 * DAY + 20 * DAY, esc).includes('28 days'));
  assert.match(syncView(synced, 1000 * DAY + 21 * DAY, esc), /28 days/);
});

test('syncView names a switched-off API with the menu path', () => {
  const html = syncView({ ...synced, summary: { ...summary, missing: { inventory: true, collections: true, skills: false } } }, 1000 * DAY, esc);
  assert.match(html, /API: Inventory, API: Collections/);
  assert.match(html, /SkyBlock Menu → Settings → API Settings/);
  assert.ok(!html.includes('API: Skills'));
});

test('syncView shows a message and the profiles to pick', () => {
  const html = syncView(synced, 1000 * DAY, esc, { message: 'Syncing…', choices: [{ id: 'a', name: 'Pear', members: 2 }] });
  assert.match(html, /Syncing…/);
  assert.match(html, /data-sync-pick="a"[^>]*>Pear \(2\)/);
});

test('syncView shows what was skipped and escapes API values', () => {
  assert.match(syncView({ ...synced, summary: { ...summary, skipped: 2 } }, 1000 * DAY, esc), /2 skipped/);
  assert.ok(!syncView(synced, 1000 * DAY, esc).includes('skipped'));
  assert.ok(!syncView({ ...synced, summary: { ...summary, mp: '<img src=x>' } }, 1000 * DAY, esc).includes('<img'));
});

test('syncView escapes profile names', () => {
  const html = syncView({ ...synced, profileName: '<img src=x>' }, 1000 * DAY, esc, { choices: [{ id: '"x', name: '<b>', members: 1 }] });
  assert.ok(!html.includes('<img') && !html.includes('<b>') && !html.includes('"x'));
});

test('export after a sync has no key, uuid or profile data', () => {
  const out = JSON.parse(exportData([{ id: 'g', title: 'G', sections: [] }], { g: ['a'] }));
  assert.deepEqual(Object.keys(out), ['type', 'guides', 'progress']);
  assert.match(readFileSync('app.js', 'utf8'), /exportData\(guides\(\), guideChecks\)/);
});

test('the key header exists only in sync.js and nothing logs or stores there', () => {
  const web = readdirSync('.').filter((f) => f.endsWith('.js') || f === 'index.html');
  assert.deepEqual(web.filter((f) => readFileSync(f, 'utf8').includes('API-Key')), ['sync.js']);
  for (const f of ['sync.js', 'profile.js', 'nbt.js']) {
    const src = readFileSync(f, 'utf8');
    assert.ok(!src.includes('console.') && !src.includes('localStorage'), f);
  }
  const java = readFileSync('android/app/src/main/java/com/tsaitunq/bazaarflip/ProfileStore.java', 'utf8');
  assert.ok(!java.includes('util.Log') && !java.includes('printStackTrace'));
});

test('the temporary field-check parts are gone', () => {
  const files = [...readdirSync('.').filter((f) => f.endsWith('.js') || f === 'index.html'), 'android/app/src/main/java/com/tsaitunq/bazaarflip/AlertsPlugin.java'];
  for (const f of files) assert.ok(!/shareFixture|Share test copy|anonymize/.test(readFileSync(f, 'utf8')), f);
  assert.ok(!existsSync('scripts/check-fixture.mjs'));
});

test('a stand saved before shards were read asks for one more sync', () => {
  const note = 'Sync once more to read your shards and perks.';
  const old = { ...synced, summary: { ...synced.summary } };
  delete old.summary.attrs;
  assert.ok(syncView(old, 1000 * DAY, esc).includes(note));
  assert.ok(!syncView({ ...synced, summary: { ...synced.summary, attrs: null } }, 1000 * DAY, esc).includes(note));
});

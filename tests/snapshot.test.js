import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { runSnapshot, runExtras, retry } from '../scripts/snapshot.mjs';
import { restoreTiming, backupTiming } from '../scripts/timing-backup.mjs';
import { itemIds, lowestBins, fetchLowestBins } from '../scripts/auctions.mjs';
import { compactElection } from '../scripts/election.mjs';
import { shardOf, dayKey } from '../history.js';
import { skyTime } from '../events.js';

const prod = () => ({ sell_summary: [{ pricePerUnit: 100 }], buy_summary: [{ pricePerUnit: 200 }] });
const T0 = Date.UTC(2026, 9, 9, 12);
const withDir = (fn) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bt-'));
  try { fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
};
const readJson = (...p) => JSON.parse(fs.readFileSync(path.join(...p), 'utf8'));

test('two runs append to the shard file; 16 files per day', () => withDir((dir) => {
  runSnapshot(dir, { X: prod() }, T0);
  runSnapshot(dir, { X: prod() }, T0 + 20 * 60000);
  const day = path.join(dir, 'h', dayKey(T0));
  assert.equal(fs.readdirSync(day).length, 16);
  const c = readJson(day, `${shardOf('X')}.json`);
  assert.equal(c.t.length, 2);
  assert.deepEqual(c.p.X, [[100, 100], [200, 200]]);
}));

test('id with colon lands in its shard', () => withDir((dir) => {
  runSnapshot(dir, { 'INK_SACK:4': prod() }, T0);
  const c = readJson(dir, 'h', dayKey(T0), `${shardOf('INK_SACK:4')}.json`);
  assert.ok(c.p['INK_SACK:4']);
}));

test('old day folders are pruned', () => withDir((dir) => {
  for (const d of ['2026-09-30', '2026-10-02']) fs.mkdirSync(path.join(dir, 'h', d), { recursive: true });
  runSnapshot(dir, { X: prod() }, T0);
  assert.ok(!fs.existsSync(path.join(dir, 'h', '2026-09-30')));
  assert.ok(fs.existsSync(path.join(dir, 'h', '2026-10-02')));
}));

test('the week\'s volume per item is collected next to the prices, one file per day', () => withDir((dir) => {
  const withVolume = (bought, sold) => ({ ...prod(), quick_status: { buyMovingWeek: bought, sellMovingWeek: sold } });
  fs.mkdirSync(path.join(dir, 'v'), { recursive: true });
  for (const d of ['2026-09-30', '2026-10-02']) fs.writeFileSync(path.join(dir, 'v', `${d}.json`), '{}');
  runSnapshot(dir, { X: withVolume(5000, 7000), BARE: prod() }, T0);
  runSnapshot(dir, { X: withVolume(5100, 6900), BARE: prod() }, T0 + 20 * 60000);
  const v = readJson(dir, 'v', `${dayKey(T0)}.json`);
  assert.deepEqual(v.t, [Math.round(T0 / 60000), Math.round(T0 / 60000) + 20]);
  assert.deepEqual(v.p.X, [[5000, 5100], [7000, 6900]]);
  // a product without volume numbers keeps its place, so the columns stay aligned
  assert.deepEqual(v.p.BARE, [[null, null], [null, null]]);
  // pruned like the price folders, and the prices do not change shape
  assert.deepEqual(fs.readdirSync(path.join(dir, 'v')).sort(), ['2026-10-02.json', `${dayKey(T0)}.json`]);
  assert.deepEqual(readJson(dir, 'h', dayKey(T0), `${shardOf('X')}.json`).p.X, [[100, 100], [200, 200]]);
  assert.equal(fs.readdirSync(path.join(dir, 'h', dayKey(T0))).length, 16);
}));

test('scores need 12 points', () => withDir((dir) => {
  for (let i = 0; i < 2; i++) runSnapshot(dir, { X: prod() }, T0 + i * 20 * 60000);
  assert.ok(!('X' in readJson(dir, 'scores.json').s));
  for (let i = 2; i < 12; i++) runSnapshot(dir, { X: prod() }, T0 + i * 20 * 60000);
  assert.equal(readJson(dir, 'scores.json').s.X, 100);
}));

test('stats.json has score, median and hours; scores.json is still written', () => withDir((dir) => {
  const base = Date.UTC(2026, 9, 9, 6);
  for (let i = 0; i < 13; i++) runSnapshot(dir, { X: prod() }, base + i * 20 * 60000);
  const stats = readJson(dir, 'stats.json');
  assert.deepEqual(stats.i.X, [100, 200, 4, null]);
  assert.equal(stats.t, Math.round((base + 12 * 20 * 60000) / 60000));
  assert.equal(readJson(dir, 'scores.json').s.X, 100);
}));

test('timing.json: medians around an event are added, earlier runs are kept', () => withDir((dir) => {
  const start = skyTime(519, 7, 29); // Spooky Festival
  const candy = (price) => ({ GREEN_CANDY: { sell_summary: [{ pricePerUnit: 1 }], buy_summary: [{ pricePerUnit: price }] } });
  fs.writeFileSync(path.join(dir, 'timing.json'), JSON.stringify({ t: 1, r: { 'event:spooky': [{ s: 5, e: 6, b: 4, a: 7, p: { GREEN_CANDY: [1, 2, 3] } }] } }));
  runSnapshot(dir, candy(100), start - 20 * 60000);
  runSnapshot(dir, candy(140), start + 20 * 60000);
  runSnapshot(dir, candy(90), start + 60 * 60000);
  const runs = readJson(dir, 'timing.json').r['event:spooky'];
  assert.deepEqual(runs.map((r) => r.p.GREEN_CANDY), [[1, 2, 3], [100, 140, null]]);
  // a file that cannot be read is not replaced by an empty one
  fs.writeFileSync(path.join(dir, 'timing.json'), '{"r":');
  assert.throws(() => runSnapshot(dir, candy(90), start + 80 * 60000));
  assert.equal(fs.readFileSync(path.join(dir, 'timing.json'), 'utf8'), '{"r":');
}));

test('timing backup: one dated copy per week, restore takes the newest readable one', () => withDir((dir) => {
  const data = path.join(dir, 'data');
  const backup = path.join(dir, 'backup');
  const day = 86400000;
  const timing = (t) => JSON.stringify({ t, r: { 'event:spooky': [] } });
  // nothing to restore from and nothing to copy yet
  assert.equal(restoreTiming(data, backup), null);
  assert.equal(backupTiming(data, backup, T0), null);

  fs.mkdirSync(data);
  fs.writeFileSync(path.join(data, 'timing.json'), timing(1));
  assert.equal(backupTiming(data, backup, T0), 'timing-2026-10-09.json');
  fs.writeFileSync(path.join(data, 'timing.json'), timing(2));
  assert.equal(backupTiming(data, backup, T0 + 6 * day), null);
  assert.equal(backupTiming(data, backup, T0 + 7 * day), 'timing-2026-10-16.json');
  assert.deepEqual(fs.readdirSync(backup).sort(), ['timing-2026-10-09.json', 'timing-2026-10-16.json']);
  // a good file is left alone
  assert.equal(restoreTiming(data, backup), null);
  assert.equal(readJson(data, 'timing.json').t, 2);

  // broken: not copied, and replaced by the newest backup
  fs.writeFileSync(path.join(data, 'timing.json'), '{"r":');
  assert.equal(backupTiming(data, backup, T0 + 30 * day), null);
  assert.equal(restoreTiming(data, backup), 'timing-2026-10-16.json');
  assert.equal(readJson(data, 'timing.json').t, 2);

  // missing, and the newest backup is broken itself: the one before it is used
  fs.rmSync(path.join(data, 'timing.json'));
  fs.writeFileSync(path.join(backup, 'timing-2026-10-16.json'), '');
  assert.equal(restoreTiming(data, backup), 'timing-2026-10-09.json');
  assert.equal(readJson(data, 'timing.json').t, 1);
}));

// an item as the auctions endpoint sends it: gzipped NBT with the SkyBlock id in a string tag named "id"
const nbt = (id, extra = '') => zlib.gzipSync(Buffer.concat([
  Buffer.from([10, 0, 0, 2, 0, 2, 0x69, 0x64, 1, 21]), // the numeric minecraft id comes first and is not a string
  Buffer.from(extra),
  Buffer.from([8, 0, 2, 0x69, 0x64, 0, id.length]), Buffer.from(id),
  Buffer.from([0]),
])).toString('base64');
const bin = (id, price, more = {}) => ({ bin: true, starting_bid: price, item_bytes: nbt(id), ...more });

test('itemIds finds the SkyBlock id and survives broken data', () => {
  assert.deepEqual(itemIds(nbt('MITHRIL_DRILL_1', 'lore with id in it')), ['MITHRIL_DRILL_1']);
  assert.deepEqual(itemIds({ type: 0, data: nbt('X') }), ['X']);
  assert.deepEqual(itemIds('not gzip'), []);
  assert.deepEqual(itemIds(undefined), []);
});

test('lowestBins keeps the cheapest BIN of wanted items and ignores bids', () => {
  const wanted = new Set(['DRILL', 'LANTERN']);
  const out = lowestBins([
    bin('DRILL', 900), bin('DRILL', 700), bin('DRILL', 800),
    bin('OTHER', 1), bin('LANTERN', 50, { bin: false }), bin('LANTERN', 0),
  ], wanted);
  assert.deepEqual(out, { DRILL: 700 });
  assert.deepEqual(lowestBins([bin('DRILL', 650), bin('LANTERN', 40)], wanted, out), { DRILL: 650, LANTERN: 40 });
});

test('fetchLowestBins reads every page once; one failing page rejects everything', async () => {
  const pages = [[bin('DRILL', 900)], [bin('DRILL', 500)], [bin('DRILL', 700)]];
  const asked = [];
  const getPage = async (n) => { asked.push(n); return { totalPages: 3, auctions: pages[n] }; };
  assert.deepEqual(await fetchLowestBins(getPage, new Set(['DRILL']), 2), { DRILL: 500 });
  assert.deepEqual(asked, [0, 1, 2]);
  await assert.rejects(fetchLowestBins(async (n) => { if (n === 2) throw new Error('HTTP 500'); return getPage(n); }, new Set(['DRILL'])));
});

const election = readJson('tests', 'fixtures', 'election.json');

test('compactElection keeps mayor, perks and minister without colour codes', () => {
  const e = compactElection(election, 5);
  assert.equal(e.t, 5);
  assert.equal(e.mayor.name, 'Paul');
  assert.equal(e.mayor.year, 518);
  assert.deepEqual(e.mayor.perks[0], { name: 'Marauder', text: 'Dungeon reward chests are 20% cheaper.' });
  assert.equal(e.mayor.minister.name, 'Cole');
  assert.equal(e.mayor.minister.perk.name, 'Mining Fiesta');
  assert.ok(!JSON.stringify(e).includes('§'));
  assert.equal(e.mayor.minister.perk.text, 'Gain +25 Mining Wisdom, +25% Mining Fortune, and collect Refined Minerals and Glossy Gemstones from mining!');
  assert.equal(e.vote, null);
  assert.throws(() => compactElection({ success: true }, 5));
});

test('compactElection lists the candidates of a running election', () => {
  const e = compactElection({ ...election, current: { year: 519, candidates: election.mayor.election.candidates } }, 5);
  assert.equal(e.vote.year, 519);
  assert.deepEqual(e.vote.candidates[0], { name: 'Cole', votes: 612905, perks: ['Prospection', 'Mining Fiesta'], minister: 'Mining Fiesta' });
  // the perk each candidate would bring along as minister
  assert.deepEqual(e.vote.candidates.slice(1, 3).map((c) => [c.name, c.minister]), [['Aatrox', 'Pathfinder'], ['Paul', 'Benediction']]);
  const bare = compactElection({ ...election, current: { year: 519, candidates: [{ name: 'Diana', votes: 1, perks: [{ name: 'Lucky!' }] }] } }, 5);
  assert.equal(bare.vote.candidates[0].minister, null);
});

test('runExtras writes election.json and ah.json; a failure keeps the old file', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bt-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  t.mock.method(console, 'error', () => {}); // the failing round reports itself
  fs.writeFileSync(path.join(dir, 'forge.json'), JSON.stringify({ t: 1, r: { DRILL: { n: 1, d: 60, h: 2, i: { PLATE: 1 } }, REFINED: { n: 1, d: 60, h: 2, i: { PLATE: 2 } } } }));
  const get = async (url) => (url.includes('election') ? election : { totalPages: 1, auctions: [bin('DRILL', 700), bin('REFINED', 5)] });
  assert.deepEqual(await runExtras(dir, new Set(['PLATE', 'REFINED']), 9, get), ['election', 'ah']);
  // REFINED is a bazaar item, so its auctions are not looked at
  assert.deepEqual(readJson(dir, 'ah.json'), { t: 9, p: { DRILL: 700 } });
  assert.equal(readJson(dir, 'election.json').mayor.name, 'Paul');

  const failing = async () => { throw new Error('HTTP 503'); };
  assert.deepEqual(await runExtras(dir, new Set(['PLATE', 'REFINED']), 10, failing), []);
  assert.equal(readJson(dir, 'ah.json').t, 9);
  assert.equal(readJson(dir, 'election.json').t, 9);
});

test('retry runs a failing call again and gives up after the last wait', async () => {
  let calls = 0;
  assert.equal(await retry(async () => { if (++calls < 3) throw new Error('terminated'); return 'ok'; }, [0, 0]), 'ok');
  assert.equal(calls, 3);
  calls = 0;
  await assert.rejects(retry(async () => { calls++; throw new Error('HTTP 500'); }, [0, 0]), /HTTP 500/);
  assert.equal(calls, 3);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { runSnapshot, runExtras, retry } from '../scripts/snapshot.mjs';
import { itemIds, lowestBins, fetchLowestBins } from '../scripts/auctions.mjs';
import { compactElection } from '../scripts/election.mjs';
import { shardOf, dayKey } from '../history.js';

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
  assert.deepEqual(e.vote.candidates[0], { name: 'Cole', votes: 612905, perks: ['Prospection', 'Mining Fiesta'] });
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

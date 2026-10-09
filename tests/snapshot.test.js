import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runSnapshot } from '../scripts/snapshot.mjs';
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

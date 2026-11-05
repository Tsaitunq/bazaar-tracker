import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { clean, OUTPUTS } from '../../scripts/clean.mjs';

test('clean removes the named outputs and leaves everything else, personal/ included', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bt-clean-'));
  try {
    for (const d of ['apps/bazaar/www', 'apps/guide/www-guide', '_site', 'personal', 'apps/guide/img']) fs.mkdirSync(path.join(root, d), { recursive: true });
    assert.deepEqual(clean(root), ['apps/bazaar/www', 'apps/guide/www-guide', '_site']);
    for (const d of ['personal', 'apps/guide/img']) assert.ok(fs.existsSync(path.join(root, d)), d);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('clean refuses a path that leaves the repo or is the repo', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bt-clean-'));
  try {
    assert.throws(() => clean(root, ['../x']), /refusing/);
    assert.throws(() => clean(root, ['.']), /refusing/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('no output is a source folder', () => {
  for (const d of OUTPUTS) assert.ok(/www|build|shots|_site/.test(d), d);
});

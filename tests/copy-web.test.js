import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { copyWeb } from '../scripts/copy-web.mjs';

test('copyWeb copies the app shell and icons, nothing else', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'bt-www-'));
  try {
    fs.writeFileSync(path.join(out, 'stale.txt'), 'x');
    copyWeb('.', out);
    for (const f of ['index.html', 'app.js', 'style.css', 'icons/icon-192.png', 'icons/icon-512.png']) {
      assert.ok(fs.existsSync(path.join(out, f)), f);
    }
    for (const f of ['sw.js', 'tests', 'node_modules', 'scripts', 'stale.txt']) {
      assert.ok(!fs.existsSync(path.join(out, f)), f);
    }
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test('copyWeb takes private guides along with an index, and needs none', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bt-root-'));
  const out = path.join(root, 'www');
  try {
    fs.writeFileSync(path.join(root, 'sw.js'), "const SHELL = ['a.html'];");
    fs.writeFileSync(path.join(root, 'a.html'), '');
    fs.mkdirSync(path.join(root, 'icons'));
    copyWeb(root, out);
    assert.ok(!fs.existsSync(path.join(out, 'personal')));
    fs.mkdirSync(path.join(root, 'personal', 'guides'), { recursive: true });
    fs.writeFileSync(path.join(root, 'personal', 'guides', 'g.json'), '{}');
    fs.writeFileSync(path.join(root, 'personal', 'guides', 'note.txt'), 'x');
    copyWeb(root, out);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out, 'personal', 'guides', 'index.json'))), ['g.json']);
    assert.ok(fs.existsSync(path.join(out, 'personal', 'guides', 'g.json')));
    assert.ok(!fs.existsSync(path.join(out, 'personal', 'guides', 'note.txt')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

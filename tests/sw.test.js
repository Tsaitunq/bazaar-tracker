import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const src = readFileSync(new URL('sw.js', root), 'utf8');
const shell = [...src.match(/const SHELL = \[([^\]]*)\]/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

test('SHELL lists only existing files', () => {
  for (const f of shell) assert.ok(f === './' || existsSync(new URL(f, root)), f);
});

test('SHELL holds every file the app imports, plus html and css, and no code of the guide app', () => {
  const seen = new Set();
  const walk = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const m of readFileSync(new URL(file, root), 'utf8').matchAll(/from '\.\/([^']+)'/g)) walk(m[1]);
  };
  walk('app.js');
  for (const f of [...seen, 'index.html', 'style.css']) assert.ok(shell.includes(f), f);
  for (const f of ['progress.js', 'optimizer.js', 'stats.js', 'sync.js', 'detect.js']) assert.ok(!seen.has(f) && !shell.includes(f), f);
});

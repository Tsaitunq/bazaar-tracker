import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const src = readFileSync(new URL('sw.js', root), 'utf8');
const shell = [...src.match(/const SHELL = \[([^\]]*)\]/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

test('SHELL lists only existing files', () => {
  for (const f of shell) assert.ok(f === './' || existsSync(new URL(f, root)), f);
});

test('SHELL contains every root .js file except sw.js, plus html and css', () => {
  const js = readdirSync(root).filter((f) => f.endsWith('.js') && f !== 'sw.js');
  for (const f of [...js, 'index.html', 'style.css']) assert.ok(shell.includes(f), f);
});

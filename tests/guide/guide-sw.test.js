import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const guideDir = join(root, 'apps', 'guide');
const src = readFileSync(join(guideDir, 'sw.js'), 'utf8');
const shell = [...src.match(/const SHELL = \[([^\]]*)\]/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

// Everything apps/guide/app.js pulls in, as paths relative to apps/guide/.
function closure(file, seen = new Set()) {
  if (seen.has(file)) return seen;
  seen.add(file);
  for (const m of readFileSync(file, 'utf8').matchAll(/^(?:import|export)\s[^;]*?from\s+'(\.[^']+)'/gm)) closure(normalize(join(dirname(file), m[1])), seen);
  return seen;
}

test('the worker shell lists only existing files', () => {
  for (const f of shell) assert.ok(f === './' || existsSync(join(guideDir, f)), f);
});

test('the worker shell covers the import closure of apps/guide/app.js', () => {
  const files = [...closure(join(guideDir, 'app.js'))].map((f) => relative(guideDir, f).replaceAll('\\', '/'));
  assert.ok(files.includes('optimizer-data.js'));
  for (const f of files) assert.ok(shell.includes(f), f);
});

test('the worker shell holds the page, its style and fonts', () => {
  for (const f of ['index.html', 'guide.css', 'brand.json', 'changelog.json', 'manifest.webmanifest', 'fonts/space-grotesk-latin-400-normal.woff2']) assert.ok(shell.includes(f), f);
});

test('the worker shell holds every game data file', () => {
  for (const f of ['stats', 'hotm', 'attributes', 'power', 'pets']) assert.ok(shell.includes(`../../gamedata/${f}.json`), f);
});

test('the app pulls no market view', () => {
  const files = [...closure(join(guideDir, 'app.js'))].map((f) => relative(root, f).replaceAll('\\', '/'));
  for (const f of files) assert.ok(!f.startsWith('apps/bazaar/'), f);
});

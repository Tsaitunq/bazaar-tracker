import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const toml = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');

test('wrangler.toml: name, workers.dev on, preview URLs off, no secret', () => {
  assert.match(toml, /^name = "progression-guides-api"$/m);
  assert.match(toml, /^workers_dev = true$/m);
  assert.match(toml, /^preview_urls = false$/m);
  assert.ok(!/HYPIXEL_KEY\s*=/.test(toml));
});

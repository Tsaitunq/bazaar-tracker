// Plausibility of the detail categories against the values the player read in the game (personal/fixtures/audit-*.json, made by
// scripts/guide/audit-to-fixture.mjs from the exported deviations). Needs the private fixtures (personal/, not in git): skipped without them.
// An entry with open: false must match the game within 0.1; open entries are known deviations and only counted. Failures name area.stat.category, never a value.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { summarize } from '../../apps/guide/import/profile.js';
import { statDetail } from '../../apps/guide/stats-model.js';
import { compare } from '../../apps/guide/audit.js';
import { gamedata, emptyBuild } from '../fixtures/guide-world.js';

const dir = new URL('../../personal/fixtures/', import.meta.url);
const read = (name) => JSON.parse(fs.readFileSync(new URL(name, dir), 'utf8'));
const audits = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^audit-.*\.json$/.test(f)) : [];
const have = audits.length > 0 && fs.existsSync(new URL('api-profile.json', dir)) && fs.existsSync(new URL('../items.json', dir));

test('closed audit entries match the game', { skip: !have && 'no private audit fixtures' }, async () => {
  const profile = await summarize(read('api-profile.json'), gamedata);
  const items = JSON.parse(fs.readFileSync(new URL('../items.json', dir), 'utf8')).r;
  const world = { guides: [], checks: {}, owned: [], build: emptyBuild(), base: {}, draft: {}, gamedata, items, now: 2e12, profile, audit: {} };
  const wrong = [];
  let closed = 0;
  let open = 0;
  for (const file of audits) {
    for (const e of read(file).entries) {
      if (e.open !== false) { open++; continue; }
      closed++;
      const sum = statDetail(world, e.area, e.stat)?.groups.find((g) => g.title === e.category)?.sum ?? 0;
      if (!compare(sum, e.game)?.ok) wrong.push(`${e.area}.${e.stat}.${e.category}`);
    }
  }
  console.log(`audit entries: ${closed} closed, ${open} open`);
  assert.deepEqual(wrong, [], 'these categories differ from the game');
});

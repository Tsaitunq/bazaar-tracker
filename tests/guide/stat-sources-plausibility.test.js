// Plausibility of the summed sources against the player's own /stats. Needs the private fixtures (personal/, not in git): skipped without them.
// The sum has no gear and no potions, so it must not exceed /stats by more than the values that are unsafe. Failures name the stat, never a value.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { summarize } from '../../apps/guide/import/profile.js';
import { statsModel } from '../../apps/guide/stats-model.js';
import { calcFor } from '../../apps/guide/sources.js';
import { gamedata, emptyBuild } from '../fixtures/guide-world.js';

const file = (name) => new URL(`../../personal/${name}`, import.meta.url);
const have = ['fixtures/api-profile.json', 'fixtures/stats-ingame.json', 'items.json'].every((f) => fs.existsSync(file(f)));
const read = (name) => JSON.parse(fs.readFileSync(file(name), 'utf8'));
const num = (text) => Number(String(text).replace(/,/g, ''));

test('the sum of the known sources does not exceed /stats beyond the unsafe values', { skip: !have && 'no private fixtures' }, async () => {
  const profile = await summarize(read('fixtures/api-profile.json'), gamedata);
  const ingame = read('fixtures/stats-ingame.json');
  const items = read('items.json').r;
  const world = { guides: [], checks: {}, owned: [], build: emptyBuild(), base: {}, draft: {}, gamedata, items, now: 2e12, profile };
  const calc = calcFor(world);
  assert.ok(calc, 'the sources are worked out');
  let compared = 0;
  const over = [];
  for (const [area, typed] of Object.entries(ingame)) {
    const m = statsModel(world, area);
    for (const [stat, value] of Object.entries(typed)) {
      if (typeof value !== 'number') continue;
      const r = m.rows.find((x) => x.id === stat);
      if (!r) continue;
      const total = r.total === '–' ? 0 : num(r.total);
      const unsafe = (calc.contrib[stat] ?? []).filter((c) => c.unsafe && c.value > 0).reduce((n, c) => n + c.value, 0);
      compared++;
      if (total - value > unsafe + 0.01) over.push(`${area}.${stat}`);
    }
  }
  assert.ok(compared >= 10, `only ${compared} stats compared`);
  assert.deepEqual(over, [], 'these stats are summed higher than /stats allows: a table or a rule is wrong');
});

// Gear of the private profile: Mining Fortune and Mining Speed from gear are the sum of the tooltip values of the worn armor, the drill and the equipment.
// Needs the private fixtures (personal/, not in git): skipped without them. Failures name stats and counts, no values.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { summarize } from '../../apps/guide/import/profile.js';
import { gearOf } from '../../apps/guide/gear.js';
import { miningSettings } from '../../apps/guide/optimizer.js';
import { gamedata } from '../fixtures/guide-world.js';

const file = (name) => new URL(`../../personal/${name}`, import.meta.url);
const have = ['fixtures/api-profile.json', 'items.json'].every((f) => fs.existsSync(file(f)));
const read = (name) => JSON.parse(fs.readFileSync(file(name), 'utf8'));
const ARMOR = ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'];
const EQUIPMENT = ['NECKLACE', 'CLOAK', 'BELT', 'GLOVES', 'BRACELET'];
const TOOLS = ['DRILL', 'PICKAXE', 'GAUNTLET'];

test('mining gear = the tooltip values of the worn armor, the drill and the equipment', { skip: !have && 'no private fixtures' }, async () => {
  const profile = await summarize(read('fixtures/api-profile.json'), gamedata);
  const items = read('items.json').r;
  const cat = (i) => items[i.id]?.category;
  const worn = profile.items.filter((i) => i.tip && i.at.includes('Getragen') && (ARMOR.includes(cat(i)) || EQUIPMENT.includes(cat(i))));
  const speed = (i) => i.tip.MINING_SPEED ?? 0;
  const drill = profile.items.filter((i) => i.tip && TOOLS.includes(cat(i))).sort((a, b) => speed(b) - speed(a))[0];
  assert.ok(worn.length && drill, `worn pieces ${worn.length}, drill ${drill ? 1 : 0}`);
  const pieces = [...worn, drill];
  const g = gearOf({ guides: [], checks: {}, owned: pieces.map((i) => i.id), items, area: 'mining', build: null, settings: miningSettings(), real: profile.items });
  const bad = [];
  for (const stat of ['MINING_FORTUNE', 'MINING_SPEED']) {
    // one piece per slot counts, like the loadout: the strongest of its category
    const expected = g.pieces.reduce((n, p) => n + (p.tip?.[stat] ?? 0), 0);
    if (Math.abs((g.gear[stat] ?? 0) - expected) > 0.01) bad.push(stat);
  }
  assert.deepEqual(bad, [], 'gear differs from the sum of the tooltip values');
  assert.ok(g.pieces.filter((p) => p.source === 'game').length >= 3, 'the pieces carry their tooltip');
});

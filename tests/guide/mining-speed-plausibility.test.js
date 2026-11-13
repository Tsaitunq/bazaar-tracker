// Mining Speed of the private profile against what the game showed (personal/fixtures/mining-speed-ingame.json): the total and every category above it.
// Needs the private fixtures (personal/, not in git): skipped without them. Failures name the category, never a value.
// _stale: parts the profile fixture cannot match because the game moved on (here the drill's engine); they are only reported. Refresh the fixture, then empty the list.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { summarize } from '../../apps/guide/import/profile.js';
import { statDetail } from '../../apps/guide/stats-model.js';
import { gamedata, emptyBuild } from '../fixtures/guide-world.js';

const file = (name) => new URL(`../../personal/${name}`, import.meta.url);
const have = ['fixtures/api-profile.json', 'fixtures/mining-speed-ingame.json', 'items.json'].every((f) => fs.existsSync(file(f)));
const read = (name) => JSON.parse(fs.readFileSync(file(name), 'utf8'));
const ARMOR = ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'];
const EQUIPMENT = ['NECKLACE', 'CLOAK', 'BELT', 'GLOVES', 'BRACELET'];
const TOOLS = ['DRILL', 'PICKAXE', 'GAUNTLET'];
const num = (text) => Number(String(text).replace(/,/g, ''));

// The loadout the player mines in: the wardrobe set and the equipment set with the most Mining Speed on their tooltips, and the strongest drill.
function loadout(profile, items) {
  const cat = (i) => items[i.id]?.category;
  const speed = (i) => i.tip?.MINING_SPEED ?? 0;
  const best = (pattern, cats) => {
    const sets = new Map();
    for (const i of profile.items) for (const at of i.at ?? []) if (pattern.test(at) && cats.includes(cat(i))) sets.set(at, [...(sets.get(at) ?? []), i]);
    return [...sets.values()].sort((a, b) => b.reduce((n, i) => n + speed(i), 0) - a.reduce((n, i) => n + speed(i), 0))[0] ?? [];
  };
  const drill = profile.items.filter((i) => i.tip && TOOLS.includes(cat(i))).sort((a, b) => speed(b) - speed(a))[0];
  return [...best(/^Wardrobe Set/, ARMOR), ...best(/^Equipment-Set/, EQUIPMENT), ...(drill ? [drill] : [])];
}

test('Mining Speed: the total and every category match the game, except the stale ones', { skip: !have && 'no private fixtures' }, async () => {
  const want = read('fixtures/mining-speed-ingame.json');
  const full = await summarize(read('fixtures/api-profile.json'), gamedata);
  const items = read('items.json').r;
  const worn = loadout(full, items);
  assert.ok(worn.length >= 9, `loadout pieces ${worn.length}`);
  const profile = { ...full, items: [...full.items.filter((i) => i.at?.some((a) => /Accessory Bag/.test(a))), ...worn.map((i) => ({ ...i, at: ['Getragen'] }))] };
  const build = { ...emptyBuild(), hotm: { tier: full.hotm.tier, levels: full.hotm.levels, omelette: false, disabled: full.hotm.disabled, ability: full.hotm.ability }, attrs: full.attrLevels, essence: full.essence, ...want.build, buffs: { godPotion: true, boosterCookie: false } };
  const world = { guides: [], checks: {}, owned: [...new Set(worn.map((i) => i.id))], build, base: {}, draft: {}, gamedata, items, now: 2e12, profile, audit: {} };
  const d = statDetail(world, want.area, want.stat);
  const stale = new Set(want._stale ?? []);
  const wrong = [];
  const late = [];
  const check = (name, got, expected) => { if (Math.abs(got - expected) > 0.051) (stale.has(name) ? late : wrong).push(name); };
  for (const [category, expected] of Object.entries(want.categories)) {
    const group = d.groups.find((g) => g.title === category);
    check(category, group?.sum ?? 0, expected);
    for (const [label, value] of Object.entries(want.lines[category] ?? {})) {
      // a line is looked for by its name; a gear piece holds its parts one level down
      const all = (group?.lines ?? []).flatMap((l) => [l, ...(l.parts ?? [])]);
      const hit = all.filter((l) => l.label.startsWith(label)).reduce((n, l) => n + l.value, 0);
      check(`${category}/${label}`, hit, value);
    }
  }
  check('total', num(d.total), want.total);
  if (late.length) console.log(`stale fixture, still differs: ${late.join(', ')}`);
  assert.deepEqual(wrong, [], 'these categories differ from the game');
});

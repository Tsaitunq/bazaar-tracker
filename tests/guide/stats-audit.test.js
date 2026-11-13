import test from 'node:test';
import assert from 'node:assert/strict';
import { sourcesOf } from '../../apps/guide/sources.js';
import { statDetail } from '../../apps/guide/stats-model.js';
import { statsView } from '../../apps/guide/views/stats.js';
import { setAudit, compare, deviations, exportText, parseExport, auditKey, keyParts } from '../../apps/guide/audit.js';
import { gamedata, emptyBuild } from '../fixtures/guide-world.js';

const ss = gamedata.statSources;

// --- skills and slayers per entry
test('levels carry XP to the next level and the stats of the level; the cap has none left', () => {
  const xp = ss.skills.mining.xpTotal;
  const cap = ss.skills.combat.maxLevel;
  const { levels } = sourcesOf({ profile: { skills: { SKILL_MINING: xp[24] + 100, SKILL_COMBAT: ss.skills.combat.xpTotal[cap - 1] + 5 }, slayer: { zombie: 1000 } }, ss });
  assert.equal(levels.skills.mining.level, 25);
  assert.equal(levels.skills.mining.toNext, xp[25] - xp[24] - 100);
  assert.ok(levels.skills.mining.stats.MINING_FORTUNE.value > 0);
  assert.equal(levels.skills.combat.level, cap);
  assert.equal(levels.skills.combat.toNext, null);
  assert.equal(levels.slayers.zombie.level, 4);
  assert.equal(levels.slayers.zombie.toNext, ss.slayers.zombie.xp.values[4] - 1000);
  assert.equal(levels.slayers.zombie.stats.HEALTH.unsafe, false);
});

test('the per-entry stats are the same numbers the detail lines add up', () => {
  const calc = sourcesOf({ profile: { skills: { SKILL_MINING: ss.skills.mining.xpTotal[24] }, slayer: { blaze: 400000 } }, ss });
  const line = calc.contrib.MINING_FORTUNE.find((c) => c.part === 'skills');
  assert.equal(line.label, 'Mining 25');
  assert.equal(line.value, calc.levels.skills.mining.stats.MINING_FORTUNE.value);
  assert.ok(calc.contrib.HEALTH.some((c) => c.part === 'slayer' && /Blaze slayer 8/.test(c.label)));
});

// --- the audit store
test('setAudit keeps a number per key and drops an empty or invalid field', () => {
  const key = auditKey('mining', 'MINING_FORTUNE', 'Skills');
  let a = setAudit({}, key, '12,5', 7);
  assert.deepEqual(a[key], { value: 12.5, at: 7 });
  a = setAudit(a, key, '', 8);
  assert.deepEqual(a, {});
  assert.deepEqual(setAudit({}, key, 'abc', 1), {});
  assert.deepEqual(keyParts(key), { area: 'mining', stat: 'MINING_FORTUNE', category: 'Skills' });
});

test('compare: green within 0.1, otherwise red; difference is app minus game', () => {
  assert.deepEqual(compare(10.05, 10), { app: 10.05, game: 10, diff: 0.05, ok: true });
  assert.equal(compare(10.1, 10).ok, true);
  assert.equal(compare(10.2, 10).ok, false);
  assert.equal(compare(8, 10).diff, -2);
  assert.equal(compare(8, undefined), null);
});

// --- the two blocks of the detail
const items = {
  DRILL_1: { name: 'Test Drill', category: 'DRILL', tier: 'LEGENDARY', stats: { MINING_SPEED: 100, MINING_FORTUNE: 10 } },
};
const guide = { id: 'g', title: 'Drill guide', area: 'mining', sections: [{ name: 'S', steps: [
  { text: 'Test Drill', detect: { kind: 'owned', on: [['DRILL_1']] } },
  { text: 'Titanium Engine', detect: { kind: 'part', ids: ['TITANIUM_DRILL_ENGINE'], on: [['DRILL_1']] } },
] }] };
const world = (over = {}) => ({ guides: [guide], checks: { g: ['S|Titanium Engine', 'S|Test Drill'] }, owned: ['DRILL_1'], build: emptyBuild(), base: {}, draft: {}, gamedata, items, now: 2e12, profile: null, audit: {}, ...over });

test('detail: base and gear are separate blocks; gear goes guide → category → item → steps', () => {
  const d = statDetail(world(), 'mining', 'MINING_SPEED');
  assert.equal(d.gear.sum, 250);
  const [g] = d.gear.guides;
  assert.equal(g.title, 'Drill guide');
  assert.equal(g.cats[0].title, 'Held Item');
  const item = g.cats[0].items[0];
  assert.equal(item.label, 'Test Drill');
  assert.equal(item.value, 250);
  assert.deepEqual(item.parts.map((p) => [p.label, p.value]), [['Base (Test Drill)', 100], ['Titanium Engine', 150]]);
  assert.equal(d.base.groups.some((x) => x.title === 'Held Item'), false); // no gear in the base
  // the old flat list still holds both blocks
  assert.equal(d.groups.find((x) => x.title === 'Held Item').sum, 250);
});

test('detail: an item with a tooltip counts the tooltip, the difference to the steps shows as the rest according to the game', () => {
  const profile = { fetchedAt: 1, skills: null, slayer: null, skyblockXp: null, items: [{ id: 'DRILL_1', at: ['Getragen'], parts: { engine: 'TITANIUM_DRILL_ENGINE' }, tip: { MINING_SPEED: 300, MINING_FORTUNE: 25 } }] };
  const d = statDetail(world({ profile }), 'mining', 'MINING_SPEED');
  const item = d.gear.guides[0].cats[0].items[0];
  assert.equal(item.value, 300);
  assert.equal(item.parts.at(-1).label, 'Rest according to the game');
  assert.equal(item.parts.at(-1).value, 50);
  assert.equal(d.gear.sum, 300);
});

test('detail: an unticked step adds nothing to the gear', () => {
  const d = statDetail(world({ checks: { g: ['S|Test Drill'] } }), 'mining', 'MINING_SPEED');
  assert.deepEqual(d.gear.guides[0].cats[0].items[0].parts.map((p) => p.value), [100]);
});

const detailPage = (w, stat = 'MINING_SPEED') => statsView(w, { page: 'stats', tab: 'detail', area: 'mining', stat });

test('detail view: base and gear blocks, the gear sum, and base + gear in the total line', () => {
  const html = detailPage(world());
  assert.match(html, /data-block="base"/);
  assert.match(html, /data-block="gear"/);
  assert.match(html, /Gear from guides <small>\+250<\/small>/);
  assert.match(html, /Base \+?-?[\d,.]+ · Gear \+250/);
});

// --- the reconcile mode in the view and the export
test('the "in game" field is there; a typed value shows app, game and a coloured difference', () => {
  assert.match(detailPage(world()), /data-audit="mining\|MINING_SPEED\|Held Item"/);
  const key = auditKey('mining', 'MINING_SPEED', 'Held Item');
  let html = detailPage(world({ audit: { [key]: { value: 250, at: 1 } } }));
  assert.match(html, /c-green" data-audit-result>App 250 · Game 250 · Diff 0</);
  html = detailPage(world({ audit: { [key]: { value: 240, at: 1 } } }));
  assert.match(html, /c-red" data-audit-result>App 250 · Game 240 · Diff \+10</);
  assert.match(html, /data-audit-clear>Clear all \(1\)/);
  assert.match(detailPage(world()), /data-audit-clear disabled/);
});

test('a base category gets the field too', () => {
  const w = world({ profile: { fetchedAt: 1, skills: { SKILL_MINING: ss.skills.mining.xpTotal[24] }, slayer: null, skyblockXp: null, items: [] } });
  const d = statDetail(w, 'mining', 'MINING_FORTUNE');
  assert.ok(d.base.groups.some((g) => g.title === 'Skills'));
  assert.match(detailPage(w, 'MINING_FORTUNE'), /data-audit="mining\|MINING_FORTUNE\|Skills"/);
});

test('deviations list only the differing categories; the export text parses back', () => {
  const audit = {
    [auditKey('mining', 'MINING_SPEED', 'Held Item')]: { value: 240, at: 1 },
    [auditKey('mining', 'MINING_FORTUNE', 'Held Item')]: { value: 25, at: 1 }, // the app has 25 too
  };
  const list = deviations(world({ audit }), audit);
  assert.deepEqual(list, [{ area: 'mining', stat: 'MINING_SPEED', name: 'Mining Speed', category: 'Held Item', app: 250, game: 240 }]);
  const text = exportText(list);
  assert.match(text, /Mining Speed \[mining\/MINING_SPEED\] \| Held Item \| App 250 \| Game 240/);
  assert.deepEqual(parseExport(text), [{ area: 'mining', stat: 'MINING_SPEED', category: 'Held Item', app: 250, game: 240 }]);
  assert.equal(exportText([]), 'Stats audit: no deviations');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { totalFor, statsOf } from '../../apps/guide/totals.js';
import { measure } from '../../apps/guide/build.js';
import { statsModel, statDetail } from '../../apps/guide/stats-model.js';
import { calcFor } from '../../apps/guide/sources.js';
import { statsView } from '../../apps/guide/views/stats.js';
import { gamedata, emptyBuild } from '../fixtures/guide-world.js';

const ss = gamedata.statSources;
const ids = gamedata.stats.stats.map((s) => s.id);
const items = { RING: { category: 'ACCESSORY', stats: { HEALTH: 10, STRENGTH: 8 } } };
const profile = (more = {}) => ({ profileId: 'p', fetchedAt: 1, skills: null, slayer: null, skyblockXp: 12345, items: [{ id: 'RING', at: ['Accessory Bag'], enrichment: null }], ...more });
const world = (build, base, prof = profile()) => ({ guides: [], checks: {}, owned: [], build, base, draft: {}, gamedata, items, now: 2e12, profile: prof });
const row = (m, id) => m.rows.find((r) => r.id === id);
const num = (text) => Number(String(text).replace(/,/g, ''));

test('not measured: the total is base + build + sources (health 100, SkyBlock level 123, one ring)', () => {
  const m = statsModel(world(emptyBuild(), {}), 'blaze');
  assert.equal(num(row(m, 'HEALTH').total), 100 + 123 * 5 + 10);
  assert.equal(num(row(m, 'STRENGTH').total), 24 + 8);
  assert.equal(row(m, 'HEALTH').unsafe, true); // the SkyBlock level is one source
  assert.equal(row(m, 'CRITICAL_CHANCE').unsafe, false); // only the safe base
  assert.ok(m.known.some((k) => k.id === 'HEALTH' && k.unsafe));
  assert.deepEqual(m.other, []);
  assert.equal(m.hasCalc, true);
});

test('without an import nothing changes: no sources, no base, the old buff values', () => {
  const m = statsModel({ ...world(emptyBuild(), {}), profile: null }, 'blaze');
  assert.equal(m.hasCalc, false);
  assert.equal(row(m, 'HEALTH').total, '–');
  const god = statsOf({ ...emptyBuild(), buffs: { godPotion: true, boosterCookie: false } }, gamedata, 'blaze');
  assert.equal(god.add.STRENGTH, 95);
  const withImport = statsOf({ ...emptyBuild(), buffs: { godPotion: true, boosterCookie: false } }, gamedata, 'blaze', undefined, calcFor(world(emptyBuild(), {})));
  assert.equal(withImport.add.STRENGTH, ss.godPotion.stats.STRENGTH.value);
});

test('measured with the import: the total is what was typed, a source that grew counts once', () => {
  const build = emptyBuild();
  const calc = calcFor(world(build, {}));
  const base = measure({}, 'blaze', { values: { HEALTH: 2000, STRENGTH: 500 }, calc: calc.add }, build, 5);
  assert.equal(base.blaze.snapshot.calc.HEALTH, 123 * 5 + 10);
  const now = statsModel(world(build, base), 'blaze');
  assert.equal(num(row(now, 'HEALTH').total), 2000);
  // other = typed minus the sources then minus the base
  const other = now.other.find((o) => o.id === 'HEALTH');
  assert.equal(other.value, 2000 - (123 * 5 + 10) - 100);
  assert.equal(now.assumed, false);
  // 200 SkyBlock XP later: 2 levels, +10 Health, once
  const later = statsModel(world(build, base, profile({ skyblockXp: 12545 })), 'blaze');
  assert.equal(num(row(later, 'HEALTH').total), 2010);
  assert.ok(later.changes.some((c) => c.id === 'HEALTH' && c.parts.includes('Skills, slayers, level, accessories')));
  assert.equal(later.other.find((o) => o.id === 'HEALTH').value, other.value);
});

test('a measurement from before the import counts the sources as they are now and says so', () => {
  const build = emptyBuild();
  const base = measure({}, 'blaze', { values: { HEALTH: 2000 } }, build, 5);
  assert.equal(base.blaze.snapshot.calc, undefined);
  const m = statsModel(world(build, base), 'blaze');
  assert.equal(num(row(m, 'HEALTH').total), 2000);
  assert.equal(m.assumed, true);
  assert.equal(m.other.find((o) => o.id === 'HEALTH').value, 2000 - (123 * 5 + 10) - 100);
});

test('a gap names the unsafe sources behind the stat, a stat without a gap names none', () => {
  const build = emptyBuild();
  const calc = calcFor(world(build, {}));
  const base = measure({}, 'blaze', { values: { HEALTH: 2000, CRITICAL_CHANCE: 30 }, calc: calc.add }, build, 5);
  const m = statsModel(world(build, base), 'blaze');
  const health = m.other.find((o) => o.id === 'HEALTH');
  assert.ok(health.suspects.some((s) => /SkyBlock level 123/.test(s)));
  assert.equal(m.other.find((o) => o.id === 'CRITICAL_CHANCE'), undefined); // the safe base explains all of it
});

test('what could not be counted is listed', () => {
  const m = statsModel(world(emptyBuild(), {}, profile({ items: [{ id: 'NOSTATS', at: ['Accessory Bag'] }], skyblockXp: null })), 'blaze');
  assert.ok(m.unknown.some((t) => /SkyBlock level: not provided/.test(t)));
  assert.ok(m.unknown.some((t) => /Skills API is off/.test(t)));
  assert.ok(m.unknown.some((t) => /1 accessories have no stats.*NOSTATS/.test(t)));
});

test('measure keeps the sources only when it is given them', () => {
  assert.equal('calc' in measure({}, 'blaze', { values: {} }, emptyBuild(), 1).blaze.snapshot, false);
  assert.deepEqual(measure({}, 'blaze', { values: {}, calc: { HEALTH: 5 } }, emptyBuild(), 1).blaze.snapshot.calc, { HEALTH: 5 });
});

test('totalFor without calc is untouched by the new argument', () => {
  const build = emptyBuild();
  const entry = measure({}, 'blaze', { values: { HEALTH: 700 } }, build, 5).blaze;
  const r = totalFor({ area: 'blaze', entry, build, data: gamedata, stats: ids });
  assert.equal(r.total.HEALTH, 700);
});

const page = (w) => statsView(w, { page: 'stats', tab: 'overview', area: 'blaze' });
const withSkills = profile({ skills: { SKILL_MINING: 3022425, SKILL_COMBAT: 3022425, SKILL_CARPENTRY: 50 }, slayer: { zombie: 1000, blaze: 400000 } });

test('stats page: slayers and skills are listed with level, XP to the next level and their stats, only with an import', () => {
  const html = page(world(emptyBuild(), {}, withSkills));
  assert.match(html, /data-levels="slayers"/);
  assert.match(html, /<h2>Skills <small>⌀ 25<\/small>/); // mining 25 and combat 25; carpentry is not in the average
  assert.match(html, /<span>Zombie<\/span><b>4 \/ 9<\/b><small>4,000 XP to next<\/small>/);
  assert.match(html, /<span>Blaze<\/span><b>8 \/ 9<\/b>/);
  assert.match(html, /<span>≈ Strength<\/span><b>\+3<\/b>/); // an unsure stat carries the ≈
  assert.match(html, /SkyBlock level <b>123 \/ 500<\/b>/);
  assert.match(html, /<span>Carpentry<\/span><b>1 \/ 50<\/b>/);
  assert.doesNotMatch(page({ ...world(emptyBuild(), {}), profile: null }), /level-panel/);
});

test('stats page: without the worker field the SkyBlock level says what is missing', () => {
  const html = page(world(emptyBuild(), {}, profile({ skyblockXp: null })));
  assert.doesNotMatch(html, /SkyBlock level <b>/);
  assert.match(html, /deploy the updated worker/);
});

test('stats page: not measured shows the sources text, the unsafe mark and what is not counted', () => {
  const html = page(world(emptyBuild(), {}));
  assert.match(html, /From known sources/);
  assert.match(html, /adds up what the import gives/);
  assert.match(html, /≈ [\d,]+<\/b>/);
  assert.match(html, /<h2>Not counted<\/h2>/);
});

test('stats page: after a measurement the gap lists the unsafe sources behind it', () => {
  const build = emptyBuild();
  const base = measure({}, 'blaze', { values: { HEALTH: 2000 }, calc: calcFor(world(build, {})).add }, build, 5);
  const html = page(world(build, base));
  assert.match(html, /<h2>Other sources<\/h2>/);
  assert.match(html, /Unsafe sources behind it[^<]*SkyBlock level 123/);
  assert.doesNotMatch(html, /From known sources/);
});

test('a measurement older than the import, with a build part, is stale; removing it gives the known sources', () => {
  const build = { ...emptyBuild(), hotm: { tier: 1, levels: { x: 1 }, omelette: false, disabled: [], ability: null }, buffs: { godPotion: true, boosterCookie: false } };
  const base = measure({}, 'blaze', { values: { HEALTH: 500 } }, build, 1e9);
  assert.equal(base.blaze.snapshot.buffs.godPotion, true); // the God Potion switch is in the snapshot
  const w = world(build, base, profile({ fetchedAt: 2e9 }));
  assert.equal(statsModel(w, 'blaze').stale, true);
  assert.match(statsView(w, { tab: 'overview', area: 'blaze' }), /data-stats-remove="blaze"/);
  assert.equal(statsModel(world(build, base, profile({ fetchedAt: 5 })), 'blaze').stale, false);
  const gone = statsModel(world(build, {}, profile({ fetchedAt: 2e9 })), 'blaze');
  assert.equal(gone.measured, null);
  assert.ok(gone.known.length);
});

test('the power tab lists the consumables with the uses entered', () => {
  const w = world({ ...emptyBuild(), consumables: { ore_oats: 3 } }, {});
  const html = statsView(w, { page: 'stats', tab: 'power', area: 'mining' });
  assert.match(html, /data-consumable="ore_oats"[^>]*value="3"/);
  assert.match(html, /Not provided by the API/);
});

test('the stat detail lists the single sources per category, ≈ for unsafe, conditional apart', () => {
  const w = world(emptyBuild(), {});
  const d = statDetail(w, 'blaze', 'HEALTH');
  assert.equal(d.groups.find((g) => g.title === 'Game base').lines[0].value, 100);
  const level = d.groups.find((g) => g.title === 'SkyBlock level').lines[0];
  assert.equal(level.value, 615);
  assert.equal(level.unsafe, true);
  assert.equal(d.groups.find((g) => g.title === 'Accessory Bag').lines[0].value, 10);
  const html = statsView(w, { page: 'stats', tab: 'detail', area: 'blaze', stat: 'HEALTH' });
  assert.match(html, /≈ SkyBlock level 123/);
  assert.match(html, /Game base/);
  assert.match(statsView(w, { page: 'stats', tab: 'overview', area: 'blaze' }), /href="#\/stats\/detail\/blaze\/HEALTH"/);
  assert.equal(statDetail(w, 'blaze', 'NOT_A_STAT'), null);
});

test('with a measurement the detail shows the typed base, the other sources and the changes', () => {
  const build = emptyBuild();
  const base = measure({}, 'blaze', { values: { HEALTH: 1000 }, calc: calcFor(world(build, {})).add }, build, 1e9);
  const d = statDetail(world(build, base, profile({ skyblockXp: 12545 })), 'blaze', 'HEALTH');
  assert.equal(d.groups[0].title, 'Measured base');
  assert.equal(d.groups[0].lines[0].value, 1000);
  assert.ok(d.groups.some((g) => g.title.startsWith('Changes')));
});

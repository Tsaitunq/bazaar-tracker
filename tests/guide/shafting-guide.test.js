import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { validGuide } from '../../apps/guide/progress.js';
import { gemConflicts } from '../../scripts/guide/mining-steps.mjs';

const FILE = 'personal/guides/shafting.json';
const present = existsSync(FILE);
const load = () => JSON.parse(readFileSync(FILE, 'utf8'));
const items = () => JSON.parse(readFileSync('personal/items.json', 'utf8')).r;

test('the private shafting guide holds together', { skip: !present }, () => {
  const guide = load();
  assert.ok(validGuide(guide));
  assert.equal(guide.order, 'fixed');
  assert.equal(guide.preset, 'shafting');
  const ranked = guide.sections.filter((s) => !s.extra).flatMap((s) => s.steps);
  const extra = guide.sections.filter((s) => s.extra).flatMap((s) => s.steps);
  assert.equal(ranked.length, 144); // 98 on the path (two Start here chips), 46 upgrades (14 enchant levels); the essence shop lives in Stats
  assert.equal(extra.length, 12);
  const texts = [...ranked, ...extra].map((s) => s.text);
  assert.equal(new Set(texts).size, texts.length);
  const sizes = new Map();
  for (const s of ranked) if (s.group) sizes.set(s.group, (sizes.get(s.group) ?? 0) + 1);
  assert.deepEqual([...sizes.values()], [6, 4, 4, 7, 7, 2, 2, 2, 2, 4, 4]);
  for (const s of ranked) for (const after of s.after ?? []) assert.ok(texts.includes(after));
  const known = items();
  const ids = ranked.flatMap((s) => [...(s.items ?? []).map((i) => i.id), ...[s.detect ?? []].flat().flatMap((d) => (d.kind === 'owned' ? d.on.flat() : []))]);
  assert.deepEqual([...new Set(ids.filter((id) => !known[id] && !/^(ENCHANTMENT_|ESSENCE_|[A-Z]+_[A-Z]+_GEM$)/.test(id)))], []);
  // shared keys: unique, every Perfect gem is after its Flawless one, no Perfect gem or Recombobulator sits in the fixed path
  const keys = ranked.map((s) => s.key).filter(Boolean);
  assert.equal(new Set(keys).size, keys.length);
  const upgrades = guide.sections.find((x) => x.name.startsWith('Upgrades'));
  assert.equal(upgrades.order, 'value');
  for (const step of upgrades.steps.filter((x) => x.detect.kind === 'gem')) {
    assert.equal(step.detect.quality, 'PERFECT');
    assert.ok(step.after?.length, step.text);
  }
  assert.ok(guide.sections[0].steps.every((x) => x.detect?.kind !== 'recomb' && !(x.detect?.kind === 'gem' && x.detect.quality === 'PERFECT')));
  assert.ok(!ranked.some((x) => x.detect?.kind === 'essence') && !keys.some((k) => k.startsWith('perk:')));
  for (const [old, to] of Object.entries(guide.legacy)) for (const k of [to].flat()) assert.ok(keys.includes(k), `${old} -> ${k}`);
  // one stone per gem slot: no item step carries a stone, no slot twice, every Perfect after its Flawless; the Divan armor is clean
  assert.deepEqual(gemConflicts(guide, known), []);
  for (const id of ['DIVAN_HELMET', 'DIVAN_CHESTPLATE', 'DIVAN_LEGGINGS', 'DIVAN_BOOTS']) {
    const step = ranked.find((x) => x.items?.[0]?.id === id);
    assert.equal(step.gain.PRISTINE, undefined, id);
    assert.deepEqual(guide.ownedKeys[id].length, 2);
  }
  console.log('steps without a price source', ranked.filter((s) => !s.items?.length).length, 'with auto tick', ranked.filter((s) => s.detect).length);
});

test('group g1 lists six parts; the drill line is 700 MS / 25 MF, the total 1230 / 55 / 10 GF / 1 P', { skip: !present }, async () => {
  const { guideModel } = await import('../../apps/guide/model.js');
  const { gamedata, baseOf, emptyBuild } = await import('../fixtures/guide-world.js');
  const { miningSettings } = await import('../../apps/guide/optimizer.js');
  const src = load();
  const guide = { id: 'shafting', ...src, milestones: undefined, sections: [{ name: 'P', steps: src.sections[0].steps.filter((s) => s.group === 'g1') }] };
  const base = baseOf({ mining: { values: { MINING_SPEED: 1000, MINING_FORTUNE: 100, PRISTINE: 0, GEMSTONE_FORTUNE: 0 } } });
  const { card } = guideModel(guide, { marks: new Set(), owned: [], base, build: emptyBuild(), gamedata, products: {}, prices: { items: items() }, settings: miningSettings({ preset: 'shafting' }) });
  assert.equal(card.name, 'DR-X355 + 5 Enchants');
  assert.equal(card.parts.length, 6);
  assert.deepEqual(card.parts[0].stats.map((s) => s.text), ['+700 ⸕ Mining Speed', '+25 ☘ Mining Fortune']);
  assert.deepEqual(card.stats.map((s) => s.text), ['+1,230 ⸕ Mining Speed', '+55 ☘ Mining Fortune', '+10 ☘ Gemstone Fortune', '+1 ✧ Pristine']);
});

test('enchant levels in the Upgrades section: lower levels first, gain is the difference', { skip: !present }, async () => {
  const { guideModel } = await import('../../apps/guide/model.js');
  const { gamedata, baseOf, emptyBuild } = await import('../fixtures/guide-world.js');
  const { miningSettings } = await import('../../apps/guide/optimizer.js');
  const src = load();
  const up = src.sections.find((s) => s.name.startsWith('Upgrades'));
  const enchants = up.steps.filter((s) => s.detect?.kind === 'enchant');
  assert.deepEqual(enchants.map((s) => s.key).filter((k) => k.includes('lapidary')), [2, 3, 4, 5].map((n) => `enchant:drill:lapidary:${n}`));
  const guide = { id: 'shafting', ...src, order: 'value', milestones: undefined, sections: [{ ...up, steps: enchants }] };
  const prices = (id) => ({ buy_summary: [{ pricePerUnit: id.endsWith('_5') ? 1e6 : 1e5, amount: 1e6 }] });
  const products = Object.fromEntries(enchants.flatMap((s) => s.items.map((i) => [i.id, prices(i.id)])));
  const base = baseOf({ mining: { values: { MINING_SPEED: 1000, MINING_FORTUNE: 100, PRISTINE: 0, GEMSTONE_FORTUNE: 0 } } });
  const m = guideModel(guide, { marks: new Set(), owned: [], base, build: emptyBuild(), gamedata, products, prices: { items: items() }, settings: miningSettings({ preset: 'shafting' }) });
  const order = m.rows.map((r) => r.name);
  for (const line of new Set(enchants.map((s) => s.line))) {
    const names = enchants.filter((s) => s.line === line).map((s) => s.text);
    assert.deepEqual(order.filter((n) => names.includes(n)), names, line);
  }
  const eff = enchants.filter((s) => s.line.endsWith('efficiency'));
  assert.ok(eff.every((s) => s.gain.MINING_SPEED === 20));
});

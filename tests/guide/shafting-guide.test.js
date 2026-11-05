import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { validGuide } from '../../apps/guide/progress.js';

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
  assert.equal(ranked.length, 168); // 100 on the path, 32 upgrades, 36 essence shop levels
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
  assert.ok(keys.includes('perk:dwarven_expertise:10') && keys.includes('perk:frozen_skin:5') && keys.includes('perk:cut_loose:5'));
  for (const [old, to] of Object.entries(guide.legacy)) for (const k of [to].flat()) assert.ok(keys.includes(k), `${old} -> ${k}`);
  console.log('steps without a price source', ranked.filter((s) => !s.items?.length).length, 'with auto tick', ranked.filter((s) => s.detect).length);
});

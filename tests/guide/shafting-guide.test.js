import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { validGuide } from '../../progress.js';

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
  assert.equal(ranked.length, 119);
  assert.equal(extra.length, 12);
  const texts = [...ranked, ...extra].map((s) => s.text);
  assert.equal(new Set(texts).size, texts.length);
  const sizes = new Map();
  for (const s of ranked) if (s.group) sizes.set(s.group, (sizes.get(s.group) ?? 0) + 1);
  assert.deepEqual([...sizes.values()], [6, 4, 4, 6, 6, 2, 2, 2, 3, 6, 6]);
  for (const s of ranked) for (const after of s.after ?? []) assert.ok(texts.includes(after));
  const known = items();
  const ids = ranked.flatMap((s) => [...(s.items ?? []).map((i) => i.id), ...[s.detect ?? []].flat().flatMap((d) => (d.kind === 'owned' ? d.on.flat() : []))]);
  assert.deepEqual([...new Set(ids.filter((id) => !known[id] && !/^(ENCHANTMENT_|[A-Z]+_[A-Z]+_GEM$)/.test(id)))], []);
  console.log('steps without a price source', ranked.filter((s) => !s.items?.length).length, 'with auto tick', ranked.filter((s) => s.detect).length);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { validGuide, stepKey } from '../../apps/guide/progress.js';
import { collapseChecks, expandChecks } from '../../apps/guide/keys.js';

// A step renamed or moved keeps its tick: the old mark sits in `legacy` and leads to the step's key.
const guide = validGuide({
  title: 'T', legacy: { 'Old section|Old name': 'g:new.step', 'Pets|Blaze-Pet': 'g:pet', 'Gear|Legendary': 'g:pet' },
  sections: [{ name: 'New section', steps: [{ text: 'New name', key: 'g:new.step' }, { text: 'Pet', key: 'g:pet' }] }],
});
const g = { id: 't', ...guide };

test('a tick from before the rename arrives on the renamed step', () => {
  const { checks, keys } = collapseChecks([g], { t: ['Old section|Old name'] }, []);
  assert.deepEqual(keys, ['g:new.step']);
  assert.deepEqual(checks.t, []);
  assert.ok(expandChecks([g], checks, keys).t.includes(stepKey(g.sections[0], g.sections[0].steps[0])));
});

test('an untick before the rename stays an untick', () => {
  const { keys } = collapseChecks([g], { t: ['undone:Old section|Old name'] }, []);
  assert.deepEqual(keys, ['undone:g:new.step']);
});

test('two old steps that were merged give one tick', () => {
  const { keys } = collapseChecks([g], { t: ['Pets|Blaze-Pet', 'Gear|Legendary'] }, []);
  assert.deepEqual(keys, ['g:pet']);
});

// The private Blaze guide: every old mark leads to a key that a step holds. Skipped where personal/ is absent.
const PRIVATE = 'personal/guides/blaze-slayer.json';
test('every legacy mark of the private Blaze guide reaches a step', { skip: !existsSync(PRIVATE) }, () => {
  const blaze = { id: 'blaze-slayer', ...validGuide(JSON.parse(readFileSync(PRIVATE, 'utf8'))) };
  const keys = new Set(blaze.sections.flatMap((s) => s.steps.map((st) => st.key).filter(Boolean)));
  const old = Object.keys(blaze.legacy);
  assert.ok(old.length > 0);
  const out = collapseChecks([blaze], { 'blaze-slayer': old }, []);
  assert.deepEqual(out.checks['blaze-slayer'], []);
  assert.ok(out.keys.length > 0 && out.keys.every((k) => keys.has(k)), 'a legacy target is no step key');
  const shown = expandChecks([blaze], out.checks, out.keys)['blaze-slayer'];
  for (const s of blaze.sections) for (const st of s.steps) if (st.key && out.keys.includes(st.key)) assert.ok(shown.includes(stepKey(s, st)));
});

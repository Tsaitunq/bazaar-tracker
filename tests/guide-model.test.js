import test from 'node:test';
import assert from 'node:assert/strict';
import { chaptersOf, totalShare, stampDone, unlockedThisWeek } from '../guide/model.js';

const steps = (n, prefix) => Array.from({ length: n }, (_, i) => ({ text: `${prefix}${i}` }));
const guide = (sizes, extra = {}) => ({ sections: sizes.map((n, i) => ({ name: `S${i}`, steps: steps(n, `s${i}-`) })), ...extra });

test('three sections make three chapters', () => {
  const out = chaptersOf(guide([2, 2, 2]), new Set(['S0|s0-0', 'S0|s0-1', 'S1|s1-0']));
  assert.deepEqual(out.map((c) => c.name), ['S0', 'S1', 'S2']);
  assert.deepEqual(out.map((c) => c.share), [1, 0.5, 0]);
});

test('named chapters group their sections', () => {
  const out = chaptersOf(guide([1, 1, 1, 1], { chapters: [{ name: 'A', sections: ['S0', 'S1'] }, { name: 'B', sections: ['S2', 'S3'] }] }), new Set(['S0|s0-0']));
  assert.deepEqual(out.map((c) => [c.name, c.done, c.total]), [['A', 1, 2], ['B', 0, 2]]);
});

test('without chapters a long guide is split in three by step count', () => {
  const out = chaptersOf(guide([5, 5, 5, 5, 5, 5, 0]), new Set());
  assert.equal(out.length, 3);
  assert.deepEqual(out.map((c) => c.total), [10, 10, 10]);
});

test('a guide with less than three steps still gives three arcs', () => {
  const out = chaptersOf(guide([1]), new Set());
  assert.equal(out.length, 3);
  assert.equal(out.reduce((n, c) => n + c.total, 0), 1);
});

test('the current chapter holds the first open step', () => {
  assert.deepEqual(chaptersOf(guide([1, 1, 1]), new Set(['S0|s0-0'])).map((c) => c.current), [false, true, false]);
  assert.deepEqual(chaptersOf(guide([1, 1, 1]), new Set(['S0|s0-0', 'S1|s1-0', 'S2|s2-0'])).map((c) => c.current), [false, false, true]);
});

test('totalShare is done over all steps and 0 for an empty guide', () => {
  assert.equal(totalShare(chaptersOf(guide([1, 1, 2]), new Set(['S0|s0-0']))), 0.25);
  assert.equal(totalShare(chaptersOf(guide([0]), new Set())), 0);
});

test('the first run stamps what is done with 0', () => {
  assert.deepEqual(stampDone({}, new Set(['a']), 100, true), { a: 0 });
});

test('a step done later keeps its first date, undone clears it', () => {
  const first = stampDone({}, new Set(['a']), 100);
  assert.deepEqual(first, { a: 100 });
  assert.deepEqual(stampDone(first, new Set(['a', 'b']), 200), { a: 100, b: 200 });
  assert.deepEqual(stampDone(first, new Set(['b']), 200), { b: 200 });
});

test('unlockedThisWeek counts the last seven days only', () => {
  const week = 7 * 24 * 3600e3;
  assert.equal(unlockedThisWeek({ a: 0, b: 1000, c: week + 2000 }, week + 3000), 1);
  assert.equal(unlockedThisWeek(null, 1), 0);
});

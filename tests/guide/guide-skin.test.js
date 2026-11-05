import { test } from 'node:test';
import assert from 'node:assert/strict';
import { figureRects, isSlim, FIGURE } from '../../apps/guide/skin.js';

test('figure: 12 rects, base layer then clothing, all inside the 16x32 figure and the 64x64 skin', () => {
  for (const slim of [false, true]) {
    const rects = figureRects(slim);
    assert.equal(rects.length, 12);
    for (const r of rects) {
      assert.ok(r.dx >= 0 && r.dy >= 0 && r.dx + r.w <= FIGURE.w && r.dy + r.h <= FIGURE.h, JSON.stringify(r));
      assert.ok(r.sx >= 0 && r.sy >= 0 && r.sx + r.w <= 64 && r.sy + r.h <= 64, JSON.stringify(r));
    }
  }
  const [head, , , , , , hat] = figureRects(false);
  assert.deepEqual([head.sx, head.sy], [8, 8]);
  assert.deepEqual([hat.sx, hat.sy, hat.dx, hat.dy], [40, 8, 4, 0]); // hat layer lands on the head
});

test('figure: slim arms are 3 wide and still touch the body', () => {
  const arms = (slim) => figureRects(slim).slice(2, 4);
  assert.deepEqual(arms(false).map((r) => [r.w, r.dx]), [[4, 0], [4, 12]]);
  assert.deepEqual(arms(true).map((r) => [r.w, r.dx]), [[3, 1], [3, 12]]);
});

test('isSlim: an empty last arm column means slim', () => {
  const classic = () => 255;
  const alex = (x) => (x === 47 ? 0 : 255);
  assert.equal(isSlim(classic), false);
  assert.equal(isSlim(alex), true);
});

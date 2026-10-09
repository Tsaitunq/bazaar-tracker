import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lineChart } from '../chart.js';

const pts = (vs) => vs.map((v, i) => [29000000 + i * 20, v]);

test('lineChart is empty without points', () => {
  assert.equal(lineChart([], {}), '');
  assert.equal(lineChart([{ color: 'red', points: [] }], {}), '');
});

test('lineChart draws one polyline per series with min and max labels', () => {
  const series = [{ color: 'red', points: pts([1, 5, 3]) }, { color: 'blue', points: pts([2, 9, 4]) }];
  const html = lineChart(series, { format: (v) => `<${v}>` });
  assert.equal(html.match(/<polyline/g).length, 2);
  assert.ok(html.includes('&#60;9&#62;') && html.includes('&#60;1&#62;'));
});

test('lineChart survives a single point and constant values', () => {
  for (const p of [pts([5]), pts([5, 5, 5])]) {
    const html = lineChart([{ color: 'red', points: p }], {});
    assert.ok(html.startsWith('<svg'));
    assert.ok(!html.includes('NaN') && !html.includes('Infinity'));
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lineChart, nearestIndex, chartHit } from '../chart.js';

const pts = (vs) => vs.map((v, i) => [29000000 + i * 20, v]);

test('lineChart is empty without points', () => {
  assert.equal(lineChart([], {}), '');
  assert.equal(lineChart([{ label: 'A', cls: 'line-a', points: [] }], {}), '');
});

test('lineChart draws one polyline per series with min and max labels', () => {
  const series = [{ label: 'A', cls: 'line-a', points: pts([1, 5, 3]) }, { label: 'B', cls: 'line-b', points: pts([2, 9, 4]) }];
  const html = lineChart(series, { format: (v) => `<${v}>` });
  assert.equal(html.match(/<polyline/g).length, 2);
  assert.ok(html.includes('&#60;9&#62;') && html.includes('&#60;1&#62;'));
});

test('lineChart survives a single point and constant values', () => {
  for (const p of [pts([5]), pts([5, 5, 5])]) {
    const html = lineChart([{ label: 'A', cls: 'line-a', points: p }], {});
    assert.ok(html.startsWith('<figure') && html.includes('<svg'));
    assert.ok(!html.includes('NaN') && !html.includes('Infinity'));
  }
});

test('lineChart draws four grid lines with values, one when the value is constant', () => {
  const html = lineChart([{ label: 'A', cls: 'line-a', points: pts([10, 40, 20]) }], { format: (v) => `v${v}` });
  assert.equal(html.match(/class="grid"/g).length, 4);
  for (const label of ['v10', 'v20', 'v30', 'v40']) assert.ok(html.includes(`>${label}<`), label);
  assert.equal(lineChart([{ label: 'A', cls: 'line-a', points: pts([5, 5]) }], {}).match(/class="grid"/g).length, 1);
});

test('nearestIndex picks the closest time', () => {
  assert.equal(nearestIndex([10, 20, 30], 9), 0);
  assert.equal(nearestIndex([10, 20, 30], 24), 1);
  assert.equal(nearestIndex([10, 20, 30], 26), 2);
  assert.equal(nearestIndex([10, 20, 30], 99), 2);
});

test('chartHit returns the values at the pointer position', () => {
  const html = lineChart([{ label: 'Buy', cls: 'line-a', points: pts([1, 5, 3]) }, { label: 'Sell', cls: 'line-b', points: pts([2, 9, 4]) }], {});
  const meta = JSON.parse(html.match(/data-chart="([^"]*)"/)[1].replace(/&#(\d+);/g, (_, c) => String.fromCharCode(c)));
  const middle = chartHit(meta, 0.5);
  assert.equal(middle.time, 29000020);
  assert.deepEqual(middle.values, [{ label: 'Buy', value: 5 }, { label: 'Sell', value: 9 }]);
  assert.equal(chartHit(meta, -1).time, 29000000);
  assert.equal(chartHit(meta, 2).time, 29000040);
  assert.ok(middle.x > 8 && middle.x < 332);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trendSlope, direction, level, TREND_FLAT, LEVEL_BAND, TREND_WINDOW_MIN, TREND_MIN_POINTS } from '../trends.js';

// one point every 20 minutes; sell(i) gives the sell price of point i
const series = (n, sell, start = 0) => Array.from({ length: n }, (_, i) => [start + i * 20, 1, sell(i)]);

test('trendSlope is the change per 24 hours relative to the mean price', () => {
  // 73 points span exactly 24 hours; the price climbs from 90 to 110 around a mean of 100
  const up = trendSlope(series(73, (i) => 90 + (20 * i) / 72));
  assert.ok(Math.abs(up - 0.2) < 0.003, String(up));
  assert.ok(Math.abs(trendSlope(series(73, (i) => 110 - (20 * i) / 72)) + 0.2) < 0.003);
  assert.equal(trendSlope(series(73, () => 100)), 0);
});

test('trendSlope only looks at the last 24 hours', () => {
  const old = series(200, () => 500);                          // flat and far higher, but older
  const recent = series(73, (i) => 90 + (20 * i) / 72, 200 * 20);
  assert.ok(Math.abs(trendSlope([...old, ...recent]) - 0.2) < 0.01);
});

test('trendSlope needs enough points over at least 12 hours', () => {
  assert.equal(trendSlope([]), null);
  assert.equal(trendSlope(series(TREND_MIN_POINTS - 1, (i) => i + 1)), null);
  assert.equal(trendSlope(series(30, (i) => i + 1)), null);   // 30 points, but under 10 hours
  assert.notEqual(trendSlope(series(40, (i) => i + 1)), null);
  assert.equal(trendSlope(series(73, () => 0)), null);
});

test('direction and level use the constants', () => {
  assert.deepEqual([TREND_FLAT, LEVEL_BAND, TREND_WINDOW_MIN], [0.03, 0.1, 1440]);
  assert.equal(direction(0.031), 'rising');
  assert.equal(direction(0.03), 'flat');
  assert.equal(direction(-0.03), 'flat');
  assert.equal(direction(-0.031), 'falling');
  assert.equal(direction(null), null);
  assert.equal(direction(undefined), null);
  assert.equal(level(89, 100), 'below');
  assert.equal(level(90, 100), null);
  assert.equal(level(110, 100), null);
  assert.equal(level(111, 100), 'above');
  assert.equal(level(100, 0), null);
  assert.equal(level(undefined, 100), null);
});

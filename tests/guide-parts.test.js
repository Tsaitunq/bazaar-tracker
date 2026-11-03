import test from 'node:test';
import assert from 'node:assert/strict';
import { ring, legend, statGrid, pathRow, stepCard, chips, bottomBar, backLink, icon } from '../guide/views/parts.js';

const chapters = [{ name: 'A', share: 1, current: false }, { name: 'B', share: 0.5, current: true }, { name: 'C', share: 0, current: false }];
const circles = (svg) => [...svg.matchAll(/<circle [^>]*>/g)].map((m) => m[0]);
const attr = (el, name) => el.match(new RegExp(`${name}="([^"]*)"`))?.[1];
const row = (over = {}) => ({ key: 'S|a', name: 'Step', status: 'open', sub: '', subColor: '', side: '', progress: '', api: false, undo: false, railTop: false, railBottom: false, ...over });
const card = (over = {}) => ({ key: 'S|a', name: 'Jade', where: 'Helmet', stats: [{ text: '+8 ☘ Mining Fortune', color: 'orange' }], gain: '+2.4 % yield', cost: '3.9M coins', rate: '0.61 % per 1M', badge: false, hint: '', railTop: true, railBottom: false, ...over });

test('the ring has three arcs with their gap and radius', () => {
  const big = circles(ring({ chapters, total: 0.5, size: 88 }));
  assert.equal(big.length, 6);
  const C = 2 * Math.PI * 36;
  const L = C / 3 - 12;
  assert.equal(attr(big[0], 'r'), '36');
  assert.equal(attr(big[0], 'stroke-width'), '9');
  assert.equal(attr(big[0], 'stroke-dasharray'), `${L.toFixed(1)} ${(C - L).toFixed(1)}`);
  assert.equal(attr(big[2], 'stroke-dashoffset'), (-(C / 3) - 6).toFixed(1));
  const small = circles(ring({ chapters, total: 0.5, size: 70 }));
  assert.equal(attr(small[0], 'r'), '28');
  assert.equal(attr(small[0], 'stroke-width'), '7');
  assert.equal(attr(small[0], 'stroke-dashoffset'), '-5.0');
});

test('an empty chapter still draws its track and a 0.1 fill like the mockup', () => {
  const list = circles(ring({ chapters, total: 0.5, size: 88 }));
  assert.match(list[4], /arc-track/);
  assert.match(attr(list[5], 'stroke-dasharray'), /^0\.1 /);
  assert.match(list[5], /arc-3/);
});

test('the ring shows the total in percent', () => {
  assert.match(ring({ chapters, total: 0.376, size: 88 }), />38%<\/text>/);
});

test('the legend marks the current chapter', () => {
  const html = legend(chapters);
  assert.match(html, /legend-now[^>]*>B</);
  assert.match(html, /<b>50%<\/b>/);
});

test('the stat grid has its columns, colours and delta', () => {
  const stats = [{ icon: '☘', label: 'Fortune', value: '3,459', delta: '+8', color: 'orange' }];
  assert.match(statGrid(stats, 2), /class="stats"/);
  const three = statGrid(stats, 3);
  assert.match(three, /class="stats stats-3"/);
  assert.match(three, /stat-value c-orange">3,459</);
  assert.match(three, /stat-delta">\+8</);
});

test('a row shows its side text, done in green, locked with its reason', () => {
  assert.match(pathRow(row({ side: '0.33 % / 1M' })), /row-side[^>]*>.*0\.33 % \/ 1M/s);
  assert.match(pathRow(row({ status: 'done', side: 'done' })), /row row-done/);
  assert.match(pathRow(row({ status: 'done' })), /dot-done[^>]*>✓/);
  const locked = pathRow(row({ status: 'locked', side: 'locked', sub: 'HOTM 7 needed' }));
  assert.match(locked, /row row-locked/);
  assert.match(locked, /dot-locked/);
  assert.match(locked, /HOTM 7 needed/);
});

test('the line follows the row data', () => {
  const on = pathRow(row({ railTop: true, railBottom: true }));
  assert.match(on, /rail-top rail-on/);
  assert.match(on, /rail-bottom rail-on/);
  assert.doesNotMatch(pathRow(row()), /rail-on/);
});

test('a row can be tapped, and shows have / need with API and an Undo apart from the row', () => {
  assert.match(pathRow(row()), /<button type="button" class="row[^"]*" data-step="S\|a"/);
  const part = pathRow(row({ progress: '3 / 4', api: true }));
  assert.match(part, /3 \/ 4/);
  assert.match(part, /API/);
  assert.doesNotMatch(part, /Undo/);
  const auto = pathRow(row({ status: 'done', api: true, undo: true }));
  assert.match(auto, /<\/button><button type="button" class="undo" data-step="S\|a"[^>]*>Undo</);
});

test('the card shows the hypixel stat, the gain, the cost and the rate', () => {
  const html = stepCard(card());
  assert.match(html, /card-stat c-orange">\+8 ☘ Mining Fortune</);
  assert.match(html, /card-gain">\+2\.4 % yield</);
  assert.match(html, /card-cost">3\.9M coins</);
  assert.match(html, /card-rate">0\.61 % per 1M</);
  assert.match(html, /class="primary" data-step="S\|a">Mark done</);
  assert.match(html, /dot-current/);
});

test('the card has the badge only when told, and drops empty parts', () => {
  assert.doesNotMatch(stepCard(card()), /BEST VALUE/);
  assert.match(stepCard(card({ badge: true })), /★ BEST VALUE/);
  const bare = stepCard(card({ stats: [], gain: '', rate: '' }));
  assert.doesNotMatch(bare, /card-box/);
  assert.doesNotMatch(bare, /card-rate/);
});

test('chips show true defense and power with their state', () => {
  const limits = { trueDefense: 164, mp: 820, minTrueDefense: 140, targetMp: 1100, lowTrueDefense: false, lowMp: false };
  const fine = chips(limits);
  assert.match(fine, /❂ True Def ≥ 140/);
  assert.match(fine, /164 ✓/);
  assert.match(fine, /✦ Power/);
  assert.match(fine, /820 \/ 1,100/);
  assert.doesNotMatch(fine, /chip-low/);
  const low = chips({ ...limits, trueDefense: 100, lowTrueDefense: true, mp: 700, lowMp: true });
  assert.doesNotMatch(low, /✓/);
  assert.equal(low.match(/chip-low/g).length, 2);
  assert.match(chips({ ...limits, trueDefense: null, mp: null }), /unknown.*unknown/s);
});

test('the bar marks the active tab, the back link goes home', () => {
  const html = bottomBar([{ id: 'path', label: 'Path' }, { id: 'best', label: 'Best value' }], 'best');
  assert.match(html, /data-tab="best" aria-current="page">Best value/);
  assert.doesNotMatch(html, /data-tab="path" aria-current/);
  assert.match(backLink(), /class="back" href="#\/"[^>]*>.*Guides/s);
});

test('each area has its icon', () => {
  for (const area of ['mining', 'blaze', 'farming', 'profile']) assert.match(icon(area), /<svg.*<path/s);
  assert.equal(icon('nothing'), '');
});

test('all text is escaped', () => {
  const bad = '<i>"x"';
  const out = [
    ring({ chapters, total: 0, size: 70, label: bad }), legend([{ name: bad, share: 0 }]),
    statGrid([{ icon: bad, label: bad, value: bad, delta: bad, color: 'red' }], 2),
    pathRow(row({ key: bad, name: bad, sub: bad, side: bad, progress: bad })),
    stepCard(card({ key: bad, name: bad, where: bad, stats: [{ text: bad, color: 'red' }], gain: bad, cost: bad, rate: bad, hint: bad })),
    bottomBar([{ id: bad, label: bad }], ''),
  ].join('');
  assert.doesNotMatch(out, /<i>/);
  assert.doesNotMatch(out, /"x"/);
});

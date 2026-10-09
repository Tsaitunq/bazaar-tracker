import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esc, coins, percent, iconUrl, itemHref, icon, scoreBadge, flipCard, npcCard, craftCard, parseRoute } from '../render.js';

const flip = { id: 'A', name: 'Name', buy: 10, sell: 20, profit: 5, margin: 0.1, weekVol: 1000, hourVol: 10, profitHour: 50, score: 80 };

test('esc removes markup characters', () => {
  const s = esc('<b>"x"&');
  assert.ok(!s.includes('<') && !s.includes('"'));
});

test('iconUrl and itemHref encode the id', () => {
  assert.equal(iconUrl('INK_SACK:4'), 'https://sky.coflnet.com/static/icon/INK_SACK%3A4');
  assert.equal(itemHref('INK_SACK:4'), '#/item/INK_SACK%3A4');
});

test('scoreBadge labels', () => {
  assert.equal(scoreBadge(null), '');
  assert.equal(scoreBadge(undefined), '');
  assert.match(scoreBadge(82), /stable.*82/);
  assert.match(scoreBadge(50), /medium/);
  assert.match(scoreBadge(10), /unstable/);
});

test('flipCard escapes, warns and marks favourites', () => {
  const html = flipCard({ ...flip, name: '<i>x</i>', suspicious: true }, true);
  assert.ok(html.includes('&#60;i&#62;') && !html.includes('<i>'));
  assert.ok(html.includes('suspicious'));
  assert.ok(html.includes('aria-pressed="true"'));
  assert.ok(flipCard(flip, false).includes('aria-pressed="false"'));
});

test('star is a sibling of the body link', () => {
  const html = flipCard(flip, false);
  assert.match(html, /<\/button>\s*<a class="body" href="#\/item\/A">/);
});

test('craftCard lists ingredients', () => {
  const html = craftCard({ ...flip, n: 1, cost: 1, revenue: 2, craftsHour: 3, ingredients: [{ id: 'ING', name: 'Ing', qty: 160, price: 10 }] }, false);
  assert.ok(html.includes('160×') && html.includes('Ing'));
});

test('npcCard shows the npc price', () => {
  assert.ok(npcCard({ ...flip, npc: 12345, profitInstant: 1 }, false).includes('12.3k'));
});

test('icon attributes', () => {
  const html = icon('A');
  assert.ok(html.includes('loading="lazy"') && html.includes('crossorigin="anonymous"'));
});

test('parseRoute', () => {
  assert.deepEqual(parseRoute(''), { view: 'flips' });
  assert.deepEqual(parseRoute('#/npc'), { view: 'npc' });
  assert.deepEqual(parseRoute('#/craft'), { view: 'craft' });
  assert.deepEqual(parseRoute('#/item/INK_SACK%3A4'), { view: 'item', id: 'INK_SACK:4' });
  assert.deepEqual(parseRoute('#/quatsch'), { view: 'flips' });
});

test('detailView shows history states, charts, escaping and range', async () => {
  const { detailView } = await import('../render.js');
  const base = { id: 'A', name: 'Name', flip: null, score: 80, isFav: false, range: '24h', tax: 0.0125 };
  const points = [[29000000, 10, 20], [29000020, 11, 22], [29000040, 12, 21]];
  assert.ok(detailView({ ...base, points: [] }).includes('No history yet'));
  assert.ok(detailView({ ...base, points: null }).includes('Loading history…'));
  assert.equal(detailView({ ...base, points }).match(/<svg/g).length, 2);
  assert.ok(!detailView({ ...base, name: '<i>', points }).includes('<i>'));
  assert.match(detailView({ ...base, range: '7d', points }), /data-range="7d"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*data-range="7d"/);
  assert.match(detailView({ ...base, points }), /href="#\/flips"/);
});

test('detailView back link follows the origin tab', async () => {
  const { detailView } = await import('../render.js');
  const base = { id: 'A', name: 'Name', flip: null, score: 80, isFav: false, range: '24h', tax: 0.0125, points: [] };
  assert.ok(detailView({ ...base, back: 'npc' }).includes('href="#/npc"'));
  assert.ok(detailView(base).includes('href="#/flips"'));
});

test('card profit colour follows profit, not profitHour', () => {
  const html = craftCard({ ...flip, profit: 10, profitHour: 0, cost: 1, revenue: 2, craftsHour: 0, ingredients: [] }, false);
  assert.ok(!html.includes('class="loss"'));
});

test('coins formats in Hypixel style with English separators', () => {
  const cases = [
    [0, '0'], [52.74, '52.7'], [1234.5, '1,234.5'], [9999.9, '9,999.9'], [9999.96, '10k'],
    [20767.9, '20.8k'], [350000, '350k'], [999949, '999.9k'], [999950, '1M'], [1200000, '1.2M'],
    [1.5e9, '1.5B'], [-2500000, '-2.5M'], [NaN, '–'],
  ];
  for (const [value, text] of cases) assert.equal(coins(value), text, String(value));
});

test('percent uses an English decimal point', () => {
  assert.equal(percent.format(1.1774), '117.7%');
});

test('parseRoute knows the opportunities tab', () => {
  assert.deepEqual(parseRoute('#/opps'), { view: 'opps' });
});

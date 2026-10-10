import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esc, coins, percent, iconUrl, itemHref, icon, scoreBadge, flipCard, searchCard, npcCard, craftCard, parseRoute } from '../render.js';

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
  assert.equal(detailView({ ...base, points }).match(/class="chart"/g).length, 2);
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

test('provisional replaces the stability badge', () => {
  assert.match(scoreBadge(82, true), /provisional/);
  assert.ok(!scoreBadge(82, true).includes('stable'));
  assert.match(flipCard({ ...flip, score: null, provisional: true }, false), /badge-prov/);
});

test('cards and detail page show the median as "normal"', async () => {
  const { detailView } = await import('../render.js');
  assert.ok(flipCard({ ...flip, median: 12345 }, false).includes('normal: 12.3k'));
  assert.ok(!flipCard({ ...flip, median: null }, false).includes('normal:'));
  const detail = detailView({ id: 'A', name: 'Name', flip, score: 80, median: 12345, provisional: false, isFav: false, range: '24h', tax: 0.0125, points: [] });
  assert.ok(detail.includes('normal: 12.3k'));
});

test('profit per hour and margin are the big numbers on a card', () => {
  const html = flipCard(flip, false);
  assert.match(html, /class="big gain">50<\/span><span class="lbl">Profit\/h/);
  assert.match(html, /class="big">10%<\/span><span class="lbl">Margin/);
  // a favourite that loses money is red, not accent coloured
  assert.match(flipCard({ ...flip, profit: -5, profitHour: -50 }, true), /class="big loss">-50</);
});

test('cards carry a known rarity and the picture sits on a tile', async () => {
  const { rarity, detailView } = await import('../render.js');
  assert.equal(rarity('epic'), 'epic');
  assert.equal(rarity(undefined), 'common');
  assert.equal(rarity('"><script>'), 'common');
  assert.match(flipCard({ ...flip, tier: 'legendary' }, false), /<li class="card" data-rarity="legendary">/);
  assert.match(flipCard(flip, false), /data-rarity="common"/);
  assert.match(flipCard(flip, false), /<span class="tile"><img class="icon"/);
  assert.match(detailView({ id: 'A', name: 'Name', tier: 'mythic', flip: null, isFav: false, range: '24h', tax: 0.0125, points: [] }), /class="detail-head" data-rarity="mythic"/);
});

test('swipeTab: left opens the next tab, right the previous one, no wrap around', async () => {
  const { swipeTab, TABS } = await import('../render.js');
  assert.deepEqual(TABS, ['flips', 'opps', 'npc', 'craft']);
  assert.equal(swipeTab('flips', -80, 5), 'opps');
  assert.equal(swipeTab('opps', 80, -5), 'flips');
  assert.equal(swipeTab('npc', -200, 30), 'craft');
  assert.equal(swipeTab('flips', 80, 0), null);
  assert.equal(swipeTab('craft', -80, 0), null);
  // too short, or more of a scroll than a swipe
  assert.equal(swipeTab('flips', -59, 0), null);
  assert.equal(swipeTab('flips', -80, 41), null);
  assert.equal(swipeTab('flips', -80, 40), 'opps');
});

test('portfolioView shows the total, the picks and the market share assumption', async () => {
  const { portfolioView } = await import('../render.js');
  const plan = {
    budget: 5000000, profitHour: 31000000, used: 42000000,
    flips: [{ id: 'A', name: '<b>Worm</b>', stake: 4900000, profitHour: 3900000 }, { id: 'INK_SACK:4', name: 'Lapis', stake: 5000000, profitHour: 3600000 }],
  };
  const html = portfolioView(plan, { capital: 50000000, slots: 10, sharePercent: 20 });
  assert.match(html, /class="big gain">31M</);
  assert.ok(html.includes('Profit/h with 2 flips'));
  assert.ok(html.includes('Assumes 20% market share – only realistic if you relist actively'));
  assert.ok(html.includes('42M of 50M capital in use'));
  assert.ok(html.includes('4.9M') && html.includes('3.9M/h'));
  assert.ok(html.includes('&#60;b&#62;Worm') && !html.includes('<b>'));
  assert.ok(html.includes('href="#/item/INK_SACK%3A4"'));
  assert.ok(portfolioView({ ...plan, flips: plan.flips.slice(0, 1) }, { capital: 1, slots: 1, sharePercent: 5 }).includes('with 1 flip<'));
});

test('portfolioView explains an empty plan', async () => {
  const { portfolioView } = await import('../render.js');
  const empty = { flips: [], budget: 0, profitHour: 0, used: 0 };
  assert.ok(portfolioView(empty, { capital: 50000000, slots: 10, sharePercent: 5 }).includes('No flip qualifies'));
  assert.ok(portfolioView(empty, { capital: 0, slots: 10, sharePercent: 5 }).includes('Set a total capital'));
});

test('dragOffset follows the finger, with resistance where there is no tab', async () => {
  const { dragOffset } = await import('../render.js');
  assert.equal(dragOffset('flips', -100), -100);
  assert.equal(dragOffset('opps', 100), 100);
  assert.equal(dragOffset('flips', 100), 25);
  assert.equal(dragOffset('craft', -100), -25);
});

test('a search hit outside the list shows why, and still links to its detail page', () => {
  const hidden = searchCard({ ...flip, why: ['Above your max capital', '<b>'] }, false);
  assert.ok(hidden.includes('class="why"') && hidden.includes('Above your max capital · &#60;b&#62;') && hidden.includes('Profit/h'));
  const bare = searchCard({ id: 'BOOSTER_COOKIE', name: 'Booster Cookie', why: ['No buy orders or sell offers right now'] }, false);
  assert.ok(bare.includes('href="#/item/BOOSTER_COOKIE"') && bare.includes('No buy orders') && !bare.includes('Profit/h'));
  assert.ok(!flipCard(flip, false).includes('class="why"'));
});

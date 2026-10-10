import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esc, coins, percent, iconUrl, itemHref, icon, scoreBadge, flipCard, searchCard, npcCard, craftCard, forgeCard, forgeFilter, duration, trendBadge, detailView, radarView, parseRoute } from '../render.js';

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
  assert.deepEqual(TABS, ['flips', 'opps', 'npc', 'craft', 'forge']);
  assert.equal(swipeTab('flips', -80, 5), 'opps');
  assert.equal(swipeTab('opps', 80, -5), 'flips');
  assert.equal(swipeTab('npc', -200, 30), 'craft');
  assert.equal(swipeTab('flips', 80, 0), null);
  assert.equal(swipeTab('craft', -80, 0), 'forge');
  assert.equal(swipeTab('forge', 80, 0), 'craft');
  assert.equal(swipeTab('forge', -80, 0), null);
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
  assert.equal(dragOffset('craft', -100), -100);
  assert.equal(dragOffset('forge', -100), -25);
});

test('a search hit outside the list shows why, and still links to its detail page', () => {
  const hidden = searchCard({ ...flip, why: ['Above your max capital', '<b>'] }, false);
  assert.ok(hidden.includes('class="why"') && hidden.includes('Above your max capital · &#60;b&#62;') && hidden.includes('Profit/h'));
  const bare = searchCard({ id: 'BOOSTER_COOKIE', name: 'Booster Cookie', why: ['No buy orders or sell offers right now'] }, false);
  assert.ok(bare.includes('href="#/item/BOOSTER_COOKIE"') && bare.includes('No buy orders') && !bare.includes('Profit/h'));
  assert.ok(!flipCard(flip, false).includes('class="why"'));
});

test('duration shows the two largest units', () => {
  assert.deepEqual([21600, 5400, 90000, 30, 3661, 0].map(duration), ['6h', '1h 30m', '1d 1h', '30s', '1h 1m', '0s']);
});

const forged = { ...flip, n: 1, cost: 1600, sell: 5000, seconds: 21600, hotm: 4, coins: 0, ah: false, limit: 'sales', ingredients: [{ id: 'ING', name: 'Ing', qty: 160, price: 10 }] };

test('forgeCard shows profit per forge hour, duration, HotM tier and ingredients', () => {
  const html = forgeCard(forged, false);
  for (const part of ['Profit/forge hour', 'Profit/item', 'Sell offer', '<dd>6h</dd>', 'HotM tier', '<dd>4</dd>', '160× Ing @ 10']) assert.ok(html.includes(part), part);
  assert.ok(!html.includes('AH sale') && !html.includes('class="why"'));
  assert.ok(forgeCard({ ...forged, hotm: 0, coins: 50000 }, false).includes('50k coins'));
  assert.equal(parseRoute('#/forge').view, 'forge');
});

test('an auction house result carries the estimate badge and the warning', () => {
  const html = forgeCard({ ...forged, ah: true }, false);
  assert.ok(html.includes('AH sale – estimate') && html.includes('Lowest BIN') && !html.includes('Sell offer'));
  assert.ok(html.includes('slower and less certain than the Bazaar'));
});

test('forgeFilter marks the chosen side', () => {
  assert.match(forgeFilter(true), /data-forge-ah="0" aria-pressed="false"[^]*data-forge-ah="1" aria-pressed="true"/);
  assert.match(forgeFilter(false), /data-forge-ah="0" aria-pressed="true"[^]*data-forge-ah="1" aria-pressed="false"/);
});

test('trend badge: an arrow with the direction, plus the price level when it is off', () => {
  assert.match(trendBadge(0.2, null), /badge-trend.*<svg.*rising/);
  assert.match(trendBadge(-0.2, 'below'), /falling · below normal/);
  assert.match(trendBadge(0, 'above'), /flat · above normal/);
  assert.match(trendBadge(null, 'below'), /badge-trend">below normal/);
  assert.equal(trendBadge(null, null), '');
  assert.equal(trendBadge(undefined, undefined), '');
});

test('cards and the detail page carry the trend badge', () => {
  assert.ok(flipCard({ ...flip, trend: 0.1, level: 'below' }, false).includes('rising · below normal'));
  assert.ok(!flipCard(flip, false).includes('badge-trend'));
  const page = detailView({ id: 'A', name: 'Name', flip, score: 80, median: 20, provisional: false, trend: -0.1, level: null, isFav: false, range: '24h', points: [], tax: 0.0125 });
  assert.ok(page.includes('badge-trend') && page.includes('falling'));
});

test('an event badge marks items that belong to an event or perk', () => {
  const html = flipCard({ ...flip, event: 'Spooky <Festival>' }, false);
  assert.ok(html.includes('badge-event') && html.includes('Spooky &#60;Festival&#62;'));
  assert.ok(!flipCard(flip, false).includes('badge-event'));
});

const HOUR = 3600000;
const radar = (over = {}) => radarView({
  election: { mayor: { name: 'Paul', perks: [{ name: 'Marauder', text: 'Chests are cheaper.' }], minister: { name: 'Cole', perk: { name: 'Mining Fiesta', text: 'Refined Minerals.' } } }, vote: null },
  perks: [{ name: 'Marauder', text: 'Chests are cheaper.', by: 'Paul' }, { name: 'Mining Fiesta', text: 'Refined Minerals.', by: 'Cole, minister' }],
  events: [
    { key: 'zoo', name: 'Traveling Zoo', active: true, start: -HOUR, end: 0.5 * HOUR, items: [] },
    { key: 'spooky', name: 'Spooky Festival', active: false, start: 50 * HOUR, end: 51 * HOUR, items: ['GREEN_CANDY'] },
  ],
  vote: { open: false, at: 30 * HOUR }, now: 0, name: (id) => `<${id}>`, ...over,
});

test('radar: one line when folded, mayor, election and events inside', () => {
  const html = radar();
  assert.ok(html.includes('Mayor Paul · Traveling Zoo now · Spooky Festival in 2d 2h'));
  assert.ok(!html.includes('data-key="radar" open'));
  assert.ok(html.includes('minister Cole') && html.includes('Chests are cheaper.') && html.includes('Cole, minister'));
  assert.ok(html.includes('now · 30m left') && html.includes('in 2d 2h'));
  assert.ok(html.includes('The next one opens in 1d 6h'));
  // items are named, linked and never promised a price move
  assert.ok(html.includes('Typically affected:') && html.includes('href="#/item/GREEN_CANDY"') && html.includes('&#60;GREEN_CANDY&#62;'));
  assert.ok(html.includes('href="#/item/REFINED_MINERAL"'));
});

test('radar: unfolded parts stay open, a running election lists its candidates', () => {
  const html = radar({ open: new Set(['radar', 'event:spooky']) });
  assert.ok(html.includes('data-key="radar" open') && html.includes('data-key="event:spooky" open') && !html.includes('data-key="event:zoo" open'));
  const voting = radar({
    election: { mayor: { name: 'Paul', perks: [], minister: null }, vote: { year: 520, candidates: [{ name: 'Cole', votes: 25, perks: ['Mining Fiesta'] }, { name: 'Diana', votes: 75, perks: ['Pet XP Buff'] }] } },
    perks: [], vote: { open: true, at: 2 * HOUR },
  });
  assert.ok(voting.includes('Election for year 520 · closes in 2h'));
  assert.ok(voting.indexOf('Diana') < voting.indexOf('Cole') && voting.includes('75%') && voting.includes('Pet XP Buff'));
});

test('radar without mayor data still shows the events', () => {
  const html = radar({ election: null, perks: [] });
  assert.ok(html.includes('Mayor data is not available') && html.includes('Spooky Festival'));
  assert.ok(html.includes('Traveling Zoo now · Spooky Festival in 2d 2h') && !html.includes('Mayor undefined'));
});

test('forgeCard says what limits the profit per hour and notes Derpy\'s tax', () => {
  assert.match(forgeCard(forged, false), /Limited by<\/dt><dd>Sales volume/);
  assert.match(forgeCard({ ...forged, limit: 'forge' }, false), /Limited by<\/dt><dd>Forge time/);
  const derpy = forgeCard({ ...forged, ah: true, derpy: true }, false);
  assert.ok(derpy.includes('Mayor Derpy') && derpy.includes('4% instead of 1%') && derpy.includes('slower and less certain'));
  assert.ok(!forgeCard({ ...forged, ah: true, derpy: false }, false).includes('Derpy'));
  assert.ok(!forgeCard({ ...forged, derpy: false }, false).includes('Derpy'));
});

test('the page of an auction house item shows its forge recipe instead of empty charts', () => {
  const page = detailView({ id: 'DRILL', name: 'Drill', flip: null, forge: { ...forged, ah: true, limit: 'forge' }, provisional: false, isFav: false, range: '24h', points: [], tax: 0.0125 });
  for (const part of ['<h3>Forge</h3>', 'AH sale – estimate', 'Lowest BIN', '<dd>5,000</dd>', '160× Ing @ 10', '<dd>6h</dd>', 'HotM tier', '<dd>4</dd>', 'Profit/forge hour', 'slower and less certain']) {
    assert.ok(page.includes(part), part);
  }
  assert.ok(!page.includes('No history yet') && !page.includes('data-range'));
});

test('the page of a bazaar item with a recipe keeps its charts and adds the forge part', () => {
  const page = detailView({ id: 'A', name: 'Name', flip, forge: forged, score: 80, median: 20, provisional: false, isFav: false, range: '24h', points: [], tax: 0.0125 });
  assert.ok(page.includes('<h3>Forge</h3>') && page.includes('Sell offer') && page.includes('data-range') && page.includes('No history yet'));
  assert.ok(!page.includes('AH sale'));
  assert.ok(!detailView({ id: 'A', name: 'Name', flip, provisional: false, isFav: false, range: '24h', points: [], tax: 0.0125 }).includes('<h3>Forge</h3>'));
});

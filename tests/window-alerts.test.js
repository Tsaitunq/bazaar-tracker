// The same cases as the windows tests in AlertLogicTest.java (the views only here).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readWindowAlerts, windowAlerts, windowText } from '../timing.js';
import { windowBanners, detailView, todayView, windowsView } from '../render.js';

const FILE = { t: 1, tax: 0.0125,
  w: [
    { id: 'ORB', key: 'perk:Marauder', driver: 'Paul', s: 50, buyStart: 100, buyEnd: 200, sellStart: 300, sellEnd: 400, spread: 0.2, hits: 9, n: 12, own: 3, backfill: 9 },
    { id: 'SMALL', key: 'event:spooky', driver: 'Spooky', s: 60, buyStart: 100, buyEnd: 200, sellStart: 300, sellEnd: 400, spread: 0.04, hits: 6, n: 6, own: 6, backfill: 0 },
  ],
  a: [{ id: 'TOOTH', key: 'perk:Fishing Festival', driver: 'Marina', s: 700, at: 700, notifyAt: 100, drop: 0.126, hits: 8, n: 12, own: 0, backfill: 8 }],
};
const ALL_ON = { buy: true, sell: true, avoid: true, minSpread: 0.05, favOnly: false, minRuns: 6 };
const BUY = 'buy|ORB|perk:Marauder|50';
const AVOID = 'avoid|TOOTH|perk:Fishing Festival|700';
const keys = (prefs, favs, held, shown, now, file = FILE) =>
  windowAlerts(readWindowAlerts(file), prefs, new Set(favs), held, new Set(shown), now).map((a) => a.k);

test('windows are due in their span above the minimum', () => {
  assert.deepEqual(keys(ALL_ON, ['TOOTH'], {}, [], 99), []);
  // warning first; SMALL is under 5%
  assert.deepEqual(keys(ALL_ON, ['TOOTH'], {}, [], 100), [AVOID, BUY]);
  assert.deepEqual(keys(ALL_ON, ['TOOTH'], {}, [], 200), [AVOID]);
  assert.deepEqual(keys(ALL_ON, ['TOOTH'], {}, [], 700), []);
  // nothing without the switch
  assert.deepEqual(keys({ ...ALL_ON, buy: false }, ['TOOTH'], {}, [], 100), [AVOID]);
  assert.deepEqual(keys({ ...ALL_ON, avoid: false }, ['TOOTH'], {}, [], 100), [BUY]);
  // once per item and window
  assert.deepEqual(keys(ALL_ON, ['TOOTH'], {}, [BUY], 100), [AVOID]);
});

test('a warning only for an item held or a favorite', () => {
  assert.deepEqual(keys(ALL_ON, [], {}, [], 100), [BUY]);
  assert.deepEqual(keys(ALL_ON, ['TOOTH'], {}, [], 100), [AVOID, BUY]);
  assert.deepEqual(keys(ALL_ON, [], { TOOTH: 1 }, [], 100), [AVOID, BUY]);
  // a favorite still needs the min. gain, a held item does not
  assert.deepEqual(keys({ ...ALL_ON, minSpread: 0.5 }, ['TOOTH'], {}, [], 100), []);
  assert.deepEqual(keys({ ...ALL_ON, minSpread: 0.5 }, [], { TOOTH: 1 }, [], 100), [AVOID]);
});

test('favorites only; a held item is reported anyway', () => {
  const favOnly = { ...ALL_ON, favOnly: true };
  assert.deepEqual(keys(favOnly, ['ORB'], {}, [], 100), [BUY]);
  assert.deepEqual(keys(favOnly, [], {}, [], 100), []);
  assert.deepEqual(keys(favOnly, [], { TOOTH: 1 }, [], 100), [AVOID]);
});

test('no alert of any kind from fewer runs than the minimum', () => {
  const few = { ...ALL_ON, minRuns: 13 };
  assert.deepEqual(keys(few, ['TOOTH'], {}, [], 100), []);
  assert.deepEqual(keys(few, [], { ORB: 1 }, [], 300), []);
  // exactly the minimum counts
  assert.deepEqual(keys({ ...ALL_ON, minRuns: 12 }, [], {}, [], 100), [BUY]);
});

const buy = (key, s, from, to, n, hits, spread = 0.2) => ({ id: 'GIFT', key, driver: key, s, buyStart: from, buyEnd: to, sellStart: 900, sellEnd: 950, spread, hits, n });
const buysOf = (w, shown, now) => keys({ ...ALL_ON, sell: false }, [], {}, shown, now, { w, a: [] });

test('one buy per item for overlapping drivers: most runs, then hit rate, then gain', () => {
  const season = 'buy|GIFT|season|1';
  const shop = 'buy|GIFT|shop|2';
  // more runs wins, even with the worse rate and starting later
  const w = [buy('season', 1, 100, 200, 6, 6), buy('shop', 2, 150, 250, 15, 11)];
  assert.deepEqual(buysOf(w, [], 120), []);
  assert.deepEqual(buysOf(w, [], 160), [shop]);
  // equal runs: the better rate, then the bigger gain
  assert.deepEqual(buysOf([buy('season', 1, 100, 200, 6, 4), buy('shop', 2, 100, 200, 6, 5)], [], 100), [shop]);
  assert.deepEqual(buysOf([buy('season', 1, 100, 200, 6, 5, 0.3), buy('shop', 2, 100, 200, 6, 5)], [], 100), [season]);
  // the winner below the minimum runs does not block the other
  assert.deepEqual(buysOf([buy('season', 1, 100, 200, 6, 6), buy('shop', 2, 100, 200, 5, 5)], [], 100), [season]);
  // one already shown stands, so the better one that came later stays quiet
  assert.deepEqual(buysOf(w, [season], 160), []);
  // no overlap, or another item: both
  assert.deepEqual(buysOf([buy('season', 1, 100, 200, 6, 6), buy('shop', 2, 200, 300, 15, 11)], [], 100), [season]);
  assert.deepEqual(buysOf([buy('season', 1, 100, 200, 6, 6), buy('shop', 2, 200, 300, 15, 11)], [], 200), [shop]);
  assert.equal(buysOf([buy('season', 1, 100, 200, 6, 6), { ...buy('shop', 2, 100, 200, 15, 11), id: 'OTHER' }], [], 100).length, 2);
});

test('sell only for held items bought before the window', () => {
  const sells = { ...ALL_ON, avoid: false };
  assert.deepEqual(keys(sells, [], {}, [], 300), []);
  assert.deepEqual(keys(sells, [], { ORB: 150 }, [], 300), ['sell|ORB|perk:Marauder|50']);
  // the min. margin does not hide it
  assert.deepEqual(keys(sells, [], { SMALL: 150 }, [], 300), ['sell|SMALL|event:spooky|60']);
  // bought in the selling window: "started" would be wrong
  assert.deepEqual(keys(sells, [], { ORB: 301 }, [], 350), []);
  // a held item needs no buy notice
  assert.deepEqual(keys(ALL_ON, ['TOOTH'], { ORB: 90 }, [], 100), [AVOID]);
});

test('order: sell, warning about a held item, other warning, buy', () => {
  const row = { key: 'k', driver: 'D', hits: 6, n: 6 };
  const file = {
    w: [{ ...row, id: 'B', s: 1, buyStart: 0, buyEnd: 9, sellStart: 9, sellEnd: 9, spread: 0.9 }, { ...row, id: 'H', s: 2, buyStart: 0, buyEnd: 0, sellStart: 0, sellEnd: 9, spread: 0.1 }],
    a: [{ ...row, id: 'A', s: 3, at: 9, notifyAt: 0, drop: 0.5 }, { ...row, id: 'H', s: 4, at: 9, notifyAt: 0, drop: 0.1 }],
  };
  const order = windowAlerts(readWindowAlerts(file), ALL_ON, new Set(['A']), { H: 0 }, new Set(), 1).map((a) => a.kind + a.id);
  assert.deepEqual(order, ['sellH', 'avoidH', 'avoidA', 'buyB']);
});

test('the words of the notifications', () => {
  const [buy, sell, , , avoid] = readWindowAlerts(FILE);
  assert.equal(windowText(buy, 'Dark Orb'), 'Buying window open: Dark Orb (Paul, typical +20%, 9/12)');
  assert.equal(windowText(sell, 'Dark Orb'), 'Sell now: Dark Orb – selling window started');
  assert.equal(windowText(avoid, 'TOOTH'), 'Sell before Marina: TOOTH usually drops 13%');
});

test('banners: the same words, a Bought button on a buy only, cut at the daily limit', () => {
  const notices = windowAlerts(readWindowAlerts(FILE), ALL_ON, new Set(['TOOTH']), {}, new Set(), 100);
  const html = windowBanners(notices, { limit: 5, name: (id) => (id === 'ORB' ? 'Dark <Orb>' : id) });
  assert.match(html, /Buying window open: Dark &#60;Orb&#62; \(Paul, typical \+20%, 9\/12\)/);
  assert.match(html, /Sell before Marina: TOOTH usually drops 13%/);
  assert.equal((html.match(/data-held=/g) ?? []).length, 1);
  assert.match(html, /data-held="ORB"/);
  assert.equal((html.match(/data-seen=/g) ?? []).length, 2);
  assert.match(html, /href="#\/item\/ORB"/);
  const cut = windowBanners(notices, { limit: 1, name: (id) => id });
  assert.equal((cut.match(/data-seen=/g) ?? []).length, 1);
  assert.match(cut, /\+1 more/);
  assert.equal(windowBanners([], { limit: 5, name: (id) => id }), '');
});

test('the item page: mark as bought, and remove it again', () => {
  const page = (held) => detailView({ id: 'ORB', name: 'Dark Orb', flip: { buy: 1, sell: 2, profit: 1, margin: 1, profitHour: 1, weekVol: 1 }, points: [], range: '24h', tax: 0.0125, held });
  assert.match(page(false), /data-held="ORB" aria-pressed="false">Mark as bought/);
  assert.match(page(true), /data-held="ORB" aria-pressed="true">Bought – remove mark/);
  // a forge result that is not on the bazaar has nothing to mark
  assert.doesNotMatch(detailView({ id: 'ORB', name: 'Dark Orb', flip: null, points: [], range: '24h', tax: 0.0125 }), /data-held/);
});

test('few data: a badge where a window is shown, from the setting', () => {
  const w = { hits: 3, n: 3, spread: 0.1, buy: 'd1', sell: 'a1', src: [] };
  const page = (minRuns) => detailView({ id: 'ORB', name: 'Dark Orb', flip: null, points: [], range: '24h', tax: 0.0125, windows: [{ key: 'perk:Marauder', w, text: 'x' }], minRuns });
  assert.match(page(6), /few data/);
  assert.doesNotMatch(page(3), /few data/);
  const today = (minRuns) => todayView({ plan: null, capital: 0, slots: 1, now: 0, name: (id) => id, buying: [{ id: 'X', key: 'perk:Marauder', state: 'now', from: 0, to: 1, text: 'x', w }], minRuns });
  assert.match(today(6), /few data/);
  assert.doesNotMatch(today(3), /few data/);
  const run = (i) => ({ s: i * 100000, e: i * 100000 + 60, c: { X: { pre1: 100, during: 150 } } });
  const list = (minRuns) => windowsView({ 'event:spooky': [run(1), run(2), run(3)] }, 0.0125, (id) => id, () => null, minRuns);
  assert.match(list(6), /few data/);
  assert.doesNotMatch(list(3), /few data/);
});

test('no file, no alerts', () => {
  assert.deepEqual(readWindowAlerts(null), []);
});

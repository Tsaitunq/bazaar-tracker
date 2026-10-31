// The same cases as the windows tests in AlertLogicTest.java.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readWindowAlerts, windowAlerts, windowText } from '../timing.js';
import { windowBanners, detailView } from '../render.js';

const FILE = { t: 1, tax: 0.0125,
  w: [
    { id: 'ORB', key: 'perk:Marauder', driver: 'Paul', s: 50, buyStart: 100, buyEnd: 200, sellStart: 300, sellEnd: 400, spread: 0.2, hits: 9, n: 12, own: 3, backfill: 9 },
    { id: 'SMALL', key: 'event:spooky', driver: 'Spooky', s: 60, buyStart: 100, buyEnd: 200, sellStart: 300, sellEnd: 400, spread: 0.04, hits: 3, n: 3, own: 3, backfill: 0 },
  ],
  a: [{ id: 'TOOTH', key: 'perk:Fishing Festival', driver: 'Marina', s: 700, at: 700, notifyAt: 100, drop: 0.126, hits: 8, n: 12, own: 0, backfill: 8 }],
};
const ALL_ON = { buy: true, sell: true, avoid: true, minSpread: 0.05, favOnly: false };
const BUY = 'buy|ORB|perk:Marauder|50';
const AVOID = 'avoid|TOOTH|perk:Fishing Festival|700';
const keys = (prefs, favs, held, shown, now, file = FILE) =>
  windowAlerts(readWindowAlerts(file), prefs, new Set(favs), held, new Set(shown), now).map((a) => a.k);

test('windows are due in their span above the minimum', () => {
  assert.deepEqual(keys(ALL_ON, [], {}, [], 99), []);
  // warning first; SMALL is under 5%
  assert.deepEqual(keys(ALL_ON, [], {}, [], 100), [AVOID, BUY]);
  assert.deepEqual(keys(ALL_ON, [], {}, [], 200), [AVOID]);
  assert.deepEqual(keys(ALL_ON, [], {}, [], 700), []);
  // nothing without the switch
  assert.deepEqual(keys({ ...ALL_ON, buy: false }, [], {}, [], 100), [AVOID]);
  assert.deepEqual(keys({ ...ALL_ON, avoid: false }, [], {}, [], 100), [BUY]);
  // once per item and window
  assert.deepEqual(keys(ALL_ON, [], {}, [BUY], 100), [AVOID]);
});

test('favorites only; a held item is reported anyway', () => {
  const favOnly = { ...ALL_ON, favOnly: true };
  assert.deepEqual(keys(favOnly, ['ORB'], {}, [], 100), [BUY]);
  assert.deepEqual(keys(favOnly, [], {}, [], 100), []);
  assert.deepEqual(keys(favOnly, [], { TOOTH: 1 }, [], 100), [AVOID]);
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
  assert.deepEqual(keys(ALL_ON, [], { ORB: 90 }, [], 100), [AVOID]);
});

test('order: sell, warning about a held item, other warning, buy', () => {
  const row = { key: 'k', driver: 'D', hits: 3, n: 3 };
  const file = {
    w: [{ ...row, id: 'B', s: 1, buyStart: 0, buyEnd: 9, sellStart: 9, sellEnd: 9, spread: 0.9 }, { ...row, id: 'H', s: 2, buyStart: 0, buyEnd: 0, sellStart: 0, sellEnd: 9, spread: 0.1 }],
    a: [{ ...row, id: 'A', s: 3, at: 9, notifyAt: 0, drop: 0.5 }, { ...row, id: 'H', s: 4, at: 9, notifyAt: 0, drop: 0.1 }],
  };
  const order = windowAlerts(readWindowAlerts(file), ALL_ON, new Set(), { H: 0 }, new Set(), 1).map((a) => a.kind + a.id);
  assert.deepEqual(order, ['sellH', 'avoidH', 'avoidA', 'buyB']);
});

test('the words of the notifications', () => {
  const [buy, sell, , , avoid] = readWindowAlerts(FILE);
  assert.equal(windowText(buy, 'Dark Orb'), 'Buying window open: Dark Orb (Paul, typical +20%, 9/12)');
  assert.equal(windowText(sell, 'Dark Orb'), 'Sell now: Dark Orb – selling window started');
  assert.equal(windowText(avoid, 'TOOTH'), 'Sell before Marina: TOOTH usually drops 13%');
});

test('banners: the same words, a Bought button on a buy only, cut at the daily limit', () => {
  const notices = windowAlerts(readWindowAlerts(FILE), ALL_ON, new Set(), {}, new Set(), 100);
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

test('no file, no alerts', () => {
  assert.deepEqual(readWindowAlerts(null), []);
});

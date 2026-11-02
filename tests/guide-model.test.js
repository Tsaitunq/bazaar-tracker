import test from 'node:test';
import assert from 'node:assert/strict';
import { chaptersOf, totalShare, stampDone, unlockedThisWeek, guideModel, stepStatus, statDelta } from '../guide/model.js';
import { pathRow, stepCard } from '../guide/views/parts.js';
import { number } from '../format.js';
import { miningSettings } from '../optimizer.js';

const steps = (n, prefix) => Array.from({ length: n }, (_, i) => ({ text: `${prefix}${i}` }));
const guide = (sizes, extra = {}) => ({ sections: sizes.map((n, i) => ({ name: `S${i}`, steps: steps(n, `s${i}-`) })), ...extra });

test('three sections make three chapters', () => {
  const out = chaptersOf(guide([2, 2, 2]), new Set(['S0|s0-0', 'S0|s0-1', 'S1|s1-0']));
  assert.deepEqual(out.map((c) => c.name), ['S0', 'S1', 'S2']);
  assert.deepEqual(out.map((c) => c.share), [1, 0.5, 0]);
});

test('named chapters group their sections', () => {
  const out = chaptersOf(guide([1, 1, 1, 1], { chapters: [{ name: 'A', sections: ['S0', 'S1'] }, { name: 'B', sections: ['S2', 'S3'] }] }), new Set(['S0|s0-0']));
  assert.deepEqual(out.map((c) => [c.name, c.done, c.total]), [['A', 1, 2], ['B', 0, 2]]);
});

test('without chapters a long guide is split in three by step count', () => {
  const out = chaptersOf(guide([5, 5, 5, 5, 5, 5, 0]), new Set());
  assert.equal(out.length, 3);
  assert.deepEqual(out.map((c) => c.total), [10, 10, 10]);
});

test('a guide with less than three steps still gives three arcs', () => {
  const out = chaptersOf(guide([1]), new Set());
  assert.equal(out.length, 3);
  assert.equal(out.reduce((n, c) => n + c.total, 0), 1);
});

test('the current chapter holds the first open step', () => {
  assert.deepEqual(chaptersOf(guide([1, 1, 1]), new Set(['S0|s0-0'])).map((c) => c.current), [false, true, false]);
  assert.deepEqual(chaptersOf(guide([1, 1, 1]), new Set(['S0|s0-0', 'S1|s1-0', 'S2|s2-0'])).map((c) => c.current), [false, false, true]);
});

test('totalShare is done over all steps and 0 for an empty guide', () => {
  assert.equal(totalShare(chaptersOf(guide([1, 1, 2]), new Set(['S0|s0-0']))), 0.25);
  assert.equal(totalShare(chaptersOf(guide([0]), new Set())), 0);
});

test('the first run stamps what is done with 0', () => {
  assert.deepEqual(stampDone({}, new Set(['a']), 100, true), { a: 0 });
});

test('a step done later keeps its first date, undone clears it', () => {
  const first = stampDone({}, new Set(['a']), 100);
  assert.deepEqual(first, { a: 100 });
  assert.deepEqual(stampDone(first, new Set(['a', 'b']), 200), { a: 100, b: 200 });
  assert.deepEqual(stampDone(first, new Set(['b']), 200), { b: 200 });
});

test('unlockedThisWeek counts the last seven days only', () => {
  const week = 7 * 24 * 3600e3;
  assert.equal(unlockedThisWeek({ a: 0, b: 1000, c: week + 2000 }, week + 3000), 1);
  assert.equal(unlockedThisWeek(null, 1), 0);
});

const sold = (price) => ({ buy_summary: [{ pricePerUnit: price, amount: 100 }] });
const piece = (id, extra = {}) => ({ id, where: 'armor', gems: [], enchants: {}, parts: {}, reforge: null, recomb: false, polarvoid: 0, coating: false, lore: {}, ...extra });
const DRILL = 'TITANIUM_DRILL_4';
const items = { [DRILL]: { category: 'DRILL', tier: 'LEGENDARY', stats: { MINING_SPEED: 1600 } }, PLATE: { category: 'CHESTPLATE', tier: 'LEGENDARY', stats: {} }, GATE: { category: 'BOOTS', tier: 'RARE', stats: {}, requirements: [{ type: 'HEART_OF_THE_MOUNTAIN', tier: 7 }] } };
const person = (list, over = {}) => ({ items: list, pets: [], hotm: { experience: 0, nodes: {} }, skills: null, collTiers: null, attrs: {}, slayer: null, wardrobe: { armor: { equipped: 1, sets: [1] }, equipment: { equipped: 1, sets: [1] } }, ...over });
const miner = () => person([piece(DRILL, { where: 'inventory', lore: { MINING_SPEED: 1000, MINING_FORTUNE: 100 } })]);
const fighter = (over) => person([piece('PLATE', { sets: ['armor:1'], lore: { TRUE_DEFENSE: 200, STRENGTH: 3459 } })], { mp: 1200, ...over });
const fortune = (text, id = 'A', extra = {}) => ({ text, gain: { MINING_FORTUNE: 8 }, items: [{ id, qty: 1 }], ...extra });
const mining = (steps) => ({ id: 'm', title: 'Mine', area: 'mining', groups: { drill: [[DRILL]] }, sections: [{ name: 'Main', steps }] });
const blaze = (steps) => ({ id: 'b', title: 'Blaze', area: 'blaze', groups: {}, sections: [{ name: 'Main', steps }] });
const world = (over = {}) => ({ marks: new Set(), state: { summary: miner(), syncedAt: 1 }, products: { A: sold(1e6), B: sold(1e5) }, prices: { items }, settings: miningSettings(null), ...over });
const statusOf = (m) => m.rows.map((r) => r.status);

test('stepStatus gives the four states', () => {
  assert.equal(stepStatus({ done: true, locked: true, first: true }), 'done');
  assert.equal(stepStatus({ done: false, locked: true, first: true }), 'locked');
  assert.equal(stepStatus({ done: false, locked: false, first: true }), 'current');
  assert.equal(stepStatus({ done: false, locked: false, first: false }), 'open');
});

test('only the next step opens as a card', () => {
  const m = guideModel(mining([fortune('a'), fortune('b'), fortune('c')]), world({ marks: new Set(['Main|a']) }));
  assert.deepEqual(statusOf(m), ['done', 'current', 'open']);
  assert.equal(m.card.name, 'b');
  assert.equal(m.rows[1].card, m.card);
  assert.equal(m.rows[0].card, undefined);
});

test('all done leaves no card', () => {
  const m = guideModel(mining([fortune('a')]), world({ marks: new Set(['Main|a']) }));
  assert.equal(m.card, null);
  assert.equal(m.total, 1);
});

test('the line runs in area up to the current step, after that in line', () => {
  const m = guideModel(mining([fortune('a'), fortune('b'), fortune('c')]), world({ marks: new Set(['Main|a']) }));
  assert.deepEqual(m.rows.map((r) => [r.railTop, r.railBottom]), [[true, true], [true, false], [false, false]]);
  const done = guideModel(mining([fortune('a'), fortune('b')]), world({ marks: new Set(['Main|a', 'Main|b']) }));
  assert.deepEqual(done.rows.map((r) => [r.railTop, r.railBottom]), [[true, true], [true, false]]);
});

test('a row shows the rate from the score of its area, done in green text, locked with its reason', () => {
  const gated = { text: 'gated', items: [{ id: 'GATE', qty: 1 }] };
  const m = guideModel(mining([fortune('a'), fortune('b'), fortune('c'), gated]), world({ marks: new Set(['Main|a']) }));
  assert.equal(m.rows[0].side, 'done');
  assert.match(m.rows[2].side, /^[\d.]+ % \/ 1M$/);
  assert.equal(m.rows[2].sub, '+8 ☘ Mining Fortune');
  assert.equal(m.rows[2].subColor, 'orange');
  assert.equal(m.rows[3].status, 'locked');
  assert.equal(m.rows[3].side, 'locked');
  assert.match(m.rows[3].sub, /\S/);
});

test('no building block writes a unit of its own', () => {
  const scores = { mining: { gainText: () => 'G coins/h', rateText: () => 'R coins/h', rateLong: () => 'L coins/h' } };
  const m = guideModel(mining([fortune('a'), fortune('b')]), world({ scores }));
  assert.equal(m.rows[1].side, 'R coins/h');
  assert.equal(m.card.gain, 'G coins/h');
  assert.equal(m.card.rate, 'L coins/h');
  const html = stepCard(m.card) + pathRow(m.rows[1]);
  assert.doesNotMatch(html, /%|per 1M|yield/);
});

test('the card holds the hypixel stat, the gain, the cost and the rate', () => {
  const { card } = guideModel(mining([fortune('a')]), world());
  assert.deepEqual(card.stats, [{ text: '+8 ☘ Mining Fortune', color: 'orange' }]);
  assert.match(card.gain, /^\+[\d.]+ % yield$/);
  assert.equal(card.cost, '1M coins');
  assert.match(card.rate, /^[\d.]+ % per 1M$/);
  assert.equal(card.where, 'Main');
});

test('the card gets the BEST VALUE badge only when it leads the ranking', () => {
  assert.equal(guideModel(mining([fortune('a', 'B'), fortune('b', 'A')]), world()).card.badge, true);
  assert.equal(guideModel(mining([fortune('a', 'A'), fortune('b', 'B')]), world()).card.badge, false);
});

test('a partly done step shows have / need with API, an API tick has Undo', () => {
  const owned = { kind: 'owned', on: 'drill', need: 1 };
  const detected = { text: 'x', detect: owned };
  const m = guideModel(mining([detected]), world());
  assert.equal(m.rows[0].status, 'done');
  assert.equal(m.rows[0].api, true);
  assert.equal(m.rows[0].undo, true);
  assert.equal(m.rows[0].sub, 'from sync');
  const part = guideModel(mining([{ text: 'x', detect: { ...owned, need: 2 } }]), world());
  assert.equal(part.rows[0].progress, '1 / 2');
  assert.equal(part.rows[0].api, true);
  assert.equal(part.rows[0].undo, false);
  const mine = guideModel(mining([detected]), world({ marks: new Set(['Main|x']) }));
  assert.equal(mine.rows[0].undo, false);
});

test('the delta is the preview of the next step and empty without one', () => {
  const stats = [{ key: 'MINING_FORTUNE', delta: '' }, { key: 'MINING_SPEED', delta: '' }];
  assert.deepEqual(statDelta(stats, { MINING_FORTUNE: 8 }).map((s) => s.delta), ['+8', '']);
  assert.deepEqual(statDelta(stats, null).map((s) => s.delta), ['', '']);
  assert.deepEqual(statDelta(stats, { common: { MINING_SPEED: -2 } }).map((s) => s.delta), ['', '-2']);
  const m = guideModel(mining([fortune('a')]), world());
  assert.equal(m.stats.find((s) => s.key === 'MINING_FORTUNE').delta, '+8');
});

test('numbers use the thousands comma', () => {
  assert.equal(number(3459), '3,459');
  const m = guideModel(blaze([{ text: 'a', gain: { STRENGTH: 20 }, items: [{ id: 'A', qty: 1 }] }]), world({ state: { summary: fighter(), syncedAt: 1 } }));
  assert.equal(m.stats.find((s) => s.key === 'STRENGTH').value, '3,459');
});

test('mining shows four stats, blaze six and the chips', () => {
  const mine = guideModel(mining([fortune('a')]), world());
  assert.deepEqual(mine.stats.map((s) => s.label), ['Mining Fortune', 'Mining Speed', 'Pristine', 'Gemstone Fortune']);
  assert.equal(mine.chips, null);
  const fight = guideModel(blaze([{ text: 'a', gain: { STRENGTH: 20 }, items: [{ id: 'A', qty: 1 }] }]), world({ state: { summary: fighter(), syncedAt: 1 } }));
  assert.deepEqual(fight.stats.map((s) => s.label), ['Strength', 'Crit Dmg', 'Crit Ch.', 'Atk Speed', 'Health', 'Defense']);
  assert.equal(fight.chips.mp, 1200);
  assert.equal(fight.theme, 'blaze');
  assert.equal(fight.card.gain.endsWith('damage'), true);
  assert.equal(fight.card.stats[0].text, '+20 ❁ Strength');
});

test('without prices cost shows … and is never 0', () => {
  const m = guideModel(mining([fortune('a'), fortune('b')]), world({ products: null }));
  assert.equal(m.card.cost, '…');
  assert.equal(m.rows[1].side, '…');
  assert.deepEqual(statusOf(m), ['current', 'open']);
  assert.equal(guideModel(mining([fortune('a')]), world({ products: { X: sold(1) } })).card.cost, 'No price');
  assert.equal(guideModel(mining([{ text: 'a' }]), world()).card.cost, 'No coins');
});

test('without a sync the path still shows, with no stats and no ranking', () => {
  const m = guideModel(mining([fortune('a')]), world({ state: null }));
  assert.equal(m.missing, 'profile');
  assert.deepEqual(m.stats, []);
  assert.equal(m.card.cost, '1M coins');
  assert.equal(m.card.gain, '');
  assert.deepEqual(m.tabs.map((t) => t.id), ['path', 'best', 'stats']);
});

test('a guide without a score has only the path tab', () => {
  const m = guideModel({ ...mining([]), area: 'farming' }, world());
  assert.equal(m.theme, 'farming');
  assert.deepEqual(m.tabs.map((t) => t.id), ['path']);
  assert.deepEqual(m.rows, []);
});

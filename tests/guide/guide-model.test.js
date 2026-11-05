import test from 'node:test';
import assert from 'node:assert/strict';
import { chaptersOf, totalShare, stampDone, unlockedThisWeek, guideModel, stepStatus, statDelta } from '../../guide/model.js';
import { gamedata, baseOf, emptyBuild } from '../fixtures/guide-world.js';
import { pathRow, stepCard } from '../../guide/views/parts.js';
import { number } from '../../format.js';
import { miningSettings, SCORES } from '../../optimizer.js';

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
const MINER = { mining: { values: { MINING_SPEED: 1000, MINING_FORTUNE: 100 } } };
const FIGHTER = { blaze: { values: { STRENGTH: 3459, TRUE_DEFENSE: 200 }, mp: 1200 } };
const world = (over = {}) => ({ marks: new Set(), owned: [DRILL], base: baseOf({ ...MINER, ...FIGHTER }), build: emptyBuild(), gamedata, products: { A: sold(1e6), B: sold(1e5) }, prices: { items }, settings: miningSettings(null), ...over });
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

test('a row shows the rate from the score of its area and done in green text', () => {
  const m = guideModel(mining([fortune('a'), fortune('b'), fortune('c')]), world({ marks: new Set(['Main|a']) }));
  assert.equal(m.rows[0].side, 'done');
  assert.match(m.rows[2].side, /^[\d.]+[kMB]? per 1 %$/);
  assert.equal(m.rows[2].sub, '+8 ☘ Mining Fortune');
  assert.equal(m.rows[2].subColor, 'orange');
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
  assert.match(card.rate, /^[\d.]+[kMB]? per 1 % yield$/);
  assert.equal(card.where, 'Main');
});

test('the card gets the BEST VALUE badge only when it leads the ranking', () => {
  assert.equal(guideModel(mining([fortune('a', 'B'), fortune('b', 'A')]), world()).card.badge, true);
  assert.equal(guideModel(mining([fortune('a', 'GONE'), fortune('b', 'GONE')]), world()).card.badge, false);
});

test('a partly owned step shows have / need, an owned one is done', () => {
  const owned = { kind: 'owned', on: [[DRILL], ['PLATE']], need: 2 };
  const part = guideModel(mining([{ text: 'x', detect: owned }]), world());
  assert.equal(part.rows[0].status, 'current');
  assert.equal(part.rows[0].progress, '1 / 2');
  const all = guideModel(mining([{ text: 'x', detect: owned }]), world({ owned: [DRILL, 'PLATE'] }));
  assert.equal(all.rows[0].status, 'done');
  assert.equal(all.rows[0].progress, '');
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
  const m = guideModel(blaze([{ text: 'a', gain: { STRENGTH: 20 }, items: [{ id: 'A', qty: 1 }] }]), world({ owned: ['PLATE'] }));
  assert.equal(m.stats.find((s) => s.key === 'STRENGTH').value, '3,459');
});

test('mining shows four stats, blaze six and the chips', () => {
  const mine = guideModel(mining([fortune('a')]), world());
  assert.deepEqual(mine.stats.map((s) => s.label), ['Mining Fortune', 'Mining Speed', 'Pristine', 'Gemstone Fortune']);
  assert.equal(mine.chips, null);
  const fight = guideModel(blaze([{ text: 'a', gain: { STRENGTH: 20 }, items: [{ id: 'A', qty: 1 }] }]), world({ owned: ['PLATE'] }));
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
  const m = guideModel(mining([fortune('a')]), world({ base: {} }));
  assert.equal(m.missing, 'stats');
  assert.deepEqual(m.stats, []);
  assert.equal(m.card.cost, '1M coins');
  assert.equal(m.card.gain, '');
});

test('a guide without a score has an empty path', () => {
  const m = guideModel({ ...mining([]), area: 'farming' }, world());
  assert.equal(m.theme, 'farming');
  assert.deepEqual(m.rows, []);
});

test('left counts the coins up to the end of the section and the chapter', () => {
  const buy = (id) => ({ text: id, items: [{ id, qty: 1 }] });
  const g = { id: 'g', title: 'G', source: 'https://example.com/g', chapters: [{ name: 'One', sections: ['A', 'B'] }, { name: 'Two', sections: ['C'] }], sections: [{ name: 'A', steps: [buy('P'), buy('Q')] }, { name: 'B', steps: [buy('P'), buy('NONE')] }, { name: 'C', steps: [buy('Q')] }] };
  const book = (price) => ({ buy_summary: [{ pricePerUnit: price, amount: 100 }] });
  const m = guideModel(g, { marks: new Set(['A|P']), products: { P: book(1e6), Q: book(2e6) }, name: String });
  assert.equal(m.source, 'https://example.com/g');
  assert.equal(m.card.left, 'Left 2M');
  assert.equal(m.chapters[0].leftText, 'Left 3M + 1 unpriced');
  assert.equal(m.chapters[1].leftText, '');
  const waiting = guideModel(g, { marks: new Set(), products: null, name: String });
  assert.equal(waiting.card.left, 'Left …');
});

test('a section with nothing left to pay says nothing', () => {
  const g = { id: 'g', title: 'G', sections: [{ name: 'A', steps: [{ text: 'free' }] }] };
  const m = guideModel(g, { marks: new Set(), products: {}, name: String });
  assert.equal(m.card.left, '');
});

test('a section marked extra stays out of the ring', () => {
  const g = guide([1, 1], {});
  g.sections[1].extra = true;
  assert.equal(chaptersOf(g, new Set()).reduce((n, c) => n + c.total, 0), 1);
});

test('the current chapter follows the current step, not the first open one', () => {
  const out = chaptersOf(guide([1, 1, 1]), new Set(), null, 'S2|s2-0');
  assert.deepEqual(out.map((c) => c.current), [false, false, true]);
});

// the path as the order of the rows
const coinsOf = (text, id, fortune, extra = {}) => ({ text, gain: { MINING_FORTUNE: fortune }, items: [{ id, qty: 1 }], ...extra });
const typed = (over = {}) => world({ owned: [], base: baseOf(MINER), ...over });

test('rate reads as coins per 1 %', () => assert.equal(SCORES.mining.rateText(0.01 / 1.62), '1.62M per 1 %'));

test('a head reads with the next N steps, one member reads with the next step', () => {
  const three = mining([coinsOf('a', 'A', 1, { group: 'G' }), coinsOf('b', 'A', 1, { group: 'G' }), coinsOf('c', 'A', 1, { group: 'G' })]);
  const rows = guideModel(three, typed()).rows;
  assert.equal(rows[0].card.group, 'with the next 2 steps');
  assert.equal(rows[1].member, true);
  const two = mining([coinsOf('a', 'A', 1, { group: 'G' }), coinsOf('b', 'A', 1, { group: 'G' })]);
  assert.equal(guideModel(two, typed()).rows[0].group, 'with the next step');
});

test('without a sync the rows have a rate from typed stats and ticks', () => {
  const m = guideModel(mining([coinsOf('a', 'A', 10), coinsOf('b', 'A', 5)]), typed());
  assert.match(m.rows[1].side, /per 1 %$/);
  assert.match(m.rows[0].card.rate, /per 1 % yield$/);
  assert.equal(m.missing, null);
  assert.equal(guideModel(mining([coinsOf('a', 'A', 10)]), world({ base: {} })).missing, 'stats');
});

test('every ticked step adds to the measured base', () => {
  const g = mining([coinsOf('old', 'A', 10), coinsOf('new', 'A', 20), coinsOf('open', 'A', 5)]);
  const marks = new Set(['Main|old', 'Main|new']);
  const m = guideModel(g, typed({ marks }));
  assert.equal(m.stats.find((s) => s.key === 'MINING_FORTUNE').value, '130');
});

test('rows follow the path order, done rows on top in guide order', () => {
  const g = mining([coinsOf('poor', 'A', 1), coinsOf('doneA', 'A', 1), coinsOf('good', 'A', 50), coinsOf('doneB', 'A', 1)]);
  const marks = new Set(['Main|doneA', 'Main|doneB']);
  assert.deepEqual(guideModel(g, typed({ marks })).rows.map((r) => r.name), ['doneA', 'doneB', 'good', 'poor']);
});

test('a later price changes the number, not the place, until the next tick', () => {
  const g = { ...mining([coinsOf('x', 'A', 5), coinsOf('y', 'B', 5), coinsOf('z', 'B', 1)]), id: 'epoch' };
  const first = guideModel(g, typed({ pathEpoch: 1, products: { A: sold(1e6), B: sold(2e6) } }));
  assert.deepEqual(first.rows.map((r) => r.name), ['x', 'y', 'z']);
  const later = guideModel(g, typed({ pathEpoch: 1, products: { A: sold(9e6), B: sold(2e6) } }));
  assert.deepEqual(later.rows.map((r) => r.name), ['x', 'y', 'z']);
  assert.notEqual(later.rows[0].card.rate, first.rows[0].card.rate);
  const ticked = guideModel(g, typed({ pathEpoch: 2, products: { A: sold(9e6), B: sold(2e6) } }));
  assert.deepEqual(ticked.rows.map((r) => r.name), ['y', 'x', 'z']);
});

test('opening one guide orders only its own path again', () => {
  const g = { ...mining([coinsOf('x', 'A', 5), coinsOf('y', 'B', 5)]), id: 'own' };
  const at = (opened, a) => guideModel(g, typed({ pathEpoch: 1, opened, products: { A: sold(a), B: sold(2e6) } })).rows.map((r) => r.name);
  assert.deepEqual(at({ own: 1 }, 1e6), ['x', 'y']);
  assert.deepEqual(at({ own: 1, other: 5 }, 9e6), ['x', 'y']);
  assert.deepEqual(at({ own: 2, other: 5 }, 9e6), ['y', 'x']);
});

test('a cold resistance step shows its stat and no rate', () => {
  const g = { ...mining([{ text: 'warm', gain: { COLD_RESISTANCE: 5 }, items: [{ id: 'A', qty: 1 }] }]), order: 'fixed' };
  const [row] = guideModel(g, typed()).rows;
  assert.match(row.card.stats[0].text, /Cold Resistance/);
  assert.equal(row.card.rate, '');
});

test('extras come last without a rate and can be ticked', () => {
  const g = { id: 'x', title: 'X', area: 'mining', sections: [{ name: 'Buffs', extra: true, steps: [coinsOf('buff', 'A', 99)] }, { name: 'Main', steps: [coinsOf('a', 'A', 1)] }] };
  const rows = guideModel(g, typed()).rows;
  assert.deepEqual(rows.map((r) => r.name), ['a', 'buff']);
  assert.equal(rows[1].status, 'open');
  assert.doesNotMatch(rows[1].side, /per 1 %/);
  assert.match(pathRow(rows[1]), /data-step="Buffs\|buff"/);
  assert.equal(guideModel(g, typed({ marks: new Set(['Buffs|buff']) })).rows[1].status, 'done');
  assert.equal(guideModel(g, typed({ marks: new Set(['Main|a']) })).card, null);
});

test('swapping a score object changes every rate text', () => {
  const scores = { mining: { gainText: () => 'G', rateText: () => 'R', rateLong: () => 'L' } };
  const rows = guideModel(mining([coinsOf('a', 'A', 10), coinsOf('b', 'A', 5)]), typed({ scores })).rows;
  assert.equal(rows[0].card.gain, 'G');
  assert.equal(rows[0].card.rate, 'L');
  assert.equal(rows[1].side, 'R');
});

test('without a sync the piece a new one replaces is sold, as with a sync', () => {
  const data = { LOW: { category: 'HELMET', tier: 'RARE', stats: {} }, HIGH: { category: 'HELMET', tier: 'EPIC', stats: { MINING_FORTUNE: 30 } } };
  const g = mining([{ text: 'high', items: [{ id: 'HIGH', qty: 1 }], detect: { kind: 'owned', on: [['HIGH']] } }]);
  const products = { HIGH: sold(1e6), LOW: { sell_summary: [{ pricePerUnit: 5e5, amount: 10 }], buy_summary: [] } };
  const m = guideModel(g, typed({ owned: ['LOW'], products, prices: { items: data } }));
  assert.equal(m.leader.resale, 5e5);
  assert.equal(m.leader.net, 5e5);
});

test('a step is locked by the HOTM tier of the build; unknown is never locked', () => {
  const g = mining([fortune('a'), fortune('gate', 'GATE')]);
  const rowOf = (hotm) => guideModel(g, world({ items, build: { ...emptyBuild(), hotm } })).rows.find((r) => r.name === 'gate');
  assert.notEqual(rowOf(null).status, 'locked');
  assert.notEqual(rowOf({ tier: null, levels: {} }).status, 'locked');
  const low = rowOf({ tier: 5, levels: {} });
  assert.equal(low.status, 'locked');
  assert.match(low.sub, /HOTM 7 needed, you have 5/);
  assert.notEqual(rowOf({ tier: 7, levels: {} }).status, 'locked');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isItemStep, idsToOwn, idsOfStep, ownedAuto, mergeAuto, migrateOwned, impliedDone, resetOwned } from '../owned.js';
import { stepKey, doneSet, openStep, exportData, importData } from '../progress.js';
import { guideModel, stampAll, tickStep, autoOf, applyImport } from '../guide/model.js';
import { settingsView } from '../guide/views/settings.js';
import { miningSettings } from '../optimizer.js';

const owned1 = (text, on, extra = {}) => ({ text, detect: { kind: 'owned', on, ...extra } });
const guideOf = (id, steps, extra = {}) => ({ id, title: id, area: 'mining', sections: [{ name: 'S', steps }], ...extra });
const A = guideOf('a', [owned1('Lamp', [['LAMP', 'BETTER']]), { text: 'Gem', detect: { kind: 'gem', on: [['LAMP']], quality: 'FINE' } }]);
const B = guideOf('b', [owned1('Old lamp', [['LAMP']])]);
const key = (g, i = 0) => stepKey(g.sections[0], g.sections[0].steps[i]);

test('ticking an item step in one guide marks it in the other', () => {
  const owned = new Set(idsToOwn(A.sections[0].steps[0], A, new Set()));
  assert.deepEqual([...owned], ['LAMP']);
  const found = ownedAuto(B, owned, stepKey).get(key(B));
  assert.equal(found.have, found.need);
  assert.equal(found.ticked, true);
});

test('a higher rung fulfils the step below it', () => {
  const found = ownedAuto(A, new Set(['BETTER']), stepKey).get(key(A));
  assert.equal(found.have, found.need);
});

test('only steps whose parts all are owned share their state', () => {
  assert.equal(isItemStep(A.sections[0].steps[0]), true);
  assert.equal(isItemStep(A.sections[0].steps[1]), false);
  assert.equal(isItemStep({ text: 'x' }), false);
  assert.equal(isItemStep({ text: 'x', detect: [{ kind: 'owned', on: [['A']] }, { kind: 'gem', on: [['A']], quality: 'FINE' }] }), false);
  assert.equal(ownedAuto(A, new Set(['LAMP']), stepKey).has(key(A, 1)), false);
});

test('an owned step counts its slots up to need and adds only the open ones', () => {
  const step = owned1('Set', [['P1'], ['P2'], ['P3']], { need: 2 });
  assert.deepEqual(idsToOwn(step, guideOf('c', [step]), new Set(['P2'])), ['P1']);
  assert.deepEqual(idsToOwn(step, guideOf('c', [step]), new Set(['P1', 'P2'])), []);
  assert.deepEqual(idsOfStep(step, guideOf('c', [step])), ['P1', 'P2', 'P3']);
});

test('a group name in on resolves through the guide', () => {
  const step = owned1('Drill', 'drill');
  const g = guideOf('d', [step], { groups: { drill: [['D1', 'D2']] } });
  assert.deepEqual(idsToOwn(step, g, new Set()), ['D1']);
});

test('nothing owned says nothing, so a table step stays done', () => {
  const g = guideOf('t', [{ ...owned1('Free', [['X']]), table: true }]);
  assert.equal(ownedAuto(g, new Set(), stepKey).size, 0);
  assert.equal(doneSet(g, new Set(), autoOf(g, null, new Set())).has(key(g)), true);
});

test('migration moves ticks of item steps once and keeps the others', () => {
  const checks = { a: [key(A), key(A, 1), `undone:${key(A)}`] };
  const once = migrateOwned([A, B], checks);
  assert.deepEqual(once.owned, ['LAMP']);
  assert.deepEqual(once.checks.a, [key(A, 1), `undone:${key(A)}`]);
  assert.deepEqual(migrateOwned([A, B], once.checks, once.owned), once);
});

test('a sync that finds it wins, a tick fills in where the sync says no', () => {
  const real = new Map([['x', { have: 1, need: 1 }], ['y', { have: 0, need: 1 }]]);
  const tick = new Map([['x', { have: 1, need: 1, ticked: true }], ['y', { have: 1, need: 1, ticked: true }], ['z', { have: 1, need: 2, ticked: true }]]);
  const out = mergeAuto(real, tick);
  assert.equal(out.get('x').ticked, undefined);
  assert.equal(out.get('y').ticked, true);
  assert.equal(out.get('z').have, 1);
});

test('reset removes the items of that guide for all guides and leaves the rest', () => {
  const owned = resetOwned(B, new Set(['LAMP', 'OTHER']));
  assert.deepEqual([...owned], ['OTHER']);
  assert.equal(ownedAuto(A, owned, stepKey).size, 0);
});

test('the reset question says that ticked items clear in other guides too', () => {
  const html = settingsView({ guides: [A], armed: 'a', settings: miningSettings(null), personal: false });
  assert.match(html, /Items you ticked also clear in your other guides/);
});

test('ticks stay when the sync is off or gone', () => {
  const done = doneSet(B, new Set(), autoOf(B, undefined, new Set(['LAMP'])));
  assert.equal(done.has(key(B)), true);
});

test('after marks the replaced step as done, also along a chain, unless it was unticked', () => {
  const g = guideOf('c', [{ text: 'One' }, { text: 'Two', after: ['One'] }, { text: 'Three', after: ['Two'] }]);
  assert.deepEqual([...impliedDone(g, new Set(['S|Three']), stepKey)].sort(), ['S|One', 'S|Two']);
  assert.equal(doneSet(g, new Set(['S|Three'])).has('S|One'), true);
  assert.equal(doneSet(g, new Set(['S|Three', 'undone:S|One'])).has('S|One'), false);
});

test('ticking an item step writes to owned, not to the marks of the guide', () => {
  const marks = new Set();
  const owned = tickStep({ guide: A, key: key(A), on: true, marks, owned: new Set(), summary: null });
  assert.deepEqual([...owned], ['LAMP']);
  assert.equal(marks.size, 0);
  const off = tickStep({ guide: A, key: key(A), on: false, marks, owned, summary: null });
  assert.equal(off.size, 0);
  assert.equal(marks.size, 0);
});

test('unticking what a higher rung still fulfils stays unticked in this guide only', () => {
  const marks = new Set();
  const owned = tickStep({ guide: A, key: key(A), on: false, marks, owned: new Set(['BETTER']), summary: null });
  assert.deepEqual([...owned], ['BETTER']);
  assert.equal(doneSet(A, marks, autoOf(A, null, owned)).has(key(A)), false);
});

test('a gem step keeps its mark in its guide', () => {
  const marks = new Set();
  const owned = tickStep({ guide: A, key: key(A, 1), on: true, marks, owned: new Set(), summary: null });
  assert.equal(owned.size, 0);
  assert.deepEqual([...marks], [key(A, 1)]);
});

test('the model shows a ticked item as done, not as from sync, and a passed rung as skipped', () => {
  const world = (owned) => ({ marks: new Set(), checks: {}, guides: [], state: null, products: {}, prices: {}, settings: miningSettings(null), name: String, now: 1, owned });
  const row = (m) => m.rows[0];
  assert.equal(row(guideModel(A, world(['LAMP']))).status, 'done');
  assert.equal(row(guideModel(A, world(['LAMP']))).sub, '');
  assert.equal(row(guideModel(A, world(['LAMP']))).api, false);
  assert.equal(row(guideModel(A, world(['BETTER']))).sub, 'skipped');
  const implied = guideOf('c', [{ text: 'One' }, { text: 'Two', after: ['One'] }]);
  assert.equal(guideModel(implied, { ...world([]), marks: new Set(['S|Two']) }).rows[0].sub, 'skipped');
});

test('a tick gets its date in every guide that holds the item', () => {
  const dates = stampAll([A, B], {}, { a: {}, b: {} }, null, 50, false, ['LAMP']);
  assert.equal(dates.a[key(A)], 50);
  assert.equal(dates.b[key(B)], 50);
});

test('a piece ticked is not priced again in a partly done step', () => {
  const step = { ...owned1('Set', [['P1'], ['P2']]), items: [{ id: 'P1', qty: 1 }, { id: 'P2', qty: 1 }] };
  const section = { name: 'S', steps: [step] };
  const open = openStep(section, step, { auto: new Map([['S|Set', { have: 1, need: 2, ticked: true }]]), owned: new Set(['P1']), profile: null });
  assert.deepEqual(open.items.map((i) => i.id), ['P2']);
});

test('export and import carry what is owned', () => {
  const data = importData(exportData([A], {}, ['LAMP']));
  assert.deepEqual(data.owned, ['LAMP']);
  assert.deepEqual(importData(JSON.stringify({ title: 'T', sections: [{ name: 'S', steps: [] }] })).owned, []);
  const merged = applyImport({ imported: [], checks: {}, bundled: [], owned: ['X'] }, data);
  assert.deepEqual(merged.owned.sort(), ['LAMP', 'X']);
});

test('the app ships the new file', () => {
  assert.match(readFileSync(new URL('../guide/sw.js', import.meta.url), 'utf8'), /'\.\.\/owned\.js'/);
});

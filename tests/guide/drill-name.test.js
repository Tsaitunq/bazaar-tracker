import test from 'node:test';
import assert from 'node:assert/strict';
import { guideModel, tickStep } from '../../apps/guide/model.js';
import { stepKey } from '../../apps/guide/progress.js';
import { miningSettings } from '../../apps/guide/optimizer.js';

const own = (id, text) => ({ text, key: `item:${id}`, detect: { kind: 'owned', on: [[id]] }, items: [{ id, qty: 1 }] });
const part = (text, key, id, extra = {}) => ({ text, key, detect: { kind: 'polarvoid', on: [[id]], need: 5, ...extra }, items: [{ id: 'BOOK', qty: 1 }] });
const guide = {
  id: 'g', title: 'Shafting', area: 'mining', order: 'fixed',
  sections: [{ name: 'Drill', steps: [
    own('TITANIUM_DRILL_1', 'Titanium Drill DR-X355'), part('DR-X355: Polarvoid Books x5', 'polarvoid:drill:5', 'TITANIUM_DRILL_1'),
    own('TITANIUM_DRILL_3', 'Titanium Drill DR-X555'), part('DR-X555: Lustrous Reforge', 'reforge:drill:lustrous', 'TITANIUM_DRILL_3', { kind: 'reforge' }),
    own('DIVAN_DRILL', "Divan's Drill"), part("Divan's Drill: Flawless Amber (Slot 2)", 'gem:drill:AMBER:2', 'DIVAN_DRILL', { kind: 'gem' }),
    { text: 'Efficiency Ring', key: 'x:ring', gain: { MINING_FORTUNE: 1 } },
  ] }],
};
const nameOf = (m, key) => m.rows.find((r) => r.key === key).name;
const world = (owned, marks = []) => ({ guides: [guide], owned, marks: new Set(marks), prices: {}, settings: miningSettings(null), now: 0, name: String, build: {}, base: {} });
const K = (text) => stepKey(guide.sections[0], guide.sections[0].steps.find((s) => s.text === text));

test('a part is shown with the drill you own now: the highest drill ticked', () => {
  const m = guideModel(guide, world(['TITANIUM_DRILL_3']));
  assert.equal(nameOf(m, K('DR-X355: Polarvoid Books x5')), 'DR-X555: Polarvoid Books x5');
  assert.equal(nameOf(m, K('DR-X555: Lustrous Reforge')), 'DR-X555: Lustrous Reforge');
  assert.equal(nameOf(m, K("Divan's Drill: Flawless Amber (Slot 2)")), 'DR-X555: Flawless Amber (Slot 2)');
  assert.equal(nameOf(m, K('Titanium Drill DR-X555')), 'Titanium Drill DR-X555', 'a drill step keeps its own name');
  assert.equal(nameOf(m, K('Efficiency Ring')), 'Efficiency Ring');
});

test('without a drill the prefix is "Drill"; with the Divan one it is its name; keys and ticks stay', () => {
  assert.equal(nameOf(guideModel(guide, world([])), K('DR-X355: Polarvoid Books x5')), 'Drill: Polarvoid Books x5');
  assert.equal(nameOf(guideModel(guide, world(['TITANIUM_DRILL_3', 'DIVAN_DRILL'])), K('DR-X355: Polarvoid Books x5')), "Divan's Drill: Polarvoid Books x5");
  const key = K('DR-X355: Polarvoid Books x5');
  const ticked = guideModel(guide, world(['TITANIUM_DRILL_3'], [key]));
  assert.equal(ticked.rows.find((r) => r.key === key).status, 'done');
});

test('the open card and its parts use the same name; ticking the DR-X555 step changes the name', () => {
  const marks = new Set();
  const owned = tickStep({ guide, key: K('Titanium Drill DR-X555'), on: true, marks, owned: [] });
  const m = guideModel(guide, world([...owned]));
  assert.equal(nameOf(m, K('DR-X355: Polarvoid Books x5')), 'DR-X555: Polarvoid Books x5');
  for (const name of [m.card?.name, ...(m.card?.parts ?? []).map((p) => p.name)].filter(Boolean)) assert.doesNotMatch(name, /DR-X355:/);
});

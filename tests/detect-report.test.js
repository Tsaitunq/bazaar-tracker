import test from 'node:test';
import assert from 'node:assert/strict';
import { detectGuide, explainGuide } from '../detect.js';
import { stepKey } from '../progress.js';
import { reportOf } from '../guide/model.js';
import { evidence, pathRow } from '../guide/views/parts.js';
import { settingsView } from '../guide/views/settings.js';
import { miningSettings } from '../optimizer.js';

const DRILL = {
  id: 'DRILL_B', where: 'backpack', bag: 3, reforge: 'auspicious', enchants: { efficiency: 5, compact: 10 }, recomb: true, coating: true, polarvoid: 2,
  parts: { engine: 'ENGINE_A' }, gems: [{ slot: 'JADE_0', type: 'JADE', quality: 'FINE' }, { slot: 'AMBER_0', type: 'AMBER', quality: 'FLAWED' }],
};
const profile = {
  items: [
    DRILL,
    { id: 'DRILL_A', where: 'inventory', enchants: {}, gems: [] },
    { id: 'HELM', where: 'wardrobe', sets: ['armor:4'], enchants: {}, gems: [] },
    { id: 'RING', where: 'accessory', enchants: {}, gems: [] },
  ],
  pets: [{ type: 'MOLE', tier: 'EPIC', heldItem: 'QUICK_CLAW' }],
  perks: { mining_speed: 3 },
};
const guide = {
  id: 'g', title: 'G', groups: { drill: [['DRILL_A', 'DRILL_B']] },
  sections: [
    { name: 'One', steps: [
      { text: 'drill a', detect: { kind: 'owned', on: [['DRILL_A']], slot: 'drill' } },
      { text: 'efficiency', detect: { kind: 'enchant', on: 'drill', enchant: 'efficiency', level: 5 } },
      { text: 'jade fine', detect: { kind: 'gem', on: 'drill', type: 'JADE', quality: 'FINE', need: 2 } },
      { text: 'mole', detect: { kind: 'pet', types: ['MOLE'], tier: 'RARE' } },
      { text: 'perk', detect: { kind: 'essence', perk: 'mining_speed', level: 5 } },
      { text: 'helm and ring', detect: [{ kind: 'owned', on: [['HELM']] }, { kind: 'owned', on: [['RING']] }, { kind: 'owned', on: [['GONE']] }] },
      { text: 'nothing', detect: { kind: 'owned', on: [['GONE']] } },
      { text: 'by hand' },
    ] },
    { name: 'Two', steps: [{ text: 'drill b', detect: { kind: 'owned', on: [['DRILL_B']], slot: 'drill' } }] },
  ],
};

test('the report counts exactly what detection counts', () => {
  const judged = detectGuide(guide, profile, stepKey);
  const told = explainGuide(guide, profile, stepKey);
  assert.deepEqual([...told.keys()].sort(), [...judged.keys()].sort());
  for (const [key, f] of judged) assert.deepEqual([told.get(key).have, told.get(key).need], [f.have, f.need], key);
});

test('the report lists the steps found in full or in part, with the later step that settled one', () => {
  const report = reportOf(guide, profile, []);
  const by = Object.fromEntries(report.map((e) => [e.name, e]));
  assert.deepEqual(Object.keys(by).sort(), ['drill a', 'drill b', 'efficiency', 'helm and ring', 'jade fine', 'mole', 'perk']);
  assert.equal(by['drill a'].by, 'drill b');
  assert.deepEqual([by['jade fine'].have, by['jade fine'].need], [1, 2]);
  assert.deepEqual([by['helm and ring'].have, by['helm and ring'].need], [2, 3]);
  // the best piece of the slot is the one shown
  assert.equal(by.efficiency.parts[0].slots[0].item.id, 'DRILL_B');
  assert.equal(reportOf(guide, null, []).length, 0);
});

test('a step ticked by hand in another guide shows the tick as its evidence', () => {
  const [entry] = reportOf(guide, null, ['RING']);
  assert.deepEqual([entry.name, entry.have, entry.need, entry.ticked], ['helm and ring', 1, 3, true]);
  const ticked = reportOf({ ...guide, sections: [{ name: 'One', steps: [{ text: 'ring', detect: { kind: 'owned', on: [['RING']] } }] }] }, null, ['RING']);
  assert.equal(ticked[0].ticked, true);
  assert.match(evidence(ticked[0], () => ''), /Ticked by hand/);
});

test('the evidence names the piece, its parts and where it is', () => {
  const report = reportOf(guide, profile, []);
  const html = (name) => evidence(report.find((e) => e.name === name), (id) => ({ DRILL_B: 'epic' })[id] ?? '');
  const drill = html('efficiency');
  for (const want of ['DRILL_B', 'epic +1 (recombobulated)', 'reforge auspicious', 'efficiency 5', 'compact 10', 'JADE_0 JADE FINE', 'AMBER_0 AMBER FLAWED', 'coating', 'polarvoid 2', 'engine ENGINE_A', 'Backpack 3', 'Result: fulfilled']) assert.ok(drill.includes(want), want);
  assert.match(html('jade fine'), /Result: partly: 1 \/ 2, missing 1/);
  assert.match(html('mole'), /MOLE · EPIC · holding QUICK_CLAW.*Pets/);
  assert.match(html('perk'), /Profile: 3/);
  const multi = html('helm and ring');
  assert.match(multi, /Wardrobe slot 4/);
  assert.match(multi, /Accessory bag/);
  assert.match(multi, /class="ev-miss">missing: none of GONE/);
  assert.match(html('drill a'), /a later step of the same slot was found \(drill b\)/);
});

test('an API tag on the path opens the same evidence', () => {
  const row = pathRow({ key: 'S|a', name: 'Step', status: 'done', api: true, undo: true, sub: '', side: '', progress: '' });
  assert.match(row, /<button type="button" class="undo" data-evidence="S\|a"[^>]*>API</);
  assert.doesNotMatch(pathRow({ key: 'S|a', name: 'Step', status: 'open', api: false }), /data-evidence/);
});

test('settings show the report only with the sync on', () => {
  const world = { guides: [guide], settings: miningSettings(null), state: { summary: profile }, owned: [], tierOf: () => '' };
  assert.match(settingsView({ ...world, personal: true }), /Detection report.*G · 7 steps/s);
  assert.doesNotMatch(settingsView({ ...world, personal: false }), /Detection report/);
  assert.match(settingsView({ ...world, personal: true, state: null }), /Sync first/);
});

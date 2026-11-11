import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pieceParts, realItem, compareTip } from '../../apps/guide/gear-parts.js';
import { gearOf } from '../../apps/guide/gear.js';
import { miningSettings } from '../../apps/guide/optimizer.js';

const items = {
  DRILL: { category: 'DRILL', tier: 'LEGENDARY', stats: { MINING_SPEED: 1000, MINING_FORTUNE: 10 }, gemstone_slots: [{ slot_type: 'AMBER' }] },
  HELM: { category: 'HELMET', tier: 'EPIC', stats: { MINING_FORTUNE: 5, HEALTH: 50 } },
};
const piece = (id, over = {}) => ({ id, where: 'inventory', gems: [], enchants: {}, parts: {}, reforge: null, recomb: false, polarvoid: 0, coating: false, lore: { ...items[id].stats }, ...over });

test('a piece is split into base, reforge, gems per slot, enchants, parts, Polarvoid, coating; the lapidary part is conditional', () => {
  const p = pieceParts(piece('DRILL', {
    reforge: 'jaded', gems: [{ slot: 'AMBER_0', type: 'AMBER', quality: 'PERFECT' }], enchants: { efficiency: 5, lapidary: 5 }, parts: { engine: 'TITANIUM_DRILL_ENGINE' }, polarvoid: 5, coating: true,
  }), items);
  assert.deepEqual(p.lines.MINING_SPEED.map((l) => l.part), ['base', 'reforge', 'gems', 'enchants', 'parts', 'polarvoid', 'coating']);
  assert.equal(p.total.MINING_SPEED, 1000 + 45 + 80 + 110 + 150 + 50 + 500);
  assert.equal(p.total.MINING_FORTUNE, 10 + 25 + 15 + 5);
  assert.ok(p.conditional.some((t) => /lapidary 5/.test(t) && /only on gemstones/.test(t)));
});

test('the Recombobulator is its own line: the rise of reforge and gems, which are shown at the lower rarity', () => {
  const p = pieceParts(piece('DRILL', { reforge: 'jaded', recomb: true }), items);
  assert.equal(p.lines.MINING_SPEED.find((l) => l.part === 'reforge').value, 45);
  assert.equal(p.lines.MINING_SPEED.find((l) => l.part === 'recomb').value, 15);
});

test('realItem: worn before a wardrobe set before anywhere; the fuller tooltip among equals; none without a tooltip', () => {
  const real = [
    { id: 'HELM', at: ['Ender Chest'], tip: { HEALTH: 99 } },
    { id: 'HELM', at: ['Wardrobe Set 2'], tip: { HEALTH: 60 } },
    { id: 'HELM', at: ['Getragen', 'Wardrobe Set 1'], tip: { HEALTH: 50 } },
    { id: 'DRILL', at: ['Inventar'] },
  ];
  assert.deepEqual(realItem('HELM', real).tip, { HEALTH: 50 });
  assert.deepEqual(realItem('HELM', real.slice(0, 2)).tip, { HEALTH: 60 });
  assert.equal(realItem('DRILL', real), null);
  assert.equal(realItem('HELM', null), null);
});

test('compareTip: the difference per stat, and whether the two figures disagree', () => {
  assert.deepEqual(compareTip({ A: 10 }, { A: 10 }, ['A']), { delta: {}, differs: false });
  assert.deepEqual(compareTip({ A: 12 }, { A: 10, B: 1 }, ['A', 'B']), { delta: { A: 2, B: -1 }, differs: true });
});

const run = (o) => gearOf({ guides: [], checks: {}, owned: ['DRILL', 'HELM'], items, area: 'mining', build: null, settings: miningSettings(), ...o });

test('gear: an owned piece with a tooltip counts the tooltip, one without keeps the own sum', () => {
  assert.equal(run({}).gear.MINING_SPEED, 1000);
  const real = [{ id: 'DRILL', at: ['Getragen'], tip: { MINING_SPEED: 1500, MINING_FORTUNE: 40 } }];
  const g = run({ real });
  assert.equal(g.gear.MINING_SPEED, 1500);
  assert.equal(g.gear.MINING_FORTUNE, 40 + 5); // the helmet keeps its own 5
  const d = g.pieces.find((x) => x.id === 'DRILL');
  assert.equal(d.source, 'game');
  assert.equal(d.differs, true);
  assert.equal(g.pieces.find((x) => x.id === 'HELM').source, 'calculated');
});

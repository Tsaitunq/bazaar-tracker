import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pieceParts, realItem, compareTip, loreCompleted } from '../../apps/guide/gear-parts.js';
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
  assert.ok(p.conditional.some((c) => /lapidary 5/.test(c.text) && /only on gemstones/.test(c.text) && c.stat));
});

test('the Recombobulator lifts reforge and gems: they show at the higher rarity, like the game lists them, with no line of its own', () => {
  const p = pieceParts(piece('DRILL', { reforge: 'jaded', recomb: true }), items);
  assert.equal(p.lines.MINING_SPEED.find((l) => l.part === 'reforge').value, 60); // 45 plus the 15 the rise gives
  assert.equal(p.lines.MINING_SPEED.some((l) => l.part === 'recomb'), false);
});

test('a drill is listed as the game does: Efficiency X, the reforge and the gem by name, one Drill Parts line', () => {
  const p = pieceParts(piece('DRILL', { reforge: 'jaded', gems: [{ slot: 'AMBER_0', type: 'AMBER', quality: 'PERFECT' }], enchants: { efficiency: 10 }, parts: { engine: 'TITANIUM_DRILL_ENGINE', fuel_tank: 'TITANIUM_FUEL_TANK' } }), items);
  assert.deepEqual(p.lines.MINING_SPEED.map((l) => l.label), ['Base', 'Jaded', 'Amber', 'Efficiency X', 'Drill Parts']);
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

test('loreCompleted: a tooltip that holds everything stays; one that lacks the parts and Polarvoid gets them added, once', () => {
  const p = pieceParts(piece('DRILL', { enchants: { efficiency: 5 }, parts: { engine: 'TITANIUM_DRILL_ENGINE' }, polarvoid: 5 }), items);
  const stats = ['MINING_SPEED', 'MINING_FORTUNE'];
  const whole = { MINING_SPEED: p.total.MINING_SPEED, MINING_FORTUNE: p.total.MINING_FORTUNE };
  assert.deepEqual(loreCompleted(whole, p, stats), { tip: whole, lacks: [] });
  const cut = { MINING_SPEED: p.total.MINING_SPEED - 150 - 50, MINING_FORTUNE: p.total.MINING_FORTUNE - 15 - 5, GEMSTONE_FORTUNE: 40 };
  const out = loreCompleted(cut, p, stats);
  assert.deepEqual(out.lacks, ['parts', 'polarvoid']);
  assert.equal(out.tip.MINING_SPEED, p.total.MINING_SPEED);
  assert.equal(out.tip.GEMSTONE_FORTUNE, 40);
  const onlyPolar = { MINING_SPEED: p.total.MINING_SPEED - 50, MINING_FORTUNE: p.total.MINING_FORTUNE - 5 };
  assert.deepEqual(loreCompleted(onlyPolar, p, stats).lacks, ['polarvoid']);
  const odd = { MINING_SPEED: 7, MINING_FORTUNE: 7 }; // no known set explains it: stays as it is
  assert.deepEqual(loreCompleted(odd, p, stats), { tip: odd, lacks: [] });
});

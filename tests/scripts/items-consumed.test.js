import test from 'node:test';
import assert from 'node:assert/strict';
import { compactItems } from '../../scripts/items.mjs';

test('drills are marked consumed (the upgrade uses them up), other items are not', () => {
  const out = compactItems({ items: [
    { id: 'TITANIUM_DRILL_1', category: 'DRILL', museum_data: { parent: { TITANIUM_DRILL_1: 'TITANIUM_DRILL_2' } } },
    { id: 'DIVAN_DRILL', category: 'DRILL' },
    { id: 'REFINED_MITHRIL_PICKAXE', category: 'PICKAXE' },
    { id: 'DIVAN_HELMET', category: 'HELMET' },
  ] }, {});
  assert.equal(out.TITANIUM_DRILL_1.consumed, true);
  assert.equal(out.DIVAN_DRILL.consumed, true);
  assert.equal('consumed' in out.REFINED_MITHRIL_PICKAXE, false);
  assert.equal('consumed' in out.DIVAN_HELMET, false);
});

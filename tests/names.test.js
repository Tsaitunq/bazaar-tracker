import test from 'node:test';
import assert from 'node:assert/strict';
import { fallbackName, nameMap, npcMap } from '../names.js';

test('fallbackName derives a readable name from the id', () => {
  assert.equal(fallbackName('ENCHANTMENT_ULTIMATE_WISE_5'), 'Ultimate Wise 5');
  assert.equal(fallbackName('SHARD_SEA_ARCHER'), 'Sea Archer Shard');
  assert.equal(fallbackName('ESSENCE_WITHER'), 'Wither Essence');
  assert.equal(fallbackName('FACTION_RABBIT_WALKER'), 'Faction Rabbit Walker');
});

test('nameMap maps id to name and strips colour codes', () => {
  assert.deepEqual(nameMap([{ id: 'A', name: '§6Gold Thing' }, { id: 'B', name: 'Plain' }]), { A: 'Gold Thing', B: 'Plain' });
});

test('npcMap keeps only positive npc prices', () => {
  assert.deepEqual(npcMap([{ id: 'A', npc_sell_price: 5 }, { id: 'B' }, { id: 'C', npc_sell_price: 0 }]), { A: 5 });
});

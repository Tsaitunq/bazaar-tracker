import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { keyOf, assignKeys, legacyMap, essenceSteps, reforgeHint, cleanHint, pieceOf } from '../../scripts/guide/mining-steps.mjs';

const items = { DIVAN_HELMET: { category: 'HELMET' }, TITANIUM_DRILL_2: { category: 'DRILL' }, DIVAN_DRILL: { category: 'DRILL' } };
const gem = (text, id, type, quality) => ({ text, detect: { kind: 'gem', on: [[id]], type, quality, need: 1 } });

test('keys: item, gem, reforge, perk, and the drill chain is one piece', () => {
  const ctx = { guide: {}, items };
  assert.equal(keyOf({ text: 'x', detect: { kind: 'owned', on: [['DIVAN_HELMET']] }, items: [{ id: 'DIVAN_HELMET', qty: 1 }] }, ctx), 'item:DIVAN_HELMET');
  assert.equal(keyOf(gem('Helmet: Flawless Jade Slot 2', 'DIVAN_HELMET', 'JADE', 'FLAWLESS'), ctx), 'gem:divan_helmet:JADE:FLAWLESS:2');
  assert.equal(keyOf({ text: 'x', detect: { kind: 'reforge', on: [['DIVAN_HELMET']], value: ['jaded'] } }, ctx), 'reforge:divan_helmet:jaded');
  assert.equal(keyOf({ text: 'x', detect: { kind: 'essence', perk: 'eager_miner', level: 3 } }, ctx), 'perk:eager_miner:3');
  const flow = (id) => ({ text: 'f', detect: { kind: 'enchant', on: [[id]], enchant: 'ultimate_flowstate', level: 2 } });
  assert.equal(keyOf(flow('TITANIUM_DRILL_2'), ctx), 'enchant:drill:ultimate_flowstate:2');
  assert.equal(keyOf(flow('DIVAN_DRILL'), ctx), 'enchant:drill:ultimate_flowstate:2');
  assert.equal(pieceOf('DIVAN_HELMET', items), 'divan_helmet');
});

test('keys: a group name in `on` is resolved, a repeated meaning keeps only its first key', () => {
  const guide = { groups: { drill: [['TITANIUM_DRILL_2']] }, sections: [{ name: 'S', steps: [
    { text: 'a', detect: { kind: 'enchant', on: 'drill', enchant: 'fortune', level: 3 } },
    { text: 'b', detect: { kind: 'enchant', on: [['DIVAN_DRILL']], enchant: 'fortune', level: 3 } },
  ] }] };
  const out = assignKeys(guide, items);
  assert.equal(out.sections[0].steps[0].key, 'enchant:drill:fortune:3');
  assert.equal(out.sections[0].steps[1].key, undefined);
});

test('legacy: an old step of another guide maps to the new key, an unknown one is left out', () => {
  const old = { sections: [{ name: 'Old', steps: [
    gem('Jade on the helmet', 'DIVAN_HELMET', 'JADE', 'FLAWLESS'),
    { text: 'Something else', detect: { kind: 'held', on: [['X']] } },
  ] }] };
  const out = legacyMap(old, new Set(['gem:divan_helmet:JADE:FLAWLESS:1']), items);
  assert.deepEqual(out, { 'Old|Jade on the helmet': 'gem:divan_helmet:JADE:FLAWLESS:1' });
});

test('essence steps: every level, cost per level, chain, Cut Loose has no gain', () => {
  const data = JSON.parse(fs.readFileSync('gamedata/essence-perks.json', 'utf8'));
  const steps = essenceSteps(data);
  assert.equal(steps.length, 10 + 10 + 10 + 5 + 5);
  const eager3 = steps.find((s) => s.perk === 'eager_miner' && s.level === 3).step;
  assert.deepEqual(eager3.items, [{ id: 'ESSENCE_GOLD', qty: 300 }]);
  assert.deepEqual(eager3.gain, { MINING_SPEED: 10 });
  assert.equal(eager3.key, 'perk:eager_miner:3');
  assert.deepEqual(eager3.after, ['Gold Essence Shop: Eager Miner II']);
  const dmf = steps.find((s) => s.perk === 'dwarven_expertise' && s.level === 1).step;
  assert.deepEqual(dmf.gain, { DWARVEN_METAL_FORTUNE: 2 });
  const cut = steps.filter((s) => s.perk === 'cut_loose').map((s) => s.step);
  assert.ok(cut.every((s) => !s.gain && /not counted/.test(s.hint)));
  assert.equal(steps.filter((s) => s.perk === 'frozen_skin').at(-1).step.items[0].qty, 5000);
  const sum = (perk) => steps.filter((s) => s.perk === perk).reduce((n, s) => n + s.step.items[0].qty, 0);
  assert.equal(sum('cut_loose'), 7500);
  assert.equal(new Set(steps.map((s) => s.step.key)).size, steps.length);
});

test('jaded hint: stats per rarity, Mythic after the Recombobulator; clean hint lists the stats', () => {
  assert.equal(reforgeHint('jaded', 'LEGENDARY'), 'Jaded at Legendary: +45 Mining Speed +25 Mining Fortune, Mythic (after the Recombobulator) +60 Mining Speed +30 Mining Fortune');
  assert.equal(reforgeHint('nope', 'LEGENDARY'), null);
  assert.equal(cleanHint({ DEFENSE: 130, MINING_FORTUNE: 30 }), 'Clean: Defense 130, Mining Fortune 30');
});

import { cleanItem, gemConflicts } from '../../scripts/guide/mining-steps.mjs';

test('an item line with a stone inside becomes the clean item: the stone leaves the text and the gain', () => {
  const out = cleanItem("Divan's Helmet (mit Perfect Topaz)", { MINING_SPEED: 80, MINING_FORTUNE: 30, PRISTINE: 2 }, 'LEGENDARY');
  assert.equal(out.text, "Divan's Helmet");
  assert.deepEqual(out.gain, { MINING_SPEED: 80, MINING_FORTUNE: 30 });
  assert.deepEqual(out.gem, { type: 'TOPAZ', quality: 'PERFECT' });
  assert.equal(cleanItem('Titanium Drill DR-X355', {}, 'EPIC'), null);
  assert.equal(cleanItem('Piece (mit Flawless Topaz)', { PRISTINE: 2.5 }, 'LEGENDARY').gain.PRISTINE, 0.9);
});

test('gem slots: a slot twice, a Perfect without Flawless and a stone inside an item step are found', () => {
  const g = (...steps) => ({ sections: [{ name: 'S', steps }] });
  const flawless = gem('Helm: Flawless Topaz Slot 1', 'DIVAN_HELMET', 'TOPAZ', 'FLAWLESS');
  const perfect = gem('Helm: Perfect Topaz Slot 1', 'DIVAN_HELMET', 'TOPAZ', 'PERFECT');
  assert.deepEqual(gemConflicts(g(flawless, perfect), items), []);
  assert.match(gemConflicts(g(flawless, { ...flawless, text: 'again' }), items)[0], /slot twice/);
  assert.match(gemConflicts(g(perfect), items)[0], /Perfect without Flawless/);
  assert.match(gemConflicts(g({ text: 'Helm (mit Perfect Topaz)' }), items)[0], /stone inside/);
});

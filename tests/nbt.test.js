import test from 'node:test';
import assert from 'node:assert/strict';
import { readNbt, decodeInventory, MAX_INFLATED } from '../nbt.js';
import { tag, encodeNbt, encodeInventory, gzipBase64 } from './fixtures/nbt-encode.js';

test('decodeInventory reads a slot with nested attributes', async () => {
  const b64 = encodeInventory([{ id: 278, Count: 1, tag: { ExtraAttributes: { id: 'DIVAN_DRILL', modifier: 'jaded', enchantments: { fortune: 4 } }, display: { Lore: ['§7Mining Speed: §a+1,800'] } } }]);
  const [slot] = await decodeInventory(b64);
  assert.equal(slot.tag.ExtraAttributes.id, 'DIVAN_DRILL');
  assert.equal(slot.tag.ExtraAttributes.enchantments.fortune, 4);
  assert.deepEqual(slot.tag.display.Lore, ['§7Mining Speed: §a+1,800']);
});

test('an empty slot decodes to an empty object', async () => {
  assert.deepEqual(await decodeInventory(encodeInventory([{}, { id: 1 }])), [{}, { id: 1 }]);
});

test('readNbt covers all tag types', () => {
  const out = readNbt(encodeNbt({
    b: tag.byte(-1), s: tag.short(-2), i: tag.int(-3), l: tag.long(5), f: tag.float(1.5), d: tag.double(2.25),
    ba: tag.bytes([1, -1]), st: tag.string('ä§'), li: tag.list([tag.int(1), tag.int(2)]), c: tag.compound({ x: tag.int(9) }), ia: tag.ints([7]), la: tag.longs([8]), empty: tag.list([]),
  }));
  assert.deepEqual(out, { b: -1, s: -2, i: -3, l: 5, f: 1.5, d: 2.25, ba: [1, -1], st: 'ä§', li: [1, 2], c: { x: 9 }, ia: [7], la: [8], empty: [] });
});

test('a long beyond the safe range stays exact as a string', () => {
  assert.equal(readNbt(encodeNbt({ l: tag.long(2n ** 60n) })).l, '1152921504606846976');
  assert.equal(readNbt(encodeNbt({ l: tag.long(-(2n ** 60n)) })).l, '-1152921504606846976');
});

test('a key named __proto__ does not change the prototype', () => {
  const out = readNbt(encodeNbt({ ['__proto__']: tag.compound({ polluted: tag.int(1) }) }));
  assert.equal(out.polluted, undefined);
  assert.equal({}.polluted, undefined);
});

test('truncated, non-gzip and absurd-length data reject', async () => {
  const good = encodeNbt({ i: tag.list([tag.int(1)]) });
  assert.throws(() => readNbt(good.subarray(0, good.length - 3)));
  await assert.rejects(decodeInventory(gzipBase64(good.subarray(0, 6))));
  await assert.rejects(decodeInventory('bm90Z3ppcA=='));
  await assert.rejects(decodeInventory('%%%'));
  // a list that claims 2^31-1 entries of an int
  const huge = Buffer.from([10, 0, 0, 9, 0, 1, 105, 3, 0x7f, 0xff, 0xff, 0xff]);
  assert.throws(() => readNbt(huge));
  // lists nested deeper than anything real
  let deep = tag.int(1);
  for (let n = 0; n < 70; n++) deep = tag.list([deep]);
  assert.throws(() => readNbt(encodeNbt({ d: deep })), /deep/);
});

test('data that unpacks past the limit rejects as too large', async () => {
  await assert.rejects(decodeInventory(gzipBase64(new Uint8Array(MAX_INFLATED + 1))), /too large/);
});

test('an inventory without a slot list rejects', async () => {
  await assert.rejects(decodeInventory(gzipBase64(encodeNbt({ other: tag.int(1) }))));
});

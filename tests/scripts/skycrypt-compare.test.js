import test from 'node:test';
import assert from 'node:assert/strict';
import { ourItems, skycryptItems, diffItems, diffProfile, renderTable } from '../../scripts/lib/skycrypt-compare.mjs';
import { encodeInventory, tag } from '../fixtures/guide/nbt-encode.js';

const nbt = (id, extra = {}) => ({ id: tag.short(1), Count: tag.byte(1), tag: tag.compound({ ExtraAttributes: tag.compound({ id: tag.string(id), uuid: tag.string(`u-${id}`), ...extra }) }) });
const sky = (id, extra = {}) => ({ Count: 1, tag: { ExtraAttributes: { id, uuid: `u-${id}`, ...extra } } });

test('the same item on both sides gives no row; a different Polarvoid, gem quality and place do', async () => {
  const mine = await ourItems({ inventory: encodeInventory([nbt('TITANIUM_DRILL_4', { polarvoid: tag.int(5), gems: tag.compound({ JADE_0: tag.string('FLAWLESS') }) })]) });
  const same = skycryptItems({ items: { inventory: [sky('TITANIUM_DRILL_4', { polarvoid: 5, gems: { JADE_0: 'FLAWLESS' } })] } });
  assert.deepEqual(diffItems(mine, same), []);
  const other = skycryptItems({ items: { enderchest: [sky('TITANIUM_DRILL_4', { polarvoid: 4, gems: { JADE_0: 'PERFECT' } })] } });
  const rows = diffItems(mine, other);
  assert.deepEqual(rows.map((r) => r.field).sort(), ['gems', 'places', 'polarvoid']);
  // nothing private in a row or in the table
  assert.ok(!JSON.stringify(rows).includes('u-TITANIUM'));
  assert.ok(!renderTable(rows).includes('u-TITANIUM'));
});

test('an item only one side has is one row', async () => {
  const mine = await ourItems({ inventory: encodeInventory([nbt('A')]) });
  const rows = diffItems(mine, skycryptItems({ items: { inventory: [sky('B')] } }));
  assert.deepEqual(rows.map((r) => [r.id, r.ours, r.theirs]), [['A', 'yes', 'no'], ['B', 'no', 'yes']]);
});

test('profile parts: levels, tier, pets; a part SkyCrypt does not give says so', () => {
  const summary = { hotm: { tier: 7, ability: 'pickobulus', levels: { mining_speed: 50 } }, attrLevels: { a: 10 }, essence: null, pets: [{ type: 'BEE', tier: 'LEGENDARY', active: true }] };
  const rows = diffProfile(summary, { mining: { core: { tier: { level: 6 }, nodes: { mining_speed: 49 } } }, pets: [{ type: 'bee', tier: 'epic', active: true }] });
  assert.deepEqual(rows.map((r) => `${r.area}:${r.id}`), ['hotm:tier', 'hotm:mining_speed', 'attribute:attributes', 'pet:BEE LEGENDARY', 'pet:BEE EPIC', 'pet:active']);
  assert.equal(renderTable([]), 'No differences.\n');
});

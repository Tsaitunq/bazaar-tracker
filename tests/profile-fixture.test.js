// Against the real test copy, which stays out of git: without the file this is skipped. Prints no values.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { summarize } from '../profile.js';

const FILE = 'personal/fixtures/profile-fixture.json';

test('the real test copy gives a well-formed summary', { skip: !existsSync(FILE) }, async () => {
  const out = await summarize(JSON.parse(readFileSync(FILE, 'utf8')).members.self);
  assert.ok(out.items.length > 0);
  assert.deepEqual(out.missing, { inventory: false, collections: false, skills: false });
  for (const item of out.items) {
    assert.equal(typeof item.id, 'string');
    assert.equal(typeof item.where, 'string');
    assert.ok(Array.isArray(item.gems));
    for (const v of Object.values(item.lore)) assert.ok(Number.isFinite(v));
  }
  const text = JSON.stringify(out);
  assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(text), 'no uuid in the summary');
  assert.ok(!text.includes('"uuid"'));
});

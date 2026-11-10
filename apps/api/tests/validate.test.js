import test from 'node:test';
import assert from 'node:assert/strict';
import { validName, validProfileId, plainId, dashedId } from '../src/validate.js';

test('name: 3-16 chars of A-Za-z0-9_', () => {
  for (const ok of ['abc', 'A_b_9', 'a'.repeat(16)]) assert.ok(validName(ok), ok);
  for (const bad of ['', 'ab', 'a'.repeat(17), 'a b', 'a-b', 'ä_ö', 'a/b', 'a%20b', 'a\nb']) assert.ok(!validName(bad), JSON.stringify(bad));
});

test('profile id: uuid with or without dashes', () => {
  const dashed = '11111111-1111-4111-8111-111111111111';
  assert.ok(validProfileId(dashed));
  assert.ok(validProfileId(plainId(dashed)));
  assert.ok(!validProfileId('not-a-uuid'));
  assert.ok(!validProfileId(dashed + 'x'));
  assert.equal(dashedId(plainId(dashed.toUpperCase())), dashed);
});

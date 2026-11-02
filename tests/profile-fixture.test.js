// Against the real test copy, which stays out of git: without the file this is skipped. Prints no values.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { summarize } from '../profile.js';
import { detectGuide } from '../detect.js';
import { validGuide, stepKey } from '../progress.js';
import { guideModel } from '../guide/model.js';

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

const GUIDES = 'personal/guides';

test('the attack speed shard of the real guide has the bazaar id', { skip: !existsSync(`${GUIDES}/blaze-slayer.json`) }, () => {
  const text = readFileSync(`${GUIDES}/blaze-slayer.json`, 'utf8');
  assert.ok(text.includes('SHARD_BURNINGSOUL'));
  assert.ok(!text.includes('SHARD_INFERNO_DEMONLORD'));
  assert.ok(!text.includes('Inferno Demonlord Shard is not on the Bazaar'));
});

test('the real guides survive validation and draw against the real test copy', { skip: !existsSync(FILE) || !existsSync(GUIDES) }, async () => {
  const profile = await summarize(JSON.parse(readFileSync(FILE, 'utf8')).members.self);
  for (const file of readdirSync(GUIDES).filter((f) => f.endsWith('.json') && f !== 'index.json')) {
    const raw = JSON.parse(readFileSync(`${GUIDES}/${file}`, 'utf8'));
    const guide = { id: file, ...validGuide(raw) };
    const rules = (g) => g.sections.flatMap((s) => s.steps).filter((s) => s.detect).length;
    assert.equal(rules(guide), rules(raw), 'no rule lost');
    assert.ok(guideModel(guide, { marks: new Set(), products: {}, name: (x) => x, state: { summary: profile } }).rows.length > 0);
    assert.ok(detectGuide(guide, profile, stepKey).size > 0);
  }
});

test('the shards at full level in the real test copy are checked', { skip: !existsSync(FILE) || !existsSync(GUIDES) }, async () => {
  const profile = await summarize(JSON.parse(readFileSync(FILE, 'utf8')).members.self);
  const guide = { id: 'b', ...validGuide(JSON.parse(readFileSync(`${GUIDES}/blaze-slayer.json`, 'utf8'))) };
  const { rows } = guideModel(guide, { marks: new Set(), products: {}, name: (x) => x, state: { summary: profile } });
  for (const text of ['Blazing Resistance', 'Infernal Ruler', 'Warrior', 'Shell', 'Veil', 'Elite']) {
    const row = rows.find((r) => r.key.endsWith(`|${text}`));
    assert.deepEqual([row.status, row.api], ['done', true], text);
  }
});

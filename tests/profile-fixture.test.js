// Against the real test copy, which stays out of git: without the file this is skipped. Prints no values.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { summarize } from '../profile.js';
import { detectGuide } from '../detect.js';
import { validGuide, progressView, stepKey } from '../progress.js';

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

test('the real guides survive validation and draw against the real test copy', { skip: !existsSync(FILE) || !existsSync(GUIDES) }, async () => {
  const profile = await summarize(JSON.parse(readFileSync(FILE, 'utf8')).members.self);
  for (const file of readdirSync(GUIDES).filter((f) => f.endsWith('.json') && f !== 'index.json')) {
    const raw = JSON.parse(readFileSync(`${GUIDES}/${file}`, 'utf8'));
    const guide = { id: file, ...validGuide(raw) };
    const rules = (g) => g.sections.flatMap((s) => s.steps).filter((s) => s.detect).length;
    assert.equal(rules(guide), rules(raw), 'no rule lost');
    for (const mode of ['slot', 'next']) {
      const html = progressView({ guides: [guide], current: file, checked: new Set(), products: {}, name: (x) => x, mode, profile });
      assert.ok(html.includes('data-step='));
    }
    assert.ok(detectGuide(guide, profile, stepKey).size > 0);
  }
});

test('the shards at full level in the real test copy are checked', { skip: !existsSync(FILE) || !existsSync(GUIDES) }, async () => {
  const profile = await summarize(JSON.parse(readFileSync(FILE, 'utf8')).members.self);
  const guide = { id: 'b', ...validGuide(JSON.parse(readFileSync(`${GUIDES}/blaze-slayer.json`, 'utf8'))) };
  const html = progressView({ guides: [guide], current: 'b', checked: new Set(), products: {}, name: (x) => x, profile });
  const row = (text) => { const at = html.search(new RegExp(`data-step="[^"]*\\|${text}"`)); return html.slice(at, html.indexOf('</li>', at)); };
  for (const text of ['Blazing Resistance', 'Infernal Ruler', 'Warrior', 'Shell', 'Veil', 'Elite']) {
    assert.match(row(text), /" checked>/, text);
    assert.match(row(text), /data-src="api"/, text);
  }
});

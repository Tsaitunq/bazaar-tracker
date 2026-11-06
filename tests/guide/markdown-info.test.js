import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { markdown, outline } from '../../apps/guide/markdown.js';
import { validGuide } from '../../apps/guide/progress.js';
import { guideView } from '../../apps/guide/views/guide.js';
import { attrCategory, ATTR_CATEGORIES } from '../../apps/guide/attrs-model.js';
import { profileLink } from '../../apps/guide/views/parts.js';

const MD = `# Title
<!-- private note
over two lines -->
## Basics
- **bold** and *soft* and \`code\`
- <b>x</b>

1. one
2. two

## Basics
### Table
| A | B |
|---|---|
| 1 | two |
Plain <script> text.`;

test('markdown-light: headings, lists, emphasis, tables; comments dropped, HTML escaped', () => {
  const html = markdown(MD);
  assert.match(html, /<h3 id="info-title">Title<\/h3>/);
  assert.doesNotMatch(html, /private note|over two lines/);
  assert.match(html, /<ul><li><b>bold<\/b> and <i>soft<\/i> and <code>code<\/code><\/li><li>&#60;b&#62;x&#60;\/b&#62;<\/li><\/ul>/);
  assert.match(html, /<ol><li>one<\/li><li>two<\/li><\/ol>/);
  assert.match(html, /<th>A<\/th><th>B<\/th>[^]*<td>1<\/td><td>two<\/td>/);
  assert.match(html, /<p>Plain &#60;script&#62; text\.<\/p>/);
});

test('outline: level 2 and 3 headings with the same ids as the html, repeated names get a number', () => {
  assert.deepEqual(outline(MD), [
    { id: 'info-basics', text: 'Basics', level: 2 },
    { id: 'info-basics-2', text: 'Basics', level: 2 },
    { id: 'info-table', text: 'Table', level: 3 },
  ]);
  assert.match(markdown(MD), /id="info-basics-2"/);
});

test('the info field survives validGuide and shows as a card with contents; open until seen', () => {
  const g = validGuide({ title: 'T', info: '## Basics\ntext\n## Run\nmore', sections: [{ name: 'S', steps: [{ text: 'x' }] }] });
  assert.match(g.info, /Basics/);
  const guide = { id: 't', area: 'mining', ...g };
  const world = (extra = {}) => ({ guides: [guide], checks: {}, owned: [], dates: {}, base: {}, build: {}, ui: {}, prices: {}, settings: {}, now: 0, ...extra });
  const fresh = guideView(world(), 't');
  assert.match(fresh, /<details class="info-card" data-keep-open="info" data-info-card="t" open><summary>So läuft's<\/summary>/);
  assert.match(fresh, /data-info-goto="info-run"/);
  assert.match(fresh, /data-info="card"/);
  assert.doesNotMatch(guideView(world({ infoSeen: ['t'] }), 't'), /data-info-card="t" open/);
});

test('attribute categories are the ones of the game menu', () => {
  assert.deepEqual(ATTR_CATEGORIES, ['combat', 'fishing', 'farming', 'foraging', 'mining', 'taming', 'enchanting', 'hunting', 'global']);
  const data = { stats: { stats: [{ id: 'MINING_SPEED', category: 'mining' }] } };
  assert.equal(attrCategory(data, { key: 'x', effects: [{ stat: 'MINING_SPEED' }] }), 'mining');
  assert.equal(attrCategory(data, { key: 'x', effects: [{ stat: 'TAMING_WISDOM' }] }), 'taming');
  assert.equal(attrCategory(data, { key: 'lake_fishing', effects: [] }), 'fishing');
  assert.equal(attrCategory(data, { key: 'sack_size', effects: [] }), 'global');
});

test('the profile button carries a head canvas that the skin paints, hat layer included', () => {
  assert.match(profileLink(), /<canvas data-head/);
  const skin = readFileSync(new URL('../../apps/guide/skin.js', import.meta.url), 'utf8');
  assert.match(skin, /for \(const sx of \[8, 40\]\) g\.drawImage\(skin, sx, 8, 8, 8/);
  assert.match(readFileSync(new URL('../../apps/guide/guide.css', import.meta.url), 'utf8'), /\.profile canvas \{[^}]*image-rendering: pixelated/);
});

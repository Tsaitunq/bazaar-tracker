import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { effectLines, effectShort } from '../../apps/guide/attrs-model.js';

const read = (n) => JSON.parse(fs.readFileSync(`gamedata/${n}.json`, 'utf8'));
const data = { stats: read('stats'), attributes: read('attributes') };
const attr = (key) => data.attributes.attributes.find((a) => a.key === key);

test('Freezing Spread at 100 Cold Resistance, level 10: 2.5 Gemstone Spread, shown, not summed', () => {
  const [line] = effectLines(data, attr('freezing_spread'), 10, { COLD_RESISTANCE: 100 });
  assert.equal(line.now, 'now: +2.5 Gemstone Spread');
  assert.equal(line.summed, false);
  assert.match(line.text, /\+0\.5 Gemstone Spread per 20 Cold Resistance/);
  assert.doesNotMatch(line.text, /ca\./);
});

test('Freezing Spread: 0.05 per level, only levels 1 and 10 are exact, no stat value gives no "now"', () => {
  const l1 = effectLines(data, attr('freezing_spread'), 1)[0];
  assert.match(l1.text, /\+0\.05 .* per 29 /);
  assert.equal(l1.now, null);
  const l5 = effectLines(data, attr('freezing_spread'), 5, { COLD_RESISTANCE: 100 })[0];
  assert.match(l5.text, /\+0\.25 .*\(ca\.\)/);
});

test('no attribute is left without an effect kind or a text, and per_stat has an "every" over 1', () => {
  for (const a of data.attributes.attributes) {
    assert.ok(a.effectKind, a.key);
    assert.ok(effectLines(data, a, 1).length > 0, `${a.key} shows nothing`);
    assert.doesNotMatch(effectShort(data, a, 1), /not found|unknown stat/, a.key);
    for (const e of a.effects.filter((x) => x.kind === 'per_stat')) {
      const ev = e.per.every;
      assert.ok((typeof ev === 'number' ? ev : Math.min(ev.level1, ev.level10)) > 1, `${a.key}: "per 1" instead of "per N"`);
    }
  }
});

test('only flat effects that always hold are summed', () => {
  for (const a of data.attributes.attributes) {
    for (const l of effectLines(data, a, 3)) if (l.summed) assert.equal(a.effectKind === 'flat' || a.effectKind === 'other', true, a.key);
  }
});

test('a text attribute scales its number and says "ca." above level I', () => {
  const a = attr('experience');
  assert.match(effectLines(data, a, 1)[0].text, /\+10%/);
  assert.match(effectLines(data, a, 3)[0].text, /\+30%.*\(ca\.\)/);
});

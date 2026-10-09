import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync('style.css', 'utf8');
const tokens = Object.fromEntries([...css.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})\b/g)].map((m) => [m[1], m[2]]));

// WCAG 2 relative luminance and contrast ratio
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const AA = 4.5;
const SURFACES = ['bg', 'page-top', 'header-bg', 'card', 'card-hover', 'raised'];
const TEXT_COLOURS = ['text', 'muted', 'accent', 'gain', 'loss', 'warn', 'stable', 'medium', 'unstable'];
// the rarity word on a card is text; the stripe and tile border use the same colours
const RARITY_COLOURS = ['r-common', 'r-uncommon', 'r-rare', 'r-epic', 'r-legendary', 'r-mythic', 'r-divine', 'r-special'];

test('the contrast helper matches known values', () => {
  assert.ok(Math.abs(contrast('#000000', '#ffffff') - 21) < 0.01);
  assert.ok(Math.abs(contrast('#777777', '#ffffff') - 4.48) < 0.01);
});

test('every text colour reaches WCAG AA on every surface', () => {
  for (const fg of [...TEXT_COLOURS, ...RARITY_COLOURS]) {
    for (const bg of SURFACES) {
      assert.ok(tokens[fg] && tokens[bg], `missing token ${fg} or ${bg}`);
      const ratio = contrast(tokens[fg], tokens[bg]);
      assert.ok(ratio >= AA, `--${fg} on --${bg} is ${ratio.toFixed(2)} : 1`);
    }
  }
});

test('text on the accent colour reaches WCAG AA', () => {
  const ratio = contrast(tokens['on-accent'], tokens.accent);
  assert.ok(ratio >= AA, `--on-accent on --accent is ${ratio.toFixed(2)} : 1`);
});

test('every colour used in the stylesheet is a checked token', () => {
  const used = new Set([...css.matchAll(/var\(--([a-z-]+)/g)].map((m) => m[1]));
  const known = new Set([...SURFACES, ...TEXT_COLOURS, ...RARITY_COLOURS, 'on-accent', 'line', 'rarity', 'page', 'safe-area-inset-top', 'safe-area-inset-bottom']);
  assert.deepEqual([...used].filter((t) => !known.has(t)), []);
  // no colour is written directly into a rule
  const rules = css.slice(css.indexOf('}') + 1);
  assert.deepEqual(rules.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], []);
});

test('the accent is not reused for a meaning', () => {
  const meanings = ['gain', 'loss', 'warn', 'stable', 'medium', 'unstable'].map((t) => tokens[t].toLowerCase());
  assert.ok(!meanings.includes(tokens.accent.toLowerCase()));
});

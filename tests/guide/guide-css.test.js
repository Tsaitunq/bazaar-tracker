import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync('guide/guide.css', 'utf8');
// the table of docs/design-guide-app.md
const DOC = {
  home: { area: '#9B6BFF', bg: '#0B0A10', surface: '#15131C', raised: '#1A1626', deep: '#0F0D16', line: '#2A2636', track: '#221E2E', muted: '#A39DB5', soft: '#C9C4D6', text: '#F2F0F7', dim: '#3D3750' },
  stats: { area: '#B794FF', bg: '#0B0A10', surface: '#15131C', raised: '#221E2E', deep: '#0F0D16', line: '#2A2636', track: '#221E2E', muted: '#A39DB5', soft: '#C9C4D6', text: '#F2F0F7', dim: '#3D3750', k1: '#D6C2FF', k2: '#B794FF', k3: '#7A4FD6' },
  mining: { area: '#5CC8FF', bg: '#090B0E', surface: '#111821', raised: '#15202C', deep: '#0C1218', line: '#1E2A36', track: '#1A2532', muted: '#9AAAB8', soft: '#C4D2DD', text: '#EEF3F7', dim: '#2A3A48', k1: '#BDEBFF', k2: '#5CC8FF', k3: '#2F6FD6' },
  blaze: { area: '#FF8A3D', bg: '#0D0908', surface: '#1A1210', raised: '#22160F', deep: '#120C0A', line: '#33221F', track: '#2A1C1A', muted: '#B8A39C', soft: '#DCCBC5', text: '#F6F0EE', dim: '#4A3330', k1: '#FFC27A', k2: '#FF8A3D', k3: '#C24A1F' },
  farming: { area: '#5BD46B', bg: '#0A0C0B', surface: '#121714', raised: '#16201A', deep: '#0E1310', line: '#1F2A22', track: '#18221B', muted: '#A3B3A6', soft: '#C9D6CC', text: '#EFF4F0', dim: '#33463A', k1: '#A8EBB1', k2: '#5BD46B', k3: '#2E8A3C' },
};
const tokens = (name) => Object.fromEntries([...css.match(new RegExp(`\\[data-theme="${name}"\\] \\{([^}]*)\\}`))[1].matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1], m[2]]));
const root = Object.fromEntries([...css.match(/:root \{([^}]*)\}/)[1].matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1], m[2]]));

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

test('each theme defines every token with the values of the design doc', () => {
  for (const [name, want] of Object.entries(DOC)) {
    const have = tokens(name);
    for (const [token, value] of Object.entries(want)) assert.equal(have[token], value, `${name} ${token}`);
  }
});

test('no colour is written into a rule outside the tokens', () => {
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/:root \{[^}]*\}/, '').replace(/\[data-theme="\w+"\] \{[^}]*\}/g, '');
  assert.doesNotMatch(rules, /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
});

test('text tokens reach 4.5 to 1 on bg and surface in every theme', () => {
  for (const name of Object.keys(DOC)) {
    const t = tokens(name);
    for (const fg of ['text', 'soft', 'muted', 'area']) for (const bg of ['bg', 'surface', 'raised']) assert.ok(contrast(t[fg], t[bg]) >= 4.5, `${name} ${fg} on ${bg}: ${contrast(t[fg], t[bg]).toFixed(2)}`);
  }
});

test('the gain colour and stat colours reach 4.5 to 1 on surface and deep', () => {
  for (const name of Object.keys(DOC)) {
    const t = tokens(name);
    for (const stat of ['stat-orange', 'stat-pink', 'stat-red', 'stat-blue', 'stat-yellow', 'stat-green', 'stat-white', 'stat-cyan', 'gain']) {
      for (const bg of ['surface', 'deep']) assert.ok(contrast(root[stat], t[bg]) >= 4.5, `${name} ${stat} on ${bg}`);
    }
  }
});

test('the button text on area is readable', () => {
  for (const name of Object.keys(DOC)) { const t = tokens(name); assert.ok(contrast(t.bg, t.area) >= 4.5, name); }
});

test('no font comes from outside', () => {
  assert.doesNotMatch(css, /https?:/);
  assert.match(css, /fonts\/space-grotesk-latin-700-normal\.woff2/);
});

test('sizes of the mockups are in the rules', () => {
  assert.match(css, /\.bar \{ flex: none; height: 56px; border-radius: 28px;/);
  assert.match(css, /\.screen-home \.bar \{ height: 60px; border-radius: 30px; \}/);
  assert.match(css, /\.stats-3 \.stat-value \{ font-size: 15px; \}/);
  assert.match(css, /\.step-dot \{ flex: none; width: 22px; height: 22px;/);
});

test('the floating pet bobs, and stands still for reduced motion', () => {
  const css = readFileSync(new URL('../../guide/guide.css', import.meta.url), 'utf8');
  assert.match(css, /\.pet-float \{[^}]*animation: pet-bob/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.pet-float \{ animation: none; \} \}/);
});

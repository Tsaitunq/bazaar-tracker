// Checks every text colour of a variant against every surface it can sit on (WCAG AA, 4.5 : 1).
// node docs/design-varianten/check-contrast.mjs
import fs from 'node:fs';

const tokensOf = (css) => Object.fromEntries([...css.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})\b/g)].map((m) => [m[1], m[2]]));
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const base = tokensOf(fs.readFileSync('style.css', 'utf8'));
let failed = false;
for (const v of ['a', 'b', 'c']) {
  const css = fs.readFileSync(`docs/design-varianten/variant-${v}.css`, 'utf8');
  const t = { ...base, ...tokensOf(css) };
  // surfaces: the tokens plus every solid colour written into a background (gradient stops, hover)
  const extra = [...css.matchAll(/background[^;]*;/g)].flatMap((m) => m[0].match(/#[0-9a-fA-F]{6}\b/g) ?? []);
  const surfaces = [...new Set([t.bg, t.card, t.raised, ...extra])];
  const texts = Object.entries(t).filter(([k]) => ['text', 'muted', 'accent', 'gain', 'loss', 'warn', 'stable', 'medium', 'unstable'].includes(k) || k.startsWith('r-'));
  let worst = [Infinity, ''];
  for (const [name, fg] of texts) {
    for (const bg of surfaces) {
      const r = contrast(fg, bg);
      if (r < worst[0]) worst = [r, `--${name} ${fg} on ${bg}`];
      if (r < 4.5) { failed = true; console.log(`variant ${v}: FAIL ${r.toFixed(2)} --${name} ${fg} on ${bg}`); }
    }
  }
  const onAccent = contrast(t['on-accent'], t.accent);
  console.log(`variant ${v}: ${texts.length} text colours x ${surfaces.length} surfaces, lowest ${worst[0].toFixed(2)} (${worst[1]}), on-accent ${onAccent.toFixed(2)}`);
}
process.exitCode = failed ? 1 : 0;

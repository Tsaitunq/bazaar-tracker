// Draws the app symbol (three rising orange bars on black) for the PWA and Android: node scripts/icons.mjs
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';

const RES = 'android/app/src/main/res';
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const BLACK = [13, 13, 13, 255];
const ORANGE = [255, 138, 0, 255];
const CLEAR = [0, 0, 0, 0];
const SAMPLES = 4;

// x, y run from -0.5 to 0.5; bars as [centre x, height], all standing on one base line
const BARS = [[-0.19, 0.22], [0, 0.36], [0.19, 0.5]];
const BAR_WIDTH = 0.13;
const BASE = 0.25;
const RADIUS = 0.03;

function inBars(x, y, scale) {
  for (const [cx, height] of BARS) {
    const hw = (BAR_WIDTH / 2) * scale;
    const hh = (height / 2) * scale;
    const dx = Math.abs(x - cx * scale);
    const dy = Math.abs(y - (BASE - height / 2) * scale);
    const r = RADIUS * scale;
    if (dx <= hw && dy <= hh && Math.hypot(Math.max(dx - hw + r, 0), Math.max(dy - hh + r, 0)) <= r) return true;
  }
  return false;
}

const solid = (scale) => (x, y) => (inBars(x, y, scale) ? ORANGE : BLACK);
const KINDS = {
  'ic_launcher.png': { size: 48, pixel: solid(0.9) },
  'ic_launcher_round.png': { size: 48, pixel: (x, y) => (Math.hypot(x, y) > 0.5 ? CLEAR : solid(0.8)(x, y)) },
  // adaptive icon layer: 108dp canvas, only the inner 66dp are guaranteed to be visible
  'ic_launcher_foreground.png': { size: 108, pixel: (x, y) => (inBars(x, y, 0.66) ? ORANGE : CLEAR) },
};

function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sum = [0, 0, 0, 0];
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const c = pixel((x + (sx + 0.5) / SAMPLES) / size - 0.5, (y + (sy + 0.5) / SAMPLES) / size - 0.5);
          // premultiply so transparent samples do not darken the edge
          for (let i = 0; i < 3; i++) sum[i] += c[i] * c[3];
          sum[3] += c[3];
        }
      }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      for (let i = 0; i < 3; i++) raw[o + i] = sum[3] ? Math.round(sum[i] / sum[3]) : 0;
      raw[o + 3] = Math.round(sum[3] / (SAMPLES * SAMPLES));
    }
  }
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(zlib.crc32(body), body.length + 4);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// PWA icons are also used as maskable, so the symbol stays inside the inner 80 %
for (const size of [192, 512]) fs.writeFileSync(path.join('icons', `icon-${size}.png`), png(size, solid(0.8)));
for (const [density, scale] of Object.entries(DENSITIES)) {
  for (const [name, { size, pixel }] of Object.entries(KINDS)) {
    fs.writeFileSync(path.join(RES, `mipmap-${density}`, name), png(Math.round(size * scale), pixel));
  }
}
console.log('icons written');

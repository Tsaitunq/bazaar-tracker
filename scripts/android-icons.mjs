// Draws the launcher icons (gold coin on dark ground) into the Android project: node scripts/android-icons.mjs
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';

const RES = 'android/app/src/main/res';
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const BG = [15, 17, 21, 255];
const GOLD = [242, 185, 75, 255];
const DARK_GOLD = [176, 122, 30, 255];
const CLEAR = [0, 0, 0, 0];
const SAMPLES = 4;

// d is the distance from the centre as a fraction of the image size
const coin = (d, r) => (d < r * 0.62 ? GOLD : d < r * 0.78 ? DARK_GOLD : d < r ? GOLD : null);
const KINDS = {
  'ic_launcher.png': { size: 48, pixel: (d) => coin(d, 0.32) ?? BG },
  'ic_launcher_round.png': { size: 48, pixel: (d) => coin(d, 0.32) ?? (d < 0.5 ? BG : CLEAR) },
  // adaptive icon layer: 108dp canvas, only the inner 66dp are guaranteed to be visible
  'ic_launcher_foreground.png': { size: 108, pixel: (d) => coin(d, 0.26) ?? CLEAR },
};

function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sum = [0, 0, 0, 0];
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const px = x + (sx + 0.5) / SAMPLES - size / 2;
          const py = y + (sy + 0.5) / SAMPLES - size / 2;
          const c = pixel(Math.hypot(px, py) / size);
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

for (const [density, scale] of Object.entries(DENSITIES)) {
  for (const [name, { size, pixel }] of Object.entries(KINDS)) {
    fs.writeFileSync(path.join(RES, `mipmap-${density}`, name), png(Math.round(size * scale), pixel));
  }
}
console.log('launcher icons written');

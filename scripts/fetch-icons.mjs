// Fetches the icons of the guide app: node scripts/fetch-icons.mjs  (also: npm run guide:icons)
//  - guide/img/mc/: Minecraft default textures from the local client JAR. Committed.
//  - guide/img/hypixel/pets/: the head front of each pet in gamedata/pets.json. NOT in git (see .gitignore); built into the APK only.
// A missing file makes the app show its placeholder.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { pathToFileURL } from 'node:url';

export const MC_TEXTURES = { coal: 'item/coal', emerald: 'item/emerald', diamond: 'item/diamond', coal_block: 'block/coal_block', redstone_block: 'block/redstone_block', emerald_block: 'block/emerald_block' };
// personal/items.json holds no skull data, so the pet items come from the NEU item repo (not confirmed by the wiki).
const NEU = 'https://raw.githubusercontent.com/NotEnoughUpdates/NotEnoughUpdates-REPO/master/items';
const RARITY_NO = { COMMON: 0, UNCOMMON: 1, RARE: 2, EPIC: 3, LEGENDARY: 4, MYTHIC: 5 };

// ---- zip: only what a client JAR needs (stored or deflated entries, found through the central directory)
export function zipEntries(buf) {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0) throw new Error('not a zip file');
  const count = buf.readUInt16LE(end + 10);
  const entries = new Map();
  for (let at = buf.readUInt32LE(end + 16), i = 0; i < count; i++) {
    const nameLen = buf.readUInt16LE(at + 28), extraLen = buf.readUInt16LE(at + 30), commentLen = buf.readUInt16LE(at + 32);
    entries.set(buf.toString('utf8', at + 46, at + 46 + nameLen), { method: buf.readUInt16LE(at + 10), size: buf.readUInt32LE(at + 20), local: buf.readUInt32LE(at + 42) });
    at += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

export function zipRead(buf, entry) {
  const at = entry.local;
  const start = at + 30 + buf.readUInt16LE(at + 26) + buf.readUInt16LE(at + 28);
  const raw = buf.subarray(start, start + entry.size);
  return entry.method === 8 ? zlib.inflateRawSync(raw) : raw;
}

// ---- png: 8 bit, not interlaced, RGB, palette or RGBA
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

export function decodePng(buf) {
  let at = 8, width = 0, height = 0, type = 0, palette = null, trns = null;
  const data = [];
  while (at < buf.length) {
    const len = buf.readUInt32BE(at), kind = buf.toString('latin1', at + 4, at + 8), body = buf.subarray(at + 8, at + 8 + len);
    if (kind === 'IHDR') {
      width = body.readUInt32BE(0); height = body.readUInt32BE(4); type = body[9];
      if (body[8] !== 8 || body[12] !== 0) throw new Error('only 8 bit, not interlaced');
    } else if (kind === 'PLTE') palette = body;
    else if (kind === 'tRNS') trns = body;
    else if (kind === 'IDAT') data.push(body);
    at += 12 + len;
  }
  const bpp = { 2: 3, 3: 1, 6: 4 }[type];
  if (!bpp) throw new Error(`color type ${type} is not supported`);
  const raw = zlib.inflateSync(Buffer.concat(data));
  const stride = width * bpp;
  const px = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const a = x >= bpp ? px[y * stride + x - bpp] : 0;
      const b = y ? px[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const add = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f];
      px[y * stride + x] = (v + add) & 255;
    }
  }
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    if (type === 6) px.copy(rgba, i * 4, i * 4, i * 4 + 4);
    else if (type === 2) { px.copy(rgba, i * 4, i * 3, i * 3 + 3); rgba[i * 4 + 3] = 255; }
    else { const k = px[i]; palette.copy(rgba, i * 4, k * 3, k * 3 + 3); rgba[i * 4 + 3] = trns?.[k] ?? 255; }
  }
  return { width, height, rgba };
}

export function encodePng({ width, height, rgba }) {
  const chunk = (kind, body) => {
    const out = Buffer.alloc(12 + body.length);
    out.writeUInt32BE(body.length, 0);
    out.write(kind, 4, 'latin1');
    body.copy(out, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)), 8 + body.length);
    return out;
  };
  const head = Buffer.alloc(13);
  head.writeUInt32BE(width, 0);
  head.writeUInt32BE(height, 4);
  head[8] = 8;
  head[9] = 6;
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) rgba.copy(rows, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', zlib.deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}

// The 8x8 front of a head in a 64x64 skin, with the hat layer drawn over it where it is not transparent.
export function headFace(skin) {
  const out = Buffer.alloc(8 * 8 * 4);
  const at = (x, y) => (y * skin.width + x) * 4;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const hat = at(40 + x, 8 + y);
      const from = skin.rgba[hat + 3] > 0 ? hat : at(8 + x, 8 + y);
      skin.rgba.copy(out, (y * 8 + x) * 4, from, from + 4);
    }
  }
  return { width: 8, height: 8, rgba: out };
}

// The skin URL inside the Base64 texture value of a skull.
export function skullUrl(value) {
  return JSON.parse(Buffer.from(value, 'base64').toString('utf8')).textures?.SKIN?.url ?? null;
}

// The texture value of a NEU item file (the SkullOwner in its nbt string).
export function textureValue(item) {
  return /Value:"([^"]+)"/.exec(item.nbttag ?? '')?.[1] ?? null;
}

// ---- the two jobs
export function findClientJar() {
  const roots = [path.join(process.env.APPDATA ?? '', '.minecraft', 'versions'), path.join(os.homedir(), '.lunarclient')];
  const jars = [];
  const walk = (dir, depth) => {
    if (depth < 0 || !fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory() && !/optifine/i.test(e.name)) walk(p, depth - 1);
      else if (/^\d+\.\d+(\.\d+)?\.jar$/.test(e.name)) jars.push(p);
    }
  };
  roots.forEach((r) => walk(r, 3));
  return jars.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0] ?? null;
}

export function copyMinecraft(jarPath, outDir) {
  const jar = fs.readFileSync(jarPath);
  const entries = zipEntries(jar);
  fs.mkdirSync(outDir, { recursive: true });
  const found = [];
  const missing = [];
  for (const [name, file] of Object.entries(MC_TEXTURES)) {
    const entry = entries.get(`assets/minecraft/textures/${file}.png`);
    if (!entry) { missing.push(name); continue; }
    fs.writeFileSync(path.join(outDir, `${name}.png`), zipRead(jar, entry));
    found.push(name);
  }
  return { found, missing };
}

export async function fetchPets(pets, outDir, get = (url) => fetch(url)) {
  fs.mkdirSync(outDir, { recursive: true });
  const found = [];
  const missing = [];
  for (const pet of pets) {
    const key = `${pet.id}_${pet.rarity}`;
    try {
      const res = await get(`${NEU}/${encodeURIComponent(`${pet.id};${RARITY_NO[pet.rarity]}`)}.json`);
      const url = res.ok ? skullUrl(textureValue(await res.json()) ?? '') : null;
      const skin = url ? await get(url.replace(/^http:/, 'https:')) : null;
      if (!skin?.ok) throw new Error('no skin');
      fs.writeFileSync(path.join(outDir, `${key}.png`), encodePng(headFace(decodePng(Buffer.from(await skin.arrayBuffer())))));
      found.push(key);
    } catch { missing.push(key); }
  }
  return { found, missing };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const jar = findClientJar();
  if (jar) {
    const r = copyMinecraft(jar, 'guide/img/mc');
    console.log(`Minecraft (${path.basename(jar)}): found ${r.found.join(', ') || 'none'}; missing ${r.missing.join(', ') || 'none'}`);
  } else console.log('Minecraft: no client JAR found in the versions folder of .minecraft or in .lunarclient');
  const { pets } = JSON.parse(fs.readFileSync('gamedata/pets.json', 'utf8'));
  const r = await fetchPets(pets, 'guide/img/hypixel/pets');
  console.log(`Pet heads: found ${r.found.join(', ') || 'none'}; missing ${r.missing.join(', ') || 'none'}`);
}

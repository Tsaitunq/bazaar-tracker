import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { decodePng, encodePng, headFace, skullUrl, textureValue, zipEntries, zipRead, MC_TEXTURES, fetchPets } from '../scripts/fetch-icons.mjs';

const skin = () => {
  const rgba = Buffer.alloc(64 * 64 * 4);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) rgba.set([10, 20, 30, 255], ((8 + y) * 64 + 8 + x) * 4); // face
  rgba.set([200, 0, 0, 255], (8 * 64 + 40) * 4); // one opaque hat pixel
  return { width: 64, height: 64, rgba };
};

test('a png survives encode and decode', () => {
  const back = decodePng(encodePng(skin()));
  assert.equal(back.width, 64);
  assert.deepEqual([...back.rgba.subarray(0, 4)], [0, 0, 0, 0]);
  assert.deepEqual([...back.rgba.subarray((8 * 64 + 8) * 4, (8 * 64 + 8) * 4 + 4)], [10, 20, 30, 255]);
});

test('the head front is the face with the hat over it', () => {
  const head = headFace(skin());
  assert.equal(head.width, 8);
  assert.deepEqual([...head.rgba.subarray(0, 4)], [200, 0, 0, 255]);
  assert.deepEqual([...head.rgba.subarray(4, 8)], [10, 20, 30, 255]);
});

test('the skin URL comes out of the Base64 value, and the value out of the item file', () => {
  const value = Buffer.from(JSON.stringify({ textures: { SKIN: { url: 'http://textures.minecraft.net/texture/abc' } } })).toString('base64');
  assert.equal(skullUrl(value), 'http://textures.minecraft.net/texture/abc');
  assert.equal(textureValue({ nbttag: `{SkullOwner:{Properties:{textures:[0:{Value:"${value}"}]}}}` }), value);
  assert.equal(textureValue({}), null);
});

test('a stored and a deflated zip entry are read', () => {
  const entry = (name, data, method) => {
    const body = method === 8 ? zlib.deflateRawSync(data) : data;
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt16LE(method, 8); local.writeUInt32LE(body.length, 18); local.writeUInt16LE(name.length, 26); local.write(name, 30);
    return { local: Buffer.concat([local, body]), name, method, size: body.length };
  };
  const files = [entry('a.txt', Buffer.from('plain'), 0), entry('b.txt', Buffer.from('packed packed packed'), 8)];
  let at = 0;
  const central = files.map((f) => {
    const c = Buffer.alloc(46 + f.name.length);
    c.writeUInt16LE(f.method, 10); c.writeUInt32LE(f.size, 20); c.writeUInt16LE(f.name.length, 28); c.writeUInt32LE(at, 42); c.write(f.name, 46);
    at += f.local.length;
    return c;
  });
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(2, 10); end.writeUInt32LE(at, 16);
  const zip = Buffer.concat([...files.map((f) => f.local), ...central, end]);
  const entries = zipEntries(zip);
  assert.equal(zipRead(zip, entries.get('a.txt')).toString(), 'plain');
  assert.equal(zipRead(zip, entries.get('b.txt')).toString(), 'packed packed packed');
});

test('a pet whose skin cannot be fetched is reported missing, not thrown', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pg-'));
  const r = await fetchPets([{ id: 'BAL', rarity: 'LEGENDARY' }], dir, async () => ({ ok: false }));
  assert.deepEqual(r, { found: [], missing: ['BAL_LEGENDARY'] });
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the committed Minecraft textures are there and the service worker lists them', () => {
  const sw = fs.readFileSync('guide/sw.js', 'utf8');
  for (const name of Object.keys(MC_TEXTURES)) {
    assert.ok(fs.existsSync(`guide/img/mc/${name}.png`), name);
    assert.ok(sw.includes(`'img/mc/${name}.png'`), name);
  }
  assert.match(fs.readFileSync('.gitignore', 'utf8'), /^guide\/img\/hypixel\/$/m);
});

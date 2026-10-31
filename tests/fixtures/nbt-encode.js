// Test helper: writes NBT, so tests build inventories without real profile data.
import { gzipSync } from 'node:zlib';

export const tag = {
  byte: (v) => ({ t: 1, v }), short: (v) => ({ t: 2, v }), int: (v) => ({ t: 3, v }), long: (v) => ({ t: 4, v: BigInt(v) }),
  float: (v) => ({ t: 5, v }), double: (v) => ({ t: 6, v }), bytes: (v) => ({ t: 7, v }), string: (v) => ({ t: 8, v }),
  list: (v, t = v[0]?.t ?? 0) => ({ t: 9, v, of: t }), compound: (v) => ({ t: 10, v }), ints: (v) => ({ t: 11, v }), longs: (v) => ({ t: 12, v: v.map(BigInt) }),
};

const num = (size, write) => (v) => { const b = Buffer.alloc(size); write(b, v); return b; };
const i8 = num(1, (b, v) => b.writeInt8(v));
const i16 = num(2, (b, v) => b.writeInt16BE(v));
const i32 = num(4, (b, v) => b.writeInt32BE(v));
const i64 = num(8, (b, v) => b.writeBigInt64BE(v));
const str = (s) => { const b = Buffer.from(s); return Buffer.concat([num(2, (x, v) => x.writeUInt16BE(v))(b.length), b]); };

function payload({ t, v, of }) {
  switch (t) {
    case 1: return i8(v);
    case 2: return i16(v);
    case 3: return i32(v);
    case 4: return i64(v);
    case 5: return num(4, (b, x) => b.writeFloatBE(x))(v);
    case 6: return num(8, (b, x) => b.writeDoubleBE(x))(v);
    case 7: return Buffer.concat([i32(v.length), Buffer.from(v.map((x) => x & 255))]);
    case 8: return str(v);
    case 9: return Buffer.concat([i8(of), i32(v.length), ...v.map(payload)]);
    case 10: return Buffer.concat([...Object.entries(v).flatMap(([k, x]) => [i8(x.t), str(k), payload(x)]), i8(0)]);
    case 11: return Buffer.concat([i32(v.length), ...v.map(i32)]);
    case 12: return Buffer.concat([i32(v.length), ...v.map(i64)]);
    default: throw new Error(`unknown tag ${t}`);
  }
}

export const encodeNbt = (root) => Buffer.concat([i8(10), str(''), payload(tag.compound(root))]);

// Plain values become the tag Hypixel would use: numbers int, strings string, objects compound, arrays list.
function auto(v) {
  if (v?.t) return v;
  if (typeof v === 'number') return tag.int(v);
  if (typeof v === 'string') return tag.string(v);
  if (Array.isArray(v)) return tag.list(v.map(auto), v.length ? auto(v[0]).t : 0);
  return tag.compound(Object.fromEntries(Object.entries(v).map(([k, x]) => [k, auto(x)])));
}

export const gzipBase64 = (bytes) => gzipSync(bytes).toString('base64');
export const encodeInventory = (slots) => gzipBase64(encodeNbt({ i: auto(slots) }));

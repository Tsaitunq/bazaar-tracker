// Reads the inventories of the SkyBlock profile API: base64 of gzipped NBT. Outside data, so every length is checked.

const MAX_DEPTH = 64;
const SIZE = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 4, 6: 8, 7: 5, 8: 2, 9: 5, 10: 1, 11: 4, 12: 4 };

export function readNbt(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = new TextDecoder();
  let at = 0;
  const take = (n) => {
    if (at + n > view.byteLength) throw new RangeError('NBT ends early');
    const from = at;
    at += n;
    return from;
  };
  const string = () => {
    const length = view.getUint16(take(2));
    return text.decode(bytes.subarray(take(length), at));
  };
  // a long past the safe range stays a string, so the result can still go through JSON exactly
  const long = () => {
    const v = view.getBigInt64(take(8));
    return v >= BigInt(Number.MIN_SAFE_INTEGER) && v <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(v) : v.toString();
  };
  const count = (type) => {
    const n = view.getInt32(take(4));
    if (n < 0 || n * (SIZE[type] ?? 1) > view.byteLength - at) throw new RangeError('NBT length is too large');
    return n;
  };
  const many = (type, read) => Array.from({ length: count(type) }, read);

  function value(type, depth) {
    if (depth > MAX_DEPTH) throw new RangeError('NBT is nested too deep');
    switch (type) {
      case 1: return view.getInt8(take(1));
      case 2: return view.getInt16(take(2));
      case 3: return view.getInt32(take(4));
      case 4: return long();
      case 5: return view.getFloat32(take(4));
      case 6: return view.getFloat64(take(8));
      case 7: return many(1, () => view.getInt8(take(1)));
      case 8: return string();
      case 9: {
        const of = view.getInt8(take(1));
        return many(of, () => value(of, depth + 1));
      }
      case 10: {
        const out = {};
        for (let t = view.getInt8(take(1)); t !== 0; t = view.getInt8(take(1))) {
          const name = string();
          const v = value(t, depth + 1);
          if (name !== '__proto__') out[name] = v;
        }
        return out;
      }
      case 11: return many(3, () => view.getInt32(take(4)));
      case 12: return many(4, long);
      default: throw new RangeError('Unknown NBT tag');
    }
  }

  const root = view.getInt8(take(1));
  string();
  return value(root, 0);
}

// A few kilobytes of gzip can unpack to gigabytes, so the size is checked while unpacking.
export const MAX_INFLATED = 20 * 1024 * 1024;

// One import reads many inventories; a budget caps what all of them unpack to together.
export const MAX_TOTAL = 100 * 1024 * 1024;
export const newBudget = () => ({ used: 0 });

async function inflate(bytes, budget) {
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  const chunks = [];
  let total = 0;
  for (let part = await reader.read(); !part.done; part = await reader.read()) {
    total += part.value.length;
    if (budget) budget.used += part.value.length;
    if (total > MAX_INFLATED || (budget && budget.used > MAX_TOTAL)) {
      reader.cancel().catch(() => {});
      throw new RangeError('too large');
    }
    chunks.push(part.value);
  }
  return new Uint8Array(await new Blob(chunks).arrayBuffer());
}

export async function decodeInventory(base64, budget = null) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const { i } = readNbt(await inflate(bytes, budget));
  if (!Array.isArray(i)) throw new Error('No slot list in this inventory');
  return i;
}

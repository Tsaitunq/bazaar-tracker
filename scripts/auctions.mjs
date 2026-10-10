// Lowest BIN per item from the public auctions endpoint, for the few items the app needs.
import zlib from 'node:zlib';

// An auction carries its item as gzipped NBT. The SkyBlock id is the string tag named "id":
// tag type 8, name length 2, "id", then the value's length and text.
// shortcut: finds the tag by its bytes instead of parsing NBT; switch to a parser if ids come out wrong.
const ID_TAG = Buffer.from([8, 0, 2, 0x69, 0x64]);

export function itemIds(itemBytes) {
  let raw;
  try {
    raw = zlib.gunzipSync(Buffer.from(typeof itemBytes === 'string' ? itemBytes : itemBytes?.data ?? '', 'base64'));
  } catch {
    return [];
  }
  const ids = [];
  for (let p = raw.indexOf(ID_TAG); p >= 0 && p + 7 <= raw.length; p = raw.indexOf(ID_TAG, p + 7)) {
    ids.push(raw.toString('utf8', p + 7, p + 7 + raw.readUInt16BE(p + 5)));
  }
  return ids;
}

// Adds the auctions of one page to `into`: { id: lowest BIN price }. Only ids in `wanted` are kept.
export function lowestBins(auctions, wanted, into = {}) {
  for (const a of auctions ?? []) {
    if (!a.bin || !(a.starting_bid > 0)) continue;
    for (const id of itemIds(a.item_bytes)) {
      if (wanted.has(id) && !(into[id] <= a.starting_bid)) into[id] = a.starting_bid;
    }
  }
  return into;
}

// getPage(n) resolves to one page of the endpoint. Any failing page rejects the whole result,
// so a half read list never replaces a complete one.
export async function fetchLowestBins(getPage, wanted, parallel = 8) {
  const first = await getPage(0);
  const out = lowestBins(first.auctions, wanted);
  for (let n = 1; n < first.totalPages; n += parallel) {
    const pages = Array.from({ length: Math.min(parallel, first.totalPages - n) }, (_, i) => getPage(n + i));
    for (const page of await Promise.all(pages)) lowestBins(page.auctions, wanted, out);
  }
  return out;
}

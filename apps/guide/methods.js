// Methods: short how-to pages kept as private markdown files (personal/sources/method-*.md), copied into the app at build.
import { esc } from '../../shared/format.js';

const INDEX = 'personal/methods/index.json';
// The item whose Bazaar price picks the option, by the name the text puts in bold.
const PRICED = { 'Fine Peridot': 'FINE_PERIDOT_GEM' };
const PLAIN = (t) => t.replace(/\*\*|`/g, '').trim();
const BULLET = /^\s*[-*]\s+(.*)$/;

// **bold** and `code` only; everything else is escaped.
export const inline = (t) => esc(t).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');

const cells = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
const sectionsOf = (md) => {
  const out = {};
  let key = null;
  for (const line of md.replace(/<!--[^]*?-->/g, '').split('\n')) {
    const h = /^##\s+(.+?)\s*$/.exec(line);
    if (h) key = h[1].toLowerCase().replace(/[^a-z]+/g, ' ').trim();
    else if (key) (out[key] ??= []).push(line);
  }
  return out;
};
const bullets = (lines = []) => lines.map((l) => BULLET.exec(l)?.[1]).filter(Boolean);

// "under 45k" and "over 45k" become a limit in coins; other options are never picked by price.
function limitOf(text) {
  const m = /\b(under|over)\s+([\d.]+)\s*([kmb])?\b/i.exec(text);
  if (!m) return null;
  const value = Number(m[2]) * ({ k: 1e3, m: 1e6, b: 1e9 }[(m[3] ?? '').toLowerCase()] ?? 1);
  return { [m[1].toLowerCase() === 'under' ? 'below' : 'above']: value };
}

function runStep(text) {
  const m = /^\*\*(.+?)\*\*\s*(?:[–—-]\s*)?(.*)$/.exec(text) ?? [null, text, ''];
  const back = /[,;]?\s*back to (\d+)\s*$/i.exec(m[2]);
  return { title: PLAIN(m[1]), text: (back ? m[2].slice(0, back.index) : m[2]).trim(), ...(back && { back: Number(back[1]) }) };
}

// Reads one method file. Returns null when it has no title.
export function parseMethod(id, md) {
  const title = /^#\s+(.+?)\s*$/m.exec(md.replace(/<!--[^]*?-->/g, ''))?.[1];
  if (!title) return null;
  const sec = sectionsOf(md);
  const which = sec['which method'] ?? [];
  const ask = /price of\s+\*\*(.+?)\*\*/i.exec(which.join('\n'))?.[1];
  const options = bullets(which).map((line) => {
    const [when, pick = ''] = line.split(/\s*→\s*/);
    return { when: PLAIN(when), pick: PLAIN(pick), ...limitOf(when) };
  });
  const run = (sec.run ?? []).map((l) => /^\s*\d+\.\s+(.*)$/.exec(l)?.[1]).filter(Boolean).map(runStep);
  const rows = (sec.loadouts ?? []).filter((l) => l.trim().startsWith('|'));
  const [head, , ...body] = rows.map(cells);
  const loadouts = head && { columns: head.slice(1), rows: body.map((r) => ({ label: r[0], cells: r.slice(1) })) };
  const note = (sec.loadouts ?? []).find((l) => l.trim() && !l.trim().startsWith('|'));
  const autopet = bullets(sec['auto pet']).map((line) => {
    const [trigger, pet = ''] = line.split(/\s*→\s*(?=[^→]*$)/);
    return { trigger: PLAIN(trigger), pet: PLAIN(pet) };
  });
  const gear = bullets(sec['gear in short']).map((line) => {
    const [name, text = ''] = line.split(/\s+[–—]\s+/);
    return { name: PLAIN(name), text: PLAIN(text) };
  });
  return {
    id, title,
    ...(ask && PRICED[ask] && { price: { name: ask, id: PRICED[ask] } }),
    options, run, loadouts: loadouts ?? { columns: [], rows: [] }, ...(note && { note: note.trim() }),
    autopet, gear, tips: bullets(sec.tips),
  };
}

// The methods shipped with the app; an installation without them gets a 404 here, which means none.
export async function loadMethods(get = fetch) {
  try {
    const names = await (await get(INDEX)).json();
    if (!Array.isArray(names)) return [];
    const loaded = await Promise.all(names.map(async (f) => parseMethod(f.replace(/^method-|\.md$/g, ''), await (await get(`personal/methods/${f}`)).text())));
    return loaded.filter(Boolean);
  } catch {
    return [];
  }
}

// Which option the price points at: the one whose limit it meets. null while there is no price.
export const pickedOption = (method, price) => (price > 0 ? method.options.findIndex((o) => (o.below != null && price < o.below) || (o.above != null && price >= o.above)) : -1);

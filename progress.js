// The private Progress area: guides with checkboxes. Guides come from personal/guides (copied into the
// app by scripts/copy-web.mjs, never in git) or from an imported file.

const INDEX = 'personal/guides/index.json';
const text = (v) => (typeof v === 'string' && v.trim() ? v : null);

function validItem(i) {
  const qty = i?.qty ?? 1;
  if (!Number.isInteger(qty) || qty < 1) return null;
  const id = text(i?.id), name = text(i?.name);
  if (!id && !name) return null;
  return { ...(id && { id }), ...(name && { name }), qty, ...(i.ah === true && { ah: true }) };
}

function validStep(s) {
  if (!text(s?.text)) return null;
  const items = s.items === undefined ? [] : Array.isArray(s.items) ? s.items.map(validItem) : [null];
  if (items.includes(null)) return null;
  return { text: s.text, ...(items.length && { items }), ...(text(s.hint) && { hint: s.hint }) };
}

// A guide from a file is outside data: only the known fields come through, and a link only as http(s).
export function validGuide(g) {
  if (!text(g?.title) || !Array.isArray(g.sections) || !g.sections.length) return null;
  const sections = g.sections.map((s) => {
    if (!text(s?.name) || !Array.isArray(s.steps)) return null;
    const steps = s.steps.map(validStep);
    if (steps.includes(null)) return null;
    return { name: s.name, ...(text(s.goal) && { goal: s.goal }), steps };
  });
  if (sections.includes(null)) return null;
  return { title: g.title, ...(/^https?:\/\//i.test(g.source ?? '') && { source: g.source }), sections };
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'guide';

// The guides shipped with the app; an installation without them gets a 404 here, which means none.
export async function loadBundled(get = fetch) {
  try {
    const names = await (await get(INDEX)).json();
    if (!Array.isArray(names)) return [];
    const loaded = await Promise.all(names.map(async (f) => {
      const g = validGuide(await (await get(`personal/guides/${f}`)).json());
      return g && { id: f.replace(/\.json$/, ''), ...g };
    }));
    return loaded.filter(Boolean);
  } catch {
    return [];
  }
}

// An imported guide replaces the shipped one with the same id.
export function mergeGuides(bundled, imported) {
  const ids = new Set(imported.map((g) => g.id));
  return [...bundled.filter((g) => !ids.has(g.id)), ...imported];
}

export const exportData = (guides, progress) => JSON.stringify({ type: 'bt-progress', guides, progress }, null, 2);

// Reads an export of the app or one plain guide file. Throws with a message for the player.
export function importData(raw) {
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error('That is not valid JSON.'); }
  const list = data?.type === 'bt-progress' ? data.guides : [data];
  if (!Array.isArray(list)) throw new Error('No guides found in that file.');
  const guides = list.map((g) => {
    const valid = validGuide(g);
    if (!valid) throw new Error('A guide in that file has the wrong format.');
    return { id: text(g.id) ?? slug(valid.title), ...valid };
  });
  const progress = {};
  for (const [id, keys] of Object.entries(data?.type === 'bt-progress' && data.progress ? data.progress : {})) {
    if (Array.isArray(keys)) progress[id] = keys.filter((k) => typeof k === 'string');
  }
  if (!guides.length && !Object.keys(progress).length) throw new Error('No guides found in that file.');
  return { guides, progress };
}

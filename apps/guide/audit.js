// The reconcile mode of the stat details: per area, stat and category the value the player read in the game (/stats → Click for details).
// Pure functions, no DOM. Stored as pg.audit: { "area|STAT|Category": { value, at } }.
import { statDetail } from './stats-model.js';

// The game shows one decimal, so this much difference counts as the same.
export const TOLERANCE = 0.1;

const round = (v) => Math.round(v * 100) / 100;
export const auditKey = (area, stat, category) => `${area}|${stat}|${category}`;
export const keyParts = (key) => { const [area, stat, ...rest] = key.split('|'); return { area, stat, category: rest.join('|') }; };

// A typed value; an empty or invalid field removes the entry.
export function setAudit(audit, key, text, now) {
  const { [key]: _old, ...rest } = audit ?? {};
  const value = typeof text === 'number' ? text : Number(String(text).replace(',', '.'));
  return String(text).trim() === '' || !Number.isFinite(value) ? rest : { ...rest, [key]: { value, at: now } };
}

// What one row shows: the app value, the game value and the difference (app minus game). ok: within the tolerance.
export function compare(app, game) {
  if (typeof game !== 'number') return null;
  const diff = round(app - game);
  return { app: round(app), game, diff, ok: Math.abs(diff) <= TOLERANCE + 1e-9 };
}

// Every entry that differs: [{ area, stat, name, category, app, game }]. A category the app does not list counts as 0.
export function deviations(world, audit) {
  const out = [];
  for (const [key, e] of Object.entries(audit ?? {})) {
    const { area, stat, category } = keyParts(key);
    const d = statDetail(world, area, stat);
    if (!d) continue;
    const c = compare(d.groups.find((g) => g.title === category)?.sum ?? 0, e.value);
    if (c && !c.ok) out.push({ area, stat, name: d.name, category, app: c.app, game: c.game });
  }
  return out;
}

// The text for the clipboard: one line per deviation, "Stat [area/STAT_ID] | Category | App n | Game n".
export const exportText = (list) => (list.length
  ? ['Stats audit: deviations between the app and the game', ...list.map((x) => `${x.name} [${x.area}/${x.stat}] | ${x.category} | App ${x.app} | Game ${x.game}`)].join('\n')
  : 'Stats audit: no deviations');

// The text back into rows (for the script that makes a plausibility fixture of it).
export const parseExport = (text) => [...String(text).matchAll(/\[(\w+)\/(\w+)\] \| (.+?) \| App (-?[\d.]+) \| Game (-?[\d.]+)/g)]
  .map((m) => ({ area: m[1], stat: m[2], category: m[3], app: Number(m[4]), game: Number(m[5]) }));

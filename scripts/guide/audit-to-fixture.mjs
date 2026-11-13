// Local: node scripts/guide/audit-to-fixture.mjs <export.txt | -> [name]
// Turns the text of "Copy deviations" (stat details → reconcile mode) into a plausibility fixture: personal/fixtures/audit-<name>.json
// (personal/ is not in git). <name> defaults to today's date; "-" reads stdin. Every entry starts as open: a deviation that is known and not fixed yet.
// tests/guide/audit-plausibility.test.js holds the closed entries (open: false) to the game value; set open to false once the app matches.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseExport } from '../../apps/guide/audit.js';

// The fixture of an export. Entries are { area, stat, category, game, open }, the app value of that moment is kept as appThen.
export function fixtureOf(text, date) {
  return { date, entries: parseExport(text).map((x) => ({ area: x.area, stat: x.stat, category: x.category, game: x.game, appThen: x.app, open: true })) };
}

// A fixture already there keeps its entries: the same area, stat and category is replaced by the new game value, the rest stays.
export function merge(old, next) {
  const id = (e) => `${e.area}|${e.stat}|${e.category}`;
  const fresh = new Map(next.entries.map((e) => [id(e), e]));
  const kept = (old?.entries ?? []).filter((e) => !fresh.has(id(e)));
  return { date: next.date, entries: [...kept, ...next.entries] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [source, name = new Date().toISOString().slice(0, 10)] = process.argv.slice(2);
  if (!source) { console.error('usage: node scripts/guide/audit-to-fixture.mjs <export.txt | -> [name]'); process.exit(2); }
  const text = readFileSync(source === '-' ? 0 : source, 'utf8');
  const next = fixtureOf(text, name);
  if (!next.entries.length) { console.error('No deviation lines found in the text.'); process.exit(1); }
  mkdirSync('personal/fixtures', { recursive: true });
  const file = `personal/fixtures/audit-${name}.json`;
  const out = merge(existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null, next);
  writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`saved ${out.entries.length} entries to ${file}`);
}

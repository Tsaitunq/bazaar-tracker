// Takes every backfilled run out of a timing.json: node scripts/timing-remove-backfill.mjs <timing.json> [out]
// Patterns are computed from the runs, so one that only the backfill confirmed is unconfirmed afterwards.
// Also delete timing-backfill.json, or the snapshot run puts the runs back.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { removeBackfill, BACKFILL } from '../timing.js';

export function stripFile(file, out = file) {
  const before = JSON.parse(fs.readFileSync(file, 'utf8'));
  const count = (t) => Object.values(t.r ?? {}).flat().filter((run) => run.src === BACKFILL).length;
  const after = removeBackfill(before);
  fs.writeFileSync(out, JSON.stringify(after));
  return count(before);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [file, out] = process.argv.slice(2);
  if (!file) { console.error('usage: node scripts/timing-remove-backfill.mjs <timing.json> [out]'); process.exit(1); }
  console.log(`removed ${stripFile(file, out)} backfilled runs`);
}

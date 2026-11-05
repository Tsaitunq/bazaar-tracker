// Removes what the builds and checks write: npm run clean. Nothing in git, nothing in personal/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const OUTPUTS = [
  'apps/bazaar/www',
  'apps/bazaar/android/app/build',
  'apps/guide/www-guide',
  'apps/guide/android/app/build',
  'apps/guide/shots',
  '_site',
];

// Only a named folder strictly inside the repo goes: no wildcards, nothing above or beside the root.
export function clean(root = ROOT, outputs = OUTPUTS) {
  const removed = [];
  for (const dir of outputs) {
    const full = path.resolve(root, dir);
    if (!full.startsWith(root + path.sep) || full === root) throw new Error(`refusing to remove ${dir}`);
    if (!fs.existsSync(full)) continue;
    fs.rmSync(full, { recursive: true, force: true });
    removed.push(dir);
  }
  return removed;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const dir of clean()) console.log(`removed ${dir}`);
}

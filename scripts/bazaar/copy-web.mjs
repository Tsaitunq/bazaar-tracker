// Copies the app shell into a clean folder for Capacitor: node scripts/bazaar/copy-web.mjs [outDir] [--worker]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { outPath, shellSource, shellEntries, flattenImports, flattenShell } from '../lib/flat.mjs';

// Private guides are not in git and not in SHELL, so their names stay out of the repo; the app finds them through index.json.
function copyGuides(root, out) {
  const dir = path.join(root, 'personal', 'guides');
  const names = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json').sort() : [];
  if (!names.length) return;
  const to = path.join(out, 'personal', 'guides');
  fs.mkdirSync(to, { recursive: true });
  for (const f of names) fs.copyFileSync(path.join(dir, f), path.join(to, f));
  fs.writeFileSync(path.join(to, 'index.json'), JSON.stringify(names));
}

export function copyPersonal(root, out) {
  copyGuides(root, out);
  // for a local test build, also outside git: public game data and the player's own /stats values
  for (const name of ['items.json', 'stats-preset.json']) {
    const from = path.join(root, 'personal', name);
    if (!fs.existsSync(from)) continue;
    fs.mkdirSync(path.join(out, 'personal'), { recursive: true });
    fs.copyFileSync(from, path.join(out, 'personal', name));
  }
}

// worker: also write sw.js, flattened. The PWA needs it; the APK does not (the app skips the worker there).
export function copyWeb(root, out, { worker: withWorker = false } = {}) {
  const worker = fs.readFileSync(path.join(root, 'apps', 'bazaar', 'sw.js'), 'utf8');
  const files = shellEntries(worker);
  fs.rmSync(out, { recursive: true, force: true });
  for (const entry of files) {
    const src = shellSource('bazaar', entry);
    const to = path.join(out, outPath('bazaar', src));
    fs.mkdirSync(path.dirname(to), { recursive: true });
    if (src.endsWith('.js')) fs.writeFileSync(to, flattenImports(fs.readFileSync(path.join(root, src), 'utf8'), 'bazaar', src));
    else fs.copyFileSync(path.join(root, src), to);
  }
  fs.cpSync(path.join(root, 'apps', 'bazaar', 'icons'), path.join(out, 'icons'), { recursive: true });
  if (withWorker) fs.writeFileSync(path.join(out, 'sw.js'), flattenShell(worker, 'bazaar'));
  return files.length;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(`copied ${copyWeb('.', process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'apps/bazaar/www', { worker: process.argv.includes('--worker') })} files`);
}

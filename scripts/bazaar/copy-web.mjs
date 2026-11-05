// Copies the app shell into a clean folder for Capacitor: node scripts/bazaar/copy-web.mjs [outDir]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

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

export function copyWeb(root, out) {
  const shell = fs.readFileSync(path.join(root, 'sw.js'), 'utf8').match(/const SHELL = \[([^\]]*)\]/)[1];
  const files = [...shell.matchAll(/'([^']+)'/g)].map((m) => m[1]).filter((f) => f !== './');
  fs.rmSync(out, { recursive: true, force: true });
  for (const f of files) {
    fs.mkdirSync(path.dirname(path.join(out, f)), { recursive: true });
    fs.copyFileSync(path.join(root, f), path.join(out, f));
  }
  fs.cpSync(path.join(root, 'icons'), path.join(out, 'icons'), { recursive: true });
  return files.length;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(`copied ${copyWeb('.', process.argv[2] ?? 'www')} files`);
}

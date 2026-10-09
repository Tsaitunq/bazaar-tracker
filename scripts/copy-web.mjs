// Copies the app shell into a clean folder for Capacitor: node scripts/copy-web.mjs [outDir]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

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

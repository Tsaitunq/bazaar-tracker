// Lays the guide app flat into one folder for Capacitor: node scripts/guide/guide-copy.mjs [outDir]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { copyPersonal } from '../bazaar/copy-web.mjs';
import { outPath, shellSource, shellEntries, flattenImports, flattenShell } from '../lib/flat.mjs';

const NAME_TOKEN = /__APP_NAME__/g;
const APP = path.join('apps', 'guide');

// The Capacitor config with the name filled in, for the copy inside the APK.
export function capConfig(root) {
  const { name } = JSON.parse(fs.readFileSync(path.join(root, APP, 'brand.json'), 'utf8'));
  return fs.readFileSync(path.join(root, APP, 'capacitor.config.json'), 'utf8').replace(NAME_TOKEN, name);
}

export function copyGuide(root, out) {
  const worker = fs.readFileSync(path.join(root, APP, 'sw.js'), 'utf8');
  const shell = shellEntries(worker);
  const { name } = JSON.parse(fs.readFileSync(path.join(root, APP, 'brand.json'), 'utf8'));
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  for (const entry of shell) {
    const src = shellSource('guide', entry);
    const to = path.join(out, outPath('guide', src));
    fs.mkdirSync(path.dirname(to), { recursive: true });
    const from = path.join(root, src);
    if (!/\.(js|html|webmanifest)$/.test(src)) fs.copyFileSync(from, to);
    else {
      const text = fs.readFileSync(from, 'utf8').replace(NAME_TOKEN, name);
      fs.writeFileSync(to, src.endsWith('.js') ? flattenImports(text, 'guide', src) : text);
    }
  }
  fs.writeFileSync(path.join(out, 'sw.js'), flattenShell(worker, 'guide'));
  // pictures from Hypixel are not in git; whatever fetch-icons.mjs put here goes into the build, a missing one shows the placeholder
  const pics = path.join(root, APP, 'img', 'hypixel');
  if (fs.existsSync(pics)) fs.cpSync(pics, path.join(out, 'img', 'hypixel'), { recursive: true });
  copyPersonal(root, out);
  return shell.length;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(`copied ${copyGuide('.', process.argv[2] ?? path.join(APP, 'www-guide'))} files`);
}

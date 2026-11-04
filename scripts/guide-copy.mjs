// Lays the guide app flat into one folder for Capacitor: node scripts/guide-copy.mjs [outDir]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { copyPersonal } from './copy-web.mjs';

const NAME_TOKEN = /__APP_NAME__/g;

// A file of guide/ sits one level higher in the build, and the shared files sit beside it.
const flatten = (text, file) => (file.startsWith('views/') ? text.replace(/'\.\.\/\.\.\//g, "'../") : text.replace(/'\.\.\//g, "'./"));

// The Capacitor config with the name filled in, for the copy inside the APK.
export function capConfig(root) {
  const { name } = JSON.parse(fs.readFileSync(path.join(root, 'guide', 'brand.json'), 'utf8'));
  return fs.readFileSync(path.join(root, 'guide', 'capacitor.config.json'), 'utf8').replace(NAME_TOKEN, name);
}

export function copyGuide(root, out) {
  const guide = path.join(root, 'guide');
  const worker = fs.readFileSync(path.join(guide, 'sw.js'), 'utf8');
  const shell = [...worker.match(/const SHELL = \[([^\]]*)\]/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).filter((f) => f !== './');
  const { name } = JSON.parse(fs.readFileSync(path.join(guide, 'brand.json'), 'utf8'));
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  for (const file of shell) {
    const shared = file.startsWith('../');
    const to = path.join(out, shared ? file.slice(3) : file);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    const from = shared ? path.join(root, file.slice(3)) : path.join(guide, file);
    if (shared || !/\.(js|html|webmanifest)$/.test(file)) fs.copyFileSync(from, to);
    else {
      const text = fs.readFileSync(from, 'utf8').replace(NAME_TOKEN, name);
      fs.writeFileSync(to, file.endsWith('.js') ? flatten(text, file) : text);
    }
  }
  fs.writeFileSync(path.join(out, 'sw.js'), worker.replace(/'\.\.\//g, "'"));
  // pictures from Hypixel are not in git; whatever fetch-icons.mjs put here goes into the build, a missing one shows the placeholder
  const pics = path.join(guide, 'img', 'hypixel');
  if (fs.existsSync(pics)) fs.cpSync(pics, path.join(out, 'img', 'hypixel'), { recursive: true });
  copyPersonal(root, out);
  return shell.length;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(`copied ${copyGuide('.', process.argv[2] ?? 'www-guide')} files`);
}

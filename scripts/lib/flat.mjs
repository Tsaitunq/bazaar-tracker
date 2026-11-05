// Lays an app flat into one folder, as the PWA and Capacitor need it. Source paths are relative to the repo root:
// apps/<app>/x -> x, shared/x -> x, gamedata/x stays gamedata/x.
import path from 'node:path';

const posix = path.posix;

export const outPath = (app, src) => {
  if (src.startsWith(`apps/${app}/`)) return src.slice(`apps/${app}/`.length);
  if (src.startsWith('shared/')) return src.slice('shared/'.length);
  return src;
};

// An entry of SHELL in sw.js is written relative to the app folder; this is its path from the repo root.
export const shellSource = (app, entry) => posix.normalize(posix.join(`apps/${app}`, entry));

// The imports of a source file, re-pointed at where the files end up. src is the file's path from the repo root.
export function flattenImports(text, app, src) {
  const from = posix.dirname(outPath(app, src));
  return text.replace(/(from\s+|import\()'(\.{1,2}\/[^']*)'/g, (m, pre, spec) => {
    const target = outPath(app, posix.normalize(posix.join(posix.dirname(src), spec)));
    let rel = posix.relative(from, target);
    if (!rel.startsWith('.')) rel = `./${rel}`;
    return `${pre}'${rel}'`;
  });
}

// The service worker with its SHELL entries pointing at the flat paths.
export function flattenShell(text, app) {
  return text.replace(/const SHELL = \[([^\]]*)\]/, (m, list) => `const SHELL = [${list.replace(/'([^']+)'/g, (x, entry) => (entry === './' ? x : `'${outPath(app, shellSource(app, entry))}'`))}]`);
}

export const shellEntries = (text) => [...text.match(/const SHELL = \[([^\]]*)\]/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).filter((f) => f !== './');

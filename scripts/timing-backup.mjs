import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { dayKey } from '../history.js';

// timing.json is the only data that cannot be rebuilt, so dated copies of it live on their own branch.
const WEEK_MS = 7 * 86400000;
const NAME = /^timing-(\d{4}-\d{2}-\d{2})\.json$/;

const valid = (file) => {
  try {
    return typeof JSON.parse(fs.readFileSync(file, 'utf8'))?.r === 'object';
  } catch {
    return false;
  }
};
// oldest first: the date in the name sorts as text
const backups = (backupDir) => (fs.existsSync(backupDir) ? fs.readdirSync(backupDir).filter((f) => NAME.test(f)).sort() : []);

// Puts the newest readable backup in place of a missing or broken timing.json. Returns its name, or null.
export function restoreTiming(dataDir, backupDir) {
  const file = path.join(dataDir, 'timing.json');
  if (valid(file)) return null;
  const newest = backups(backupDir).reverse().find((f) => valid(path.join(backupDir, f)));
  if (!newest) return null;
  fs.mkdirSync(dataDir, { recursive: true });
  fs.copyFileSync(path.join(backupDir, newest), file);
  return newest;
}

// Writes a dated copy once the newest one is a week old. A broken timing.json is never copied.
export function backupTiming(dataDir, backupDir, nowMs) {
  const file = path.join(dataDir, 'timing.json');
  if (!valid(file)) return null;
  const last = backups(backupDir).at(-1)?.match(NAME)[1];
  if (last && last > dayKey(nowMs - WEEK_MS)) return null;
  const name = `timing-${dayKey(nowMs)}.json`;
  fs.mkdirSync(backupDir, { recursive: true });
  fs.copyFileSync(file, path.join(backupDir, name));
  return name;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [mode, dataDir = 'data', backupDir = 'backup'] = process.argv.slice(2);
  if (mode === 'restore') console.log(`timing restore: ${restoreTiming(dataDir, backupDir) ?? 'not needed or no backup'}`);
  else if (mode === 'backup') console.log(`timing backup: ${backupTiming(dataDir, backupDir, Date.now()) ?? 'not due'}`);
  else {
    console.error('usage: timing-backup.mjs restore|backup [dataDir] [backupDir]');
    process.exitCode = 1;
  }
}

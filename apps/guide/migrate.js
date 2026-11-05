// The update to the guide app without the API: what the last sync recognised becomes manual ticks, then the old profile is deleted.
import { detectGuide } from './detect.js';
import { stepKey } from './progress.js';
import { isItemStep, idsToOwn, migrateOwned } from './owned.js';
import { collapseChecks } from './keys.js';
import { withEssence } from './build.js';

export const SCHEMA = 5;
const UNDONE = 'undone:';

// summary: the last synced profile, or null. Steps it found stay done: an item step becomes owned, any other a mark.
// A step the player had ticked off by hand (UNDONE) stays open.
export function migrateTicks({ guides, checks, owned = [], summary }) {
  const have = new Set(owned);
  const next = { ...checks };
  if (!summary) return { owned: [...have], checks: next };
  for (const guide of guides) {
    const marks = new Set(checks[guide.id] ?? []);
    const found = detectGuide(guide, summary, stepKey);
    for (const section of guide.sections) {
      for (const step of section.steps) {
        const key = stepKey(section, step);
        const f = found.get(key);
        if (!f || f.have < f.need || marks.has(UNDONE + key)) continue;
        if (isItemStep(step)) for (const id of idsToOwn(step, guide, have)) have.add(id);
        else marks.add(key);
      }
    }
    next[guide.id] = [...marks];
  }
  return { owned: [...have], checks: next };
}

// schema 5: the essence shop is a part of the build (build.essence), not a list of ticked steps. The highest level ticked per perk becomes the
// level you have, and it counts as already inside every measured base (the snapshots take it), so it is never added a second time. The ticks go.
// Without any tick the part stays unknown (null) and is entered as a draft. Running it again changes nothing.
export function migrateEssence({ keys, build, base }) {
  const levels = {};
  const rest = [];
  for (const k of keys) {
    const m = k.match(/^perk:([a-z_]+):(\d+)$/);
    if (m) levels[m[1]] = Math.max(levels[m[1]] ?? 0, Number(m[2]));
    else if (!/^undone:perk:/.test(k)) rest.push(k);
  }
  let next = withEssence(base);
  let essence = build.essence ?? null;
  if (Object.keys(levels).length) {
    essence = { ...levels, ...essence };
    next = Object.fromEntries(Object.entries(next).map(([area, e]) => [area, e.snapshot && e.snapshot.essence === null ? { ...e, snapshot: { ...e.snapshot, essence: { ...levels } } } : e]));
  }
  return { keys: rest, build: { ...build, essence }, base: next };
}

// io: { read(key, fallback), write(key, value) -> bool, drop(key) }.
// Gives true when it ran. Nothing is deleted before the new ticks are stored, and the flag is set last, so a failed run starts again next time.
export function runMigration(io, guides) {
  const schema = io.read('pg.schema', 0);
  if (schema >= SCHEMA || !guides.length) return false;
  let checks = io.read('pg.checks', {});
  let owned = io.read('pg.owned', []);
  if (schema < 2) {
    const stand = io.read('pg.profile', null);
    if (!io.read('pg.ownedV1', false)) ({ owned, checks } = migrateOwned(guides, checks, owned));
    ({ owned, checks } = migrateTicks({ guides, checks, owned, summary: stand?.summary ?? null }));
  }
  // schema 3: ticks of steps with a shared key move into one list; marks nothing knows stay where they are
  let moved = schema < 3 ? collapseChecks(guides, checks, io.read('pg.keys', [])) : { checks, keys: io.read('pg.keys', []) };
  // schema 4: an item that carried stones in its step (owned) now has them as steps of their own, ticked
  const keys = new Set(moved.keys);
  for (const guide of guides) for (const [id, list] of Object.entries(guide.ownedKeys ?? {})) if (owned.includes(id)) for (const k of list) if (!keys.has(`undone:${k}`)) keys.add(k);
  moved = { ...moved, keys: [...keys] };
  // schema 5: essence shop ticks become the essence part of the build
  let build = io.read('pg.build', {});
  let base = io.read('pg.base', {});
  if (schema < 5) {
    const e = migrateEssence({ keys: moved.keys, build, base });
    moved = { ...moved, keys: e.keys };
    build = e.build;
    base = e.base;
  }
  if (!io.write('pg.build', build) || !io.write('pg.base', base) || !io.write('pg.keys', moved.keys) || !io.write('pg.checks', moved.checks) || !io.write('pg.owned', owned)) return false;
  if (schema < 2) {
    const { personal, ...settings } = io.read('pg.settings', {});
    io.write('pg.settings', settings);
    io.drop('pg.profile');
    io.drop('pg.ownedV1');
  }
  return io.write('pg.schema', SCHEMA);
}

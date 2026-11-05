// The update to the guide app without the API: what the last sync recognised becomes manual ticks, then the old profile is deleted.
import { detectGuide } from './detect.js';
import { stepKey } from './progress.js';
import { isItemStep, idsToOwn, migrateOwned } from './owned.js';
import { collapseChecks } from './keys.js';

export const SCHEMA = 4;
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
  if (!io.write('pg.keys', moved.keys) || !io.write('pg.checks', moved.checks) || !io.write('pg.owned', owned)) return false;
  if (schema < 2) {
    const { personal, ...settings } = io.read('pg.settings', {});
    io.write('pg.settings', settings);
    io.drop('pg.profile');
    io.drop('pg.ownedV1');
  }
  return io.write('pg.schema', SCHEMA);
}

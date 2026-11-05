// The update to the guide app without the API: what the last sync recognised becomes manual ticks, then key and profile are deleted.
import { detectGuide } from './detect.js';
import { stepKey } from './progress.js';
import { isItemStep, idsToOwn, migrateOwned } from './owned.js';

export const SCHEMA = 2;
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

// io: { read(key, fallback), write(key, value) -> bool, drop(key), readLegacy() -> profile | null (throws when the store cannot be read), clearLegacy() -> bool }.
// Gives true when it ran. Nothing is deleted before the new ticks are stored, and the flag is set last, so a failed run starts again next time.
export async function runMigration(io, guides) {
  if (io.read('pg.schema', 0) >= SCHEMA) return false;
  if (!guides.length) return false;
  let stand;
  try {
    stand = (await io.readLegacy()) ?? io.read('pg.profile', null);
  } catch {
    return false;
  }
  let checks = io.read('pg.checks', {});
  let owned = io.read('pg.owned', []);
  if (!io.read('pg.ownedV1', false)) ({ owned, checks } = migrateOwned(guides, checks, owned));
  ({ owned, checks } = migrateTicks({ guides, checks, owned, summary: stand?.summary ?? null }));
  if (!io.write('pg.checks', checks) || !io.write('pg.owned', owned)) return false;
  const { personal, ...settings } = io.read('pg.settings', {});
  io.write('pg.settings', settings);
  io.drop('pg.profile');
  io.drop('pg.ownedV1');
  if (!(await io.clearLegacy())) return false;
  return io.write('pg.schema', SCHEMA);
}

// Shared step keys. A step with a key is ticked once for every guide that holds the same key: the ticks sit in one
// list (pg.keys), a guide's own marks (pg.checks) keep only the steps without a key. Item steps stay with pg.owned.
import { stepKey } from './progress.js';
import { isItemStep } from './owned.js';

const UNDONE = 'undone:';
const split = (mark) => (mark.startsWith(UNDONE) ? [UNDONE, mark.slice(UNDONE.length)] : ['', mark]);

// stepKey -> key of the steps of one guide that share their tick
export function keyedSteps(guide) {
  return new Map(guide.sections.flatMap((s) => s.steps.filter((st) => st.key && !isItemStep(st)).map((st) => [stepKey(s, st), st.key])));
}

// The marks of every guide as the rest of the app reads them: the shared keys written out as the guide's own marks.
export function expandChecks(guides, checks, keys) {
  const have = new Set(keys);
  const out = { ...checks };
  for (const guide of guides) {
    const marks = new Set(checks[guide.id] ?? []);
    for (const [sk, k] of keyedSteps(guide)) {
      if (have.has(k)) marks.add(sk);
      if (have.has(UNDONE + k)) marks.add(UNDONE + sk);
    }
    out[guide.id] = [...marks];
  }
  return out;
}

// Moves marks that belong to a key into the shared list: a mark of a step with a key, or an old text a guide's `legacy` map
// knows (also for a guide that is gone). Everything else stays. Running it again changes nothing.
export function collapseChecks(guides, checks, keys) {
  const next = new Set(keys);
  const legacy = Object.assign({}, ...guides.map((g) => g.legacy ?? {}));
  const kept = {};
  for (const [id, marks] of Object.entries(checks)) {
    const own = new Map(guides.filter((g) => g.id === id).flatMap((g) => [...keyedSteps(g)]));
    kept[id] = [];
    for (const mark of marks) {
      const [prefix, text] = split(mark);
      const target = own.get(text) ?? legacy[text];
      if (target === undefined) { kept[id].push(mark); continue; }
      for (const k of [target].flat()) {
        // a tick beats an untick when two old guides disagree
        if (!prefix) { next.add(k); next.delete(UNDONE + k); } else if (!next.has(k)) next.add(UNDONE + k);
      }
    }
  }
  return { checks: kept, keys: [...next] };
}

// One guide's marks were changed (a tick in the list): its keyed steps replace what the shared list said about them.
export function commitGuide(guides, guide, marks, checks, keys) {
  const mine = new Set([...keyedSteps(guide).values()].flatMap((k) => [k, UNDONE + k]));
  const out = collapseChecks([guide], { [guide.id]: [...marks] }, keys.filter((k) => !mine.has(k)));
  return { checks: { ...checks, [guide.id]: out.checks[guide.id] }, keys: out.keys };
}

// A reset of a guide takes its keyed steps out for all guides, like the items.
export const resetKeys = (guide, keys) => {
  const mine = new Set([...keyedSteps(guide).values()].flatMap((k) => [k, UNDONE + k]));
  return keys.filter((k) => !mine.has(k));
};

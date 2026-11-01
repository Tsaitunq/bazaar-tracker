// What the screens of the guide app show, worked out from the shared logic. No markup in here.
import { stepKey } from '../progress.js';

const DAY = 24 * 3600e3;
const WEEK = 7 * DAY;
const ARCS = 3;

// Sections with steps split into runs of about the same size, for a guide that names no chapters.
function splitInto(sections, parts) {
  const filled = sections.filter((s) => s.steps.length);
  const total = filled.reduce((n, s) => n + s.steps.length, 0);
  const out = Array.from({ length: parts }, () => []);
  let seen = 0;
  for (const section of filled) {
    const middle = seen + section.steps.length / 2;
    out[Math.min(Math.floor((middle / Math.max(total, 1)) * parts), parts - 1)].push(section);
    seen += section.steps.length;
  }
  return out;
}

function chapterGroups(guide) {
  if (guide.chapters?.length) {
    return guide.chapters.map((c) => ({ name: c.name, sections: guide.sections.filter((s) => c.sections.includes(s.name)) }));
  }
  if (guide.sections.length === ARCS) return guide.sections.map((s) => ({ name: s.name, sections: [s] }));
  return splitInto(guide.sections, ARCS).map((sections, i) => ({ name: sections[0]?.name ?? `Part ${i + 1}`, sections }));
}

// The chapters of the ring: how far each is, and which holds the first open step.
export function chaptersOf(guide, checked) {
  const chapters = chapterGroups(guide).map(({ name, sections }) => {
    const keys = sections.flatMap((s) => s.steps.map((step) => stepKey(s, step)));
    const done = keys.filter((k) => checked.has(k)).length;
    return { name, done, total: keys.length, share: keys.length ? done / keys.length : 0, current: false };
  });
  const open = chapters.find((c) => c.done < c.total) ?? chapters[chapters.length - 1];
  if (open) open.current = true;
  return chapters;
}

export function totalShare(chapters) {
  const total = chapters.reduce((n, c) => n + c.total, 0);
  return total ? chapters.reduce((n, c) => n + c.done, 0) / total : 0;
}

// When each step was first seen done. What is done at the first run is older than the app, so it gets 0 and never counts as new.
export function stampDone(prev, doneKeys, now, firstRun = false) {
  const out = {};
  for (const key of doneKeys) out[key] = prev?.[key] ?? (firstRun ? 0 : now);
  return out;
}

export const unlockedThisWeek = (stamps, now) => Object.values(stamps ?? {}).filter((at) => at > 0 && now - at < WEEK).length;

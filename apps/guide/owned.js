// What the player owns across all guides. An item step ticked in one guide is done in every guide that holds the item.
// Enchants, gems and reforges sit on one piece and stay with their guide. keyOf is stepKey of progress.js.
import { detectGuide } from './detect.js';

const partsOf = (step) => [step.detect ?? []].flat();
const slotsOf = (part, guide) => (typeof part.on === 'string' ? guide.groups?.[part.on] : part.on) ?? [];

export const isItemStep = (step) => {
  const parts = partsOf(step);
  return parts.length > 0 && parts.every((d) => d.kind === 'owned');
};

// The first id of each slot: what ticking the step stands for.
export const idsOfStep = (step, guide) => partsOf(step).flatMap((d) => slotsOf(d, guide).map(([id]) => id));

// What a tick still has to add: the open slots, up to what the step needs.
export function idsToOwn(step, guide, owned) {
  return partsOf(step).flatMap((d) => {
    const slots = slotsOf(d, guide);
    const open = slots.filter((ids) => !ids.some((id) => owned.has(id)));
    return open.slice(0, Math.max((d.need ?? slots.length) - (slots.length - open.length), 0)).map(([id]) => id);
  });
}

// Item steps by key as far as the ticks fulfil them. Nothing owned stays out: no answer, not a "no".
export function ownedAuto(guide, owned, keyOf) {
  const items = { ...guide, sections: guide.sections.map((s) => ({ ...s, steps: s.steps.filter(isItemStep) })) };
  const found = detectGuide(items, { items: [...owned].map((id) => ({ id })) }, keyOf);
  return new Map([...found].filter(([, f]) => f.have > 0).map(([key, f]) => [key, { ...f, ticked: true }]));
}

// Ticks from before the shared state move over. Running it again changes nothing.
export function migrateOwned(guides, checks, owned = []) {
  const have = new Set(owned);
  const next = { ...checks };
  for (const guide of guides) {
    const marks = new Set(checks[guide.id] ?? []);
    if (!marks.size) continue;
    // written out like stepKey: progress.js imports this file
    const items = new Map(guide.sections.flatMap((s) => s.steps.filter(isItemStep).map((step) => [`${s.name}|${step.text}`, step])));
    for (const [key, step] of items) {
      if (!marks.delete(key)) continue;
      for (const id of idsToOwn(step, guide, have)) have.add(id);
    }
    next[guide.id] = [...marks];
  }
  return { owned: [...have], checks: next };
}

// Steps a done step replaced, also along a chain.
export function impliedDone(guide, done, keyOf) {
  const byText = new Map(guide.sections.flatMap((s) => s.steps.map((step) => [step.text, { step, key: keyOf(s, step) }])));
  const out = new Set();
  const walk = (step) => {
    for (const text of step.after ?? []) {
      const found = byText.get(text);
      if (!found || out.has(found.key)) continue;
      out.add(found.key);
      walk(found.step);
    }
  };
  for (const section of guide.sections) for (const step of section.steps) if (step.after && done.has(keyOf(section, step))) walk(step);
  return out;
}

// A reset takes the items of this guide out for all guides: the state is one per item.
export function resetOwned(guide, owned) {
  const gone = new Set(guide.sections.flatMap((s) => s.steps.filter(isItemStep).flatMap((step) => idsOfStep(step, guide))));
  return new Set([...owned].filter((id) => !gone.has(id)));
}

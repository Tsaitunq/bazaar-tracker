// The current build and the measured bases (pg.build, pg.base). Pure: every function gives the new state.
// hotm, attrs and power are null = unknown. They must never be read as level 0.
export const emptyBuild = () => ({ hotm: null, attrs: null, power: null, buffs: { godPotion: false, boosterCookie: false }, pet: null });

// One measurement per area: the typed values (an empty field is unknown), the date and a snapshot of the build.
export function measure(base, area, { values, mp }, build, now) {
  const kept = Object.entries(values ?? {}).filter(([, v]) => v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v)));
  const entry = { at: now, values: Object.fromEntries(kept.map(([k, v]) => [k, Number(v)])), snapshot: structuredClone(build) };
  if (mp !== '' && mp !== null && mp !== undefined && Number(mp) >= 0) entry.mp = Number(mp);
  return { ...base, [area]: entry };
}

// Sets a part of the build. The first time a part leaves null, every snapshot that still has it null takes the value,
// so what is already inside the measured base is not added a second time. Only later changes are a delta.
export function setPart(build, base, part, value) {
  const next = { ...build, [part]: value };
  if (build[part] !== null || value === null) return { build: next, base };
  const filled = Object.fromEntries(Object.entries(base).map(([area, e]) => [area, e.snapshot?.[part] === null ? { ...e, snapshot: { ...e.snapshot, [part]: structuredClone(value) } } : e]));
  return { build: next, base: filled };
}

// The editors. A part of the build that is unknown (null) while a measurement still has it unknown is edited in a draft:
// the first entry is the whole state that is inside the measured base, so it is written once, through setPart.
// Every later edit goes straight to the build and is a delta.
export const EMPTY_PART = {
  hotm: () => ({ tier: null, levels: {}, omelette: false }),
  attrs: () => ({}),
  power: () => ({ stone: null, mp: null, tuning: {} }),
};

export const needsDraft = (build, base, part) => build[part] === null && Object.values(base ?? {}).some((e) => e.snapshot?.[part] === null);

// state: { build, base, draft }. change: (current part) => next part.
export function editPart(state, part, change) {
  if (needsDraft(state.build, state.base, part)) return { ...state, draft: { ...state.draft, [part]: change(state.draft?.[part] ?? EMPTY_PART[part]()) } };
  const { build, base } = setPart(state.build, state.base, part, change(state.build[part] ?? EMPTY_PART[part]()));
  return { ...state, build, base };
}

export function commitDraft(state, part) {
  if (!state.draft?.[part]) return state;
  const { build, base } = setPart(state.build, state.base, part, state.draft[part]);
  const { [part]: _gone, ...draft } = state.draft;
  return { build, base, draft };
}

export function discardDraft(state, part) {
  const { [part]: _gone, ...draft } = state.draft ?? {};
  return { ...state, draft };
}

const whole = (n, max) => Math.min(Math.max(Math.trunc(Number(n)) || 0, 0), max);
export const perkLevel = (perk, level) => (h) => ({ ...h, levels: { ...h.levels, [perk.id]: whole(level, perk.maxLevel) } });
export const hotmTier = (tier) => (h) => ({ ...h, tier: Number.isInteger(tier) && tier >= 1 && tier <= 10 ? tier : null });
export const omelette = (on) => (h) => ({ ...h, omelette: on === true });
export const attrLevel = (attr, level) => (a) => ({ ...a, [attr.key]: whole(level, attr.maxLevel) });
export const powerStone = (id) => (p) => ({ ...p, stone: id || null });
export const powerMp = (mp) => (p) => ({ ...p, mp: mp === '' || mp === null || !(Number(mp) >= 0) ? null : Number(mp) });
export const tuningPoints = (stat, n) => (p) => ({ ...p, tuning: { ...p.tuning, [stat]: whole(n, 9999) } });

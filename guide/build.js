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

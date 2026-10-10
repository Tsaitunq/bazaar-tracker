// The election resource, cut down to what the app shows.
const clean = (s) => String(s ?? '').replace(/§./g, '').replace(/\s+/g, ' ').trim();
const perk = (p) => ({ name: clean(p?.name), text: clean(p?.description) });

// json: the answer of /v2/resources/skyblock/election. `current` is only there while an election runs.
export function compactElection(json, nowMs) {
  const m = json?.mayor;
  if (!m?.name) throw new Error('no mayor in the election data');
  return {
    t: nowMs,
    mayor: {
      name: clean(m.name),
      perks: (m.perks ?? []).map(perk),
      minister: m.minister?.perk ? { name: clean(m.minister.name), perk: perk(m.minister.perk) } : null,
    },
    vote: json.current?.candidates?.length ? {
      year: json.current.year,
      candidates: json.current.candidates.map((c) => ({ name: clean(c.name), votes: c.votes ?? 0, perks: (c.perks ?? []).map((p) => clean(p.name)) })),
    } : null,
  };
}

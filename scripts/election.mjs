// The election resource, cut down to what the app shows.
// Perk texts carry colour codes and the game's stat icons; most fonts have no glyph for the icons.
const clean = (s) => String(s ?? '').replace(/§./g, '').replace(/[☀-➿-]/g, '').replace(/\s+/g, ' ').trim();
const perk = (p) => ({ name: clean(p?.name), text: clean(p?.description) });

// json: the answer of /v2/resources/skyblock/election. `current` is only there while an election runs.
export function compactElection(json, nowMs) {
  const m = json?.mayor;
  if (!m?.name) throw new Error('no mayor in the election data');
  return {
    t: nowMs,
    mayor: {
      name: clean(m.name),
      year: m.election?.year ?? null, // the election this mayor won; the term starts in the year after
      perks: (m.perks ?? []).map(perk),
      minister: m.minister?.perk ? { name: clean(m.minister.name), perk: perk(m.minister.perk) } : null,
    },
    vote: json.current?.candidates?.length ? {
      year: json.current.year,
      // minister: the one perk this candidate brings along as runner-up (the API flags it), or null
      candidates: json.current.candidates.map((c) => ({ name: clean(c.name), votes: c.votes ?? 0, perks: (c.perks ?? []).map((p) => clean(p.name)),
        minister: clean((c.perks ?? []).find((p) => p.minister)?.name) || null })),
    } : null,
  };
}

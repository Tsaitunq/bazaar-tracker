# Timing backfill

Fills the runs of `timing.json` from SkyCofl's bazaar history, so that
patterns of mayor perks and events can be confirmed at once instead of after
three own runs. Check of the data source: `docs/timing-backfill-check.md`.

## Data

- Prices: `https://sky.coflnet.com/api/bazaar/{item}/history?start=…&end=…`
  (SkyCofl). Attribution in the app (Market area and footer): "Historical
  prices provided by SkyCofl", link https://sky.coflnet.com/data. The terms ask
  for attribution and for commercial users to fund the servers; the app is
  free and non-commercial.
- Mayors: wiki modules `Module:Mayor/Elections` and `…/ApiData`, kept as
  `scripts/mayors-history.json` (ids 179 to 518; 291, 461 to 463 and 466 to 469
  are not on the wiki). A minister's perk is not recorded, so only mayors
  count.

## What is measured

Same as timing.js: the median of the instant-buy price (SkyCofl `buy`, our
`sell`) 24 h before, during and 24 h after. Two hours is the best resolution
and only for a range up to 7 days; the "after" window of a mayor term is cut
to 7 days from the start of the "before" window (22 of 24 hours remain).

| Key | Runs | Windows |
|---|---|---|
| perk: Marauder, Mining Fiesta, Mythological Ritual, Fishing Festival, Blooming Business, Stock Exchange | the 12 newest finished terms of the mayor, election id 179 or later, not before the last wiki change of the perk | whole term (124 h) against the 24 h before; Marina's whole term for the Fishing Festival, not the 1 hour festivals |
| event: Spooky Festival | 12 newest | 1 real hour: measured over 6 h from the start (3 points) against the 24 h before |
| event: Jerry's Workshop | 12 newest | 10 h 20 min |
| event: Harvest Feast | 12 newest | 31 h |
| event: Grand Feast (Finnegan) | the years since 2026-04-28 with Finnegan in office | year |
| left out: Season of Jerry | | 1 hour inside the Workshop with the same items: not separable from it |
| left out: Fishing Festival as an event | | 1 hour every 10 hours |
| left out: Traveling Zoo, New Year, Hoppity's Hunt, election | | no items |

Wiki changes of perks (mayor pages, history, read 2026-10-11): Marauder,
Mythological Ritual, Fishing Festival: no change since the mayor was added;
Mining Fiesta: changed 2026-08-25 (and again listed 2026-10-06, 0.27.2);
Blooming Business: added 2024-07-02; Stock Exchange: Diaz "reworked"
2024-07-02; Grand Feast: added 2026-04-28.

An item's first data point is found by asking: when a window has no rows,
that item is not asked for older runs.

## Data model

`run.src` is `"backfill"` or absent (own). `pattern()` returns `n`, `nOwn`,
`nBackfill`; `confirmed` is `n >= 3` over both. `patternText` says "based on
historical data (SkyCofl)" or "1 own, 2 from historical data (SkyCofl)".

- `mergeBackfill(timing, backfill)`: adds runs, never replaces an own run or a
  run with the same start, idempotent. The snapshot run does this while
  `timing-backfill.json` is in the repo root.
- `removeBackfill(timing)` and `node scripts/timing-remove-backfill.mjs
  <timing.json> [out]`: take all backfilled runs out; patterns that needed
  them fall back by themselves because they are computed from the runs.
  Delete `timing-backfill.json` as well, or the next snapshot run puts the runs
  back.

## Running it

`node scripts/timing-backfill.mjs [--out timing-backfill.json] [--count 12]
[--dry-run]`. One request a second, `Retry-After` on 429, up to six tries;
progress in `<out>.partial.json`, so an interrupted run resumes.

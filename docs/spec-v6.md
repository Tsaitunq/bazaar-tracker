# Spec v6: event timing

Approved in chat on 2026-10-10. Flip scoring and the flip maths are untouched.

## What it does

The radar says what an item's price usually did around an event or a mayor
term, once that happened three times the same way, and labels everything else
as "not enough data yet" or as an expectation.

## Data

`timing.json` on the `data` branch, written by every snapshot run and never
pruned:

- `r`: runs per group. Groups are `event:<key>` and `perk:<perk name>`. A
  run is `{ s, e, b, a, p }`: start, end, start of the "before" window, end of
  the "after" window (minutes), and `p[itemId] = [before, during, after]`,
  the median sell price in each window. A median is filled in when its window
  has passed and is then left alone.
- `n`: notices for the Android worker, each with the time window in which it
  is due, a title and `[itemId, text]` lines.

Terms are stored per perk, not per mayor: a minister brings one perk, and a
mayor's perks change between elections.

## Pattern

`timing.js`: the typical change is the median over all runs, N is the number
of runs that went the same way, changes below 1 % have no direction, N ≥ 3 is
confirmed.

## Display

- Event: per item "Usually +X% during event (seen N times)" plus "Buy before /
  Sell during" (or the reverse for a falling price) with the window, otherwise
  "not enough data yet (N/3)".
- Mayor: "Cheaper during <mayor>:" and "More expensive during <mayor>:".
  Unconfirmed items show "Expected: <reason>". Confirmed falling: "Buy during
  term, sell after"; confirmed rising: "Buy before term".
- Always: "Based on past events, not a guarantee."

## Android

Two switches, both off by default: before events (3 hours ahead, confirmed
patterns only) and a new mayor (for 6 hours after the change, confirmed
patterns and expectations). The worker only reads the notices; it has no
calendar and no copy of the pattern logic.

## Limits

- An event comes once per SkyBlock year (124 hours), so three runs take about
  16 days. A perk returns far less often.
- "Buy before term" arrives with the new mayor, so it helps for the next time.
- Perkpocalypse and Extra Event are not tracked.

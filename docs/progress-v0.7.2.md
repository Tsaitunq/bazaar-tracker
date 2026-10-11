# Progress 0.7.2

Branch `feat/v0.7.2`, one commit per part. Not pushed, not merged.

- [x] F. Craft hint on opportunity cards
- [x] G. Craft modes
- [ ] H. NPC tab with craft steps
- [ ] I. Calendar check, "Year of the" countdown
- [ ] J. Small notes (minion requirements, Derpy tax)
- [ ] Changelog 0.7.2, README, APK, docs/summary-v0.7.2.md

## F.1 answer (one Bazaar snapshot 2026-10-11, stats and recipes from the data branch, default settings)

The plan has 21 flips; 8 of them are an ingredient of some recipe, 6 of those
crafts are profitable, and **none beats its flip**, so the portfolio shows 0
hints. Closest: Enchanted Mycelium into Amalgamated Crimsonite, 329k/h
against 538k/h for the flip (61%). Overall 240 of 314 recipes are profitable
on their own; the hint only fires when a craft beats the flip with the same
coins, which is rare.

F.2: opportunity cards use the same calculation (`craftHints`, stake =
units × buy) and the same text plus "recipe must be unlocked". A tap sets the
search to the end product and opens the Craft tab.

## G

`craft.js`: `walkBook` (depth), `CRAFT_MODES`, `craftFlip(... mode, runs, minVolume,
noSuspicious)`. API sides, checked on a snapshot: `buy_summary` = sell offers,
cheapest first (instant-buy cost); `sell_summary` = buy orders, highest first
(instant-sell revenue). Settings `craftMode` (0 to 2) and `craftRuns` (default
16), filters in the Craft filter sheet. The Craft tab now also hides crafts
with a suspicious result or ingredient and with a weekly volume below the
"Vol./week" filter for the result or any ingredient.

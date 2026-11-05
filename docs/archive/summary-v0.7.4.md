# Summary 0.7.4

Branch `feat/v0.7.4`, two commits (A: cost and payback, B: Inferno Minion with
changelog, docs and tests). Not pushed, not merged. 279 tests green. Debug APK
built (`versionName` 0.7.4, `versionCode` 100704) at
`android/app/build/outputs/apk/debug/app-debug.apk`.

The package was ordered as 0.7.3; that number was taken, so it is 0.7.4.

## What changed

**A. Cost and payback**

- `minioncosts.js` (new): the recipe step of every tier of the 21 minions of
  the list, read from each wiki page and checked against the page's own
  "Total Cumulative Cost" table (the sums are tested for Clay XI, Tarantula XI,
  Inferno XI and others).
- Card: "Cost (Tier X)" and "Pays back in". The cost is every step up to the
  tier, both upgrades and a permanent fuel, for all minions placed, at the
  lowest sell offer. Ingredients without a Bazaar price (Pelt, North Star,
  Crystallized Heart, wooden tools) are named, left out and make the payback
  read "at least".
- Sheet: the cost as a list and two new table columns, "Upgrade cost" (the
  step from the tier before) and "Upgrade pays back in" (cost ÷ extra coins a
  day; "no gain" when the tier only holds more).
- Minions tab: "Sort by" coins per day or payback.

**B. Inferno Minion**

- 11 tiers, recipe, Blaze Slayer III, fuel (Rare, Epic, Legendary) and
  Distillate chosen in the sheet, fuel cost per day, rare drops of Legendary
  fuel at the wiki's odds, "price unreliable" under 100 sales a week.
- A line in the sheet says which fuel choice earns most right now.

## Inferno against Tarantula T11

**Superseded:** this table is the first version of the calculation. It was
wrong in three places; the corrected numbers are in
`docs/inferno-review-v0.7.4.md`.

Snapshot of the Bazaar from 2026-10-11, one minion, Super Compactor 3000 and
Diamond Spreading, tax 1.25%, tier XI unless stated.

| | Coins/day | Cost | Pays back in |
|---|---|---|---|
| Tarantula XI | 113,384 | 215.6M (+ Slayer V) | 1,901 days |
| Inferno XI, no fuel | 20,640 | 649.0M | 31,443 days |
| Inferno XI, Rare fuel | −80,920 | 649.0M | never |
| Inferno XI, Epic fuel | −334,823 | 649.0M | never |
| Inferno XI, Legendary fuel (best Distillate: Crude Gabagool) | −2,586,130 | 649.0M | never |
| Inferno I, no fuel (best payback of Inferno) | 14,202 | 397k | 28 days |
| Tarantula I (best payback) | 39,098 | 475k | 12 days |

- **Answer:** at these prices Inferno is not worth it against Tarantula: it
  is last by payback (22 of 22) and 21 of 22 by coins per day. Fuel costs more
  than it brings. A Legendary piece is 4.7M a day (Hypergolic Gabagool 4.4M);
  its rare drops are worth 1.7M (11.3 Chili Pepper at 141k, 0.26 Inferno
  Vertex). Chili Pepper would have to sell for about 415k for one minion to
  break even.
- With **ten minions** (Rising Celsius at its cap, +180%) Legendary fuel with
  Crude Gabagool gives +302k a day per minion, about 649M ÷ 302k = 2,150 days:
  still behind Tarantula's 1,901. This rests on Rising Celsius, see below.
- Best by coins/day with fuel at one minion: none of them; the best choice is
  no fuel.

Everything depends on one day's prices. Molten Powder (341k each, 51k a week)
and Hypergolic Gabagool (4.4M) are the two figures that drive it.

## What is not confirmed (and is marked in the app)

- **Tarantula and Revenant steps.** The wiki recipe names "Spider Minion N" /
  "Zombie Minion N" as an ingredient. The step is written out as what those
  minions are made of, exactly as the wiki's cumulative table does.
- **Inferno XI** needs the tier X and an Inferno Minion VIII (page text and
  diagram disagree; the cumulative table decides).
- **Rare drop assignment.** The Inferno Minion page's table is one row off
  against the Inferno Minion Fuel page; the Fuel page's order is used.
  Reaper Pepper (1 in 458k) being more common than Inferno Apex (1 in 1.3M)
  follows from it.
- **Rising Celsius** (+18% per Inferno Minion placed, cap 180%): counted for
  the number of minions in the setup and multiplied with the fuel as the page
  describes; the page does not say whether a lone minion counts itself.
- **Speed of the fuel**: the page's own bug note (11x, 16x, 21x instead of
  10x, 15x, 20x) is used.
- **Specialty amounts** with a range (Magma Cream 1 to 3, Nether Wart 3 to 7,
  Glowstone Dust 2 to 3): the middle.
- **Not counted:** Capsaicin Eyedrops (+30% rare drops), Gabagool the Fish
  (not on the Bazaar), the armor the Revenant recipe supposedly needs.
- The wiki pages were read through a summariser (curl is blocked); every list
  was cross-checked against the page's own second table. A wrong digit that is
  also wrong in the second table cannot be excluded.

## Found along the way

- A first version compacted Blaze Rod straight to Enchanted Blaze Rod and
  showed a profit of 950k a day. The Blaze Minion page says 160 Blaze Rod make
  Enchanted Blaze Powder and 160 of that make the Rod; corrected, the profit
  is gone.
- `.coming` lists inside sheets had no styling outside the radar (bullets,
  stacked); fixed in `style.css`, which also tidies the "What it earns" list.
- The Bazaar API answered in 9 s during the checks; the app waits for it.

## Checks

- `npm test`: 279 tests (fixtures only, no Hypixel API calls).
- Wiki cumulative sums per minion: see tests and `docs/minions-sources.md`.
- UI: headless Edge, touch emulation, 412 × 915, list, Tarantula sheet and
  Inferno sheet (fuel selects, rare drops, table with seven columns).
- APK built; `versionCode` 100704, `minioncosts.js` and `inferno.png` are in
  the package; no personal names or absolute paths in the diff.
- **Not done:** the APK was not run on a device or emulator.

## Checklist for the phone

1. Install the APK; the "What's new" window shows 0.7.4 with four entries,
   "Show me" points at the minion card and at "Sort by".
2. Minions tab: cards show "Cost (Tier XI)" and "Pays back in"; a card with a
   missing ingredient says "Not on the Bazaar, left out of the cost: …" and
   "at least".
3. "Sort by" → Payback: Snow/Wheat/Clay first, Inferno and Tarantula last at
   tier XI; back to "Coins per day".
4. Tap Tarantula: the table has "Upgrade cost" and "Upgrade pays back in";
   tiers with the same speed say "no gain"; the table fits without sideways
   scrolling.
5. Change Tier and Minions in the setup: costs and payback change; with 10
   minions the cost is ten times the single one.
6. Tap Inferno: "Blaze Slayer" in the setup is 9 by default; set it to 2 and
   "Hide those I cannot craft" removes the minion.
7. Inferno sheet: pick Legendary fuel and a Distillate; the fuel list, the
   rare drops (Inferno Apex and Reaper Pepper "price unreliable") and the
   "Best right now" line update; close and reopen: the choice stays.
8. Rotate or scroll the sheet: it scrolls on its own and the page behind
   stays still; the back key closes it.
9. Offline: open a minion sheet with flight mode on (shell is cached).

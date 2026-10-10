# Spec v0.7: four areas, craft hints, portfolio alerts, Today, minions

Written without questions (unattended run). Choices that were open are in
`DECISIONS.md` under "Version 0.7". The flip maths (`computeFlip`,
`opportunities`, `portfolio`) is untouched.

## Part 0: navigation

A fixed bar at the bottom with four areas: **Today | Trade | Minions | Market**.

- Trade keeps the five tabs at the top (Flips, Opportunities, NPC, Craft,
  Forge) and is the only area with search, sorting, favorites and filters.
  Swiping changes tabs inside Trade and nowhere else.
- Market holds the radar (mayor with perk effects, election, events), always
  unfolded, and a Trends list.
- Simple mode: the bar shows Today and Trade; Trade shows Flips and
  Opportunities.
- Paths: the Trade tabs keep `#/flips`, `#/opps`, `#/npc`, `#/craft`,
  `#/forge` and `#/item/<id>`, so notifications and old links still work. New:
  `#/today`, `#/minions`, `#/market`. Changelog entries that point at the
  radar are sent to `#/market` in code; the changelog itself is not edited.
- The last area and tab are stored (`bt.route`) and opened on the next start;
  the very first start opens Today. The Trade button opens the last Trade tab.
- The bar keeps clear of the Android gesture bar (safe area inset). Pull to
  refresh works in every area.
- Basic tour: first station is the bar. Hints and help cover the new areas.

## Part 1: craft hints in the portfolio

For every flip of the plan: if the item is an ingredient of a recipe that
earns more per hour than the flip, the row says
`Craft into X: +Y/h · uses N orders`.

- The craft gets the coins the plan gave the flip (its stake) and the same
  rules: tax, market share, weekly volume of every ingredient and of the
  result. A result with suspicious prices gives no hint.
- Y is craft profit/h minus flip profit/h. N is ingredients + 1 sell offer.
- Shown only; the plan's split does not change. A note says the recipe has to
  be unlocked. Pro only, like the Craft tab.

## Part 2: portfolio warnings

The plan is stored (`bt.plan`: item ids with the buy price they entered the
plan at) and sent to the Android worker.

Warning kinds, each with its own switch for notifications:

| Kind | Rule |
|---|---|
| price | buy order more than X% below the plan's buy price (X adjustable, default 5), or margin below 1% |
| suspicious | the flip is suspicious now (same rule as everywhere) |
| election | the leading candidate, or the runner-up's minister perk, is expected to lower the price |
| leaving | the mayor or minister whose perk holds the price down leaves within 24 hours |

- Web: a banner at the top of the portfolio (and on Today) lists the warnings
  of the stored plan. While a price or suspicious warning is active the stored
  plan is kept, so the warning stays; "Got it" stores the current plan.
  Without such a warning the stored plan follows the current one, and an item
  that stays keeps its first buy price.
- Android: the worker checks every 15 minutes, one notification with a line
  per warning, cooldown per item and kind (adjustable, default 6 hours).
  `planWarnings` in `flips.js` and `AlertLogic.planWarnings` use the same
  rules and test cases. For the election the worker reads `election.json`;
  which perk affects which item, and when the term ends, comes from the app.

## Part 3: Today

The first area. Blocks, each linking to its tab:

1. Portfolio: profit/h, capital in use, flips X of the allowed number.
2. Active warnings (part 2).
3. Next events and the election with a countdown and affected items (Pro).
4. Top 3 opportunities that are new since the last visit (ids of the last
   visit are stored; without a last visit, the top 3).

Simple mode shows blocks 1, 2 and 4.

## Part 4: minion calculator

A new area "Minions" (Pro). Static data in `minions.js`, every number with its
source in `docs/minions-sources.md`. Only minions whose numbers could be read
from the source; values that could not be confirmed are marked in the app.

- Setup: tier, number of minions, fuel, two upgrade slots.
- Result per minion: coins per day at the Bazaar and at the NPC, the better
  one counts, best minion first. Fuel that is used up is subtracted.
- Storage: how long until the minion is full.

## End

Changelog 0.7.0, README, APK, report in `docs/summary-v0.7.md`.

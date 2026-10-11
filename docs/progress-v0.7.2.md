# Progress 0.7.2

Branch `feat/v0.7.2`, one commit per part. Not pushed, not merged.

- [x] F. Craft hint on opportunity cards
- [x] G. Craft modes
- [x] H. NPC tab with craft steps
- [x] I. Calendar check (matches), "Year of the" countdown (no year on the wiki, left open)
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

## H

`npc.js`: `npcStep` and craft steps in `npcFlips` (single-ingredient recipes
only; recipes from recipes.json = NEU repo, NPC prices from the items API).
Spot check against the wiki: Obsidian Minion page "160 Obsidian → Enchanted
Obsidian, NPC 1,440 coins" (single item 7), Tarantula Minion page "160
String → Enchanted String, NPC 576" (single item 3). On the snapshot of
2026-10-11, 172 of 195 single-ingredient steps pay exactly the sum of the
items (NPC price scales ×160), 21 pay less, **2 pay more**: Obsidian (+28.6%)
and String (+20%). With 16 crafts: Obsidian 13,312 against 8,192 coins,
1.37 profit per coin.

**H.4 answer:** yes, a limit on selling to NPCs: "limited to only selling up
to 500,000,000 Coins per day, which resets at 00:00 UTC+0"
(hypixelskyblock.minecraft.wiki/w/Merchant). Counted in coins, not items; the
wiki names nothing per item. It caps Profit/h of NPC flips and is shown as a
note on the NPC tab. The 640-items-a-day limit on the page "NPC" is a buy
limit of the shops and does not touch Bazaar-to-NPC flips.

## I

**Calendar:** the app computes Late Summer 11, year 519 for 2026-10-11
08:55 to 09:15 UTC (10:55 to 11:15 CEST), which fits "Late Summer 11, year
519, Vormittag". No correction needed; the test uses that moment as anchor. The
time of day the game showed was only "Vormittag", so the match is to within
the 20-minute day plus that vagueness.

**Year of the …:** searched Events, Calendar, SkyBlock_Year and the three event
pages: "every 12 SkyBlock Years" and real-world dates of the update (Seal:
Feb 6, 2025), but **no SkyBlock year number** and no order of the cycle.
Nothing was computed, no countdown. Left open.

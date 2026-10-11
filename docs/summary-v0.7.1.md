# Summary 0.7.1

Branch `feat/v0.7.1`, one commit per part, not pushed, not merged.
236 tests green. Debug APK built (`versionName` 0.7.1, `versionCode` 100701).
Game data comes from hypixelskyblock.minecraft.wiki only (rule in `CLAUDE.md`).

## Done

| Part | What | Commit |
|---|---|---|
| A | Minions checked against the wiki; Wheat, Carrot, Potato, Melon, Pumpkin, Cactus, Glowstone, Fishing added (22 minions); `docs/minions-sources.md` rewritten; wiki rule in `CLAUDE.md`; Bazaar tax settled | `8e15b10` |
| B | Best sale form per item, thin markets marked, lone raw orders distrusted | `c7d6078` |
| C | Minion sheet: tier table, breakdown, time to full, source, "View item" | `a32782a` |
| D | Harvest Feast, Grand Feast, all mayor perks, "Year of the" notes, unclear items settled, searchable "Mayor & event effects" | `10b167d` |
| E | Opportunities search keeps all filters and never lists suspicious items | `e6c7bde` |
| – | Changelog 0.7.1, README, APK | last |

Postponed or left open: see below.

## Part A: what was wrong

- Lapis: average 6 per harvest (range 4 to 8), the code had 4.5.
- Tarantula String: 160 per Enchanted String, the code had 192; String and
  Rotten Flesh average 3.16, the code had 3.5.
- Wheat has its own storage (128 to 960), Fishing 640 to 960.
- Fishing harvests with one action per catch (stated on its page).
- Bazaar tax: wiki says "1.25% tax on all Bazaar sales", 1% at the top Bazaar
  Flipper level. Whether Instant Sell is named separately: not stated. Tax
  stays deducted.

## Part B: why the ranking looked wrong

One Bazaar snapshot (2026-10-11), tier XI, Lava Bucket, Super Compactor 3000
+ Diamond Spreading, 1 minion:

| # | Before | After |
|---|---|---|
| 1 | Tarantula 110,915 | Tarantula 114,697 |
| 2 | Revenant 84,737 | Lapis 82,945 |
| 3 | Slime 71,472 | Wheat 81,502 |
| 4 | Redstone 65,148 | Glowstone 79,182 |
| 5 | Lapis 62,165 | Revenant 77,491 |

Causes, by weight:

1. **Raw prices from a lone order.** Raw Fish topped at 310 coins while its
   enchanted form is worth 5 per fish (Prismarine Crystals 935 against 2).
   Without a compactor the Fishing Minion came out at 590,616 coins/day.
2. **Wrong item ids** for three Fishing drops (they counted as 0).
3. **Old numbers** (Lapis, String, Rotten Flesh, see above).
4. **No second step** (block form) priced.
5. **Thin markets** not marked.

Honest limit: with a compactor the top five are real prices. Tarantula and
Revenant stay on top; they need Slayer V (XII: IX), which the calculator
does not show. The 20× volume limit and the 30% margin are my choices, the
wiki states neither. If the top still feels wrong on the phone, tell me which
minion and the setup.

## Part E: the cause

Not the portfolio filter. The search deliberately listed every item whose
name matched, also the ones that failed the Opportunities filters, mixed into
the list with the reason on the card ("Suspicious prices", "Volume too
low"). The Griffin Upgrade Stones (volume 23 and 44 a week) were such
items. Fix: Opportunities never lists a suspicious item; items that only
fail a filter sit in a folded "X more outside your filters" section below the
list. Test: `search in Opportunities: the Griffin Upgrade Stones ...`.
Other tabs (Flips, NPC, Craft, Forge) still search the whole Bazaar.

## Open, no source (marked "not confirmed")

- **Year of the Seal, Witch, Pig:** "every 12 SkyBlock Years", years not on
  the wiki. No countdown and no "this year is affected" note possible. A
  forum post says Seal and Pig alternate every six years: not the wiki, not
  used.
- **Price direction of any perk or event:** the wiki states none. "Expected
  lower" for Mining Fiesta, Mythological Ritual, Fishing Festival, Marauder,
  Blooming Business, Stock Exchange is our conclusion and says so. Harvest
  Feast: a price fall of the Garden drops is **not confirmed**; the app
  learns it from its snapshots.
- **Wither Essence, Undead Essence:** chests are one source among several,
  no amounts. Not added.
- **Derpy's QUAD TAXES on the Bazaar tax:** wiki says "4x the normal amount
  of taxes", does not name the Bazaar.
- **Pathfinder (Aatrox):** the wiki does not say which drops are rare.
- **Actions per harvest = 2** for all but Fishing: not on the pages read.
- **Enchanted Melon:** wiki name differs from the Bazaar id; mapped by price
  ratio, marked.
- **Iron and Gold Minion:** not added (ore; needs the Auto Smelter).
- Fuel the wiki lists and the calculator lacks: Coal, Block of Coal,
  Enchanted Coal, Solar Panel, Everburning Flame, Tasty Cheese, Inferno fuel.
- Marauder: whether Suspicious Vial, Red Nose and Red Scarf fall is an
  expectation only.

## Phone checklist

1. Minions: 22 cards; Fishing and Wheat present. Tap a card: a sheet opens
   (not the raw item), shows 12 tiers with the current one highlighted,
   per-item coins, fuel, "full after", wiki link. Back key and swipe close it.
   "View item" opens the item and closes the sheet.
2. Setup `none` + `none`: Fishing is no longer far ahead; set a compactor
   again and compare with 0.7.0 on the same setup.
3. A minion with a thin market shows "low volume" and is listed last.
4. Market: "Mayor & event effects" at the bottom of the radar. Search "feast",
   "marauder", an item name. Running and active entries come first.
5. Harvest Feast is in the events list while it runs (Early Autumn to Late
   Autumn); Grand Feast only with Finnegan.
6. Opportunities: search "Griff". No Griffin Upgrade Stone in the list; if
   something else matches, it sits under "X more outside your filters"
   (collapsed, grey). Flips, NPC, Craft, Forge searches work as before.
7. What's new shows 0.7.1 with four entries; "Show me" points at each one.
8. Settings or changelog shows 0.7.1.

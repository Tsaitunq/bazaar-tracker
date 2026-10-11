# Progress 0.7.1

Branch `feat/v0.7.1`, one commit per part. Not pushed, not merged.

- [x] A. Source and minion values (wiki-checked, 8 new minions, docs, CLAUDE.md rule)
- [x] B. Ranking (see below)
- [x] C. Minion detail sheet (visual check on the phone still open)
- [x] D. Mayors and events
- [x] E. Opportunities filter bug
- [x] Changelog 0.7.1, version, README, APK, docs/summary-v0.7.1.md

Part A findings: Lapis average is 6 (4 to 8), not 4.5; Tarantula String
compacts 160, not 192; String and Rotten Flesh average 3.16; Wheat storage
starts at 128; Fishing storage 640 to 960 and one action per catch.
Iron/Gold left out (needs Auto Smelter).

## Part B: ranking

One Bazaar snapshot (2026-10-11), tier XI, Enchanted Lava Bucket, Super
Compactor 3000 + Diamond Spreading, 1 minion, 1.25% tax, coins/day:

| # | Before (0.7.0 values) | After (0.7.1) |
|---|---|---|
| 1 | Tarantula 110,915 | Tarantula 114,697 |
| 2 | Revenant 84,737 | Lapis 82,945 |
| 3 | Slime 71,472 | Wheat 81,502 |
| 4 | Redstone 65,148 | Glowstone 79,182 |
| 5 | Lapis 62,165 | Revenant 77,491 |

Causes found, in the order of their weight:

1. **Raw prices from a lone order.** Raw Fish topped at 310 coins while its
   enchanted form is worth 5 per fish; Prismarine Crystals 935 against 2.
   Without a compactor the Fishing Minion came out at 590,616 coins/day.
   Fixed: a raw item is never counted above its enchanted form per piece
   (+30%) or its 7 day median (+30%).
2. **Wrong item ids.** Raw Salmon, Pufferfish and Tropical Fish do not exist
   on the Bazaar under those names (RAW_FISH:1, :3, :2); they counted as 0.
3. **Old numbers.** Lapis counted 4.5 instead of 6 per harvest; String
   compacted at 192 instead of 160; String/Rotten Flesh at 3.5 instead of
   3.16. Lapis rose, Revenant fell.
4. **No second step.** The block form is now priced and the better is used.
5. **Thin markets** were not marked. In this snapshot only Lapis and
   Glowstone raw (no compactor) trip the limit; with a compactor nothing does.

What stays: Tarantula and Revenant stay on top because their prices are real.
They need Slayer level V (tiers I-XI) or IX (tier XII) on the wiki, which the
calculator does not show. Not changed, only to be named in the report.

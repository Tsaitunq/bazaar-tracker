# Summary 0.7.2

Branch `feat/v0.7.2`, one commit per part, not pushed, not merged.
243 tests green. Debug APK built (`versionName` 0.7.2, `versionCode` 100702).
Game data from hypixelskyblock.minecraft.wiki; the recipes still come from
the NEU repo and NPC prices from the items API, as before.

## Done

| Part | What |
|---|---|
| F | Craft hint on opportunity cards (same calculation, "recipe must be unlocked"); a tap opens the Craft tab on the end product |
| G | Craft modes Order → Order, Insta-buy → Order, Insta-buy → Insta-sell, with book depth, crafts per pass, orders and capital; the tab now hides suspicious crafts and applies the volume filter |
| H | NPC tab shows craft steps (single-ingredient recipes), per coin / per item / per minute; the 500M coins a day limit is counted |
| I | Calendar checked: matches the game. "Year of the …": no year on the wiki, left open |
| J | Slayer requirements of Tarantula and Revenant (badge, sheet, hide filter, levels); Derpy tax note with a button |

## Answers

**F.1** On one snapshot (2026-10-11, default settings) the plan has 21 flips,
8 of them are ingredient of some recipe, 6 of those crafts are profitable,
none beats its flip: **0 hints**. Closest: Enchanted Mycelium into
Amalgamated Crimsonite, 329k/h against 538k/h. 240 of 314 recipes are
profitable on their own; the hint needs one that beats the flip with the same
coins, which is rare. The opportunity list had 0 hints in its top 40 too.

**H.4** Yes: "limited to only selling up to 500,000,000 Coins per day, which
resets at 00:00 UTC+0" (wiki, Merchant). In coins, not items; nothing per item.
It caps the hourly volume of NPC flips and is noted on the NPC tab. The
640-items limit on the page NPC is a buy limit of shops, not relevant here.
Craft steps in numbers: of 195 single-ingredient steps with both NPC prices,
172 pay exactly the sum of the items, 21 pay less, 2 pay more (Obsidian
+28.6%, String +20%). With 16 crafts Obsidian earns 13,312 against 8,192 coins.
With instant-buy prices (the book's sell offers) none of the 191 flips gains;
with the buy order the two above do, and the card says which basis it used.

**I** The app computes Late Summer 11, year 519 for 2026-10-11 08:55 to 09:15
UTC (10:55 to 11:15 CEST). That fits the observation "Late Summer 11, year
519, Vormittag" without a correction. The test uses that moment as anchor.
Check on the phone with the exact game time: the day is only 20 minutes long.

**I.2** The wiki gives "every 12 SkyBlock Years" and the real dates of the
update (Seal: Feb 6, 2025), but no SkyBlock year number and no order of the
cycle (pages Events, Calendar, SkyBlock_Year, the three events). So no
countdown and no "this year is affected" note: open, not guessed.

## Decisions to know

- Craft default 16 crafts per pass; the setting is in the Craft filter sheet.
- The Craft tab filters changed behaviour: suspicious crafts and crafts under
  the Vol./week filter (default 100,000) no longer show. The portfolio hints
  are unchanged.
- Derpy: wiki says "Bazaar and Auction House tax are quadrupled" and gives no
  percentage; the app uses 4 × the player's own tax (5%, 4.5%, 4%).
- Slayer levels default to 9, so nothing is locked until the player enters
  their levels.

## Open

- Year of the Seal, Witch, Pig: no year on the wiki.
- Minion requirements other than Slayer and Fishing are collection tier I and
  not shown.
- The craft hint for opportunities does not know which recipes are unlocked.
- Not run: Android unit tests (the flip maths was not changed).

## Phone checklist

1. Opportunities: if a card has "Craft into … +X/h · uses N orders · recipe
   must be unlocked" (rare, often none), tap it: Craft tab, searched for the
   end product.
2. Craft filter sheet: "Craft mode" and "Crafts per pass". Switch the mode:
   the numbers and the Orders line change (2+ingredients, 1, 0). Raise the
   passes to 1000: Insta modes get worse or disappear.
3. NPC tab: note about the 500M a day; a card with "Craft 160× into …" lines
   if any (Obsidian, String when their prices allow).
4. Minions: form has Spider Slayer, Zombie Slayer, Craftable. Set Spider 4:
   the Tarantula card shows a warning badge; "Hide those I cannot craft"
   hides it. Tarantula sheet shows "Requires …".
5. Settings, Tax: three new values 5, 4.5, 4. With Derpy as mayor (not now)
   a note on Today and Trade offers them; check the note is absent today and
   appears if you pick 5% by hand ("Derpy is not mayor …", button back).
6. What's new shows 0.7.2 with four entries; version reads 0.7.2.

## Part K: fixes from the phone test of 0.7.1

1. **Tap opens the item, not the sheet.** Cause: in 0.7.1 the replacement
   that gave the card `data-minion` did not apply (CRLF against LF) and
   nothing noticed; the card still linked to the raw item. The sheet test
   only built the sheet. Now the whole card is a button (no `href`), Enter and
   Space work, and a test asserts the card has no link. Not run on a phone or
   an emulator by me.
2. **Minion heads.** 21 files in `icons/minions/` (64 × 64, 4 to 8 kB each,
   from sky.coflnet.com `<NAME>_GENERATOR_1`, the same source as the item
   pictures), in the app shell and the APK. **Licence not confirmed**: the
   source states none; the artwork belongs to Hypixel and Mojang. Details and
   the wiki alternative (CC BY-NC-SA 3.0, extra terms unread) in
   `docs/image-sources.md`. The footer already names sky.coflnet.com; nothing
   found requires more.
3. **Tarantula T11, Super Compactor, Enchanted Lava Bucket** (snapshot
   2026-10-11, 1 minion, tax 1.25%): an action every 8 s (10 s ÷ 1.25), a
   harvest every 16 s, 5,400 harvests a day.

   | Drop | Form | Amount/day | Price | Coins/day |
   |---|---|---|---|---|
   | Enchanted String | enchanted | 106.7 | 631.8 | 66,539 |
   | Enchanted Spider Eye | enchanted | 33.8 | 792.1 | 26,399 |
   | Enchanted Iron | enchanted | 6.8 | 525.7 | 3,504 |
   | Fuel | permanent | | | 0 |
   | **Net** | | | | **96,443** |

   With a compactor only the enchanted forms are priced; raw String never.
   Raw String is indeed the odd one: best order 2.5, best offer 28.6 (22 buy
   orders, 81 sell offers). Without a compactor the calculator now marks it
   "price unreliable" (offer over three times the order) and lists the minion
   last; the number there (48,846) is then shaky.
4. **Fuel/day** for a permanent fuel reads "permanent (one-time cost)", card
   and sheet.

Also: the changelog entry of the craft hint was merged into the craft modes
entry to make room for a fifth (at most four per version).

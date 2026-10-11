# Summary: timing backfill

Branch `feat/timing-backfill`, not pushed, not merged. 256 tests green. APK
built, version 0.7.3. Run on 2026-10-11, 958 requests at one a second,
about 17 minutes, no error and no 429. Result: `timing-backfill.json` (50 kB,
100 runs). Method: `docs/timing-backfill.md`.

## Results

"Into" is the median change from the 24 h before to the term or event;
"confirmed" is at least 3 runs in the same direction. Every run is from the
backfill (src "backfill"), except where stated.

| Perk / event | Runs | Items with data | Confirmed | Direction | Biggest changes |
|---|---|---|---|---|---|
| Marauder (Paul) | 12 (+1 own) | 22 | 21 | all down | Dark Orb −48%, Necromancer's Brooch −46%, Suspicious Vial −46%, Wither Blood −21%, Giant Tooth −20%, Precursor Gear −17% |
| Mythological Ritual (Diana) | 12 | 15 | 13 | 12 down, 1 up | Harpy Shard −40%, Cretan Bull Shard −36%, Minotaur Shard −36%, Ancient Claw −35%, Fateful Stinger −32%, Daedalus Stick −19% |
| Fishing Festival (Marina) | 12 | 8 | 8 | all down | Shark Bait −55%, Blue Shark Tooth −22%, Nurse Shark Tooth −19%, Enchanted Shark Fin −16%, Great White Shark Tooth −13%, Great White Tooth Meal −12% |
| Blooming Business (Finnegan) | 12 | 1 | 1 | down | Fine Flour −17% |
| Stock Exchange (Diaz) | 12 | 1 | 1 | down | Stock of Stonks −4% |
| Mining Fiesta (Cole) | 1 (+1 own) | 3 (2 with data) | 0 | – | Refined Mineral −18%, Glossy Gemstone −14% in one run: too few |
| Spooky Festival | 12 | 7 | 6 | all down | Werewolf Skin −32%, Soul Fragment −23%, Pumpkin Guts −20%, Ectoplasm −14%, Purple Candy −8%, Green Candy −3% |
| Jerry's Workshop | 12 | 10 | 7 | 6 down, 1 up | Ice Bait +20%, Glacial Fragment −13%, Green Gift −13%, White Gift −9%, Red Gift −9% |
| Harvest Feast | 12 | 14 | 13 | 12 down, 1 up | Crystalized Moonlight −12%, Feast Flask −12%, Floral Gelatin −10%, Cane Knot −8%, Aggourdian and Melon Juice −6% |
| Grand Feast (Finnegan) | 3 | 14 | 11 | all down | Aggourdian −36%, Deepfries −32%, Salted Sunflower Seeds −30%, Botroot −28%: only 3 runs |

Control: ENCHANTED_DIAMOND, ENCHANTED_SUGAR and ENCHANTED_COAL over the same
windows of Marauder, Mythological Ritual, Fishing Festival and Spooky: median
change between −1.2% and +0.6%. The falls are therefore not general price
drift. They are what the perks and events do; the wiki itself states no
price direction, so this is the first measured one (until now "expected").

Marina, Great White Shark Tooth: −12.6% from before the term to during it
(8 of 12 terms fell more than 1%, median −12.6%), afterwards +1.5% (6 runs,
not a pattern). Great White Tooth Meal −11.8% (10 runs) and Enchanted Shark
Fin −15.7% (9 runs), Shark Bait −54.5% (9 runs, the biggest). All 8 items of
the festival fall; the three crafted ones (Enchanted Shark Fin, Great White
Tooth Meal, Shark Bait) fall as much or more than the raw drops.

## What was included, what left out

- **Included:** every perk with items in the app (Marauder, Mining Fiesta,
  Mythological Ritual, Fishing Festival over Marina's whole term, Blooming
  Business, Stock Exchange) and the fixed events with items that are
  measurable: Spooky Festival (one real hour: measured over six hours from the
  start), Jerry's Workshop (10 h), Harvest Feast (31 h), Grand Feast.
- **Left out:** Season of Jerry (an hour inside the Workshop with the same
  items), Traveling Zoo, New Year Celebration, Hoppity's Hunt, the election
  (no items), the single one-hour Fishing Festivals (the term is measured
  instead), minister terms (the chosen perk is not recorded), and election
  ids before 179.
- **Perk changes:** Mining Fiesta changed on 2026-08-25 (wiki), so only one
  term after it counts; with the own run it is 2 of 3. It stays unconfirmed
  until the third. Blooming Business, Stock Exchange: from 2024-07-02; Grand
  Feast: from 2026-04-28.
- **Items without data:** the script stops asking for an item once a window
  had no rows (an item that did not exist yet). Mythological Ritual: 13 of 15
  items confirmed; the other two did not move in one direction in 3 runs.

## Caveats

- 12 runs are the newest 12: for the fixed events that is the last two
  months (an event comes every 5.2 days), not different seasons.
- Windows overlap with other effects: the 24 h before a mayor's term is the
  end of the previous mayor's; Jerry's Workshop (Late Winter) and the
  Feast months are long. A fall in the term window can also include a
  recovery from the election rush; the control items do not show one.
- The "after" window of a term is 22 hours instead of 24.
- Patterns say "based on historical data (SkyCofl)" or "1 own, 2 from
  historical data (SkyCofl)". Attribution: Market radar and footer.
- Remove: `node scripts/timing-remove-backfill.mjs <timing.json>` and delete
  `timing-backfill.json`.
- The snapshot run merges `timing-backfill.json` into `timing.json` on the
  data branch after the next merge to main; nothing was pushed.

## App changes

- `timing.js`: `src`, `nOwn`/`nBackfill`, `mergeBackfill`, `removeBackfill`,
  `runMedians`; `scripts/backfill-lib.mjs`, `scripts/timing-backfill.mjs`,
  `scripts/timing-remove-backfill.mjs`, `scripts/snapshot.mjs` merges the file.
- Fishing Festival items: `GREAT_WHITE_TOOTH_MEAL` and `SHARK_BAIT` added
  (crafted from festival drops, on the Bazaar).
- Changelog 0.7.3, README, APK.

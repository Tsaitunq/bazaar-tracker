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

## Buy and sell windows (second backfill, 2026-10-11)

Run again with wider windows: two days before the start to three days after
the end, fetched in chunks of 7 days (two requests per item for a term). 1,544
requests at one a second by a single process, no 429; the previous process was
checked to be gone first. Result `timing-backfill.json` (182 kB, 100 runs, every
run with a curve, 12 each; Grand Feast 3). The three medians per run are now
the full 24 h windows, so the confirmed patterns above may differ by a point or
two from the first run.

Each run has the median price per phase (before: pre2, pre1; term: day 1 to 5;
event: during; after: day 1 to 3). A window is the pair of a phase and a later
one with the best typical gain after the 1.25% tax; shown above 3% and when it
paid in two thirds of the runs that have both phases. 25 windows pass.

Top 10, tax 1.25%, by typical gain after tax:

| # | Item | Perk / event | Buy around | Sell around | Gain after tax | Hit rate |
|---|---|---|---|---|---|---|
| 1 | Necromancer's Brooch | Paul · Marauder | day 5 of the term | 3 days after the term | +160% | 10/12 |
| 2 | Dark Orb | Paul · Marauder | day 5 of the term | 3 days after the term | +52% | 11/12 |
| 3 | Fateful Stinger | Diana · Mythological Ritual | day 3 of the term | 2 days after the term | +35% | 8/8 |
| 4 | Ancient Claw | Diana · Mythological Ritual | day 3 of the term | 3 days after the term | +34% | 8/11 |
| 5 | Melon Juice | Grand Feast (Finnegan) | day 4 | 2 days after | +27% | 3/3 (3 runs only) |
| 6 | Green Gift | Jerry's Workshop | 1 day after the event | 3 days after | +27% | 9/12 |
| 7 | Pumpkin Guts | Spooky Festival | during the event | 2 days after | +26% | 9/11 |
| 8 | Designer Coffee Beans | Grand Feast | 1 day after | 3 days after | +25% | 2/3 (3 runs only) |
| 9 | White Gift | Jerry's Workshop | 1 day after the event | 3 days after | +22% | 8/12 |
| 10 | Soul Fragment | Spooky Festival | during the event | 3 days after | +19% | 10/11 |

By key: Marauder 5 windows (median +10%), Mythological Ritual 2 (+35%), Spooky
3 (+19%), Jerry's Workshop 5 (+14%), Harvest Feast 2 (+12%), Grand Feast 7
(+19%, 3 runs), Stock Exchange 1 (+3%).

Curves worth knowing (median price relative to the day before the term):

- **Marauder, Necromancer's Brooch:** 0.84, 0.67, 0.71, 0.60, 0.42 on days 1
  to 5, then 0.59, 0.70, 0.99 on the three days after. The price keeps falling
  to the end of the term and is back after three days. Dark Orb: low from day
  2 (0.5 to 0.6), 0.8 three days after.
- **Marina, Great White Shark Tooth:** 0.99, 0.84, 0.83, 0.84, 0.84 on days 1
  to 5 and 0.87, 0.87, 0.83 after: it falls on day 2 and **stays down** for
  the three days after. Shark Bait keeps falling (day 5: 0.40, three days
  after: 0.17), Enchanted Shark Fin 0.77 at the end and 0.83 after, Great White
  Tooth Meal 0.80 and 0.85. There is no buy/sell pair that pays: no window is
  shown for Marina. What the data says is the reverse: do not hold these items
  into her term; they are cheaper from day 2 and not back within three days.
  A longer look (more than three days after) is not in the data.
- **Jerry's Workshop, Ice Bait:** 1.50 during, but 0.46 on the first day after
  and 1.36 on the second: too unsteady for a window (a +20% pattern, see above).

Caveats: the "after" days are days of the next mayor's term, whose perks
can also move an item; the gain is the median price relation, not a profit
you can make at once (volume, order time and the spread of the book are not
in it); 12 runs are a few weeks.

Today notice (`buyNow`) on the data branch's election (Paul, at the time of
writing): Precursor Gear and Fuming Potato Book are in their buy phase now,
Wither Blood and Carrot Zest (Harvest Feast) within a day.

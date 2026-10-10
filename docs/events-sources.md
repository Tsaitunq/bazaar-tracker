# Sources for events, mayor perks and Auction House fees

Checked on 2026-10-10. The official wiki (`wiki.hypixel.net`) was closed in
July 2026 and redirects to a forum post, so the community wiki at
`hypixelskyblock.minecraft.wiki` is the main source. Item ids were checked
against one saved Bazaar API response; every id below is traded on the Bazaar.

The app marks these items as "typically affected". That is all the sources
support: the item is obtained during the event or through the perk. No source
says whether a price goes up or down. Where the app names a direction, it is
either measured from its own snapshots or an expectation that is labelled as
one; see "Price direction" below.

## SkyBlock time

| Fact | Value | Source |
|---|---|---|
| Start of year 1 | 1560275700000 ms Unix time | NotEnoughUpdates `CalendarOverlay.java`: `SKYBLOCK_START = 1559829300000L // Day 0, Year 0`, plus one year |
| Year | 124 real hours, 372 days, 12 months of 31 days | https://hypixelskyblock.minecraft.wiki/w/Events |
| Day | 20 real minutes (124 h / 372) | derived |

Cross-check: the election API reported the mayor elected in year 518 while
this clock gave year 519, Early Summer 2.

## Events with fixed dates

Source for all dates: https://hypixelskyblock.minecraft.wiki/w/Events

| Event | Dates | Items marked | Source for the items |
|---|---|---|---|
| Spooky Festival | Autumn 29–31 | `GREEN_CANDY`, `PURPLE_CANDY`, `PUMPKIN_GUTS`, `ECTOPLASM`, `WEREWOLF_SKIN`, `SPOOKY_SHARD` (Spooky Fragment), `SOUL_FRAGMENT` | https://hypixelskyblock.minecraft.wiki/w/Spooky_Festival ; Soul Fragment: item lore in the NEU repo ("…creatures during the Spooky Festival.") |
| Jerry's Workshop | all of Late Winter | `WHITE_GIFT`, `GREEN_GIFT`, `RED_GIFT`, `ICE_HUNK` (Hunk of Ice), `BLUE_ICE_HUNK` (Hunk of Blue Ice), `ENCHANTED_ICE`, `ENCHANTED_PACKED_ICE`, `WALNUT`, `GLACIAL_FRAGMENT`, `ICE_BAIT` | https://hypixelskyblock.minecraft.wiki/w/Jerry%27s_Workshop and https://hypixelskyblock.minecraft.wiki/w/Season_of_Jerry |
| Season of Jerry | Late Winter 24–26 | same list as Jerry's Workshop | https://hypixelskyblock.minecraft.wiki/w/Season_of_Jerry |
| New Year Celebration | Late Winter 29–31 | none | – |
| Traveling Zoo | Early Summer 1–3 and Early Winter 1–3 | none (it sells pets, which are not on the Bazaar) | – |
| Hoppity's Hunt | Early Spring 1 to Late Spring 31 | none | – |
| Mayor election | booth opens Late Summer 27, closes Late Spring 27 | none | – |

## Events and items tied to a mayor perk

The perk has to be active, either through the mayor or the minister. The
current perks come from the election API
(`https://api.hypixel.net/v2/resources/skyblock/election`).

| Perk | When | Items marked | Source |
|---|---|---|---|
| Fishing Festival (Marina) | first 3 days of every month | `SHARK_FIN`, `ENCHANTED_SHARK_FIN`, `NURSE_SHARK_TOOTH`, `BLUE_SHARK_TOOTH`, `TIGER_SHARK_TOOTH`, `GREAT_WHITE_SHARK_TOOTH` | https://hypixelskyblock.minecraft.wiki/w/Fishing_Festival |
| Mining Fiesta (Cole) | shown as an active perk without dates | `REFINED_MINERAL`, `GLOSSY_GEMSTONE` | https://hypixelskyblock.minecraft.wiki/w/Mining_Fiesta ; the perk text from the API names both items |
| Mythological Ritual (Diana) | whole term | burrow loot: `GRIFFIN_FEATHER`, `BRAIDED_GRIFFIN_FEATHER` (Deific Spade), `MYTHOS_FRAGMENT`; every creature: `ANCIENT_CLAW`, `ENCHANTED_ANCIENT_CLAW`; Minotaur: `DAEDALUS_STICK`, `SHARD_MINOTAUR`; Minos Inquisitor: `ENCHANTMENT_ULTIMATE_CHIMERA_1` (Chimera I); Manticore: `FATEFUL_STINGER`; Sphinx: `BRAIN_FOOD`, `SHARD_SPHINX`; Minos Hunter: `SHARD_MINOS_HUNTER`; Cretan Bull: `SHARD_CRETAN_BULL`; Harpy: `SHARD_HARPY`; King Minos: `SHARD_KING_MINOS` | https://hypixelskyblock.minecraft.wiki/w/Mythological_Ritual (burrow loot per spade and the drops per creature; read on 2026-10-10) |

Mythological Ritual, added on 2026-10-10: Braided Griffin Feather, Chimera I,
Fateful Stinger, Brain Food and the six shards. The page says the event
"occurs when Diana is elected as Mayor with her Mythological Ritual perk".
Not marked because they are not on the Bazaar: Shimmering Wool, Manti-core,
Hilt of Revelations, Cretan Urn, Crown of Greed, Minos Relic, Antique
Remedies, Washed-up Souvenir, Dwarf Turtle Shelmet, Crochet Tiger Plushie.
Not marked because the ritual is only one of many sources: Enchanted Gold
Ingot. The shard ids were matched by name ("Minotaur Shard" is
`SHARD_MINOTAUR`); the page does not say whether a shard has other sources.

Open points:

- Mining Fiesta dates: the Events page lists "1st to 7th of Early Summer,
  Late Summer, Autumn and Early Winter", the Mining Fiesta page says the whole
  term. The app therefore shows no countdown for it.
- The wiki pages describe these perks for a mayor. That a minister's perk
  works the same way is taken from the API, which lists the minister's perk
  as active.
- Bonus events from Foxy's "Extra Event" and Jerry's "Perkpocalypse" are not
  shown.

## Price direction

Checked on 2026-10-10.

**Measured.** For every event with items and every perk listed below, the
snapshot run stores three medians of the sell price per item: the 24 hours
before the start, the event or term itself, and the 24 hours after. A
direction counts as confirmed when three runs moved the same way by at least
1 %. A window is cut short where it would reach into the neighbouring run
(Fishing Festival, every month).

**Expected.** Until then the app shows "Expected" with the reason. The reason
is what the source says about the perk; "cheaper" is our own conclusion from
it and no source states it.

| Perk | What the source says | Items | Source |
|---|---|---|---|
| Marauder (Paul) | "Dungeon reward chests are 20% cheaper." | `RECOMBOBULATOR_3000`, `FUMING_POTATO_BOOK`, `WITHER_CATALYST`, `PRECURSOR_GEAR`, `FIRST_MASTER_STAR` to `FIFTH_MASTER_STAR`; added on 2026-10-10 from the chest tables per floor: `WITHER_BLOOD`, `IMPLOSION_SCROLL`, `SHADOW_WARP_SCROLL`, `WITHER_SHIELD_SCROLL` (floor VII), `GIANT_TOOTH`, `SADAN_BROOCH` (floor VI), `DARK_ORB` (floor V), `NECROMANCER_BROOCH`, `SPIRIT_BONE`, `SPIRIT_WING` (floor IV) | perk: https://hypixelskyblock.minecraft.wiki/w/Paul ; chest loot: https://hypixelskyblock.minecraft.wiki/w/Dungeon_Reward_Chest and the tables "Gold/Diamond/Emerald/Obsidian/Bedrock Chest Loot" on https://hypixelskyblock.minecraft.wiki/w/The_Catacombs_-_Floor_VII/Loot , `…Floor_VI/Loot`, `…Floor_V/Loot`, `…Floor_IV/Loot` |
| Mining Fiesta (Cole) | Refined Mineral and Glossy Gemstone drop from mining while the perk is active | as in the table above | https://hypixelskyblock.minecraft.wiki/w/Mayor_Election |
| Mythological Ritual (Diana) | the Griffin pet "lets you find Mythological Creatures and tons of unique items" | as in the table above | https://hypixelskyblock.minecraft.wiki/w/Mayor_Election |
| Fishing Festival (Marina) | "earn unique Shark loot" during the festivals | as in the table above | https://hypixelskyblock.minecraft.wiki/w/Mayor_Election |

### Warning in the portfolio

While an election runs, a flip in the portfolio is marked "<candidate> may
lower this price" when a perk from the table above lists the item and that
perk is coming: any perk of the candidate with the most votes, or the minister
perk of the runner-up. "The runner-up will become a Minister, activating their
minister perk alongside the Mayor's perks"
(https://hypixelskyblock.minecraft.wiki/w/Mayor_Election); the election API
flags that perk per candidate (`"minister": true`), and `election.json`
keeps its name as `minister`.

In the last 24 hours of a term, a flip is marked "<mayor> leaves in Xh – price
may rise back" when a perk of the mayor or of the minister lists the item. A
term ends when the next election closes (Late Spring 27).

Both are the same expectation as above, not a measurement.

Not added – unclear source (2026-10-10):

- Suspicious Vial, Red Nose, Red Scarf: named on the Dungeon Reward Chest
  page, but the chest tables of floors I to III were not read.
- Wither Essence and Undead Essence: in every chest table, but mostly made by
  salvaging dungeon gear.
- Chest loot that is not on the Bazaar: Warped Stone, Spirit Stone, Necron's
  Handle, armor and weapons.
- Mining Fiesta: "Fiesta Flask and Packrat Shard can be bought from Brynmor
  while the perk is active" (Mayor Election page). Left out; the Bazaar id
  `SHARD_PACKRAT_SKULL` was not confirmed to be that item.

Left out on purpose:

- "More expensive": no source describes a perk that would make a Bazaar item
  scarcer, so this list is filled from measurements only.
- Pathfinder (Aatrox, "Gain rare drops 20% more often"): the Slayer page does
  not say which drops count as rare and calls its loot section outdated.
- Dungeon chest loot that is mostly made another way (Hot Potato Book) or that
  the page only calls chest-related (Kismet Feather), and the enchanted books.
- TURBO MINIONS (Derpy) and the minion perks: they touch too many items to
  name a list.

The term of a mayor starts when the election closes (Late Spring 27). The
election API names the election a mayor won (`mayor.election.year`); the
fixture shows the mayor of election 518 in office in year 519, so a term is
only recorded for a mayor whose election year is the year before its start.

## Auction House fees

Source: https://hypixelskyblock.minecraft.wiki/w/Auction_House

| Fee | Value |
|---|---|
| Listing a BIN | 1 % of the price below 10,000,000 coins, 2 % from 10,000,000 to 100,000,000, 2.5 % above |
| Collecting the coins | up to 1 % on sales above 1,000,000 coins; the payout never drops below 1,000,000 |

While Derpy is mayor the collection tax is quadrupled (4 %), the listing fee
is not; same page. The app applies this when the election data names Derpy as
mayor.

Not included in the app's estimate: the fee for the auction's duration (the
page gives no table for it).

## Forge recipes

Source: https://github.com/NotEnoughUpdates/NotEnoughUpdates-REPO, files under
`items/`: recipes with `"type": "forge"` (`inputs`, `duration` in seconds,
`count`) and the HotM tier from `crafttext` ("Requires: HotM 6").

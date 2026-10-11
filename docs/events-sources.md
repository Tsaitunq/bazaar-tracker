# Sources for events, mayor perks and Auction House fees

Checked on 2026-10-10 and again on 2026-10-11 (0.7.1). The official wiki
(`wiki.hypixel.net`) was closed in July 2026, so the SkyBlock wiki at
`hypixelskyblock.minecraft.wiki` is the primary source for all game data (the
repo rule in `CLAUDE.md`). Anything from another source is marked "not
confirmed". Item ids were checked
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
| Harvest Feast | Early Autumn 1 to Late Autumn 31, every year ("3 months spanning Early Autumn, Autumn, and Late Autumn") | the 13 Rare Crops: `CORNUCOPIA`, `CARROT_ZEST`, `DEEPFRIES`, `AGGOURDIAN`, `CANE_KNOT`, `MELON_JUICE`, `CACTUS_FLOWER`, `DESIGNER_COFFEE_BEANS`, `FEASTFUNGUS`, `BOTROOT`, `SALTED_SUNFLOWER_SEEDS`, `CRYSTALIZED_MOONLIGHT`, `FLORAL_GELATIN`, and `FEAST_FLASK` | https://hypixelskyblock.minecraft.wiki/w/Harvest_Feast and the Events page. The wiki table names the Rare Crops but gives no item ids; the ids are the Bazaar items of the same name (all exist in the 2026-10-11 snapshot). Seasoning "has no physical item" |
| Mayor election | booth opens Late Summer 27, closes Late Spring 27 | none | – |

### Jerry's Workshop: Einary's shop and the Gifts (added in 0.7.3)

Wiki pages Einary and Jerry's Workshop, read 2026-10-11. Einary's Emporium sells
for North Stars (the only price on the page: Refrigerate "50→10 North Stars"):
Looting IV, Scavenger IV, Luck VI (enchanted books), Reindeer Pet, the Gift
Talismans (White, Green, Blue, Purple, Gold), Snow Cloak, Belt, Gloves and
Necklace, Ice Minion XII, Snow Minion XII, Refrigerate, Magic Top Hat and
Winter Fragment. The page does not say which are tradable. The Bazaar items
among them, added to the Workshop's items and marked as role "shop":
`ENCHANTMENT_LOOTING_4`, `ENCHANTMENT_SCAVENGER_4`, `ENCHANTMENT_LUCK_6`,
`MAGIC_TOP_HAT`, `WINTER_FRAGMENT` (listed in the shop's picture with a "2" and
no price). Refrigerate has no Bazaar id in the 2026-10-11 snapshot.

Gifts: `WHITE_GIFT` (about 20 scattered over the Workshop each time it opens),
`GREEN_GIFT` (from St. Jerry after all White Gifts, also a mob drop),
`RED_GIFT` (Chicken Race, also a mob drop); Golden Gift is named without a
source and has no Bazaar id. They are role "shop": only obtainable while the
Workshop is open. Ice Bait (`ICE_BAIT`) is role "demand" by expectation only:
the page lists it among the Ice Fishing items without saying how it is used.

**AH – later** (not on the Bazaar, left out for now): Reindeer Pet, Gift
Talismans, Snow Cloak/Belt/Gloves/Necklace, Ice Minion XII, Snow Minion XII,
Gift the Fish, Snowman Pet, Santa and Gingerbread Man minion skins, Snow Suit
Armor, Rune and Disc rewards.

**Paul, dungeon players:** the Dungeons page names "Dungeon potions consumed
during the run" and nothing else that is used up per run, and not whether it is
on the Bazaar. No demand item was added for Paul: no source.

### Roles

Every item has a role in the lists: **supply** (more of it while the driver
runs, cheaper during and dearer after), **demand** (used up while it runs:
dearer during, cheaper after) and **shop** (only obtainable while it runs, the
same curve as supply). The start is `expectedRole` in `events.js`; the measured
change of the median price (before to during, 1% or more) overrules it
(`itemRole` in `timing.js`), then the badge says "(measured)". The wiki states
no role.

### Grand Feast (Finnegan)

Event **Grand Feast**, only with Finnegan's perk "Grand Feast": "Finnegan
upgrades the Harvest Feast into the Grand Feast, making it last a full
SkyBlock year" (wiki pages Finnegan and Harvest_Feast). Same items as the
Harvest Feast (`CORNUCOPIA` and the others above). The app shows it as an event
with a countdown while the perk is active. The wiki adds Kernels and the
Grand Bakery (Feast Baker Scott); neither is a Bazaar item.

What the wiki does **not** say about the Feast: any price effect. The page has
a "Bazaar Cost" column for the Rare Crops, empty. A fall in the prices of the
Garden drops is therefore **not confirmed**; the app learns the direction from
its own snapshots (`timing.json`) like for every other event.

### "Year of the" events

"Event that happens every 12 SkyBlock Years" (wiki pages Year_of_the_Seal,
_Witch, _Pig). The wiki does not say in which years, so the app cannot
compute a start or a countdown and shows them as a note without date. A forum
post (0.21.3, not the wiki) says Seal and Pig alternate every six years until
more are added: **not confirmed**.

| Event | What happens (wiki) | Bazaar items named on the wiki's navigation | Direction |
|---|---|---|---|
| Year of the Seal | Lukas the Aquarist, Bouncy Beach Balls replace Treasure from fishing, Fishy Treats | `BOUNCY_BEACH_BALL`, `GIANT_BOUNCY_BEACH_BALL`, `SMALL_SEAL_PLUSHIE`, `MEDIUM_SEAL_PLUSHIE`, `LARGE_SEAL_PLUSHIE`, `GIANT_SEAL_PLUSHIE` | not stated, not confirmed |
| Year of the Witch | mobs drop ingredients (mostly 5%), Agnes and Alcina, Witches Stew | `SMALL_WITCH_CAULDRON`, `MEDIUM_WITCH_CAULDRON`, `LARGE_WITCH_CAULDRON`, `GIANT_WITCH_CAULDRON` (cauldrons: stock of 1 each per year at Agnes) | not stated, not confirmed |
| Year of the Pig | Shiny Pigs, Shiny Orbs, Piggy's shop for Shiny Tokens | `SMALL_PIG_EAR`, `MEDIUM_PIG_EAR`, `LARGE_PIG_EAR`, `GIANT_PIG_EAR` | not stated, not confirmed |

The wiki lists no further "Year of the" events ("Other: not found").

## Events and items tied to a mayor perk

The perk has to be active, either through the mayor or the minister. The
current perks come from the election API
(`https://api.hypixel.net/v2/resources/skyblock/election`).

| Perk | When | Items marked | Source |
|---|---|---|---|
| Fishing Festival (Marina) | first 3 days of every month | `SHARK_FIN`, `ENCHANTED_SHARK_FIN`, `NURSE_SHARK_TOOTH`, `BLUE_SHARK_TOOTH`, `TIGER_SHARK_TOOTH`, `GREAT_WHITE_SHARK_TOOTH`; crafted from them (wiki page Fishing Festival, 2026-10-11): `GREAT_WHITE_TOOTH_MEAL` (Great White Shark Tooth and Enchanted Bone), `SHARK_BAIT` (Shark Fin). Not on the Bazaar: Rod of the Sea, Shark Scale armor, Ichthyic and Finwave sets, Bluertooth Ring, the Shark Tooth necklaces | https://hypixelskyblock.minecraft.wiki/w/Fishing_Festival |
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

Resolved on 2026-10-11 (0.7.1):

- Suspicious Vial (Floor III), Red Nose (Floor I, also a Bonzo drop), Red
  Scarf (Floor II, Scarf): the wiki pages Suspicious_Vial, Red_Nose and
  Red_Scarf list "Dungeon Reward Chests" with drop chances per chest on those
  floors. Added to Marauder: `SUSPICIOUS_VIAL`, `RED_NOSE`, `RED_SCARF`.
- Packrat Shard: the Packrat_Shard page: "purchased from Brynmor for 250,000
  Coins with stock of 64 per Year while Cole is in office with Mining Fiesta
  perk"; Bazaar id `SHARD_PACKRAT_SKULL` given on the page. Added to Mining
  Fiesta. Brynmor's second item, Fiesta Flask, is not on the Bazaar.
- Still **not added, not confirmed:** Wither Essence and Undead Essence. Both
  pages list Dungeon Reward Chests as a source next to salvaging (and
  Dungeon Secrets, the Dungeon Hub Race; Undead Essence also mob drops), with
  no amounts, so a share from the chests cannot be given.
- Chest loot that is not on the Bazaar: Warped Stone, Spirit Stone, Necron's
  Handle, armor and weapons.
- Marauder's direction ("cheaper") is our conclusion from "Dungeon reward
  chests are 20% cheaper"; the wiki names no item prices (page Mayor_Election;
  there is no separate Marauder page).

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

## All mayors and perks (wiki: Mayor_Election, read 2026-10-11)

Which perks touch Bazaar items, and in which direction. "Direction" is only
given where the wiki ties an item to the perk; **the wiki states no price
direction for any perk**, so every direction is an expectation ("more supply
or cheaper input, so lower") or "not stated".

| Mayor | Perk | Effect (wiki) | Bazaar items | Direction |
|---|---|---|---|---|
| Aatrox | SLASHED Pricing | Starting Slayer quests is half price | none named | not stated |
| Aatrox | Slayer XP Buff | +25% Slayer XP | none | – |
| Aatrox | Pathfinder | "Gain rare drops 20% more often" | none named (the wiki does not say which drops are rare) | not stated |
| Cole | Prospection | Mining minions work 25% faster | none named | not stated (expected: lower for what mining minions make) |
| Cole | Mining XP Buff | +60 Mining Wisdom | none | – |
| Cole | Mining Fiesta | Refined Mineral and Glossy Gemstone drop from mining; Packrat Shard at Brynmor | `REFINED_MINERAL`, `GLOSSY_GEMSTONE`, `SHARD_PACKRAT_SKULL` | expected lower |
| Cole | Molten Forge | forging takes 25% less time | none named | not stated |
| Diana | Huntress' Intuition, Pet XP Buff, Sharing is Caring | stat and XP perks | none | – |
| Diana | Mythological Ritual | burrows and creatures with unique drops | as listed above | expected lower |
| Diaz | Long Term Investment | the minister appears in the next election with all perks | none | – |
| Diaz | Volume Trading | double item quantity from Shen's Auction | none named | not stated |
| Diaz | Stock Exchange | Stonks Auction, chance to win Stock of Stonks | `STOCK_OF_STONKS` | expected lower |
| Diaz | Shopping Spree | daily NPC buy limits x10 | none named | not stated |
| Finnegan | Pest Eradicator | longer Farming Fortune bonus, Pests spawn 20% less often | none named | not stated |
| Finnegan | GOATed | Jacob's brackets up to 10% bigger | none | – |
| Finnegan | Blooming Business | Visitors give Fine Flour, appear more often, +10% Copper | `FINE_FLOUR` | expected lower |
| Finnegan | Grand Feast | see above | the Feast items | not confirmed |
| Foxy | Sweet Benevolence | +30% Candy, Gifts, Chocolate from duplicate Rabbits | none named | not stated |
| Foxy | Extra Event / A Time for Giving / Chivalrous Carnival | extra event, Party Chests, Carnival | none named | not stated |
| Marina | Fishing XP Buff, Luck of the Sea 2.0, Double Trouble | fishing stats | none named | – |
| Marina | Fishing Festival | Sharks and unique Shark loot | as listed above | expected lower |
| Paul | Marauder | "Dungeon reward chests are 20% cheaper" | as listed above, plus the three above | expected lower (conclusion, see above) |
| Paul | EZPZ, Benediction | score and blessings | none | – |
| Scorpius (special) | Bribe | 50,000 to 1,000,000 coins | none | – |
| Scorpius (special) | Darker Auctions | 7 rounds, special items | none named | not stated |
| Jerry (special) | Perkpocalypse | activates all perks of another mayor every 6 hours | those of the copied mayor | – |
| Jerry (special) | Statspocalypse, Jerrypocalypse | stats; hidden Jerries | none named | – |
| Derpy (special) | QUAD TAXES!!! | "Pay 4x the normal amount of taxes" | Auction House collection tax (see below); Bazaar tax: not stated | not confirmed |
| Derpy (special) | TURBO MINIONS!!! | "Minions have double the output" | none named; touches all minion goods | expected lower |
| Derpy (special) | DOUBLE MOBS HP!!!, MOAR SKILLZ!!! | combat, skill XP | none | – |

Ministers: the wiki says a minister's perk is active alongside the mayor's
(the same table applies; the wiki does not say which perk of a regular
candidate becomes its minister perk, the election API does).

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

# Minion calculator: sources

Every number in `minions.js` is listed here with where it comes from. Nothing
is estimated. Where the source leaves something open, it says so below and the
app marks the minion as "not confirmed".

## Where the data comes from

Primary source for all SkyBlock game data: the Hypixel SkyBlock wiki at
<https://hypixelskyblock.minecraft.wiki/> (short name **W**). Read on
2026-10-11. The earlier version of this file used Internet Archive copies of
the closed official wiki and the Fandom wiki; those are no longer used.

Pages read: `Minion` (rules, fuel, upgrades), `Bazaar` (tax), and one page per
minion, `<Name>_Minion`, for every minion in the table below.

| Short name | Page |
|---|---|
| W:Minion | <https://hypixelskyblock.minecraft.wiki/w/Minion> |
| W:Bazaar | <https://hypixelskyblock.minecraft.wiki/w/Bazaar> |
| W:`<Name>` | `https://hypixelskyblock.minecraft.wiki/w/<Name>_Minion` |

## Rules

| Rule | Value | Source |
|---|---|---|
| Speed bonuses | additive: "Time Between Actions = Base Time Between Actions ÷ (1 + Combined Speed Boost)"; example "16 seconds ÷ (100% + 10%) ≈ 14.55 seconds" | W:Minion |
| Upgrade slots | two per minion | W:Minion |
| Diamond Spreading | "10%" chance per drop to generate a Diamond; triggered by the minion's base drops | W:Minion |
| Super Compactor 3000 | "Compacts items to their enchanted forms. Also compacts second-tier enchanted items when there are enough resources." | W:Minion |
| Flycatcher | +20% speed | W:Minion |
| Minion Expander | +5% speed (and range) | W:Minion |
| Actions per harvest | 2 (place, then harvest) for every minion except Fishing, which "can only perform harvest actions" = 1 | W:Fishing Minion; the value 2 for the others is the rule of the previous version, **not stated on the wiki pages read** (see below) |
| Bazaar tax | "1.25% tax on all Bazaar sales", reduced by the Bazaar Flipper perk to 1% at the top level | W:Bazaar |
| Storage | "Max Storage" per tier, in items; 64, 192, 192, 384, 384, 576, 576, 768, 768, 960, 960, 960 except Wheat (128 first) and Fishing | each minion page |

## Minions

"Time between actions" and storage are the tier table at the top of each page,
tier I first. Drops are the drops table (average amount and chance per
harvest), the enchanted form is the "Super Compactor 3000" row.

| Minion | Time between actions (s), tier I to XII | Drops per harvest | Super Compactor 3000 | Source |
|---|---|---|---|---|
| Snow Minion | 13, 13, 12, 12, 11, 11, 9.5, 9.5, 8, 8, 6.5, 5.8 | 4 Snowball (100%) | 640 Snowball → Enchanted Snow Block | W:Snow |
| Clay Minion | 32, 32, 30, 30, 27.5, 27.5, 24, 24, 20, 20, 16, 14 | 4 Clay Ball (100%) | 160 → Enchanted Clay Ball | W:Clay |
| Cobblestone Minion | 14, 14, 12, 12, 10, 10, 9, 9, 8, 8, 7, 6 | 1 Cobblestone (100%) | 160 → Enchanted Cobblestone | W:Cobblestone |
| Coal Minion | 15, 15, 13, 13, 12, 12, 10, 10, 9, 9, 7, 6 | 1 Coal (100%) | 160 → Enchanted Coal | W:Coal |
| Diamond Minion | 29, 29, 27, 27, 25, 25, 22, 22, 19, 19, 15, 12 | 1 Diamond (100%) | 160 → Enchanted Diamond | W:Diamond |
| Lapis Minion | 29, 29, 27, 27, 25, 25, 23, 23, 21, 21, 18, 16 | 6 Lapis Lazuli (average, range 4 to 8) | 160 → Enchanted Lapis Lazuli | W:Lapis |
| Redstone Minion | 29, 29, 27, 27, 25, 25, 23, 23, 21, 21, 18, 16 | 4.5 Redstone Dust (average, range 3 to 6) | 160 → Enchanted Redstone Dust | W:Redstone |
| Emerald Minion | 28, 28, 26, 26, 24, 24, 21, 21, 18, 18, 14, 12 | 1 Emerald (100%) | 160 → Enchanted Emerald | W:Emerald |
| Obsidian Minion | 45, 45, 42, 42, 39, 39, 35, 35, 30, 30, 24, 21 | 1 Obsidian (100%) | 160 → Enchanted Obsidian | W:Obsidian |
| Sugar Cane Minion | 22, 22, 20, 20, 18, 18, 16, 16, 14.5, 14.5, 12, 9 | 3 Sugar Cane (100%) | 160 → Enchanted Sugar | W:Sugar Cane |
| Slime Minion | 26, 26, 24, 24, 22, 22, 19, 19, 16, 16, 12 | 1 Slimeball (100%) + 1 (50%) + 1 (50%) = 2 on average | 160 → Enchanted Slimeball | W:Slime (tiers I to XI only) |
| Tarantula Minion | 29, 29, 26, 26, 23, 23, 19, 19, 14.5, 14.5, 10, 8 | 3.16 String (100%), 1 Spider Eye (100%), 0.2 Iron Ingot (20%) | 160 String → Enchanted String, 160 Spider Eye → Enchanted Spider Eye, 160 Iron Ingot → Enchanted Iron Ingot | W:Tarantula |
| Revenant Minion | 29, 29, 26, 26, 23, 23, 19, 19, 14.5, 14.5, 10, 8 | 3.16 Rotten Flesh (100%), 0.2 Diamond (20%) | 160 → Enchanted Rotten Flesh, 160 → Enchanted Diamond | W:Revenant |
| Wheat Minion | 15, 15, 13, 13, 11, 11, 10, 10, 9, 9, 8, 7 | 1 Wheat (100%), 1.5 Seeds (100%) | 160 Wheat → Enchanted Wheat, 160 Seeds → Enchanted Seeds | W:Wheat; storage 128, 256, 256, 384, 384, 576, 576, 768, 768, 960, 960, 960 |
| Carrot Minion | 20, 20, 18, 18, 16, 16, 14, 14, 12, 12, 10, 8 | 3 Carrot (100%) | 160 → Enchanted Carrot | W:Carrot |
| Potato Minion | 20, 20, 18, 18, 16, 16, 14, 14, 12, 12, 10, 8 | 3 Potato (100%) | 160 → Enchanted Potato | W:Potato |
| Melon Minion | 24, 24, 22.5, 22.5, 21, 21, 18.5, 18.5, 16, 16, 13, 10 | 5 Melon Slice (100%) | 160 → "Enchanted Melon Slice" (Bazaar: ENCHANTED_MELON) | W:Melon |
| Pumpkin Minion | 32, 32, 30, 30, 27, 27, 24, 24, 20, 20, 16, 12 | 1 Pumpkin (100%) | 160 → Enchanted Pumpkin | W:Pumpkin |
| Cactus Minion | 27, 27, 25, 25, 23, 23, 21, 21, 18, 18, 15, 12 | 3 Cactus (100%) | 160 Cactus Green (via Auto Smelter) → Enchanted Cactus Green | W:Cactus |
| Glowstone Minion | 25, 25, 23, 23, 21, 21, 19, 19, 16, 16, 13, 11 | 3 Glowstone Dust (100%) | 160 → Enchanted Glowstone Dust | W:Glowstone |
| Fishing Minion | 75, 75, 67, 67, 59, 59, 51, 51, 43, 43, 35, 30 | 0.54 Raw Cod, 0.225 Raw Salmon, 0.117 Pufferfish, 0.036 Tropical Fish, 0.02734 each Prismarine Crystals, Prismarine Shard, Sponge | 160 each, Sponge 40 | W:Fishing; storage 640, 640, 640, 704, 704, 768, 768, 832, 832, 896, 960, 960 |

## Fuel

From the "Minion Fuel" table of W:Minion.

| Fuel | Effect | Lasts |
|---|---|---|
| Enchanted Bread | speed +5% | 12 hours |
| Enchanted Charcoal | speed +20% | 36 hours (wiki: 1.5 days) |
| Enchanted Lava Bucket | speed +25% | permanent |
| Magma Bucket | speed +30% | permanent |
| Plasma Bucket | speed +35% | permanent |
| Hamster Wheel | speed +50% | 24 hours |
| Foul Flesh | speed +90% | 5 hours (tier II and above) |
| Catalyst | output ×3 | 3 hours |
| Hyper Catalyst | output ×4 | 6 hours |

Listed on the wiki and not in the calculator: Coal (+5%, 30 min), Block of
Coal (+5%, 5 h), Enchanted Coal (+10%, 1 day), Solar Panel (+25%, daylight
only), Everburning Flame (+40%, permanent), Tasty Cheese (×2, 1 h), Inferno
Minion Fuel (×10/×15/×20, 1 day).

A fuel that runs out costs `24 ÷ hours × its lowest sell offer` per day and
minion. A permanent fuel costs nothing per day; its purchase is not counted.

## Upgrades

| Upgrade | Effect | Source |
|---|---|---|
| Diamond Spreading | 10% chance of a Diamond per drop | W:Minion |
| Super Compactor 3000 | compacts to the enchanted form (also the second step when enough accumulate) | W:Minion and each minion page |
| Flycatcher | speed +20% | W:Minion |
| Minion Expander | speed +5% | W:Minion |

## What the source leaves open (marked "not confirmed")

- **Actions per harvest.** The pages read give no actions-per-harvest rule.
  The calculator keeps 2 (place, harvest) for all minions except Fishing (1,
  stated on its page). Melon and Pumpkin: the pages say that once the seeds
  are planted the minion needs no planting action online, but offline is
  counted with a replant after every harvest (offline output is "half"), so 2
  is used and a note is shown.
- **Enchanted Melon.** The wiki names the 160-slice item "Enchanted Melon
  Slice". The Bazaar item ENCHANTED_MELON is used; the mapping rests on the
  160× price ratio to ENCHANTED_MELON_BLOCK, not on a name.
- **Diamond Spreading with a Catalyst.** Not stated whether the extra
  Diamonds are multiplied. Counted once.
- **Bazaar tax on instant sell.** W:Bazaar says "1.25% tax on all Bazaar
  sales" and only says that for orders the tax is taken when claiming. It
  does not say anything about Instant Sell separately. The calculator takes
  your tax setting off, which is the careful reading.
- **Cactus.** The compactor rows run Cactus → Cactus Green (Auto Smelter) →
  Enchanted Cactus Green. A single Super Compactor alone leaves raw Cactus.
- **"Full after"** divides the storage by all items of a day. A minion with
  several drops fills a little sooner.

## Left out

- **Iron and Gold Minion.** They produce ore; compacting needs the Auto
  Smelter in the second slot (W:Iron Minion rows). Not modelled.
- Fuel listed above as "not in the calculator"; storage chests, hoppers,
  beacons, pets, mayor perks, Mithril Infusion.

Item ids (for prices) were compared with the product list of one Bazaar API
snapshot on 2026-10-11 (all ids used exist there).

## How the Bazaar value of a minion is formed (0.7.1)

- With a Super Compactor 3000 the minion holds the enchanted item and, once
  160 of it have gathered, the item of the second step (W:Minion: "also
  compacts second-tier enchanted items"). The calculator prices both and
  takes the better one per item. The second steps used are the ones the
  minion pages list (Clay, Diamond, Lapis, Emerald, Redstone, Sugar Cane,
  Iron, Pumpkin, Wheat, Seeds, Carrot, Potato, Cactus, Glowstone, Sponge).
- A form counts as thin when its weekly volume (the smaller of the units
  bought and sold) is below 20 times what the minions make in a week. A thin
  form is used only when no other form is available; the minion is then
  marked "low volume – price unreliable" and listed after the others.
- A price above the item's 7 day median (stats) by more than 30%, or above
  what its enchanted form is worth per piece by more than 30%, counts at that
  value. Crafting the enchanted form is always possible, so a raw item cannot
  honestly sell for more.
- The 20× and 30% limits are choices of this calculator (30% is the app's
  existing median limit); the wiki states none.

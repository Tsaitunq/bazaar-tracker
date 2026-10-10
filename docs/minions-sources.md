# Minion calculator: sources

Every number in `minions.js` is listed here with where it comes from. Nothing
is estimated. Where the sources leave something open, it says so below and the
app marks the minion as "not confirmed".

## Where the data comes from

Hypixel closed the official wiki (`wiki.hypixel.net`) in July 2026; its
addresses now redirect to the announcement
<https://hypixel.net/threads/end-of-the-official-hypixel-wiki-july-2026.6112020/>.
The numbers were therefore read on 2026-10-10 from the Internet Archive's
copies of the official wiki, each page in its last copy before the closure:

| Short name | Archived page |
|---|---|
| W:Minion | <http://web.archive.org/web/20260123222606/https://wiki.hypixel.net/Minion> (the Minion Fuel and Minion Upgrades pages redirect here) |
| W:Snow | <http://web.archive.org/web/20260210121227/https://wiki.hypixel.net/Snow_Minion> |
| W:Clay | <http://web.archive.org/web/20260128231043/https://wiki.hypixel.net/Clay_Minion> |
| W:Cobblestone | <http://web.archive.org/web/20260202162236/https://wiki.hypixel.net/Cobblestone_Minion> |
| W:Coal | <http://web.archive.org/web/20260112032124/https://wiki.hypixel.net/Coal_Minion> |
| W:Diamond | <http://web.archive.org/web/20260208062023/https://wiki.hypixel.net/Diamond_Minion> |
| W:Lapis | <http://web.archive.org/web/20260203145855/https://wiki.hypixel.net/Lapis_Minion> |
| W:Redstone | <http://web.archive.org/web/20260207025454/https://wiki.hypixel.net/Redstone_Minion> |
| W:Emerald | <http://web.archive.org/web/20260225082347/https://wiki.hypixel.net/Emerald_Minion> |
| W:Obsidian | <http://web.archive.org/web/20260304144326/https://wiki.hypixel.net/Obsidian_Minion> |
| W:Sugar Cane | <http://web.archive.org/web/20260201195207/https://wiki.hypixel.net/Sugar_Cane_Minion> |
| W:Slime | <http://web.archive.org/web/20260128171047/https://wiki.hypixel.net/Slime_Minion> |
| W:Tarantula | <http://web.archive.org/web/20260207181411/https://wiki.hypixel.net/Tarantula_Minion> |
| W:Revenant | <http://web.archive.org/web/20260131200214/https://wiki.hypixel.net/Revenant_Minion> |

Three rules are not on the official pages. They are from the community wiki
on Fandom, read on 2026-10-10:

| Short name | Page |
|---|---|
| F:Minions | <https://hypixel-skyblock.fandom.com/wiki/Minions> |
| F:Fuel | <https://hypixel-skyblock.fandom.com/wiki/Minion_Fuel> |
| F:Spreading | <https://hypixel-skyblock.fandom.com/wiki/Diamond_Spreading> |

## Rules

| Rule | Value | Source |
|---|---|---|
| Actions per harvest | 2: "will generate collectable resources every other action … a Tier I Cobblestone Minion does an action every 14 seconds, the minion will generate 1 Cobblestone every 28 seconds" | F:Minions |
| Speed bonus | `time between actions = base time ÷ (100% + speed increase)` | F:Fuel, "Calculations" |
| Several speed bonuses | they add up ("Minion Fuels are additive with other Minion speed upgrades"); two Flycatchers count as 40% | F:Fuel, "Notes" |
| Catalysts | "don't affect the Minion's Time Between Actions. Instead, they duplicate each item that the Minion produces" | F:Fuel, "Notes" |
| Upgrade slots | "Two Minion Upgrades per Minion can be used at a time" | W:Minion |
| Storage | "Max Storage" per tier, counted in items | each minion page |

## Minions

"Time between actions" is the line of that name in the tier list at the top of
each page, tier I first. Storage is the same on every page: 64, 192, 192, 384,
384, 576, 576, 768, 768, 960, 960, 960 (the Slime Minion page lists tiers I to
XI only). Drops are the "Resources" table (amount and chance per harvest), the
enchanted form is the "Super Compactor 3000" row of the "Upgrades" table.

| Minion | Time between actions (s), tier I to XII | Drops per harvest | Super Compactor 3000 | Source |
|---|---|---|---|---|
| Snow Minion | 13, 13, 12, 12, 11, 11, 9.5, 9.5, 8, 8, 6.5, 5.8 | 4 Snowball (100%) | 640 Snowball → Enchanted Snow Block | W:Snow |
| Clay Minion | 32, 32, 30, 30, 27.5, 27.5, 24, 24, 20, 20, 16, 14 | 4 Clay Ball (100%) | 160 Clay Ball → Enchanted Clay Ball | W:Clay |
| Cobblestone Minion | 14, 14, 12, 12, 10, 10, 9, 9, 8, 8, 7, 6 | 1 Cobblestone (100%) | 160 → Enchanted Cobblestone | W:Cobblestone |
| Coal Minion | 15, 15, 13, 13, 12, 12, 10, 10, 9, 9, 7, 6 | 1 Coal (100%) | 160 → Enchanted Coal | W:Coal |
| Diamond Minion | 29, 29, 27, 27, 25, 25, 22, 22, 19, 19, 15, 12 | 1 Diamond (100%) | 160 → Enchanted Diamond | W:Diamond |
| Lapis Minion | 29, 29, 27, 27, 25, 25, 23, 23, 21, 21, 18, 16 | 3-6 Lapis Lazuli (100%) | 160 → Enchanted Lapis Lazuli | W:Lapis |
| Redstone Minion | 29, 29, 27, 27, 25, 25, 23, 23, 21, 21, 18, 16 | 3-6 Redstone Dust (100%) | 160 → Enchanted Redstone Dust | W:Redstone |
| Emerald Minion | 28, 28, 26, 26, 24, 24, 21, 21, 18, 18, 14, 12 | 1 Emerald (100%) | 160 → Enchanted Emerald | W:Emerald |
| Obsidian Minion | 45, 45, 42, 42, 39, 39, 35, 35, 30, 30, 24, 21 | 1 Obsidian (100%) | 160 → Enchanted Obsidian | W:Obsidian |
| Sugar Cane Minion | 22, 22, 20, 20, 18, 18, 16, 16, 14.5, 14.5, 12, 9 | 3 Sugar Cane (100%) | 160 → Enchanted Sugar | W:Sugar Cane |
| Slime Minion | 26, 26, 24, 24, 22, 22, 19, 19, 16, 16, 12 | 1 Slimeball (100%) + 1 (50%) + 1 (50%) = 2 on average | 160 → Enchanted Slimeball | W:Slime |
| Tarantula Minion | 29, 29, 26, 26, 23, 23, 19, 19, 14.5, 14.5, 10, 8 | 2-5 String (100%), 1 Spider Eye (100%), 1 Iron Ingot (20%) | 192 String → Enchanted String, 160 Spider Eye → Enchanted Spider Eye, 160 Iron Ingot → Enchanted Iron | W:Tarantula |
| Revenant Minion | 29, 29, 26, 26, 23, 23, 19, 19, 14.5, 14.5, 10, 8 | 2-5 Rotten Flesh (100%), 1 Diamond (20%) | 160 Rotten Flesh → Enchanted Rotten Flesh, 160 Diamond → Enchanted Diamond | W:Revenant |

## Fuel

All from the "Minion Fuel" table of W:Minion ("Effect" and "Permanent").

| Fuel | Effect | Lasts |
|---|---|---|
| Enchanted Bread | speed +5% | 12 hours |
| Enchanted Charcoal | speed +20% | 36 hours |
| Enchanted Lava Bucket | speed +25% | permanent |
| Magma Bucket | speed +30% | permanent |
| Plasma Bucket | speed +35% | permanent |
| Hamster Wheel | speed +50% | 24 hours |
| Foul Flesh | speed +90% | 5 hours |
| Catalyst | output ×3 | 3 hours |
| Hyper Catalyst | output ×4 | 6 hours |

A fuel that runs out costs `24 ÷ hours × its lowest sell offer` per day and
minion. A permanent fuel costs nothing per day; its purchase is not counted.

## Upgrades

| Upgrade | Effect | Source |
|---|---|---|
| Diamond Spreading | "Generates a Diamond 10% of the time another resource is generated", counted per item collected ("based on the amount of items the minion collects"); only one per minion | W:Minion; F:Spreading |
| Super Compactor 3000 | "Compacts resources into their enchanted form"; the amounts are in the table above | W:Minion and each minion page |
| Flycatcher | "Increases minion speed by 20%" | W:Minion |
| Minion Expander | "increases minion speed by 5%" | W:Minion |

## What the sources leave open

These are marked in the app ("not confirmed") or are choices of this
calculator, not facts from the wiki:

- **Ranges.** For Lapis, Redstone, String (Tarantula) and Rotten Flesh
  (Revenant) the wiki gives a range per harvest and no average. The middle of
  the range is used (4.5 and 3.5). Marked on those four minions.
- **Diamond Spreading with a Catalyst.** No source says whether the extra
  Diamonds are multiplied as well. They are counted once. Marked when both
  are chosen.
- **Enchanted form only.** The Super Compactor rows also list a second step
  (for example 160 Enchanted Diamond → Enchanted Diamond Block). The
  calculator prices the first enchanted form.
- **Tax on selling at once.** Neither wiki states whether the Bazaar tax is
  taken when items are sold instantly to buy orders. The calculator takes
  your tax setting off, which is the careful reading.
- **"Full after"** divides the storage by all items of a day. Different items
  cannot share a slot, so a minion with several drops fills a little sooner.
- **Not included:** minion storage chests, hoppers, the Compactor, the Auto
  Smelter, beacons, pets, mayor perks, Mithril Infusion.

## Left out on purpose

- **Iron and Gold Minion.** They produce ore, which is not traded on the
  Bazaar, and the Super Compactor works on ingots (W: Iron Minion, "160 Iron
  Ingot → Enchanted Iron Ingot"), so a correct number needs the Auto Smelter
  in the second slot. Not modelled yet.
- **Wheat, Melon, Pumpkin, Cactus, Glowstone, Fishing.** Their archived pages
  could not be loaded during this run.

Item ids (for prices) were checked against the list of Bazaar products in this
project's own `stats.json`.

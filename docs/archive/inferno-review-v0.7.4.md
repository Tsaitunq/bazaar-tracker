# Inferno review (0.7.4)

The first Inferno calculation said every fuel loses coins. That contradicted
the usual view that Inferno Minions with the best fuel are the most profitable
minions, so it was checked line by line against the wiki
(hypixelskyblock.minecraft.wiki, read 2026-10-11 through a summariser).
Prices: Bazaar snapshot of 2026-10-11. Tier XI, Super Compactor 3000 and
Diamond Spreading, tax 1.25%, sold to the highest buy orders (instant sell),
bought at the lowest sell offers (instant buy).

## What was wrong, what was right

| # | Question | Finding |
|---|---|---|
| 1 | Main production with fuel and Distillate | **Was already in.** The wiki: the Distillate's item replaces Crude Gabagool in 80% of the harvests (Magma Cream 1-3, Blaze Rod 1, Nether Wart 3-7, Glowstone Dust 2-3, Crude Gabagool 1), and the fuel multiplies the speed (11x, 16x, 21x). It is a small item: 1.0M a day at the typical setup, about a quarter of the rare drops. The best Distillate is Crude Gabagool (Very Crude Gabagool, 54.7k each); the others are worth 0.2-0.3M. Blaze Rod compacts only as far as Enchanted Blaze Powder, then Enchanted Blaze Rod at 160 each (W:Blaze Minion). |
| 2 | Rising Celsius | **Was wrong.** Every Inferno Minion placed adds 18% to all, up to 180% at ten (W: abilities table; history 0.13: "from 6% per minion to 18% per minion up to 10 minions"). The first version counted only the working minions, so a single minion got +18%, and boosters were not possible. The wiki's budget tip: nine tier I-II minions boost the highest tier one. The calculation now has "Inferno Minions placed" (default 10); boosters are counted at tier I and need no fuel. |
| 3 | Fuel | **Was wrong.** 24 hours a piece; 1 Gabagool + 2 Inferno Fuel Block + 6 Distillate. The Gabagool was bought (Hypergolic 4.40M); crafting from Bazaar items (Fuel Gabagool from Very Crude Gabagool and Sulphuric Coal, Heavy from 24 Fuel, Hypergolic from 12 Heavy) costs 3.87M. The cheaper way is taken and shown with the buy price. |
| 4 | Rare drops | The chances are for Legendary fuel only; neither Rising Celsius nor the fuel changes them, they only change the number of harvests (one roll per harvest). Capsaicin Eyedrops (+30%) do not apply to Chili Pepper and are not worth 2.45M. Items the Bazaar hardly trades are "AH item – not priced" and left out (Inferno Apex 43 a week, Reaper Pepper 95, Gabagool the Fish not sold). |
| 5 | The shifted drop table | The Inferno Minion page lost the item name of its first row ("Any LEGENDARY fuel", 1 in 136). The Fuel page names the chances directly: Chili Pepper 1 in 136, Vertex 1 in 5,950, Apex 1 in 1,309,091, Reaper Pepper 1 in 458,182, Gabagool the Fish 1 in 3,927,273. The weekly Bazaar volumes follow those ratios (Chili : Vertex 40.5 against 43.8 expected; the other reading would give 220). Not confirmed by the wiki itself, supported by the volumes. |
| 6 | Wiki profit figures | None: the page's "Bazaar Profit" column is "??? coins"; the NPC column (1 coin per Crude Gabagool) is 42.65 at tier I to 61.98 at tier XI, and 86,400 / (2 x 1,013) = 42.65 confirms two actions per harvest. |

## Per day, tier XI, Legendary fuel with Crude Gabagool Distillate

Speed 58.8x (Rising Celsius 2.8 x fuel 21), 3,644 harvests a day for the
working minion.

| Item | Before, 1 minion | Before, 10 working | After, 1 working + 9 boosters | After, 10 working |
|---|---|---|---|---|
| Main production (Very Crude Gabagool) | 433k | 10.3M | 1.03M | 10.3M |
| Rare drops | 1.67M | 39.6M | 3.84M | 38.4M |
| Fuel (net of the Ceramics) | −4.68M | −46.8M | −4.15M | −41.5M |
| **Net per day** | **−2.57M** | **+3.1M** | **+723k** | **+7.2M** |
| Cost | 649M | 6.49B | 650M | 6.49B |
| Pays back in | never | 2,066 days | **900 days** | 898 days |

After, the rare drops of the typical setup: Chili Pepper 26.8 a day at 141k =
3.73M, Inferno Vertex 0.61 at 180k = 109k, Diamond from Diamond Spreading 3k;
Inferno Apex, Reaper Pepper and Gabagool the Fish are not priced. Fuel piece:
Hypergolic Gabagool 3.87M (crafted; buying 4.40M), 2 Inferno Fuel Block 131k,
6 Gabagool Distillate 148k, minus the Hypergolic Ionized Ceramics (about 1k).
Nine tier I boosters cost 1.41M of the 650M.

The other Distillates are worse at this snapshot (typical setup): Nether Wart
+69k, Blaze Rod +1k, Glowstone Dust −157k, Magma Cream −399k a day.

## Against Tarantula XI (113k a day, 220M, 1,938 days)

At tier XI the typical Inferno setup makes 6.4 times the coins per day for 3
times the cost and pays back in 900 days, about half. The best payback of the
Inferno is at tier X: 515k a day, 369M, 716 days. At tiers I to VII the fuel
costs more than the minion earns; tier VIII is the first that pays (1,262 days).

## Where it is still thin

- One day's prices; Chili Pepper (3.7M of the 4.9M income) is the whole
  result, the fuel (4.15M) is paid by it. At about 108k a Chili Pepper the
  typical setup breaks even.
- Rising Celsius with fuel: "applied after the other buffs" and the 11x/16x/21x
  note come from the page's own Bugs section; whether the game still behaves
  so is not confirmed.
- "For every harvesting action ... each rare drop is rolled": read as once per
  harvest (the page's trivia: "once per harvest, not per item"). If it means
  once per action, the rare drops double.
- The yield of one craft of fuel is not on the page; one piece is assumed.
- Booster cost uses the tier I recipe (80 Derelict Ashe, 80 Blaze Rod).

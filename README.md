# Bazaar Flip Helper

A free tool that finds bazaar flips in Hypixel SkyBlock, shows what they pay after tax, and warns you about the risky ones.

**Open it:** https://tsaitunq.github.io/bazaar-tracker/

It runs in any browser, can be installed as an app from the browser menu, and there is an Android app with background alerts. No account, no ads. Your settings and favorites stay on your device.

## Features

The app has four areas in a bar at the bottom: **Today**, **Trade**, **Minions** and **Market**. Simple mode shows Today and Trade.

- **Today:** what your portfolio earns, the warnings about it, the next events and the election with a countdown, and up to three opportunities that are new since your last visit.
- **Flips:** every bazaar item you can flip with buy orders and sell offers, ranked by profit per hour.
- **Opportunities:** only the flips that are stable, liquid, not suspicious and within your budget.
- **Portfolio:** your capital put into the safe flips with the best return, with the total profit and return per hour. It remembers the plan you last saw and warns when a flip's price drops, it turns suspicious, or the election may move it. A flip whose item is worth more crafted into something else says so ("Craft into X: +Y/h · uses N orders").
- **NPC and Craft:** buy on the bazaar and sell to an NPC, or craft and sell the result.
- **Forge:** forge recipes with bazaar ingredients, with profit per item and per forge hour, forge time and HotM tier. Results that sell on the Auction House use the lowest BIN minus fees and are marked as estimates.
- **Minions:** what 22 minions earn per day for a tier, a fuel and two upgrades, sold at the Bazaar or to an NPC, with used-up fuel taken off, what they cost to craft and in how many days that is earned back (sources in `docs/minions-sources.md`).
- **Event radar (Market):** the mayor, the active perks and the next SkyBlock events with a countdown, plus the items that are typically affected (sources in `docs/events-sources.md`).
- **Trends:** the Market area lists the strongest risers and fallers; a badge shows whether an item's sell price is rising, falling or flat over the last day and whether it is below or above its 7 day median.
- **Item pages:** price and margin charts for the last 24 hours or 7 days. Tap or hover a chart for exact values.
- **Warnings:** a *suspicious* badge when the numbers look manipulated, a *provisional* badge when an item has less than a day of history.
- **Favorites, search and sorting**, plus swiping between tabs on a phone.
- **Tours and setup assistant:** a basic tour in seven steps, an optional advanced tour, and five questions that suggest settings for you.
- **Android app:** notifications for favorites, for new market opportunities and for warnings about your portfolio, checked about every 15 minutes.
- **Buy and sell alerts:** the snapshot run writes the windows as concrete times to `timing-windows.json`. The Android app notifies from it, the browser shows banners on Today; items can be marked as bought.

## How it calculates

A flip means: place a buy order, wait for it to fill, then place a sell offer.

| Value | Formula |
|---|---|
| Buy order price | highest current buy order |
| Sell offer price | lowest current sell offer |
| Profit/item | `sell × (1 − tax) − buy` |
| Margin | `profit / buy` |
| Volume per hour | `min(weekly instant-buy volume, weekly instant-sell volume) / 168` |
| Units per hour | `min(volume per hour × market share, floor(max capital / buy))` |
| Profit/h | `units per hour × profit per item` |

- **Tax** is 1.25%, 1.125% or 1.0%, depending on your Bazaar Flipper upgrade.
- **Market share** is the part of an item's volume you expect to get. Other players flip too, so the default is a careful 5%.
- Profit/h is an estimate. It assumes your orders sit at the top of the order book.

### Suspicious

A flip is marked suspicious if any of these is true:

- margin above 200%
- margin above 50% and fewer than 100 items traded per hour
- fewer than 3 orders on either side of the order book
- sell price more than 30% above its 7-day median

### Stability score

The app saves buy and sell prices every 20 minutes and keeps 7 days. From that history each item gets a score from 0 to 100:

```
profitable = share of snapshots where the flip made a profit after 1.25% tax
volatility = (stddev(buy) / mean(buy) + stddev(sell) / mean(sell)) / 2
score      = round(100 × profitable × max(0, 1 − 2 × volatility))
```

70 and up is **stable**, 40 to 69 **medium**, below that **unstable**. Items with less than 24 hours of history are **provisional** and get no score.

### Opportunities and portfolio

An opportunity has to pass every check: minimum margin, a stable score, not suspicious, not provisional, minimum weekly volume, minimum profit per hour, and a buy price within your capital limit.

The bazaar allows 21 open orders, so the portfolio holds at most 21 flips (Max. flips). It picks the set that earns the most per hour together and fills the best return per coin first. A flip gets as much as the item trades at your market share, never more than your max. capital per flip. It has its own minimum margin (3% by default) and measures volume as turnover in coins per week (1B by default) instead of units, with at least about 10 sales an hour; stable, not suspicious and not provisional stay required. If capital is left over, a note names the limit.

### Portfolio warnings and craft hints

The stored plan keeps the buy order price each item had when it entered. A flip is reported when its buy order is more than 5% below that price (adjustable), its margin is under 1%, it is suspicious, the leading candidate or the next minister has a perk expected to lower its price, or the mayor whose perk kept it down leaves within 24 hours.

A craft hint compares the flip with crafting its item into something else using the same coins: `extra = crafts per hour × craft profit − flip profit per hour`, where crafts per hour is capped by the flip's stake, your market share and the weekly volume of every ingredient and of the result. It uses one order per ingredient plus one sell offer, and you need the recipe.

### Minions

```
harvests per day = 86400 / (2 × time between actions / (1 + speed bonuses))
coins per day    = max(Σ items × buy order price × (1 − tax), Σ items × NPC price) − fuel used up
```

A minion needs two actions per harvest (the Fishing Minion one). With a Super Compactor 3000 the better of the enchanted item and the block of it is priced; a market that trades under 20 weeks of the output is marked "low volume – price unreliable" and listed last, and a raw price far above the enchanted form or the 7 day median counts at that value. Tapping a minion opens its sheet with every tier and the breakdown. A Catalyst multiplies the items instead of the speed. Fuel that runs out costs `24 / hours × lowest sell offer`. Numbers the wiki leaves open are marked "not confirmed". The cost is the recipe of every tier up to yours (wiki cumulative cost) at the lowest sell offer, plus the two upgrades and a permanent fuel; an ingredient the Bazaar does not sell is named and left out, and the payback then says "at least". The sheet's tier table adds the cost of each step and the days its extra coins take to pay it back; the list can be sorted by payback. The Inferno Minion has its own fuel (grade and Distillate) chosen in its sheet, with the rare drops of Legendary fuel at the wiki's odds; thin ones are marked "price unreliable".

### NPC and craft flips

- **NPC:** `profit = NPC sell price − buy order price`. No bazaar tax. An NPC pays out at most 500M coins a day (resets 00:00 UTC, wiki: Merchant); that caps Profit/h. A flip whose item is the one ingredient of a higher step (160 Obsidian into Enchanted Obsidian) also shows what crafting first earns, per coin, per item and per minute, priced as an instant buy through the sell offers.
- **Craft:** `profit = output count × sell price × (1 − tax) − Σ quantity × buy price of each ingredient`. Only recipes whose ingredients are all bazaar items. Three modes: Order → Order (buy orders, sell offer), Insta-buy → Order, Insta-buy → Insta-sell. An instant buy or sell walks the book level by level for the crafts per pass (default 16), so the price is the average of the whole pass. The tab hides crafts with a suspicious result or ingredient and with a weekly volume below the Vol./week filter. Per craft: profit per item, profit/h, orders (Order → Order: ingredients + 1, Insta → Order: 1, Insta → Insta: 0) and the capital a pass ties up.

## Data sources

- Prices, volumes, item names and NPC prices: the official Hypixel API
- Price history and scores: collected by this project every 20 minutes
- Minion, mayor and event data: the Hypixel SkyBlock wiki at hypixelskyblock.minecraft.wiki, see `docs/minions-sources.md` and `docs/events-sources.md`
- Historical prices for the event and mayor patterns (back to 2020, filled in once): [SkyCofl](https://sky.coflnet.com/data), see `docs/timing-backfill.md`; `scripts/timing-remove-backfill.mjs` takes them out again
- Recipes: [NotEnoughUpdates-REPO](https://github.com/NotEnoughUpdates/NotEnoughUpdates-REPO)
- Item icons and minion heads: [sky.coflnet.com](https://sky.coflnet.com/data); the minion heads are stored in `icons/minions/`, see `docs/image-sources.md` for the licence situation

## Disclaimer

Bazaar Flip Helper is an unofficial fan-made tool. It is not affiliated with, endorsed by or connected to Hypixel or Mojang. All numbers are estimates based on public data; prices move, and you flip at your own risk.

## Development

Plain HTML, CSS and JavaScript modules. There is no build step for the web app.

```
node scripts/serve.mjs        # local server on http://127.0.0.1:8123
node scripts/snapshot.mjs data  # local price history for charts and scores
node --test                   # tests
npm run android:build         # debug APK (needs JDK 21 and the Android SDK)
```

When you ship a feature, raise the version (`0.minor.patch` until 1.0) and add an entry to `changelog.json`. That file is the app version and feeds the "What's new" window.

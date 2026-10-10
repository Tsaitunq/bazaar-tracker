# Bazaar Flip Helper

A free tool that finds bazaar flips in Hypixel SkyBlock, shows what they pay after tax, and warns you about the risky ones.

**Open it:** https://tsaitunq.github.io/bazaar-tracker/

It runs in any browser, can be installed as an app from the browser menu, and there is an Android app with background alerts. No account, no ads. Your settings and favorites stay on your device.

## Features

- **Flips:** every bazaar item you can flip with buy orders and sell offers, ranked by profit per hour.
- **Opportunities:** only the flips that are stable, liquid, not suspicious and within your budget.
- **Portfolio:** your capital put into the safe flips with the best return, with the total profit and return per hour.
- **NPC and Craft:** buy on the bazaar and sell to an NPC, or craft and sell the result.
- **Forge:** forge recipes with bazaar ingredients, with profit per item and per forge hour, forge time and HotM tier. Results that sell on the Auction House use the lowest BIN minus fees and are marked as estimates.
- **Event radar:** the mayor, the active perks and the next SkyBlock events with a countdown, plus the items that are typically affected (sources in `docs/events-sources.md`).
- **Trends:** a badge shows whether an item's sell price is rising, falling or flat over the last day and whether it is below or above its 7 day median.
- **Item pages:** price and margin charts for the last 24 hours or 7 days. Tap or hover a chart for exact values.
- **Warnings:** a *suspicious* badge when the numbers look manipulated, a *provisional* badge when an item has less than a day of history.
- **Favorites, search and sorting**, plus swiping between tabs on a phone.
- **Tours and setup assistant:** a basic tour in six steps, an optional advanced tour, and five questions that suggest settings for you.
- **Android app:** notifications for favorites and for new market opportunities, checked about every 15 minutes.

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

### NPC and craft flips

- **NPC:** `profit = NPC sell price − buy order price`. No bazaar tax. The game's daily NPC sell limit is not included.
- **Craft:** `profit = output count × sell offer price × (1 − tax) − Σ quantity × buy order price of each ingredient`. Only recipes whose ingredients are all bazaar items.

## Data sources

- Prices, volumes, item names and NPC prices: the official Hypixel API
- Price history and scores: collected by this project every 20 minutes
- Recipes: [NotEnoughUpdates-REPO](https://github.com/NotEnoughUpdates/NotEnoughUpdates-REPO)
- Item icons: [sky.coflnet.com](https://sky.coflnet.com/data)

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

When you ship a feature, raise the version and add an entry to `changelog.json`. That file is the app version and feeds the "What's new" window.

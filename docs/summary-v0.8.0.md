# Summary 0.8.0

Branch `feat/v0.8.0`: one commit each for A, B, C, one for changelog, docs and
version. Not pushed, not merged. 298 web tests and 34 Android tests green. Debug
APK at `android/app/build/outputs/apk/debug/app-debug.apk` (`versionName` 0.8.0,
`versionCode` 100800).

**Nothing reaches a phone before the merge:** `timing-windows.json` is written by
the snapshot run on main. Until then the worker gets a 404 and shows nothing.

## What changed

**A. `timing-windows.json`** (`timingWindows` in `timing.js`, called in
`scripts/snapshot.mjs`). It calls the app's `tradeWindow` and `phaseSpans`, so
there is no second algorithm and the thresholds are the same. About 14 kB.

- `w`: `id, key, driver, s, buyStart, buyEnd, sellStart, sellEnd, spread, hits, n, own, backfill`.
  Times are ms since the epoch, so UTC.
- `a`: `id, key, driver, s, at, notifyAt, drop, hits, n, own, backfill`.
- Counted: the current term, the term before, the term of the election's leader
  (driver marked "(if elected)"), and the calendar's events. Horizon 8 days.
- The term before is needed: many sell phases are days after the term, when
  `election.json` no longer names that mayor. It is read from the runs in `timing.json`.
- Tax 1.25%, 5% under Derpy.
- Negative patterns: `itemRole.recovers` existed but counts any rise as recovery,
  and would have let Great White Shark Tooth through (-12.6%, then +1.5%). New
  `avoidPattern`: a confirmed fall over 3% in two thirds of the runs, less than half
  of it back within 24 hours, measured in at least 3 runs. An item with a window for
  the same driver gets no warning.

**B. Android.** `readWindows`, `dueWindows`, `windowText`, `quiet` in `AlertLogic`
(same rules and cases as `windowAlerts` in `timing.js`), `checkWindows` in
`AlertWorker`, new `BoughtReceiver`, channel "Buy and sell windows", settings in
Pro under "Buy and sell alerts".

**C. Browser.** Banners on Today, `bt.held` in localStorage, the same settings.
"Got it" hides a banner for that item and window.

## Decisions worth checking

- All switches default to **off**, like every other alert. In the browser too, so
  nobody sees a banner before switching on in Pro mode.
- "Sell before" also goes out for items not held, as ordered. It takes up the daily
  limit; on 2026-11-06 five of five are Harvest Feast warnings.
- Min. gain and "favorites only" apply to buys and warnings. They never hide a held item.
- A sell is only reported for a window that starts after the item was marked. Marked
  during a running sell phase there is no "Sell now" for that phase.
- A held item gets no buy notification. The mark stays until removed by hand.
- Order when the limit bites: sell, warning on a held item, other warning, buy.
  What is held back comes the next day if still open; a buy whose phase ended is lost.
- Quiet hours: nothing is queued. What is still open afterwards comes then, as single
  notifications in one Android group, so each keeps its "Bought" button. A buy phase
  that lies wholly in the night is not reported, since it cannot be used any more.
- Notification: title is the item, text is the ordered sentence, so it is not cut off.
- In the browser, quiet hours do nothing (a banner disturbs nobody; the panel says so)
  and the daily maximum caps the banners shown at once. Android shows no banners.
- On Today, an item with a buy banner leaves the older "Buying window" list.

## Known limits

- Windows from few runs pass the app's thresholds: Season of Jerry has 3 or 4 runs, so
  "Ice Bait +213%, 2/3" gets reported. Thresholds not changed, as ordered.
- Spread is computed at 1.25%; a lower personal tax setting is not used.
- Found, not changed: `buyNow` (Today's list) only looks at the running or next
  occurrence, so a buy phase after an event that ended ("1 day after") never reads
  "now" there. `timingWindows` handles this case.

## Checked

- `tests/timing-windows.test.js`: Paul term fixture to expected times, thresholds, term
  before, leader, calendar, avoid. `tests/window-alerts.test.js` and `AlertLogicTest`:
  the same cases on both sides.
- Headless Edge, touch emulation 412 x 915, real data branch files, no script errors:
  buy, sell and warning banners; Bought, Got it, a banner's link to the item page;
  mark and unmark on the item page; panel values and toggles; no sideways scroll.
  The warning was forced for this run by moving its `notifyAt`.
- Build: the APK holds the new web files, 0.8.0 and `BoughtReceiver`.
- **Not checked:** no device or emulator here, so nothing that runs on Android itself:
  the worker, real notifications, the Bought button, the group, tap to open.

## Phone checklist

Install the APK. Merge first, or `timing-windows.json` is missing (see top).

1. Pro mode, Settings, Buy and sell alerts: defaults 5, 5, 23, 8; all switches off.
2. Switch on buy, sell, warnings: permission is asked if not yet granted; Apply.
3. Wait up to 15 minutes (outside 23-8): notifications arrive, grouped if several.
4. Tap one: the item's page opens.
5. "Bought" on a buy: the notification goes away; the item page shows "Bought – remove mark".
6. Same with the app open on Today and the shade pulled down, then leave and return:
   the item page shows the mark.
7. "Bought – remove mark", then "Mark as bought": toggles, survives a restart.
8. Force-close the app: the next round still notifies.
9. No repeat in the next rounds, and none after off and on again.
10. Max. per day 1: one more at most that day; the rest comes the next day.
11. Quiet hours around the current hour: nothing; after they end, what is still open.
12. "Only favorites" with no favorites: no buys or warnings; a held item is still reported.
13. Min. gain 50: small windows no longer come.
14. A held item with a sell phase coming: "Sell now" when it starts (in the list below).

## Next 7 days

From the data branch of 2026-10-31 10:09 UTC, with the check every 15 minutes
simulated. Mayor Aatrox (no windows of his own). Assumptions: switches on, other
settings at default, nothing marked as bought, no favorites, Europe/Berlin. The file is
not on the data branch yet, so this assumes it was already running.

**Can change:** the next term starts 2026-11-05 03:15 UTC. `election.json` has no running
election, and the booth opens during these days. Windows and warnings of the coming mayor
are therefore missing here, and they come as soon as a candidate leads. New runs can also
shift the values.

### What would arrive (35, with limit and quiet hours)

| Berlin | UTC | Message |
|---|---|---|
| Sa., 31.10., 12:00 | 10-31 11:00 | Buying window open: Red Gift (Season of Jerry, typical +12%, 2/3) |
| Sa., 31.10., 12:00 | 10-31 11:00 | Buying window open: Glacial Fragment (Season of Jerry, typical +8%, 2/3) |
| Sa., 31.10., 21:00 | 10-31 20:00 | Sell before Harvest Feast: Cornucopia usually drops 10% |
| Sa., 31.10., 21:00 | 10-31 20:00 | Sell before Harvest Feast: Crystalized Moonlight usually drops 9% |
| Sa., 31.10., 21:00 | 10-31 20:00 | Sell before Harvest Feast: Cactus Flower usually drops 9% |
| So., 01.11., 08:00 | 11-01 07:00 | Sell before Harvest Feast: Aggourdian usually drops 6% |
| So., 01.11., 08:00 | 11-01 07:00 | Sell before Harvest Feast: Designer Coffee Beans usually drops 6% |
| So., 01.11., 08:00 | 11-01 07:00 | Sell before Harvest Feast: Feast Flask usually drops 6% |
| So., 01.11., 16:45 | 11-01 15:45 | Sell before Spooky Festival: Werewolf Skin usually drops 24% |
| Mo., 02.11., 08:00 | 11-02 07:00 | Buying window open: Pumpkin Guts (Spooky Festival, typical +23%, 12/15) |
| Mo., 02.11., 08:00 | 11-02 07:00 | Buying window open: Soul Fragment (Spooky Festival, typical +23%, 14/15) |
| Mo., 02.11., 08:00 | 11-02 07:00 | Buying window open: Ectoplasm (Spooky Festival, typical +11%, 12/15) |
| Mo., 02.11., 16:00 | 11-02 15:00 | Buying window open: Melon Juice (Harvest Feast, typical +15%, 11/14) |
| Mo., 02.11., 20:15 | 11-02 19:15 | Buying window open: Ice Bait (Season of Jerry, typical +213%, 2/3) |
| Di., 03.11., 08:00 | 11-03 07:00 | Sell before Jerry's Workshop: Glacial Fragment usually drops 13% |
| Di., 03.11., 08:15 | 11-03 07:15 | Sell before Season of Jerry: Magic Top Hat usually drops 21% |
| Di., 03.11., 08:15 | 11-03 07:15 | Sell before Season of Jerry: Ice Hunk usually drops 18% |
| Di., 03.11., 12:45 | 11-03 11:45 | Buying window open: Walnut (Jerry's Workshop, typical +13%, 10/15) |
| Di., 03.11., 16:00 | 11-03 15:00 | Buying window open: Cane Knot (Harvest Feast, typical +5%, 10/14) |
| Mi., 04.11., 08:00 | 11-04 07:00 | Buying window open: Looting 4 (Jerry's Workshop, typical +98%, 11/15) |
| Mi., 04.11., 08:00 | 11-04 07:00 | Buying window open: Luck 6 (Jerry's Workshop, typical +95%, 10/15) |
| Mi., 04.11., 08:00 | 11-04 07:00 | Buying window open: White Gift (Jerry's Workshop, typical +25%, 11/15) |
| Mi., 04.11., 08:00 | 11-04 07:00 | Buying window open: Green Gift (Jerry's Workshop, typical +25%, 12/15) |
| Mi., 04.11., 08:00 | 11-04 07:00 | Buying window open: Red Gift (Jerry's Workshop, typical +12%, 11/15) |
| Do., 05.11., 08:00 | 11-05 07:00 | Buying window open: Red Gift (Season of Jerry, typical +12%, 2/3) |
| Do., 05.11., 08:00 | 11-05 07:00 | Buying window open: Glacial Fragment (Season of Jerry, typical +8%, 2/3) |
| Fr., 06.11., 08:00 | 11-06 07:00 | Sell before Harvest Feast: Cornucopia usually drops 10% |
| Fr., 06.11., 08:00 | 11-06 07:00 | Sell before Harvest Feast: Crystalized Moonlight usually drops 9% |
| Fr., 06.11., 08:00 | 11-06 07:00 | Sell before Harvest Feast: Cactus Flower usually drops 9% |
| Fr., 06.11., 08:00 | 11-06 07:00 | Sell before Harvest Feast: Aggourdian usually drops 6% |
| Fr., 06.11., 08:00 | 11-06 07:00 | Sell before Harvest Feast: Designer Coffee Beans usually drops 6% |
| Sa., 07.11., 08:00 | 11-07 07:00 | Sell before Spooky Festival: Werewolf Skin usually drops 24% |
| Sa., 07.11., 08:45 | 11-07 07:45 | Buying window open: Pumpkin Guts (Spooky Festival, typical +23%, 12/15) |
| Sa., 07.11., 08:45 | 11-07 07:45 | Buying window open: Soul Fragment (Spooky Festival, typical +23%, 14/15) |
| Sa., 07.11., 08:45 | 11-07 07:45 | Buying window open: Ectoplasm (Spooky Festival, typical +11%, 12/15) |

### Everything that opens under the default filter (78, without limit and quiet hours)

Includes phases that opened up to a day before the start of the list and are still open.
36 of them are "Sell now", which come only for an item marked as bought before they start.

| Starts, UTC | Berlin | Kind | Message |
|---|---|---|---|
| 10-30 21:15 | Fr., 30.10., 22:15 | sell | Sell now: Winter Fragment – selling window started |
| 10-30 21:15 | Fr., 30.10., 22:15 | buy | Buying window open: Red Gift (Season of Jerry, typical +12%, 2/3) |
| 10-30 21:15 | Fr., 30.10., 22:15 | buy | Buying window open: Glacial Fragment (Season of Jerry, typical +8%, 2/3) |
| 10-31 17:55 | Sa., 31.10., 18:55 | sell | Sell now: Looting 4 – selling window started |
| 10-31 17:55 | Sa., 31.10., 18:55 | sell | Sell now: Luck 6 – selling window started |
| 10-31 17:55 | Sa., 31.10., 18:55 | sell | Sell now: White Gift – selling window started |
| 10-31 17:55 | Sa., 31.10., 18:55 | sell | Sell now: Green Gift – selling window started |
| 10-31 17:55 | Sa., 31.10., 18:55 | sell | Sell now: Red Gift – selling window started |
| 10-31 17:55 | Sa., 31.10., 18:55 | sell | Sell now: Blue Ice Hunk – selling window started |
| 10-31 19:55 | Sa., 31.10., 20:55 | avoid | Sell before Harvest Feast: Cornucopia usually drops 10% |
| 10-31 19:55 | Sa., 31.10., 20:55 | avoid | Sell before Harvest Feast: Crystalized Moonlight usually drops 9% |
| 10-31 19:55 | Sa., 31.10., 20:55 | avoid | Sell before Harvest Feast: Cactus Flower usually drops 9% |
| 10-31 19:55 | Sa., 31.10., 20:55 | avoid | Sell before Harvest Feast: Aggourdian usually drops 6% |
| 10-31 19:55 | Sa., 31.10., 20:55 | avoid | Sell before Harvest Feast: Designer Coffee Beans usually drops 6% |
| 10-31 19:55 | Sa., 31.10., 20:55 | avoid | Sell before Harvest Feast: Feast Flask usually drops 6% |
| 10-31 21:15 | Sa., 31.10., 22:15 | sell | Sell now: Luck 6 – selling window started |
| 10-31 21:15 | Sa., 31.10., 22:15 | sell | Sell now: Looting 4 – selling window started |
| 10-31 21:15 | Sa., 31.10., 22:15 | sell | Sell now: White Gift – selling window started |
| 10-31 21:15 | Sa., 31.10., 22:15 | sell | Sell now: Green Gift – selling window started |
| 10-31 21:15 | Sa., 31.10., 22:15 | sell | Sell now: Red Gift – selling window started |
| 10-31 21:15 | Sa., 31.10., 22:15 | sell | Sell now: Glacial Fragment – selling window started |
| 10-31 21:15 | Sa., 31.10., 22:15 | sell | Sell now: Blue Ice Hunk – selling window started |
| 11-01 15:35 | So., 01.11., 16:35 | avoid | Sell before Spooky Festival: Werewolf Skin usually drops 24% |
| 11-01 23:15 | Mo., 02.11., 00:15 | sell | Sell now: Stock Of Stonks – selling window started |
| 11-02 03:35 | Mo., 02.11., 04:35 | buy | Buying window open: Pumpkin Guts (Spooky Festival, typical +23%, 12/15) |
| 11-02 03:35 | Mo., 02.11., 04:35 | buy | Buying window open: Soul Fragment (Spooky Festival, typical +23%, 14/15) |
| 11-02 03:35 | Mo., 02.11., 04:35 | buy | Buying window open: Ectoplasm (Spooky Festival, typical +11%, 12/15) |
| 11-02 14:55 | Mo., 02.11., 15:55 | buy | Buying window open: Melon Juice (Harvest Feast, typical +15%, 11/14) |
| 11-02 19:15 | Mo., 02.11., 20:15 | buy | Buying window open: Ice Bait (Season of Jerry, typical +213%, 2/3) |
| 11-02 23:35 | Di., 03.11., 00:35 | avoid | Sell before Jerry's Workshop: Glacial Fragment usually drops 13% |
| 11-03 07:15 | Di., 03.11., 08:15 | avoid | Sell before Season of Jerry: Magic Top Hat usually drops 21% |
| 11-03 07:15 | Di., 03.11., 08:15 | avoid | Sell before Season of Jerry: Ice Hunk usually drops 18% |
| 11-03 09:35 | Di., 03.11., 10:35 | sell | Sell now: Soul Fragment – selling window started |
| 11-03 09:35 | Di., 03.11., 10:35 | sell | Sell now: Ectoplasm – selling window started |
| 11-03 11:35 | Di., 03.11., 12:35 | buy | Buying window open: Walnut (Jerry's Workshop, typical +13%, 10/15) |
| 11-03 14:55 | Di., 03.11., 15:55 | buy | Buying window open: Cane Knot (Harvest Feast, typical +5%, 10/14) |
| 11-03 19:15 | Di., 03.11., 20:15 | sell | Sell now: Ice Bait – selling window started |
| 11-03 19:15 | Di., 03.11., 20:15 | buy | Buying window open: Luck 6 (Season of Jerry, typical +110%, 3/3) |
| 11-03 19:15 | Di., 03.11., 20:15 | buy | Buying window open: Looting 4 (Season of Jerry, typical +98%, 3/3) |
| 11-03 19:15 | Di., 03.11., 20:15 | buy | Buying window open: White Gift (Season of Jerry, typical +45%, 3/3) |
| 11-03 19:15 | Di., 03.11., 20:15 | buy | Buying window open: Green Gift (Season of Jerry, typical +35%, 3/3) |
| 11-03 19:15 | Di., 03.11., 20:15 | buy | Buying window open: Winter Fragment (Season of Jerry, typical +18%, 2/3) |
| 11-03 19:15 | Di., 03.11., 20:15 | buy | Buying window open: Blue Ice Hunk (Season of Jerry, typical +7%, 3/3) |
| 11-03 21:55 | Di., 03.11., 22:55 | buy | Buying window open: Looting 4 (Jerry's Workshop, typical +98%, 11/15) |
| 11-03 21:55 | Di., 03.11., 22:55 | buy | Buying window open: Luck 6 (Jerry's Workshop, typical +95%, 10/15) |
| 11-03 21:55 | Di., 03.11., 22:55 | buy | Buying window open: White Gift (Jerry's Workshop, typical +25%, 11/15) |
| 11-03 21:55 | Di., 03.11., 22:55 | buy | Buying window open: Green Gift (Jerry's Workshop, typical +25%, 12/15) |
| 11-03 21:55 | Di., 03.11., 22:55 | sell | Sell now: Walnut – selling window started |
| 11-03 21:55 | Di., 03.11., 22:55 | buy | Buying window open: Red Gift (Jerry's Workshop, typical +12%, 11/15) |
| 11-04 09:35 | Mi., 04.11., 10:35 | sell | Sell now: Pumpkin Guts – selling window started |
| 11-04 14:55 | Mi., 04.11., 15:55 | sell | Sell now: Melon Juice – selling window started |
| 11-04 14:55 | Mi., 04.11., 15:55 | sell | Sell now: Cane Knot – selling window started |
| 11-05 01:15 | Do., 05.11., 02:15 | sell | Sell now: Winter Fragment – selling window started |
| 11-05 01:15 | Do., 05.11., 02:15 | buy | Buying window open: Red Gift (Season of Jerry, typical +12%, 2/3) |
| 11-05 01:15 | Do., 05.11., 02:15 | buy | Buying window open: Glacial Fragment (Season of Jerry, typical +8%, 2/3) |
| 11-05 21:55 | Do., 05.11., 22:55 | sell | Sell now: Looting 4 – selling window started |
| 11-05 21:55 | Do., 05.11., 22:55 | sell | Sell now: Luck 6 – selling window started |
| 11-05 21:55 | Do., 05.11., 22:55 | sell | Sell now: White Gift – selling window started |
| 11-05 21:55 | Do., 05.11., 22:55 | sell | Sell now: Green Gift – selling window started |
| 11-05 21:55 | Do., 05.11., 22:55 | sell | Sell now: Red Gift – selling window started |
| 11-05 21:55 | Do., 05.11., 22:55 | sell | Sell now: Blue Ice Hunk – selling window started |
| 11-05 23:55 | Fr., 06.11., 00:55 | avoid | Sell before Harvest Feast: Cornucopia usually drops 10% |
| 11-05 23:55 | Fr., 06.11., 00:55 | avoid | Sell before Harvest Feast: Crystalized Moonlight usually drops 9% |
| 11-05 23:55 | Fr., 06.11., 00:55 | avoid | Sell before Harvest Feast: Cactus Flower usually drops 9% |
| 11-05 23:55 | Fr., 06.11., 00:55 | avoid | Sell before Harvest Feast: Aggourdian usually drops 6% |
| 11-05 23:55 | Fr., 06.11., 00:55 | avoid | Sell before Harvest Feast: Designer Coffee Beans usually drops 6% |
| 11-05 23:55 | Fr., 06.11., 00:55 | avoid | Sell before Harvest Feast: Feast Flask usually drops 6% |
| 11-06 01:15 | Fr., 06.11., 02:15 | sell | Sell now: Luck 6 – selling window started |
| 11-06 01:15 | Fr., 06.11., 02:15 | sell | Sell now: Looting 4 – selling window started |
| 11-06 01:15 | Fr., 06.11., 02:15 | sell | Sell now: White Gift – selling window started |
| 11-06 01:15 | Fr., 06.11., 02:15 | sell | Sell now: Green Gift – selling window started |
| 11-06 01:15 | Fr., 06.11., 02:15 | sell | Sell now: Red Gift – selling window started |
| 11-06 01:15 | Fr., 06.11., 02:15 | sell | Sell now: Glacial Fragment – selling window started |
| 11-06 01:15 | Fr., 06.11., 02:15 | sell | Sell now: Blue Ice Hunk – selling window started |
| 11-06 19:35 | Fr., 06.11., 20:35 | avoid | Sell before Spooky Festival: Werewolf Skin usually drops 24% |
| 11-07 07:35 | Sa., 07.11., 08:35 | buy | Buying window open: Pumpkin Guts (Spooky Festival, typical +23%, 12/15) |
| 11-07 07:35 | Sa., 07.11., 08:35 | buy | Buying window open: Soul Fragment (Spooky Festival, typical +23%, 14/15) |
| 11-07 07:35 | Sa., 07.11., 08:35 | buy | Buying window open: Ectoplasm (Spooky Festival, typical +11%, 12/15) |

# Timing backfill: check (step 1, nothing built)

Branch `feat/timing-backfill`. Read 2026-10-11.

## a) SkyCofl history

`GET https://sky.coflnet.com/api/bazaar/{itemTag}/history?start=…&end=…`
(docs: sky-commands.coflnet.com/wiki/api). No key needed. 25 requests at
about 1 per second, all 200, 100 to 200 ms each.

| Question | Result |
|---|---|
| How far back | at least 2020-09 (data for GRIFFIN_FEATHER from 2020-09-10; empty for 2020-03, 2020-06 and 2019-10/11, ENCHANTED_DIAMOND empty for 2019-10 to 2019-12). About 6 years |
| Resolution | **2 hours** for a range of up to 7 days (84 points a week); **daily** for anything longer, even 7 days 5 hours. So windows have to be at most 7 days |
| Fields | `buy`, `sell`, `minBuy/maxBuy`, `minSell/maxSell`, `buyVolume`, `sellVolume`, `buyMovingWeek`, `sellMovingWeek`, `timestamp`. `buy` is the instant-buy price (higher), `sell` the instant-sell price: `buy` = our `sell` (lowest offer, `bookPrices().sell`, the series timing.js medians) |
| Order | newest first |
| Limits | docs: 30 requests per 10 s and 100 per minute per IP; none stated for this endpoint |
| Terms | "please attribute us as the data source"; commercial use is expected to fund the servers (premium+). Free and non-commercial here |

## b) Mayors

Wiki modules `Module:Mayor/Elections` (ids 88 to 178) and
`Module:Mayor/Elections/ApiData` (ids 179 to 518): winner for 423 elections.
Missing ids: 291, 461 to 463, 466 to 469. A minister is given up to about id
432 and for special mayors only after that. A minister's chosen perk is not
recorded, so minister terms cannot be used.

Election id N is held in year N; the term runs Late Spring 27 of year N+1 to
Late Spring 27 of year N+2, **124 real hours (5.2 days)**. Election 88 is the
term of 2020-09-09; election 518 is the running one (2026-10-10 to 10-15).

## c) Terms per perk in the API range (complete terms, own calendar)

| Perk (mayor) | Terms | Confirmed at once (>= 3) |
|---|---|---|
| Marauder (Paul) | 57 | yes |
| Mining Fiesta (Cole) | 41 | yes |
| Mythological Ritual (Diana) | 64 | yes |
| Blooming Business, Grand Feast (Finnegan, from 2022-11) | 22 | yes |
| Stock Exchange (Diaz, from 2022-10) | 20 | yes |
| Fishing Festival (Marina) | 57 terms, but a festival is every 10 h and lasts 1 h | no: not meaningful at 2 h resolution, leave out |

Open: whether each perk was the same all those years (the perk pages' history
was not read), and when each item first existed (shards, Fine Flour and
Stock of Stonks are newer; the script should find the first data point).

## Cost

One request per item and term, window [start - 24 h, start + 7 d) (the
"after" window then ends 4 h early). Items: Marauder 22, Mining Fiesta 3,
Mythological Ritual 15, Blooming Business 1, Stock Exchange 1.
All terms: 2,379 requests (about 40 minutes at 1 a second); the newest 10 terms
per perk: 420 (about 7 minutes).

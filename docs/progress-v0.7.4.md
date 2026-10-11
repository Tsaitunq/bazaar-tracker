# Progress 0.7.4

Branch `feat/v0.7.4`, one commit per part. Not pushed, not merged.
(The order was written as 0.7.3; 0.7.3 already exists, so this package is 0.7.4.)

- [x] A. Minion cost and payback
- [ ] B. Inferno Minion
- [ ] Changelog 0.7.4, README, APK, docs/summary-v0.7.4.md

## A

`minioncosts.js` (new, in `SHELL`): recipe steps of 21 minions, checked
against the wiki cumulative tables, sources in `docs/minions-sources.md`
("Crafting cost"). `minions.js`: `priceItems`, `cost`, `step`, `payback` on
every row, `upgrade` (cost, payback) on every tier of the sheet, `sort:
'payback'`. Card: "Cost (Tier X)", "Pays back in"; sheet: cost list and two
new table columns; Minions tab: "Sort by". Items without a Bazaar price are
named and left out, the payback then reads "at least".

UI check: headless Edge, touch emulation 412 x 915, Tarantula sheet and the
list; the seven-column table fits without scrolling.

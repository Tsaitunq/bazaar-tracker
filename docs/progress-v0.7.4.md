# Progress 0.7.4

Branch `feat/v0.7.4`, one commit per part. Not pushed, not merged.
(The order was written as 0.7.3; 0.7.3 already exists, so this package is 0.7.4.)

- [x] A. Minion cost and payback
- [x] B. Inferno Minion
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

## B

`minions.js`: Inferno Minion (11 tiers), `INFERNO_FUELS`, `INFERNO_SPECIALTIES`,
`INFERNO_RARE`, fuel cost per piece, Ionized Ceramics back, Rising Celsius.
Sheet: Fuel and Distillate selects (stored as `infFuel`, `infSpec`), the cost
of a piece, the rare drops with odds and "price unreliable", and the choice
that earns most right now. Blaze Slayer select in the setup. Wiki details and
everything marked "not confirmed" in `docs/minions-sources.md` ("Inferno Minion").

Things found while reading the wiki:

- The Inferno Minion page's drop table is one row off against the Fuel page
  (a row label is missing in the text read); the Fuel page's assignment is used.
- Blaze Rod does not compact to Enchanted Blaze Rod: 160 Blaze Rod make
  Enchanted Blaze Powder, 160 of that make the Rod (W:Blaze Minion). A first
  version priced it wrongly and showed a profit that was not there.
- Tier XI needs the tier X and an Inferno Minion VIII; only the cumulative
  table makes that clear.

Result (snapshot 2026-10-11, tier XI, one minion, Super Compactor 3000 and
Diamond Spreading): every fuel loses coins, see `docs/summary-v0.7.4.md`.

UI check: headless Edge, touch emulation 412 x 915, Inferno sheet with
Legendary fuel; selects, rare drops and the seven-column table fit.

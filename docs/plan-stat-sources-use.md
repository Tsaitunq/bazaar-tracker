# Plan: use the stat sources in the Stats page (guide 0.17.0)

Branch `feat/stat-sources-use` from `main`. Data: `gamedata/stat-sources.json` (every series has `confidence: safe | unsafe`). Nothing here is built yet.

## Goal

With an import the app adds up the known sources itself, so "Other sources" (the gap to the player's `/stats`) gets small and the measurement becomes optional. Without an import nothing changes.

## What exists today (checked in the code)

- `totals.js` `totalFor`: `total = (typed / was.mult + (now.add − was.add) + gear) × now.mult`. `typed` is the measured `/stats` value, `was` is the build as it was in the measurement's `snapshot`, `now` is the build today. `other = typed / was.mult − was.add`: what the measurement holds that the build (HOTM, attributes, essence, power, buffs) did not explain.
- Without a measurement there is no total, only the "From known sources" list (`statsModel.known`).
- `build.buffs.godPotion` / `boosterCookie` already exist and are part of the snapshot. Values: `GOD_POTION` in `stats.js` (8 stats, typed) and `data.power.boosterCookie`.
- `stats.js` `computeStats` has its own hard-coded skill, slayer and level tables. It feeds the optimizer only and stays untouched (see "Not in this change").
- The worker (`apps/api/src/trim.js`) sends `skills` (all `player_data.experience`), `slayer` (xp per boss), `accessoryBag` (selected power, tuning, MP) and the accessory bag items. It does **not** send the SkyBlock level.
- `readItem` keeps id, reforge, recomb, enchants and more, but not the enrichment.
- `gear.js` `accessoryGain` counts accessories ticked after the measurement (Blaze only).

## The model: base, snapshot and the new sources

Name the new sources `calc`: skills, slayer, SkyBlock level, accessories (bag). Cookie and God Potion stay in the build (they already have a switch and a snapshot slot).

Per stat, three quantities:

| Symbol | Meaning |
|---|---|
| `B` | game base (Health 100, Crit Chance 30, Crit Damage 50, wiki Stats; today a constant in `stats.js`) |
| `K_now`, `K_was` | build parts: HOTM, attributes, essence, power, pet, buffs (existing `statsOf`) |
| `C_now`, `C_was` | `calc` sources from the import now / at the measurement |

**Mode A, no import (`profile` null):** exactly today's formulas. `calc` is empty, `B` is not added, buff values are today's. No change in any number.

**Mode B, import, not measured:**
`total = (B + K_now.add + C_now + gear) × K_now.mult`
Nothing is "other". The card reads "From known sources" with a note listing what is missing (unknown accessory bases, sources off, "SkyBlock level needs the updated worker", not counted: mayor, cake, museum, other potions, conditional perks).

**Mode C, import and measured:**
`total = (typed / was.mult + (K_now.add − K_was.add) + (C_now − C_was) + gear) × K_now.mult`
`other = typed / was.mult − K_was.add − C_was − B`
So a source that is already inside the measurement is never added again, and one that grew since (a skill level, a new accessory) is added as a change. Same idea as the existing snapshot rule, extended by one more part.

- `C_was` is stored in the measurement's snapshot as a new part `calc` (flat map stat → value) when the measurement is saved with an import. Same for `B` implicitly (a constant).
- A measurement from before 0.17.0 has no `calc`. Rule: unknown at the measurement = the same as now (`C_was = C_now`), exactly how `totalFor` already treats an unknown part. The Other card then says "assumed as of today". No migration of stored data.
- If the player drops the import, mode A returns and `calc` in old snapshots is ignored.
- Double count guards: with an import, `accessoryGain` is skipped (the bag already holds those accessories, so `C` covers them). Ticked-step gear stays as is. The build parts already counted in `K` (power stone, MP, tuning) are not read again from the bag.
- Buffs: with an import the God Potion and Cookie values come from `stat-sources.json` (more stats, with confidence). Without an import the old values stay. The switch and the snapshot slot are unchanged, so `K_now − K_was` still handles a switch changed after the measurement.

## Sources in detail

1. **Skills.** Level from `profile.skills.SKILL_<NAME>` against `skills.<name>.xpTotal`, capped at `maxLevel` (+ `…_extra_level_cap` where the import has it; checked on the fixture first). Stats: sum of `stats.<STAT>.values[0..level−1]`. Only skills with a stat of ours.
2. **Slayer.** Level from `profile.slayer.<boss>` against `slayers.<boss>.xp.values` (cumulative). Stats: sum of `values[0..level−1]`.
3. **SkyBlock level.** Worker: add `take('skyblockXp', m.leveling && m.leveling.experience)` in `trim.js` (Hypixel puts it at `members.<uuid>.leveling.experience`; confirm on a live answer, the probe prints keys only). `summarize` passes it on as a number. Level = `floor(xp / xpPerLevel.value)` capped at `maxLevel`; Health per level, Strength per 5 levels from `skyblockLevel`. Worker change is only committed, the user deploys. Until deployed the source is off and the note says so.
4. **Accessories.** From the bag items of the import (`where` accessory bag), one per family (best by stat sum, as `stats.js` `accessoriesOf` and `items[id].family` do). Per item: base stats from `items[id].stats` (`items.json`, stats at the item's own rarity), reforge from the existing reforge tables (`optimizer-data.js`), enrichment from `stat-sources.accessories.enrichments` (needs `talisman_enrichment` added to `readItem`). Recombobulator: rarity change affects reforge values, so a recomb'd piece with a reforge counts as "unknown". No base stats in `items.json` (282 of 568 have them) or an unknown reforge: counted as `unknown`, listed by name in the Other card ("12 accessories without known stats: …"). Equipment slots (necklace, cloak, belt, gloves) are gear, not bag: not counted here.
5. **Booster Cookie, God Potion.** Switch in the build as today. Values from `stat-sources.json`; Social Wisdom stays missing and is noted.

New module `apps/guide/sources.js` (pure, no DOM): `sourcesOf(profile, data, items, area) → { add: {stat: v}, parts: {skills, slayer, level, accessories}, contrib: {stat: [{part, label, value, unsafe, note}]}, unknown: [...], off: [...] }`. `statsModel` calls it only when a profile exists. Stat list per area is unchanged (`statsFor`).

## Unsafe values (item 3)

Each contribution carries `unsafe` from the series' `confidence` (and the note from `stat-sources.json`). In the UI:

- Breakdown line per source: values from an unsafe series get a "≈" mark and the legend "≈ one source only, not checked in game".
- After a measurement, for every stat with `|other| > 0.01`: a line "Differs by +X. Unsafe sources behind it: Skills Mining Fortune +240 (one source), God Potion Speed +228 (one source) …". Sources that are safe are not listed. If there is a gap and no unsafe source contributes, it says "not explained by a known source".
- A stat with no gap shows nothing extra.

## Skin figure strip (item 4)

Under the figure panel on the Stats overview, only with an import: one row of three chips: Skills (average level), Slayer (highest level, e.g. "Slayer 9/9/…" compact), SkyBlock level. Each chip is a `<details>` (no routing): tapped it shows the full list (skills with level, slayers with level, level with XP and progress). Without import the strip is absent. Without `skyblockXp` the SkyBlock chip says "needs updated worker".

## Tests (fixtures only)

- `tests/guide/stat-sources-use.test.js` on small synthetic profiles: level from XP at and around thresholds, caps, each source's stats, family rule, unknown accessory listing, `unsafe` flags, the three modes (A unchanged, B total, C: `total` equals `typed` right after measuring and `other` equals the leftover), no double count when an accessory is ticked after an import, legacy snapshot without `calc`.
- Regression: all existing `guide-totals` and `import-measure` expectations must pass unchanged (mode A).
- Worker: `trim` test for `skyblockXp` present and missing (`missing` list).
- View tests: strip present with import, absent without, unsafe mark and "From known sources" note.
- Plausibility with `personal/fixtures/api-profile.json` + `stats-ingame.json`: skipped when the files are absent (they are gitignored). Mode B total per stat is compared to the typed `/stats` value with a loose bound (`total ≤ typed + tolerance`; sources not counted by design make it lower). Prints stat names and pass/fail only, no values. A source that overshoots `/stats` by more than the unsafe values could explain fails the test, which flags a wrong table.

## Order of work (small commits, tests green each time)

1. Branch, probe the fixture for keys (skills caps, accessory bag `where`, enrichment field): counts only.
2. `sources.js` skills, slayer, level + tests.
3. Worker `skyblockXp` + `summarize` + docs/api-worker.md + tests.
4. Accessories: `readItem` enrichment, accessory source + tests.
5. `totalFor` modes B and C, snapshot `calc`, buff values from `stat-sources.json`, `accessoryGain` guard + tests.
6. Stats view: breakdown, unsafe marks, Other/From known sources text.
7. Level strip.
8. Plausibility test, `apps/guide/changelog.json` 0.17.0, debug APK (`npm run guide:build`).

Git identity Tsaitunq (noreply) as configured. No push, no merge.

## Decisions I took (tell me if wrong)

- Game base (100 Health, 30 Crit Chance, 50 Crit Damage) becomes a source of mode B and C. In mode C it is part of `other`'s subtraction so nothing is double counted.
- Guide changelog gets a "0.17.0" entry, in the style of the existing ones; the Bazaar app version is not touched.
- Chips use `<details>`, not a new route.
- `computeStats` in `stats.js` keeps its own tables for the optimizer; not merged.

## Open points

1. **Accessory reforge values.** `optimizer-data.js` holds reforge tables for our mining and Blaze stats only. Reforges outside it make a piece "unknown". Acceptable, or should I collect the full accessory reforge table first (more work, more data)?
2. **Equipment pieces** (necklace, cloak, belt, gloves) are counted by the ticked gear, not by the bag. If your gear steps do not cover the worn ones, they stay in "Other". OK?
3. **Farming** area: no import-based sources for crop stats yet (Farming Fortune is in `stat-sources` but one source). It follows the same rules; unsafe marks show.

## Not in this change

Fairy souls (no permanent stats since 0.15), Taming/Runecrafting (no stat), mayor, cake, museum, other potions, conditional perks, merging `stats.js` tables into `stat-sources.json`.

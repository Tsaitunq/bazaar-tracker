# Plan: Guide U2, the editors (branch `feat/guide-u2-editors`)

Scope: the guide app only (`guide/`, shared files it already loads, `gamedata/`, `scripts/guide-copy.mjs`). `www-guide/` is build output. The Bazaar app is not touched. Target version: guide 0.8.0.

## 0. State found

- `pg.build` has `hotm`, `attrs`, `power`, `pet` as `null` (unknown). `setPart` (guide/build.js) already backfills snapshots when a part leaves `null`. `totals.js` already reads `hotm.levels/omelette`, `attrs[key]`, `power.stone/accessoryPower/tuning`. So the editors only write the shapes the maths already reads.
- The Stats views (`guide/views/stats.js`) have a placeholder for the three tabs. Tab switching is a link row; swipe exists only for guide pages (`swipeTarget` in model.js, touch code in app.js, `route().page === 'guide'` gate).
- `docs/skin.png` is untracked (not in git yet), so step 0 is `mv` plus `git add`, not `git mv`.
- No "changes since measurement" line exists in the overview yet. `totalFor` computes the delta internally but returns only the sum.

## 1. Order of work (small commits, tests green before each)

| # | Commit | Content |
|---|--------|---------|
| 0 | skin asset | `docs/skin.png` -> `guide/img/skin.png`; add to the `SHELL` list in `guide/sw.js` (the copy script reads that list, so `guide-copy.mjs` follows; extend its test to expect the file); check the SW test. |
| 1 | data fixes | Section 3.3: tuning values in `power.json`, naming, tests. New `gamedata/pets.json` + check function (section 3.4). |
| 2 | build model | Pure functions in `guide/build.js`: `setPerk`, `setAttr`, `setPower`, `setPet`, `omelette`. Each goes through `setPart` (backfill). Tests incl. the U1 rule: measure without HOTM, enter HOTM, total unchanged, one perk +1 changes total by exactly the formula. |
| 3 | tabs + swipe | Overview, HOTM, Attributes, Power swipe sideways, links stay. |
| 4 | HOTM editor | Tree, sheet, costs. |
| 5 | Attribute editor | |
| 6 | Power editor | |
| 7 | Pet picker | |
| 8 | locked steps | |
| 9 | overview: delta line + player figure | |
| 10 | 0.8.0 | `guide/changelog.json`, docs summary, version. |

## 2. Where things live

- `guide/build.js`: setters (pure, return `{build, base}`).
- `guide/hotm-model.js` (new): grid layout from `hotm.json`, lock state, cost to max, effect at level L and L+1. No markup.
- `guide/views/stats.js` stays the entry; editors go to `guide/views/stats-hotm.js`, `stats-attrs.js`, `stats-power.js` (stats.js is already 5 KB; one file per editor keeps them reviewable). New files go into `SHELL` of `guide/sw.js`.
- `guide/skin.js` (new): canvas drawing of the figure.
- `app.js`: only event wiring (`data-hotm-*`, `data-attr-*`, `data-power-*` -> setter -> `save('pg.build')`, `save('pg.base')`, redraw) and the swipe gate.

## 3. Details per point

### 3.1 HOTM editor
- Grid 7 cols x 10 rows from `col`/`row` (46 perks; tier = 10 - row). Connections drawn from `neighbors` (orthogonal only, already validated and symmetric).
- State per perk: 0 = off, level, max. Tap opens the sheet: stepper (- / +), number input, Max button. Core of the Mountain: same sheet, levels 1-10, cost from its `levels` table. Switch "Blue Cheese Goblin Omelette" above the grid (`hotm.omelette`). With omelette, `omeletteBonus` perks show level+1 in the effect text (as `totals.js` does via the same rule).
- Sheet: effect at current level and at next level via `valueAt` (the one evaluator), conditional effects tagged with `cond`, ability perks (`effects: []`) show "ability, no permanent stat".
- Cost to max: `floor((N + offset)^exp)` per level N, summed over the missing levels, per `cost.powder`. Core: sum of `levels[].cost`. 7 perks have `cost: null, unknown: true` (e.g. `mining_speed`, exponent not read): sheet says "cost not known", no number.
- Locked perks (`requires`): greyed, not tappable until the required perk is >= 1 (only `front_loaded` <- `seasoned_mineman` in the data today). Setting the prerequisite back to 0 does not delete the dependent level; it only greys it and `statsOf` keeps counting what is set (decision: no silent data loss). Open for you below.
- First write creates `{ levels: {}, omelette: false }` through `setPart` (backfill).
- Header chips as in the mockup (tier, powder totals): tier = core level, powder = sum of costs of the set levels. Computed, not typed.

### 3.2 Attributes
- List 1: attributes that appear in the guides (steps of kind `attr`, read from the loaded guides); list 2 "Show all" (325 entries, search field, filter chips by area as in the mockup). Row: name, shard, rarity colour, level 0-10 with the stepper in a bottom sheet like HOTM. Icon: text placeholder (first letters + rarity colour), no third-party images.
- Stored as `attrs[key]` (key like `nature_elemental`, what `totals.js` reads). Max level from `maxLevel`. `shardsPerLevel` gives "next level needs N shards".
- To verify while building: which guide steps name an attribute and how (kind/field), so the "in the guides" list is exact. If a name does not match a `key`, it is listed in the test output, not guessed.

### 3.3 Power (and the check you asked for)
Compared `gamedata/power.json` with `personal/sources/u2-daten.md` (read only, nothing copied from personal/, no personal MP used):
- Multiplier: `29.97 * ln(0.0019 * x + 1)^1.2` matches; x=250 gives 9.642 (file says `checkAt250: 9.64`, ok).
- Stone bases and unique bonuses of Itchy, Bloody, Hurtful, Strong, Scorching: all five equal the u2 table. No deviation.
- Tuning: **deviation.** Only Attack Speed 0.3 is set (marked "not confirmed"); the other seven are `null`. Set to your values: Health 5, Defense 1, Speed 1.5, Strength 1, Crit Damage 1, Crit Chance 0.2, Attack Speed 0.3, Intelligence 2; drop the `unknown` flags and the "not confirmed" note, source `u2-daten` (user-confirmed 2026-11-04).
- Naming: the formula variable and `power.accessoryPower` in the build are really Magical Power (MP). Rename to `mp` in `pg.build.power`, in `totals.js` and in the tests (no real data exists yet: `power` is still `null` everywhere). The accessory-power-per-rarity table keeps its name.
- Tuning points available: `pointsPerAccessoryPower: 0.1` gives 100 at MP 1003 (the mockup). Shown as "points left", not enforced as a hard cap.
- UI: stone chips (all 23 in the file, five main ones first), MP number field, preview "Stone gives ..." = base x multiplier + unique bonus, tuning rows with - / count / +, buffs (God Potion, Cookie) switches reuse the existing `buffs`. Tuning slots (Slot 1/2 in the mockup) are not modelled: one set of tuning points. Open question below.

### 3.4 Pets
- `gamedata/pets.json`: `{ id, name, rarity, level: 100, stats: {STAT: n}, perks: [{ name, text, stat?, value?, condition? }] }` for Bal, Glacite Golem, Goblin, Scatha (Legendary, Epic, Rare), Snail, Mammoth. No Crow. Source `u2-daten` (user). Resistances (Heat, Cold) are not in `stats.json` yet: they are stored under `stats` only if the stat exists, otherwise as display text in `perks`. Check function `checkPets` in `gamedata.js`, same style as the other checks; `FILES` gets `pets`, `loadGameData` and the SW list follow.
- Unconditional pet stats (e.g. Bal Mining Fortune +100) go to the total through the existing `petStatsAt` path only if `stats.js` already knows that pet; otherwise a new reader for `pets.json` is used and `stats.js` stays untouched. Conditional perks (`condition`: "Magma Fields", "Mines of Divan", "Glacite Mineshafts", ...) are display only, never summed (same rule as `listed`).
- Rule from U1 stays: `gear.js petGear` already does "ticked step wins, else `build.pet`, never both"; the picker shows a hint "a ticked pet step overrides this" when both exist.
- Where: below the Power tab and on the overview next to the figure ("Pet: Scatha (Epic)", tap opens the picker). Mockup has no pet screen: placement is my proposal, say if you want another.

### 4. Locked steps (point 5)
- `requires.js` `checkOne` HOTM case reads `p.hotm.experience`. New small entry `lockedByBuild(step, build)` in `requires.js`: HOTM tier from `build.hotm` (core level), reads the step's existing `HEART_OF_THE_MOUNTAIN` requirement; `build.hotm === null` gives unknown (not locked). Skill and slayer requirements stay unknown (no source in the build), as the file comment says: locked needs proof.
- `guide/model.js` line ~272 `locked: false` becomes `locked: lockedByBuild(...)`; `path.js` line ~106 gets `profile` replaced by the build-based check for virtual profiles. Reasons text like today ("HOTM 7 needed, you have 5").
- Assumption to confirm: HOTM tier equals the Core of the Mountain level.

### 5. Overview: "Changes since measurement"
- `totalFor` additionally returns per stat `delta = (now.add - was.add)` plus a `parts` list of which editor moved it (HOTM / Attributes / Power / Buffs / Pet), computed by running `statsOf` with each part swapped. New line in the table block: "Since measurement: +12 Mining Fortune (HOTM +10, Attributes +2)". Hidden when nothing moved. Row text in `statsModel`, markup in `overview()`.

### 6. Player figure (point 7)
- `guide/skin.js`: loads `img/skin.png`, draws on a canvas with `imageSmoothingEnabled = false`, integer scale, CSS `image-rendering: pixelated`. Layout of the 64x64 skin (modern 64x64 format): head 8x8 at (8,8) + hat layer (40,8), body 8x12 at (20,20) + jacket (20,36), right arm (44,20) + sleeve (44,36), right leg (4,20) + pants (4,36); left arm (36,52) + sleeve (52,52), left leg (20,52) + pants (4,52). Arm width 4 (classic) assumed; slim (3 wide) skins detected by a transparent column in the arm and drawn accordingly (a pixel test with a hand-made 64x64 fixture, not the real skin).
- Missing file or load error: neutral silhouette (same canvas, flat colours). The canvas size is fixed, so the layout does not jump.
- Slots: **the mockup shows no slots around the figure**, only the figure with the "Base measured / Gear / Measure" text next to it. I will not invent slots. Proposal: the figure plus a small tag under it for the pet and one "Power: Scorching" tag, if you want more, tell me which.
- Tests: node has no canvas; the pixel-rect mapping (source rect -> target rect per part, slim/classic) is a pure function and tested; the actual draw is covered by the Playwright shot script (`guide:shots`).

### 7. Swipe between tabs
- Reuse the guide's touch machinery in app.js (peek, settle, axis detection) with a `swipeTarget` for the stats route: tab order `STATS_TABS`, area stays. Edges: first tab swipe-right and last tab swipe-left do nothing (no jump to home). The `touchstart` gate `route().page === 'guide'` becomes "guide or stats (not measure)". `scrollsSideways()` already stops swipes on horizontally scrolling content; the HOTM grid is fixed width and the attribute filter chips wrap, so no conflict. Number inputs/sliders must not start a swipe (checked in `touchstart`).
- Tab links stay normal `<a href>`.

## 4. Tests (no live API)

- `guide-build.test.js`: setters, backfill rule, round trip with `totalFor`.
- `gamedata.test.js`: tuning complete, pets check, bad pets fail with a path to the fault.
- `guide-totals.test.js`: `mp` rename, delta parts.
- `guide-views.test.js`: tabs render real editors; locked perk greyed; pet hint; overview delta line hidden when empty.
- `requires.test.js` / `path.test.js`: `lockedByBuild`, `null` is not locked.
- `guide-sw.test.js`, `guide-copy.test.js`: `img/skin.png`, new files and `pets.json` are in `SHELL` and copied.
- Swipe target function in `guide-model.test.js`.
- `npm test` green before every commit; no commit on red.

## 5. Not doing

Fremdgrafiken/Icons from outside, an external skin service, a hard tuning cap, tuning slot 2, Crow, anything from `personal/`, push, merge, Bazaar app changes.

## 6. Answers (2026-11-04) and what they changed

1. **Slots around the figure**: none. Figure plus tags for pet and power (as proposed).
2. **Prerequisite set back to 0**: no answer given; built as proposed (the dependent level is kept and greyed).
3. **Tuning slots**: one tuning set.
4. **Pet picker placement**: Power tab plus a tag on the overview (as proposed).
5. **HOTM tier is not the Core of the Mountain level.** The tier is its own field `hotm.tier` (set in the HOTM editor); section 4 above is superseded: `lockedByBuild` and `lockOf` read `hotm.tier`, an unknown tier locks nothing.
6. **`accessoryPower` -> `mp`**: done in step 1.
7. **First entry is a draft that is saved on purpose.** If the measurement did not know a part (HOTM, attributes, power), the first entry stays a draft until "Save"; it then counts as already inside the base (`editPart`, `commitDraft`, `discardDraft`). The overview shows a notice with a link to the tab while a draft is unsaved.
8. **Perks with one level cost 1 token** (`costOf` gives `{ tokens: 1 }`), no powder.
9. **Pet rule**: a ticked pet step wins, otherwise `build.pet`, never both.

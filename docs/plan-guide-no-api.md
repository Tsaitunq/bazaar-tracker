# Plan: Guide app without the Hypixel API (branch `feat/guide-no-api`)

Scope: the guide app only (`guide/`, `www-guide/` is a build output). The Bazaar app stays as it is. Stage U1 here; U2 (HOTM, attribute and power editors) is only prepared in the data model.

## 1. Goal

The guide app needs no API key, no profile call and no auto-detection. Per stat the app shows:

```
Total = Base (measured by hand) + Changes since the measurement + Gear (from ticked steps)
```

- **Base**: the player types their `/stats` per area (Mining, Combat/Blaze, Farming) with no armor, equipment, tool/weapon and pet. Saved with the date and a snapshot of the build at that moment.
- **Changes since the measurement**: `statsOf(build now) − statsOf(snapshot)`, computed from `gamedata/`.
- **Gear**: from the data of the ticked steps. A ticked step means owned.
- Multipliers (`kind: "percent_multiplier"`) are applied after everything is added. Conditional effects (`cond` other than `always`) are listed only, never summed.

## 2. Data model

All state stays in `localStorage` as JSON, written through the existing `save`/`load` helpers in `guide/app.js`.

### 2.1 Ownership (existing, now the only source of "have")

- `pg.owned`: `string[]` of item ids, shared by all guides. Unchanged. An item step ticked in guide A is owned in guide B (already how `tickStep` and `owned.js` work).
- `pg.checks`: `{ [guideId]: string[] }` of step keys. Unchanged. Holds ticks of steps that are not whole items (enchant, gem, reforge, recomb...), because those sit on one piece of one guide.
- Gear stats come from `virtualProfile(guide, checked, owned, items)` (`virtual.js`), which already builds the worn pieces out of ticks. Only the gear part is taken from it (see 3.3).

### 2.2 Build (current state, new, `pg.build`)

```json
{
  "hotm":  null,   // later { "levels": { "<perkId>": 0 }, "omelette": false }
  "attrs": null,   // later { "<attributeKey>": 0 }
  "power": null,   // later { "stone": null, "tuning": { "<STAT>": 0 }, "accessoryPower": null }
  "buffs": { "godPotion": false, "boosterCookie": false },
  "pet":   null
}
```

`pet` is `null` for now; later `{ "id", "rarity", "level", "item" }`. U1 only creates the field, no UI. **`hotm`, `attrs` and `power` start as `null` = unknown, never `{}` or 0.** U1 writes only `buffs` (checkboxes on the Measure screen). U2 only adds editors. `null` means unknown.

**Backfill rule.** A part that was unknown (`null`) in a snapshot must not count as level 0, or the first entry of the HOTM tree in U2 would add the whole tree a second time (it is already inside the measured base). So when a part of `pg.build` is set for the first time (`null` -> value), the value is copied into every `pg.base[*].snapshot` whose same part is still `null`. Only later changes count as delta. Test: measure without HOTM -> enter HOTM -> total unchanged -> one perk +1 level -> total changes by exactly the formula.

### 2.3 Measurement (new, `pg.base`)

```json
{
  "mining": { "at": 1793552651613, "values": { "MINING_FORTUNE": 123 }, "snapshot": { /* copy of pg.build at that time */ } },
  "blaze":  { ... },
  "farming": { ... }
}
```

- One entry per area, the latest one. A new measurement replaces it (no history in U1).
- `values`: only stats the player typed; an empty field is unknown, not 0 (as today). The stat list per area comes from `gamedata/stats.json` (`areas`), not from `AREA_STATS` in `stats.js`.
- Magical Power typed with the measurement is kept as `mp` on the entry (the Blaze ranking needs it); it is not part of the snapshot.

### 2.4 Schema flag

`pg.schema: 2` marks a finished migration (replaces `pg.ownedV1`).

## 3. Calculation (new pure module `guide/totals.js`, no DOM)

### 3.1 `statsOf(build, gamedata, context)`

Adds up, per stat, what the build gives:

- HOTM: `a + b·(L−1)` style effects from `hotm.json` (formula fields as the loader already validates them), `omeletteBonus` as the data says.
- Attributes: `perLevel`/`fixed` from `attributes.json`; `per_stat` effects are conditional (`in_mineshaft`) so they are listed only.
- Power: power stone base and unique bonus, tuning points × `perPoint`, accessory power through `power.multiplier`. A `null`/`unknown` value is skipped and reported as "not counted".
- Buffs: God Potion and Booster Cookie from `power.json`.

A part that is `null` contributes nothing. Formula evaluation (`a + b·L`, `stepEvery/stepAdd`, `floor`, `cap`, omelette +1 level) exists **once**, as `valueAt` in `guide/gamedata.js`; `totals.js` calls it.

Returns `{ add: {STAT: n}, mult: {STAT: factor}, listed: [{stat, text, cond}] }`.

A `percent_multiplier` counts when its `cond` holds for the area. Mining islands are the Dwarven Mines, Crystal Hollows and Glacite Tunnels/Mineshafts; the Crimson Isle is not. Mining: `on_mining_islands` holds. Blaze/Combat and Farming: it does not, so the effect is listed only.

### 3.2 `totalFor(area, entry, buildNow, gear, gamedata)`

```
snap = statsOf(entry.snapshot), now = statsOf(buildNow)
sum[stat]   = entry.values[stat]/snap.mult[stat] + (now.add − snap.add)[stat] + gear[stat]
total[stat] = sum[stat] × now.mult[stat]
```

The base was measured with the snapshot's multiplier already in it, so it is divided out first and the current one is applied after the sum. Rows: `{ stat, base, gear, total, listed }`. A stat with no typed base value shows `–` for base and total.

### 3.3 Gear

`gearOf(guide(s), checks, owned, items)`: builds the virtual profile for the area from all guides of that area, then adds `gearStats` of armor, equipment and tool/weapon. Pet rule: if a ticked step sets a pet, that pet is the gear pet; otherwise the pet from `pg.build.pet` (when set). Never both. The base is measured without a pet, so there is no backfill for the pet (it is not part of the snapshot delta). Accessories are not gear here: the base was measured with them on.

## 4. Storage keys and migration

| Key | After the update |
|---|---|
| `pg.guides`, `pg.checks`, `pg.owned`, `pg.dates`, `pg.bins` | kept |
| `pg.settings` | kept; the field `personal` is dropped |
| `pg.build`, `pg.base`, `pg.schema` | new |
| `pg.profile` (typed `/stats`, synced summary, UUID) | deleted |
| `pg.ownedV1` | deleted |
| Android store: API key and profile | cleared once through the plugin, then never read |

`migrate()` in a new `guide/migrate.js`, runs once at start while `pg.schema` is below 2:

1. Recognized ticks stay as manual ticks. Today `doneSet(guide, marks, auto)` merges `marks` with what the sync found (`auto`). Using the last synced profile in `pg.profile` / the Android store, compute `autoOf(...)` one last time, and write every done item step into `pg.owned` and every other done step into `pg.checks`. Steps already marked `undone:` stay undone.
2. Delete `pg.profile`, `pg.ownedV1`, `personal` in `pg.settings`.
3. Clear the API key and profile in the Android store (`clearProfileData`) when the plugin is there.
4. Set `pg.schema = 2`.

The old typed `/stats` were measured with gear on, so they are not carried over; the home screen asks for a new measurement.
The order matters: step 1 reads the profile, step 2 and 3 delete it. If step 1 cannot read the Android store, nothing is deleted and the migration runs again next start.

## 5. UI (U1)

- **Measure screen** (`#/stats/measure/<area>`, mockup `Stats-Measure.dc.html`): fields from `stats.json` for the area, buff checkboxes, a line showing the gear that the guides add, button "Save as <Area> base". Saving writes `pg.base[area]` with a snapshot of `pg.build`.
- **Stats overview** (`#/stats`, mockup `Stats-Overview.dc.html`): area switch, "Base measured <date>, no gear, buffs", "Gear: N steps ticked in ...", table Base / Gear / Total, conditional effects listed under the table.
- **Tabs** HOTM / Attributes / Power: a placeholder each ("comes in the next update").
- **Theme**: a purple `stats` theme in `guide.css` (`data-theme="stats"`), contrast checked by the existing `contrast.test.js`.
- The ranking (`planOf` in `model.js`) uses `totalFor` as its starting stats instead of the synced profile or `statsInput`. Without a measurement it shows "Measure your base under Stats" (replaces the `missing: 'stats'` note).

## 6. What goes away

Guide app only:

- `guide/views/settings.js`: UUID and API key fields, sync block, Detection report, "Sync with my own API key" checkbox.
- `guide/app.js`: `runSync`, `showProfile`, `saveUuid`, `saveKey`, `removeProfile`, `loadStand/saveStand`, `personal()`, `shownState`, `statsOnly` use, the API-tag sheet (`evidenceKey`).
- `guide/model.js`: `reportOf`, `syncOutcome`, `statsOnly`, `autoOf` (reduced to the owned-based part), the `api`/`undo`/`from sync` flags of a row.
- Root modules only the guide used: `sync.js`, `profile.js`; from `native.js`: `getApiKey`, `setApiKey`, `saveProfile`, `loadProfile`, `clearApiKeyOnly`, `clearProfileData`, `canSync` (the Bazaar app keeps the alert functions). From `detect.js`: `explainGuide` and the kinds that only read a profile; `detectGuide` stays for `owned.js`.
- Scripts: `scripts/detect-report.mjs`, `scripts/stats-report.mjs` (live-profile reports).
- Android guide: key and profile methods in `GuidePlugin.java`; the `ProfileStore.java` copy in `android-guide/app/build.gradle` if nothing else uses it. `ProfileStore.java` in `android/` is the Bazaar app's and stays.
- Tests: `sync.test.js`, `profile.test.js`, `profile-fixture.test.js`, `detect-report.test.js`, and the sync parts of `guide-app/model/views/review`, `native`, `detect` tests.

Kept: ranking (`optimizer.js`, `path.js`, `blaze.js`, `virtual.js`), prices, guide import/export, ownership.

## 7. Files touched

- New: `guide/totals.js`, `guide/migrate.js`, `guide/views/stats.js`, `tests/guide-totals.test.js`, `tests/guide-migrate.test.js`, `tests/guide-stats-views.test.js`.
- Changed: `guide/app.js`, `guide/model.js`, `guide/views/{settings,home,guide,parts}.js`, `guide/guide.css`, `guide/changelog.json`, `guide/sw.js` (cache list), `scripts/guide-copy.mjs` (copy list: `gamedata/` and new files), `native.js`, `detect.js`, `stats.js`, `docs/STRUCTURE.md`, `README.md`/`SUMMARY.md` where they name the sync.
- Deleted: see section 6.
- Version: guide `0.7.0` (feature), changelog entry per `CLAUDE.md`; entries: "No API key needed", "Measure your base", "Stats overview".

## 8. Tests (no live API calls)

- `totals`: sum, base-only, gear-only; change since snapshot is zero when nothing changed; HOTM level change moves the sum by the formula; `percent_multiplier` is applied after the sum and not before; conditional effects appear in `listed` and not in the total; unknown values are skipped; empty base shows `–`.
- `migrate`: a world fixture with a synced `pg.profile` and recognized steps gives manual ticks; second run changes nothing; keys deleted; the Android store clear is called through an injected fake plugin; nothing is deleted if the profile cannot be read.
- Shared ownership: an item ticked in guide A is owned in guide B and counts as gear there.
- Views: Measure and Overview render from fixtures; the settings page has no key or sync field; the app source has no `api.hypixel.net` except the Bazaar price URL and no `getApiKey`/`fetchProfiles` (a grep test).
- Existing suites stay green; tests of removed code are deleted with it, not skipped.
- `gamedata.test.js` stays; `totals` tests read `gamedata/*.json` through `loadGameData`.

## 9. Steps (small commits, all tests green before each)

1. `feat(guide): totals.js with statsOf/totalFor` and tests.
2. `feat(guide): build and base storage, schema flag` (`pg.build`, `pg.base`, pure helpers).
3. `feat(guide): migrate to manual ticks` (`migrate.js`, tests, wired at start).
4. `feat(guide): measure screen` and `feat(guide): stats overview` with the purple theme and placeholder tabs.
5. `refactor(guide): ranking starts from the total` (replaces `statsInput` and the synced profile in `planOf`).
6. `refactor(guide): remove API key, sync and detection UI` (settings, app, model).
7. `refactor: remove sync.js, profile.js, native key functions, report scripts, Android key methods`, delete their tests.
8. `chore(guide): changelog 0.7.0, sw cache list, docs`.

Identity: `Tsaitunq <340181080+Tsaitunq@users.noreply.github.com>` (already set in this repo). No push, no merge.

## 10. Decisions (answered)

1. Multiplier counts when the area's context fits (see 3.1).
2. The engine for HOTM, attributes and power is built and tested in U1.
3. Pet only through ticked steps (or later `pg.build.pet`, never both); accessories and Accessory Power stay in the base.
4. Old typed `/stats` are dropped.
5. One latest measurement per area.
6. The ranking moves to the new total in U1 (step 5), because the old stats are deleted.
7. Farming: stat list from `stats.json`, no gear.
8. Before deleting `sync.js`, `profile.js` and native functions, grep that the Bazaar app (`index.html`, `app.js`, `android/`) does not use them.

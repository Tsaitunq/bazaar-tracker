# Profile import (guide app)

The guide app reads the player's own SkyBlock profile through the worker (`docs/api-worker.md`) and suggests what the player owns. Nothing is ticked or changed until the player confirms. Plan and decisions: `docs/plan-api-import.md`.

Android app only: the worker answers CORS for `https://localhost` and `capacitor://localhost`, not for github.io. In the PWA the settings show a note instead of the form.

Not affiliated with or endorsed by Hypixel. The text is on the settings block and on the import screen.

## Modules (`apps/guide/`)

| File | Job |
|---|---|
| `nbt.js` | NBT reader and gzip-base64 inflate (`DecompressionStream`). Every length is checked; 20 MiB per inventory and 100 MiB per import. |
| `import/api.js` | The two calls (`/v1/profiles/<name>`, `/v1/profile/<name>/<id>`), name check, 10 s timeout, every failure as an `ImportError` (`name`, `notfound`, `limit`, `upstream`, `offline`, `server`). Changes no state. |
| `import/items.js` | Inventories to items: id, enchants, gems (object and text form, typed slots, open slots), reforge, `recomb` (`rarity_upgrades`), `upgradedRarity`, HPB/fuming, stars, drill parts (both forms), polarvoid, powder coating, scrolls; where it was found. No uuid, lore or name. |
| `import/profile.js` | The summary the app stores: items, pets, essence perks, attribute stacks and levels (shard table per rarity), HOTM levels/tier/ability/disabled/powder, MP, tuning, selected power. |
| `import/propose.js` | Rows per area against the app's state (new, different, same, conflict, partial, suggest), `applyRows`, `undoImport`, the measurement guard. Pure. |
| `views/import.js` | The settings block and the suggestions screen (`#/import`). |

## Item format (checked with `apps/api/scripts/probe-items.mjs`, 2026-11-10)

`tag.ExtraAttributes` holds everything; `components` is ignored. `gems.<TYPE>_<n>` is `{ quality, uuid }` or the quality as text; `MINING_`, `COMBAT_`, `UNIVERSAL_`, `DEFENSIVE_`, `OFFENSIVE_` slots carry the type in `<SLOT>_gem`; `gems.unlocked_slots` lists the open slots. Drill parts are `drill_part_engine|fuel_tank|upgrade_module` (text) or `engine|fuel_tank|upgrade_module.id`. `upgrade_module` is the Goblin Omelette. The worn armor set is empty in the wardrobe; what is worn is in `inv_armor`.

## Rules

- Rows with a conflict (the profile has less, or says no, where the app has a value or a tick) are shown and never applied.
- The power stone, the active pet and the Omelette are suggestions with their own button. "Apply all" skips them.
- Ticks from the import carry no date by default: they count as inside the measured base. A switch on the screen dates them today (only accessories read the date).
- A part of the build that is still unknown is written whole through `setPart`, which also fills the snapshots of the measurements, so the base is not counted twice. A known part against a measurement is a change since it. While a measurement is younger than the data (70 minutes), differing values of that part are blocked.
- One step of undo (`pg.undo`): it removes what the import added and keeps what the player did afterwards; a part the player changed since stays and is named.
- The measurement is an optional reconciliation. Without it the stats show what the app knows (HOTM, attributes, essence, power, ticked gear). With it, "other sources" is the /stats value minus what the app knew at the time; the total is the app's figure plus the other sources.

## Stored on the device

`pg.api` (`{ name, profileId, own }`), `pg.profile` (the summary: numbers and ids), `pg.undo`. One profile at a time; a new name asks before it replaces the stored state, and applying for a name that is not the saved one asks once more. After a successful load the app also fetches the player's skin (`GET /v1/skin/<uuid>`, a PNG of at most 64 KB) and keeps it as a data url in `pg.skin`; the head icon, the profile menu and the figure draw it (slim arms are detected from the pixels; a 64x32 skin is mirrored to 64x64). No skin or an error leaves `img/skin.png`. "Delete profile data" removes `pg.api`, `pg.profile` and `pg.skin`; ticks, build and measurements stay. Nothing of this is part of an export.

## Not confirmed

- Attribute `stacks` against the in-game level (checked against the wiki table, not against a live profile for every attribute).
- Tuning: the answer has one block per slot and no mark for the slot in use; only the case "exactly one slot holds points" is taken, and the values are read as points.
- Wardrobe numbering: the game's slot is the API number plus one when a set 0 exists (read from the fixture, not confirmed live).
- `selected_ability` and the `toggle_<perk>` nodes against the in-game tree.

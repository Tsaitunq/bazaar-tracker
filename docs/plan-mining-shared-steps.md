# Plan: Mining shared steps (guide app 0.11.0)

Branch `feat/mining-shared-steps` (from `main`). Nothing from `personal/` goes into git. Small commits, tests green after each, git identity `Tsaitunq`, no push, no merge. At the end: version 0.11.0 in `apps/guide/changelog.json`, debug APK via `npm run guide:build`.

## What exists today (checked)

- Ticks are stored per guide in `pg.checks[guideId]` as `"<section>|<step text>"` (`progress.js` `stepKey`), with `undone:` prefix for an explicit untick. Item steps are already shared through `pg.owned` (item ids, `owned.js`). Enchants, gems, reforges stay inside their guide. So the same fact is ticked twice in two guides.
- `personal/guides/shafting.json` is built by `personal/build-shafting.mjs` from `personal/sources/mining-cult-order.md`. It already has Flawless and Perfect gem steps (Amber/Jade 11 + 11 each, Topaz 1 + 1), 46 gem steps in all. `personal/guides/mining.json` has 94 steps, 91 of them with `detect`.
- Gem and reforge value tables: `apps/guide/optimizer-data.js` (`GEMS`, `REFORGES`, indexed by rarity 0..6). Ranking per 1 % already exists: `SCORES`, `miningScore`, `perOne` in `optimizer.js`.
- Attribute effects: `gamedata/attributes.json` has 325 entries, 239 with `effects: []`, 65 of those `unknown`. The text "no stat effect known" (`views/stats-attrs.js:17`) is the "stat not found" you see. Freezing Spread is the only `per_stat` entry; `attrs-model.js effectLines` prints "0.5 per 29 Cold Resistance" and never computes. The `every` for levels 2-9 is `unknown`.
- Icons: `scripts/guide/fetch-icons.mjs` already iterates `pets.json` and `attributes.json`, but is not part of `guide:build`. `img/hypixel/pets/` has 8 files, `pets.json` has 9 entries: `BLAZE_LEGENDARY.png` is missing (NEU id `BLAZE;4` probably not found; to be checked, see open points).

## Step key schema (A2)

Every step in a guide may carry `key`. Keys are lowercase, parts joined by `:`, unique inside one guide, stable under text edits.

| Step | Key | Example |
|------|-----|---------|
| item | `item:<ITEM_ID>` | `item:DIVAN_HELMET` |
| gem | `gem:<piece>:<TYPE>:<QUALITY>:<n>` | `gem:divan_helmet:JADE:FLAWLESS:1` |
| reforge | `reforge:<piece>:<value>` | `reforge:divan_helmet:jaded` |
| recombobulator | `recomb:<piece>` | `recomb:divan_helmet` |
| essence perk | `perk:<perk>:<level>` | `perk:eager_miner:3` |
| enchant | `enchant:<piece>:<enchant>:<level>` | `enchant:drill:ultimate_flowstate:2` |
| coating, polarvoid, pet, attribute | `coating:<piece>`, `polarvoid:<piece>:<n>`, `pet:<ID>:<tier>`, `attr:<key>:<level>` | |

- `<piece>` is the item id in lower case. Where a slot is held by a chain of items (drill X355 → X455 → X555 → X655 → Divan's Drill), the piece is the slot alias `drill`, so Flowstate II ticked once counts for the whole chain. `n` is the running number of the slot of that type on that piece.
- Deviation from your examples: `gem:divan:...` and `reforge:divan:...` would not tell helmet from boots, so the piece is the full id (`divan_helmet`). Say if you want a shorter alias for the four armor pieces instead.
- `item:` keys keep living in `pg.owned` (the id, as today). No second copy: `item:X` is done exactly when `X` is in `pg.owned`.
- Steps without `key` (extras, buffs, free text) keep the old per-guide tick.

### Storage

- New `pg.keys`: array of keys that are done, `undone:<key>` for explicit untick. One set for all guides.
- `doneSet(guide, marks, auto)` reads a keyed step from `pg.keys`; `setMark` writes there. The old branch stays for unkeyed steps.
- `validGuide` / `validStep` accept `key` (string, lowercase pattern) and reject a guide with duplicate keys. Optional `legacy` on a guide: `{ "<old section>|<old text>": "<key>" }`, used only by migration.
- `impliedDone` (`after` chain) continues to work on text; additionally a Perfect gem step lists the Flawless step of the same slot in `after`.

### Migration (schema 2 → 3, `migrate.js`)

1. `build-shafting.mjs` writes `legacy` into `shafting.json`: old Shafting texts and old `mining.json` texts, each mapped to the new key of the step that means the same thing. The old mining file is kept as private input `personal/sources/mining-legacy.json` (moved there before the guide is removed from `personal/guides/`), so the map can be rebuilt.
2. On first start with schema 2: for each `pg.checks[guideId]`, every key found in some loaded guide's `legacy` moves into `pg.keys` (as tick, or `undone:`). Many-to-one is fine (union). An old Shafting Perfect tick also ticks the matching Flawless key.
3. A key with no match stays in `pg.checks[guideId]`; nothing is deleted. The migration is idempotent and sets `pg.schema = 3` last, like the existing run.
4. The removed guide `mining` keeps its leftover marks in `pg.checks.mining` (harmless, listed in the build log as a count).
5. Unit tests with a synthetic guide pair (no private data): moved ticks, `undone:` kept, many-to-one, unmatched kept, second run changes nothing, count before == count after (ticks moved + ticks kept).

## A. Mining guides

1. **Remove old guide.** Move `personal/guides/mining.json` to `personal/sources/mining-legacy.json`, drop it from `personal/guides/index.json` (generated by `guide-copy`). Match its steps to Shafting steps by key; ticks of matches carry over through `legacy` (step 2 above). Report the list of old steps with no Shafting equivalent (not carried over, kept in `pg.checks.mining`).
2. **Shared keys.** As above. Implementation order: `key` in `validStep` → `pg.keys` in `progress.js` → `app.js` load/save → migration → keys assigned by `build-shafting.mjs`.
3. **Gems split.**
   - Section "Flawless everywhere": Jade, Amber, Topaz on armor (Divan helmet/chestplate/leggings/boots), drill, Pendant of Divan, Power Stone. Add the missing Topaz-on-Divan Flawless steps (5 slots per piece type are read from `personal/items.json` `gemstone_slots`).
   - Then one step per Flawless→Perfect upgrade per stone and place: gain = `PERFECT[r] − FLAWLESS[r]` of `GEMS` (r = rarity of the item at that point), cost = Perfect gem price − Flawless gem price at current bazaar prices (assumption: the Flawless gem is returned on removal, so only the difference is paid). Rank by coins per 1 % via the existing `SCORES.mining` rate.
   - Each gem step shows its stat (stone, quality, item rarity → `+N Mining Fortune` etc.). When a Recombobulator step raises the rarity, the number shown rises with it.
4. **Armor / reforge.**
   - Divan armor "clean": base stats of the piece (`personal/items.json` `stats`), shown on the item step.
   - Jaded reforge step shows the stat per rarity from `REFORGES.jaded` (Mining Speed + Mining Fortune), as a short row of 7 values with the current rarity highlighted.
   - Recombobulator as its own step per piece (`recomb:<piece>`), raising the rarity by one (Legendary → Mythic for Divan). Reforge and gem numbers use the rarity after the tick; this goes through one `rarityOf(piece, done)` helper next to `gear.js`.
   - Missing values (e.g. no clean stats for Pendant / Power Stone rarity steps, no Divine column for Opal) are collected in a list in the final report, not guessed.
5. **Essence perks.**
   - New `gamedata/essence-perks.json` (pure game data, from `personal/sources/essence-perks.md`): perk id, shop essence, effect per level, max, cost formula or list, condition. Eager Miner, Rhinestone Infusion, Dwarven Expertise: 10 levels each, cost 100·L. Cut Loose: 5 levels, 500·L, conditional. Frozen Skin: 5 levels, 1000/1500/2000/3000/5000.
   - One step per level, key `perk:<perk>:<level>`. The existing `detect.kind: essence` stays and gets the same ids.
   - Cost = essence × bazaar buy price of `ESSENCE_GOLD`, `ESSENCE_DIAMOND`, `ESSENCE_FOSSIL`, `ESSENCE_ICE`. The ids are verified against `data/` bazaar snapshots and the item list before coding; if one differs, the mapping table holds the real id.
   - Cut Loose: shown with its condition (Glacite Mineshafts, stacks to 10× per Glacial mob), **never summed** into the stat totals; its essence cost is also not summed into the guide total.
   - Dwarven Expertise gives "Dwarven Metal Fortune": added to `gamedata/stats.json` if absent and used as a normal stat in the totals.

## B. Attributes

6. Every entry in `gamedata/attributes.json` gets `effectKind`: `flat`, `per_stat`, `conditional`, `chance` or `other`. No entry may stay without one.
   - `flat`: `{ stat, perLevel }` or `fixed`; counts in the sum (today's `cond: always` entries).
   - `per_stat`: `{ stat, per: { stat, every }, valuePerLevel? }`. Freezing Spread (Littlefoot): level 10 = +0.5 Gemstone Spread per 20 Cold Resistance, per level `0.05` per 20 CR, only Glacite Mineshafts. The view shows "now: +X" with X = `value × floor(currentStat / every)`... fractional or floored is decided in the unit test; the example you gave (100 CR → 2.5 at level 10) means **not floored**, `value × stat / every`. Never added to the totals.
   - `conditional` / `chance` / `other`: text with the value per level and the condition. Shown, never summed.
   - The `every` of levels 2-9 for Freezing Spread is `unknown` today. Rule used until confirmed: linear `perLevel` for the value (0.05 per level); `every` is 20 at level 10 and 29 at level 1, the levels between are interpolated only if you confirm that, otherwise they show "unknown" and the view uses the value of level 10 only.
   - Check: every attribute with "per 1" text in the data or NEU descriptions gets tested for the "per 1" instead of "per N" mistake; I list every case found.
   - Fill empty or unclear effects from the wiki / NEU repo. What stays unclear goes to the report list. The validator `gamedata.js` changes from "no effect and not marked unknown/other" to "no `effectKind`" → fails, so a new entry cannot slip through.
   - `attrs-model.js effectLines` returns `{ text, summed, now }`; `stats-attrs.js` prints the text instead of "no stat effect known" (it prints the stored note or "effect unknown" only for entries listed as unconfirmed).
   - `totals.js` adds only `flat` + always/in-area effects as before; `per_stat` is shown through a new `perStatNow(attr, level, stats)` that gets the current value of the reference stat from the measured base.

## C. Icons

7. `scripts/guide/fetch-icons.mjs`:
   - Pets: all of `gamedata/pets.json` (9 entries). Fix the Blaze pet: try `BLAZE;4` and alternates; if NEU has no skull, report it as missing and keep the placeholder.
   - Shards: every `icon`/`key` in `attributes.json` (325). `mcIcon` entries are skipped as before.
   - New `missingIcons(root)` returns the files that are expected but absent; the script downloads only those (existing files are not fetched again).
   - `npm run guide:build` calls it first. Offline or fetch error: one warning line listing what is missing, the build goes on.
   - `apps/guide/img/hypixel/` stays gitignored.

## Tests (all fixture/synthetic, no network, no private data)

- A tick on `gem:...` or `reforge:...` in guide A is done in guide B with the same key.
- Migration: no tick lost (count check), `undone:` preserved, idempotent, unmatched marks kept.
- Duplicate key in a guide is rejected by `validGuide`.
- Flawless → Perfect gain equals `PERFECT − FLAWLESS` for each stone, item rarity and after Recombobulator.
- Essence cost = essence × price for each perk and level; Cut Loose not summed.
- Freezing Spread at 100 Cold Resistance, level 10 = 2.5 Gemstone Spread, shown as "now", not in the sum.
- No attribute without `effectKind`; no "per 1" mistake.
- `fetch-icons`: expected files = pets + shards; the build lists missing ones and survives an offline get.

## Commit sequence

1. docs: this plan (first commit, then stop for your OK).
2. feat: step `key` in guide validation + `pg.keys` store + tests.
3. feat: migration schema 3 + tests.
4. feat: attribute effect kinds, per_stat view + data fill + tests.
5. feat: essence perks data + cost + tests.
6. feat: gem split (Flawless first, Flawless→Perfect steps, stats on steps) + tests.
7. feat: armor clean stats, Jaded per rarity, Recombobulator + tests.
8. feat: icons for all pets and shards in `guide:build` + tests.
9. chore: remove old mining guide, personal build script updates (not in git: only code that is in git changes), changelog and version 0.11.0.
10. Debug APK build, final report.

## Open points I need your decision on

1. **Key shape:** `gem:divan_helmet:JADE:FLAWLESS:1` (full piece id) instead of `gem:divan:...`. OK?
2. **Cost of Flawless→Perfect:** price difference (Perfect − Flawless), assuming the removed Flawless gem is returned. If it is lost, the cost is the full Perfect price. Which is it?
3. **Freezing Spread levels 2-9:** `every` unknown. Linear value per level plus "every" unknown (my default: show level 10 only exactly, others as "about"), or do you have in-game numbers?
4. **Old mining ticks without a Shafting match:** keep inert in `pg.checks.mining` (my default) or drop?
5. **Blaze pet icon:** if NEU has no skull for it, placeholder stays and it is on the missing list. OK?

## Known data gaps (will be reported as a list after the work)

Clean base stats for Pendant of Divan and the Power Stone gem slots by rarity, Divine column for Opal, Freezing Spread `every` for levels 2-9, any attribute where wiki and NEU give no value.

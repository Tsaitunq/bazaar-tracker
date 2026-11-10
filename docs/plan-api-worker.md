# Plan: API worker (`apps/api/`)

Branch `feat/api-worker` (from `main`). Small commits, tests green after each, git identity `Tsaitunq`. No deploy, no push, no merge. The Hypixel key exists only as the Worker secret `HYPIXEL_KEY`: never in code, repo, log, test or fixture.

## Decisions needed before I start

1. **Cache API does not work on `*.workers.dev`** (Cloudflare docs, to be re-checked when I build; it silently stores nothing). Your cache (1 h / 1 day) and the cache-based rate limit both depend on it. Options:
   - **A (recommended): Workers KV** for profile/UUID cache (`expirationTtl`) plus the Rate Limiting binding for IP limits. Free plan: 1,000 KV writes/day, so about 1,000 fresh profile fetches per day. Enough for a personal app. Deviates from "Cache API".
   - B: custom domain/route on a Cloudflare-managed domain (costs a domain). Then Cache API works as you specified.
   - C: Cache API anyway, accept no caching on workers.dev. Not advised: every request hits Hypixel.
2. **Rate limit shape.** The Rate Limiting binding only allows periods of 10 s or 60 s, not 10 min. With A I use e.g. 10 requests / 60 s per IP (counted per Cloudflare location, approximate). A true "30 / 10 min" needs a cache/KV counter (approximate and racy). Which do you prefer? Default: binding, 10 / 60 s.
3. **CORS origins.** Your list: `https://localhost`, `capacitor://localhost`, `http://localhost:*`. The guide app is also a PWA on `https://tsaitunq.github.io`, which is not in the list. Add it? Default: yes, as one constant, easy to remove.

## Findings from the fixture (keys only, checked)

- **Profile list** (`/v2/skyblock/profiles`) returns every profile with all members. One profile of mine is about 600 KB of JSON. This parse is the CPU risk (below).
- **HOTM is in `members.<uuid>.skill_tree`**, not `mining_core`: `nodes`, `experience`, `tokens_spent`, `selected_ability`. `mining_core` only holds powder (`powder_mithril/gemstone/glacite` plus `_total`, `powder_spent_*`). The worker reads `skill_tree` first, falls back to `mining_core.nodes/experience/selected_pickaxe_ability` (old format). Tier is computed from XP in the app, not in the worker.
- **Essence perks:** `player_data.perks` (map perk → level).
- **Pets:** `pets_data.pets[]` with `type, tier, exp, heldItem, active`. Also `pets_data.autopet`, `pet_care`: not taken.
- **Skill XP:** `player_data.experience` (`SKILL_*` keys).
- **Slayer XP:** `slayer.slayer_bosses.<boss>.xp`.
- **Fairy souls:** `fairy_soul.total_collected`, `unspent_souls`, `fairy_exchanges`.
- **Accessory bag:** `accessory_bag_storage.selected_power`, `.tuning` (slots, `highest_unlocked_slot`), `.highest_magical_power`, plus `unlocked_powers`.
- **Attributes (location, to be documented in `docs/api-worker.md`):** `members.<uuid>.attributes.stacks` = map attribute key → number (187 entries). `members.<uuid>.shards.owned` is a separate list (6 entries); I will check on live data whether the level comes from `stacks` or needs `shards`, and send both raw if unclear.
- **Inventory fields (raw base64, `{type, data}` objects reduced to the `data` string):**

  | Output field | Source |
  |---|---|
  | `inventory` | `inventory.inv_contents.data` |
  | `armor` | `inventory.inv_armor.data` (part of "Ausrüstung") |
  | `equipment` | `inventory.equipment_contents.data` |
  | `wardrobe` | `inventory.wardrobe_contents.data`: **absent in this fixture**, so it will land in `missing`; I verify live |
  | `accessoryBag` | `inventory.bag_contents.talisman_bag.data` (about 100 KB) |
  | `enderChest` | `inventory.ender_chest_contents.data` |
  | `storage` | `inventory.backpack_contents.<n>.data` (map by slot; icons not taken) |
  | `personalVault` | `inventory.personal_vault_contents.data`: not asked, skipped |

  Base64 total in this fixture: about 250 KB. Not decoded in the worker. `nbt.js` (+ `tests/fixtures/nbt-encode.js`, `tests/nbt.test.js`) comes back later from commit `d349c31^` for the app; not part of this branch.

## Layout

```
apps/api/
  package.json        own deps: wrangler (dev), nothing else; "test": node --test
  wrangler.toml       name, main, compatibility_date, [vars], bindings (KV / ratelimit per decision 1+2)
  src/index.js        router, CORS, error mapping
  src/validate.js     name check (^[A-Za-z0-9_]{3,16}$), profileId check (UUID, 32 or 36 hex)
  src/mojang.js       name -> uuid (cache 1 day), no key
  src/hypixel.js      fetch with header API-Key from env.HYPIXEL_KEY; error mapping
  src/trim.js         pure function: profile + uuid -> trimmed object + missing[]
  src/cache.js        get/put wrapper (KV or Cache API), keys, X-Cache header
  src/limit.js        per-IP limit; IP only as SHA-256 prefix, never stored plain
  tests/*.test.js     node --test, fixtures only
  tests/fixtures/profile.anon.json
docs/api-worker.md
```

Root `npm test` is `node --test`, which finds `apps/api/tests/*.test.js` already. No change to the root `package.json` needed. Dependencies on the rest of the repo: none (not even `shared/`). `.gitignore` gets `apps/api/.dev.vars` and `apps/api/.wrangler/`. The apps' `sw.js` SHELL lists are not touched (the API is not loaded by the apps yet).

## Endpoints (GET only, JSON, `notAffiliated` in every body)

- `GET /v1/profiles/<name>` → `{ uuid, profiles: [{ id, cute_name, game_mode, selected }], notAffiliated }`. `game_mode` omitted for classic profiles if Hypixel omits it. `name` is echoed nowhere.
- `GET /v1/profile/<name>/<profileId>` → `{ uuid, profileId, cute_name, hotm, essencePerks, pets, skills, slayer, fairySouls, accessoryBag, attributes, inventories, missing: [...], notAffiliated }`. Uses `/v2/skyblock/profile?profile=<id>` (single profile, smaller than the list) and reads **only the member `<uuid>`**: co-op members' data is never touched or returned. If the player is not a member of that profile: 404.
- Missing field (API settings off in game, or field not in profile): key left out, name listed in `missing`. If Hypixel answers `success:false` / the member has no data at all: 200 with everything in `missing`.
- Errors: 400 bad name/profileId, 404 unknown name (Mojang 204/404) or profile not found, 429 own limit (with `Retry-After`), 502 Hypixel/Mojang failure or Hypixel 429 (pass through `Retry-After`), 405 other methods. Body: `{ error, notAffiliated }`.

## Cache, limit, headers

- Cache keys (synthetic, lowercase name, no personal data in headers): `mojang/<name>` 1 day; `profiles/<uuid>` 1 h; `profile/<uuid>/<profileId>` 1 h. Only the trimmed response is stored, never the raw Hypixel body. Name→UUID is the one personal mapping that is cached; it expires after 1 day.
- Header `X-Cache: HIT|MISS` (and `X-Cache-Mojang` on lookups that miss), `Cache-Control: public, max-age=3600`.
- Order: method → path/validate → CORS → rate limit (counts hits too) → cache → upstream.
- CORS: exact match against `https://localhost`, `capacitor://localhost`, `http://localhost:<port>` (and per decision 3 the Pages origin). Others: no `Access-Control-Allow-Origin` (request still answered; browsers block). `Vary: Origin` always. OPTIONS answered with 204. CORS headers are added after the cache lookup so a cached response is never bound to one origin.
- No logging of names, UUIDs, IPs or the key. `console.error` only on upstream failure with status code and endpoint kind. `wrangler.toml` has `[observability]` off; `wrangler tail` still works.
- Key safety: `HYPIXEL_KEY` read only in `hypixel.js`, sent only as request header to `api.hypixel.net`, never echoed. A test asserts that a sentinel key value (`TEST_KEY_NOT_REAL`) never appears in any response body, header or error.

## CPU time (target < 10 ms, Free plan)

Waiting on `fetch` does not count as CPU; `JSON.parse` of the upstream body and `JSON.stringify` of the output do. My estimate: single-profile parse 3–10 ms for about 600 KB, so it is **borderline**, and the all-profiles list is worse (several members/profiles, can be several MB). Measures in the design:
- Endpoint 2 uses the single-profile Hypixel endpoint.
- Trim picks keys directly, no deep walks, no decoding, base64 strings passed through untouched.
- Cache hit path does no parse (stores and returns the stringified body).

How to measure: `docs/api-worker.md` plus `apps/api/scripts/measure.sh` (curl loop with a cache-busting step, `wrangler tail --format json` filtered to `cpuTime`/`wallTime` only, prints min/median/max; your name is read from an argument and never written to a file). Local pre-check in tests: a timing smoke test of `trim()` on the fixture (Node, informational, not a pass/fail gate because Node ≠ workerd).

If it exceeds 10 ms, alternatives, in order:
1. Trim the list endpoint to a regex/streaming pass: only `profile_id`, `cute_name`, `game_mode`, `selected` per profile (no full parse of members is possible with plain `JSON.parse`; needs a small hand scanner: more code, fragile).
2. Cache the list response longer / per UUID (already) and warm profile via the app on login only.
3. Workers Paid ($5/month: 30 s CPU limit; this is the plain fix).
4. Move parsing into the app: worker only proxies + caches the raw Hypixel body (breaks "no raw storage" and the size goals; not recommended).

## Tests (fixtures only, no network, no key)

- Fixture: derived from `personal/fixtures/profile-fixture.json` by a one-off script that keeps the key structure, replaces the UUID with `00000000-0000-4000-8000-000000000001` and the profile id/cute name with dummies, shortens maps to a few entries and base64 strings to small dummy strings, and drops everything not used. Script stays in `personal/` (not committed); only `apps/api/tests/fixtures/profile.anon.json` (a few KB) is committed. After generation I grep it for the real UUID and name.
- Test files: `trim.test.js` (every section; missing fields → `missing`; foreign member data absent; base64 passed through byte for byte; old `mining_core` format fallback), `validate.test.js` (3/16 chars, bad chars, UUID format), `errors.test.js` (404 / 429 / 502 / 405 via a fake `fetch`), `cors.test.js` (each allowed origin, a foreign one, OPTIONS, `Vary`), `cache.test.js` (key building, lowercase, TTLs, `X-Cache`), `secret.test.js` (sentinel key never leaks; header sent upstream only to `api.hypixel.net`).
- The worker takes `fetch`, cache and limiter via `env`/arguments so tests inject fakes; no `wrangler` needed to run `npm test`.

## Commits (each with green `npm test`)

1. `chore(api): scaffold apps/api` (package.json, wrangler.toml, .gitignore)
2. `feat(api): validation and CORS`
3. `feat(api): trim profile to the guide fields` + anon fixture
4. `feat(api): Mojang and Hypixel clients with error mapping`
5. `feat(api): cache and rate limit`
6. `feat(api): routes, headers, notAffiliated`
7. `docs(api): setup guide and CPU measure script`

Commit messages end with the standard Co-Authored-By line from the session. No version bump or changelog: no user-visible change in an app.

## Not doing / open risks

- No deploy, no secret handling by me, no `wrangler login`.
- Attribute and wardrobe locations are only verified against this one fixture; the first live check after your deploy confirms them (`missing` shows gaps).
- Hypixel's own limit (key-wide) is not handled beyond the cache and mapping its 429 to 502.
- The fixture's `skill_tree` (HOTM) format is new; the fallback to `mining_core` is untested against real old-format data (only a synthetic test).

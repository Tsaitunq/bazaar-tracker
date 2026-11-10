# API worker (`apps/api/`)

A small Cloudflare Worker that fetches SkyBlock profiles for the guide app. The Hypixel key lives only as the Worker secret `HYPIXEL_KEY`. It is never in the repo, in a log or in a test.

Not affiliated with or endorsed by Hypixel. Every response says so in `notAffiliated`.

## Endpoints

GET only, JSON.

| Path | Answer |
|---|---|
| `/v1/profiles/<name>` | `{ uuid, profiles: [{ id, cute_name, game_mode, selected }], notAffiliated }` |
| `/v1/profile/<name>/<profileId>` | Trimmed data of that player only: `hotm`, `essencePerks`, `pets`, `skills`, `slayer`, `fairySouls`, `accessoryBag`, `attributes`, `inventories`, `missing` |

- `<name>`: 3 to 16 characters, `A-Z a-z 0-9 _`. `<profileId>`: a UUID, with or without dashes.
- A field Hypixel does not send (usually: API settings off in game) is left out and listed in `missing`, e.g. `"inventories.wardrobe"`.
- `inventories.*` are the raw base64 strings of the profile (gzipped NBT). The worker does not decode them. The app does; the old reader is `nbt.js` in git history (`git show d349c31^:nbt.js`).
- Errors: `400` bad name or profile id, `404` unknown name / profile / not a member, `405` not GET, `429` too many requests (10 per 60 s per IP, `Retry-After: 60`), `502` Hypixel or Mojang failed (a `Retry-After` from upstream is passed on), `500` bug.
- Name to UUID: tries `api.minecraftservices.com`, then `api.mojang.com`, then `playerdb.co` (3 s each, User-Agent `progression-guides-api`). Only 404/204 means the name does not exist; 403, 429, 5xx or a timeout moves on to the next source. Mojang answered 403 from Cloudflare, hence the chain.
- Headers: `X-Cache: HIT|MISS` (answer), `X-Cache-Mojang: HIT|MISS` (name lookup).
- CORS: only `https://localhost`, `capacitor://localhost` and `http://localhost[:port]`.

### Where the data is in the Hypixel profile

All paths are `members.<uuid without dashes>.…`.

| Output | Source |
|---|---|
| `hotm` | `skill_tree` (`nodes`, `experience`, `tokens_spent`, `selected_ability`); old profiles: `mining_core` (`nodes`, `experience`, `tokens_spent`, `selected_pickaxe_ability`). Powder: `mining_core.powder_<mithril\|gemstone\|glacite>`, `_total`, `powder_spent_*` |
| `essencePerks` | `player_data.perks` |
| `pets` | `pets_data.pets[]` (`type`, `tier`, `exp`, `heldItem`, `active`) |
| `skills` | `player_data.experience` (`SKILL_*`) |
| `slayer` | `slayer.slayer_bosses.<boss>.xp` |
| `fairySouls` | `fairy_soul` (`total_collected`, `unspent_souls`, `fairy_exchanges`) |
| `accessoryBag` | `accessory_bag_storage` (`selected_power`, `tuning`, `highest_magical_power`) |
| `attributes` | `attributes.stacks` = shards applied per attribute, **not the level** (e.g. `rotten_pickaxe: 8` is level 2 Common, `freezing_spread: 32` is Epic max). The app converts it with the shard table per rarity from `gamedata/attributes.json`; the worker converts nothing. `shards.owned` (Hunting Box, `type` + `amount_owned`) is passed on as `attributes.huntingBox` |
| `inventories.inventory` | `inventory.inv_contents.data` |
| `inventories.armor` / `equipment` | `inventory.inv_armor.data` / `inventory.equipment_contents.data` |
| `inventories.wardrobe` | `loadout.armor.<n>.{HELMET,CHESTPLATE,LEGGINGS,BOOTS}.data`, `loadout.armor.equipped_set`; answer `{ equipped, sets: { <n>: { helmet, chestplate, leggings, boots } } }`, absent parts left out (checked 10.11.2026) |
| `inventories.equipmentWardrobe` | `loadout.equipment.<n>.EQUIPMENT_SLOT_1..4.data`, `loadout.equipment.equipped_set`; answer `{ equipped, sets: { <n>: { slot1..slot4 } } }` |
| `loadouts` | `loadout.loadouts.<n>.{armor_set_id, equipment_set_id}`; answer `[{ id, armorSet, equipmentSet }]` |
| `inventories.farmingToolkit` | `garden_player_data.farming_toolkit.<CROP>.<n>.data`; answer `{ <CROP>: [base64, ...] }` ordered by `<n>` |
| `inventories.personalVault` | `inventory.personal_vault_contents.data` |
| `inventories.accessoryBag` | `inventory.bag_contents.talisman_bag.data` |
| `inventories.enderChest` | `inventory.ender_chest_contents.data` |
| `inventories.storage` | `inventory.backpack_contents.<slot>.data`, as an object by slot |

## Setup, step by step

Needs Node 20 or newer. All commands run in `apps/api/`.

1. **Cloudflare account.** Sign up at dash.cloudflare.com (free). No domain needed.
2. **Install wrangler:** `npm install`
3. **Log in:** `npx wrangler login` (opens the browser, approve).
4. **Create the cache namespace:** `npx wrangler kv namespace create CACHE`. Copy the printed `id` into `wrangler.toml` instead of `REPLACE_WITH_KV_NAMESPACE_ID`. The id is not secret.
5. **Set the key:** `npx wrangler secret put HYPIXEL_KEY`. Paste the key at the prompt. Create it at developer.hypixel.net.
6. **Test once locally (optional):** `npm test` (fixtures only, no network). `npx wrangler dev` needs the key in `apps/api/.dev.vars` as `HYPIXEL_KEY=...`; that file is git-ignored. Do not commit it.
7. **Deploy:** `npx wrangler deploy` (name `progression-guides-api`, `workers_dev = true`, `preview_urls = false` are set in `wrangler.toml`). It prints the address, `https://progression-guides-api.<your-subdomain>.workers.dev`.
8. **Test with curl** (Windows PowerShell: `curl.exe`, plain `curl` is a different command):

   ```
   curl.exe -i https://progression-guides-api.<your-subdomain>.workers.dev/v1/profiles/<your-name>
   curl.exe -i https://progression-guides-api.<your-subdomain>.workers.dev/v1/profile/<your-name>/<profile-id>
   curl.exe -i -H "Origin: https://localhost" https://.../v1/profiles/<your-name>
   ```

   The second call of the same URL must say `X-Cache: HIT`. A bad name (`/v1/profiles/ab`) gives `400`. Eleven fast calls in a minute give `429`.

## CPU time (goal: under 10 ms on the Free plan)

`npm run measure -- https://<worker-url> <your-name> <profile-id>` starts `wrangler tail`, sends the profile calls twice each and prints status, cache state and CPU and wall time in ms. It prints no names or URLs and writes no file.

By hand: `npx wrangler tail --format json` in one terminal, a curl in another, read `cpuTime` in the output. Waiting for Hypixel is wall time, not CPU. Only a MISS parses and trims the big profile; a HIT should be about 1 ms.

To see a MISS again before the hour is over, delete your own entries: `npx wrangler kv key list --binding CACHE --remote`, then `npx wrangler kv key delete --binding CACHE --remote "<key>"` for each of your keys (they start with `profile:` / `profiles:`).

If a MISS is over 10 ms: Workers Paid ($5 a month) lifts the limit to 30 s and is the plain fix. Cheaper tricks (scan the list response by hand instead of `JSON.parse`) are more code and fragile; try them only if the Paid plan is not wanted.

## Live checklist (after the first deploy, with your own name)

- [x] **Attribute level.** Confirmed live: `attributes.stacks` is the number of shards applied; level comes from the app via the shard table.
- [x] **Wardrobe.** Found with `scripts/probe-nbt.mjs`: `loadout.armor` (checked 10.11.2026). `rift.inventory.*` is deliberately not taken.
- [ ] **HOTM.** `hotm.nodes`, `experience`, `selectedAbility` match the in-game Heart of the Mountain; `powder` matches the powder shown in game.
- [ ] **Single-profile endpoint.** Hypixel may no longer serve `/v2/skyblock/profile`. The worker then falls back to the full list (bigger parse). Check CPU for both profile calls; if the fallback is used, the first call is slower.
- [x] **CPU time** of every MISS under 10 ms (see above). Measured live (own profile): median 1.29 ms, max 2 ms. The Free plan is enough.
- [ ] **`missing`.** Switch an API setting off in game (e.g. inventory), wait one hour or clear the KV key, call again: the field must be gone and listed in `missing`.
- [ ] **KV limit.** Free plan: 1,000 KV writes per day. Past that the worker still answers, only without cache (`X-Cache: MISS` every time).

## Probe tools

In `apps/api/`, key from the git-ignored `.dev.vars`. They print no values, names or UUIDs.

- `node scripts/probe-inventory.mjs <name> [profile-id]`: key names under `inventory`.
- `node scripts/probe-nbt.mjs <name> [profile-id]`: every path in the member that holds item data, plus key paths containing ward, loadout, preset, equip, armor or set.
- `node scripts/probe-items.mjs <name> [profile-id]`: decodes `inv_armor`, `equipment_contents` and one armor and one equipment wardrobe set, and prints the NBT key paths with value types for the 4 richest items of each. Also up to 2 drills (id contains DRILL) from the inventory, ender chest and backpacks. The only value printed is the item id. Imports `apps/guide/nbt.js`.

## What is stored

Only KV cache entries: name to UUID for 1 day (key `mojang:<lowercase name>`), trimmed answers for 1 hour (keys `profiles:<uuid>`, `profile:<uuid>:<profile id>`). KV keys are visible to you in the Cloudflare dashboard. The IP is only used as a hash for the rate limit. The worker logs nothing about names, UUIDs or IPs; errors log only the service and a status code.

## Later

Custom domain, if the app grows: then the Cache API (instead of KV) is an option too. The Rate Limiting binding only allows 10 or 60 second windows.

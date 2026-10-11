# Image sources

## Item pictures (hotlinked)

`https://sky.coflnet.com/static/icon/<item id>`, loaded at run time and kept
by the service worker. Source and licence: see below.

## Minion heads (stored in `icons/minions/`)

22 files, `<minion key>.png`, 64 × 64 px, 3 to 8 kB each (about 130 kB in
all; `inferno.png` added on 2026-10-11 as `INFERNO_GENERATOR_1`). Downloaded once on 2026-10-11 from the same source as the item pictures,
`https://sky.coflnet.com/static/icon/<NAME>_GENERATOR_1` (the tier I minion
item of the Hypixel items API, e.g. `TARANTULA_GENERATOR_1`), unchanged. They
are part of the app shell (`SHELL` in `sw.js`) and so of the APK.

| Question | Answer |
|---|---|
| Where do the files come from | sky.coflnet.com (Coflnet), as for all item pictures |
| Licence of that source | **not confirmed.** The page https://sky.coflnet.com/data says nothing about the icons, their origin, a licence or attribution; a search found no statement either |
| Who owns the artwork | the pictures show Hypixel SkyBlock items drawn with Minecraft textures: the rights lie with Hypixel Inc. and Mojang/Microsoft, not with Coflnet or with this project |
| Attribution | not required by anything found; the app footer already names sky.coflnet.com as the source of the icons |
| Commercial use | not allowed to assume. This project is free and non-commercial; if it ever earns money, the icons need the rights holders' permission or a replacement |
| Alternative | the SkyBlock wiki (hypixelskyblock.minecraft.wiki) has minion pictures (`Tarantula_Minion_I.png`, renders). Its content is "licensed under CC BY-NC-SA 3.0; additional terms may apply" (page footer): attribution, non-commercial, share-alike; the extra terms (wgmeta:Licensing, Image Policy) were not readable. Not used, because the project rule is to use the existing icon source first |

If the licence of the icon source turns out to be a problem, the files in
`icons/minions/` can be deleted and `minionTile` in `render.js` can fall back
to the item picture of the drop (`tile(row.id)`).

# Blaze-Werte: was die App heute rechnen kann (Paket C, Teil 1)

Nur Analyse. Der private Guide (178 Schritte, davon 174 mit `detect`, 4 manuelle ohne) ist hier nicht abgedruckt: nur Kategorie, ID, Schrittnummer (Reihenfolge in der Datei) und "Wert vorhanden ja/nein, woher". Die 174 Schritte haben 177 Detect-Teile; eine Zeile unten zählt Teile.

Quellen im Code: `optimizer.js` (`stepDelta`, `blazeDelta`), `optimizer-data.js` (Enchants, Reforges, Gems), `blaze.js` (Dolche, Sharpness/Smoldering/One For All, Dominus), `stats.js` (Pets), `virtual.js`, `guide/gear.js`, `gamedata/*.json`, `personal/items.json` (nur lokal).

## Übersicht

| Kategorie | Teile | Wert vorhanden | Lücke |
|---|---|---|---|
| Item mit Stats (Rüstung, Schwerter, Equipment, Accessoires) | 38 | ja, `items.json` (Basis-Lore, keine Sterne/HPB) | – |
| Item ohne Dauer-Stat (Utility) | 12 | nicht nötig | siehe Utility |
| Enchant | 84 | 20 ja, 18 bewusst "kein Stat", 46 nein | siehe Enchants |
| Reforge | 7 | ja (Wiki-Tabellen) | Zielplatz-Prüfung offen |
| Gem | 1 | ja (`GEMS.OPAL`) | – |
| Potato Book | 0 Schritte | nein, kein Modell | nur über Blaze-Pet-Perk relevant |
| Pet | 5 | teilweise (`stats.js`, nicht `gamedata/pets.json`) | Blaze unvollständig, Perks fehlen |
| Set-Bonus | 0 Schritte | nein, nur Dominus fest codiert | Crimson 2/3/4 Teile, Blaze-Set |
| Attribut | 24 | 8 mit Stat-Effekt, 16 leer | siehe Attribute |
| Power | 3 | ja (`gamedata/power.json`) | – |
| Fähigkeit (Scroll) | 3 | nein (kein Code-Pfad) | vermutlich kein Dauer-Stat |
| Manuell ohne `detect` | 4 | – | nur gezählt |

Ein Schritt hat im Guide kein `gain`-Feld. Fällt ein Teil durch (`null`), bleibt der Schritt ohne Stat-Gewinn.

## Items (Kategorie Item, 50 owned-Teile)

Alle 104 IDs der owned-Schritte stehen in `items.json`. 16 davon haben dort keine `stats`:

| Schritte | ID | Art | Wert | Woher |
|---|---|---|---|---|
| 34–38, 177 | Deployables (Flares, Power Orbs) | Utility | nein, kein Dauer-Stat | `items.json` ohne `stats` |
| 40, 41 | MOODY_GRAPPLESHOT, WEIRD_TUBA, WEIRDER_TUBA | Utility | nein | ohne `category` und `stats` |
| 45 | 4 Wands (Healing, Mending, Restoration, Atonement) | Utility | nein | ohne `stats` |
| 20 | RIFT_NECKLACE_INSIDE, RIFT_NECKLACE_OUTSIDE | Equipment | nein | ohne `stats` |
| 48 | NETHER_ARTIFACT | Accessoire | nur Magical Power | `accessoryPower` |
| 49 | WITHER_RELIC | Accessoire | nur Magical Power | `accessoryPower` |

Mit Stats (ja): Rüstung Schritte 1–5, 7–9; Schwerter 13–18, 39, 43, 44, 176, 178; Equipment 19, 21–33; Accessoires 46, 47, 50, 51. Dolche laufen über `blaze.js` (`DAGGERS`, Multiplikator je Dolch).

Stat-Schlüssel der Items, die `gamedata/stats.json` nicht kennt: `WALK_SPEED` (5 Items), `HEALTH_REGENERATION` (9 Items). `stats.json` hat `HEALTH_REGEN`. Die Blaze-Stats (`AREA_STATS.blaze`) enthalten beide nicht.

## Enchants (84 Teile)

| Enchant-ID | Level | Schritte | Wert | Woher |
|---|---|---|---|---|
| critical | 5, 6, 7 | 81–83 | ja | `ENCHANTS.critical` |
| growth | 5, 6, 7 | 112–114 | ja | `ENCHANTS.growth` |
| protection | 5, 6, 7 | 115–117 | ja | `ENCHANTS.protection` |
| prosperity | 1–5 | 129–133 | ja | `ENCHANTS.prosperity` |
| true_protection | 1 | 126 | ja (nur Brustplatte) | `ENCHANTS.true_protection` |
| sharpness | 5, 6, 7 | 76–78 | ja (Schadensmodell) | `blaze.js` `SHARPNESS` |
| smoldering | 5 | 111 | ja (Schadensmodell, additiv ist Annahme) | `blaze.js` `SMOLDERING` |
| ultimate_one_for_all | 1 | 142 | ja (Schadensmodell) | `blaze.js` `OFA_ADDITIVE` |
| life_steal | 3, 4, 5 | 95–97 | bewusst kein Stat | `ENCHANTS_NO_STAT` |
| looting | 3, 4, 5 | 98–100 | bewusst kein Stat | `ENCHANTS_NO_STAT` |
| vampirism | 5, 6 | 109, 110 | bewusst kein Stat | `ENCHANTS_NO_STAT` |
| rejuvenate | 1–5 | 118–122 | bewusst kein Stat (Health Regen nicht in Blaze-Stats) | `ENCHANTS_NO_STAT` |
| transylvanian | 4, 5 | 124, 125 | bewusst kein Stat | `ENCHANTS_NO_STAT` |
| quantum | 3, 4, 5 | 134–136 | bewusst kein Stat | `ENCHANTS_NO_STAT` |
| pyroclasm | 5, 6 | 79, 80 | nein | nicht in den Tabellen |
| execute | 5, 6 | 84, 85 | nein | – |
| fire_aspect | 2, 3 | 86, 87 | nein (laut `LEFT_OUT` nicht modelliert) | – |
| giant_killer | 5, 6, 7 | 88–90 | nein | – |
| gravity | 5, 6 | 91, 92 | nein | – |
| lethality | 5, 6 | 93, 94 | nein | – |
| smite | 5, 6, 7 | 101–103 | nein | – |
| thunderlord | 5, 6, 7 | 104–106 | nein (laut `LEFT_OUT` nicht modelliert) | – |
| triple_strike | 4, 5 | 107, 108 | nein | – |
| strong_vitality | 10 | 123 | nein | – |
| cayenne | 4, 5 | 127, 128 | nein | – |
| ultimate_swarm | 1–5 | 137–141 | nein | – |
| ultimate_chimera | 1–5 | 143–147 | nein | – |
| ultimate_last_stand | 1–5 | 148–152 | nein | – |
| ultimate_refrigerate | 1–5 | 153–157 | nein | – |
| ultimate_habanero_tactics | 4, 5 | 158, 159 | nein | – |

Zählung: 15 Tabellen-Stats + 5 Schadensmodell = 20 ja; 18 bewusst kein Stat; 46 nein.

## Reforges (7 Teile)

| Schritt | Reforge-ID | Ziel | Wert | Woher |
|---|---|---|---|---|
| 160 | fabled | Waffen | ja | `REFORGES.fabled` (Wiki Sword) |
| 161 | withered | Waffen | ja | `REFORGES.withered` |
| 162 | coldfused | Waffen | ja, Wisp-Bonus nur mit Wisp-Pet | `REFORGES.coldfused`, `COLDFUSED_WISP` |
| 164 | ancient | Rüstung | ja | `REFORGES.ancient` |
| 165 | strengthened / glistening | Necklace, Gloves | ja | `REFORGES` |
| 166 | blood_soaked | Cloak | ja | `REFORGES` |
| 167 | bloodshot | Belt | ja | `REFORGES` |

Ob jede Tabelle zum Zieltyp (Rüstung, Necklace, Cloak, Belt, Gloves) gehört, ist aus dem Code nicht ablesbar.

## Gem (1 Teil)

Schritt 6: OPAL, PERFECT, 8 Slots auf den Infernal-Teilen. Wert ja (`GEMS.OPAL`, `GEM_STAT.OPAL` = TRUE_DEFENSE, COMBAT-Slots zugelassen).

## Pets (5 Teile)

| Schritt | Pet-ID | Wert | Woher |
|---|---|---|---|
| 10 | LION | teilweise | `stats.js` `PETS.LION`: nur Strength 0,5 je Level |
| 11, 175 | BLAZE | teilweise | `PETS.BLAZE`: nur Defense 0,3 je Level; Attack Speed und Intelligence fehlen |
| 12 | GOLDEN_DRAGON | teilweise | `PETS.GOLDEN_DRAGON`: nur ab Level 101 |
| 163 | DROPLET/FROST/GLACIAL/SUBZERO_WISP | ja (Health, True Defense) | `PETS` WISP |

`gamedata/pets.json` hat nur die 8 Mining-Pets. Blaze steht nicht darin. Pet-Perks werden nirgends gerechnet. `petItem` (Crochet Tiger Plushie) hat keinen Rechenpfad.

## Attribute (24 Teile)

Fünf Schlüssel im Guide weichen von `attributes.json` ab, sind aber über das Shard-Item im Schritt eindeutig zuzuordnen (keine fehlenden Daten, nur ein Mapping):

| Schritt | Guide-Schlüssel | Shard im Schritt | Schlüssel in `attributes.json` |
|---|---|---|---|
| 58 | humanoid_ruler_new | SHARD_WETWING | humanoid_ruler |
| 59 | undead | SHARD_ZOMBIE_SOLDIER | undead_ruler |
| 66 | blazing | SHARD_FLARE | infernal_ruler |
| 72 | fortitude | SHARD_ENDSTONE_PROTECTOR | unlimited_fortitude |
| 75 | life_regeneration | SHARD_SHINYFISH | help_from_above |

Mit Stat-Effekt in `attributes.json` (8):

| Schritt | Attribut | Effekt | Bedingung |
|---|---|---|---|
| 71 | attack_speed | Attack Speed +1 je Level | immer |
| 69 | veil | True Defense +1 je Level | immer |
| 53–56 | undead_, blazing_, skeletal_, airborne_resistance | Defense +4 je Level | vs_mob_family |
| 64, 65 | flying_fortune, subterranean_fortune | Magic Find +0,5 je Level | vs_mob_family |

Leer (`effects: []`), also kein Wert in den Daten (16): skeletal_ruler (52), mana_steal (57), humanoid_ruler (58), undead_ruler (59), combo (60), airborne_ruler (61), lifeline (62), ignition (63), infernal_ruler (66), shell (67), warrior (68), dominance (70), unlimited_fortitude (72), payback (73), elite (74), help_from_above (75).

## Power (3 Teile)

hurtful, shaded, strong: ja, `gamedata/power.json` (Stat-Basis aus Wiki-Wert bei 250 Magical Power, abgeleitet).

## Fähigkeit (Scroll, 3 Teile)

Schritt 42: IMPLOSION_SCROLL, WITHER_SHIELD_SCROLL, SHADOW_WARP_SCROLL. Wert nein, es gibt keinen Code-Pfad (`partOf` liefert `null`). Vermutlich keine Dauer-Stats.

## Set-Bonus

Kein Schritt trägt einen Set-Bonus. Im Code: `blaze.js` rechnet Dominus (+100 % additiv, ab 2 Infernal-Teilen); `optimizer.js` vermerkt beim vierten Crimson-Teil "Set bonus not fully rated". Das Blaze-Set und die anderen Crimson-Stufen haben keine Werte.

## Potato Book

Kein Schritt, kein Modell (kein `hot_potato`/HPB im Code). Relevant wird es durch "Fusion-Style Potato" des Blaze-Pets.

## stats.json: Kategorien (Punkt 4)

Die Datei hat kein Feld `category`. Es gibt nur `areas` (`mining`, `combat`, `farming`, `general`), geprüft von `guide/gamedata.js`. Eine Kategorie "Miscellaneous" fehlt.

`combat` (16): STRENGTH, CRITICAL_DAMAGE, CRITICAL_CHANCE, ATTACK_SPEED, HEALTH, DEFENSE, TRUE_DEFENSE, DAMAGE, INTELLIGENCE, FEROCITY, ABILITY_DAMAGE, HEALTH_REGEN, VITALITY, MENDING, SWING_RANGE, COMBAT_WISDOM.

`general` (15, gemischt): SPEED, MAGIC_FIND, PET_LUCK, TRACKING, TREASURE_CHANCE, FISHING_SPEED, SEA_CREATURE_CHANCE, PRESSURE_RESISTANCE, RESPIRATION, FORAGING_FORTUNE, SOCIAL_WISDOM, ENCHANTING_WISDOM, ALCHEMY_WISDOM, FORAGING_WISDOM, FISHING_WISDOM.

Vorschlag (nicht bestätigt, im Spiel gegenprüfen): ein Feld `category` mit `combat` (wie oben), `misc` und `mining`/`gathering`/`wisdom`.

- `misc`: SPEED, MAGIC_FIND, PET_LUCK, TRACKING, TREASURE_CHANCE, FISHING_SPEED, SEA_CREATURE_CHANCE, PRESSURE_RESISTANCE, RESPIRATION, COLD_RESISTANCE, HEAT_RESISTANCE, BONUS_PEST_CHANCE.
- Wisdoms in eigene Gruppe: COMBAT_WISDOM, MINING_WISDOM, FARMING_WISDOM, FORAGING_WISDOM, FISHING_WISDOM, SOCIAL_WISDOM, ENCHANTING_WISDOM, ALCHEMY_WISDOM.
- Fortune-Stats nach Gewerk (mining/farming/foraging).

Für Nether Embodiment zählen sofort relevant: aus dem Guide die Item-Stats MAGIC_FIND (11 Items) und FORAGING_WISDOM (3 Items). WALK_SPEED und HEALTH_REGENERATION fehlen in `stats.json`.

## Shard-Köpfe (Punkt 5)

Alle sieben Shards gibt es im NEU-Repo, als `items/ATTRIBUTE_SHARD_<NAME>;1.json`. Sie haben aber keinen Skull: `itemid` ist ein Block bzw. ein Vanilla-Skull ohne `SkullOwner`. Deshalb findet `fetch-icons.mjs` keinen Kopf. Die ID-Schreibweise ist nicht das Problem.

| Icon | NEU-Datei (nur `;1` existiert) | `itemid` |
|---|---|---|
| SHARD_LAPIS_ZOMBIE | ATTRIBUTE_SHARD_EXPERIENCE;1 | minecraft:sea_lantern |
| SHARD_MINER_ZOMBIE | ATTRIBUTE_SHARD_ROTTEN_PICKAXE;1 | minecraft:diamond_block |
| SHARD_FLORA | ATTRIBUTE_SHARD_FLORA;1 | minecraft:double_plant |
| SHARD_GLACITE_WALKER | ATTRIBUTE_SHARD_ICE_ESSENCE;1 | minecraft:packed_ice |
| SHARD_WITHER | ATTRIBUTE_SHARD_WITHER_ESSENCE;1 | minecraft:skull (damage 1, Wither-Skelett) |
| SHARD_OBSIDIAN_DEFENDER | ATTRIBUTE_SHARD_SPEED;1 | minecraft:obsidian |
| SHARD_ZOMBIE_SOLDIER | ATTRIBUTE_SHARD_UNDEAD;1 | minecraft:skull (damage 2, Zombie) |

Vorschlag zum späteren Einbau: Texturen aus dem Client-JAR (`sea_lantern`, `diamond_block`, `packed_ice`, `obsidian`, `double_plant`-Textur), für die beiden Skulls das Mob-Gesicht aus `entity/…`. Noch nicht eingebaut.

## Fragenliste

Alles, was weder aus den Item-Daten noch dem NEU-Repo sicher abzuleiten ist.

Blaze-Pet
1. Stats bei Lv 100: Defense +30, Attack Speed +35, Intelligence +100. Skalieren Attack Speed und Intelligence linear mit dem Level (wie Defense 0,3 je Level)? Ist die +35 Attack Speed des Pets dieselbe wie die des Plushies, oder zwei getrennte +35?
2. Gelten die Werte nur bei Legendary? Die Pet-Item-Werte (Crochet Tiger Plushie und weitere) brauchen eine Tabelle.
3. Nether Embodiment (+10 %): Welche Stats genau gehören zu "Combat" und "Miscellaneous"? Gilt der Multiplikator auf die Summe aller Quellen (Items, Pet, Power, Attribute) oder nur auf Gear? Wird er vor oder nach anderen Multiplikatoren gerechnet? Soll die App Crimson Isle immer annehmen (Blaze Slayer läuft dort)?
4. Bling Armor (+40 %): Welche Teile zählen als "altes Blaze-Set" (Blaze Helmet/Chestplate/Leggings/Boots, auch Frozen Blaze)? Welche Stats und Fähigkeitswerte hat das Blaze-Set, die in `items.json` nicht stehen?
5. Fusion-Style Potato: Wie viele Hot Potato Books zählen pro Teil (Waffe/Rüstung), und welche Stats geben sie je Slot? Stecken die HPB-Boni schon in den eingegebenen /stats-Werten? Zählen Fuming Potato Books auch doppelt?

Set-Boni
6. Crimson-Set: Boni und Werte für 2/3/4 Teile je Stufe (Crimson, Hot, Burning, Fiery, Infernal). Dominus ist als +100 % additiv ab 2 Infernal-Teilen codiert (Wiki-Annahme "gemischte Sets nicht beschrieben"). Stimmt das?
7. Gibt es weitere Set-Boni in den Guide-Schritten (Power Wither, Frozen Blaze, Reaper Mask, Warden, Sorrow)?

Enchants
8. Pro Enchant der Liste "nein" (pyroclasm, execute, giant_killer, gravity, lethality, smite, triple_strike, cayenne, strong_vitality): Ist der Effekt ein Stat je Level, ein Schadensmultiplikator gegen Mobtyp oder kein Dauer-Stat? Wert je Level, falls Stat.
9. Ultimates (swarm, chimera, last_stand, refrigerate, habanero_tactics): Wert je Level und Art des Effekts. Chimera wirkt auf Pet-Stats, das wäre im Blaze-Pet-Modell relevant.
10. Rejuvenate, Strong Vitality, Vampirism, Life Steal: Sollen Health Regen und Vitality in die Blaze-Stats? Dann müssen `AREA_STATS.blaze` und der Schlüssel `HEALTH_REGENERATION` (Items) gegen `HEALTH_REGEN` (`stats.json`) angeglichen werden.
11. Smoldering und Sharpness: Stapeln sie additiv (heute Annahme in `blaze.js`)?

Reforges, Gems, Items
12. Stimmen die Tabellen aus `optimizer-data.js` für den jeweiligen Zielplatz (Rüstung, Necklace, Cloak, Belt, Gloves, Waffe)? Withered, Fabled und Coldfused sind als Sword-Tabelle erfasst.
13. Zählen Sterne/Master Stars, Enrichments und Accessoire-Reforges? `items.json` enthält nur Basis-Stats (kein Item im Blaze-Guide hat `tiered_stats`).
14. Utility-Items (Flares, Orbs, Wands, Tubas, Grapple, Rift-Necklaces): Bestätigung, dass sie keinen Dauer-Stat geben. Nether Artifact und Wither Relic: nur Magical Power?
15. Was ist WALK_SPEED (5 Items): gleich dem Stat Speed?

Attribute und Scrolls
16. Für die 16 leeren Attribute: Welche geben einen Stat, welche einen Schadens-/Defense-Bonus gegen Mobfamilien? Werte je Level.
17. `vs_mob_family` (Defense, Magic Find): Gilt das für Blaze-Slayer-Bosse (welche Familien)? Sonst zählt es nicht als Dauer-Stat.
18. Die fünf Schlüssel-Abweichungen (Tabelle oben) bestätigen.
19. Scrolls (Implosion, Shadow Warp, Wither Shield): reine Fähigkeiten ohne Dauer-Stat?

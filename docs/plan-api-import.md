# Plan: API-Import in der Guide-App

Branch `feat/api-import` (von `main`). Nur Plan, nichts umgesetzt. Danach kleine Commits, Tests nach jedem grün, Git-Identität `Tsaitunq`, kein Push und kein Merge ohne Auftrag. Der Hypixel-Key bleibt allein im Worker; die App kennt ihn nie.

Worker: `https://progression-guides-api.tsaitunq.workers.dev`, Endpunkte und Felder in `docs/api-worker.md`.

## Entscheidungen (Antworten auf die offenen Fragen)

1. Import nur in der Android-App; kein CORS für github.io.
2. Item-Format per `scripts/probe-items.mjs` bestätigt (siehe unten); der Probe-Lauf ist Sache des Besitzers.
3. Importierte Gear-Haken ohne Datum (Standard), Schalter "seit der Messung dazugekommen". Rüstung, Waffen und Equipment stecken nie in der Messung (ohne Gear gemessen); das Datum betrifft nur Accessories und Essence.
4. Powder als `build.hotm.powder`, im HOTM-Tab angezeigt.
5. Pet-Level-Tabelle (XP je Level, Offset je Seltenheit) in `gamedata/pets.json`; Level aus XP.
6. "Letzten Import zurücknehmen": ein Schritt zurück, alle Änderungen des Imports.
7. "Profil-Daten löschen" löscht Name und Zusammenfassung, nicht Haken, Build und Messungen.
8. Fremde Namen erlaubt, aber nur ein gespeicherter Stand. Beim Wechsel des Namens Bestätigung "Ersetzt deinen bisherigen Import-Stand"; Anwenden fragt extra, wenn der Name nicht der gespeicherte eigene ist.
9. Doku englisch (dieser Plan bleibt deutsch).
10. Omelette (`upgrade_module`): nur vorschlagen, nichts automatisch setzen.

### Befunde des Probe-Laufs (Item-NBT, 10.11.2026)

- Format ist `tag.ExtraAttributes`; `components` (`item_model`, `tooltip_style`) wird ignoriert.
- Gems: Objekt `gems.AMBER_0 = { quality, uuid }` oder nur String `gems.JADE_0 = "PERFECT"`. `gems.unlocked_slots` = freigeschaltete Slots (Slot ohne Eintrag = frei). Feste Slots `<TYP>_<n>` tragen den Typ im Namen; Slots `MINING_`, `COMBAT_`, `UNIVERSAL_`, `DEFENSIVE_`, `OFFENSIVE_` tragen ihn in `<SLOT>_gem`.
- `rarity_upgrades` (Zahl) = Recombobulator, nur das zählt als `recomb`. `upgraded_rarity` (Text, z. B. Safari Belt Epic→Mythic) ist ein anderes Seltenheits-Upgrade, wird gelesen und hebt die Seltenheit an. `modifier` = Reforge. `donated_museum`, `timestamp`, `uuid`, `SkullOwner`, `display` werden nicht gespeichert.
- Drill-Teile in zwei Formen: `drill_part_engine|fuel_tank|upgrade_module` (Text) und `engine|fuel_tank|upgrade_module.id` (Objekt). `upgrade_module` = Omelette. `polarvoid` = Anzahl Bücher; `divan_powder_coating` wird gelesen (im Probe nicht vorhanden); `compact_blocks`, `drill_fuel` ignoriert.
- Das getragene Set ist im Wardrobe leer (getragen steht in `inv_armor`); `probe-items.mjs` übersprang deshalb zuerst alle Sets. Der Import liest die Wardrobe über `inventories.wardrobe.sets.<n>` und rechnet das getragene Set aus `armor` dazu.

## 0. Was schon da ist (Bestandsaufnahme)

Der Import muss wenig neu erfinden. Er ist ein Adapter vor Mechanik, die schon läuft:

- `apps/guide/detect.js`: Schritt-`detect` (Arten `owned`, `enchant`, `gem`, `reforge`, `recomb`, `coating`, `polarvoid`, `scroll`, `part`, `pet`, `held`, `petItem`, `perk`, `essence`, `power`, `hotm`, `attr`, `coll`, `skill`) gegen ein Profil der Form `{ items: [{ id, enchants, reforge, recomb, coating, polarvoid, scrolls, gems: [{type, quality}], parts, where, sets }], pets, perks, powers, attrs, collTiers, skills, missing }`. Das ist exakt die Form, die der alte `profile.js` (`git show d349c31^:profile.js`, Funktion `summarize`/`readItem`) lieferte. `detectGuide` kennt schon: Slot-Gruppen (bestes Item je Slot), Nachfolger erfüllt Vorgänger, nie umgekehrt.
- `apps/guide/owned.js`: Item-Schritte (`item:`) sind geteilte Besitz-Ticks (`pg.owned`), `idsToOwn` liefert, was ein Haken ergänzt.
- `apps/guide/keys.js`: geteilte Schlüssel (`gem:`, `enchant:`, `reforge:`, `recomb:`, `part:`, `polarvoid:`, `coating:`, `pet:` …) in `pg.keys`, `commitGuide` schreibt Haken guide-übergreifend.
- `apps/guide/model.js`: `autoOf` (abgeleitete Schritte ohne Haken), `tickStep`.
- `apps/guide/build.js`: `build` = `{ hotm, attrs, power, essence, buffs, pet, gear }`, `null` = unbekannt. `setPart` füllt beim ersten Setzen eines Teils alle Mess-Snapshots mit dem Wert nach (siehe Abschnitt 5). `editPart`/`commitDraft` sind die Schreibwege.
- `apps/guide/totals.js`: Summe = Basis (typed / Multiplikator des Snapshots) + (Build jetzt − Build im Snapshot) + Gear, dann Multiplikator.
- `gamedata/attributes.json` (`shardsPerLevel` je Seltenheit, `attributes[].key/rarity/maxLevel`), `hotm.json` (Perk-IDs wie `mining_speed`, `tier`, `type`), `essence-perks.json`, `power.json`, `pets.json`.
- `apps/api/tests/fixtures/profile.anon.json` (anonymisiertes Profil), `apps/api/scripts/probe-nbt.mjs` (druckt nur Pfade, keine Werte).
- Alter Stand in der Git-Historie: `nbt.js` (90 Zeilen), `tests/nbt.test.js`, `tests/fixtures/nbt-encode.js` (schreibt NBT für Tests), `profile.js`.

Neu gebaut werden müssen: Netz-Client, Profil-Auswahl, Item-Leser (aktualisiert), Vorschlags-Logik (Diff), Vorschlags-Bildschirm, Einstellungen, Löschen.

Einschränkung: Der Worker erlaubt CORS nur für `https://localhost`, `capacitor://localhost`, `http://localhost[:port]`. Die installierte Android-App (Capacitor) funktioniert, die PWA auf github.io nicht. Dort zeigen die Einstellungen "Import nur in der Android-App" statt eines Fehlers (siehe Frage 1).

## 1. Einstellungen

Neuer Abschnitt "Profil-Import" in `views/settings.js` (gleiche `panel`-Optik):

1. Feld Minecraft-Name. Client-Prüfung vor jedem Netzaufruf: 3–16 Zeichen, `A-Za-z0-9_` (gleiche Regel wie der Worker, ein Treffer spart eine 400-Antwort und ein Rate-Limit-Token).
2. Knopf "Profile laden" → `GET /v1/profiles/<name>`. Antwort `{ uuid, profiles: [{ id, cute_name, game_mode, selected }] }`. Auswahlliste mit `cute_name` (+ Spielmodus als Zusatz), `selected` vorausgewählt. Gespeicherte Profil-ID bleibt, solange sie in der Liste vorkommt; sonst fällt es auf `selected` zurück mit Hinweis.
3. Knopf "Neu laden" → `GET /v1/profile/<name>/<id>`. Daneben der Hinweis: "Daten können bis zu 1 Stunde alt sein (Server-Cache). Neu laden holt nichts Frischeres, wenn der Cache noch gilt." Zeitstempel "Zuletzt geladen: …" (Gerätezeit des Abrufs).
4. Fester Text: "Not affiliated with or endorsed by Hypixel." (der Worker liefert `notAffiliated`; die App zeigt den festen Text, damit er auch offline da ist).
5. "Profil-Daten löschen" (Abschnitt 6).

Zustände und Meldungen (Text für Spieler, kein Fachjargon):

| Fall | Anzeige | Verhalten |
|---|---|---|
| Offline (`fetch` wirft, `navigator.onLine === false`) | "Offline. Zeige den Stand vom <Datum>." | Letzter gespeicherter Stand bleibt benutzbar; Knopf bleibt klickbar |
| 400 (sollte die Client-Prüfung verhindern) | "Name oder Profil ungültig." | |
| 404 | "Spieler oder Profil nicht gefunden, oder du bist kein Mitglied dieses Profils." | Auswahl bleibt, alter Stand bleibt |
| 429 | "Zu viele Anfragen. Nochmal in <Retry-After> s." | Knopf für diese Zeit deaktiviert |
| 502 | "Hypixel oder Mojang antwortet gerade nicht. Später nochmal." | Retry-After des Servers anzeigen, falls vorhanden |
| 500 / unbekannt / kaputtes JSON | "Der Import hat gerade ein Problem." | |
| `missing` nicht leer | "Im Spiel ist die API für <Bereich> aus: <Liste>." | Nur diese Bereiche ohne Vorschlag, kein Fehler |

Nichts davon blockiert die App: Alle Aufrufe sind `async` mit `AbortController` (10 s), in `try/catch`, ändern keinen Zustand bei Fehlern und laufen nur auf Knopfdruck. Kein Aufruf beim Start, kein Hintergrund-Abruf, keine Pflicht, den Import je zu nutzen. Beim App-Start wird höchstens der gespeicherte Stand gelesen.

## 2. NBT lesen in der App

### 2.1 Rückholen und prüfen

1. `git show d349c31^:nbt.js > apps/guide/nbt.js`; Test und Hilfe mit zurückholen: `tests/nbt.test.js` → `tests/guide/nbt.test.js`, `tests/fixtures/nbt-encode.js` → `tests/fixtures/guide/nbt-encode.js`.
2. Prüfen (Review des 90-Zeilers vor dem Commit):
   - Längen- und Tiefen-Prüfung vorhanden (`count`, `MAX_DEPTH = 64`); `__proto__` wird verworfen; Longs jenseits des sicheren Bereichs bleiben Strings.
   - `inflate` bricht bei `MAX_INFLATED` (20 MiB) ab, `reader.cancel()` wird aufgerufen.
   - Sizes: Typ 7 (Byte-Array) nutzt `SIZE[1]`, Typ 11/12 über `many(3|4, …)` – stimmen mit `SIZE` überein.
   - Offen zu prüfen: `view.getInt8(take(1))` für Tag-Typ; `string()` liest Modified-UTF-8 über `TextDecoder` (Surrogate/Null-Zeichen werden anders kodiert, für IDs egal, für Namen mit Sonderzeichen nur kosmetisch).
   - Gesamtbudget: 18 Backpacks + Ender Chest + Wardrobe 9+ Sets + … können viel zusammenkommen. Zusätzlich eine Summenobergrenze über alle Inventare eines Abrufs (z. B. 100 MiB entpackt), danach Abbruch mit Hinweis.
3. **Item-Format verifizieren, bevor Mapping gebaut wird.** Der alte `readItem` liest `raw.tag.ExtraAttributes` (altes 1.8-Format). Ob Hypixel das 2026 noch so sendet, ist nicht belegt. Schritt 0 der Umsetzung: `probe-nbt.mjs` gegen das eigene Profil; Struktur nur als Schlüsselpfade notieren (keine Werte, keine Namen), daraus eine anonyme Fixture mit `nbt-encode.js` bauen. Ist das Format ein anderes (Komponenten), passt nur `readItem` an; alles darüber bleibt.
4. Dekodieren: `atob` → `Uint8Array` → `DecompressionStream('gzip')` (Chrome 80+, Android-WebView ab 80 vorhanden; Node 18+ hat es global, also testbar ohne Zusatz). Ergebnis: Liste `i` der Slots.
5. Dekodieren läuft nacheinander, nicht parallel, mit `await` zwischen Inventaren (Oberfläche bleibt bedienbar). Ein kaputtes Inventar kostet nur dieses Inventar (alter Stand: `skipped`-Zähler), nur "gar nichts lesbar" bricht den Lauf ab.

### 2.2 Quellen

Aus der Worker-Antwort `inventories.*`:

| Worker-Feld | Fundort-Text in der App |
|---|---|
| `armor`, `equipment` | "Getragen" |
| `inventory` | "Inventar" |
| `wardrobe.sets.<n>.helmet…boots`, `wardrobe.equipped` | "Wardrobe Set <n>"; ist `equipped` = n, zusätzlich "getragen" |
| `equipmentWardrobe.sets.<n>.slot1..4` | "Equipment-Set <n>" |
| `loadouts[]` (`armorSet`, `equipmentSet`) | verknüpft Sets, Anzeige "Loadout <id>"; kein eigener Item-Speicher |
| `accessoryBag` | "Accessory Bag" |
| `enderChest` | "Ender Chest" |
| `storage.<slot>` | "Backpack <slot+1>" (Spiel zählt ab 1; der alte Code tat dasselbe) |
| `personalVault` | "Personal Vault" |
| `farmingToolkit.<CROP>[n]` | "Farming-Toolkit <Crop>" |

Dasselbe Item an zwei Orten (gleiche `uuid`) zählt einmal, bleibt aber in jedem Fundort gelistet (alter Mechanismus `seen`/`sets`). Die `uuid` wird nur im Speicher zum Deduplizieren benutzt, nie gespeichert.

### 2.3 Daten pro Item

Gespeichert wird nur das, was die Detect-Arten brauchen (keine Lore, keine Namen, keine uuid, keine Rohdaten):

| Feld | Quelle im Item (Format-Stand alt, siehe 2.1.3) |
|---|---|
| `id` | `ExtraAttributes.id` (Hypixel-ID) |
| `enchants` | `enchantments` (Name → Stufe) |
| `gems` | `gems`: je Slot `{ type, quality }`; Typ aus `<SLOT>_gem` oder aus dem Slot-Namen, Qualität als Text oder `{ quality }`; nicht `unlocked_slots`. Zusätzlich `unlocked_slots` als Zahl (für "Slot offen/frei") |
| `reforge` | `modifier` |
| `recomb` | `rarity_upgrades > 0` |
| `hpb`, `fuming` | `hot_potato_count` (1–10 = HPB, 11–15 = Fuming) |
| `stars` | `upgrade_level` oder `dungeon_item_level` |
| `parts` | `drill_part_engine`, `drill_part_fuel_tank`, `drill_part_upgrade_module` (Omelette liegt als Modul-Teil vor) |
| `polarvoid` | `polarvoid` |
| `coating` | `divan_powder_coating` (Powder Coating) |
| `scrolls` | `ability_scroll`, `power_ability_scroll` |
| `where`, `sets`, `bag`, `slot` | aus der Quelle (2.2) |

Bewusst weggelassen: `parseLore` des alten Codes (Stats aus der Lore). Das war die Quelle von Fehler 16 (API-Stats ≠ manuelle /stats). Zahlen kommen weiter nur aus der manuellen Messung (Abschnitt 5, 7).

## 3. Abbildung auf die App

Ein neues reines Modul `apps/guide/import/profile.js` macht aus der Worker-Antwort die **Profil-Zusammenfassung** (Form wie in Abschnitt 0, plus `hotm`, `powderInfo`, `huntingBox`, `fetchedAt`, `profileName`). Danach läuft `detectGuide` unverändert. Alles Weitere sind Funktionen, die nur lesen und eine Liste von Vorschlägen liefern.

### 3.1 Guide-Schritte

- Jeder Schritt mit `detect` wird mit `detectStep`/`detectGuide` gegen die Zusammenfassung geprüft → `{ have, need }`. `have === need` → Vorschlag "Haken setzen". `0 < have < need` → Teilfortschritt anzeigen (z. B. "3/4 Teile"), kein Haken. Kein Detect oder keine Daten → kein Vorschlag, bleibt manuell. "Nichts gefunden" ist kein "Nein" (vorhandene Regel `Nothing owned stays out`).
- Der Vorschlag nennt den **Fundort** (aus `where`/`sets`/`bag` der Items, die den Schritt tragen): "Wardrobe Set 3", "Backpack 5", "Getragen". Dafür liefert `detectStep` zusätzlich `at: [Fundorte]` (kleine Erweiterung des Rückgabewerts, rückwärtskompatibel).
- Schreibweg: Item-Schritte (`item:`) → IDs nach `pg.owned` (`idsToOwn`); Schritte mit geteiltem Schlüssel (`gem:`, `enchant:`, `reforge:`, `recomb:`, `part:`, `polarvoid:`, `coating:` …) → Schlüssel nach `pg.keys` (`commitGuide`); Schritte ohne Schlüssel → `pg.checks`. Das ist derselbe Weg wie `tickStep`, also gelten alle bestehenden Regeln (Nachfolger erfüllt Vorgänger, Reset, Datum).

### 3.2 Stats-Seite

| Bereich | Quelle → Ziel | Anmerkung |
|---|---|---|
| HOTM | `hotm.nodes` (Perk-ID → Stufe) → `build.hotm.levels`; Tier aus `experience` über `HOTM_XP`/`levelOf` (`requires.js`) → `build.hotm.tier`; `selected_ability` → `build.hotm.ability` (nur wenn die ID in `hotm.json` ein `ability` ist); abgeschaltete Perks (falls die Nodes `toggle_*` führen) → `build.hotm.disabled` | Perk-IDs des Spiels gegen `gamedata/hotm.json` prüfen (46 Perks); Unbekannte zählen und im Vorschlag als "n unbekannte Einträge" nennen, nicht still verwerfen |
| Powder | `powder_<art>`, `_total`, `powder_spent_*` | Nur Info im Vorschlags-Bildschirm und als Chips im HOTM-Tab ("verfügbar" = gesamt − ausgegeben). Kein neues Build-Feld in Version 1 (Frage 4) |
| Essence-Perks | `essencePerks` → `build.essence` | IDs gegen `essence-perks.json`; Stufe auf `max` kappen |
| Attribute | `attributes.stacks[key]` → Level, → `build.attrs[key]` | `stacks` sind eingesetzte Shards, **nicht** das Level. Level = größtes L, für das die Summe der ersten L Einträge von `shardsPerLevel[rarity]` ≤ stacks ist, gekappt auf `maxLevel`. Prüfung gegen die Doku: `rotten_pickaxe: 8` (Common: 1, 3, 5 → kumuliert 1, 4, 9) = Level 2; `freezing_spread: 32` (Epic: kumuliert … 32 bei Stufe 10) = Level 10. Rarität kommt aus `attributes.json` (`attributes[].rarity`), die App nimmt nichts vom Worker an. Unbekannter Schlüssel → zählen, nicht werfen. `attributes.huntingBox` (Typ + `amount_owned`) → Info "noch einsetzbar: n Shards" je Attribut, ohne Einfluss auf Level |
| Magical Power | `accessoryBag.highest_magical_power` → `build.power.mp` | |
| Power Stone | `accessoryBag.selected_power` | **Nur Vorschlag/Anzeige**, nie Teil von "Alle übernehmen". Eigener Knopf "Als Auswahl übernehmen". Die Zuordnung API-Name → `power.json`-ID ist unbelegt und gehört in die Fixture-Prüfung |
| Tuning | `accessoryBag.tuning` → `build.power.tuning` | Stat-Schlüssel gegen `power.tuning.stats` abgleichen |
| Pets | `pets[]` (`type`, `tier`, `exp`, `heldItem`, `active`) → komplette Liste in der Zusammenfassung; Pets-Tab zeigt "Aus dem Profil" (Typ, Seltenheit, XP, getragenes Item, aktiv) | Level aus XP nur, wenn die Tabelle vorliegt (Frage 5); sonst XP zeigen. `pet:`/`petitem:`/`held` Schritte laufen über `detect` wie in 3.1 |

### 3.3 Manuelle Auswahl bleibt

Power Stone und Pet pro Guide (`build.power.stone`, `build.pet`, Pet-Item) werden vom Import **nie** gesetzt. Der Import zeigt "Im Profil aktiv: <Pet>, <Power Stone>" und bietet je einen Einzel-Knopf an. Das Pet ist Gear, nicht Basis (`setPet`), daher gibt es dort keine Doppelzählung.

## 4. Vorschlags-Bildschirm

Neuer Bildschirm `views/import.js`, erreichbar aus den Einstellungen und (wenn Daten da sind) mit einem Hinweis-Chip auf Home/Stats. Aufbau, nach Bereich gegliedert:

1. HOTM
2. Attribute
3. Essence
4. Pets
5. Power (MP, Tuning; Power Stone nur als Info)
6. Gear, je Guide und dort je Kategorie/Abschnitt (zusammenklappbar, mit Zähler "7 neu")

Jede Zeile hat einen Status gegen den **jetzigen App-Stand**:

| Status | Bedeutung | Aktion |
|---|---|---|
| neu | API sagt ja, App hat es nicht | Haken/Wert wird vorgeschlagen, einzeln wählbar |
| anders | Wert existiert, weicht ab (z. B. Attribut 7 vs. 9) | Alt → Neu anzeigen, einzeln wählbar |
| gleich | stimmt überein | ausgegraut, keine Aktion |
| Konflikt | API sagt nein / weniger, App-Haken ist gesetzt | **nur anzeigen**, keine Aktion, nie entfernen |

Regeln:
- Nichts passiert ohne Bestätigung. Auswahl per Kontrollkästchen je Zeile oder "Alle übernehmen" je Bereich (wirkt nur auf "neu" und "anders", nicht auf "Konflikt", nicht auf Power Stone/Pet-Auswahl).
- Bestehende manuelle Haken werden nie entfernt. "anders" bei Zahlen ersetzt den Build-Wert nur auf ausdrücklichen Wunsch (Zeile angehakt), und nur nach der Messungs-Regel aus Abschnitt 5.
- Ein Vorschlag ist eine Liste von Änderungen als reine Daten (`{ area, kind, key, from, to, where }`). Anwenden = diese Liste durch bestehende Schreibfunktionen schicken, in **einem** `save`-Block (ein Zustand, ein Speichern), danach Rückmeldung "n Haken gesetzt, m Werte übernommen". Rückgängig-Hinweis: Reset je Guide existiert schon; ein "Letzten Import zurücknehmen" ist nicht geplant (Frage 6).
- Kopfzeile: Minecraft-Name, Profilname (`cute_name`), "Stand von <Zeit>, kann bis zu 1 Stunde alt sein", "Not affiliated with Hypixel".

## 5. Messung: keine Doppelzählung

Ausgangslage: Die Basis (typed /stats-Wert) enthält alles, was beim Messen schon galt, auch HOTM, Attribute, Essence. `totals.js` addiert nur die Differenz Build jetzt − Build im Snapshot. Doppelzählung entsteht genau dann, wenn der Build etwas bekommt, das im Basiswert schon steckt, aber im Snapshot fehlt.

Die vorhandene Mechanik deckt den Hauptfall ab, der Plan erweitert nur die Ränder:

1. **Teil unbekannt (`null`) im Build und im Snapshot:** Import schreibt über `setPart`/`editPart` (nie direkt in `build`). `setPart` füllt dabei alle Snapshots, in denen das Teil noch `null` ist, mit demselben Wert nach. Differenz = 0, nichts wird doppelt gezählt. Das ist der Normalfall beim ersten Import.
2. **Teil bekannt, Snapshot bekannt, Import weicht ab:** Das ist entweder eine echte spätere Änderung (Delta richtig) oder eine veraltete/falsche Eingabe (Delta falsch). Der Import kann das nicht unterscheiden. Daher: nur anzeigen und bestätigen lassen, mit Text "Seit deiner Messung am <Datum> geändert? Dann zählt der Unterschied als Änderung seit der Messung."
3. **Messung jünger als der Datenstand:** Der API-Stand ist bis zu 1 h (Server) + 5 min (Client-Cache) alt. Liegt eine Messung des Bereichs weniger als 70 Minuten vor dem Abruf, könnte die Messung neuer sein als die API-Werte. Dann würde ein Import den Build auf einen **älteren** Stand setzen und ein negatives Delta erzeugen. Regel: In diesem Fenster sind abweichende Werte für diesen Bereich gesperrt, mit Text "Deine Messung ist neuer als die Profil-Daten. Später nochmal laden." Neue (vorher `null`) Teile bleiben erlaubt (Fall 1).
4. **Gear-Haken aus dem Import:** `gearOf`/`accessoryGain` werten das Datum eines Hakens gegen `measuredAt`: Haken ohne Datum gelten als "älter als die App", also in der Basis enthalten; Haken mit Datum nach der Messung zählen als neuer Gewinn. Ein Import-Haken für Gear, das schon vor der Messung getragen wurde, darf nicht als "neu seit der Messung" zählen. Vorschlag: Importierte Haken bekommen **kein** Datum (= vor der Messung, in der Basis). Das unterzählt, wenn man ein Stück wirklich erst nach der Messung gekauft hat; dafür nie doppelt. Ein Schalter im Bildschirm "Diese Haken sind seit meiner Messung dazugekommen" setzt das Datum auf den Importzeitpunkt (Frage 3).
5. **Messung wird zum optionalen "Abgleich":** Sobald Hotm, Attribute, Essence, Power (MP/Tuning) bekannt sind (Import) und Gear aus Haken kommt, kann die App die Summe aus bekannten Quellen selbst rechnen (`statsOf(build)` + Gear). Die Basis aus /stats deckt zusätzlich alles ab, was die App nicht kennt (Skill-Level, Bestiary, Level-Boni, Buffs, Pets-Details, Events …). Der "Abgleich" wird deshalb so definiert: Nutzer tippt den /stats-Wert **T** ein; die App rechnet **M** = Modell aus dem aktuellen Build + Gear und speichert **D = T − M** als "Sonstige Quellen". Danach gilt Gesamt = M(jetzt) + D. Das ist mathematisch dasselbe wie die heutige Formel mit Snapshot = Build zum Zeitpunkt des Abgleichs, nur dass der Snapshot nicht mehr vom Nutzer gepflegt, sondern vom (importierten, geprüften) Build gezogen wird. Technisch: `measure()` bleibt (Snapshot = `structuredClone(build)`), der Bildschirm heißt "Abgleich", zeigt pro Stat T, M, D, und markiert D als "sonstige Quellen". Ohne Abgleich zeigt die Stats-Seite "aus bekannten Quellen: <M>, sonstige Quellen unbekannt" statt einer vollständig aussehenden Summe. Die Messung bleibt weiter möglich und wird nie erzwungen.
6. **Kein Import-Gesamtwert aus der API:** Gemäß Fehler 16 rechnet die App keine Stats aus API-Einzelteilen außer über die vorhandenen, getesteten Modelle (`statsOf`); keine Lore-Stats, keine `parseLore`.
7. Der Import-Zeitpunkt (`fetchedAt`) und der Messzeitpunkt (`entry.at`) werden gespeichert und im Bildschirm genannt, damit der Nutzer die Reihenfolge nachvollziehen kann.

## 6. Datenschutz

- Alles bleibt auf dem Gerät (`localStorage`, wie `pg.*`): `pg.api` = `{ name, profileId }`, `pg.profile` = die Zusammenfassung (nur Felder aus 2.3 und 3.2, Zeitstempel `fetchedAt`).
- Nur **ein** Profil gleichzeitig. Wechsel des Namens oder Profils ersetzt die Zusammenfassung; es gibt keine Liste von Spielern, keinen Verlauf, keinen Cache fremder Profile. Die Profilliste (`/v1/profiles/<name>`) wird nur im Speicher gehalten.
- Gespeichert werden **nicht**: Roh-Base64, uuid der Items, Lore, Item-Namen, Namen von Loadouts, Mojang-UUID des Spielers.
- Zusätzlich: Die Zusammenfassung ist nicht Teil von `exportData` (Export/Import von Fortschritt). Test dafür.
- "Profil-Daten löschen" (Einstellungen, mit Bestätigung): entfernt `pg.api` und `pg.profile` (und einen offenen Vorschlag). Haken, Build, Messungen bleiben (das ist Fortschritt des Nutzers, nicht Profil-Cache). Ein eigener Knopf "Alles zurücksetzen" existiert nicht; je Guide gibt es Reset (Frage 7).
- Keine Protokollierung des Namens (kein `console.log` mit Name/UUID), keine Analytics. Fehlermeldungen enthalten keinen Namen.
- Der Worker speichert laut `api-worker.md` nur KV-Cache (Name→UUID 1 Tag, Profil 1 Stunde). Das steht im Hinweistext der Einstellungen ("Dein Name wird an den Worker gesendet, der bei Hypixel nachfragt und das Ergebnis eine Stunde zwischenspeichert").
- Name eines **anderen** Spielers: technisch möglich (der Worker kann es nicht ausschließen). Die App speichert trotzdem nur einen Stand und überschreibt beim Wechsel (Frage 8).
- Keine personenbezogenen Namen in Fixtures, Tests, Commits (Repo-Regel); Tests nutzen die anonymisierte Fixture.

## 7. Risiken aus der alten API-Version (`personal/sources/detection-errors.md`) und Gegenmaßnahmen

| # | Fehler damals | Maßnahme in diesem Plan |
|---|---|---|
| 1–3 | Bone Necklace, Shadow Assassin Cloak, Adaptive Belt nicht erkannt: Equipment-Speicher falsch gelesen / ID-Mapping | Equipment (`equipment`, `equipmentWardrobe`) als eigene Quellen (2.2). Regressionstest mit je einem Stück aus Equipment, Wardrobe-Equipment und Backpack. ID-Mapping nur über Hypixel-IDs, nie Namen |
| 4 | Sharpness etc. nicht abgehakt, weil ein Dagger One For All hat | Regel: Hat die Waffe OFA, gelten die Einzel-Enchant-Schritte dieser Waffe als "ersetzt durch OFA" (übersprungen, nicht offen). Test mit OFA-Dolch. Prüfen, ob `detect` das schon kann; sonst kleine Regel in `detectStep` (`enchant` mit `one_for_all`) |
| 5–6 | Enchants/Gems einer anderen Drill zählen für X555 | Schritt "auf Item X" zählt nur, wenn auf genau diesem Item gefunden (Item-Slot-Gruppen, `itemPart`). Vorgänger in derselben Linie höchstens als Teil-Hinweis "übernimmt beim Forgen". Test mit Jasper-Drill ohne X555 |
| 7, 14 | Rüstungs-Schritte wurden nicht abgehakt, obwohl 3 von 4 Teilen erfüllt | Schritte je Teil (Helmet/Chestplate/Leggings/Boots), Fortschritt "3/4" sichtbar (`have/need` ist vorhanden). Gem-Slot-Schritte: freie/gesperrte Slots aus `unlocked_slots` lesen |
| 8, 15 | Kombi-Schritte ("Titanium-Equipment + Blazing Reforge", "Divan's Boots with Perfect Topaz") | In den Guide-Daten getrennt (Item, Reforge, Gem), verbunden per Gruppe. Test, dass kein importierter Guide einen Schritt mit gemischten Detect-Arten hat, der nicht einzeln abhakbar ist |
| 9–13 | Besitz des Vorgängers hakte den Nachfolger ab (Pendant of Divan statt Titanium Necklace …); höhere Stufe erfüllte niedrigere nicht | Richtung festgelegt: **Nachfolger erfüllt Vorgänger, nie umgekehrt** (`detectGuide` läuft rückwärts, `impliedDone`). Test für Titanium-Linie und DR-X455 → X355 |
| 16 | HOTM-/API-Stats stimmten nicht mit /stats überein | Keine Stat-Berechnung aus API-Einzelteilen außer den getesteten Modellen; keine Lore-Stats; Zahlen aus der Messung/dem Abgleich (Abschnitt 5). HOTM-Werte kommen als Stufen, nicht als Stats |

Neue Risiken dieser Version:
- Doppelzählung (Abschnitt 5) → `setPart`-Rückfüllung, Sperrfenster, Haken ohne Datum.
- Item-Format ändert sich oder weicht ab (2.1.3) → `readItem` ist die einzige Stelle, Fixtures aus echter Struktur.
- Veraltete Daten → Zeitstempel überall, "bis zu 1 h alt".
- Unbekannte IDs (neue Perks/Attribute) → zählen und anzeigen, nie still verwerfen, nie abstürzen.
- Speicherplatz (`localStorage` ca. 5 MB): Zusammenfassung ist klein (Items gefiltert), `save` meldet Fehler wie bisher (`false`), dann bleibt der Stand für die Sitzung.
- Große Inventare blockieren die Oberfläche → sequentielles Dekodieren mit `await`, Budget (2.1.2).

## 8. Tests (nur Fixtures, kein Netz)

Neue Tests in `tests/guide/`; `fetch` wird immer durch eine Funktion ersetzt, die Fixture-Antworten liefert. Kein Test ruft Hypixel oder den Worker auf (Repo-Regel).

1. `nbt.test.js` (zurückgeholt, erweitert): alle Tag-Typen, Länge zu groß, Tiefe > 64, Abbruch bei zu wenig Daten, `__proto__`, Long außerhalb des sicheren Bereichs, gzip-Bombe über `MAX_INFLATED`, Summenobergrenze.
2. `import-items.test.js`: `readItem` gegen NBT-Fixtures (Enchants, Gems mit/ohne `_gem`-Schlüssel, Reforge, Recomb, HPB/Fuming, Sterne, Drill-Teile, Polarvoid, Coating); Fundorte je Quelle; Dedup per uuid; kaputtes Inventar → `skipped`, nicht Abbruch; nichts lesbar → Fehler, alter Stand bleibt.
3. `import-profile.test.js`: Worker-Fixture (aus `profile.anon.json` + kodierte Inventare) → Zusammenfassung; `missing` → Bereich ohne Vorschlag, kein "Nein".
4. `import-attrs.test.js`: Stacks → Level über kumulierte Shard-Tabelle (`rotten_pickaxe: 8` → 2; `freezing_spread: 32` → 10; 0 → 0; mehr als nötig → Max; unbekannter Schlüssel gezählt).
5. `import-propose.test.js`: Status neu/anders/gleich/Konflikt; Konflikt entfernt nie einen Haken; "Alle übernehmen" lässt Konflikt und Power Stone/Pet aus; Anwenden ändert genau die angehakten Zeilen.
6. `import-regressions.test.js`: je ein Test pro Punkt 1–16 aus `detection-errors.md` (Abschnitt 7).
7. `import-measure.test.js`: Import eines `null`-Teils verändert Gesamt nicht (Snapshot gefüllt); Abweichung bei bekanntem Snapshot erzeugt Delta nur nach Bestätigung; Sperrfenster (Messung < 70 min vor Abruf); importierter Haken ohne Datum zählt nicht als Gewinn; Abgleich: D = T − M, Gesamt = M + D.
8. `import-api.test.js` (Client mit Fake-`fetch`): 404/429 (mit `Retry-After`)/502/500, kaputtes JSON, Timeout, Offline, Namensprüfung vor dem Aufruf; kein Zustand ändert sich bei Fehlern.
9. `import-privacy.test.js`: gespeicherte Zusammenfassung enthält keine Schlüssel wie `uuid`, `lore`, `data`; `exportData` enthält sie nicht; "Profil-Daten löschen" entfernt `pg.api` und `pg.profile`, lässt Haken/Build/Messung stehen.
10. `guide-sw.test.js` (besteht): neue Dateien stehen in `SHELL` von `apps/guide/sw.js`.
11. Ansichten: `guide-views.test.js`-Stil für Einstellungen (Abschnitt, Hinweise, Meldungen) und Vorschlags-Bildschirm; `guide-css.test.js` verlangt Farb-Tokens, keine festen Farben.

## 9. Commits, Reihenfolge

Nach jedem Commit `npm test` grün. Jeder Commit endet mit der Pflichtzeile `Co-Authored-By`.

1. `docs: plan for the API import` (diese Datei).
2. `feat(guide): restore nbt.js with tests` (`nbt.js`, `nbt.test.js`, `nbt-encode.js` aus `d349c31^`; Review-Änderungen aus 2.1.2).
3. `chore(api): note the item format from the probe` (nur Doku/Fixture-Form, wenn 2.1.3 ein anderes Format zeigt).
4. `feat(guide): read items from inventories` (`import/items.js`, Fundorte, Tests 2).
5. `feat(guide): profile summary from the worker answer` (`import/profile.js`, Tests 3, 4, Attribut-Umrechnung).
6. `feat(guide): API client with errors and offline` (`import/api.js`, Tests 8).
7. `feat(guide): import settings` (Name, Profilwahl, Neu laden, Hinweise, Löschen; Tests 9, 11).
8. `feat(guide): proposals for gear steps` (Diff, `at`-Erweiterung in `detect.js`, Regressionen 6).
9. `feat(guide): proposals for HOTM, attributes, essence, power, pets` (3.2, Tests 5).
10. `feat(guide): import screen` (4; `sw.js` `SHELL`, CSS-Tokens).
11. `feat(guide): measurement guard and Abgleich` (Abschnitt 5; Tests 7).
12. `docs: changelog 0.15.0 and API import notes` (`apps/guide/changelog.json`, `docs/STRUCTURE.md`/`SUMMARY.md`).

## Offene Fragen an dich

1. PWA auf github.io: Der Worker erlaubt dort kein CORS (frühere Entscheidung). Soll der Import nur in der Android-App laufen (Plan), oder soll `https://tsaitunq.github.io` doch erlaubt werden?
2. Item-Format: Ich kann die Struktur erst mit deinem Probe-Lauf (nur Schlüsselpfade) bestätigen. Soll ich im Umsetzungsschritt `probe-nbt.mjs` selbst starten (braucht deinen Key in `.dev.vars` und dein Ja), oder schickst du mir die Pfadliste?
3. Importierte Gear-Haken: Standard "kein Datum" (zählt als schon in der Messung enthalten, kann unterzählen) oder Standard "seit der Messung dazugekommen" (kann doppelt zählen)? Plan: erstes, mit Schalter.
4. Powder: Nur als Info im HOTM-Tab, oder als neues Build-Feld (`build.hotm.powder`) für spätere Kosten-Rechnungen?
5. Pet-Level: Es gibt eine Pet-Tabelle für Stats, aber (soweit gesehen) keine XP-Level-Tabelle je Seltenheit. Soll ich sie aus dem Wiki in `gamedata/pets.json` ergänzen, oder genügt die XP-Anzeige?
6. Soll es nach dem Anwenden "Letzten Import zurücknehmen" geben, oder reicht Reset je Guide?
7. "Profil-Daten löschen": Reicht es, Name + Zusammenfassung zu löschen, während Haken/Build/Messungen bleiben (Plan)?
8. Soll die App verhindern oder warnen, wenn ein fremder Name eingegeben wird, oder ist das egal, solange nur ein Stand gespeichert wird?
9. Doku-Sprache: Dieser Plan ist deutsch, `plan-api-worker.md` englisch. Soll ich die Umsetzungs-Doku (STRUCTURE/SUMMARY, Changelog) englisch halten (Plan: ja)?
10. Omelette: `drill_part_upgrade_module` und `build.hotm.omelette` sind zwei Dinge. Soll ein Drill mit Omelette-Modul den Build-Schalter nur vorschlagen, oder gar nichts setzen?

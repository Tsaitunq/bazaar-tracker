# Spec: Upgrade-Optimizer im Progress-Reiter

Stand: 2026-10-31. Status: freigegeben, Fragen aus Abschnitt 10 beantwortet. Es ist noch nichts gebaut.

Belegstufen in dieser Spec:

- **[geprüft]**: am 2026-10-31 selbst gemessen (Testabruf ohne Key oder Repo-Stand).
- **[Doku]**: steht in der offiziellen Hypixel-Doku oder im Wiki (hypixelskyblock.minecraft.wiki).
- **[nicht bestätigt]**: stammt aus Fremdquellen oder ist eine Herleitung. Muss in Paket 1 mit einem echten Abruf geprüft werden.

## 0. Ziel und Umfang

Der Progress-Reiter beantwortet heute: "Was ist der nächste Schritt laut Guide, und was kostet er?" Der Optimizer beantwortet: "Welcher offene Schritt bringt mir mit meinem aktuellen Stand am meisten pro Coin?"

**Festgelegt durch den Auftrag:**

- Bereiche: Mining (gemischte, anpassbare Gewichtung) und Blaze Slayer T4 (schnellere Kills, Mindestbedingungen ca. 140 True Defense und Mindest-MP laut Guide).
- Profil: Coop, normal, Bazaar/AH nutzbar. Eigenes Mitglied erkennen, Auswahl falls mehrere Profile.
- Persönlicher Key nur auf dem Gerät, Abruf nur per Knopf "Sync profile".
- API-Nutzung: Stats ermitteln, Guide-Schritte automatisch abhaken, HOTM und Collections als Voraussetzungen prüfen.

**Erfolgskriterien:**

1. Nach einem Sync sind erkennbare Guide-Schritte abgehakt, ohne dass manuelle Haken verloren gehen.
2. Die berechneten Stats weichen höchstens 5 % vom eingegebenen `/stats`-Wert ab, oder die Abweichung wird angezeigt.
3. Pro Guide gibt es eine Rangliste "Zugewinn pro 1M Coins", die sich nach Sync, Haken und Preisänderung neu berechnet.
4. Key und Profildaten verlassen das Gerät nur in Richtung `api.hypixel.net`.

**Bewusst nicht enthalten:** Abruf im Hintergrund, Sync in der Browser-Version, Coop-Mitglieder bewerten, Netzworth, Dungeon-Stats, weitere Slayer, Kombinations-Optimierung über mehrere Schritte (siehe 5.3).

**Wichtigste Designentscheidung:** Die Rangliste braucht keine perfekte Stat-Berechnung. Item-Stats kommen aus dem Lore-Text der Items, und der eingegebene `/stats`-Wert ist bei Bedarf die Basis. Berechnet werden muss vor allem das *Delta* eines Upgrades. Das spart den Nachbau des kompletten Stat-Systems (Abschnitt 3).

## 1. API und Key

### 1.1 Key-Typ

**Empfehlung: Personal API Key über eine eigene Application im [Developer Dashboard](https://developer.hypixel.net).**

| Typ | Passt? | Beleg |
|---|---|---|
| Personal | **Ja.** "Suitable for individual, non-monetized projects" | [Doku] `/create` |
| Production | Nein. Für Monetarisierung, Team-Verwaltung und höhere Limits; verlangt ausführliche Prüfung und bei Web-Projekten eine eigene Domain | [Doku] |
| Development | Nur vorübergehend zum Entwickeln. Läuft ab und ist nicht für Dauerbetrieb gedacht | [Doku] Policy; Laufzeit 72 h laut älterer Wiki-Revision [nicht bestätigt] |

Regeln aus den [API Policies](https://developer.hypixel.net/policies), die das Design direkt betreffen:

- "Do not include your API key in your code, especially if you plan to distribute a binary." Der Key wird daher nur zur Laufzeit eingegeben.
- "Do not share your API key with 3rd parties, such as entering them into a website or a mod." Das Eingeben in die eigene App auf dem eigenen Gerät fällt nicht darunter. Die Sync-UI erscheint trotzdem nur im privaten Progress-Bereich, damit die öffentliche App andere nicht zur Key-Eingabe auffordert.
- Eine Application pro Projekt. Mehrere Keys zum Umgehen von Limits sind verboten.
- Daten sollen gecacht werden. Ein Sync pro Knopfdruck und ein Cooldown (1.3) erfüllen das.
- **Inaktivität: Eine Application ohne Anfragen in den ersten 14 Tagen oder über 28 Tage kann deaktiviert oder gelöscht werden.** Das widerspricht in der Praxis "nur per Knopfdruck", wenn lange nicht synchronisiert wird. Daher zeigt die App ab 21 Tagen seit dem letzten Sync einen Hinweis. Automatische Abrufe gibt es weiterhin nicht.

**Ablauf des Personal Keys:** Die aktuelle Doku nennt keine Frist. Die Policy spricht nur von "longer expiration developer keys" für Besitzer genehmigter Applications; eine ältere Wiki-Revision sagt, ein Personal Key laufe nicht von selbst ab [nicht bestätigt]. Die App behandelt Ablauf deshalb als normalen Fehlerfall (1.7), Dauergültigkeit wird nicht vorausgesetzt.

**Limits:** Die Doku sagt nur "maximum amount of requests per 5 minute intervals" und nennt keine aktuelle Zahl. Die Wiki-Revision nennt 300 pro 5 Minuten [nicht bestätigt]. Ein Sync braucht nur eine Anfrage, also ist die genaue Zahl unkritisch. Die App liest bei einer 429-Antwort `RateLimit-Reset` und verwendet nie eine fest eingebaute Zahl.

### 1.2 Endpunkte

| Zweck | Endpunkt | Key | Häufigkeit |
|---|---|---|---|
| Profile und alle Member-Daten | `GET /v2/skyblock/profiles?uuid=…` | ja | pro Sync |
| Item-Basisdaten | `GET /v2/resources/skyblock/items` | nein | Snapshot-Job |
| Skill-Tabellen | `GET /v2/resources/skyblock/skills` | nein | Snapshot-Job |
| Collection-Stufen | `GET /v2/resources/skyblock/collections` | nein | Snapshot-Job |

Alle Member-Daten kommen aus diesem einen Abruf. Separate Endpunkte für Inventare, HOTM oder Collections gibt es nicht [Doku].

Die Antwort von `/resources/skyblock/items` ist 4,8 MB groß [geprüft]. Der Snapshot-Job verdichtet sie deshalb zu einer `items.json` nach dem vorhandenen Muster (`forge.json`, `recipes.json`), mit nur diesen Feldern: `id, name, category, sword_type, tier, stats, tiered_stats, gemstone_slots, requirements, prestige, museum_data.parent`. Das sind reine Spieldaten ohne Bezug zum Profil.

**UUID statt Name:** Mojangs Namensauflösung sendet keine CORS-Header [geprüft]. Damit dafür weder eine neue Native-Methode noch ein Fremddienst nötig ist, gibt der Nutzer die UUID einmalig in den Settings ein (mit oder ohne Bindestriche, beides akzeptiert die API [Doku]).

### 1.3 Profilwahl

1. Aus `profiles[]` nur Profile, in denen `members[uuid]` vorkommt und `members[uuid].profile.deletion_notice` fehlt.
2. Nur normale Profile, also `game_mode` fehlt. `ironman`, `bingo` und `stranded` werden nicht angeboten.
3. Vorauswahl: Profil mit `selected: true` [nicht bestätigt: Bedeutung im Coop]. Bei mehreren Treffern erscheint eine Auswahl nach `cute_name` mit Mitgliederzahl. Die Wahl wird per `profile_id` gemerkt.
4. **Daten der Coop-Mitspieler werden sofort verworfen** und nie gespeichert, nur `members[uuid]` bleibt. Das ist auch eine Datenschutzfrage, denn die Antwort enthält fremde Inventare.

Nach einem Sync gilt ein Cooldown von 60 Sekunden, weil Hypixel Profildaten serverseitig zwischenspeichert [nicht bestätigt].

### 1.4 In-Game-Einstellungen

Pfad: SkyBlock-Menü, Settings, API Settings [Doku, ältere Quelle; Menüname kann abweichen]. Die Einstellungen gelten pro Profil und stehen standardmäßig auf "No" [Doku].

| Einstellung | Nötig für |
|---|---|
| API: Inventory | Rüstung, Equipment, Waffen, Accessories, Auto-Abhaken |
| API: Collections | Collection-Voraussetzungen |
| API: Skills | Skill-Stats |

Museum und Banking werden nicht gebraucht. Für Pets und HOTM ist in den gefundenen Quellen keine Einstellung genannt [nicht bestätigt].

### 1.5 Abruf aus der Capacitor-WebView

**Entscheidung: normales `fetch` aus der WebView, kein CapacitorHttp.**

Die API antwortet mit `access-control-allow-origin: *`. Der Preflight erlaubt `access-control-allow-headers: API-Key`, auch mit `Origin: https://localhost` [geprüft]. CapacitorHttp ist also für diesen Abruf unnötig. Einschalten würde zudem `fetch` und XHR der ganzen App auf native Bibliotheken umstellen [Doku], also auch alle vorhandenen Abrufe.

Geprüfte Alternative: Java führt den Abruf aus, und der Key berührt nie JavaScript. Das ist etwas sicherer, bringt aber eigenen HTTP-Code und schickt mehrere MB über die Capacitor-Bridge. Abgelehnt, weil die WebView nur lokale Dateien lädt und der Key nur für die Dauer des Abrufs im Speicher liegt.

Der Abruf läuft mit `cache: 'no-store'`, damit nichts im HTTP-Cache der WebView landet. Der Service Worker greift nicht ein, denn er ignoriert fremde Origins (`sw.js:23`) [geprüft].

### 1.6 Sichere Speicherung

**Entscheidung: Key und Profil liegen nicht in `localStorage`, sondern in `AlertsPlugin` (neue Methoden).**

Grund: `android:allowBackup="true"` steht im Manifest [geprüft], und `localStorage` der WebView kann damit in das Android-Backup wandern. Das wäre ein Verlassen des Geräts.

- Ablage in `Context.getNoBackupFilesDir()`, das Android vom Backup ausnimmt [Doku Android, in Paket 1 am Gerät prüfen]. Die Backup-Einstellung der App bleibt unverändert.
- Der Key wird zusätzlich mit AES-GCM und einem Android-Keystore-Schlüssel verschlüsselt. `EncryptedSharedPreferences` wird nicht verwendet, weil die Bibliothek abgekündigt ist [nicht bestätigt] und eine neue Abhängigkeit wäre.
- Neue Methoden: `setApiKey`, `getApiKey`, `clearApiKey`, `saveProfile`, `loadProfile`, `clearProfile`.
- Eingabefeld `type="password"`, `autocomplete="off"`. Nach dem Speichern zeigt die UI nur "Key saved" plus Knopf "Remove".
- Ohne Plugin (Browser) ist die Sync-Sektion ausgeblendet. Es gibt keinen Rückfall auf `localStorage`.
- Gespeichert wird nur der aufbereitete Stand (2.6), nicht die Roh-Antwort.

### 1.7 Fehlerverhalten

Jeder Fehler lässt den letzten guten Stand unverändert und zeigt dessen Alter. Haken ändern sich nur bei einem erfolgreichen Sync. Kein Fehlertext enthält Header, URL mit UUID oder Key.

| Fall | Erkennung | Meldung und Verhalten |
|---|---|---|
| Key fehlt | kein gespeicherter Key | Sync-Knopf führt zum Eingabefeld |
| Key ungültig oder abgelaufen | HTTP 403 | "Hypixel rejected the key. Check it in the developer dashboard." Key bleibt gespeichert |
| Eingabefehler | HTTP 400 oder 422 | "Check your UUID." |
| Limit | HTTP 429 | "Too many requests, try again in N s" aus `RateLimit-Reset` |
| Kein passendes Profil | Liste leer | "No normal profile found for this UUID." |
| Inventory-API aus | `member.inventory` fehlt | Hinweis mit Menüpfad. **Auto-Haken bleiben wie zuletzt** |
| Collections-API aus | `member.collection` fehlt | Hinweis; Voraussetzung gilt als "unbekannt", nicht als "nicht erfüllt" |
| Skills-API aus | `player_data.experience` fehlt | Hinweis; Skill-Beitrag fehlt und erscheint in der Abweichung |
| Netz blockiert oder offline | `fetch` wirft | "No connection to Hypixel." |
| Antwortformat geändert | Dekodieren wirft | "Could not read the profile." Letzter Stand bleibt |

Hinweis: Die Doku unterscheidet den Key-Fehler per 403 [Doku]. Ein fehlender Key ergibt 400 mit `Missing API-Key header` [geprüft].

## 2. Daten aus der API lesen

### 2.1 Dekodierung

Inventarfelder sind Base64 von gzip-komprimiertem NBT [Doku]. Das reicht ohne neue Abhängigkeit:

1. `atob`. Die Doku warnt vor Unicode-Escapes im String, die `JSON.parse` aber bereits auflöst.
2. `new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()`. `DecompressionStream` gibt es in WebView seit Chromium 80. `minSdkVersion` ist 24 [geprüft], die WebView wird aber über den Play Store aktualisiert; bei fehlendem API zeigt die App einen klaren Fehler.
3. Eigener NBT-Leser in `nbt.js`, etwa 60 Zeilen: die 12 Tag-Typen, Big-Endian, Long als `BigInt` oder `Number`, wo sicher.

### 2.2 Feldpfade

Am 2026-10-31 an einem echten Abruf eines Coop-Profils geprüft [geprüft], soweit nicht anders vermerkt. Die Prüfung gab nur Struktur aus, keine Werte.

| Daten | Pfad unter `members[uuid]` |
|---|---|
| Getragene Rüstung | `inventory.inv_armor.data` |
| Equipment | `inventory.equipment_contents.data` |
| Inventar, Ender Chest | `inventory.inv_contents.data`, `inventory.ender_chest_contents.data` |
| Backpacks | `inventory.backpack_contents["0"…].data` |
| Wardrobe | `loadout.armor["N"].HELMET/CHESTPLATE/LEGGINGS/BOOTS.data`, `loadout.armor.equipped_set`. **Nicht** `inventory.wardrobe_contents`: das Feld gibt es nicht |
| Wardrobe-Equipment | `loadout.equipment["N"].EQUIPMENT_SLOT_1…4.data`, `loadout.equipment.equipped_set` |
| Personal Vault | `inventory.personal_vault_contents.data` |
| Accessories | `inventory.bag_contents.talisman_bag.data` |
| Magical Power | `accessory_bag_storage.highest_magical_power`, `.selected_power`, `.tuning` |
| Pets | `pets_data.pets[]`: `type, exp, tier, active, heldItem, candyUsed` |
| HOTM | `skill_tree.nodes.mining` (Perk zu Stufe, dazu `toggle_*` als Boolean), `skill_tree.experience.mining`, `skill_tree.tokens_spent` sowie `mining_core` für Pulver |
| Collections | `collection` (Item-ID zu Menge) |
| Skills | `player_data.experience` |
| Slayer | `slayer.slayer_bosses` |

Skills heißen `SKILL_MINING` usw. Kuudra-Stufen stehen in `nether_island_player_data.kuudra_completed_tiers`. Für Paket 2 interessant: `shards` und `attributes.stacks` existieren, Shard-Schritte könnten also doch erkennbar sein.

### 2.3 Item-Felder

Pro Slot liegt ein NBT-Eintrag mit `tag.ExtraAttributes` und `tag.display.Lore` vor; ein leerer Slot ist `{}` [geprüft].

| Merkmal | Feld |
|---|---|
| Item-ID | `id` |
| Reforge | `modifier` |
| Enchants | `enchantments` (Name zu Stufe) |
| Gemstones | `gems`: Schlüssel `JADE_0` oder `COMBAT_0` mit `COMBAT_0_gem` (auch `CHISEL_0`), dazu `unlocked_slots`. Der Wert ist die Qualität als String **oder** `{ uuid, quality }` [geprüft] |
| Recomb | `rarity_upgrades` |
| Stars | `upgrade_level` [geprüft]; `dungeon_item_level` kam im Abruf nicht vor |
| Hot Potato, Art of War | `hot_potato_count`, `art_of_war_count` |
| Drill-Teile | `drill_part_engine`, `drill_part_fuel_tank`, `drill_part_upgrade_module` (kamen im Abruf nicht vor, weiter [nicht bestätigt]) |
| Angezeigte Stats | `display.Lore` |

Normalform in `profile.js`:

```js
{ id, slot, where, reforge, enchants: {}, gems: [{ slot, type, quality }], recomb, stars, parts: {}, lore: { MINING_SPEED: 123 } }
```

### 2.4 Lore-Parser

Pro Lore-Zeile wird nach Entfernen der `§`-Farbcodes geprüft: `Name: +1,234`, auch mit `%`, dahinter bis zu drei Klammern `(+x)` [geprüft: Format]. Nur die erste Zahl zählt, die Liste bekannter Stat-Namen ist fest, Unbekanntes wird ignoriert. Dass die erste Zahl der Gesamtwert ist, passt zu 103 von 115 geprüften Zeilen (erste Zahl mindestens so groß wie die Summe der Klammern). Stand Paket 4 (Rüstung und Equipment am Fixture): Bei 46 Zeilen steht am Ende eine viel größere Klammer, vermutlich der Wert im Dungeon [nicht bestätigt]. Bei 70 Zeilen ist die erste Zahl genau Basis plus Klammern, bei 71 geht die Rechnung nicht auf. Die erste Zahl bleibt der Gesamtwert, belegt ist das aber nicht für jede Zeile.

### 2.5 Loadouts: das Wardrobe-Problem

Wer beim Sync die Mining-Rüstung trägt, hat die Blaze-Rüstung in der Wardrobe. Getragene Items allein reichen also nicht.

**Entscheidung:** Es gibt zwei Sichten auf denselben Datenstand:

- **Besitz:** alle Items aus Rüstung, Equipment, Wardrobe, Inventar, Ender Chest, Backpacks und Personal Vault, doppelte über die Item-UUID nur einmal. Grundlage für "besitze ich das?" (Sacks und Forge zählen nicht).
- **Loadout je Bereich:** pro Slot das Item, das für den Bereich am besten ist. Mining: höchster Wert laut gewichtetem Score. Blaze: höchster Wert aus True Defense plus geschätztem Schaden. Waffe bzw. Tool analog. Pet: bestes Pet für den Bereich, unabhängig von `active`.

Die UI listet das erkannte Loadout auf, damit eine Fehlwahl auffällt. Ein manueller Override kommt erst, falls die Automatik im Betrieb danebenliegt.

### 2.6 Was gespeichert wird

Nur der Stand aus 2.3 für das eigene Mitglied plus Pets, MP, HOTM-Knoten, Collections, Skills, Slayer-Stufen, `profile_id`, Sync-Zeit. Kein Rohtext, keine Coop-Daten, keine Item-UUIDs. Die Lore wird nach dem Parsen verworfen.

## 3. Stats berechnen

### 3.1 Ansatz

| Ansatz | Bewertung |
|---|---|
| A: Alles nachrechnen (Basiswerte, Reforge-Tabellen, Gem-Tabellen, Enchants …) | Hoher Pflegeaufwand, jede Spieländerung bricht etwas |
| **B: Lore als Quelle, `/stats` als Kontrolle (empfohlen)** | Item-Werte stimmen automatisch mit dem Spiel überein, weil Hypixel sie selbst in die Lore schreibt |
| C: Nur manuelle Eingabe | Kein Parsen, aber kein Auto-Stand und keine Prüfung |

### 3.2 Quellen

| Quelle | Beiträge | Woher | Automatik |
|---|---|---|---|
| Rüstung, Equipment, Waffe, Drill | alle Stats inkl. Reforge, Gems, Recomb, Stars | Lore | automatisch |
| Accessories | alle | Lore, doppelte Familien nur einmal | automatisch; Familien aus NEU `parents.json` [nicht bestätigt] |
| Power Stone und Tuning | Strength, Crit Damage usw. | `selected_power`, `tuning`, Multiplikator `29.97 × ln(0.0019 × MP + 1)^1.2` [Doku Wiki]; Grundwerte je Stone manuell | teilweise |
| Pet | Stats, Fähigkeiten, Held Item | Stufe aus `exp`; Werte aus Wiki, sonst NEU `pets.json` [nicht bestätigt] | teilweise |
| HOTM-Perks | `mining_speed` ×20, `speedy_mineman` ×40, `mining_fortune` ×2, `fortunate_mineman` ×3, `gem_lover` 20 + ×4, `mining_master` Pristine ×0,1 [Doku Wiki; Schlüssel aus Perk-Namen, nur drei am Profil gesehen]. Core of the Mountain gibt keinen dieser Stats. Bedingte Perks stehen in `gaps` | `skill_tree.nodes.mining` (`mining_core.nodes` gibt es nicht) | automatisch |
| Skills | Mining 4 Fortune je Stufe [Doku Wiki], Combat/Foraging etc. | `player_data.experience` plus `/resources/skyblock/skills` | automatisch |
| Collections | Mining Fortune bei Glacite, Tungsten, Umber, Obsidian [Doku Wiki] | `collection` | automatisch |
| SkyBlock-Level | +5 Health je Level, +1 Strength je 5 Level [Doku Wiki] | `leveling.experience` | automatisch |
| Slayer | Belohnungen je Stufe [Doku Wiki, Seiten der einzelnen Slayer] | `slayer.slayer_bosses` | automatisch |
| Basiswerte | z. B. Crit Chance 30 [Doku Wiki], Health | Tabelle | automatisch |
| Shards | nur Attribute ohne Bedingung; Bedingte stehen in `gaps` [Doku Wiki, Attributes; Schlüssel aus NEU nicht bestätigt] | `attributes.stacks`, Stufe aus Anzahl und Rarity | automatisch |
| Essence-Perks | diverse | `player_data.perks`; noch keine Tabelle | über Abgleich (3.4) |
| God Potion, Booster Cookie | God Potion: Strength 95, Crit Chance 25, Crit Damage 80, Defense 60, True Defense 20, Health 100, Mining Speed 200, Mining Fortune 25. Booster Cookie: keiner unserer Stats [Doku Wiki: Potions, God Potion, Jerry Candy, Booster Cookie] | Einstellung in Settings | per Einstellung |
| Andere Potions, Mayor, Cake, Events, Museum | diverse | nicht zuverlässig lesbar | über Abgleich (3.4) |
| Fairy Souls | keine Stats mehr [Doku Wiki: seit 0.15 nur SkyBlock XP] | entfällt | entfällt |

`/resources/skyblock/items` ist die Quelle für Upgrades auf ein noch nicht besessenes Item, denn dafür gibt es keine Lore. Die Stat-Namen dort sind teils groß, teils klein geschrieben (`MINING_FORTUNE` und `mining_fortune`) [geprüft]; Normalisierung ist Teil von `profile.js`.

### 3.3 Betrachtete Stats

- **Mining:** Mining Fortune, Gemstone/Ore/Block Fortune, Mining Speed, Pristine.
- **Blaze:** Weapon Damage, Strength, Crit Damage, Crit Chance, Attack Speed, Health, Defense, True Defense. Magic Find wird nur angezeigt und fließt nicht in die Rangliste, weil das Ziel laut Auftrag Kill-Geschwindigkeit ist.

### 3.4 Abgleich mit `/stats`

- Pro Bereich ein Formular mit den Stats aus 3.3. Eingabe ist optional und wird lokal gespeichert.
- Anzeige je Stat: berechnet, in-game, Abweichung absolut und in Prozent. Ab 5 % gelb markiert.
- **Wenn ein In-Game-Wert eingetragen ist, gilt er als Basis der Bewertung**, weil Potions und Mayor im Spiel enthalten sind. Veraltet er (älter als der letzte Sync), erscheint ein Hinweis.
- Hinweis im Formular: Messung mit dem Setup, mit dem tatsächlich gespielt wird.
- **Ausgleichswert (Paket 5):** Beim Speichern einer Messung wird je Stat `offset = inGame − berechnet` mit diesem Setup festgehalten, im selben `statsInput`. Er fasst zusammen, was die App nicht lesen kann (Potions, Mayor, Essence-Perks, Set-Boni). Die Bewertung rechnet dann mit `Basis = berechnet(aktuelles Loadout) + offset`, statt den In-Game-Wert fest zu übernehmen. So bleibt die Basis stimmig, wenn sich nach der Messung Gear ändert, und der Fehler landet nicht im Delta.
  - Ein gemessener Wert am Spielmaximum (Attack Speed 100) gibt keinen Offset, weil der echte Wert darüber liegen kann.
  - Ein Offset ist nur mit seinem Setup belegt: Wechselt Wardrobe-Slot, Equipment-Slot oder Pet, erscheint der Hinweis, neu zu messen.
  - **Boost kommt nicht in den Ausgleichswert.** God Potion und Booster Cookie sind berechnete Quellen, geschaltet über dauerhafte Einstellungen. Der Offset gilt nur, wenn die Einstellungen beim Speichern zur Messung passen (Häkchen je Messung); sonst erscheint ein Hinweis und es entsteht kein Offset.

## 4. Bewertung

Beide Bereiche liefern eine Zahl in der gleichen Einheit: **prozentualer Zugewinn der Zielgröße**. Das Delta wird immer durch Anwenden des Schritts auf das Loadout ermittelt, nicht aus der Lore.

### 4.1 Mining

Grundlage sind die Wiki-Formeln [Doku]:

- Drops: `1 + (Fortune + GemFortune) / 100`
- Pristine: `1 + Pristine × 0,79`
- Abbauzeit in Ticks: `round(Blockstärke × 30 / Speed)`, Softcap 4 Ticks, erreicht bei `ceil(20 × Blockstärke / 3)`

Daraus folgt der Score:

```
score = wF × ΔF / (100 + F)
      + wS × ΔS / S
      + wP × 0,79 × ΔP / (1 + 0,79 × P)
```

- `S` ist auf den Softcap gedeckelt: Speed darüber zählt nicht. Standard-Blockstärke 3000 (Amber, Jade [Doku]), einstellbar.
- **Standardgewichte `wF = wS = wP = 1`.** Das ist bei Gemstone-Mining die exakte Ableitung der Ertragsrate, also keine willkürliche Mischung. Für Mithril oder Erze setzt man `wP = 0`.
- Einstellbar über drei Felder, gespeichert in den Settings. "Reset" stellt die Standardwerte wieder her.
- Presets setzen Blockstärke und Gewichte. Standard ist Gemstone. Danach bleiben die Felder frei änderbar.

| Preset | Blockstärke | wF / wS / wP | Softcap Speed |
|---|---|---|---|
| Gemstone | 3000 | 1 / 1 / 1 | 20000 |
| Mithril | 500 [Doku] | 1 / 1 / 0 | 3334 |
| Glacite | 6000 [Doku] | 1 / 1 / 0 | 40000 |

**Prüfpflicht Pristine:** Der Pristine-Term dominiert die Rangliste (siehe Beispiel). Der Faktor 79/100 stammt aus dem Wikitext der Seite "Pristine" [Doku]. Paket 4 und 5 prüfen vor der ersten Rangliste Formel und Faktor erneut gegen das Wiki, auch das Zusammenspiel mit der Angabe "+1 % Chance auf Flawed je Pristine" und ob Fortune auf beide Drops wirkt. Ein Test hält die Werte fest. Geprüft am 2026-11-01 gegen Revision `oldid=866262`: Formel und Faktor stimmen, Fortune wirkt auf beide Drops, ein Zahlenbeispiel hat das Wiki nicht (`docs/plan-optimizer-p3-4.md`). Paket 5 hat das am selben Tag bestätigt. Gemstone Fortune zählt nur im Preset Gemstone; Ore-, Block- und Dwarven-Metal-Fortune zählen nicht, für Mithril und Glacite liest sich Fortune daher eher niedrig (`docs/plan-optimizer-p5.md`, A1).
- Anzeige: `+1,2 % yield`, darunter die Rohwerte (`+10 Fortune, +40 Speed`), damit die Gewichtung nachvollziehbar bleibt.

Beispiel: Bei F=1000, S=6000, P=5 bringen +10 Fortune 0,9 %, +50 Speed 0,8 %, +1 Pristine 16 %. Pristine wird also zu Recht stark gewichtet; deshalb die Anzeige der Rohwerte und die anpassbaren Gewichte.

### 4.2 Blaze Slayer T4

**Kennzeichnung im UI überall: "Estimate".** Das Modell vergleicht Upgrades, es sagt keine echte Killzeit voraus. Es gibt daher nur relative Werte (`−3 % kill time`), keine Sekunden.

Schaden pro Treffer [Doku Wiki, Damage Calculation]:

```
hit = (5 + WD) × (1 + STR/100) × (1 + min(CC,100)/100 × CD/100) × (1 + A/100) × M
```

Der Crit-Term ist der Erwartungswert, eine Herleitung aus der Crit-Formel des Wikis.

- **A (additiv):** Sharpness, Smoldering (gegen Infernal; additiv ist Annahme, Paket 6), One For All (+500, entfernt andere Enchants), Dominus bei mindestens zwei Infernal-Crimson-Teilen: +10 % pro Stack, angenommen 10 Stacks [Doku]. Niedrigere Crimson-Stufen geben keinen Schaden je Stack (`docs/plan-optimizer-p6.md`).
- **M (multiplikativ):** Dolchfaktor gegen Infernal aus dem Wiki:

| Linie | Stufe 1 | Stufe 2 | Stufe 3 |
|---|---|---|---|
| Ashen (IDs `FIREDUST`, `BURSTFIRE`, `HEARTFIRE`) | ×1,2 | ×1,5 | ×2 |
| Spirit (IDs `MAWDUST`, `BURSTMAW`, `HEARTMAW`) | ×1,5 | ×2,5 | ×3,5 |

Treffer pro Sekunde: `Ticks = round(10 / (1 + AS/100))`, `hits/s = 20 / Ticks`, Attack Speed max. 100 mit effektiver Grenze 82 [Doku; Umrechnung in hits/s ist Herleitung]. Der Effekt ist stufig, also bringt ein kleines Plus oft 0 %. Das ist gewollt.

**Dolch-Besonderheiten [Doku Wiki]:**

- **Hellion Shield:** 99 % Schadensreduktion außer durch direkte Treffer des passenden Dolchs. Der Schild wechselt nach 8 passenden Treffern. Das Modell nimmt perfektes Wechseln an und bewertet die beiden Linien als Mittelwert.
- **Ferocity zählt nicht gegen den Schild.** Ferocity hat im Modell also den Wert 0.
- **Enchant-Schaden:** Thunderlord, Fire Aspect und Crimson Swipes kommen voll durch, Venomous wird reduziert. In Version 1 nicht modelliert.

**Nicht modelliert (im UI genannt):** Swipe und Stack-Tempo von Crimson (3/4 ×2,0 gegenüber 4/4 ×3,0 Swipe), Burning Vengeance, Demonen-Phasen, Pillars, Reaktionszeit, Boss-Defense (kürzt sich im Verhältnis heraus). Folge: Das vierte Crimson-Teil ist unterbewertet und bekommt den Hinweis "set bonus not fully rated".

**Zwei Enchant-Wege:** Das Modell rechnet immer beide und zeigt oben im Blaze-Guide, welcher aktuell mehr bringt:

- **Guide-Pfad:** A aus den Enchants im Guide, soweit auf den Dolchen vorhanden.
- **One For All:** A = 500, andere Enchants auf der Waffe entfallen [Doku Wiki]. Kosten sind der OFA-Schritt aus dem Guide.
- Anzeige: `Enchants: ×a · One For All: ×b · One For All leads by z %` (Schätzung).
- Der **aktive Pfad** folgt dem Stand der Dolche: Trägt ein Dolch OFA, gilt OFA, sonst der Guide-Pfad. Waffen-Enchant-Schritte, die zum aktiven Pfad nicht passen, bekommen Zugewinn 0 und den Hinweis "not used with One For All". Die Rangliste wechselt den Pfad nie still.

**Score:** `score = hit_neu × hits_neu / (hit × hits) − 1`. Kommt ein Dolch einer Linie nicht vor, gilt der Stand als "dagger pair incomplete" und der Schritt für den fehlenden Dolch wird nach oben gezogen.

### 4.3 Harte Mindestbedingungen (Blaze)

| Bedingung | Standardwert | Quelle |
|---|---|---|
| True Defense | ≥ 140 | Auftrag |
| Magical Power | ≥ 800 hart. **Zielwert 1100:** darunter nur Hinweis, keine Sperre | Entscheidung zu Frage 3, `highest_magical_power` |

Zum Einordnen: True Defense reduziert True Damage um `TD / (100 + TD)` [Doku]. Bei 140 sind das 58 %, Immolate unter 33 % HP sinkt von 955 auf etwa 398 pro Sekunde. Trail of Fire ignoriert True Defense [Doku].

Regeln:

1. Solange eine Bedingung verletzt ist, zeigt die Rangliste oben "Requirements first" mit den Schritten, die TD bzw. MP erhöhen, sortiert nach Fortschritt der Bedingung pro 1M, dann nach Zugewinn. Die übrigen Schritte behalten ihren Rang, darüber steht der Warnhinweis `Below the limit` (Paket 6, B3 und B4).
2. Ein Schritt, der eine erfüllte Bedingung brechen würde (z. B. Opal durch Jasper ersetzen), wird nicht angeboten und in "locked" mit Grund aufgeführt.
3. Beide Werte erscheinen als Fortschrittsanzeige oben im Blaze-Guide.
4. Fehlt ein Wert (Inventory-API aus), gilt die Bedingung als "unknown". Dann läuft die Rangliste weiter, mit sichtbarem Warnhinweis.

## 5. Optimierer

### 5.1 Ablauf

Eine reine Funktion `rankUpgrades(guide, checked, ctx, loadout, settings)` in `optimizer.js`:

1. **Kandidaten:** `nextUpgrades()` aus `progress.js` weiterverwenden (pro `line` nur der erste offene Schritt).
2. **Preis:** `stepCost()` weiterverwenden (Bazaar, Forge, AH, SkyCofl, Bücher-Kombination); bei Teil-Erfüllung nur der offene Anteil (6.3). Bei Gear-Linien zählt der Netto-Preis (5.7).
3. **Voraussetzungen** filtern (5.2).
4. **Zugewinn:** Schritt auf das Loadout anwenden, Score berechnen (Abschnitt 4).
5. **Rang:** `Zugewinn / Preis in Mio`.
6. **Gruppen:**
   - Requirements first (nur Blaze)
   - Rangliste
   - Kostenlos mit Zugewinn (ganz oben in der Rangliste)
   - Ohne Preis, ohne Gain-Daten, gesperrt jeweils in eigenen Gruppen, nie mit Rang, da eine unvollständige Summe billiger aussähe als sie ist (gleiche Regel wie heute in `nextUpgrades`)

### 5.2 Voraussetzungen

| Art | Quelle | Prüfung |
|---|---|---|
| HOTM-Stufe | `items.requirements` Typ `HEART_OF_THE_MOUNTAIN` [geprüft] | aus `skill_tree.experience` und Wiki-Tabelle |
| Skill | Typ `SKILL` [geprüft] | `player_data.experience` plus Resource |
| Slayer | Typ `SLAYER` [geprüft], z. B. Pyrochaos braucht Blaze 6 | `slayer.slayer_bosses` |
| Kuudra | Typ `KUUDRA_COMPLETION` [geprüft] | `nether_island_player_data` [nicht bestätigt] |
| Collection | `requires` im Guide-Schritt oder Item-Requirement; Stufen aus `/resources/skyblock/collections` [geprüft] | `member.collection` |

Ergebnis pro Schritt: `ok`, `locked` (mit Grund: "HOTM 7 needed, you have 5") oder `unknown`. `unknown` bleibt in der Rangliste mit Hinweis. So verschwindet nie ein Schritt nur wegen ausgeschalteter API.

### 5.3 Vorausschau

Ein reiner Zwischenschritt einer Linie (Zugewinn 0) sähe schlecht aus, obwohl er zum nächsten führt. Regel: Hat der nächste Schritt einer Linie Zugewinn 0, zählt die Summe bis zum ersten Schritt mit Zugewinn in derselben Linie. Mehr Kombinatorik gibt es nicht, und die Rangliste bleibt gierig. Der Grenznutzen sinkt zudem mit jedem Kauf, deshalb die Neuberechnung statt einer Einkaufsliste.

### 5.4 Schrittdaten

Guides bekommen zwei neue optionale Felder, die `validStep` durchlassen muss (es entfernt Unbekanntes):

```json
{ "text": "...", "detect": { "kind": "enchant", "enchant": "sharpness", "level": 7, "on": "weapons", "need": 2 },
  "gain": { "MINING_FORTUNE": 10 } }
```

- `detect` beschreibt **zugleich** die Erkennung (Abschnitt 6) und die Anwendung auf das Loadout. So gibt es nur eine Stelle pro Schritt.
- `gain` ist der Rückfall für Schritte, die sich nicht aus Daten ableiten lassen.
- Der Guide selbst bekommt `area: "mining" | "blaze"`. Ohne `area` fehlt der Optimizer-Modus.

Delta-Berechnung pro Art:

| Art | Delta aus |
|---|---|
| Item-Tausch | `items.json`: neue minus alte Basis-Stats; Reforge, Gems und Enchants gelten als übertragbar |
| Reforge | Wiki, sonst NEU `reforgestones.json` nach Rarity [geprüft: Format; Werte nicht bestätigt] |
| Gemstone | Wert je Typ, Qualität, Rarity: Wiki, sonst NEU `gemstones.json` [nicht bestätigt] |
| Recomb | Differenz durch höhere Rarity bei Reforge und Gems, Accessory: ΔMP |
| Enchant | `optimizer-data.json` (manuell gepflegt) |
| Accessory, MP | ΔMP über den Multiplikator plus Lore-Stats |
| Pet | Tabelle |

Stand Paket 5 (`docs/plan-optimizer-p5.md`, A2): Drei Ergebnisse je Schritt: ein Delta, `{}` (belegt kein Stat von uns, Gruppe "No mining gain") oder `null` (kein fester Wert, Gruppe "No gain data"). Die Daten liegen in `optimizer-data.js`, zusätzlich zu dieser Tabelle mit Drill-Teilen, Polarvoid und Powder Coating. Ein ΔMP gibt es seit Paket 6 für Blaze, Mining rechnet weiter ohne, weil keine Power Mining-Stats gibt. Abdeckung und offene Enchants für Blaze: `docs/plan-optimizer-p6.md`, B5.

Quellenregel aus `CLAUDE.md`: Wiki zuerst. Was nur aus NEU stammt, trägt in `optimizer-data.js` den Vermerk `src: 'not confirmed'`. Die Daten sind Spieldaten und damit unkritisch für das Repo.

### 5.5 Neuberechnung

Neu berechnet wird nach Sync, Haken, Preis-Update, Änderung von Gewichten oder `/stats`. Da `rankUpgrades` eine reine Funktion ohne Speicher ist, läuft das beim normalen `refreshProgress()`.

### 5.6 UI

- Neuer dritter Modus in der vorhandenen Umschaltung: `By slot`, `Next upgrades`, **`Best value`**.
- Zeile wie heute (`stepRow`), ergänzt um `+1,2 % yield · 0,4 %/1M`.
- Ohne Sync: Der Modus erklärt, was fehlt, und verlinkt auf die Settings.
- Oberhalb: letzter Sync, Profilname, Knopf **Sync profile**.
- Settings-Sektion "Hypixel profile" innerhalb `#personal-settings`: UUID, Key, Gewichte, `/stats`-Formular, Löschen.
- Alle Texte Englisch, wie die App. Changelog-Einträge mit `"personal": true`.
- Farben nur über Tokens, wegen `tests/contrast.test.js`.

### 5.7 Netto-Preis bei Gear-Linien

Wer ein Teil ablöst, kann das alte verkaufen. Die Rangliste rechnet deshalb bei Item-Tausch mit:

```
netto = Preis des Schritts − Wiederverkauf des abgelösten Teils
```

- **Abgelöstes Teil:** das Item, das im Loadout des Bereichs denselben Slot belegt, nur wenn es wirklich im Besitz ist. Ohne Sync gibt es kein abgelöstes Teil, also Bruttopreis.
- **Wiederverkauf:** Bazaar-Verkaufspreis abzüglich Bazaar-Steuer, sonst AH-BIN abzüglich AH-Steuer. Nur der Basispreis des Items: Reforge, Gems und Enchants zählen nicht, weil sie laut 5.4 als übertragbar gelten. Die Schätzung ist damit eher vorsichtig.
- **Kein Wiederverkauf (0):** Item nicht handelbar (`nt`, Soulbound), ohne Preis, oder im Loadout des anderen Bereichs noch verwendet.
- **Keine Doppelzählung:** Verbraucht das Rezept das alte Teil (Forge-Zutat, Crimson-Stufe per `prestige`), zählt kein Wiederverkauf.
- **Netto ≤ 0:** Der Schritt gilt als kostenlos mit Zugewinn. Die Rangliste rechnet nie mit negativen Kosten.
- **Einstellung "I keep old gear"** (Standard aus): Eingeschaltet zählt immer der Bruttopreis.
- **Anzeige:** `Net 12M (buy 20M − resale 8M)`, damit der Abzug sichtbar bleibt. "Left"-Summen im Modus `By slot` bleiben brutto, sie zeigen, was aufzubringen ist.

## 6. Auto-Abhaken

### 6.1 Zuordnung

Mögliche Werte von `detect.kind`:

| Art | Bedeutung | Beispiel |
|---|---|---|
| `owned` | Item (oder Höherstufung) im Besitz | Rüstungsteile, Drill, Dolche |
| `reforge` | Reforge auf den Zielitems | Armor mit Jaderald |
| `enchant` | Mindeststufe auf den Zielitems | Sharpness |
| `gem` | Typ und Mindestqualität in den Slots | Opal, Jade |
| `recomb` | `rarity_upgrades` auf den Zielitems | Armor + Drill |
| `stars` | Mindest-Stars | Crimson-Upgrades |
| `part` | Drill-Teil eingebaut | Fuel Tank |
| `pet` | Pet-Typ, Mindest-Rarity und -Stufe | Mining Pet |
| `perk` | HOTM-Knoten auf Stufe | HOTM-Schritte |
| `mp` | Magical Power erreicht | Accessory Power |

**Höherstufen zählen mit.** Wird von einem späteren Schritt eines Slots etwas erkannt, auch teilweise, gelten die früheren Schritte dieses Slots als erfüllt, auch über Linien hinweg (`detect.slot`). Enchants und Ultimates haben keinen Slot. Infernal Crimson erfüllt alle niedrigeren Stufen über `items.prestige.item_id`, Drill-Stufen über `museum_data.parent` [geprüft: beide Felder vorhanden]. Bei Enchants zählt die Mindeststufe.

**Ziel-Items** (`on`): Slot-Gruppe (`armor`, `equipment`, `weapons`, `drill`) oder feste Liste. Geprüft wird im Loadout des Bereichs, bei `owned` im gesamten Besitz.

**Nicht erkennbar und daher weiter manuell:** Consumables (Dwarven O's u. a.), Deployables ohne Inventarspur, Shards ohne Feld (vor Paket 2 prüfen, ob `attributes` etwas hergibt) und Schritte, die nur eine Fähigkeit beschreiben. Schritte ohne `detect` bleiben wie bisher.

Die Guides haben 178 bzw. 94 Schritte [geprüft]. Vollständige Erfassung ist kein Ziel; Paket 2 meldet die Abdeckung pro Guide.

### 6.2 Vorrangregeln

Neuer Zustand `auto` kommt aus dem letzten Sync: Karte von Schrittschlüssel zu `{ have, need }`. Er liegt im Profilstand (1.6), **nicht** in `bt.guideChecks`.

Berechnung in `doneSet(guide, marks, auto)`:

| Haken manuell | Abhaken durch API | Ergebnis |
|---|---|---|
| gesetzt | egal | **erledigt** |
| ausdrücklich entfernt (`undone:` + Schlüssel) | erfüllt | **offen** |
| keiner | erfüllt | erledigt, Badge `API` |
| keiner | nicht erfüllt | offen |

- Table-Schritte gelten als erledigt, solange der Sync sie nicht widerlegt. Ein manueller Haken bleibt auch dann, er wird als Marke gespeichert.
- Der bestehende Mechanismus `undone:` für Table-Schritte wird dafür verallgemeinert. `setMark` schreibt `undone:` nun auch, wenn `auto` den Schritt erfüllt.
- Ein Sync schreibt nie in `marks`. Manuelle Haken bleiben also unangetastet. Ein verkauftes Item verliert automatisch den API-Haken, aber keinen manuellen.
- "Reset guide" löscht wie bisher Marken und `undone:`; `auto` bleibt, weil der Besitz weiter gilt.
- Ein Haken `undone:` kann über den normalen Haken wieder gesetzt werden und wird dann als erledigt geführt.

### 6.3 Teil-Erfüllung

Beispiel 3/4 Crimson:

- Schritt bleibt **offen**, die Zeile zeigt `3 / 4` mit Badge `API`.
- **Preis nur für den offenen Teil.** Bei `qty`-Items wird `qty − have` berechnet, bei `anyOf` wird über den vorhandenen Mechanismus `skip` das bereits besessene Teil ausgelassen; bei Mehr-Item-Schritten (Gem plus Chamber) anteilig aufgerundet.
- Zugewinn nur für den offenen Teil.
- Ein Teil mit niedrigerer Stufe zählt nicht als erfüllt, solange der Schritt eine höhere Stufe verlangt.

## 7. Datenschutz

| Daten | Liegt wo | Verlässt das Gerät? |
|---|---|---|
| API-Key | Keystore-verschlüsselt in `noBackupFilesDir` | nur als Header an `api.hypixel.net` |
| Profilstand, `auto` | `noBackupFilesDir` | nein |
| UUID | wie Profilstand | nur als Parameter an `api.hypixel.net` |
| Gewichte, Mindestwerte, `/stats` | `noBackupFilesDir` (`/stats` ist Profilbezug) bzw. Settings (Gewichte) | Gewichte können über Android-Backup wandern; sie sind unkritisch |

Umsetzung und Absicherung:

- **Snapshot-Job:** bekommt keinen Key und ruft nur öffentliche Resources ab. `items.json` enthält keine Profildaten.
- **Export:** `exportData(guides, progress)` bleibt in Signatur und Inhalt unverändert. `auto` und Key sind damit gar nicht erreichbar. Test: Export nach einem Sync enthält weder Key, UUID noch Item-UUIDs.
- **Import:** `importData` ignoriert fremde Felder bereits.
- **Repo:** `personal/` ist in `.gitignore` [geprüft]. Testdaten sind synthetisch: Der Test erzeugt NBT mit einem kleinen Encoder. Ein echter Abruf liegt anonymisiert in `personal/fixtures/`, und Tests dagegen überspringen sich ohne die Datei. Er entsteht in der App (Key-Eingabe nur dort) über einen temporären Knopf in Paket 1 und kommt per Android-Teilen-Menü oder `adb exec-out run-as` auf den Rechner; `copy-web.mjs` kopiert aus `personal/` nur `guides`, also landet er nicht im APK. Regel aus `CLAUDE.md`: Tests rufen nie die API auf.
- **Logs:** Kein `console.*` im Sync-Code. `fetch`-Fehler werden auf Fehlerklassen abgebildet, nie durchgereicht.
- **Löschen:** Knopf "Remove key and profile data" entfernt alles und setzt `auto` zurück. Manuelle Haken bleiben.
- **Guard-Test:** Der String `API-Key` darf nur in einer Datei vorkommen. Ein Test scannt außerdem `SHELL`-Dateien auf Key-Muster.
- **Hinweis:** Das Repo ist öffentlich. Diese Spec und alle Dateien enthalten keine UUID, keinen Key, keine Guide-Inhalte über das Nötige hinaus.

## 8. Paketplan

Der erste spürbare Nutzen kommt nach Paket 2: Die Haken pflegen sich selbst. Die Rangliste kommt erst danach, weil sie die Daten aus den Paketen 1 bis 4 braucht.

| # | Paket | Inhalt | Nutzen | Aufwand | Modell |
|---|---|---|---|---|---|
| 0 | Key besorgen | Du: Personal Application beantragen, API Settings prüfen | Voraussetzung | klein, Wartezeit auf Genehmigung offen | keins |
| 1 | Sync und Dekodierung | Plugin-Methoden mit Keystore, `nbt.js`, `profile.js`, Profilwahl, Fehlerfälle, Settings, Status. Prüfung aller [nicht bestätigt]-Punkte an einem echten Abruf; Spec korrigieren | Sichtprüfung des Profils | M, ca. 500 Zeilen | Opus 5.5 (Sicherheit, Native) |
| 2 | Auto-Abhaken | `detect`, `doneSet`, Badge, Teil-Erfüllung und Preis, `detect` für alle Guide-Schritte | **Erster Nutzen** | M, ca. 300 Zeilen plus Pflege der Guides | Sonnet 5.5 |
| 3 | Voraussetzungen | `items.json` im Snapshot-Job, HOTM-, Collection-, Slayer- und Skill-Prüfung, Anzeige "locked" | "Geht das schon?" im Guide | S, ca. 150 Zeilen | Sonnet 5.5 |
| 4 | Stats und Abgleich | Lore-Summe, Loadouts, HOTM, Skills, Pets, MP, `/stats`-Formular | Stats sichtbar, Abweichung prüfbar | L, ca. 500 Zeilen | Opus 5.5 |
| 5 | Mining-Rangliste | `optimizer.js`, Delta-Arten, `optimizer-data.json`, Modus `Best value`, Gewichte und Presets, Netto-Preis mit "I keep old gear", Pristine-Prüfung, Ausgleichswert (3.4) | **Rangliste Mining** | M, ca. 450 Zeilen plus Daten | Sonnet 5.5 |
| 6 | Blaze-Modell | Schadensmodell, beide Enchant-Wege, Constraints mit MP-Zielwert, Enchant-Daten, Estimate-Hinweise | **Rangliste Blaze** | M, ca. 350 Zeilen plus Daten | Opus 5.5 |

Reihenfolge fest: 0, 1, 2. Danach 3 und 4 unabhängig, dann 5, dann 6. Mining kommt vor Blaze, weil die Formeln belegt sind und das Blaze-Modell auf derselben Struktur aufsetzt.

Jedes Paket: Version und Changelog nach `CLAUDE.md`, neue Dateien in `SHELL` (`sw.js`), Tests mit Fixtures, Test am Gerät für native Teile.

Neue Dateien: `nbt.js`, `profile.js`, `stats.js`, `optimizer.js`, `optimizer-data.json`. Geändert: `progress.js`, `app.js`, `index.html`, `style.css`, `sw.js`, `native.js`, `AlertsPlugin.java`, Snapshot-Skript, `personal/guides/*.json`, `changelog.json`.

## 9. Risiken

| Risiko | Folge | Gegenmaßnahme |
|---|---|---|
| Lore-Format ändert sich oder Klammern anders als angenommen | falsche Stats | `/stats`-Abgleich macht es sichtbar; Parser ist getestet und klein |
| Application-Genehmigung dauert oder wird abgelehnt | Blockiert ab Paket 1 | Development Key nur für Paket 1 zum Entwickeln |
| Inaktivitätsregel (28 Tage) | App deaktiviert | Hinweis ab 21 Tagen |
| Pflegeaufwand `detect` und Daten nach Spielpatches | Veraltete Rangliste | Vorrang der manuellen Haken; Wiki-Quelle in `src`; Warnung bei `src: "not confirmed"` |
| Blaze-Modell weicht von der Praxis ab (Swipe, Demonen) | falsche Reihenfolge möglich | Kennzeichnung als Schätzung, bekannte Lücken im UI genannt |
| NEU-Daten statt Wiki | evtl. ungenau | Vermerk "not confirmed" laut `CLAUDE.md` |
| Rangliste bewertet Einzelschritte gierig | Set-Boni und Kombinationen unterbewertet | Linien-Vorausschau (5.3), Hinweis beim Set-Bonus |
| Netto-Preis überschätzt den Wiederverkauf (dünner AH-Markt, Preis fällt beim Verkauf) | teure Upgrades wirken zu günstig | Abzug sichtbar anzeigen, "I keep old gear" schaltet ihn ab |
| Große Profilantwort auf schwachem Handy | Ruckeln beim Dekodieren | Nur nötige Felder dekodieren; Messung in Paket 1 |
| Keystore nach App-Neuinstallation oder Restore ungültig | Key nicht lesbar | Wie "kein Key": neu eingeben, kein Absturz |

## 10. Entscheidungen zu den offenen Fragen

Beantwortet am 2026-10-31.

1. **Application:** Personal Application ist angelegt. Bis zur Freigabe darf Paket 1 mit einem Development Key arbeiten. Der Key wird nur in der App eingegeben, nie im Chat.
2. **Echter Abruf:** erlaubt, einmal lokal und anonymisiert unter `personal/fixtures/` (gitignored).
3. **Mindest-MP:** 800 als harte Grenze, 1100 als Zielwert mit Hinweis (4.3).
4. **Mining-Ziel:** Standard Gemstone (Blockstärke 3000, Gewichte 1/1/1), dazu Presets Gemstone, Mithril und Glacite. Pristine-Formel wird in Paket 4/5 besonders gegen das Wiki geprüft (4.1).
5. **Blaze-Enchants:** Guide-Pfad und One For All werden beide gerechnet, die Anzeige nennt den stärkeren (4.2).
6. **Besitz:** Items in Ender Chest, Backpacks und Wardrobe zählen als besessen. Items von Coop-Mitspielern, in Sacks oder im Forge zählen nicht.
7. **Nur Android:** Sync gibt es nur in der App, nicht auf der GitHub-Pages-Version.
8. **UUID:** wird einmal von Hand eingetragen.
9. **Loadout:** automatisch je Bereich und sichtbar; manueller Override erst bei Bedarf.
10. **Zusätzlich:** Gear-Linien rechnen mit Netto-Preis nach Wiederverkauf, Einstellung "I keep old gear" (5.7).

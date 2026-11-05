# Plan: Blaze-Werte (Paket C, Teil 3)

Grundlage: `docs/blaze-gaps.md`, `docs/blaze-data.md` und deine Entscheidungen zu Abschnitt 8. Branch `feat/blaze-values`, Ziel-Version der Guide-App **0.9.0** (`guide/changelog.json`). Es wird nichts gepusht oder gemergt, nichts aus `personal/` kommt in git.

## 1. Ausgangslage im Code (geprüft)

- Das Gebiet Blaze gibt es schon: Messen-Screen, Übersicht, Editoren laufen über `guide/views/stats.js`, `guide/stats-model.js`, `guide/totals.js`. `DATA_AREA.blaze = 'combat'` zieht heute **alle 16 Combat-Stats** auf den Messen-Screen, auch Health Regen, Vitality und Ferocity.
- Gear-Pfad: `guide/gear.js` (`gearOf`) = Item-Stats der getragenen Teile + `blazeDelta` je getickter Schritt + Pet am Ende. `AREA_STATS.blaze` in `stats.js` hat sieben Stats und tut **zwei Dinge**: es filtert die Deltas (`onlyOf`) und es wählt das stärkste Teil je Slot (`strength()` in `virtual.js`). Beides muss getrennt werden, sonst verfälscht eine längere Liste die Teile-Auswahl.
- Die Schritte `attr`, `perk`, `power`, `pet` (aus dem Build) sind Build-Schritte und zählen nicht als Gear (`BUILD_KINDS`). Attribute wirken also über `build.attrs` in `totals.js`, nicht über den Schritt.
- Der Build kennt `pet {id, rarity, level}` ohne Entwurf und ohne Rückfüllung (`setPet`). Gear-Felder gehören genauso in diese Klasse (nicht in die Basis).
- Reforge-Tabellen: NEU `constants/reforgestones.json` enthält Zielart (`itemTypes`) und Stats je Rarität und bestätigt unsere Wiki-Werte (Ancient mit Intelligence 6, Glistening mit Intelligence 5, Coldfused mit Magic Find 2). Damit sind "Reforge-Slots aus den Daten" gelöst:

| Reforge | Ziel laut NEU |
|---|---|
| fabled, withered | SWORD |
| coldfused | nur die sechs Dolche |
| ancient | ARMOR |
| strengthened, glistening | EQUIPMENT (jeder Slot) |
| bloodshot | BELT |
| blood_soaked | Cloak (Wiki) |

## 2. Entscheidungen, die ich im Plan treffe (bitte prüfen)

1. **Stat-Liste im Blaze-Gebiet** = Combat-Stats ohne Health Regen und Vitality, dazu die Misc-Stats SPEED und MAGIC_FIND (kommen auf Items und Coldfused vor, und Nether Embodiment wirkt auf Misc). Andere Misc-Stats (Fishing, Pressure …) bleiben draußen. Combat Wisdom bekommt die Kategorie `wisdom` und damit **keinen** +10 %. Alles bis zu deinem Screenshot als unbestätigt markiert.
2. **Reihenfolge auf einem Rüstungsteil** (Annahme): `(Item-Basis × (1 + 0,02 × Sterne) + HPB-Stats) × Bling ×1,4`, danach Reforge, Enchants, Gems unverändert. Sterne gelten nur für das Crimson-Set und nur für die Item-Basis. Bling wirkt auf Basis plus HPB der Blaze/Frozen-Blaze-Teile, nicht auf Reforge/Enchants. Das passt zu den Wiki-Zahlen (Frozen Blaze 40 → 56 Strength, HPB 2,8-fach), die Reihenfolge innerhalb ist aber nicht belegt.
3. **HPB**: gilt für Rüstungsteile und Dolche (nicht für Equipment/Accessoires). Bücher je Teil = 10 + Fuming (0–5). Mit Blaze-Pet ×2 auf alle Teile, ×2,8 auf Blaze/Frozen Blaze. Fuming wird mitverdoppelt (deine Annahme, markiert).
4. **Dominus** (volle Stacks): zählt, wenn mindestens 2 Teile **derselben Stufe** getragen werden; bei gemischten Sets gilt die Stufe mit den meisten Teilen (bei Gleichstand die höhere). Dauerwerte: Ferocity 10 (Burning), 20 (Fiery), 20 (Infernal); Swing Range 0,5 (Crimson), 1 (ab Hot); Damage +100 % additiv nur Infernal (bleibt in `blaze.js`).
5. **Accessoires** geben keine Gear-Stats mehr (stecken in der Basis). Ein getickter Accessoire-Schritt zeigt nur den Hinweis "Magical Power im Power-Tab erhöhen"; die automatische MP-Erhöhung im Ranking (`change.mp`) entfällt. Bestehende Optimizer-Tests dazu werden angepasst.
6. **Ferocity im Ranking**: Ferocity zählt in die Summe und die Anzeige. Ob und wie sie in `blazeScore` eingeht, lese ich vor dem Einbau im Wiki nach (Formel "Extra-Treffer je 100 Ferocity"). Steht die Formel nicht eindeutig da, bleibt das Ranking wie heute und `LEFT_OUT` nennt Ferocity.

## 3. Daten

1. `gamedata/stats.json`: Feld `category` (`combat`, `misc`, `wisdom`, `mining`, `farming`, `gathering` …) je Stat, dazu `categoryNote: "unbestätigt, /stats-Screenshot folgt"`. Quelle der Tabelle ist `scripts/gamedata-build.mjs` (Spalte ergänzen). Prüfung in `guide/gamedata.js`: Pflichtfeld, erlaubte Werte. `areas` bleibt.
2. `gamedata/pets.json`: Blaze (Legendary, Lv 100): Defense 30, Intelligence 100; Perks Nether Embodiment, Bling Armor, Fusion-Style Potato mit **strukturiertem** Feld `effect` (`category_multiplier` / `set_multiplier` / `potato_multiplier`, Prozent je Level, Gebiet). `checkPets` bekommt die Regeln dafür. Neues Top-Feld `items` (Pet-Items): Crochet Tiger Plushie = Attack Speed 35.
3. `stats.js`: `PETS.BLAZE` bekommt Intelligence 1 je Level (Schritte, die das Pet setzen, rechnen darüber). Pet-Item des Builds wird addiert.
4. `gamedata/attributes.json`: bei `vs_mob_family`-Effekten Feld `family` (Blazing Resistance = `infernal`, die anderen Resistances/Fortunes `undead`/`skeletal`/`airborne`/`subterranean`). Neuer Effekt für Unlimited Fortitude (Defense +0,2 % je Level als Prozent-Multiplikator). Die 14 Damage-Attribute (Infernal Ruler, Elite, Warrior, Dominance, Lifeline, Payback …) bekommen ihren Text als reine Listen-Zeile, nicht in die Summe. Linearität je Level ist Annahme (markiert).
5. `optimizer-data.js`: fehlende Reforge-Stats (Ancient Intelligence, Glistening Intelligence, Coldfused Magic Find), Reforge-Ziele aus der Tabelle oben, Cayenne und Habanero als Listen-Einträge, eine Enchant-Tabelle mit Art (`stat` / `bedingt` / `kein Dauer-Stat`) und Text für jeden der 46 Enchants, `HPB` (Armor: Defense 2, Health 4; Weapon: Strength 2, Damage 2), `CRIMSON_STAR = 2`, Dominus-Tabelle je Stufe, Familie des Blaze-Bosses (`infernal`).
6. Schlüssel: `HEALTH_REGENERATION → HEALTH_REGEN`, `WALK_SPEED → SPEED` in `scripts/items.mjs` (neue Items) **und** als Alias beim Laden (die lokale `items.json` ist schon gebaut).

## 4. Logik

- **Build-Felder** (`guide/build.js`): `build.pet.item` und `build.gear = { catacombs: null|0–60, stars: 0–10, hpb: true, fuming: 0–5 }`. Standard: HPB an, Fuming 0, Sterne 0, Catacombs unbekannt. Gelesen mit Standardwerten, sodass bestehende gespeicherte Builds ohne Migration weiterlaufen. Kein Entwurf, keine Rückfüllung. Catacombs unbekannt: Withered und Ancient werden nur gelistet.
- **UI**: Power-Tab im Gebiet Blaze bekommt ein Panel "Gear" (Catacombs-Level, Sterne, HPB-Schalter, Fuming) und im Pet-Panel eine Pet-Item-Auswahl (nur Plushie und "keins"). Alles klein, im bestehenden Stil; Eingaben zeigen "unbestätigt" dort, wo es zutrifft.
- **Neues Modul `guide/pieces.js`** (rein): `pieceStats(id, items, gear, pet)` rechnet Item-Basis, Sterne, HPB, Pet-Verdopplung, Bling. `gearOf` und `blazeDelta` rufen es für getragene Rüstung und Dolche auf, damit auch Tausch-Schritte (z. B. Fiery → Infernal) die Sterne, HPB und Bling richtig vergleichen. Dafür bekommt `blazeDelta` einen Kontext (`{ gear, pet }`); `settings` bleibt unverändert.
- **Set-Bonus** (`blaze.js`): `setBonusOf(armorIds)` gibt Stufe, Teile, `add` (Ferocity, Swing Range) und `additive` (Damage). `dominusOf` bleibt als Wrapper.
- **Stat-Listen**: `AREA_STATS.blaze` bleibt für die Teile-Auswahl, neu `GEAR_STATS.blaze` (Combat ohne Health Regen/Vitality plus SPEED, MAGIC_FIND) für `onlyOf`.
- **Summen** (`guide/totals.js`): `statsOf` bekommt den aktiven Pet-Effekt. Nether Embodiment = Multiplikator 1 + 0,1 × Level/100 auf jeden Stat der Kategorien `combat` und `misc`, **nach** dem Addieren und multiplikativ zu anderen Multiplikatoren; gilt im Gebiet Blaze immer (Crimson Isle). Attribute: `vs_mob_family` zählt nur, wenn `family` zum Gebiet gehört (Blaze: `infernal`); Prozent-Multiplikator-Effekte gehen in `mult`. Das Pet kommt aus dem Schritt-Pet oder dem Build (wie heute, Schritt gewinnt); `gearOf` gibt das aktive Pet zurück und `statsModel` sowie `planOf` reichen es durch.
- **Schritt-Effekte**: Chimera = `20 % × Level` der Stats des aktiven Pets (inklusive Pet-Item ist offen, Standard: nur Pet-Stats), als Stat der jeweiligen Dolchlinie. Enchants der Art `bedingt` und Cayenne, Habanero, Brute Force kommen in `listed` ("Only when the condition holds"), nie in die Summe. Quazii/Typhoeus/Pillars: kein Mob-Typ, daher Smite und Co. nur gelistet.
- **Ranking** (`blaze.js`/`optimizer.js`): `blazeState` nimmt die neue Summe. Annahmen bleiben (Sharpness + Smoldering additiv, Dominus 10 Stacks, perfektes Wechseln der Dolche). Ferocity siehe Entscheidung 6.
- **Shard-Icons**: `scripts/fetch-icons.mjs` bekommt die fünf Block-Texturen (sea_lantern, diamond_block, packed_ice, obsidian, Sonnenblume) aus dem Client-JAR nach `guide/img/mc/` und für Wither-Skelett und Zombie das Gesicht aus `entity/…` (`headFace` bekommt eine Variante ohne Hut-Schicht, weil Mob-Texturen kein Hut-Feld an der Stelle haben). `attributes.json` bekommt `mcIcon` für die sieben; `stats-attrs.js` nimmt `img/mc/<name>.png`; `guide/sw.js` (SHELL) und `tests/guide-icons.test.js` kennen die sieben Dateien. Die Vanilla-Dateien werden wie die bestehenden Texturen committet.

## 5. Reihenfolge der Commits (klein, jeder grün)

1. Kategorien in `stats.json` + Build-Skript + Prüfung + Test.
2. Schlüssel-Alias (`HEALTH_REGEN`, `SPEED`) + Test.
3. Blaze-Pet, Pet-Items, strukturierte Perk-Effekte + Prüfung + Test.
4. Reforge/Enchant/HPB/Stern/Dominus-Tabellen in `optimizer-data.js` + Test gegen eine kleine Fixture der NEU-Reforges (`tests/fixtures`), keine Live-Abfrage.
5. Build-Felder (`build.gear`, `pet.item`) + Editor-UI + Test.
6. `pieces.js` + Einbau in `gearOf`/`blazeDelta` + Tests (Beispielrechnungen aus `blaze-data.md`: Frozen Blaze Helm 56 Strength, HPB 2,8-fach, Stern +2 %).
7. Set-Bonus-Funktion + Ferocity/Swing Range + Test.
8. `GEAR_STATS.blaze`, Accessoire-Umbau, Chimera, Listen-Einträge + Tests (inkl. angepasster Optimizer-Tests).
9. Totals: Nether Embodiment, Attribut-Familie, Unlimited Fortitude + Tests.
10. Blaze-Messen und Übersicht (Stat-Liste ohne Health Regen/Vitality, mit Ferocity, SPEED, MAGIC_FIND) + Ansichtstest + Screenshots.
11. Ranking mit Ferocity (falls das Wiki es trägt) + Test.
12. Shard-Icons + Test.
13. `guide/changelog.json` 0.9.0 (englisch, 1–4 Einträge), `DECISIONS.md`-Eintrag, `docs/summary-v0.9.0.md`.

Nach jedem Commit läuft `npm test` (nur Fixtures, keine Live-API). Commit-Autor `Tsaitunq` (noreply), Nachrichten mit der vorgegebenen Co-Authored-By-Zeile.

## 6. Tests (Auswahl)

- `gamedata.test.js`: jede Stat hat eine erlaubte Kategorie; Blaze-Pet und Pet-Items bestehen die Prüfung; unbekannte Effektarten schlagen fehl.
- Neue Datei `guide-blaze.test.js`: Stückrechnung (Basis, Sterne, HPB, Verdopplung, Bling), Dominus-Stufen und gemischtes Set, Reforge-Ziele aus der NEU-Fixture, Withered/Ancient mit und ohne Catacombs-Level, Nether Embodiment auf einer Beispielsumme (nach dem Addieren, multiplikativ), Attribut-Familie, Chimera, Accessoire ohne Gear-Stats.
- Anpassung: Optimizer-Tests, die die automatische MP-Erhöhung erwarten.
- `guide-views.test.js`/`guide-icons.test.js`: Blaze-Messen ohne Health Regen/Vitality, sieben Icons in SHELL.
- Alle Tests ohne `personal/`-Dateien: Item-Daten kommen aus Fixtures.

## 7. Risiken

- **Reihenfolge der Multiplikatoren** (Entscheidung 2) ist nicht belegt. Ich halte die Rechnung in einer Funktion mit Test, damit eine Korrektur eine Zeile ist.
- **Ranking-Tests** hängen an `change.mp`; die Anpassung betrifft mehrere Fälle in `optimizer.test.js`.
- **Pet aus Schritt vs. Build** für Nether Embodiment: der Schritt gewinnt wie bisher. Ist beim Messen ein Blaze-Pet aktiv gewesen, steckt der Multiplikator schon in der Basis. Der Messen-Hinweis sagt weiter "ohne Pet", `totalFor` teilt wie bei den HOTM-Multiplikatoren durch den Snapshot-Wert.
- **Wiki-Zahlen** kommen aus einem zusammenfassenden Abruf; die Tabellen in Punkt 4 der Reihenfolge werden deshalb gegen NEU gegengeprüft, wo NEU sie hat (Reforges, HPB).
- **Mojang-Texturen** in `guide/img/mc/`: wie bei den sechs vorhandenen Dateien.

## 8. Fragen an dich vor dem Start

1. Stat-Liste im Blaze-Gebiet wie in Entscheidung 1 (Combat ohne Health Regen/Vitality, plus SPEED und MAGIC_FIND)? Oder nur Combat?
2. Reihenfolge der Multiplikatoren wie in Entscheidung 2 in Ordnung?
3. Accessoire-Schritte ohne automatische MP-Erhöhung (Entscheidung 5) in Ordnung, auch wenn die Rangliste dadurch Accessoire-Schritte nicht mehr nach Magical Power bewertet?
4. Ferocity im Ranking nur, wenn das Wiki die Formel eindeutig hergibt (Entscheidung 6)?

Ich stoppe hier und warte auf dein OK.

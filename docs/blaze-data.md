# Blaze-Daten: recherchierte Werte (Paket C, Teil 2)

Nur Daten, keine App-Logik. Stand der Recherche: 2026-11-05.

Quellen:
- **Wiki** = hypixelskyblock.minecraft.wiki (Seite jeweils genannt). Die Seiten wurden über ein Abruf-Werkzeug gelesen, das den Inhalt zusammenfasst. Jede Zahl steht deshalb mit "sicher" nur, wenn sie zusätzlich zu einer zweiten Quelle passt oder in sich stimmig ist.
- **NEU** = NotEnoughUpdates-REPO (`items/<ID>.json`, Lore).
- **items.json** = lokale Item-Daten (`personal/items.json`, nicht im Repo).

Spalte "Stand": sicher = Wiki und zweite Quelle stimmen oder die Seite ist eindeutig; unsicher = Wiki unklar, widersprüchlich oder nur abgeleitet.

## 1. Set-Boni und Rüstungen

### Crimson (Wiki "Crimson Armor")

Stats pro Teil (Helm / Brust / Hose / Schuhe), identisch mit `items.json` (Stichprobe Hot-Helm und Infernal-Helm geprüft):

| Stat | Crimson | Hot | Burning | Fiery | Infernal |
|---|---|---|---|---|---|
| Health | 160 / 230 / 205 / 130 | 202 / 290 / 258 / 164 | 254 / 365 / 325 / 206 | 320 / 460 / 410 / 260 | 403 / 580 / 517 / 328 |
| Defense | 50 / 65 / 55 / 40 | 63 / 82 / 69 / 50 | 79 / 103 / 87 / 64 | 100 / 130 / 110 / 80 | 126 / 164 / 139 / 101 |
| Strength | 30 je Teil | 38 | 48 | 60 | 76 |
| Crit Damage | 20 | 25 | 32 | 40 | 50 |
| Intelligence | 15 / 5 / 5 / 5 | 19 / 6 / 6 / 6 | 24 / 8 / 8 / 8 | 30 / 10 / 10 / 10 | 38 / 13 / 13 / 13 |

Set-Bonus **Dominus** (gleiche Struktur je Stufe, Wiki: "Pieces Required: 2+"):

| Eintrag | Wert | Stand |
|---|---|---|
| Stack | 1 Stack je Nahkampftreffer, Abklingzeit 1,5 s (2 Teile) / 1 s (3) / 0,5 s (4) | sicher |
| Verfall | 1 Stack weg nach 4 s / 7 s / 10 s ohne Treffer (Zuordnung zu 2/3/4 Teilen nicht beschriftet) | unsicher |
| Maximum | 10 Stacks | sicher |
| Pro Stack Crimson / Hot | Swing Range 0,05 / 0,1 | sicher |
| Pro Stack Burning | Swing Range 0,1 und Ferocity 1 | sicher |
| Pro Stack Fiery | Swing Range 0,1 und Ferocity 2 | sicher |
| Pro Stack Infernal | Swing Range 0,1, Ferocity 2 und **10 % Damage (additiv)** | sicher |
| Bei 10 Stacks | Swipe trifft alle Gegner; Faktor bei 2/3/4 Teilen: Crimson 0,5 / 1,0 / 1,5; Hot 0,625 / 1,25 / 1,875; Burning 0,75 / 1,5 / 2,25; Fiery 0,875 / 1,75 / 2,625; Infernal 1,0 / 2,0 / 3,0 | sicher |

Prüfung `blaze.js` (`DOMINUS_ADDITIVE = 100`, `DOMINUS_PIECES = 2`, nur `INFERNAL_CRIMSON_`): passt zum Wiki (10 % × 10 Stacks = +100 %, ab 2 Teilen). Dazu gehört die Annahme, dass die 10 Stacks dauernd gehalten werden (Abklingzeit 1,5 s bei 2 Teilen). Gemischte Sets: das Wiki sagt nichts, die Annahme "zwei Infernal-Teile" bleibt unsicher.

Intimidation und Tenacity stehen nicht auf der Seite und sind Kuudra-spezifisch, nicht relevant.

### Crimson-Sterne

Wiki "Essence": "Each Star Upgrade grants a +2% stat boost", maximal 15 Sterne für Nicht-Dungeon-Items; Dungeon-Items +10 % pro Stern nur in den Catacombs, max. 5. Die Seite schränkt die +2 % nicht auf Kuudra ein, sagt aber auch nicht, dass sie außerhalb gelten. **Unsicher.** Die Sternzahl der Teile steht nirgends in den Daten: Einstellung im Build nötig (Vorschlag: Sterne 0–15 für die Crimson-Teile).

### Blaze Armor und Frozen Blaze (Wiki "Blaze Armor", "Frozen Blaze Armor")

| Teil | Blaze: Defense / Strength / Speed | Frozen Blaze: Defense / Strength / Speed |
|---|---|---|
| Helm | 90 / 30 / 2 | 105 / 40 / 2 |
| Brust | 165 / 30 / 2 | 180 / 40 / 2 |
| Hose | 130 / 30 / 2 | 140 / 40 / 2 |
| Schuhe | 80 / 30 / 2 | 95 / 40 / 2 |
| Summe | 465 / 120 / 8 | 520 / 160 / 8 |

Stand: sicher (Wiki-Infobox und `items.json` stimmen überein; die "Usage"-Abschnitte beider Seiten nennen ältere Werte, ignoriert).

Set-Bonus **Blazing Aura** (Blaze) / **Frozen Blazing Aura** (Frozen Blaze), nur als Vollset: Schaden an Mobs im Umkreis von 5 Blöcken, pro Sekunde; Blaze 3 % der Max-Health, Frozen Blaze 300 Grundschaden + 3 % der Max-Health, Slowness I für 4 s. Obergrenze 500 Schaden/s (Frozen), steigend um 100 je 5.000 Blaze Rods bis 5.000. Stand: sicher (Text), aber ohne Bezug zu unserem Schadensmodell: das ist Umgebungsschaden, kein Treffer-Multiplikator. Nicht modellieren, außer du willst es.

**Bling Armor zählt Frozen Blaze mit.** Wiki "Frozen Blaze Armor": mit Lv-100-Pet steigen alle Stats des Frozen Blaze Sets um +40 % (Strength 40 → 56, Speed 2 → 2,8, Defense je Teil × 1,4). Wiki "Blaze Pet": Bling Armor und Fusion-Style Potato wirken beide auf Hot Potato Books von Blaze Armor und Frozen Blaze Armor. Stand: sicher.

### Power Wither (NEU `POWER_WITHER_*`; im Wiki keine Seite unter diesem Namen)

| Teil | Health | Defense | Strength | Crit Damage | Intelligence |
|---|---|---|---|---|---|
| Helm | 180 | 100 | 40 | 30 | 30 |
| Brust | 260 | 140 | 40 | 30 | 10 |

Hose und Schuhe nicht abgerufen (in `items.json` vorhanden). Set-Bonus **Witherborn**: alle 30 s ein Wither-Minion (max. 1), explodiert an Gegnern; "Reduces the damage you take from withers by 10 %" je Teil. Kein Stat-Bonus. Stand: sicher. Es sind Dungeon-Items (nach deiner Antwort 7 ohne Sterne).

### Reaper Mask (Wiki "Reaper Mask")

Health 150, Defense 100, Intelligence 100, Vitality 60, Mending 60 (identisch mit `items.json`). Fähigkeit **Evil Incarnate**: Zombie Armor löst bei allen Treffern aus, 2 extra Necromancer-Seelen. Kein Set-Bonus, kein Dauer-Stat. Stand: sicher.

### Warden Helmet (Wiki "Warden Helmet")

Health 300, Defense 100. Fähigkeit **Brute Force**: halbiert Speed, dafür +20 % Basis-Waffenschaden je 25 Speed (Speed vor der Halbierung auf 400 begrenzt, höchstens +161 % bei 200 Speed laut Wiki). Kein Set-Bonus. Stand: sicher für den Text, unsicher für die genaue Formel (der Wiki-Text nennt zusätzlich "+1 % pro 25 Speed"). Das ist ein Schadens-Multiplikator, der vom Stat Speed abhängt; WALK_SPEED = SPEED nach deiner Antwort. Nicht im Modell.

### Sorrow Armor (Wiki "Sorrow Armor")

Brustplatte: True Defense 80, Magic Find 5, Mining Speed 50, Mining Fortune 20 (gleich `items.json`). Set-Bonus nur bei 2 Teilen: **Mist Aura**, Schaden von Ghosts × 0,6. Das Wiki vermerkt in der Historie, Sorrow gebe seit 2026-10-15 keinen Magic Find mehr, die Tabellen führen +5 aber weiter. **Unsicher**, bitte im Spiel prüfen.

## 2. Blaze-Pet (Wiki "Blaze Pet", Legendary)

| Eintrag | Wert | Stand |
|---|---|---|
| Defense | 0,3 je Level (Lv 1: 0,3; Lv 100: 30) | sicher |
| Intelligence | 1 je Level (Lv 1: 1; Lv 100: 100) | sicher |
| Attack Speed | nicht auf der Seite, damit nur das Pet-Item | sicher (deine Antwort 1) |
| Nether Embodiment | +0,1 % je Level auf Combat- und Miscellaneous-Stats, Lv 100: +10 %, nur Crimson Isle (laut Trivia auch in Kuudra) | sicher |
| Bling Armor | +0,4 % je Level auf Blaze-Armor-Stats und -Fähigkeit, Lv 100: +40 % | sicher |
| Fusion-Style Potato | "Double effects of Hot Potato Books", kein Leveln | sicher |
| Zusammenspiel | Lv 100: Hot Potato Books auf Blaze/Frozen Blaze wirken 2 × 1,4 = 2,8-fach | sicher (Trivia) |

Das Wiki sagt nicht, welche Stats "Combat" und "Miscellaneous" sind: das kommt aus deinen Screenshots.

## 3. Hot Potato Book

| Eintrag | Wert | Quelle | Stand |
|---|---|---|---|
| Hot Potato Book, Rüstung | +2 Defense, +4 Health je Buch | NEU `HOT_POTATO_BOOK` | sicher |
| Hot Potato Book, Waffe | +2 Strength, +2 Damage je Buch | NEU | sicher |
| Maximum | 10 Bücher | NEU | sicher |
| Fuming Potato Book | gleiche Werte je Buch (Rüstung +2 Defense/+4 Health, Waffe +2 Strength/+2 Damage), insgesamt bis 15 Bücher, also +5 über 10 | NEU `FUMING_POTATO_BOOK` | sicher |
| Fusion-Style Potato verdoppelt Fuming? | **nicht beantwortet** | Wiki "Hot Potato Book" sagt nichts dazu | unsicher |

Das Wiki fasst die Seite nicht brauchbar zusammen (Werte vertauscht und "5-Bücher-Grenze" nicht genannt); die Zahlen oben stammen deshalb aus NEU und passen zu deinen Angaben. Wirkung auf Blaze/Frozen Blaze mit Lv-100-Pet: 2,8-fach (s. o.), auf alle anderen Teile 2-fach.

## 4. Enchants (die 46 offenen)

Art: **Stat** = fester Stat je Level; **Mult** = Schadens-Multiplikator; **Bedingt** = Mult nur unter einer Bedingung; **Kein Dauer-Stat** = ohne Wirkung auf Stats oder Schaden pro Treffer. Quelle für alle Zeilen: Wiki "Enchantments", die Ultimates Wiki "Ultimate Enchantments". "Boss?": gilt gegen Blaze-Bosse? Das Wiki führt für Inferno Demonlord (Tier I–IV) und die Mini-Bosse Flare Demon, Kindleheart Demon, Burningsoul Demon als Mob-Typ nur **Infernal**. Quazii und Typhoeus (Wither Skeleton / Pigman im Aussehen) und die Pillars haben im Wiki keinen Typ.

| Enchant | Art | Wert je Level | Boss? | Stand |
|---|---|---|---|---|
| pyroclasm | Bedingt | I–VI: 10 / 20 / 30 / 40 / 60 / 80 % | nein (Magmatic) | sicher |
| execute | Bedingt | I–VI: 0,2 / 0,4 / 0,6 / 0,8 / 1 / 1,25 % je 1 % fehlender Gegner-Health | ja, hängt von der fehlenden Health des Ziels ab | sicher |
| fire_aspect | Bedingt | I: 3 s, 3 %; II: 4 s, 6 %; III: 4 s, 9 % des eigenen Schadens je Sekunde | ja | sicher |
| giant_killer | Bedingt | I–VII: 0,1 / 0,2 / 0,3 / 0,4 / 0,6 / 0,9 / 1,2 % je 1 % Mehr-Health des Ziels, Deckel 5 / 10 / 15 / 20 / 30 / 45 / 65 % | ja (Boss hat mehr Health), hängt vom Verhältnis ab | unsicher (Trivia widerspricht der Tabelle) |
| gravity | Bedingt | I–VI: 5 / 10 / 15 / 20 / 30 / 40 % | nein (Airborne) | sicher |
| lethality | Bedingt | I–VI: Ziel-Defense −1,2 / −2,4 / −3,6 / −4,8 / −6 / −9 % je Treffer, 4 s, bis 4 Stacks | ja | sicher |
| smite | Bedingt | I–VII: 5 / 10 / 15 / 20 / 30 / 40 / 50 % | nein, es sei denn Quazii/Typhoeus zählen als Skeletal/Wither/Undead | unsicher (Typ der Phasen fehlt) |
| thunderlord | Bedingt | I–VII: 8 / 16 / 24 / 32 / 40 / 50 / 60 % des Trefferschadens, jeder 3. Treffer | ja | sicher |
| triple_strike | Bedingt | I–V: 10 / 20 / 30 / 40 / 50 %, die ersten drei Treffer pro Mob | ja | sicher |
| strong_vitality | Stat, bedingt | X: 20 % der verbrauchten Vitality als Strength für 10 s, Deckel 15 Strength | nein (Vitality ist nicht in den Blaze-Stats) | sicher |
| cayenne | Stat | IV: 0,8 Health und 0,4 True Defense; V: 1 Health und 0,5 True Defense, jeweils je Ziffer der Accessory Power | ja | unsicher: nicht klar, ob je Teil oder gesamt, und welche Ziffern (MP 1100 = 4 Ziffern) |
| ultimate_swarm | Bedingt | I–V: 2 / 4 / 6 / 8 / 10 % Schaden je Gegner im Umkreis von 10 Blöcken, max. 10 Gegner | ja, abhängig von Gegnerzahl | sicher |
| ultimate_chimera | Stat (Pet) | I–V: 20 / 40 / 60 / 80 / 100 % der Stats des aktiven Pets | ja | Wert sicher; Umfang (alle Pet-Stats, nicht Perks) unsicher |
| ultimate_last_stand | Bedingt | I–V: unter 40 % Health, 30 s Abklingzeit: +5 / 10 / 15 / 20 / 25 % Defense und +2 / 4 / 6 / 8 / 10 % Vitality-Regeneration | ja | sicher |
| ultimate_refrigerate | Bedingt | I–V: 3 / 3,75 / 4,5 / 5,25 / 6 % des verbrauchten Manas als Defense für 10 s, bis 150 Defense je Teil | ja | sicher |
| ultimate_habanero_tactics | Mult | IV: 6 % mehr Heilung durch Wands / +20 % Schaden mit Slayer-Waffen / +2,5 Combat Wisdom / +10 Magic Find mit "Smoldering Polarization"; V: 7,5 / +25 % / +5 / +15 | ja | Werte sicher; Stapelart des Schadens unsicher |
| ultimate_one_for_all | Mult | I: +500 % Schaden, entfernt alle anderen Enchants | ja | sicher (steht in `blaze.js`) |

Bereits in der App und gegen das Wiki geprüft (stimmen): critical 10 / 20 / 30 / 40 / 50 / 70 / 100; growth 15 … 105; protection 4 … 30; prosperity 3 … 15; true_protection I = 5 nur Brustplatte; sharpness 5 … 50 %; smoldering 5 / 10 / 15 / 20 / 30 %.
Zusätzlich aus dem Wiki: Rejuvenate I–V = Health Regen 1–5 (nicht in Blaze-Stats, deine Antwort 5); Quantum = Vitality an Wochentagen und Wisdom am Wochenende, nur Necklace; Transylvanian IV / V = 2 / 3 Heilung je Gegner im Umkreis 10 Blöcke, Deckel 20 / 30, nur Helm; Life Steal, Vampirism, Looting = Heilung oder Drops. Stand: sicher.

Wirkung auf Stats statt Schaden haben nur cayenne (2 Teile), strong_vitality (1) und chimera (5). Gegen Blaze-Bosse nicht wirksam: pyroclasm (2 Teile), gravity (2) und, solange offen, smite (3).

## 5. Attribute (die 16 leeren, Wiki "Attributes")

Das Wiki nennt nur den Bereich Level I bis X (min–max), nicht je Level. `attributes.json` rechnet linear (`effect = perLevel × level`); der Wiki-Bereich ist mit 3 %–30 % usw. dazu passend. Stand der Linearität: unsicher.

| Attribut | Art | Wert (Level I–X) | Gilt für Blaze-Bosse? | Stand |
|---|---|---|---|---|
| infernal_ruler (Guide: "blazing") | Mult, vs Infernal | +3 % bis +30 % Schaden | **ja** (Boss und Mini-Bosse sind Infernal) | sicher |
| skeletal_ruler | Mult, vs Skeletal | +3 % bis +30 % | nein | sicher |
| humanoid_ruler | Mult, vs Humanoid | +3 % bis +30 % | nein, außer Quazii/Typhoeus zählen als Humanoid | unsicher |
| undead_ruler | Mult, vs Undead | +3 % bis +30 % | nein | sicher |
| airborne_ruler | Mult, vs Airborne | +3 % bis +30 % | nein | sicher |
| elite | Mult, vs Bosse und Mini-Bosse | +3 % bis +30 % | **ja** | sicher |
| warrior | Mult, Nahkampf | +2,5 % bis +25 % | **ja** | sicher |
| dominance | Mult, bei voller Health | +1,5 % bis +15 % | ja, nur solange volle Health | sicher |
| lifeline | Mult und Defense, unter 20 % Health | +2,5 % bis +25 % | nur unter 20 % Health | sicher |
| payback | Mult, nach einem Treffer auf dich | +2 % bis +20 % | bedingt | sicher |
| unlimited_fortitude (Guide: "fortitude") | Mult auf Defense | +0,2 % bis +2 % | ja | sicher |
| help_from_above (Guide: "life_regeneration") | Health Regen | +1,25 bis +12,5 | nicht in Blaze-Stats | sicher |
| mana_steal | Mana je Treffer | +0,5 bis +5, Abklingzeit 0,5 s | kein Stat | sicher |
| combo | Mult, je Grandma-Wolf-Combo | +0,1 % bis +1 %, max. 50 Combo | nur mit Grandma Wolf | sicher |
| ignition | Feuerdauer | +30 % bis +300 % | kein Stat | sicher |
| shell | Rückstoß negieren | +10 % bis +100 % Chance | kein Stat | sicher |

Zu den schon belegten Attributen: `blazing_resistance` = +4 bis +40 Defense gegen **Infernal** (gilt für Blaze-Bosse, in `attributes.json` mit `cond: vs_mob_family`), `undead_resistance` +4 bis +40 Defense gegen Undead (gilt nicht), `veil` +1 bis +10 True Defense, `attack_speed` +1 bis +10 Attack Speed, `flying_fortune` / `subterranean_fortune` Magic Find auf Airborne / Subterranean (gilt nicht). `skeletal_resistance` und `airborne_resistance` wurden nicht einzeln gelesen (Muster wie `undead_resistance`, gelten nicht für Infernal).

Mob-Familie bei Blaze-Bossen: nur **Infernal** sicher. Tier V ist auf der Slayer-Seite nicht aufgeführt.

## 6. Reforge-Tabellen gegen das Wiki (Seiten "Reforging/Sword", "/Armor", "/Equipment")

| Reforge | `optimizer-data.js` | Wiki | Ergebnis |
|---|---|---|---|
| fabled | Strength 30 / 35 / 40 / 50 / 60 / 75 / 90, Crit Damage 15 / 20 / 25 / 32 / 40 / 50 / 65 | gleich | stimmt |
| withered | Strength 60 / 75 / 90 / 110 / 135 / 170 / 220 | gleich | stimmt; zusätzlich "+1 Strength je Catacombs-Level" |
| coldfused | Strength 15 / 20 / 25 / 35 / 45 / 55 / 65, Crit Damage 20 / 30 / 40 / 50 / 60 / 70 / 90; Wisp +75 Strength, +55 Crit Damage | gleich, dazu **Magic Find 2** auf jeder Stufe und "bricht man ein Wisp, +30 True Defense und +15 % Schaden für 60 s" | Magic Find 2 fehlt (Misc-Stat, wird von Nether Embodiment erhöht) |
| ancient | Strength 4 / 8 / 12 / 18 / 25 / 35 / 50, Crit Chance 3 / 5 / 7 / 9 / 12 / 15 / 20, Health 7, Defense 7 | gleich, dazu **Intelligence 6 / 9 / 12 / 16 / 20 / 25 / 30**; "+1 Crit Damage je Catacombs-Level" | Intelligence fehlt |
| strengthened | Strength 2 … 8, Defense 3, 4, 5, 6, 8, 10, 12 | gleich | stimmt |
| glistening | True Defense 2 / 2,5 / 3 / 3,5 / 4 / 4,5 / 5 | gleich, dazu **Intelligence 5 / 6 / 8 / 10 / 12 / 15 / 18** | Intelligence fehlt |
| blood_soaked | Health 6 / 8 / 8 / 9 / 10 / 12 / 14, Defense 1 … 7 | gleich, dazu Vitality 1 / 1 / 2 / 2 / 3 / 3 / 4 | stimmt (Vitality bewusst nicht) |
| bloodshot | Strength, Crit Chance, Crit Damage je 1 … 7 | gleich | stimmt |

Zielplatz laut Wiki: fabled/withered/coldfused = Sword; ancient = Armor (Precursor Gear); blood_soaked = nur Cloak; bloodshot = nur Belt; strengthened und glistening = Equipment, **welcher Slot, steht nicht auf der Seite** (der Guide nutzt Necklace und Gloves). Die Spalte "Rarität je Zeile" ist bei den Wiki-Seiten nicht beschriftet; die Zuordnung COMMON bis DIVINE folgt der Reihenfolge der Zeilen (unsicher, passt aber zum Code und zu den Kontrollwerten).

Offen aus den Boni: Withered "+1 Strength je Catacombs-Level" und Ancient "+1 Crit Damage je Catacombs-Level" sind Dauer-Boni, die vom Catacombs-Level abhängen. Das Wiki nennt keine Einschränkung auf Dungeons. Dafür braucht der Build ein Feld "Catacombs-Level". Stand: unsicher.

## 7. Stat-Schlüssel (Antwort 5)

Anpassung für später: `HEALTH_REGENERATION` → `HEALTH_REGEN`, `WALK_SPEED` → `SPEED`. In `items.json` betrifft das 9 und 5 Items.

## 8. Nicht gefunden (dafür Screenshots oder Prüfung im Spiel)

1. **Combat / Misc / Wisdom je Stat**: kommt aus deinen /stats-Screenshots (Wiki nennt es nicht).
2. **Fuming Potato Book mit Fusion-Style Potato**: Wiki schweigt. Im Spiel an einem Teil mit 15 Büchern und Pet an/aus prüfen.
3. **Crimson-Sterne außerhalb Kuudra**: Wiki schweigt. Prüfen: Rüstung mit Sternen, Pet aus, Stats in Kuudra und auf Crimson Isle vergleichen.
4. **Mob-Typ von Quazii, Typhoeus, Pillars**: Wiki nennt keinen. Entscheidet über Smite (3 Teile) und Humanoid Ruler.
5. **Chimera**: Umfang genau (alle Pet-Stats?). Im Spiel Waffe mit Chimera V und Pet an/aus vergleichen.
6. **Cayenne**: je Teil oder gesamt, welche Ziffern der Accessory Power.
7. **Dominus-Verfall** (4 / 7 / 10 s) und Verhalten gemischter Sets.
8. **Warden Helmet Brute Force**: genaue Formel (Wiki "+20 %" plus "+1 %" je 25 Speed).
9. **Strengthened / Glistening**: erlaubte Equipment-Slots.
10. **Withered / Ancient**: gilt der Catacombs-Bonus außerhalb von Dungeons?
11. **Sorrow Armor Magic Find**: seit 2026-10-15 angeblich entfernt, Seite zeigt es noch.
12. **Habanero Tactics**: Schadensbonus additiv oder multiplikativ zu den übrigen.
13. **Skeletal Resistance, Airborne Resistance**: Seite nicht einzeln gelesen.
14. **Tier V** des Blaze Slayers: Mob-Typen auf dem Wiki nicht aufgeführt.
15. **Giant Killer**: Tabelle und Trivia widersprechen sich.
16. **Ferocity aus Dominus** (Burning bis Infernal, bis 20 bei 10 Stacks): zählt Ferocity in die Blaze-Stats? Ferocity steht heute nicht in `AREA_STATS.blaze`.

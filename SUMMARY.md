# Version 6 (UX) – Zusammenfassung

Stand: 2026-10-10. Alles liegt auf dem lokalen Branch `v6` (ab `main`, Version
5.1.0). Nichts ist gepusht; `main`, die Live-Seite und der Branch `data` sind
unverändert. Frühere Zusammenfassungen: `docs/summary-v2.md`,
`docs/summary-android.md`, `docs/summary-v3.md`, `docs/summary-v4.md`,
`docs/summary-v5.md`.

Grundlage ist `docs/ux-audit.md`, der Plan steht in `docs/plan-v6.md`, die
Entscheidungen in `DECISIONS.md`, Abschnitt „Entscheidungen Version 6 (UX)“.

## Fertig

| Nr. | Punkt | Umsetzung |
|---|---|---|
| 0 | Einstellungen entwirren | Vier Felder tragen ihren Bereich im Namen: „Min. volume/week (Flips & NPC)“, „Min. margin % (Opportunities)“, „Min. volume/week (Opportunities)“, „Min. margin % (Favorite alerts)“. Das Portfolio gibt einem Flip höchstens „Max. capital per flip“; die Hilfetexte beider Felder sagen das. |
| 1 | Touren | Erster Start: Welcome → Basis-Tour → Setup. „Skip“ bietet das Setup trotzdem einmal an. Basis-Tour: A flip, Two numbers, Badges, Opportunities, Find, sort, favorites, Settings and help. Advanced-Tour in Tab-Reihenfolge (Trends, Event radar, Portfolio, Forge, in der Android-App zusätzlich Alerts), Forge in zwei Sätzen, Angebot nennt 4 oder 5 Stationen. Sie startet nur noch über `?` und beim ersten Wechsel auf Pro. |
| 2 | Kontext-Hinweise | 13 Hinweise, einmalig, als Zeile im Seitenfluss mit „Got it“, gespeichert in `bt.hints`: card, detail, suspicious, fav, opps, portfolio, npc, craft, forge, radar, search, settings, alerts. Bestandsnutzer sehen keinen; „Show hints again“ im Hilfe-Fenster holt sie zurück. |
| 3 | How it works | 14 Abschnitte zum Aufklappen. Neu: What a flip is, Suspicious (vier Regeln), Favorites, NPC flips, Craft flips, Portfolio, Volume per week; Events mit der Dreier-Regel; Forge gekürzt. |
| 4 | Einfach und Profi | Umschalter und „Start setup“ oben in den Einstellungen. Neue Nutzer starten in Simple, Bestandsnutzer in Pro. Simple: Tabs Flips und Opportunities, Karte mit Profit/h, Margin, Buy order, Sell offer, Stabilität und suspicious, zwei Sortierungen, zwei Einstellungen (Tax, Total capital), in der Android-App dazu Market alerts. Der erste Wechsel auf Pro bietet die Advanced-Tour an. |
| – | Changelog | Version 6.0.0 mit vier Einträgen. |

Die Bewertungslogik ist bis auf `portfolio()` unverändert: `npc.js`,
`craft.js`, `forge.js`, `history.js`, `trends.js`, `timing.js`, `events.js`
und der Android-Code unter `java/` haben gegenüber `main` keine Änderung. In
`flips.js` sind es drei Zeilen in `portfolio()`.

Nebenbei behoben: Das Tour-Spotlight verlor sein Ziel, wenn die Liste während
einer Station neu gezeichnet wurde.

## Was sich für Bestandsnutzer ändert

- Sie bleiben in Pro und sehen nach dem Update nur das What's-new-Fenster.
- Das Portfolio kann kleiner ausfallen: Wer „Max. capital per flip“ unter
  Total capital ÷ Parallel flips gesetzt hat, bekommt jetzt diese Obergrenze.
  Mit den Standardwerten (5M, 50M, 10) ändert sich nichts.
- Im Radar heißt es statt „Buy before / Sell during: the 24h before the
  start, then the 6h it runs“ jetzt „Buy in the 24h before it starts, sell
  during the 6h it runs“.

## Wie geprüft wurde

- `node --test`: 192 Tests grün (vorher 181). Kein Test ruft die Hypixel-API
  auf.
- `gradlew testDebugUnitTest`: grün (Android-Logik unverändert).
- Browser (Edge, ohne Fenster) bei 360 × 740 und 1440 × 900, mit den
  Snapshot-Dateien des lokalen Stands von `origin/data` und daraus erzeugten
  Bazaar-Preisen; kein Live-Abruf. Drei Durchläufe je Größe, 90 automatische
  Prüfungen, alle bestanden, keine JavaScript-Fehler, 72 Bilder erzeugt, 16
  davon selbst angesehen.
- `npm run android:build` läuft fehlerfrei; die APK meldet `versionName
  6.0.0`, `versionCode 60000` und enthält die neue `onboarding.js`.

Die drei Durchläufe im Browser:

| Durchlauf | Geprüft |
|---|---|
| A: neuer Nutzer nimmt die Tour | Kein Hinweis neben dem Welcome-Fenster; sechs Stationen mit den neuen Titeln; danach das Setup mit drei Fragen und sechs Zeilen in der Übersicht; Modus Simple; zwei Tabs; Radar aus; Karte ohne Profit/item; zwei Sortierungen; `#/forge` öffnet Flips; Hinweise portfolio, fav, search, detail, settings erscheinen und verschwinden nach „Got it“; Detailseite mit einem Diagramm; zwei Felder in den Einstellungen; Total capital 80M setzt Max. capital per flip auf 8M; Wechsel auf Pro zeigt das Angebot mit „4 short stops“; Advanced-Tour in der neuen Reihenfolge; fünf Tabs, fünf Sortierungen; Hinweise npc und craft; kein Hinweis für forge und radar nach der Tour; das Angebot kommt kein zweites Mal; Neuladen behält Pro und zeigt kein Fenster. |
| B: neuer Nutzer überspringt | „Skip“ zeigt das Setup-Angebot; Hinweise card und opps; zweiter Start bleibt in Simple und behält ungesehene Hinweise; nach Wechsel auf Pro ohne Tour: Hinweise forge, radar und suspicious. |
| C: Bestandsnutzer von 5.1.0 | What's new zeigt nur 6.0.0; Modus Pro; fünf Tabs; kein Hinweis, auch nicht im NPC-Tab; elf Felder in den Einstellungen; Hilfe mit 14 zugeklappten Abschnitten; „Show hints again“ bringt einen Hinweis zurück. |

## Tests

| Datei | Neu in v6 |
|---|---|
| `tests/flips.test.js` | Portfolio: Obergrenze durch „Max. capital per flip“ greift, eine höhere Grenze und 0 ändern nichts, zu teure Items fallen heraus |
| `tests/onboarding.test.js` | Basis-Tour mit neuen Titeln, Texten und nur Simple-Zielen; Advanced-Tour in Tab-Reihenfolge mit kurzer Forge-Station; Angebot mit Stationszahl je Plattform; Setup-Angebot nach „Skip“; Hilfe mit 14 aufklappbaren Abschnitten, den vier Suspicious-Regeln und der Dreier-Regel; Hilfe im Simple-Modus; 13 Hinweise mit Text und Ort; Auswahl des einen passenden Hinweises; Bestandsnutzer gegen neue Nutzer; Tour-Stationen und ihre Hinweise; Setup im Simple-Modus; Seite mit Modus-Schalter, `pro`-Markierungen und eindeutigen Feldnamen |
| `tests/render.test.js` | `pro`-Markierungen auf Karte und Detailseite; Tab-Liste je Modus, Wischen bleibt im Simple-Modus bei zwei Tabs; neuer Radar-Satz |

## Offen und bekannt

- Nicht geprüft: echtes Gerät und Emulator. Die APK ist gebaut, aber nicht
  installiert. Damit ungeprüft: der Alerts-Hinweis (nur in der Android-App
  sichtbar), die fünfte Station der Advanced-Tour, „5 short stops“ im
  Angebot und die Zeile „Market alerts“ in den Simple-Einstellungen. Die
  Texte und die Stationszahl sind in Node getestet.
- Nicht geprüft: Wischen zwischen den Tabs im Browser (die Logik ist in Node
  getestet) und „Bewegung reduzieren“ aus (die Bilder entstanden mit
  reduzierter Bewegung).
- Die Bazaar-Preise der Sichtprüfung sind erzeugt, nicht echt; viele Karten
  zeigen deshalb denselben Profit/h.
- „Show me“ in What's new zeigt im Simple-Modus mittig, wenn das Ziel
  ausgeblendet ist. Betrifft erst das nächste Update.
- Die Simple-Einstellungen zeigen kurz zwei „Start setup“-Knöpfe: einen im
  Hinweis, einen im Abschnitt „Mode“. Der Hinweis verschwindet nach „Got it“.
- `docs/ux-audit.md` beschreibt den Stand vor v6 und ist nicht nachgeführt.

## Zum Testen

Lokal: `node scripts/serve.mjs`, dann http://127.0.0.1:8123. Die App liest
dann `./data/`; ohne diesen Ordner fehlen Verlauf, Forge und Radar-Mayor,
und Opportunities bleibt leer.

Als neuer Nutzer: Website-Daten löschen und neu laden. Als Bestandsnutzer
kommt man mit `?` → „Show hints again“ an die Hinweise und über die
Einstellungen an den Simple-Modus.

APK: `android/app/build/outputs/apk/debug/app-debug.apk`.

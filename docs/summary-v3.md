# Version 3 (Qualität + Design) – Zusammenfassung

Stand: 2026-10-09. Alles liegt auf dem lokalen Branch `v3`. Nichts ist
gepusht; `main` und die Live-Seite sind unverändert. Die früheren
Zusammenfassungen liegen in `docs/summary-v2.md` und
`docs/summary-android.md`.

## Fertig

### Datenqualität

| Nr. | Punkt | Umsetzung |
|---|---|---|
| 1 | Suspicious über den Median | Sell-Preis mehr als 30 % über dem 7-Tage-Median → „suspicious“ (`MEDIAN_SPIKE = 0.3`) |
| 2 | Orderbuch-Tiefe | verworfen: Preis bleibt die oberste Order, per Test mit echten Orderbüchern abgesichert |
| 3 | „provisional“ | unter 24 h Verlauf: eigenes Badge, kein Score, nicht in Opportunities, keine Market Alerts (`PROVISIONAL_HOURS = 24`) |
| 4 | Median als Kontext | „normal: X“ neben dem Sell-Preis auf Karte und Detailseite |

Die Regeln stehen mit denselben Konstanten und denselben Testfällen in
`flips.js` und `AlertLogic.java`. Der Workflow schreibt dafür die neue Datei
`stats.json` (Score, Median, Stunden Verlauf pro Item).

### Design

| Nr. | Punkt | Umsetzung |
|---|---|---|
| 5 | Kartenhierarchie | Profit/h und Margin groß, übrige Werte klein und gedämpft |
| 6 | Desktop | ab 900 px mehrspaltiges Raster, Charts nebeneinander, Einstellungen in Spalten |
| 7 | Icons | eigene Inline-SVGs (Refresh, Settings, Stern, Zurück, Warnung) |
| 8 | Einstellungen | vier Gruppen (Calculation, List, Opportunities, Favorite alerts), Erklärsatz unter jeder Option |
| 9 | Charts | vier Hilfslinien mit Werten; Antippen oder Überfahren zeigt Zeit und Werte |
| 10 | Name | überall „Bazaar Flip Helper“ |
| 11 | Farben | Schwarz `#0D0D0D`, Karten `#1A1A1A`, Akzent Orange `#FF8A00`; Gewinn grün, Verlust rot, suspicious gelb; Badges grün / blau / rosa / grau gestrichelt |
| 11 | Icon und Splash | drei aufsteigende orange Balken auf Schwarz, für PWA und Android |
| 11 | Systemfarben | Manifest, Android-Theme, Statusleisten-Symbol angepasst |

Nebenbei behoben: Die Einstellungen lagen im festgehefteten Kopf und waren am
Handy unten abgeschnitten (das Feld „Min. margin %“ der Favoriten-Alerts war
nicht erreichbar). Sie liegen jetzt darunter und scrollen mit.

## Wie geprüft wurde

- `node --test`: 90 Tests grün (vorher 70). Neu: Preis der obersten Order,
  Median-Regel, provisional, `stats.json`, Chart-Hilfslinien und Trefferpunkt,
  Kontrast.
- `gradlew testDebugUnitTest`: 19 Java-Tests grün (vorher 15), mit denselben
  Zahlen wie die Web-Tests.
- Kontrast: Jede Textfarbe erreicht auf jeder Fläche mindestens 4,5 : 1
  (WCAG AA); der Test schlägt auch fehl, wenn eine Farbe direkt in eine
  CSS-Regel geschrieben wird oder der Akzent als Bedeutungsfarbe auftaucht.
- `npm run android:build` (führt `gradlew assembleDebug` aus) läuft fehlerfrei.
- Screenshots, selbst angesehen:
  - Desktop 1440 px: Liste (vier Spalten), Detailseite, offene Einstellungen.
  - Handy 360 px (Emulator, Android 15): Splash, Liste, Detailseite,
    Einstellungen.
  - Dabei behoben: Der Titel brach bei 360 px in zwei Zeilen um; der Stern auf
    der Detailseite stand am Desktop weit rechts außen.
- Chart am Handy: Berühren zeigt die gestrichelte Linie und z. B.
  „9 Oct, 16:50 · Buy order 1,031.1 · Sell offer 1,348.9“.
- Kein Deutsch in den 30 ausgelieferten Dateien; alter Name „Bazaar Flips“
  kommt nicht mehr vor.

## Wichtig zu wissen

- **Die Orderbuch-Tiefe ist wieder draußen.** Der zuerst gebaute
  1000-Stück-Durchschnitt überschätzte die Marge (bei 251 von 367 Flips höher
  als mit der obersten Order). Der Preis ist wieder die oberste Order. Ein
  Test mit 30 echten Orderbüchern sichert in Web und Java ab, dass die Marge
  nie darüber liegt. Details in `DECISIONS.md`.
- **Badges und „normal: X“ erscheinen erst nach dem Push.** Die App liest
  `stats.json` aus dem Branch `data`; die Datei entsteht erst, wenn der
  Workflow mit dem neuen Skript von `main` gelaufen ist. Bis dahin zeigt die
  neue Fassung keine Badges, und „Opportunities“ bleibt leer.
- **Danach sind zunächst alle Items „provisional“**, bis 24 Stunden Verlauf
  da sind. Opportunities und Market Alerts liefern also frühestens einen Tag
  nach dem ersten Snapshot etwas.
- Der Verlauf bekommt am Umstellungstag einen kleinen Sprung, weil Snapshots
  ab dann den Tiefenpreis speichern.

## Nicht geprüft

- Kein echtes Handy, nur Emulator.
- Badges, „normal: X“ und die Median-Regel in der App: im Browser mit
  künstlich gemischten Kennzahlen gesehen, in der Android-App nicht (dort gibt
  es noch keine `stats.json`).
- Market Alerts mit den neuen Regeln: nur per Unit-Test.
- Chart-Anzeige mit der Maus (Desktop): nur die Rechenfunktion ist getestet,
  das Überfahren selbst nicht.
- Die Liste bei 360 px im Desktop-Browser; geprüft wurde 360 px im Emulator.
- Die installierte PWA nach dem Update (neues Icon, neue Farben).

## APK

```
android\app\build\outputs\apk\debug\app-debug.apk
```

Relativ zum Projektordner, rund 8 MB. Sie lässt sich über die bestehende App
installieren; Favoriten und Einstellungen bleiben erhalten.

## Veröffentlichen

1. `git switch main`, `git merge --ff-only v3`, `git push`
2. Unter Actions den Workflow „snapshot“ einmal von Hand starten (oder bis zu
   20 Minuten warten). Danach gibt es `stats.json`.

## Testliste

Sofort, lokal (`node scripts/serve.mjs`, dann http://127.0.0.1:8123, vorher
`node scripts/snapshot.mjs data`):

1. Liste am PC: mehrere Spalten, große Zahlen Profit/h und Margin, kleine
   Zeile darunter.
2. Fenster schmal ziehen: unter 900 px eine Spalte, Titel bleibt einzeilig.
3. Einstellungen öffnen: vier Gruppen, unter jedem Feld ein Erklärsatz; am
   Handy bis zum letzten Feld scrollbar.
4. Detailseite: zwei Charts mit Hilfslinien. Mit der Maus darüberfahren: Zeile
   über dem Chart zeigt Zeit und Werte, gestrichelte Linie folgt.
5. Favorit mit Verlust (Stern setzen bei einem Item mit negativer Marge, z. B.
   über die Suche): Zahlen sind rot, nicht orange.

In der App (neue APK):

6. Neues Icon (orange Balken) und neuer Splash; Statusleiste schwarz.
7. Chart antippen und Finger ziehen: Werte ändern sich.
8. Benachrichtigung zeigt das neue Balken-Symbol.

Nach dem Push:

9. Erster Workflow-Lauf grün, `stats.json` liegt im Branch `data`.
10. Karten zeigen „provisional“ und „normal: X“.
11. Nach 24 Stunden: Badges stable / medium / unstable erscheinen,
    „Opportunities“ füllt sich.
12. Ein Item mit Preissprung prüfen: Liegt der Sell-Preis klar über
    „normal“, trägt es „suspicious“.
13. Stichprobe im Spiel: Der angezeigte Buy-Order-Preis ist die höchste
    Buy-Order, der Sell-Offer-Preis das niedrigste Sell-Offer im Bazaar.

## Offen

- Schwellen sind Annahmen: 30 % über Median, 24 h, Score 70. Nach ein paar
  Tagen echter Daten ansehen.
- Im Chart skaliert die Schrift am Desktop mit und wirkt dort groß.
- Die Einstellungen sind am Handy lang (vier Gruppen untereinander).
- Kein Light Mode, kein Verlauf über 7 Tage hinaus, kein Volumen-Chart.
- NPC- und Craft-Karten haben weiterhin kein Suspicious-Badge.

## Nachtrag: Design-Feinschliff

Eingebaut ist Variante C („Forge“): warmes Schwarz mit Punktraster,
unterstrichene Tabs, Seltenheit als farbiger Streifen und Wort auf jeder
Karte, breitere Detailseite am Desktop. Zusätzlich zu testen:

1. Karten zeigen links einen farbigen Streifen und oben rechts die Seltenheit
   (COMMON, UNCOMMON, RARE …); Item-Namen sind weiß.
2. Detailseite am PC: große Zahlen und Preistabelle stehen in einer Zeile.
3. Tab „Opportunities“: Karten haben einen orangen Rahmen.
4. Nach einem Refresh leuchten geänderte große Zahlen kurz auf. Mit
   „Bewegung reduzieren“ in den Systemeinstellungen passiert das nicht.

Vergleichsbilder aller Varianten: `docs/design-varianten/`.

## Nachtrag: Wischen und Portfolio

- **Wischen:** Auf einer Liste nach links oder rechts wischen wechselt den
  Tab.
- **Portfolio:** Oben im Tab „Opportunities“ steht ein Plan: Gesamtkapital
  gleichmäßig auf mehrere parallele Flips verteilt, Summe Profit/h groß,
  darunter die gewählten Items mit Einsatz und Profit/h. Einstellungen unter
  „Portfolio“: Total capital (Standard 50 Mio.), Parallel flips (Standard 10).

Zu testen:

1. Wischen links/rechts auf jeder Liste; Scrollen wechselt keinen Tab.
2. Solange alle Items „provisional“ sind, steht im Portfolio „No flip
   qualifies …“. Sobald Opportunities erscheinen, füllt es sich.
3. Total capital und Parallel flips ändern: Budget pro Flip und Auswahl ändern
   sich; Total capital 0 zeigt den Hinweis, ein Kapital zu setzen.
4. Market share ändern: Der Hinweis „Assumes X% market share …“ zeigt den
   neuen Wert, die Summe skaliert mit.
5. Ein Item im Portfolio antippen: öffnet die Detailseite.

Nicht geprüft: das Portfolio mit echten Kennzahlen (noch ist alles
„provisional“); gesehen habe ich es mit künstlich gemischten Kennzahlen am
Desktop und bei 360 px.

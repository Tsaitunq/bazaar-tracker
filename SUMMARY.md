# Version 5 (Forge, Events & Trends) – Zusammenfassung

Stand: 2026-10-10. Alles liegt auf dem lokalen Branch `v5` (ab `main`, Version
4.2.0). Nichts ist gepusht; `main`, die Live-Seite und der Branch `data` sind
unverändert. Frühere Zusammenfassungen: `docs/summary-v2.md`,
`docs/summary-android.md`, `docs/summary-v3.md`, `docs/summary-v4.md`.

## Wichtig vor dem Testen

Forge-Rezepte, AH-Preise, Mayor und Trendwerte liefert der Snapshot-Workflow.
Er läuft mit den Skripten von `main`. Solange `v5` nicht gemergt ist und der
Workflow nicht einmal gelaufen ist, zeigt die App: Forge-Tab „No recipe data
yet“, Radar ohne Mayor, keine Trend-Pfeile (nur „below/above normal“). Das ist
im Emulator so geprüft. Nach dem Merge füllt der erste Lauf alles.

## Fertig

| Nr. | Punkt | Umsetzung |
|---|---|---|
| 1 | Forge-Flips | Tab „Forge“: Rezepte aus dem NEU-Repo, Zutaten zum Buy-Order-Preis, Ergebnis im Bazaar oder per Lowest BIN minus AH-Gebühren. Karte mit Profit/forge hour, Margin, Profit/item, Dauer, HotM-Stufe, Zutaten. Badge „AH sale – estimate“ mit Hinweis. Filter „Bazaar only / Incl. AH“, Einstellung „HotM tier“. |
| 1 | Fünf Tabs | Tab-Leiste scrollt horizontal und holt den aktiven Tab ins Bild; bei 360 px passen alle fünf. Wischen erreicht „Forge“. |
| 2 | Event-Radar | Einklappbare Karte über jeder Liste: Mayor, Perks, Minister, Wahl, Events mit Countdown. Jede Zeile klappt auf und nennt die Items, die „typically affected“ sind. Diese Items tragen ein Event-Badge. |
| 3 | Trends | Badge mit Pfeil (rising / falling / flat) und „below normal“ / „above normal“ auf Karte und Detailseite, Sortierung „Trend“. |
| 4 | Erklärung | Changelog 5.0.0 mit vier Einträgen und Spotlight-Zielen; „How it works“ um Forge, Events, Trends ergänzt. |
| Ergänzung | Tour | Basis-Tour mit 6 Stationen, danach das Angebot „Take the advanced tour?“; Advanced-Tour mit 4 Stationen (Android: 5). Beide über Help startbar. |
| Ergänzung | What's new | Nutzer von vor 5.0.0 sehen die v5-Einträge und den Button „Advanced tour“. |
| Ergänzung | Assistent | Zwei weitere Fragen: HotM-Stufe und „Include Auction House sales“. |

Die Bewertungslogik ist unverändert: `flips.js`, `npc.js`, `craft.js`,
`history.js` und der Android-Code unter `java/` haben gegenüber `main` keine
Änderung.

## Neue Daten aus dem Workflow

| Datei | Inhalt | Größe im Testlauf |
|---|---|---|
| `forge.json` | 62 Forge-Rezepte (30 mit Bazaar-Ergebnis, 32 mit AH-Ergebnis) | 5,9 KB |
| `ah.json` | Lowest BIN für 29 Forge-Ergebnisse | 0,8 KB |
| `election.json` | Mayor, Perks, Minister, laufende Wahl | 0,4 KB |
| `stats.json` | viertes Feld je Item: Trend | 82 KB (vorher rund 70 KB) |

Die Workflow-Datei selbst ist unverändert; die Zusatzabrufe stecken in
`scripts/snapshot.mjs`. Ein Lauf dauerte lokal 21 Sekunden (46 Auktionsseiten,
NEU-Klon inklusive).

## Wie geprüft wurde

- `node --test`: 160 Tests grün (vorher 119). Kein Test ruft die Hypixel-API
  auf.
- `gradlew testDebugUnitTest`: grün (Android-Logik unverändert).
- Workflow lokal gegen ein Test-Repo: Daten-Branch wiederhergestellt, ein
  Live-Lauf von `scripts/snapshot.mjs`, als einzelner Commit veröffentlicht,
  zweite Runde aus dem Test-Repo wiederhergestellt und erneut veröffentlicht.
  Ergebnis: ein Commit auf `data`, alle sieben Einträge vorhanden.
- Browser, 360 px und 1440 px, mit gespeicherten API-Antworten (keine
  Live-Abrufe, keine JavaScript-Fehler): What's new mit „Advanced tour“,
  Liste mit Radar und Trend-Badges, Radar aufgeklappt, Sortierung „Trend“,
  Forge-Tab mit beiden Filtern, Assistent mit den neuen Fragen bis „Apply“,
  Basis-Tour mit Angebot, Advanced-Tour, „Show me“. 46 Bilder erzeugt, 12
  davon selbst angesehen.
- Einzelprüfungen im Browser: Event-Badge „Mining Fiesta“ auf Refined Mineral
  in Liste und Detailseite; aufgeklappte Radar-Zeilen bleiben nach einem
  Neuzeichnen offen; HotM 5 blendet Rezepte über Stufe 5 aus.
- Android-Emulator (Android 15): APK 5.0.0 installiert, What's new erscheint,
  fünf Tabs passen, Radar und Forge-Tab verhalten sich ohne die neuen Daten
  wie oben beschrieben.
- `npm run android:build` läuft fehlerfrei; die APK meldet `versionName 5.0.0`,
  `versionCode 50000` und enthält `forge.js`, `events.js`, `trends.js`.

Dabei gefunden und behoben:

- `forge.json` wäre nach dem Update bis zu 24 Stunden ausgeblieben; sie wird
  jetzt geholt, sobald sie fehlt.
- Perk-Texte enthielten ein Spiel-Icon, das als leeres Kästchen erschien.
- Die Detailseite eines AH-Items zeigte fälschlich „provisional“.

## Tests

| Datei | Neu in v5 |
|---|---|
| `tests/forge.test.js` | AH-Gebühren nach Preisstufe; Bazaar-Ergebnis; AH-Ergebnis mit Coins als Kosten; Gewinn pro Stück und pro Forge-Stunde; Filter (HotM, Bazaar only, Kapital, Verlust, fehlende Preise); Sortierung und Stats |
| `tests/events.test.js` | SkyBlock-Jahr und Datum; Abgleich mit den Election-Daten; Reihenfolge der Events; nächster Termin über den Jahreswechsel; Perk-Events nur mit aktivem Perk; aktive Perks mit Minister; Wahlfenster; Event-Items; jede kuratierte ID steht in `docs/events-sources.md` |
| `tests/trends.test.js` | Steigung pro 24 h; nur die letzten 24 h zählen; Mindestpunkte und Mindestspanne; Schwellen für Richtung und Niveau |
| `tests/recipes.test.js` | Forge-Rezept lesen (Zutaten, Coins, Dauer, HotM); nur Bazaar-Zutaten, keine Pets |
| `tests/snapshot.test.js` | Item-ID aus gepackten Auktionsdaten; Lowest BIN; alle Seiten, ein Fehler verwirft alles; Election-Verdichtung mit und ohne laufende Wahl; Zusatzdateien und Verhalten bei Fehlern; Trend als viertes Feld |
| `tests/render.test.js` | Dauer-Format; Forge-Karte; AH-Badge mit Hinweis; Forge-Filter; Trend-Badge; Event-Badge; Radar (eingeklappt, aufgeklappt, laufende Wahl, ohne Mayor-Daten); fünf Tabs und Wischen |
| `tests/onboarding.test.js` | Basis-Tour mit sechs Stationen; Advanced-Tour; Angebot danach; Help mit beiden Touren und den neuen Erklärungen; „Advanced tour“ im What's-new-Fenster; Assistent mit fünf Antworten |
| `tests/contrast.test.js` | neue Farbe `--event` in der Kontrastprüfung |

## Offen und bekannt

- Der Lowest BIN ist ein einzelnes Angebot und kann daneben liegen. Einen
  Verlauf der AH-Preise gibt es nicht.
- „Profit/forge hour“ wirkt bei Rezepten mit 30 Sekunden Dauer sehr hoch; die
  Grenze ist dort der Verkauf, nicht die Schmiede.
- Rezepte mit geschmiedeten Zwischenteilen (höhere Drills) und Pets fehlen.
- Mining Fiesta erscheint als aktiver Perk ohne Countdown, weil sich die
  Quellen bei den Terminen widersprechen.
- Die Laufzeit-Gebühr einer Auktion und Derpys vierfache Steuer sind nicht
  eingerechnet.
- Die Detailseite eines AH-Items zeigt nur den Namen.
- Nicht geprüft: echtes Gerät, die Touren im Emulator, „Bewegung reduzieren“.

## Zum Testen

Lokal: `node scripts/serve.mjs`, dann http://127.0.0.1:8123. Die App liest
dann `./data/`; ohne diesen Ordner fehlen Verlauf, Forge und Radar-Mayor.
APK: `android/app/build/outputs/apk/debug/app-debug.apk`.
Entscheidungen: `DECISIONS.md`, Abschnitt „Entscheidungen Version 5“.

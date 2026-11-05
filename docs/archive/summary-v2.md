# Version 2 – Zusammenfassung

Stand: 2026-10-09. Alles liegt auf dem lokalen Branch `v2` (13 Commits vor
`main`). Nichts ist gepusht, `main` und die Live-Seite sind unverändert.

## Fertig

| Nr. | Feature | Kern-Dateien |
|---|---|---|
| 1 | Snapshot alle 20 Min in den Branch `data`, Daten älter als 7 Tage werden gelöscht | `.github/workflows/snapshot.yml`, `scripts/snapshot.mjs`, `history.js` |
| 2 | Detailseite pro Item mit Preis- und Marge-Chart (24h / 7d), eigenes SVG ohne Library | `chart.js`, `render.js`, `app.js` |
| 3 | Stabilitäts-Score (0–100) als Badge und Sortieroption „Stabilität“ | `history.js`, `scripts/snapshot.mjs`, `data.js` |
| 4 | Tab „NPC“: im Bazaar kaufen, an NPC verkaufen | `npc.js`, `names.js` |
| 5 | Tab „Craft“: Rezepte aus dem NEU-Repo, mit Zutatenliste und Gewinn | `scripts/recipes.mjs`, `craft.js` |
| 6 | Item-Bilder von sky.coflnet.com, Lazy-Loading, Platzhalter, Cache im Service Worker | `render.js`, `sw.js` |

Dazu: Tabs und Routen (`#/flips`, `#/npc`, `#/craft`, `#/item/<id>`), Fußzeile
mit Quellenangaben, Entwicklungsserver `scripts/serve.mjs`.

## Wie geprüft wurde

- `node --test`: 60 Tests, alle grün (V1 hatte 11).
- Jeder der 8 Tasks: eigener Implementierer, danach eigener Reviewer. Am Ende
  ein Review über den ganzen Branch: keine kritischen oder wichtigen Befunde.
- Echte Läufe: `scripts/snapshot.mjs` gegen die Hypixel-API (1803 Produkte,
  ca. 77 KB pro Snapshot) und gegen das NEU-Repo (314 Rezepte, 20 KB).
- Browser (Edge headless, 500 px breit) gegen die echte API: alle drei Tabs
  und die Detailseite, mit Screenshots.
- Die Git-Schritte des Workflows liefen lokal gegen ein Test-Repo: erster Lauf
  ohne Branch, zweiter Lauf mit Branch (weiterhin genau 1 Commit, alte Dateien
  bleiben), dritter Lauf mit kaputtem Remote (bricht ab, veröffentlicht nichts).

## Reviews haben drei echte Fehler gefunden (alle behoben)

1. Der Workflow hätte bei einem fehlgeschlagenen Clone des `data`-Branches den
   ganzen Verlauf mit einem fast leeren Stand überschrieben. Jetzt bricht er ab.
2. Die Detailseite blieb leer, solange oder falls die Hypixel-API nicht antwortete.
3. Nach „Zurück“ blieb der Inhalt der Detailseite unter der Liste stehen.

## Nicht geprüft

- **Der Workflow ist nie auf GitHub gelaufen** (kein Push erlaubt). Geprüft
  sind das Skript und die Git-Schritte einzeln, nicht das Zusammenspiel auf
  einem GitHub-Runner.
- Wie viel der Workflow pro Lauf tatsächlich hochlädt, ist nicht gemessen.
  Geprüft ist nur, dass er mit einem flachen Clone arbeitet und dabei ein
  einziger Commit mit allen alten Dateien entsteht.
- Service Worker und Icon-Cache liefen in keinem Browser (brauchen HTTPS).
- Nichts wurde auf einem echten Handy angetippt: Stern, 24h/7d-Umschalter,
  Tabs, Pull-to-Refresh.
- Score und 7-Tage-Chart sind nur mit künstlichen Daten geprüft. Echte Scores
  gibt es erst nach 12 Snapshots (ca. 4 Stunden).

## Offen

- **Push und Merge** (siehe unten).
- Score-Schwellen (stabil ab 70, mittel ab 40) sind geschätzt. Nach ein paar
  Tagen echter Daten ansehen und bei Bedarf anpassen.
- Der Craft-Tab hat kein Mindestvolumen. Sortiert nach Marge oder
  Gewinn/Craft stehen kaum handelbare Items oben. Sortiert nach Gewinn/h
  (Standard) nicht.
- NPC- und Craft-Tab zeigen keinen eigenen Hinweis, wenn sie leer sind.
- „7 Tage“ umfasst bis zu 8 Kalendertage (heute plus 7).
- Fehlende Icons (404) werden bei jedem Refresh erneut angefragt.
- Kein Tooltip mit Einzelwerten im Chart.
- GitHub schaltet geplante Workflows nach 60 Tagen ohne Aktivität im Repo ab.
  Ob die Pushes des Workflows auf `data` als Aktivität zählen, ist unklar.
  Falls die Snapshots aufhören: unter Actions wieder aktivieren.
- Weitere 20 kleine Punkte aus den Reviews (fehlende Tests für Randfälle,
  doppelte Konstanten) sind bewusst nicht behoben; keiner blockiert.

## Veröffentlichen

1. Dein Token darf noch keine Workflow-Dateien pushen. Einmalig:
   `gh auth refresh -h github.com -s workflow`
2. `git switch main`, dann `git merge --ff-only v2`, dann `git push`.
3. Auf GitHub: Actions → „snapshot“ → „Run workflow“. Der Lauf legt den Branch
   `data` an. Danach läuft er alle 20 Minuten von selbst.
4. Die Seite baut GitHub Pages wie bisher aus `main`.

Die Daten-URL in `data.js` ist fest auf
`Tsaitunq/bazaar-tracker` eingestellt. Das Repo muss öffentlich
bleiben.

## Was du testen solltest

Lokal vor dem Push (`node scripts/serve.mjs`, dann http://127.0.0.1:8123):

1. Tabs Flips, NPC, Craft: je eine Liste mit Bildern. Lokale Daten für
   Craft-Tab und Charts erzeugt `node scripts/snapshot.mjs data`.
2. Karte antippen: Detailseite mit Werten. „Zurück“ führt in den Tab, aus dem
   du kamst.
3. Stern in Liste und Detailseite, „nur Favoriten“ in allen Tabs.
4. Einstellungen ändern (Steuer, Marktanteil, Kapital): Werte in allen Tabs
   ändern sich und bleiben nach Neuladen erhalten.

Nach dem Push, am Handy:

5. Erster Workflow-Lauf ist grün und der Branch `data` existiert mit genau
   einem Commit. Nach dem zweiten Lauf weiterhin genau ein Commit.
6. Craft-Tab zeigt Flips (vorher: Hinweis „Noch keine Rezeptdaten“).
7. Nach etwa 4 Stunden: Badges „stabil / mittel / instabil“ erscheinen,
   Sortierung „Stabilität“ ordnet danach.
8. Nach einem Tag: 24h-Chart einer Detailseite zeigt eine plausible Kurve;
   Vergleich mit dem Preis im Spiel.
9. Bilder laden; im Flugmodus erscheinen bereits gesehene Bilder weiter, neue
   zeigen den Platzhalter.
10. App aktualisiert sich nach dem Deploy (einmal schließen und öffnen).
11. NPC-Flip stichprobenartig im Spiel prüfen: stimmt der NPC-Verkaufspreis?
12. Craft-Flip stichprobenartig prüfen: stimmen Zutaten und Mengen?

## Entscheidungen, die ich für dich getroffen habe

Fachliche Entscheidungen stehen in `DECISIONS.md`. Dazu kamen während der
Umsetzung:

- **Arbeit auf Branch `v2`, nicht gemergt.** Grund: `main` ist die Live-Seite.
  Kosten, falls falsch: ein Merge mehr.
- **`parseRoute` liegt in `render.js`, nicht in `app.js`.** Grund: so in Node
  testbar. Kosten: keine.
- **Commits der Agenten tragen die Co-Author-Zeile ihres eigenen Modells
  (Sonnet).** Grund: das ist die zutreffende Angabe. Kosten: uneinheitliche
  Zeilen zwischen den Commits.
- **Workflow bricht ab, wenn der `data`-Branch nicht geholt werden kann.**
  Grund: sonst Datenverlust. Kosten: ein roter Lauf statt eines falschen.
- **Eine zusätzliche Korrekturrunde nach dem Gesamt-Review**, obwohl es
  „merge-bereit“ meldete: Zurück-Link in den richtigen Tab, Scores schon beim
  Start, kein aufblitzender Craft-Hinweis, profitable Karten nicht rot,
  Daten-Push lädt nur Geändertes hoch. Kosten, falls falsch: ein Commit
  (`c7b036a`) zum Zurücknehmen.

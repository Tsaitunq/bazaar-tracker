# Entscheidungen Version 2

Selbstständig getroffen (Auftrag: ohne Rückfragen). Jede Zeile: Entscheidung,
Grund, was es kostet, falls sie falsch ist.

## Vorgehen

- **Arbeit auf Branch `v2`, kein Merge nach `main`, kein Push.** Grund: `main`
  ist die Live-Seite; so bleibt sie unberührt, bis du getestet hast. Kosten:
  ein `git merge` mehr.
- **Spec in `docs/spec-v2.md`, Plan in `docs/plan-v2.md`.** Der Plan-Pfad war
  vorgegeben, die Spec liegt daneben.

## Verlaufsdaten

- **Branch `data` mit genau einem Commit (Force-Push).** Grund: 72 Läufe pro
  Tag würden die Historie sonst um zig MB pro Tag aufblähen. Kosten: keine
  Git-Historie der Daten; der Verlauf steckt in den Dateien selbst.
- **Dateien nach Tag und 16 Shards statt einer Datei pro Item.** Grund: Pro
  Lauf ändern sich nur die 16 Dateien von heute (kleiner Push). Eine Datei pro
  Item hieße 2200 geänderte Dateien alle 20 Min. Kosten: Die Detailseite lädt
  bis zu 8 Dateien (ein Shard, je ca. 140 KB roh) statt einer.
- **„Ausdünnen“ = Tagesordner älter als 7 Tage löschen.** Grund: V2 zeigt nur
  24h und 7d; ausgedünnte Altdaten würde nichts lesen. Kosten: Wer später 30d
  will, hat keine Altdaten und muss ab dann sammeln.
- **Nur Buy- und Sell-Preis im Verlauf, kein Volumen.** Grund: Charts und Score
  brauchen nur die Preise. Kosten: kein Volumen-Chart ohne Formatänderung.
- **Cron `7,27,47`, nicht `*/20`.** Grund: GitHub verzögert Läufe zur vollen
  Stunde am stärksten. Läufe können trotzdem einige Minuten zu spät kommen.
- **Daten über `raw.githubusercontent.com`.** Grund: CORS offen, kein zweites
  Pages-Deployment. Kosten: bis zu 5 Min CDN-Cache.

## Stabilitäts-Score

- **Formel: Anteil profitabler Zeitpunkte × (1 − 2 × mittlere relative
  Preisschwankung), 0–100, mind. 12 Punkte.** Grund: einfach, erklärbar,
  bestraft sowohl Flips, die nur manchmal profitabel sind, als auch stark
  springende Preise. Kosten: Schwellen (70/40) sind geschätzt und brauchen
  vielleicht Nachjustierung nach ein paar Tagen echter Daten.
- **Score wird im Workflow mit fester Steuer 1,25 % berechnet.** Grund: Die
  Liste braucht Scores für alle 2200 Items, ohne den ganzen Verlauf zu laden.
  Kosten: Bei 1,0 % Steuer ist der Score minimal zu streng.

## NPC-Flips

- **Nur Richtung Bazaar → NPC.** Grund: NPC-Kaufpreise stehen nicht in der
  API. Kosten: „bei NPC kaufen, im Bazaar verkaufen“ fehlt.
- **Hauptwert ist Kauf per Buy-Order; Sofortkauf wird zusätzlich gezeigt.**
- Das tägliche NPC-Verkaufslimit des Spiels wird nicht eingerechnet.

## Craft-Flips

- **Rezepte aus dem NEU-Repo (MIT), im Workflow zu `recipes.json` verdichtet,
  höchstens alle 24 h neu.** Grund: 5000+ Einzeldateien kann der Browser nicht
  sinnvoll laden. Kosten: Craft-Tab ist leer, bis der Workflow einmal lief.
- **Nur Rezepte, deren Zutaten alle im Bazaar handelbar sind; keine
  Rezeptketten.** Grund: Sonst fehlt ein Preis. Kosten: viele Rezepte fallen weg.
- **Zutaten per Buy-Order, Ergebnis per Sell-Offer.** Gleiche Annahme wie bei
  Bazaar-Flips.

## Bilder

- **Quelle sky.coflnet.com/static/icon.** Geprüft am 2026-10-09: antwortet mit
  `access-control-allow-origin: *` und `cache-control: max-age=31536000`, auch
  für Enchantments und Shards; unbekannte IDs geben 404. Formale
  Nutzungsbedingungen für den Icon-Endpunkt habe ich nicht gefunden. Die Seite
  https://sky.coflnet.com/data bittet Entwickler eigener Apps nur darum, auf
  sie zu verlinken; das macht die Fußzeile. Alternative mit gleichen Headern:
  `sky.shiiyu.moe/api/item/<id>` (SkyCrypt). Kosten: Der Dienst kann jederzeit
  wegfallen oder Limits einführen; dann erscheint überall der Platzhalter, und
  die URL ist an einer Stelle austauschbar.
- **Kein Größenlimit für den Icon-Cache.** Grund: ca. 2200 Icons zu je rund
  1 KB. Kosten: keine nennenswerten.

## Sonstiges

- **Favoriten-Stern auf allen Karten, „nur Favoriten“ in allen Tabs; das
  Umgehen der Filter bleibt auf den Flips-Tab beschränkt.**
- **Verlaufsdaten werden nicht vom Service Worker gecacht.** Grund: einfacher;
  der HTTP-Cache reicht. Kosten: Charts brauchen Netz.

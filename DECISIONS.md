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

# Entscheidungen Android-App

Selbstständig getroffen (Auftrag: ohne Rückfragen).

## Werkzeuge

- **JDK 21 (Temurin) per winget.** Grund: Capacitor 8 braucht Java 21; installiert
  war nur Java 8. Java 8 bleibt unangetastet und Standard im PATH; die Builds
  setzen `JAVA_HOME` selbst.
- **Android SDK über die Kommandozeilen-Tools nach
  `%LOCALAPPDATA%\Android\Sdk`, Lizenzen per `sdkmanager --licenses`
  angenommen.** Grund: So läuft der Build ohne Setup-Assistent. Das ist der
  Standardpfad, den Android Studio beim ersten Start findet. Kosten: Die
  Android-SDK-Lizenzbedingungen wurden in deinem Namen akzeptiert.
- **Android Studio per winget installiert, für den Build aber nicht nötig.**
  Du brauchst es nur, wenn du das Projekt in der IDE öffnen oder einen
  Emulator mit Oberfläche nutzen willst.

## Einbettung

- **Capacitor 8 statt Trusted Web Activity.** Grund: Der Hintergrund-Check
  braucht eigenen nativen Code (WorkManager); eine TWA ist nur ein
  Browser-Fenster. Kosten: Die App enthält eine Kopie der Web-Dateien und
  aktualisiert sich nicht mit der Webseite, sondern nur mit einer neuen APK.
- **Web-Dateien werden nach `www/` kopiert (`scripts/copy-web.mjs`), `www/`
  ist nicht eingecheckt.** Grund: Capacitor braucht einen Ordner nur mit den
  App-Dateien; im Projektstamm liegen auch Doku, Tests und `node_modules`.
- **`android/` ist eingecheckt.** Grund: Es enthält eigenen Code (Plugin,
  Worker, Ressourcen).
- **Kein Service Worker in der App.** Grund: Die Dateien liegen ohnehin lokal
  in der APK. Kosten: Item-Bilder liegen nur im HTTP-Cache der WebView.
- **Capacitor-Aufruf ohne Bundler über `window.Capacitor.Plugins`.** Grund:
  Der Web-Code bleibt ohne Build-Schritt.

## Hintergrund-Check

- **Eigenes kleines Plugin statt fertiger Plugins.** Grund: Der Check muss bei
  geschlossener App laufen, also nativ; Favoriten und Einstellungen liegen im
  `localStorage` der WebView und müssen dafür nach `SharedPreferences`
  gespiegelt werden.
- **Java statt Kotlin.** Grund: Die Capacitor-Vorlage ist Java; kein
  zusätzliches Gradle-Plugin.
- **Gson nur für den Stream-Parser.** Grund: Die Antwort ist 3,6 MB groß; der
  Stream liest nur die Favoriten. Der Android-eigene `JsonReader` läuft nicht
  in JVM-Unit-Tests.
- **Meldung nur beim Überschreiten der Schwelle, eine Sammel-Benachrichtigung
  pro Lauf.** Grund: Sonst käme alle 15 Minuten dieselbe Meldung. Kosten: Wer
  eine Meldung wegwischt, bekommt keine Erinnerung, solange die Marge oben
  bleibt.
- **Mindestmarge Standard 5 %, Schalter Standard aus.** Grund: Die
  Berechtigungsabfrage soll erst kommen, wenn du die Funktion bewusst
  einschaltest.
- **15 Minuten sind das Android-Minimum und nicht garantiert.** Android
  verschiebt Läufe im Stromsparmodus (Doze) teils deutlich.
- **Der Check nutzt die Steuer aus den Einstellungen, aber weder
  Mindestvolumen noch Kapitalgrenze.** Grund: Favoriten umgehen diese Filter
  auch in der Liste.

## Aussehen und Signatur

- **Icon wie die PWA (Goldmünze auf dunklem Grund), per Skript erzeugt.**
- **Debug-Signatur mit dem automatisch erzeugten Android-Debug-Keystore
  (`CN=Android Debug`).** Grund: enthält keinen Namen. Kosten: Eine später
  anders signierte Version lässt sich nicht darüber installieren; dann vorher
  deinstallieren (Favoriten gehen dabei verloren).

## Während der Umsetzung (Android)

- **Auftrag wird mit `KEEP` eingeplant, nicht mit `UPDATE`.** Grund: Die App
  ruft `configure` bei jedem Start auf; `KEEP` lässt einen laufenden Zeitplan
  unangetastet. Die Einstellungen liest der Worker bei jedem Lauf frisch.
- **Zurück-Taste selbst behandelt.** Grund: Im Emulator schloss sie die App
  auch auf der Detailseite. Jetzt geht sie erst in der Seitenhistorie zurück
  und schließt die App nur auf der Startansicht.
- **Inhalt weicht den Systemleisten per CSS aus** (`viewport-fit=cover`,
  Abstand über `safe-area-inset`). Grund: Ab Android 15 zeichnen Apps unter
  Status- und Navigationsleiste. Im Browser sind die Abstände 0.
- **Emulator (Android 15, Pixel 6) installiert und für den Test benutzt.**
  Grund: Ohne ihn wäre nur der Build geprüft, nicht die laufende App. Kosten:
  ca. 9 GB unter `%LOCALAPPDATA%\Android\Sdk` und `%USERPROFILE%\.android`.
- **`npm run android:build` sucht JDK 21 selbst**, wenn `JAVA_HOME` nicht
  gesetzt ist. Grund: Im PATH liegt weiter Java 8; eine globale Umstellung
  könnte andere Programme treffen.
- **Die bisherige `SUMMARY.md` (Version 2) liegt jetzt unter
  `docs/summary-v2.md`.**

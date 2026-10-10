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

# Entscheidungen Umstellung auf Englisch

- **Coins-Werte:** unter 10 000 ausgeschrieben mit englischen Trennzeichen
  (`1,234.5`), darüber gekürzt mit höchstens einer Nachkommastelle (`20.8k`,
  `350k`, `1.2M`, `1.5B`). Grund: Deine Beispiele nennen beide Formen; die
  Grenze bei 10 000 hält kleine Preise genau. Dieselbe Form gilt für Volumen
  und Mengen.
- **Zeit im 24-Stunden-Format, Datum als `9 Oct, 15:34`.** Grund: englisch,
  aber ohne die Verwechslungsgefahr von `10/09`. Kosten: kein AM/PM, falls du
  das erwartet hast.
- **Schreibweise amerikanisch (`favorites`).**
- **PWA heißt jetzt wie die App „Bazaar Flip Helper“** (Manifest und
  Seitentitel); die Überschrift in der App bleibt kurz „Bazaar Flips“.
- **Dokumentation (`docs/`, `DECISIONS.md`, `SUMMARY.md`) bleibt deutsch.**
  Grund: Der Auftrag betraf die Oberfläche.

# Entscheidungen Market Alerts

- **Gleiche Regeln in App-Hintergrund und Oberfläche.** Der Tab
  „Opportunities“ (PWA und App) und der Hintergrund-Check prüfen dasselbe:
  Marge ≥ Schwelle, Score ≥ 70 („stable“), kein „suspicious“, Wochenvolumen,
  Gewinn/h, Kaufpreis innerhalb der Kapitalgrenze. Die Logik gibt es zweimal
  (`flips.js` und `AlertLogic.java`), mit denselben Testfällen in beiden
  Sprachen.
- **Standards:** Mindestmarge 10 %, Mindestvolumen 100 000 pro Woche,
  Mindest-Gewinn 100 000 Coins pro Stunde, Cooldown 6 h. Gewinn/h rechnet wie
  überall mit Marktanteil und Kapitalgrenze.
- **Kapitalgrenze und Marktanteil kommen aus den bestehenden Einstellungen**,
  nicht aus eigenen Feldern.
- **Die Schwellen stehen in einem eigenen Bereich „Opportunities“, sichtbar
  auch in der PWA.** Der Schalter „Market alerts“ und der Cooldown erscheinen
  nur in der App.
- **„Neu qualifizierend“ und Cooldown gelten beide:** Gemeldet wird ein Item
  nur, wenn es im vorigen Lauf nicht qualifiziert war und in den letzten
  6 Stunden nicht gemeldet wurde. Ein Item, das dauerhaft qualifiziert bleibt,
  wird nie wiederholt.
- **Ohne Scores keine Market Alerts.** Ist `scores.json` nicht erreichbar oder
  leer, meldet der Lauf nichts für den Markt; Favoriten-Alerts laufen weiter.
- **Tipp auf die Meldung:** ein Treffer öffnet die Detailseite, mehrere den Tab
  „Opportunities“. Favoriten-Meldungen öffnen jetzt den Tab „Flips“.
- **Namen für alle Produkte werden einmal pro App-Start an die App übergeben**
  (Datei `names.json`, ca. 85 KB). Grund: Der Hintergrund-Check kann die
  Web-Oberfläche nicht fragen. Ohne die Datei zeigt die Meldung Item-IDs.
- **Der erste Markt-Check läuft sofort nur, wenn noch kein Hintergrund-Auftrag
  lief.** Sind Favoriten-Alerts schon aktiv, kommt er mit dem nächsten
  15-Minuten-Lauf.
- **Der Kurzname im Tab heißt „Opportunities“; die Tabs wurden dafür etwas
  schmaler gesetzt.**

# Entscheidungen Version 3

Selbstständig getroffen (Auftrag: ohne Rückfragen).

## Datenqualität

- **Preis bleibt die oberste Order; die Orderbuch-Tiefe wurde vor dem Merge
  wieder entfernt.** Zuerst gebaut war der gewichtete Durchschnitt der ersten
  1000 Stück. Das überschätzt die Marge: Der Durchschnitt der Buy-Orders liegt
  unter der höchsten, der der Sell-Offers über dem niedrigsten, die Spanne wird
  also größer. Mit Live-Daten war die Marge bei 251 von 367 Flips höher als mit
  der obersten Order (Median 41,3 % statt 38,7 %). Auch die danach erwogene
  Regel „erste Order mit mindestens 64 Stück“ kann die Marge nur vergrößern
  (bei 92 Items, Median 40,4 %). Da man als Flipper oben im Buch handelt, gilt
  jetzt wieder: oberste Order, egal wie klein. `DEPTH_UNITS` gibt es nicht
  mehr.
- **Absicherung per Test mit echten Orderbüchern.** 30 Produkte aus der
  Live-API liegen als `tests/fixtures/bazaar-sample.json` im Repo, die Hälfte
  davon mit einer kleinen obersten Order. Web- und Java-Test prüfen: Preis =
  oberste Order, Marge nie größer als die der obersten Order. Eine Regel, die
  tiefer ins Buch schaut, lässt den Test fehlschlagen.
- **Meine frühere Empfehlung, die Tiefe einzubeziehen, war falsch begründet.**
  Eine Mini-Order an der Spitze erzeugt keine Scheinspanne; sie macht die
  Spanne kleiner, und das ist für einen Flipper die richtige Zahl.
- **Neue Datei `stats.json` statt Erweiterung von `scores.json`.** Grund:
  Bereits installierte Apps lesen `scores.json` im alten Format weiter.
- **Median über den Sell-Preis des vorhandenen Verlaufs (bis 7 Tage).** In den
  ersten Tagen ist es also ein Median über weniger Zeit.
- **„provisional“ ersetzt das Stabilitäts-Badge und setzt den Score auf „nicht
  vorhanden“.** Grund: Ein Score aus wenigen Stunden täuscht. Folge: Beim
  Sortieren nach Stabilität stehen solche Items am Ende.
- **Fehlt ein Item in `stats.json`, gilt es als provisional; ist die Datei
  nicht ladbar, gibt es keine Badges.** Grund: „keine Daten“ und „Netz weg“
  sollen nicht gleich aussehen.
- **Median-Regel gilt nur für Bazaar-Flips und Opportunities**, nicht für NPC-
  und Craft-Karten (die hatten nie ein Suspicious-Badge).

## Design

- **Vier Badge-Farben: stable grün, medium blau, unstable rosa, provisional
  grau gestrichelt.** Grund: Gelb ist für „suspicious“ reserviert, Rot für
  Verlust, Orange für den Akzent.
- **Symbol: drei aufsteigende orange Balken.** Schlicht, eigen, ohne
  Minecraft-Bezug, und mit dem vorhandenen Skript ohne Bildbibliothek
  erzeugbar.
- **Desktop ab 900 px: Kartenraster mit `auto-fill`, höchstens 1400 px breit.**
- **Chart-Anzeige beim Überfahren und Antippen über Pointer-Events**, ohne
  eigene Bibliothek; die Werte stehen in einer Zeile über dem Chart.
- **Einstellungs-Gruppen:** Calculation, List, Opportunities, Alerts.


# Entscheidungen Design-Feinschliff

- **Gewählt: Variante C („Forge“)**: warmes Schwarz mit feinem Punktraster,
  Tabs als unterstrichene Beschriftung, orange Linie unter dem Kopf und
  zwischen den großen Zahlen und den Details. Zwischenzeitlich war D
  eingebaut; die Vergleichsbilder aller Varianten liegen in
  `docs/design-varianten/`.
- **Die breitere Desktop-Detailseite bleibt.** Sie war als Ergänzung zu D
  gewünscht, ist aber Layout und keine Farbfrage; mit C steht sie genauso.
- **Seltenheit als Streifen links an der Karte plus Wort in der Ecke, Namen
  bleiben weiß.** Grund: Grüner Text soll eindeutig Gewinn bedeuten, und das
  Wort macht die Seltenheit unabhängig von der Farbe lesbar.
- **Rarity-Töne sind gegenüber dem Spiel aufgehellt**, damit sie auf dunklem
  Grund mindestens 4,5 : 1 erreichen.
- **Opportunities-Karten bekommen einen orangen Rahmen statt eines
  Leuchtens.** Grund: C arbeitet mit Linien, nicht mit Schein.
- **Farben für Flächen und Seltenheit sind Tokens in `:root`** und Teil des
  Kontrasttests; in den Regeln selbst steht weiterhin keine Hex-Farbe.
- **Das Aufleuchten einer Zahl vergleicht den angezeigten Text mit dem letzten
  Stand je Ansicht und Item.** Folge: Auch eine Änderung der Steuer oder des
  Marktanteils lässt Zahlen aufleuchten.
- **App-Hintergrund, Manifest, Android-Systemleisten und Icon-Grund folgen dem
  warmen Schwarz `#110C09`.**

# Entscheidungen Wischen und Portfolio

- **Wischen wechselt Tabs nur auf Listen, ab 60 px und nur bei klar
  seitlicher Bewegung; nicht vom Bildschirmrand.** Grund: Scrollen und
  Androids Zurück-Geste sollen nie einen Tab wechseln.
- **Portfolio steht oben im Tab „Opportunities“, kein fünfter Tab.** Grund:
  Fünf Tabs passen bei 360 px nicht nebeneinander, und das Portfolio ist eine
  Auswahl aus genau dieser Liste.
- **Gleichmäßige Aufteilung: Budget pro Flip = Gesamtkapital / Anzahl
  paralleler Flips.** Es ersetzt für das Portfolio die Einstellung „Max.
  capital per flip“.
- **Auswahl = die besten Opportunities für dieses Budget, sortiert nach
  Profit/h.** Es gelten exakt die Opportunity-Bedingungen (stable, nicht
  suspicious, nicht provisional, Mindestmarge, Mindestvolumen,
  Mindest-Gewinn/h).
- **Kürzen statt umverteilen.** Braucht ein Item weniger als sein Budget
  (zu wenig Volumen, nur ganze Stück), bleibt der Rest ungenutzt; die Zeile
  „X of Y capital in use“ zeigt das. Grund: einfach nachvollziehbar. Kosten:
  Das Portfolio schöpft das Kapital oft nicht aus.
- **„Stake“ ist Stück pro Stunde mal Buy-Order-Preis**, also dieselbe
  Kapitalsicht wie bei „Max. capital per flip“.
- **Standardwerte: 50 Mio. Gesamtkapital, 10 parallele Flips.** Gesamtkapital
  0 schaltet das Portfolio ab.
- **Die Logik liegt nur in `flips.js`.** Market Alerts und
  `AlertLogic.java` sind unverändert.

# Entscheidungen Version 4

Selbstständig getroffen (Auftrag: ohne Rückfragen).

- **Das Design bleibt Variante C, nicht D.** Im Auftrag stand „Design Variante
  D“. Eingebaut und zuletzt ausdrücklich gewählt ist aber C („nimm option c“).
  Ich habe die neuen Fenster und die Tour im bestehenden Stil gebaut und das
  Design der App nicht umgestellt. Kosten, falls du D wolltest: Die
  Umstellung ist eine reine CSS-Änderung an `style.css`; `variant-d.css`
  liegt als Vorlage in `docs/design-varianten/`.
- **Branch `v4` baut auf `slide` auf** (das fließende Wischen), das noch
  nicht in `main` ist. Grund: Beide ändern `app.js`; getrennt gäbe es
  Konflikte. Kosten: `v4` lässt sich nur zusammen mit dem Wischen mergen.
- **Zustand unter einem Schlüssel: `bt.onboarding` = `{ done, version }`.**
  Das sind `onboardingDone` und `lastSeenVersion` aus dem Auftrag.
- **„Bestehender Nutzer“ heißt: Es gab vor diesem Start schon App-Daten**
  (`bt.settings`, `bt.favs` oder `bt.items`). Ohne Onboarding-Zustand, aber
  mit solchen Daten, kommt das Tour-Angebot statt des Willkommensfensters.
- **Gelöschter Speicher = neuer Nutzer.** Ohne jede Spur ist das nicht zu
  unterscheiden; es kommt das Willkommensfenster.
- **Das Tour-Angebot steht im What's-new-Fenster der aktuellen Version**, mit
  den Buttons „Take the tour“ und „Not now“. Grund: ein Fenster statt zwei.
- **Jedes Schließen eines Fensters zählt als gesehen**, auch per Escape. Grund:
  Es soll nie zweimal ungefragt erscheinen.
- **Der Assistent stellt die drei Fragen auf einer Seite** und zeigt danach
  die Zusammenfassung. Grund: weniger Klicks am Handy.
- **Werte des Assistenten:** Kapital → `Total capital` und `Max. capital per
  flip` (Kapital / parallele Flips); Aktivität → Market share 5 / 10 / 20 %;
  „Play it safe“ → 15 % Marge, 500 000 Volumen, 100 000 Gewinn/h; „More
  profit“ → 8 %, 100 000, 250 000. Das sind Vorschläge für Einstellungen; an
  der Bewertungslogik ändert sich nichts.
- **Die Erklärtexte unter den Reglern sind jetzt eingeklappt und öffnen sich
  über das „?“.** Grund: Der Auftrag wollte ein ?-Icon; nebenbei werden die
  Einstellungen am Handy deutlich kürzer.
- **Akku auf „Unrestricted“ und Benachrichtigungen erklärt die Tour nur als
  Text.** Grund: Ein Sprung in die Android-Einstellungen bräuchte neuen
  nativen Code. Kosten: Der Nutzer muss den Weg selbst gehen.
- **Die Android-Version kommt aus `changelog.json`** (`versionName` 4.0.0,
  `versionCode` 40000). Vorher stand fest 1.0.
- **Die Versionshistorie beginnt bei 1.0.0 und fasst die bisherigen Schritte
  rückwirkend zusammen** (1.0.0, 2.0.0, 2.1.0, 3.0.0, 3.2.0, 3.3.0, 4.0.0).
- **Screenshots entstanden mit einer lokalen Kopie der App, die gespeicherte
  API-Antworten lädt**, ohne Live-Abrufe. Die Kopie liegt im ignorierten
  Ordner `data/` und wurde danach gelöscht.

# Entscheidungen Version 5 (Forge, Events & Trends)

Selbstständig getroffen (Auftrag: ohne Rückfragen). Jede Zeile: Entscheidung,
Grund, was es kostet, falls sie falsch ist.

## Vorgehen

- **Branch `v5` ab `main`, kein Push.** Spec in `docs/spec-v5.md`, Plan in
  `docs/plan-v5.md`.
- **Je eine API-Antwort wurde einmal gespeichert** (Bazaar, erste
  Auktionsseite, Election), außerhalb des Repos. Daraus stammen die Formate
  und die Screenshot-Daten. Dazu kommt ein einziger Live-Lauf des
  Snapshot-Skripts für die Workflow-Prüfung. Grund: Formate lassen sich nicht
  raten. Kosten: keine; wiederholte Abrufe gibt es nicht.
- **Das offizielle Wiki ist seit Juli 2026 geschlossen.** Quelle ist das
  Community-Wiki `hypixelskyblock.minecraft.wiki`, auf das auch das NEU-Repo
  verweist. Alles steht in `docs/events-sources.md`.

## Forge

- **Nur Rezepte, deren Zutaten alle im Bazaar sind** (62 von 124 nach
  Abzug der Pets; 30 mit Bazaar-Ergebnis, 32 mit AH-Ergebnis). Grund: Der Auftrag rechnet Zutaten zum
  Bazaar-Preis. Kosten: Rezepte mit geschmiedeten Zwischenteilen (z. B.
  höhere Drills) fehlen.
- **Pets als Ergebnis fallen weg.** Grund: Im Auktionshaus haben alle Pets
  dieselbe Item-ID; der Preis hinge an Seltenheit und Level.
- **Lowest BIN aus dem offiziellen Auktions-Endpunkt, nicht von Dritten.**
  Der Workflow liest alle Seiten (zuletzt 46, je ca. 2,4 MB), acht
  gleichzeitig, und merkt sich nur den niedrigsten BIN der Forge-Ergebnisse.
  `ah.json` hatte im Testlauf 29 Einträge (803 Bytes) und keinen Verlauf.
  Kosten: Der ganze Lauf dauerte lokal 21 Sekunden, inklusive NEU-Klon; die
  neuen Dateien wiegen zusammen rund 7 KB.
- **`forge.json` wird geholt, sobald sie fehlt**, nicht erst beim nächsten
  täglichen Rezept-Lauf. Grund: Sonst bliebe der Forge-Tab nach dem Update bis
  zu 24 Stunden leer.
- **Stat-Icons des Spiels werden aus den Perk-Texten entfernt.** Grund: Die
  Zeichen liegen im privaten Unicode-Bereich und erscheinen als leeres
  Kästchen.
- **Die Detailseite eines AH-Items zeigt nur den Namen.** Für Items außerhalb
  des Bazaars gibt es keinen Verlauf. Kosten: Die Seite ist fast leer.
- **Die Item-ID wird direkt aus den gepackten Auktionsdaten gesucht**, ohne
  NBT-Bibliothek: Gesucht wird das Text-Feld `id`. Grund: keine neue
  Abhängigkeit. Kosten: Ändert Hypixel das Format, bleibt `ah.json` leer und
  der Forge-Tab zeigt nur Bazaar-Ergebnisse.
- **Der Lowest BIN ist ein einzelnes Angebot.** Er kann zu niedrig
  (Lockangebot) oder zu hoch sein (kaum Angebote). Darum Badge und Hinweis
  „estimate“. Ein Verlauf oder Median der AH-Preise ist nicht Teil von v5.
- **AH-Gebühren: Einstellgebühr nach Preisstufe plus 1 % Abholsteuer.** Nicht
  eingerechnet: die Gebühr für die Laufzeit der Auktion (keine belegte
  Tabelle) und Derpys vierfache Steuer. Kosten: Der Gewinn ist leicht zu hoch
  geschätzt.
- **„Profit/forge hour“ = Gewinn eines Durchgangs geteilt durch die Dauer**,
  für einen Forge-Slot. Marktanteil und Volumen fließen nicht ein, Quick
  Forge auch nicht. Kosten: Bei sehr kurzen Rezepten wirkt der Wert hoch; die
  Grenze ist dann der Verkauf, nicht die Schmiede.
- **Die HotM-Stufe kommt aus dem Text „Requires: … HotM N“.** Weitere
  Voraussetzungen (z. B. „Mithril X“) werden nicht geprüft. Ohne Angabe gilt
  Stufe 0 (immer sichtbar).
- **Der AH-Filter sitzt über der Forge-Liste, die HotM-Stufe in den
  Einstellungen.** Grund: Der Filter wird oft umgeschaltet, die Stufe selten.
- **Fünf Tabs: Die Leiste scrollt horizontal und holt den aktiven Tab ins
  Bild.** Bei 360 px passen die fünf Namen knapp; das Scrollen fängt
  größere Schrift ab.

## Events

- **Termine werden in der App aus der Uhrzeit berechnet**, nicht vom Workflow
  geliefert. Grund: Der Countdown stimmt auch, wenn der Workflow hängt.
- **Mining Fiesta und Mythological Ritual erscheinen als aktiver Perk ohne
  Countdown**, Fishing Festival mit Terminen. Grund: Für die Mining Fiesta
  widersprechen sich die Quellen.
- **Perks des Ministers zählen als aktiv.** Grund: Die API führt sie so.
- **Event-Badge: laufende Events, Events in den nächsten 24 Stunden und
  aktive Perks.** Grund: Ein SkyBlock-Jahr dauert gut fünf Tage; ohne Grenze
  wäre fast immer alles markiert.
- **Die Liste betroffener Items ist kurz und nennt nur Items, die die Quellen
  dem Event zuordnen.** Eine Preisrichtung behauptet die App nicht.
- **Eigene Farbe `--event` für Event-Badges.** Grund: Orange ist für
  Bedienelemente reserviert, Grün und Rot für Gewinn und Verlust.

## Trends

- **Der Trend steht als viertes Feld in `stats.json`.** Grund: Der Workflow
  hat den Verlauf ohnehin geladen; die App müsste sonst pro Item Dateien
  nachladen. `statOf` und die Android-App lesen nur die ersten drei Felder.
- **Steigung per linearer Regression über die letzten 24 h, relativ zum
  Mittelwert.** Schwellen: ±3 % für „flat“, ±10 % gegen den Median für
  „below/above normal“. Mindestens 12 Punkte über 12 Stunden.
- **Trend-Badges sind neutral gefärbt.** Grund: Grün und Rot bedeuten in der
  App Gewinn und Verlust; ein steigender Preis ist keins von beiden.
- **Sortierung „Trend“ ordnet nur die Anzeige um.** Die Listen werden wie
  bisher gebaut und danach sortiert; das Portfolio bleibt bei Profit/h.

## Tour und Assistent

- **Basis-Tour mit 6 Stationen, Advanced-Tour mit 4 (Android: 5).** Die
  Station „Item details“ entfällt aus der Basis-Tour, damit die Grenze von
  sechs hält.
- **Nach der Basis-Tour kommt das Angebot für die Advanced-Tour, danach wie
  bisher der Assistent**, wenn die Tour vom Willkommensfenster aus begann.
- **„Advanced tour“ im What's-new-Fenster sehen alle, deren zuletzt gesehene
  Version vor 5.0.0 liegt.**
- **Assistent: HotM-Stufe als Auswahlliste 1 bis 10, AH-Frage mit Ja/Nein.**

## Forge-Korrekturen (5.0.1)

- **Profit/forge hour = Minimum aus Schmiede-Tempo und Absatz.** Absatz ist
  der Marktanteil am stündlichen Kaufvolumen des Ergebnisses
  (`buyMovingWeek / 168 × Market share`), wie bei den Craft-Flips. Die Karte
  nennt unter „Limited by“, was begrenzt.
- **Für AH-Ergebnisse begrenzt nur die Schmiede.** Grund: Der
  Auktions-Endpunkt liefert Angebote, keine Verkäufe; ein Absatz lässt sich
  daraus nicht ableiten. Kosten: Kurzzeit-Rezepte mit AH-Ergebnis können
  weiter zu hoch wirken; das Badge „estimate“ bleibt.
- **Der Nachschub der Zutaten begrenzt nicht.** Verlangt war die Grenze durch
  das Verkaufsvolumen.
- **Derpy wird am Namen des Mayors erkannt**, nicht am Perk-Namen. Grund: Der
  Mayor-Name ist in den Daten eindeutig; den genauen Perk-Namen habe ich nicht
  belegt. Es zählt nur der Mayor, nicht ein Minister.
- **Die Detailseite zeigt den Forge-Abschnitt für jedes Item mit Rezept**,
  auch für Bazaar-Ergebnisse und unabhängig von HotM-Stufe und AH-Filter. Bei
  AH-Items entfallen die leeren Verlaufs-Charts.

# Entscheidungen Version 6 (UX)

Grundlage: `docs/ux-audit.md`, Plan: `docs/plan-v6.md`. Selbstständig
getroffen, Arbeit auf Branch `v6`, kein Push.

## Einstellungen und Portfolio

- **Das Portfolio gibt einem Flip höchstens „Max. capital per flip“.** Budget
  je Flip = Minimum aus Total capital ÷ Parallel flips und Max. capital per
  flip; 0 heißt keine Grenze. Einzige Änderung an `flips.js`. Kosten: Wer den
  Wert klein gelassen hat (Standard 5M) und das Total capital erhöht, sieht
  ein Portfolio, das nicht das ganze Kapital nutzt. Die Zeile „x of y capital
  in use · up to z per flip“ zeigt das.
- **`AlertLogic.java` bleibt unverändert.** Grund: Die Android-Logik kennt
  kein Portfolio; Market Alerts haben `maxCapital` schon vorher respektiert.
- **Doppelte Namen bekommen den Bereich in Klammern**: „(Flips & NPC)“,
  „(Opportunities)“, „(Favorite alerts)“. Auch „Min. profit/h“ trägt den
  Zusatz, obwohl es nur einmal vorkommt, damit die drei Schwellen gleich
  aussehen.

## Touren

- **Erster Start: Welcome → Basis-Tour → Setup.** Das Angebot der
  Advanced-Tour nach der Basis-Tour entfällt.
- **„Skip“ im Welcome und in einer Tour, die vom Welcome oder vom
  Tour-Angebot aus begann, zeigt einmal „Set up in 30 seconds?“.** Escape
  schließt ohne Angebot. Aus dem Hilfe-Fenster gestartete Touren haben kein
  Nachspiel.
- **Die Advanced-Tour wird genau einmal angeboten, beim ersten Wechsel auf
  Pro.** Bestandsnutzer bekommen das Angebot nicht mehr (sie hatten es in v5).
  Im Hilfe-Fenster steht sie nur im Pro-Modus, weil ihre Ziele im
  Einfach-Modus ausgeblendet sind.
- **Station „Opportunities“ zeigt auf die Tab-Leiste statt auf eine Karte.**
  Grund: Sie erklärt jetzt auch die Tabs und das Wischen.
- **„provisional“ steht nicht mehr in der Tour**, nur noch in „How it works“
  unter „Stability score“. Ein eigener Hinweis dafür wäre der vierzehnte
  gewesen; verlangt waren die dreizehn aus dem Audit.
- **Nebenbei behoben:** Das Spotlight verlor sein Ziel, wenn die Liste während
  einer Station neu gezeichnet wurde (Nachladen der Preise). Es sucht das Ziel
  jetzt neu. Der Fehler bestand schon vorher und fiel bei der Sichtprüfung auf.

## Kontext-Hinweise

- **Ein Hinweis ist eine Zeile im Seitenfluss mit „Got it“**, kein Overlay.
  Es steht immer höchstens einer da, nie neben Tour oder Fenster.
- **Welche Hinweise passen, ergibt sich bei jedem Zeichnen aus dem Zustand**
  (Tab, Suche, Favoriten, Radar offen, Einstellungen offen), nicht aus
  Ereignissen. Grund: kein Zustand, der hängen bleiben kann. Folge: „erster
  gesetzter Stern“ heißt „es gibt mindestens einen Favoriten“.
- **Reihenfolge, wenn mehrere passen:** Einstellungen, Suche, Radar, Favorit,
  Tab, Portfolio. Auf der Detailseite: suspicious vor Diagramm.
- **Bestandsnutzer starten mit allen 13 Hinweisen als gesehen.** Das Audit sah
  eine Ausnahme für neuere Features vor; alle 13 betreffen Features von vor
  6.0.0, also gibt es keine. Kosten: Wer NPC oder Craft nie verstanden hat,
  muss „Show hints again“ im Hilfe-Fenster drücken.
- **„Bestandsnutzer“ = es gab vor diesem Start gespeicherte Einstellungen,
  Favoriten, Item-Namen oder einen Tour-Stand.** Modus und Hinweis-Liste
  werden beim ersten Start geschrieben, sonst gälte ein neuer Nutzer beim
  zweiten Start als Bestandsnutzer.
- **Tour-Stationen tragen den Hinweis zum selben Thema als gesehen ein**
  (card, opps, radar, portfolio, forge, alerts).
- **Der Portfolio-Hinweis sagt das Gegenteil des Audit-Texts.** Das Audit
  beschrieb das alte Verhalten (Max. capital wird ignoriert); Punkt 0 hat es
  geändert.
- **Der Alerts-Hinweis hängt unter dem ersten eingeschalteten Schalter.** Er
  ist im Browser nicht prüfbar, weil die Schalter nur in der Android-App
  sichtbar sind.

## How it works

- **14 Abschnitte als `<details>`, alle zu.** Über das Verlangte hinaus:
  „Portfolio“ und „Volume per week“, beide im Audit als Lücke geführt.
- **Der Forge-Absatz ist von rund 110 auf rund 70 Wörter gekürzt.** Die
  einzelnen AH-Gebührensätze stehen nicht mehr dort; die Karte nennt Derpy
  weiterhin selbst.

## Einfach und Profi

- **Zuordnung wie in der Tabelle des Audits.** Umsetzung: Klasse `pro` und
  eine CSS-Regel; in JS nur Tab-Liste, Sortier-Optionen und Adresse.
- **Der Abschnitt „Opportunities“ bleibt im Einfach-Modus als reiner
  Erklärtext stehen.** Grund: In der Android-App steht dort „Market alerts“,
  und der Satz sagt, was der Tab filtert.
- **Im Einfach-Modus folgt „Max. capital per flip“ dem Total capital**
  (÷ Parallel flips), sobald man das Total capital ändert. Der Wechsel des
  Modus selbst setzt nichts zurück, außer einer Sortierung, die es im
  Einfach-Modus nicht gibt (dann Profit/h).
- **Ein Profi-Tab in der Adresse öffnet im Einfach-Modus Flips.**
  Benachrichtigungen verlinken nur auf Flips, Opportunities und Items.
- **Das Setup lässt im Einfach-Modus die beiden Forge-Fragen weg** und ändert
  HotM-Stufe und AH-Schalter dann nicht.
- **„Show me“ in What's new bleibt, wie es ist.** Zeigt ein Eintrag auf etwas,
  das der Einfach-Modus ausblendet, steht die Sprechblase mittig. Der
  Zusatz „in Pro mode“ aus dem Audit ist nicht gebaut: Neue Nutzer sehen
  What's new erst beim nächsten Update.
- **Auf der Detailseite blendet der Einfach-Modus dieselben Felder aus wie
  auf der Karte** (normal, Profit/item, Vol./week), dazu Margin-Chart und
  Forge-Abschnitt.
- **Favoriten-Alerts, die im Pro-Modus eingeschaltet wurden, laufen im
  Einfach-Modus weiter**, obwohl ihr Schalter dort nicht sichtbar ist.

# Entscheidungen Version 0.7

Selbstständig getroffen (Auftrag: unbeaufsichtigt, ohne Rückfragen). Spec:
`docs/spec-v0.7.md`, Bericht: `docs/summary-v0.7.md`.

## Teil 0: Navigation

- **Die Trade-Tabs behalten ihre Adressen** (`#/flips`, `#/opps`, `#/npc`,
  `#/craft`, `#/forge`, `#/item/…`). Neu sind nur `#/today`, `#/minions`,
  `#/market`. Grund: Benachrichtigungen, Lesezeichen und die Tests zeigen
  auf diese Adressen; `#/trade/flips` hätte nur Umleitungen gebracht. Kosten:
  Die Adresse sagt nicht, dass Flips zu Trade gehört.
- **„Show me“ wird im Code umgebogen, nicht im Changelog.** Alte Einträge
  dürfen laut CLAUDE.md nicht geändert werden. `newsRoute` schickt jeden
  Eintrag, der auf `#radar` zeigt, nach `#/market`. Alle anderen alten Ziele
  liegen weiter in Trade.
- **Beim Start öffnet die App den zuletzt benutzten Bereich**, beim
  allerersten Start Today. Grund: „Letzter Bereich/Tab wird gemerkt“ stand
  ausdrücklich im Auftrag. Kosten: Wer Today als feste Startseite will, muss
  einmal tippen.
- **Der Radar ist in Market immer aufgeklappt** (ein Abschnitt statt
  `<details>`); `bt.radar` wird nicht mehr gelesen. Die Zeilen darin klappen
  weiter einzeln auf.
- **Trends in Market = die fünf stärksten Steiger und Faller aus der
  Flips-Liste** (also mit deinem Mindestvolumen). Grund: Ohne den Filter
  stünden dort Items, die kaum gehandelt werden.
- **Die Leiste bleibt auch am Desktop unten.** Beim Tippen in die Suche wird
  sie ausgeblendet, damit die Tastatur sie nicht über die Liste schiebt.
- **Die Basic-Tour hat jetzt sieben Stationen** (neu: die Leiste) und endet
  auf Today.
- **Ein Profi-Bereich in der Adresse öffnet im Einfach-Modus weiter Flips**
  (wie bisher bei Profi-Tabs).

## Teil 1: Crafts im Portfolio

- **Der Craft rechnet mit dem Einsatz des Flips** (seinem Stake aus dem
  Plan), nicht mit dem ganzen Kapital. Grund: Nur so ist „mehr Profit/h als
  der reine Flip“ ein Vergleich mit denselben Coins. Kosten: Ein Craft, der
  mehr Kapital bräuchte als der Flip bekommen hat, erscheint nicht.
- **„+Y/h“ ist der Mehrertrag** (Craft minus Flip), nicht der Craft-Profit.
- **Volumen wie im Craft-Tab:** Verkäufe je Woche bei jeder Zutat, Käufe je
  Woche beim Endprodukt, davon dein Market share.
- **Ein Endprodukt mit „suspicious“ gibt keinen Hinweis.** Grund: Sonst
  empfiehlt der Plan genau die manipulierten Preise, vor denen er schützt.
  Stabilität und 24 h Verlauf des Endprodukts werden nicht verlangt (wie im
  Craft-Tab).
- **Pro Flip nur der beste Craft**, nur im Profi-Modus (Craft ist ein
  Profi-Tab).
- **Der Plan wird jetzt bei jeder Neuberechnung gebaut**, nicht nur im
  Opportunities-Tab; Teil 2 und 3 brauchen ihn überall.

## Teil 2: Warnungen fürs Portfolio

- **Gespeichert wird „der Plan, den du zuletzt gesehen hast“** (`bt.plan`:
  Item und Kaufpreis beim Eintritt in den Plan). Grund: Der Plan auf dem
  Bildschirm wird alle paar Minuten neu gerechnet; gegen ihn selbst kann
  nichts fallen. Ohne Warnung folgt der gespeicherte Plan dem aktuellen, ein
  Item, das bleibt, behält seinen ersten Preis. Mit einer Preis- oder
  Suspicious-Warnung bleibt er stehen, bis du „Got it“ tippst. Kosten: Ein
  Item, das sehr lange im Plan steht und langsam 5 % verliert, wird gemeldet,
  obwohl du längst zu neuen Preisen handelst; „Got it“ setzt neu auf.
- **Kein Knopf „Orders platziert“.** Die App weiß nicht, was du im Spiel
  wirklich gekauft hast; der gespeicherte Plan ist die beste Näherung.
- **„Preis fällt“ = Buy-Order mehr als X % unter dem Plan-Preis ODER Marge
  unter 1 %.** X ist einstellbar (Portfolio → Price drop warning %, Default
  5), die 1 % sind fest (`PLAN_MIN_MARGIN`).
- **Die Schalter gelten nur für Benachrichtigungen.** Das Banner in der App
  zeigt immer alle vier Arten; im Browser gibt es die Schalter gar nicht.
- **Wahl im Hintergrund:** Der Worker lädt `election.json` selbst. Welcher
  Perk welches Plan-Item betrifft und wann die Amtszeit endet, schickt die
  App mit (`planElection`), damit Java keine Kopie der Perk-Listen und des
  Kalenders braucht. Kosten: Wird die App eine ganze Amtszeit (124 h) nicht
  geöffnet, kennt der Worker das neue Amtsende nicht und meldet „Mayor geht“
  nicht.
- **Ein Cooldown für alle vier Arten** (Default 6 h, je Item und Art), eine
  Benachrichtigung pro Lauf mit bis zu drei Zeilen.
- **Die Schalter sind standardmäßig aus**, wie alle Benachrichtigungen: Erst
  das Einschalten fragt nach der Android-Berechtigung.
- **Der Worker lädt `stats.json` nur noch einmal pro Lauf** (Markt-Alerts
  und Plan teilen sie). Fehlt die Datei, läuft die Plan-Prüfung ohne den
  Vergleich mit dem Normalpreis weiter.

## Teil 3: Today

- **Today ist ein eigener Bereich in der Leiste**, nicht ein sechster Tab in
  Trade (der Auftrag ließ beides zu); so stand es schon in Teil 0.
- **„Seit dem letzten Öffnen“ = seit dem letzten Besuch.** Die IDs der
  Opportunities werden laufend gespeichert (`bt.opps`); beim Start gilt der
  gespeicherte Stand als „letzter Besuch“. Weil die Android-App oft tagelang
  im Hintergrund offen bleibt, zählt auch eine Rückkehr nach mehr als 30
  Minuten als neuer Besuch.
- **Ohne letzten Besuch (erster Start) heißt der Block „Top opportunities“**
  und zeigt die drei besten nach Profit/h, statt alles als neu zu melden.
- **Der Block „Coming up“ (Events und Wahl) ist Profi**, weil er nach Market
  verlinkt und Market im Einfach-Modus fehlt. Einfach zeigt Portfolio,
  Warnungen und neue Chancen.
- **Countdowns laufen nicht sekündlich**, sie stimmen bei jedem Refresh (alle
  1 bis 5 Minuten), wie der Radar.
- **Betroffene Items der Wahl** sind die, bei denen der Führende oder der
  kommende Minister den Preis drücken dürfte (dieselbe Quelle wie die
  Portfolio-Warnung), höchstens drei mit „+N more“.

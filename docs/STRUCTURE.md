# Aufbau des Repos

Eine Zeile je Ordner oder Hauptdatei. Zwei Apps teilen sich die Logik im Wurzelordner: die Bazaar-App (`index.html`, `app.js`) und die Guide-App (`guide/`).

## Ordner

- `.github/workflows/` – geplanter Lauf `snapshot.yml`, der alle 20 Minuten die Bazaar-Daten in den Branch `data` schreibt.
- `android/` – Capacitor-Projekt der Bazaar-App (APK), mit den Hintergrund-Alarmen in Java.
- `android-guide/` – Capacitor-Projekt der Guide-App (APK), mit Zurück-Taste, API-Key und Profil-Speicher in Java.
- `docs/` – Pläne, Specs, Zusammenfassungen, Design-Vorlagen (`design-mockups/`) und der Maß-Abgleich `guide-design-check.md`.
- `guide/` – die Guide-App: `app.js` (Zustand, Routen, Gesten), `model.js` (was die Screens zeigen), `views/` (Markup), `guide.css`, eigener `sw.js` und `changelog.json`.
- `icons/` – App-Symbole und Minion-Bilder.
- `personal/` – nicht in git: private Guides, Item-Daten, eigene /stats und Testprofile; landet nur in lokalen Builds.
- `scripts/` – Build-, Daten- und Prüfskripte (siehe unten).
- `tests/` – `node --test`, nur mit Fixtures in `tests/fixtures/`.

Erzeugt und nicht in git, `npm run clean` löscht sie: `www/`, `www-guide/`, `android/app/build/`, `android-guide/app/build/`, `guide-shots/`.

## Dateien im Wurzelordner

- `index.html`, `style.css`, `manifest.webmanifest`, `sw.js` – Hülle, Farben und Offline-Cache der Bazaar-App; `SHELL` in `sw.js` bestimmt auch den APK-Inhalt.
- `app.js` – Bazaar-App: Zustand, Abruf, Ereignisse.
- `render.js` – Bazaar-App: Markup aller Ansichten.
- `sheet.js` – das eine Fenster für Einstellungen und Filter.
- `onboarding.js`, `tour.js` – Willkommen, Tour, "What's new" und die Liste alter Speicher-Schlüssel; `tour.js` verdrahtet es mit der Seite.
- `changelog.json` – Version und Neuigkeiten der Bazaar-App, auch `versionName`/`versionCode` des APK.
- `flips.js` – Flip-Rechnung (identisch zu `AlertLogic.java`).
- `npc.js`, `craft.js`, `forge.js` – NPC-, Craft- und Forge-Flips.
- `minions.js`, `minioncosts.js` – Minion-Rechner und Baukosten.
- `events.js`, `timing.js`, `trends.js`, `history.js`, `chart.js` – Mayor/Events, Event-Timing, Trends, Preisverlauf, Diagramme.
- `data.js` – Laden der Daten aus dem Branch `data` und lokalen Kopien.
- `names.js`, `prices.js`, `format.js` – Item-Namen, Preis-Helfer, Text-Helfer (beide Apps).
- `native.js` – Brücke zu den Android-Plugins (beide Apps).
- `sync.js`, `profile.js`, `nbt.js` – Profil-Sync per eigenem Key, Profil zusammenfassen, NBT lesen.
- `progress.js` – Guides laden und prüfen, Schrittkosten, Import/Export.
- `owned.js` – geteilter Besitz über alle Guides.
- `detect.js`, `requires.js` – was der Sync als erledigt erkennt, ob Anforderungen erfüllt sind.
- `optimizer.js`, `optimizer-data.js`, `path.js` – Wert je Schritt, Wiki-Werte, Reihenfolge des Pfads.
- `stats.js`, `virtual.js`, `blaze.js` – Werte im gewählten Setup, Profil aus Häkchen, Blaze-Schadensmodell.
- `capacitor.config.json` – Capacitor-Konfiguration der Bazaar-App.
- `timing-backfill.json` – nachgetragene Event-Läufe für `timing.js`.
- `package.json` – npm-Skripte: `test`, `android:*`, `guide:*`, `clean`.
- `CLAUDE.md`, `README.md`, `DECISIONS.md`, `SUMMARY.md`, `LICENSE` – Regeln, Überblick, Entscheidungen, Stand, Lizenz.

## Skripte (`scripts/`)

- `copy-web.mjs`, `android-build.mjs` – Bazaar-App nach `www/` legen und APK bauen.
- `guide-copy.mjs`, `guide-build.mjs` – Guide-App nach `www-guide/` legen und APK bauen.
- `guide-shots.mjs` – Screenshots und Layout-Prüfungen der Guide-App auf 390×844 und 412×915, nur Fixtures.
- `clean.mjs` – löscht die erzeugten Ordner.
- `snapshot.mjs`, `items.mjs`, `recipes.mjs`, `auctions.mjs`, `election.mjs` – Datenabzug für `data/`.
- `timing-backfill.mjs`, `backfill-lib.mjs`, `timing-backup.mjs`, `timing-remove-backfill.mjs`, `mayors-history.json` – Event-Timing nachtragen, sichern, entfernen.
- `detect-report.mjs`, `stats-report.mjs` – lokale Abgleiche gegen `personal/`, ohne private Werte auszugeben.
- `icons.mjs`, `serve.mjs` – App-Symbol zeichnen, lokaler Server.

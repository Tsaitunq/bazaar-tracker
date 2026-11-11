# Aufbau des Repos

Ein Repo, zwei Apps: die Bazaar-App (PWA und Android) und die Guide-App (Android). Was beide brauchen, liegt in `shared/`. Quellen liegen immer unter `apps/<app>/` oder `shared/`; gebaut wird in einen flachen Ordner, der nicht in git ist.

## Ordner

- `apps/bazaar/` – Bazaar-App. Seite (`index.html`, `style.css`, `manifest.webmanifest`, `sw.js`), Module (siehe unten), `icons/`, `changelog.json` (Version und "What's new", auch `versionName`/`versionCode` des APK), `capacitor.config.json`, `package.json` (nur für `cap sync`), `android/` (Capacitor-Projekt mit den Hintergrund-Alarmen in Java).
- `apps/guide/` – Guide-App. Oberfläche (`app.js`, `model.js`, `views/`, `guide.css`, `sw.js`, `changelog.json`, `brand.json`), die Rechenlogik nur dieser App (siehe unten), `img/`, `fonts/`, `capacitor.config.json`, `package.json`, `android/` (Capacitor-Projekt, nur Hülle, kein eigener Java-Code außer `MainActivity`).
- `shared/` – Module, die beide Apps laden: `data.js` (Daten aus dem Branch `data`), `format.js`, `history.js`, `names.js`, `prices.js`, `native.js` (`isNative`, `plugin`).
- `gamedata/` – Stats, HOTM, Attribute (mit `effectKind`), Power, Pets und Essence-Shop-Perks als JSON, geladen und geprüft von `apps/guide/gamedata.js`, gebaut von `scripts/gamedata-build.mjs`.
- `scripts/` – Daten- und CI-Skripte direkt in `scripts/`, Build-Skripte je App in `scripts/bazaar/` und `scripts/guide/`, gemeinsame Bausteine in `scripts/lib/`.
- `tests/` – `node --test`, nur mit Fixtures. Je App ein Ordner: `tests/bazaar/`, `tests/guide/`, `tests/shared/`, `tests/scripts/`. Fixtures in `tests/fixtures/`.
- `docs/` – aktuelle Doku oben: `STRUCTURE.md`, `design-guide-app.md`, `DECISIONS.md`, `SUMMARY.md`, `design-mockups/`, Quellenblätter (`*-sources.md`, `image-sources.md`), `blaze-data.md`, `timing-backfill.md`, `guide-design-check.md` (von `guide:shots` erzeugt). Alte Pläne, Specs, Zusammenfassungen und Fortschrittsnotizen in `docs/archive/`.
- `.github/workflows/` – `snapshot.yml` (alle 20 Minuten Bazaar-Daten in den Branch `data`) und `pages.yml` (baut `_site/` und veröffentlicht die Bazaar-PWA).
- `personal/` – nicht in git: private Guides, Item-Daten, Testprofile. Landet nur in lokalen Builds.

Erzeugt und nicht in git (`npm run clean` löscht sie): `apps/bazaar/www/`, `apps/guide/www-guide/`, `apps/*/android/app/build/`, `apps/guide/shots/`, `_site/`. Ebenfalls nicht in git: `apps/guide/img/hypixel/` (holt `guide:icons`).

## Bazaar-Module (`apps/bazaar/`)

- `app.js` – Zustand, Abruf, Ereignisse. `render.js` – Markup aller Ansichten. `sheet.js` – das eine Fenster für Einstellungen und Filter.
- `onboarding.js`, `tour.js` – Willkommen, Tour, "What's new", Liste alter Speicher-Schlüssel (`RETIRED_KEYS`); `tour.js` verdrahtet es mit der Seite.
- `alerts.js` – Brücke zu den Android-Alarmen (Konfiguration, "gekauft", Berechtigung).
- `flips.js` – Flip-Rechnung (identisch zu `AlertLogic.java`). `npc.js`, `craft.js`, `forge.js` – NPC-, Craft- und Forge-Flips. `minions.js`, `minioncosts.js` – Minion-Rechner.
- `events.js`, `timing.js`, `trends.js`, `chart.js` – Mayor und Events, Event-Timing, Trends, Diagramme.

## Guide-Module (`apps/guide/`)

- `app.js` (Zustand, Routen, Gesten), `model.js` (was die Screens zeigen), `views/` (Markup), `intro.js` (Tour und Neuigkeiten), `migrate.js` (einmaliger Umstieg von der API-Version).
- `progress.js` – Guides laden, prüfen, Schrittkosten, Import/Export. `owned.js` – geteilter Besitz. `keys.js` – gemeinsame Schritt-Schlüssel (`step.key`): Haken solcher Schritte liegen in `pg.keys` und gelten in allen Guides mit demselben Schlüssel, `guide.legacy` führt alte Haken (Abschnitt|Text) bei der Migration auf Schema 3 darauf zurück. `detect.js`, `requires.js` – wann ein Schritt erfüllt ist, HOTM-Sperren. `nbt.js`, `import/` (`api.js`, `items.js`, `profile.js`, `propose.js`), `views/import.js` – Profil-Import, siehe `docs/api-import.md`.
- `optimizer.js`, `optimizer-data.js`, `path.js`, `pieces.js` – Wert je Schritt, Wiki-Werte, Reihenfolge, Gear-Teile.
- `stats.js`, `virtual.js`, `blaze.js` – Item-, Pet- und Power-Werte, Profil aus Häkchen, Blaze-Schadensmodell.
- `totals.js`, `build.js`, `gear.js`, `stats-model.js`, `hotm-model.js`, `attrs-model.js`, `skin.js`, `gamedata.js` – Summe je Stat, Build und Messungen, Gear aus Häkchen, Daten der Stats-Seiten, Spielerfigur, Prüfung von `gamedata/`.

## Imports und flacher Build

In den Quellen zeigen Importe auf den echten Ort: `../../shared/format.js`, `./model.js`, `../optimizer.js` (aus `views/`). Der Build (`scripts/lib/flat.mjs`) legt alles in einen flachen Ordner und schreibt die Importe um (`apps/<app>/x` und `shared/x` werden zu `x`, `gamedata/x` bleibt `gamedata/x`). Was geladen werden darf, steht in `SHELL` in `apps/<app>/sw.js`, relativ zum App-Ordner (`'../../shared/data.js'`). Diese Liste entscheidet über Offline-Cache, APK-Inhalt und die Seite auf GitHub Pages. Eine neue Datei muss also in `SHELL` stehen.

## Befehle

| Befehl | Wirkung |
|---|---|
| `npm test` | alle Tests (`node --test`, rekursiv über `tests/`) |
| `npm run bazaar:serve` | baut `_site/` und serviert es auf http://127.0.0.1:8123 |
| `npm run pages:build` | baut `_site/` (mit `sw.js`), wie der Pages-Workflow |
| `npm run bazaar:build` | Bazaar-APK (Debug): `apps/bazaar/www/` füllen, `cap sync`, Gradle |
| `npm run bazaar:sync` | wie `bazaar:build`, ohne Gradle |
| `npm run guide:build` | Guide-APK (Debug): `apps/guide/www-guide/` füllen, `cap sync`, Gradle |
| `npm run guide:sync` | wie `guide:build`, ohne Gradle |
| `npm run guide:icons` | Minecraft-Texturen und Pet-/Shard-Köpfe holen |
| `npm run guide:shots` | Screenshots und Maß-Abgleich der Guide-App (Playwright) |
| `npm run clean` | löscht die erzeugten Ordner (feste Liste in `scripts/clean.mjs`, nur im Repo) |

APK-Pfade: `apps/bazaar/android/app/build/outputs/apk/debug/app-debug.apk` und `apps/guide/android/app/build/outputs/apk/debug/app-debug.apk`. Beide brauchen JDK 21 und das Android SDK.

## Skripte

- `scripts/snapshot.mjs`, `items.mjs`, `recipes.mjs`, `auctions.mjs`, `election.mjs` – Datenabzug für `data/`, vom Workflow `snapshot.yml` aufgerufen; Namen und Ort dürfen sich nicht ändern.
- `scripts/timing-backfill.mjs`, `backfill-lib.mjs`, `timing-backup.mjs`, `timing-remove-backfill.mjs`, `timing-backfill.json`, `mayors-history.json` – Event-Timing nachtragen, sichern, entfernen.
- `scripts/gamedata-build.mjs`, `gamedata-categories.mjs` – bauen `gamedata/*.json` (Wiki zuerst, NEU als Zweitquelle).
- `scripts/icons.mjs` – App-Symbol zeichnen (`apps/bazaar/icons/`, Android-Ressourcen). `scripts/serve.mjs [port] [dir]` – lokaler Server. `scripts/clean.mjs` – Aufräumen.
- `scripts/bazaar/copy-web.mjs`, `android-build.mjs` – Web-Dateien der Bazaar-App flach legen (`--worker` schreibt auch `sw.js`), APK bauen.
- `scripts/guide/guide-copy.mjs`, `guide-build.mjs`, `guide-shots.mjs`, `fetch-icons.mjs` – dasselbe für die Guide-App, Screenshots, Icons (`guide:build` lädt fehlende Hypixel-Icons nach, offline nur eine Warnung). `mining-steps.mjs` – Schlüssel, Essence-Schritte und Hinweise für die privaten Mining-Build-Skripte (`personal/build-shafting.mjs`, dann `personal/finish-mining.mjs`).
- `scripts/lib/flat.mjs` – Pfad-Abbildung und Import-Umschreibung des flachen Builds.

## Was wohin gehört

- Nur eine App nutzt es: in deren `apps/<app>/`. Beide nutzen es: nach `shared/`, und dann aus beiden `SHELL`-Listen laden.
- Daten für die Guide-App: `gamedata/`. Daten des Branches `data` (Preise, Verlauf): nie im Repo, nur über `shared/data.js` laden.
- Ein Test gehört in den Ordner der App, deren Code er prüft; Skript-Tests nach `tests/scripts/`. Fixtures nur in `tests/fixtures/`.
- Neue Pläne und Specs während der Arbeit nach `docs/` (`plan-*.md`), nach dem Abschluss nach `docs/archive/`.
- Private Dateien ausschließlich in `personal/`; nie in git, nie in Beispiele oder Tests.

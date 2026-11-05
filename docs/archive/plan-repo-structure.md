# Plan: Repo aufräumen (Branch `chore/repo-structure`)

Stand: Plan, noch nichts umgezogen. Ziel: Ordnung ohne Verhaltensänderung. Nach deinem OK arbeite ich in kleinen Commits mit `git mv`, nach jedem Commit läuft `npm test` grün. Kein Push, kein Merge.

## 1. Ist-Zustand (geprüft)

- **Pages**: `build_type: legacy`, Quelle Branch `main`, Pfad `/`. Pages liefert also den Repo-Wurzelordner 1:1 aus. URL: `https://tsaitunq.github.io/bazaar-tracker/`. Es gibt keinen Pages-Workflow, nur `snapshot.yml`.
- **PWA**: `manifest.webmanifest` hat `start_url: "./"`, `scope: "./"`, Icons `icons/icon-*.png`. `sw.js` liegt im Wurzelordner, also Scope = `/bazaar-tracker/`. Cache-Namen: `bt-shell`, `bt-icons`. Die Dateiliste steht in `SHELL` (flach, relativ).
- **Daten**: `data.js` lädt von `raw.githubusercontent.com/Tsaitunq/bazaar-tracker/data/`. Das ist unabhängig vom Ordnerlayout. `snapshot.yml` ruft nur `node scripts/timing-backup.mjs` und `node scripts/snapshot.mjs` auf. `snapshot.mjs` liest `../timing-backfill.json` (Repo-Wurzel).
- **Android**: Bazaar `com.tsaitunq.bazaarflip` (`android/`, `webDir: www`), Guide `com.tsaitunq.guides` (`android-guide/`, `webDir: ../www-guide`). Der Guide-Gradle-Build kopiert die Java-Dateien von `android/app/src/main/java` nach `build/shared-java` (ProfileStore). Beide lesen die Version aus `changelog.json`, Guide zusätzlich `brand.json`. Debug-Signatur kommt vom Debug-Keystore des Rechners, nicht vom Repo, und bleibt unberührt.
- **Storage**: Bazaar `bt.*`, Guide `pg.*`, im WebView-localStorage (Origin `https://localhost`), nicht pfadabhängig. Solange `appId` und Keys gleich bleiben, geht beim Update nichts verloren.
- **Wer nutzt was** (aus dem Importgraph):
  - nur Bazaar: `app, render, sheet, onboarding, tour, chart, craft, events, flips, forge, minioncosts, minions, npc, timing, trends`
  - beide: `data, format, history, names, native, prices`
  - nur Guide: `blaze, detect, optimizer, optimizer-data, owned, path, pieces, progress, requires, stats, virtual` (liegen heute nur im Wurzelordner, weil dort alles liegt)

## 2. Zielstruktur

```
apps/bazaar/        index.html style.css manifest.webmanifest sw.js changelog.json capacitor.config.json
                    app/render/sheet/onboarding/tour + Bazaar-Module (siehe oben)
                    icons/   android/ (Gradle)   www/ (Build, ignoriert)
apps/guide/         bisheriger Inhalt von guide/ + die 11 reinen Guide-Module
                    views/ img/ fonts/ brand.json changelog.json capacitor.config.json
                    android/ (bisher android-guide/)   www-guide/ (Build, ignoriert)
shared/             data.js format.js history.js names.js prices.js native.js (Plugin-Zugriff)
gamedata/           unverändert, oberste Ebene
scripts/            Daten-/CI-Skripte bleiben, wo sie sind (snapshot, items, recipes, auctions, election,
                    timing-*, backfill-lib, gamedata-*, icons, serve, clean, mayors-history.json, timing-backfill.json)
scripts/bazaar/     copy-web.mjs android-build.mjs
scripts/guide/      guide-copy.mjs guide-build.mjs guide-shots.mjs fetch-icons.mjs
tests/bazaar/ tests/guide/ tests/shared/ tests/scripts/   fixtures bleiben in tests/fixtures/
docs/               STRUCTURE.md design-guide-app.md DECISIONS.md design-mockups/ + Quellen-/Datenblätter
docs/archive/       plan-* spec-* summary-* progress-* u. a.
personal/           unverändert, ignoriert
```

`native.js` wird in zwei Teile geteilt: `shared/native.js` (`plugin()`, Held/Namen-Brücke, was der Guide braucht) und Alarm-Teil (`alertConfig`, `syncAlerts`, `requestAlertPermission`, `onRoute`) in `apps/bazaar/alerts.js`. Der Schnitt wird erst beim Umzug festgelegt, wenn klar ist, was der Guide wirklich importiert.

`.github/workflows/snapshot.yml` bleibt unverändert. Deshalb bleiben alle Skripte, die er aufruft, unter `scripts/` mit gleichem Namen, und `timing-backfill.json` wandert nach `scripts/`: Das ändert nur den Pfad in `snapshot.mjs` und `timing-backfill.mjs` (Standard von `--out`), der Workflow bleibt unverändert.

## 3. Pfad-Umzüge (Reihenfolge der Commits)

Jeder Schritt: `git mv`, Importe/Pfade nachziehen, `npm test` grün, ein Commit.

1. **Archiv**: `docs/plan-*, spec-*, summary-*, progress-*, inferno-review-v0.7.4, ux-audit, blaze-gaps, timing-backfill-check, design-varianten` nach `docs/archive/`; `DECISIONS.md` nach `docs/`. Links in `CLAUDE.md`, `README.md`, Code-Kommentaren und Tests nachziehen (`events.test.js` liest `docs/events-sources.md`, die Datei bleibt oben).
2. **tests/** nach Zugehörigkeit (`bazaar/`, `guide/`, `shared/`, `scripts/`), Importe mit relativen Pfaden angepasst. Noch ohne Quellcode-Umzug, nur Tiefe +1.
3. **scripts/** Build-Skripte in `scripts/bazaar/` und `scripts/guide/`, Aufrufe in `package.json` anpassen.
4. **shared/**: die sechs gemeinsamen Module; Importe in Bazaar, Guide, Tests.
5. **apps/bazaar/**: Bazaar-Module, `index.html`, `style.css`, `sw.js`, Manifest, Icons, `changelog.json`, `capacitor.config.json`, `android/`. Gradle-Pfade (`../node_modules` wird `../../../node_modules`, `changelog.json` bleibt `../../`) und `scripts/icons.mjs` (`RES`) angepasst.
6. **apps/guide/**: `guide/` und `android-guide/` plus die 11 Guide-Module. Gradle: `shared-java` zeigt auf `apps/bazaar/android/.../java`, `webDir` wird `www-guide`, `android.path` wird `android`.
7. **Build-Skripte auf neue Pfade** (`copy-web`, `guide-copy`, `clean`, `serve`, `guide-shots`), siehe Abschnitt 5.
8. **Aufräumen** (Abschnitt 6).
9. **docs/STRUCTURE.md** neu, `CLAUDE.md` und `README.md` auf die neuen Pfade.
10. `.gitignore`: `apps/bazaar/www/`, `apps/guide/www-guide/`, `apps/guide/shots/`, `_site/`, `apps/guide/img/hypixel/`.

## 4. Pages-URL und installierte PWA bleiben gleich

Problem: Mit Quelle `main /` würde Pages nach dem Umzug nur noch `README.md` und `apps/...` ausliefern, `index.html`, `sw.js`, Manifest lägen unter `/apps/bazaar/`. Das bricht die URL und den SW-Scope.

Lösung: Pages auf **GitHub Actions** umstellen. Neuer Workflow `.github/workflows/pages.yml`:

- Trigger: `push` auf `main` (nur Pfade `apps/bazaar/**`, `shared/**`, `scripts/bazaar/**`, Workflow selbst) und `workflow_dispatch`.
- Schritt `node scripts/bazaar/copy-web.mjs _site` (derselbe Code, der auch das APK-Web-Verzeichnis baut), dann `actions/upload-pages-artifact` und `actions/deploy-pages`.
- `_site/` ist **flach** wie heute die Wurzel: `index.html`, `sw.js`, `manifest.webmanifest`, `app.js`, `icons/...`. Gemeinsame Module werden beim Kopieren nach `_site/` geflacht (Importe `../../shared/x.js` werden zu `./x.js`, `SHELL` in `sw.js` ebenso). Das ist dasselbe Verfahren wie `guide-copy.mjs` heute.

Damit bleiben identisch: Seiten-URL `https://tsaitunq.github.io/bazaar-tracker/`, `start_url`/`scope` `./`, SW-Pfad `/bazaar-tracker/sw.js`, Cache-Namen `bt-shell`/`bt-icons` und alle Asset-URLs im Cache. Ein neuer Test prüft: `_site` enthält jede Datei aus `SHELL`, keine Importzeile zeigt aus `_site` hinaus, Manifest-Icons existieren.

**Umschaltreihenfolge (damit es keine Lücke gibt):**

1. Vorab ein eigener kleiner Commit auf `main` (von dir gepusht): nur `pages.yml`, das noch das heutige Wurzel-Layout kopiert. Dann in den Repo-Einstellungen Pages auf "GitHub Actions" stellen. Prüfen, dass die URL unverändert läuft.
2. Danach Branch mergen. Der Workflow läuft beim Push und liefert das neue Layout unter derselben URL aus.
3. Würde ich den Branch ohne Schritt 1 mergen, wäre die Seite (alte Quelle `main /`) bis zur Umstellung kaputt. Ich merge nicht und pushe nicht; die beiden Schritte machst du oder gibst sie mir frei.

Nebenwirkung: Bisher war auch alles andere im Repo unter `.../bazaar-tracker/...` abrufbar (z. B. `/guide/`, `/docs/`). Das entfällt. Die Guide-App wird nicht über Pages genutzt (sie ist ein APK).

## 5. Build und Befehle

Befehle bleiben, Ziele ändern sich:

| Befehl | Wirkung |
|---|---|
| `npm run bazaar:build` (neu; `android:build` bleibt als Alias) | `apps/bazaar/www/` füllen, `cap sync`, `gradlew assembleDebug` im Bazaar-Android |
| `npm run guide:build` | `apps/guide/www-guide/` füllen, `cap sync`, `gradlew assembleDebug` |
| `npm run bazaar:sync`, `guide:sync` | wie bisher, ohne Gradle |
| `npm run pages:build` (neu) | `_site/` lokal erzeugen |
| `npm test` | `node --test` findet `tests/**` rekursiv, testet alles |
| `npm run clean` | siehe Abschnitt 6 |

- Capacitor: `cap sync` läuft in `apps/bazaar/` bzw. `apps/guide/` (jeweils eigene `capacitor.config.json`). Die Pakete bleiben im Wurzel-`node_modules`; Capacitor sucht aufwärts, der Guide macht das heute schon. Das prüfe ich als Erstes beim Umzug mit einem echten Build, bevor ich weitermache.
- `serve.mjs` bedient dann `_site/` bzw. den Build-Ordner statt der Wurzel, damit lokal derselbe Pfadaufbau wie live gilt.
- `scripts/guide/guide-copy.mjs` löst `../`-Verweise des `SHELL` über eine Tabelle auf (`shared/`, `gamedata/`). Die Ausgabe (`www-guide/`) ist Byte für Byte dieselbe wie heute; ich vergleiche vor und nach dem Umzug die Dateilisten und Hashes.

## 6. Nebenbei (Regel 5)

- **`npm run clean`**: Liste fester Ordner (`apps/bazaar/www`, `apps/guide/www-guide`, beide `android/app/build`, `apps/guide/shots`, `_site`). Jeder Eintrag wird gegen die Repo-Wurzel aufgelöst und nur gelöscht, wenn er darin liegt; keine Wildcards, kein `personal/`, nichts außerhalb des Repos.
- **GuidePlugin**: `loadProfile`, `clearApiKey`, `clearProfile` raus. Folgen: `readLegacyProfile`/`clearProfileData` in `native.js` raus, `runMigration` verliert den Plugin-Teil, in `ProfileStore.java` entfallen `loadProfile`/`clearProfile` (prüfe, ob der Bazaar sie nutzt; im Code ist nur `removeTemp` in `AlertsPlugin` zu sehen). Tests (`guide-copy.test.js` mit der Methodenliste, `native.test.js`, `guide-migrate.test.js`) werden angepasst.
- **Ungenutzte Storage-Keys**: Bazaar hat `RETIRED_KEYS` (`dropRetired`). Kandidaten: `bt.names` (nur 1 Treffer), im Guide `pg.profile`, `pg.seenVersion`, `pg.tour`, `pg.schema`. Ich inventarisiere, welche Keys nirgends mehr gelesen oder geschrieben werden, und lösche sie beim Start über eine `RETIRED_KEYS`-Liste. Aktive Keys und ihre Namen ändere ich nicht.
- **Toter Code**: `requires.js` (Konstanten und Funktionen ohne Aufrufer, Reste der Profil-/Sync-Prüfung wie `lockProfile`-Zweige, die nur dem alten Profil dienten), Reste von `sync`/`profile` in `native.js`, `guide/migrate.js`, `app.js`. Vorgehen: erst per Grep belegen, dass es keinen Aufrufer gibt, dann entfernen, im Commit-Text die Liste.

## 7. Risiken und Gegenmaßnahmen

| Risiko | Gegenmaßnahme |
|---|---|
| Pages liefert nach dem Merge leere Seite | Umschaltreihenfolge aus Abschnitt 4, vorher Test mit `workflow_dispatch` |
| SW-Scope oder Cache-Namen ändern sich, installierte PWA verliert Daten/Offline | `_site` flach, Namen unverändert, Test auf `CACHE`, `ICONS`, `scope`, `start_url` |
| `cap sync` findet `node_modules` im neuen Ordner nicht | Als erster Test beim Umzug in `apps/bazaar/`; Fallback npm-Workspaces oder `--config` |
| Gradle-Pfade (`node_modules`, `shared-java`, `changelog.json`) brechen | Beide Debug-APKs nach Schritt 5 und 6 bauen; `applicationId`, `versionCode`, `versionName` vor und nach per `aapt dump badging` vergleichen |
| Update wirft Daten weg | `appId`, Storage-Keys und Debug-Keystore bleiben; Test über `pg.*`/`bt.*`-Liste |
| `git mv` plus Inhaltsänderung verliert die Historie | Umzug und Importänderung in getrennten Commits, wo es geht; Rename-Erkennung per `git log --follow` stichprobenartig geprüft |
| `snapshot.yml` bricht | Datei und Skriptnamen unverändert; `timing-backfill.json`-Pfad in `snapshot.mjs` per `snapshot.test.js` abgedeckt |
| Doku-Links zeigen ins Leere | Grep nach `docs/plan-`, `docs/summary-` usw. vor dem Commit |
| Private Daten in git | `personal/` bleibt ignoriert; vor jedem Commit `git status` auf `personal/` prüfen; Autor ist `Tsaitunq` (noreply) |

## 8. Offene Fragen an dich

1. **Pages-Umstellung** (Abschnitt 4): Soll ich `pages.yml` als ersten Commit vorbereiten und du schaltest in den Settings um? Oder lieber Weiterleitung über ein Mini-`index.html` im Wurzelordner? (Letzteres würde die PWA-URL nicht erhalten, nur ein Redirect; deshalb meine Empfehlung: Actions.)
2. **Kleine Dateien**: `SUMMARY.md` nach `docs/`, `docs/superpowers/` unverändert lassen und `docs/archive/` nur für plan/spec/summary/progress plus die genannten Einzeldateien, ok?
3. **Alter Migrationscode im Guide**: Nur den Plugin-Teil entfernen und den Rest von `runMigration` (erkannte Häkchen) vorerst lassen, oder die ganze Migration samt `pg.profile`/`pg.schema` streichen?
4. **Guide-Build-Ordner**: `apps/guide/www-guide/` wie von dir genannt. Für Bazaar `apps/bazaar/www/`, passt das?

## 9. Umsetzung: Abweichungen vom Plan

- **Pages** zuerst als eigener Schritt (`chore/pages-workflow`, schon in `main`). Der Workflow ruft jetzt `node scripts/bazaar/copy-web.mjs _site --worker`; `--worker` schreibt zusätzlich ein geflachtes `sw.js` (der Worker steht nicht in der eigenen `SHELL`-Liste). Das `sw.js` in `_site/` ist Byte für Byte das von vorher.
- **Antworten übernommen**: `SUMMARY.md` nach `docs/`, `docs/blaze-data.md` bleibt oben, `blaze-gaps.md` im Archiv, Build-Ordner `apps/bazaar/www/` und `apps/guide/www-guide/`.
- **`apps/bazaar/package.json`** neu: `cap sync` braucht eine `package.json` im Arbeitsordner (der Guide hatte schon eine).
- **`android:*`** heißt jetzt `bazaar:*` (`bazaar:build`, `bazaar:sync`); neu: `bazaar:serve`, `pages:build`.
- **GuidePlugin** ist ganz entfernt, nicht nur die drei Methoden: ohne sie blieb eine leere Plugin-Klasse, und `plugin()` diente der Guide-App nur als "läuft nativ"-Schalter. Sie fragt jetzt `Capacitor.isNativePlatform()` (`isNative()` in `shared/native.js`). Damit ruft nichts mehr `clearProfileData` auf, es kann also auch nichts krachen. Die Gradle-Kopie von `ProfileStore.java` in den Guide-Build entfällt. `runMigration` liest nur noch `pg.profile` aus dem localStorage.
- **`ProfileStore.java` im Bazaar** bleibt unverändert (nur `removeTemp` wird noch benutzt); die toten Methoden dort sind ein offener Punkt.
- **Tote Storage-Keys**: Inventur per grep ergab keinen weiteren Schlüssel, der nirgends gelesen wird; `RETIRED_KEYS` bleibt, wie es ist.
- **Toter Code** entfernt: `BLAZE_FAMILIES`, `lockedByBuild`, `mergeAuto`, `doneSince`, `loadStatsPreset` (samt Kopie von `personal/stats-preset.json`), die Prüfzweige SKILL/SLAYER/KUUDRA/COLLECTION in `requires.js`. Nicht angefasst, obwohl ohne Aufrufer in der App: `blazeConstraints`, `loadoutOf` (viele Tests).

# Guide-App, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der Progress-Teil läuft zusätzlich als eigene App "Progress Guides" im neuen Design, mit denselben Funktionen und ohne Änderung an der Bazaar-App.

**Architecture:** Gleiches Repo. `guide/` enthält Einstiegsseite, Ansichten, CSS und Service Worker und importiert die Logik aus dem Root per `../`. `scripts/guide-copy.mjs` legt die Import-Hülle flach nach `www-guide/`. `android-guide/` ist ein eigenes Capacitor-Projekt mit eigener App-ID, das `ProfileStore.java` mit der Bazaar-App teilt.

**Tech Stack:** ES-Module, Capacitor 8, `node --test`, Playwright (nur für Screenshots und Maßtabelle).

**Spec:** `docs/design-guide-app.md`, Pixel-Vorlage `docs/design-mockups/*.dc.html`. Funktionen: `docs/spec-optimizer.md`.

## Global Constraints

- Branch `feat/guide-app` von `main`. Commits pro Task, nichts pushen.
- App-ID `com.tsaitunq.guides`. Name "Progress Guides", nur in `guide/brand.json` festgelegt. Kein "SkyBlock" im Namen.
- `guide/changelog.json` ab `0.1.0`. Die Bazaar-Version und `changelog.json` bleiben unberührt.
- Bazaar-App verhält sich gleich. Der Progress-Tab bleibt. Alle bestehenden Tests bleiben grün.
- Tests ohne Live-API. Fixtures synthetisch, keine Guide-Texte, Namen oder Profildaten im Repo.
- `personal/guides/` kommt nur lokal ins APK. `www-guide/` und die kopierten Assets sind gitignored. Key nie in Repo oder Logs. Sync nur mit Plugin.
- Preise weiter vom `data`-Branch über `data.js`, kein neuer Server.
- Farben nur als Tokens je Theme in `guide/guide.css`, Werte aus der Design-Doc. Inline-Styles der Vorlage werden CSS-Regeln. Mockup-Syntax (`{{…}}`, `<sc-for>`, `<sc-if>`, `<dc-import>`, `data-props`) und Beispieldaten aus `renderVals()` werden nicht übernommen.
- Text ≥ 4.5:1 auf `bg` und `surface`, Touch-Ziele ≥ 44 px. Werte immer mit Einheit (`0.33 % / 1M`), Zahlen mit Tausenderkomma (`3,459`).
- UI-Texte Englisch. Nach jeder Ersetzung per grep prüfen, ob sie angekommen ist.
- Testfehler stoppen den Commit: Exit-Code prüfen, nicht durch eine Pipe verlieren.

## Struktur

```
guide/
  brand.json           Name, einzige Stelle
  changelog.json       Version der App
  index.html           Einstieg
  app.js               Zustand, Routen, Sync, Preise, Ereignisse
  views/parts.js       Ring, Stat-Raster, Pfad, Schritt-Karte, Chips, Leiste, Zurück
  views/home.js        Startseite
  views/guide.js       Path, Best value, Stats je Guide
  views/settings.js    Settings und Profil
  model.js             Ansichtsdaten aus geteilter Logik, ohne HTML
  guide.css            Themes und Regeln
  fonts/               Space Grotesk 400, 500, 700 (woff2, OFL mit Lizenzdatei)
  sw.js, manifest.webmanifest, capacitor.config.json
android-guide/         Capacitor-Projekt
scripts/guide-copy.mjs, guide-build.mjs, guide-shots.mjs
tests/guide-*.test.js, tests/fixtures/guide/
```

## Festgelegte Entscheidungen

Freigegeben am 2026-11-01.

- **Kapitel:** optionales Guide-Feld `chapters: [{ name, sections: string[] }]`, von `validGuide` durchgelassen. Ohne Feld: jede Section ein Kapitel, wenn es genau 3 sind (Mining), sonst Dreiteilung nach Schrittzahl als Rückfall. Für Blaze trägst du oder ich es nur lokal in `personal/guides/blaze-slayer.json` ein.
- **Ansichten ohne Vorlage:** Best value, Stats, Settings entstehen aus denselben Bausteinen und Tokens. Sie gelten im Abgleich als "ohne Vorlage".
- **"Unlocked this week":** Die App merkt je Schritt das Datum des ersten Erledigt-Stands. Beim ersten Start gilt für alles Erledigte Datum 0, die Kachel zählt also erst ab Installation.
- **Schrift:** lokal, kein Abruf bei Google.
- **Scrollen:** Pfad scrollt, Kopfbereich und Leiste bleiben fest. Das ist die einzige gewollte Abweichung von `height: 844px; overflow: hidden`.
- **Abgleich:** Screenshots nur der eigenen App, dazu eine Tabelle Maß aus `.dc.html` gegen berechnetes CSS. Den visuellen Vergleich machst du.

## Abweichungen und Unklarheiten

**Vorlage gegen Design-Doc, es gilt die Vorlage (dein Auftrag):**

| Punkt | Design-Doc | Vorlage |
|---|---|---|
| Stat-Raster Blaze, Wert | 22 px | 18 px, Delta 12 px, Label 11 px |
| Stat-Raster Blaze, Abstände | | Padding 12/14, `row-gap` 10, `column-gap` 8, Mining 14/16 und 12 |
| Karte, Titel | | Mining 17 px, Blaze 16 px |
| Karte, Stat-Zeile | | Mining 15 px, Blaze 14 px |
| Leiste | aktiv `raised` | Guide 56 px hoch mit `raised`. Home 60 px, Knöpfe 48 px, aktiv `#221E2E`, das ist `track` |
| Home-Button "Stats" | Profil-Button | Link auf `S-1.dc.html`, die Datei fehlt. Er öffnet Stats |

**Offene Punkte, die ich so löse (C1 bis C6). Bitte prüfen:**

- **C1, Farming-Vorlage:** Die Vorlage zeigt einen vollen Guide mit Beispieldaten, dein Auftrag einen Leerzustand. Gebaut wird der Leerzustand: Kopf, Ring auf 0 %, Theme, "Guide coming soon", keine Beispielwerte. Stat-Raster und Pfad entfallen dort, Leiste ohne Best value und Stats. Ohne Guide bleibt die Home-Karte, aber ohne Prozent.
- **C2, keine Vergleichskarte über Einheiten (Auftrag 2026-11-01):** Mining rechnet `% yield`, Blaze `% damage`, das ist nicht vergleichbar. Statt der Karte "BEST DEAL RIGHT NOW" zeigt Home je Guide eine Zeile `Bereich: bester Schritt · Wert + Einheit`. Die Einzel-Karte kommt erst mit einer gemeinsamen Einheit (coins/h) zurück. Das ist eine Abweichung von Vorlage und Design-Doc.
- **Score austauschbar (Auftrag 2026-11-01):** Heute `% yield` und `% damage`, später coins/h mit Amortisation. Ansichten zeigen Wert und Einheit nur aus der Score-Funktion des Bereichs. Darum steht auf der Karte `+2.4 % yield` statt des Beispieltexts `more gems` der Vorlage.
- **C3, Blaze zeigt 6 Stats:** Die Vorlage nennt Strength, Crit Damage, Crit Chance, Attack Speed, Health, Defense. True Defense steht im Chip, Magical Power ebenso.
- **C4, Mining zeigt 4 Stats:** Fortune, Speed, Pristine, Gemstone Fortune. Ore und Block Fortune nur unter Stats.
- **C5, Ansicht einer erledigten Zeile:** Die Vorlage hat kein Rückgängig. Eine Zeile bleibt antippbar und zeigt bei API-Haken `API` und `Undo`, Teil-Erfüllung als `3 / 4`. Diese Elemente haben keine Vorlage. Ohne sie ginge eine Funktion verloren.
- **C6, Reset, Import, Export:** in Settings, nicht im Pfad.

## Review Focus

1. Kein Guide im APK oder Browser: Home zeigt den Leerzustand, kein Fehler (Test in Task 7).
2. Bazaar-Build enthält nichts aus `guide/`, der Guide-Build nichts Bazaar-Eigenes wie `flips.js`, und kein Key steht im Bundle (Tests in Task 8).
3. Haken im laufenden Pfad gesetzt: Die Liste behält die Scrollposition, der Fokus bleibt auf der Zeile (Test in Task 9 per Playwright).
4. Preise fehlen oder laden noch: Ring und Pfad zeigen sich, Kosten als `…`, nichts wird als `0` gerechnet (Test in Task 5).
5. Profil mit fremder UUID, offline, Key abgelehnt: gleiche Meldungen wie bisher, letzter Stand bleibt (Test in Task 7).

---

### Task 1: Geteilten Code vorbereiten

**Files:**
- Create: `format.js`, `docs/design-guide-app.md`, `docs/design-mockups/*` (vorhandene Dateien aufnehmen)
- Modify: `render.js`, `progress.js`, `sw.js`, `.gitignore` (`www-guide/`, `guide-shots/`)
- Test: `tests/render.test.js`, `tests/progress.test.js`

**Interfaces:**
- Produces: `format.js` exportiert `esc`, `coins`. `render.js` exportiert beide weiter, alle bisherigen Aufrufer bleiben.

- [ ] **Step 1: Failing test schreiben**

```js
test('progress.js does not pull the market views', () => {
  assert.doesNotMatch(readFileSync('progress.js', 'utf8'), /from '\.\/render\.js'/);
});
test('render.js still exports esc and coins', () => {});
```

- [ ] **Step 2: Test ausführen.** Erwartet: FAIL.
- [ ] **Step 3: Implementieren.** `esc`, `coins` und deren Hilfswerte verschieben, `format.js` in `SHELL`. `optimizer.js` importiert aus `format.js`.
- [ ] **Step 4: `npm test` ausführen.** Erwartet: PASS.
- [ ] **Step 5: Commit** `refactor: move esc and coins to format.js`

### Task 2: Rangliste ohne HTML

**Files:**
- Modify: `optimizer.js`
- Test: `tests/optimizer.test.js`

**Interfaces:**
- Produces: `rankArea({ guide, checked, ctx, state, settings, keepOldGear, boosts, preset }) -> { area, groups, loadout, base, best, notes, limits?, paths?, blaze? } | { missing: 'profile'|'items' }`. `limits: { trueDefense, mp, low: boolean, underTarget: boolean, unknown: boolean }`, `paths: { guide, ofa, leader, lead, inUse }`. Texte der Hinweise bleiben als Liste. Bisherige `bestValueView` baut darauf auf. `SCORES[area] = { gainText(gain), rateText(perMillion), rateLong(perMillion) }`, und `rankArea` liefert `score` mit. Keine Ansicht schreibt eine Einheit selbst, ein Wechsel auf coins/h ändert nur `SCORES` und die Berechnung.

- [ ] **Step 1: Failing tests schreiben**

```js
test('rankArea gives the same groups as the view for mining and blaze', () => {});
test('rankArea says what is missing without profile or item data', () => {});
test('limits and paths are data', () => {});
test('each area has its score texts, and a swapped score changes the unit in the result', () => {});
```

- [ ] **Step 2: Test ausführen.** Erwartet: FAIL.
- [ ] **Step 3: Implementieren.** Reine Verschiebung aus `bestValueView` und `blazeValueView`, dazu die Daten aus `limitsView` und `pathsView`.
- [ ] **Step 4: `npm test` ausführen.** Erwartet: PASS, alle HTML-Tests aus Paket 5 und 6 unverändert.
- [ ] **Step 5: Commit** `refactor: split the ranking from its view`

### Task 3: Guide-Felder und Daten je Haken

**Files:**
- Modify: `progress.js` (`validGuide`, `area: 'farming'`, `chapters`)
- Create: `guide/model.js` (erster Teil)
- Test: `tests/progress.test.js`, `tests/guide-model.test.js`

**Interfaces:**
- Produces: `chaptersOf(guide, checked) -> [{ name, done, total, share, current }]`, `stampDone(prev, doneKeys, now, firstRun) -> map`, `unlockedThisWeek(stamps, now) -> number`. In `validGuide`: `area` zusätzlich `farming`, `chapters` geprüft.

- [ ] **Step 1: Failing tests schreiben**

```js
test('validGuide keeps area farming and valid chapters, drops broken ones', () => {});
test('a chapter with an unknown section is dropped, not fatal', () => {});
test('three sections make three chapters', () => {});
test('without chapters a long guide is split in three by step count', () => {});
test('a guide with less than three steps still gives three arcs', () => {});
test('the current chapter holds the first open step', () => {});
test('the first run stamps what is done with 0', () => {});
test('a step done later keeps its first date, undone clears it', () => {});
test('unlockedThisWeek counts the last seven days only', () => {});
```

- [ ] **Step 2: Test ausführen.** Erwartet: FAIL.
- [ ] **Step 3: Implementieren.**
- [ ] **Step 4: `npm test` ausführen.** Erwartet: PASS.
- [ ] **Step 5: Commit** `feat: add chapters and done dates for the guide app`

### Task 4: Themes, Schrift, Kontrast

**Files:**
- Create: `guide/guide.css`, `guide/fonts/*`
- Modify: `tests/contrast.test.js` (nur neue Prüfung)
- Test: `tests/guide-css.test.js`

**Interfaces:**
- Produces: `[data-theme="home|mining|blaze|farming"]` setzt `--area, --bg, --surface, --raised, --deep, --line, --track, --muted, --soft, --text, --dim, --k1, --k2, --k3`. `:root`: `--stat-orange, --stat-pink, --stat-red, --stat-blue, --stat-yellow, --stat-green, --stat-white, --stat-cyan, --gain`, Rarity-Rahmen.

- [ ] **Step 1: Failing tests schreiben**

```js
test('each theme defines every token with the values of the design doc', () => { /* Tabelle aus design-guide-app.md als Fixture im Test */ });
test('no colour is written into a rule outside the tokens', () => {});
test('text tokens reach 4.5 to 1 on bg and surface in every theme', () => {});
test('the gain colour and stat colours reach 4.5 to 1 on surface', () => {});
test('no font comes from outside', () => {});
```

- [ ] **Step 2: Test ausführen.** Erwartet: FAIL.
- [ ] **Step 3: Implementieren.** Regeln aus den Inline-Styles, je Baustein eine Klasse, Maße 1:1. Fällt ein Paar unter 4.5:1 (`muted`, `dim` als Text), wird es im Bericht genannt, `dim` nur für Ringe. Werte aus der Design-Doc bleiben unverändert.
- [ ] **Step 4: Test ausführen.** Erwartet: PASS.
- [ ] **Step 5: Commit** `feat: add the guide app themes and font`

### Task 5: Bausteine und Ansichtsdaten

**Files:**
- Create: `guide/views/parts.js`
- Modify: `guide/model.js`
- Test: `tests/guide-parts.test.js`, `tests/guide-model.test.js`

**Interfaces:**
- Consumes: `rankArea` (Task 2), `chaptersOf` (Task 3), `format.js`.
- Produces: `ring({ chapters, total, size }) -> svg`, `statGrid(stats, columns)`, `pathRow(row)`, `stepCard(card)`, `chips(limits)`, `bottomBar(tabs, active)`, `backLink()`. Modell: `guideModel(guide, world) -> { theme, chapters, total, stats, chips, rows, card, tabs }`, `stepStatus -> 'done'|'current'|'open'|'locked'`, `statDelta(stats, nextStep)`.

- [ ] **Step 1: Failing tests schreiben**

```js
test('the ring has three arcs with the gap and radius of the mockup', () => {
  /* r 47, Strich 11, Lücke 15; Bögen C/3 − 15; dashoffset −(i·C/3) − 7.5; kleiner Ring r 28, Strich 7, Lücke 10 */
});
test('an empty chapter still draws its track and a 0.1 fill like the mockup', () => {});
test('a row shows the rate from the score of its area, done in green, locked with its reason', () => {});
test('no building block writes a unit of its own', () => { /* ein Test-Score mit 'coins/h' erscheint auf Zeile und Karte */ });
test('the line runs in area up to the current step, after that in line', () => {});
test('only the next step opens as a card', () => {});
test('the card shows the hypixel stat, the gain, the cost and the rate', () => { /* '+8 ☘ Mining Fortune', '+2.4 % yield', '0.61 % per 1M' */ });
test('the card gets the BEST VALUE badge only when it leads the ranking', () => {});
test('a partly done step shows have / need with API, an API tick has Undo', () => {});
test('the delta is the preview of the next step and empty without one', () => {});
test('numbers use the thousands comma', () => { assert.equal(number(3459), '3,459'); });
test('without prices cost shows … and is never 0', () => {});
test('chips show true defense and power with their state', () => {});
test('all text is escaped', () => {});
```

- [ ] **Step 2: Test ausführen.** Erwartet: FAIL.
- [ ] **Step 3: Implementieren.** Icons (Pickaxe, Flamme, Blatt, Profil) als SVG-Pfade aus der Vorlage.
- [ ] **Step 4: Test ausführen.** Erwartet: PASS.
- [ ] **Step 5: Commit** `feat: add the guide app building blocks`

### Task 6: Ansichten

**Files:**
- Create: `guide/views/home.js`, `guide/views/guide.js`, `guide/views/settings.js`
- Modify: `guide/model.js`
- Test: `tests/guide-views.test.js`

**Interfaces:**
- Produces: `homeView(world)`, `guideView(world, area, tab)`, `statsView(world)`, `settingsView(world)`. Modell: `bestPerGuide(worlds) -> [{ area, name, step, text }]`, `coinsForNext(guides)`.

- [ ] **Step 1: Failing tests schreiben**

```js
test('home shows one line per guide with its best step, value and unit, and no shared best deal card', () => {});
test('home has one card per guide in its theme, next step in area colour', () => {});
test('home shows coins for all next steps and unlocked this week', () => {});
test('a missing price leaves coins marked, not lower', () => {});
test('the guide screen sets its theme on the root', () => {});
test('blaze shows six stats in three columns and the two chips, mining four in two and none', () => {});
test('best value lists requirements, ranked, locked, no price, no gain data, no gain', () => {});
test('best value shows best possible, the notes and for blaze the path comparison', () => {});
test('below a limit the screen warns', () => {});
test('stats shows the slots, the /stats form, the difference and the offset notes', () => {});
test('settings holds uuid, key state, weights, presets, keep gear, boosts, import, export, reset', () => {});
test('the key field never shows the key', () => {});
test('farming shows the empty state with its theme and no sample values', () => {});
test('no guide at all shows an empty home', () => {});
test('no sync shows what is missing and links to settings', () => {});
```

- [ ] **Step 2: Test ausführen.** Erwartet: FAIL.
- [ ] **Step 3: Implementieren.** Vorhandene `statsEntry`, `compareStats`, `syncView`-Logik weiterverwenden, Markup neu.
- [ ] **Step 4: Test ausführen.** Erwartet: PASS.
- [ ] **Step 5: Commit** `feat: add the guide app screens`

### Task 7: App, Routen, Service Worker

**Files:**
- Create: `guide/index.html`, `guide/app.js`, `guide/sw.js`, `guide/manifest.webmanifest`, `guide/brand.json`, `guide/changelog.json`, `tests/fixtures/guide/*`
- Test: `tests/guide-app.test.js`, `tests/guide-sw.test.js`

**Interfaces:**
- Consumes: `data.js`, `native.js`, `sync.js`, `profile.js`, `progress.js`, Ansichten.
- Produces: Routen `#/`, `#/guide/<id>/path|best|stats`, `#/stats`, `#/settings`. Speicher mit Präfix `pg.`: `pg.checks`, `pg.dates`, `pg.settings`.

- [ ] **Step 1: Failing tests schreiben**

```js
test('parseRoute reads each route, an unknown guide goes home', () => {});
test('marks of pg.checks use the keys of the existing export', () => {});
test('importing a bazaar export brings the checks over', () => {});
test('the worker shell covers the import closure of guide/app.js', () => {});
test('the worker registers only outside the native app', () => {});
test('sync errors give the known messages and keep the last state', () => {});
test('a sync without plugin is not offered', () => {});
test('no guide file gives an empty home without an error', () => {});
```

- [ ] **Step 2: Test ausführen.** Erwartet: FAIL.
- [ ] **Step 3: Implementieren.** `plugin()` aus `native.js`. Scope des Workers `/guide/`, `SHELL` mit `../`-Pfaden. Reine Funktionen in `model.js`, damit `app.js` dünn bleibt.
- [ ] **Step 4: `npm test` ausführen.** Erwartet: PASS.
- [ ] **Step 5: Commit** `feat: wire up the guide app`

### Task 8: Build und Android-Projekt

**Files:**
- Create: `scripts/guide-copy.mjs`, `scripts/guide-build.mjs`, `guide/capacitor.config.json`, `android-guide/**`, `android-guide/.../GuidePlugin.java`, `.../MainActivity.java`
- Modify: `package.json` (`guide:sync`, `guide:build`, `guide:shots`), `.gitignore`
- Test: `tests/guide-copy.test.js`

**Interfaces:**
- Produces: `copyGuide(root, out)`. `GuidePlugin` heißt `BazaarAlerts` und bietet nur `setApiKey, getApiKey, clearApiKey, saveProfile, loadProfile, clearProfile`.

- [ ] **Step 1: Failing tests schreiben**

```js
test('the build rewrites ../ imports to ./ and leaves nothing outside the folder', () => {});
test('every import of the build resolves to a copied file', () => {});
test('the build holds no market code such as flips.js or portfolio views', () => {});
test('personal guides come along only when they exist', () => {});
test('the name is taken from brand.json in config, manifest and title', () => {});
test('no key pattern and no API-Key string outside sync.js in the build', () => {});
test('the bazaar copy holds nothing of guide/', () => {});
```

- [ ] **Step 2: Test ausführen.** Erwartet: FAIL.
- [ ] **Step 3: Skripte schreiben.** Name aus `brand.json` in Capacitor-Config, Manifest, `<title>` und `strings.xml` beim Bau.
- [ ] **Step 4: Capacitor-Projekt anlegen.** `npx cap add android` aus `guide/` mit `webDir: ../www-guide`, `android.path: ../android-guide`. Klappt das nicht, Alternative prüfen und im Bericht nennen.
- [ ] **Step 5: Native Teile.** `ProfileStore.java` per `sourceSets` aus `android/` einbinden, `versionName` und `versionCode` aus `guide/changelog.json`. Keine Alert-Rechte im Manifest, kein WorkManager. `allowBackup` wie in der Bazaar-App, `ProfileStore` nutzt `noBackupFilesDir`. Eigenes Icon im Home-Lila.
- [ ] **Step 6: `npm test` und `npm run guide:build` ausführen.** Erwartet: PASS und ein APK. `git status` zeigt keine Assets, keine Guides.
- [ ] **Step 7: Commit** `feat: build the guide app for Android`

### Task 9: Screenshots und Maßtabelle

**Files:**
- Create: `scripts/guide-shots.mjs`, `docs/guide-design-check.md`
- Modify: `package.json` (`playwright` als devDependency)

**Interfaces:**
- Consumes: `www-guide/`, `tests/fixtures/guide/*`. Stubs für Plugin und `page.route` für Preise, ohne Netz.

- [ ] **Step 1: Skript schreiben.** 390×844, je Ansicht ein Bild in `guide-shots/` (gitignored): Home, Mining Path, Best value, Stats, Blaze Path, Best value, Stats, Farming, Settings, globale Stats, Leerzustand ohne Sync. Prüft nebenbei: Scrollposition und Fokus nach einem Haken, Touch-Ziele ≥ 44 px, kein waagerechtes Scrollen, keine Konsolenfehler.
- [ ] **Step 2: Tabelle erzeugen.** Je Baustein Selektor, Eigenschaft, Wert aus `.dc.html`, berechneter Wert. Spalte "Abweichung". Ansichten ohne Vorlage als solche markiert. Abweichungen aus diesem Plan mit Grund.
- [ ] **Step 3: `npm run guide:shots` ausführen.** Erwartet: alle Bilder, keine ungeklärte Abweichung. Ungeklärte beheben.
- [ ] **Step 4: Commit** `test: add screenshots and the design check for the guide app`

### Task 10: Abschluss

**Files:**
- Modify: `guide/changelog.json`, `docs/design-guide-app.md` (nur Verweis auf Tabelle)
- Local only: `personal/guides/mining.json`, `personal/guides/blaze-slayer.json` (`chapters` für Blaze)

- [ ] **Step 1: Changelog** `0.1.0` mit Datum des Abschlusses.
- [ ] **Step 2: `npm test` ausführen.** Erwartet: alle PASS, bestehende und neue.
- [ ] **Step 3: Prüfen, dass die Bazaar-App gleich bleibt.** `git diff main -- app.js index.html style.css sw.js` zeigt nur die Umzüge aus Task 1. `npm run android:build` läuft.
- [ ] **Step 4: Commit** `feat: release the guide app (0.1.0)`. Nicht pushen.
- [ ] **Step 5: Kapitel-Vorschlag.** Liste "Section → Kapitel" nur mit Section-Titeln im Chat vorlegen. **STOPP, auf OK warten.**
- [ ] **Step 6: Nach OK eintragen.** `chapters` lokal in `personal/guides/blaze-slayer.json`, per Test am echten Guide prüfen, Ausgabe nur als Anzahlen. Kein Commit dafür.

## Nicht in diesem Plan

Bazaar-Progress-Tab entfernen, Farming-Inhalt und Score-Formel, Migration von Key und Profil zwischen den Apps. Das eigene Gerät testest du. Am Gerät nötig: neu Key eingeben, syncen, Haken über Export aus der Bazaar-App und Import übernehmen.

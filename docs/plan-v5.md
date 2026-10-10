# Bazaar Flip Helper V5 Implementation Plan

**Goal:** Forge-Flips, Mayor- und Event-Radar und Trend-Signale, dazu eine zweigeteilte Tour, ohne die Bewertungslogik anzufassen.

**Architecture:** Der Snapshot-Workflow liefert vier Dinge mehr: `forge.json` (Rezepte), `ah.json` (Lowest BIN der Forge-Ergebnisse), `election.json` und einen Trendwert in `stats.json`. In der App kommen drei reine Module dazu, alle in Node getestet: `forge.js` (Rechnung), `events.js` (SkyBlock-Zeit, Termine, betroffene Items), `trends.js` (Steigung, Schwellen). `render.js` baut Karten, Badges und das Radar; `app.js` verdrahtet.

**Tech Stack:** unverändert (Vanilla JS, CSS, `node --test`, Capacitor, Gradle).

**Spec:** `docs/spec-v5.md`

## Global Constraints

- Keine Änderung an `flips.js`, `npc.js`, `craft.js`, `AlertLogic.java`, `AlertWorker.java`. In `history.js` ändert sich keine bestehende Funktion.
- Texte englisch. Farben nur über Tokens; Kontrasttest bleibt grün.
- Tests ohne Netz. Für Fixtures und Screenshots wurde je eine API-Antwort einmal gespeichert.
- Jede neue Datei, die die App lädt, steht in `SHELL`.
- Commits auf Branch `v5`, kein Push.

## Review Focus

1. `stats.json` bekommt ein viertes Feld. `statOf` und `AlertLogic.readStats` lesen nur die ersten drei; alte App-Versionen laufen weiter. Test in Task 1.
2. Fehlt `forge.json`, `ah.json` oder `election.json`, läuft die App normal: Forge-Tab mit Hinweis, Radar nur mit Events. Task 2 und 4.
3. Ein Auktionsabruf, der mittendrin scheitert, überschreibt `ah.json` nicht. Task 1.
4. Trend-Sortierung darf Portfolio und Opportunities nicht verändern, nur die Reihenfolge der Anzeige. Task 3.
5. Fünf Tabs bei 360 px, aktiver Tab sichtbar. Task 2, Sichtprüfung in Task 6.

---

### Task 1: Daten aus dem Workflow

**Files:** `scripts/recipes.mjs`, `scripts/auctions.mjs`, `scripts/election.mjs`, `scripts/snapshot.mjs`, `trends.js`, `sw.js`, Tests.

- `parseForge(item)`, `buildForge(items, bazaarIds)` → `{ ID: { n, d, h, c?, i } }`; `refreshRecipes` schreibt zusätzlich `forge.json`.
- `itemId(itemBytes)`, `lowestBins(auctions, wanted, into)`, `fetchLowestBins(getPage, wanted)`.
- `compactElection(json)`.
- `trendSlope(points)` in `trends.js`; `runSnapshot` hängt den Wert an jedes `stats.json`-Feld.
- [ ] Tests mit Fixtures, darunter ein nachgebautes gzip-NBT.

### Task 2: Forge-Tab

**Files:** `forge.js`, `data.js`, `render.js`, `app.js`, `index.html`, `style.css`, `sw.js`, Tests.

- `ahNet(price)`, `forgeFlips(products, recipes, ah, opts)`.
- `forgeCard`, Filter „Bazaar only / Incl. AH“, Einstellung „HotM tier“.
- `TABS` um `forge`; Tab-Leiste scrollbar, aktiver Tab sichtbar.

### Task 3: Trend-Signale

**Files:** `trends.js`, `render.js`, `app.js`, `index.html`, `style.css`, Tests.

- `direction(slope)`, `level(sell, median)`, Badge, Sortierung „Trend“.

### Task 4: Event-Radar

**Files:** `events.js`, `data.js`, `render.js`, `app.js`, `index.html`, `style.css`, `sw.js`, `docs/events-sources.md`, Tests.

- `skyDate(ms)`, `EVENTS`, `PERK_ITEMS`, `upcoming(now, election)`, `eventItems(now, election)`, `countdown(ms)`.
- `radarView(...)`, Event-Badge auf Karten und Detailseite.

### Task 5: Tour, Assistent, Help, Changelog

**Files:** `onboarding.js`, `tour.js`, `changelog.json`, `README.md`, Tests.

- `tourSteps` (Basis, 6), `advancedSteps`, Angebot nach der Basis-Tour.
- `setupResult` mit `hotm` und `forgeAh`; zwei neue Fragen.
- `newsHtml` mit „Advanced tour“ für Nutzer von vor 5.0.0.
- „How it works“ um Forge, Events, Trends.

### Task 6: Prüfen und abschließen

- [ ] `node --test`, `gradlew testDebugUnitTest`, `npm run android:build`.
- [ ] Workflow-Schritte lokal gegen ein Test-Repo (ein Live-Lauf).
- [ ] Screenshots bei 360 px und 1440 px ansehen, Fehler beheben.
- [ ] `SUMMARY.md` mit Testliste; alte Zusammenfassung nach `docs/summary-v4.md`.

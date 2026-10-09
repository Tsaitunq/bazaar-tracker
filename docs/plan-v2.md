# Bazaar-Tracker V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verlauf (Snapshots, Charts, Stabilitäts-Score), NPC- und Craft-Flips sowie Item-Bilder für die bestehende PWA.

**Architecture:** Ein GitHub-Actions-Workflow schreibt alle 20 Min kompakte Preis-Snapshots, Scores und Rezepte in den verwaisten Branch `data`. Die App (statisch, ohne Build) liest diese Dateien über `raw.githubusercontent.com`. Rechenlogik liegt in reinen, in Node getesteten Modulen; `render.js` baut HTML-Strings, `app.js` hält Zustand, Routing und Events.

**Tech Stack:** Vanilla JS (ES-Module), CSS, Node 22+ (`node --test`, eingebautes `fetch`), GitHub Actions. Keine Abhängigkeiten.

**Spec:** `docs/spec-v2.md` (Entscheidungen: `DECISIONS.md`)

## Global Constraints

- Keine npm-Abhängigkeiten, kein Build-Schritt, nur relative Pfade in der App.
- Oberfläche deutsch, nur Dark Mode, Zahlen in `de-DE`. Code, Bezeichner und Kommentare englisch.
- Buy-Order-Preis = `sell_summary[0].pricePerUnit`, Sell-Offer-Preis = `buy_summary[0].pricePerUnit`.
- Daten-URL: `https://raw.githubusercontent.com/Tsaitunq/bazaar-tracker/data/`; auf `localhost` und `127.0.0.1`: `./data/`.
- Icon-URL: `https://sky.coflnet.com/static/icon/<id>`. Keine Bild- oder Texturdateien ins Repo.
- Alle Texte aus APIs werden vor dem Einsetzen in HTML escaped.
- Jeder Task endet mit `node --test` (alles grün, Ausgabe ohne Warnungen) und einem Commit auf Branch `v2`. Commit-Nachrichten enden mit der Zeile `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Nie pushen. Keine Dateien außerhalb des Tasks umbauen.
- Bestehende Tests bleiben grün; bestehendes Verhalten von V1 bleibt erhalten.

## Review Focus

1. Branch `data` existiert noch nicht oder ist nicht erreichbar: App läuft ohne Score, Charts und Rezepte weiter, kein Absturz, klarer Hinweistext. Tests in Task 6 (`data.js` liefert Leerwerte) und Task 7.
2. Produkt taucht mitten am Tag neu auf oder verschwindet: Arrays bleiben so lang wie `t`, Lücken sind `null`. Test in Task 1.
3. IDs mit Doppelpunkt (`INK_SACK:4`): Shard, Icon-URL, Route und Rezept-Zuordnung funktionieren. Tests in Task 1, 3, 5.
4. Rezept mit Zutat ohne Preis oder ohne Orderbuch: Flip wird übersprungen, kein `NaN`. Test in Task 4.
5. Chart mit 0 oder 1 Punkt oder konstantem Wert: kein `NaN` im SVG. Test in Task 7.

---

### Task 1: Verlaufs-Modul `history.js`

**Files:** Create `history.js`, `tests/history.test.js`. Modify `flips.js` (nur `bookPrices` herausziehen).

**Interfaces – Produces (alle als benannte Exporte):**

- In `flips.js`: `bookPrices(product) → { buy, sell } | null` (`null`, wenn eine Seite fehlt oder nicht > 0 ist). `computeFlip` nutzt die Funktion; Verhalten unverändert.
- In `history.js`:
  - `SHARDS = 16`, `KEEP_DAYS = 7`, `MIN_POINTS = 12`, `SCORE_TAX = 0.0125`
  - `shardOf(id) → number` – Summe der `charCodeAt` aller Zeichen modulo `SHARDS`
  - `dayKey(ms) → 'YYYY-MM-DD'` (UTC)
  - `dayKeys(nowMs, n) → string[]` – `n` aufeinanderfolgende Tage, ältester zuerst, letzter = `dayKey(nowMs)`
  - `compactPrices(products) → { [id]: [buy, sell] }` – über `bookPrices`, auf 1 Nachkommastelle gerundet, Produkte ohne Preise fehlen
  - `appendSnapshot(chunk, tMin, prices) → chunk` – `chunk` ist `{ t: number[], p: { [id]: [number|null[], number|null[]] } }` oder `null`/`undefined` (dann neu). Hängt `tMin` an `t` an; jedes Produkt in `p` oder `prices` bekommt einen Wert oder `null`, neue Produkte werden vorne mit `null` aufgefüllt. Ist `tMin <= ` letzter Eintrag von `t`, bleibt der Chunk unverändert.
  - `seriesFor(chunks, id) → [t, buy, sell][]` – über alle Chunks (Einträge dürfen `null` sein), nur Punkte mit beiden Werten, aufsteigend nach `t`
  - `marginSeries(points, tax) → [t, margin][]` mit `margin = (sell × (1 − tax) − buy) / buy`
  - `stabilityScore(points) → number | null` – Formel aus Spec Abschnitt 3 (Standardabweichung der Grundgesamtheit), `null` bei weniger als `MIN_POINTS` Punkten

- [ ] **Step 1: Tests schreiben** (`tests/history.test.js`), mit diesen Werten:
  - `shardOf('A') === 1`, `shardOf('AB') === 3`, `shardOf('INK_SACK:4')` liegt in `0..15`
  - `dayKey(Date.UTC(2026, 9, 9, 23, 59)) === '2026-10-09'`; `dayKeys(Date.UTC(2026, 9, 9), 3)` → `['2026-10-07', '2026-10-08', '2026-10-09']`; Monatswechsel: `dayKeys(Date.UTC(2026, 9, 1), 2)` → `['2026-09-30', '2026-10-01']`
  - `compactPrices({ A: { sell_summary: [{ pricePerUnit: 1.26 }], buy_summary: [{ pricePerUnit: 2.04 }] }, B: { sell_summary: [], buy_summary: [{ pricePerUnit: 1 }] } })` → `{ A: [1.3, 2] }`
  - `appendSnapshot(null, 100, { A: [1, 2] })` → `{ t: [100], p: { A: [[1], [2]] } }`; danach `appendSnapshot(chunk, 120, { B: [3, 4] })` → `t` `[100, 120]`, `A` `[[1, null], [2, null]]`, `B` `[[null, 3], [null, 4]]`; nochmal mit `120` → unverändert
  - `seriesFor([chunk, null], 'A')` → `[[100, 1, 2]]`; unbekannte ID → `[]`; zwei Chunks in falscher Reihenfolge kommen aufsteigend zurück
  - `marginSeries([[1, 100, 200]], 0.0125)` → `[[1, 0.975]]`
  - `stabilityScore`: 12 Punkte `[t, 100, 200]` → `100`; 12 Punkte `[t, 100, 100]` → `0`; 12 Punkte abwechselnd `[t, 100, 200]` und `[t, 100, 100]` → `33`; 11 Punkte → `null`
  - `bookPrices({})` → `null`; bestehende Tests in `tests/flips.test.js` bleiben grün
- [ ] **Step 2:** `node --test` → neue Tests schlagen fehl (Modul fehlt).
- [ ] **Step 3:** `history.js` und `bookPrices` umsetzen.
- [ ] **Step 4:** `node --test` → alles grün.
- [ ] **Step 5:** Commit `feat: history module for snapshots and stability score`.

### Task 2: Snapshot-Skript und Workflow

**Files:** Create `scripts/snapshot.mjs`, `tests/snapshot.test.js`, `.github/workflows/snapshot.yml`, `.gitignore`.

**Interfaces – Consumes:** aus `history.js`: `SHARDS`, `KEEP_DAYS`, `shardOf`, `dayKey`, `dayKeys`, `compactPrices`, `appendSnapshot`, `seriesFor`, `stabilityScore`.

**Interfaces – Produces:**

- `runSnapshot(dataDir, products, nowMs) → { day, count }` (Export aus `scripts/snapshot.mjs`, synchrones `fs`):
  1. `prices = compactPrices(products)`, `tMin = Math.round(nowMs / 60000)`
  2. Für jeden Shard `0..15`: `h/<dayKey(nowMs)>/<shard>.json` lesen (fehlt → `null`), `appendSnapshot` mit den Preisen dieses Shards, zurückschreiben (`JSON.stringify` ohne Einrückung). Alle 16 Dateien werden geschrieben, auch leere Shards.
  3. Ordner in `h/` löschen, deren Name kleiner ist als `dayKeys(nowMs, KEEP_DAYS + 1)[0]`.
  4. `scores.json` schreiben: `{ t: tMin, s: { [id]: score } }` über alle verbliebenen Tage; IDs mit Score `null` fehlen.
- Direkt gestartet (`node scripts/snapshot.mjs <dataDir>`, Standard `data`): holt `https://api.hypixel.net/v2/skyblock/bazaar`, prüft `res.ok` und `success`, ruft `runSnapshot(dataDir, products, Date.now())`, gibt eine Zeile aus (`snapshot <day>: <count> products`). Bei Fehler: Meldung auf stderr, `process.exitCode = 1`, nichts geschrieben. Der Start-Code läuft nur, wenn die Datei direkt ausgeführt wird (`import.meta.url === pathToFileURL(process.argv[1]).href`).

- [ ] **Step 1: Tests** (`tests/snapshot.test.js`, temporäres Verzeichnis über `fs.mkdtempSync(path.join(os.tmpdir(), 'bt-'))`, am Ende löschen). Hilfsprodukt: `{ sell_summary: [{ pricePerUnit: 100 }], buy_summary: [{ pricePerUnit: 200 }] }`.
  - Zwei Läufe im Abstand von 20 Min am selben Tag: Shard-Datei von `X` hat `t.length === 2` und `p.X` `[[100, 100], [200, 200]]`; es existieren genau 16 Dateien im Tagesordner.
  - Produkt mit ID `INK_SACK:4` landet in `h/<tag>/<shardOf('INK_SACK:4')>.json`.
  - Vorhandene Ordner `h/2026-09-30` und `h/2026-10-02`, Lauf mit `nowMs = Date.UTC(2026, 9, 9, 12)`: `2026-09-30` ist gelöscht, `2026-10-02` bleibt.
  - 12 Läufe im Abstand von 20 Min: `scores.json` hat `s.X === 100`; nach nur 2 Läufen fehlt `X` in `s`.
- [ ] **Step 2:** `node --test` → schlägt fehl.
- [ ] **Step 3:** `scripts/snapshot.mjs` umsetzen.
- [ ] **Step 4:** `.gitignore` anlegen mit den Zeilen `data/`, `.superpowers/`, `node_modules/`.
- [ ] **Step 5:** `.github/workflows/snapshot.yml` mit genau diesem Inhalt:

```yaml
name: snapshot

on:
  schedule:
    - cron: '7,27,47 * * * *'
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: snapshot
  cancel-in-progress: false

jobs:
  snapshot:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Restore data branch
        run: |
          if git ls-remote --exit-code --heads origin data >/dev/null; then
            git clone --quiet --depth 1 --branch data "https://github.com/${GITHUB_REPOSITORY}.git" data
          else
            code=$?
            # exit code 2 means the branch does not exist yet; anything else is a real failure
            if [ "$code" -ne 2 ]; then exit "$code"; fi
            mkdir -p data
          fi
      - name: Take snapshot
        run: node scripts/snapshot.mjs data
      - name: Publish data branch as a single commit
        env:
          GITHUB_TOKEN: ${{ github.token }}
        run: |
          cd data
          rm -rf .git
          git init --quiet --initial-branch data
          git add --all
          git -c user.name="github-actions[bot]" -c user.email="41898282+github-actions[bot]@users.noreply.github.com" commit --quiet --message "snapshot"
          git push --quiet --force "https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" data
```

- [ ] **Step 6:** `node --test` grün. Einmal echt laufen lassen: `node scripts/snapshot.mjs data` → Ausgabe mit über 1000 Produkten, `data/h/<heute>/` enthält 16 Dateien, `data/scores.json` existiert; Gesamtgröße des Tagesordners im Report nennen. `git status` zeigt `data/` nicht.
- [ ] **Step 7:** Commit `feat: snapshot script and scheduled workflow`.

### Task 3: Rezepte aus dem NEU-Repo

**Files:** Create `scripts/recipes.mjs`, `tests/recipes.test.js`. Modify `scripts/snapshot.mjs` (nur der Start-Code).

**Hintergrund:** `https://github.com/NotEnoughUpdates/NotEnoughUpdates-REPO`, Ordner `items/`, eine JSON-Datei pro Item. Zwei Formate:

```json
{ "internalname": "ENCHANTED_DIAMOND_BLOCK",
  "recipe": { "A1": "", "A2": "ENCHANTED_DIAMOND:32", "A3": "", "B1": "ENCHANTED_DIAMOND:32", "B2": "ENCHANTED_DIAMOND:32", "B3": "ENCHANTED_DIAMOND:32", "C1": "", "C2": "ENCHANTED_DIAMOND:32", "C3": "" } }
```

```json
{ "internalname": "ENCHANTED_GOLDEN_CARROT",
  "recipes": [ { "type": "crafting", "count": 1, "overrideOutputId": "ENCHANTED_GOLDEN_CARROT", "A1": "", "A2": "ENCHANTED_CARROT:32", "…": "…" } ] }
```

NEU schreibt Varianten mit Bindestrich (`INK_SACK-4`), der Bazaar mit Doppelpunkt (`INK_SACK:4`). In einem Slot steht `<neuId>:<menge>`; die Menge ist der Teil nach dem letzten Doppelpunkt und fehlt manchmal (dann 1).

**Interfaces – Produces (Exporte aus `scripts/recipes.mjs`):**

- `parseRecipe(item) → { out, n, i: { [neuId]: qty } } | null` – nimmt `item.recipe`, sonst den ersten Eintrag aus `item.recipes` mit `type === 'crafting'`. Slots sind `A1..C3`. `out = overrideOutputId ?? internalname`, `n = count ?? 1`. Gleiche Zutaten werden summiert. Kein Crafting-Rezept oder keine Zutat → `null`.
- `toBazaarId(neuId, bazaarIds) → string | null` – `bazaarIds` ist ein `Set`. Treffer direkt, sonst mit `-<ziffern>` am Ende als `:<ziffern>`, sonst `null`.
- `buildRecipes(items, bazaarIds) → { [bazaarId]: { n, i: { [bazaarId]: qty } } }` – verwirft Rezepte, deren Ergebnis oder eine Zutat kein Bazaar-Produkt ist oder deren Ergebnis selbst Zutat ist.
- `loadNeuItems(repoDir) → object[]` – liest `items/*.json`, nicht parsebare Dateien werden übersprungen.
- `recipesStale(file, nowMs) → boolean` – `true`, wenn die Datei fehlt, nicht lesbar ist oder `nowMs − t > 24 h`.
- `refreshRecipes(dataDir, bazaarIds, nowMs)` – klont das Repo mit `git clone --quiet --depth 1` (über `execFileSync`) in ein temporäres Verzeichnis, schreibt `<dataDir>/recipes.json` als `{ t: nowMs, r }`, löscht das temporäre Verzeichnis.

**Änderung in `scripts/snapshot.mjs`:** Nach `runSnapshot` im Start-Code: wenn `recipesStale(<dataDir>/recipes.json, now)`, dann `refreshRecipes` in `try/catch`. Ein Fehler dort gibt eine Warnung auf stderr aus, lässt die alte Datei stehen und ändert den Exit-Code nicht.

- [ ] **Step 1: Tests** (`tests/recipes.test.js`):
  - Erstes Beispiel oben → `{ out: 'ENCHANTED_DIAMOND_BLOCK', n: 1, i: { ENCHANTED_DIAMOND: 160 } }`
  - Zweites Format mit `count: 2` und `overrideOutputId: 'X'` → `out` `'X'`, `n` `2`
  - Item ohne Rezept → `null`; `recipes: [{ type: 'forge', … }]` → `null`
  - Slot `'INK_SACK-4:16'` → Zutat `'INK_SACK-4'` mit `16`; Slot `'STICK'` → `1`
  - `toBazaarId('INK_SACK-4', new Set(['INK_SACK:4']))` → `'INK_SACK:4'`; `toBazaarId('A', new Set(['A']))` → `'A'`; unbekannt → `null`
  - `buildRecipes`: Zutat nicht im Bazaar → Rezept fehlt; Ergebnis nicht im Bazaar → fehlt; Ergebnis ist eigene Zutat → fehlt; gültiges Rezept mit NEU-Variante → Schlüssel und Zutaten in Bazaar-Schreibweise
  - `recipesStale`: fehlende Datei → `true`; `t` vor 25 h → `true`; `t` vor 1 h → `false`
- [ ] **Step 2:** `node --test` → schlägt fehl. **Step 3:** umsetzen. **Step 4:** `node --test` grün.
- [ ] **Step 5:** Echt prüfen: `node scripts/snapshot.mjs data` → `data/recipes.json` existiert; Anzahl Rezepte und Dateigröße in den Report (erwartet: einige hundert Rezepte). Zweiter Lauf klont nicht erneut.
- [ ] **Step 6:** Commit `feat: build craft recipes from NEU repo`.

### Task 4: Rechenlogik für NPC- und Craft-Flips, Item-Metadaten

**Files:** Create `npc.js`, `craft.js`, `tests/npc.test.js`, `tests/craft.test.js`. Modify `flips.js`, `tests/flips.test.js`, `names.js`, `tests/names.test.js`, `app.js` (nur der Aufruf von `loadNames`).

**Interfaces – Consumes:** `bookPrices(product)` aus `flips.js`.

**Interfaces – Produces:**

- `flips.js`:
  - `bySort(sort) → (a, b) => number` – absteigend nach `a[sort]`, `null`/`undefined` ans Ende
  - `buildFlips(products, { …wie bisher, scores = {} })` – jeder Flip bekommt `score: scores[id] ?? null`; sortiert mit `bySort`
- `npc.js`: `npcFlips(products, npcPrices, { minVolume, maxCapital, share = 1, sort, scores = {} }) → NpcFlip[]`
  - `NpcFlip = { id, buy, sell, npc, profit, profitInstant, margin, weekVol, hourVol, profitHour, score }`
  - `buy`/`sell` aus `bookPrices`; `profit = npc − buy`; `profitInstant = npc − sell`; `margin = profit / buy`; `weekVol = quick_status.sellMovingWeek || 0`; `hourVol = weekVol / 168`; Stückzahl wie in `computeFlip` (`hourVol × share`, bei `maxCapital > 0` gedeckelt durch `floor(maxCapital / buy)`); `profitHour = stück × profit`
  - Gefiltert: kein NPC-Preis, keine Preise, `profit ≤ 0`, `weekVol < minVolume`, `maxCapital > 0 && buy > maxCapital`
- `craft.js`: `craftFlips(products, recipes, { tax, maxCapital, share = 1, sort, scores = {} }) → CraftFlip[]`
  - `recipes` ist `{ [id]: { n, i: { [ingId]: qty } } }`
  - `CraftFlip = { id, n, cost, revenue, profit, margin, craftsHour, profitHour, score, ingredients: [{ id, qty, price }] }`
  - Formeln aus Spec Abschnitt 5. `price` einer Zutat = ihr Buy-Order-Preis. `craftsHour` bei `maxCapital > 0` zusätzlich gedeckelt durch `floor(maxCapital / cost)`. `profitHour = craftsHour × profit`.
  - Gefiltert: Ergebnis oder eine Zutat ohne Produkt oder ohne Preise, `profit ≤ 0`, `maxCapital > 0 && cost > maxCapital`
- `names.js`:
  - `npcMap(items) → { [id]: number }` – nur `npc_sell_price > 0`
  - `loadItems() → Promise<{ names, npc }>` – ersetzt `loadNames`; Schlüssel `bt.items` mit `{ t, names, npc }`, 7 Tage gültig; entfernt den alten Schlüssel `bt.names`; wirft nie, bei Fehler alter Cache oder `{ names: {}, npc: {} }`
  - `fallbackName` und `nameMap` bleiben unverändert
- `app.js`: nutzt `loadItems()` statt `loadNames()` (`names = items.names`); sonst keine Änderung.

- [ ] **Step 1: Tests.** Produkt-Helfer wie in `tests/flips.test.js` (`product(buy, sell, quickStatus)`).
  - NPC: Buy-Order 100, Sell-Offer 120, NPC 150, `sellMovingWeek` 1 680 000 → `profit` 50, `profitInstant` 30, `margin` 0,5, `hourVol` 10 000; `share` 0,05 und `maxCapital` 0 → `profitHour` 25 000; `maxCapital` 5000 → `profitHour` 2500; NPC-Preis 90 → fehlt; kein NPC-Preis → fehlt; `minVolume` über `weekVol` → fehlt
  - Craft: Rezept `OUT: { n: 1, i: { ING: 160 } }`; `ING` Buy-Order 10, `sellMovingWeek` 16 800 000; `OUT` Sell-Offer 2000, `buyMovingWeek` 168 000; Steuer 0,0125 → `cost` 1600, `revenue` 1975, `profit` 375, `margin` 0,234375, `craftsHour` 625, `profitHour` 234 375, `ingredients` `[{ id: 'ING', qty: 160, price: 10 }]`; `maxCapital` 3200 → `craftsHour` 2, `profitHour` 750; `maxCapital` 1000 → fehlt; Zutat ohne Produkt → fehlt; Zutat mit leerem Orderbuch → fehlt
  - `buildFlips` mit `scores: { BIG: 80 }` und `sort: 'score'` → `BIG` zuerst, Flip ohne Score zuletzt, `score` am Flip gesetzt
  - `npcMap([{ id: 'A', npc_sell_price: 5 }, { id: 'B' }, { id: 'C', npc_sell_price: 0 }])` → `{ A: 5 }`
- [ ] **Step 2:** `node --test` schlägt fehl. **Step 3:** umsetzen. **Step 4:** `node --test` grün, `node --check app.js`.
- [ ] **Step 5:** Commit `feat: NPC and craft flip calculation, item metadata with NPC prices`.

### Task 5: `render.js` – Karten, Bilder, Badges

**Files:** Create `render.js`, `tests/render.test.js`. Modify `app.js`, `style.css`.

**Ziel:** Alle HTML-Strings entstehen in `render.js` (rein, in Node testbar). `app.js` verliert `esc`, `compact`, `percent` und `card` und importiert sie. Sichtbar neu in diesem Task: Bild auf jeder Karte, Karte verlinkt auf die Detailroute.

**Interfaces – Produces (Exporte aus `render.js`):**

- `esc(s)`, `compact` und `percent` (die `Intl.NumberFormat`-Objekte aus `app.js`, unverändert)
- `ICON_BASE = 'https://sky.coflnet.com/static/icon/'`; `iconUrl(id) → ICON_BASE + encodeURIComponent(id)`
- `PLACEHOLDER_ICON` – Data-URI eines schlichten SVG (grauer abgerundeter Kasten)
- `icon(id, size = 32) → '<img class="icon" …>'` mit `src`, `width`, `height`, `alt=""`, `loading="lazy"`, `decoding="async"`, `crossorigin="anonymous"`
- `itemHref(id) → '#/item/' + encodeURIComponent(id)`
- `scoreBadge(score) → string` – `''` bei `null`/`undefined`; sonst `<span class="badge badge-…">stabil 82</span>` mit Text `stabil` (≥ 70), `mittel` (40–69), `instabil` (< 40) und dem Score
- `flipCard(flip, isFav)`, `npcCard(flip, isFav)`, `craftCard(flip, isFav)` → `<li class="card">…</li>`
  - Aufbau: Stern-Button wie bisher (`class="star"`, `data-id`, `aria-pressed`, `aria-label`), daneben `<a class="body" href="<itemHref>">` mit Bild, Name, Warn-Badge (nur `flipCard`, wenn `suspicious`), `scoreBadge(flip.score)` und der `<dl>`-Wertetabelle
  - `flipCard`: dieselben sechs Werte wie die bisherige Karte
  - `npcCard`: Buy-Order, NPC-Preis, Vol./Woche, Gewinn/Stück, Gewinn Sofortkauf, Gewinn/h
  - `craftCard`: Kosten, Erlös, Marge, Gewinn/Craft, Crafts/h, Gewinn/h; darunter Zutatenliste `<ul class="ingredients">` mit je `<menge>× <name> à <preis>`
  - Jede Karte erwartet `flip.name`; `craftCard` erwartet zusätzlich `name` an jeder Zutat.
  - Gewinnwerte bekommen Klasse `gain` (> 0) oder `loss`.

**Änderungen in `app.js`:** Import aus `render.js`, Liste rendert `flipCard`. Ein Listener in der Capture-Phase ersetzt fehlgeschlagene Bilder: `document.addEventListener('error', handler, true)`; trifft er ein `img.icon`, dessen `src` nicht schon `PLACEHOLDER_ICON` ist, setzt er `src = PLACEHOLDER_ICON`.

**Änderungen in `style.css`:** `.icon` (feste Größe, `image-rendering: pixelated`), `.badge` mit drei Farbvarianten aus den vorhandenen Tokens, `a.body` ohne Unterstreichung in Textfarbe, `.ingredients`.

- [ ] **Step 1: Tests** (`tests/render.test.js`):
  - `esc('<b>"x"&')` enthält weder `<` noch `"`
  - `iconUrl('INK_SACK:4') === 'https://sky.coflnet.com/static/icon/INK_SACK%3A4'`; `itemHref('INK_SACK:4') === '#/item/INK_SACK%3A4'`
  - `scoreBadge(null) === ''`; `scoreBadge(82)` enthält `stabil` und `82`; `scoreBadge(50)` enthält `mittel`; `scoreBadge(10)` enthält `instabil`
  - `flipCard` mit `name: '<i>x</i>'` enthält `&#60;i&#62;` und kein `<i>`; mit `suspicious: true` enthält `verdächtig`; `aria-pressed="true"` bei `isFav`
  - `craftCard` mit Zutat `{ id: 'ING', name: 'Ing', qty: 160, price: 10 }` enthält `160×` und `Ing`
  - `npcCard` enthält den formatierten NPC-Preis
  - `icon('A')` enthält `loading="lazy"` und `crossorigin="anonymous"`
- [ ] **Step 2:** schlägt fehl. **Step 3:** umsetzen. **Step 4:** `node --test` grün, `node --check app.js`.
- [ ] **Step 5:** Prüfen, dass der Icon-Dienst die kodierte Schreibweise annimmt: `curl -s -o /dev/null -w '%{http_code}' https://sky.coflnet.com/static/icon/INK_SACK%3A4` → `200`. Bei anderem Ergebnis: im Report melden, nicht selbst umbauen.
- [ ] **Step 6:** Im Browser prüfen (Methode im Dispatch): Liste zeigt Karten mit Bildern, keine Fehlerzeile.
- [ ] **Step 7:** Commit `feat: render module with item icons and score badge`.

### Task 6: Tabs, Routing, Datenzugriff

**Files:** Create `data.js`, `tests/data.test.js`, `scripts/serve.mjs`. Modify `app.js`, `index.html`, `style.css`.

**Interfaces – Consumes:** `buildFlips`, `npcFlips`, `craftFlips`, `loadItems`, `fallbackName`, `flipCard`, `npcCard`, `craftCard`, `dayKeys`, `shardOf`, `seriesFor`.

**Interfaces – Produces:**

- `data.js`:
  - `dataUrl(hostname) → string` – `'./data/'` für `localhost` und `127.0.0.1`, sonst die Daten-URL aus den Global Constraints
  - `loadScores() → Promise<{ [id]: number }>` – `s` aus `scores.json`, bei jedem Fehler `{}`
  - `loadRecipes() → Promise<object | null>` – `r` aus `recipes.json`, bei jedem Fehler `null`
  - `loadHistory(id, days, nowMs = Date.now()) → Promise<[t, buy, sell][]>` – lädt `h/<tag>/<shardOf(id)>.json` für `dayKeys(nowMs, days + 1)` parallel, fehlgeschlagene Dateien zählen als `null`, Ergebnis über `seriesFor`
  - Alle drei nutzen eine interne `fetchJson(path)`, die bei `!res.ok` wirft.
- `scripts/serve.mjs`: statischer Entwicklungsserver, `node scripts/serve.mjs [port]` (Standard 8123), liefert das aktuelle Verzeichnis auf `127.0.0.1` mit passenden Content-Types für `.html .js .mjs .css .json .png .webmanifest`, verhindert Pfade außerhalb des Verzeichnisses.
- `index.html`: unter dem Kopf `<nav id="tabs">` mit drei Links `#/flips`, `#/npc`, `#/craft` (Texte „Flips“, „NPC“, „Craft“); neue Sortieroption `<option value="score">Stabilität</option>`.
- `app.js`:
  - `parseRoute(hash) → { view: 'flips' | 'npc' | 'craft' | 'item', id? }` – unbekannt oder leer → `flips`; `#/item/<x>` → `id = decodeURIComponent(x)`. In diesem Task wird `item` noch wie `flips` dargestellt (Detailseite kommt in Task 7).
  - `hashchange` rendert neu; der aktive Tab bekommt `aria-current="page"`.
  - Zustand zusätzlich: `npc` (NPC-Preise aus `loadItems`), `scores`, `recipes`. `scores` wird beim Start und danach bei jedem Refresh neu geladen, wenn der letzte Abruf älter als 20 Min ist. `recipes` einmal beim Start.
  - `recompute()` berechnet die Liste des aktiven Tabs; alle drei Funktionen bekommen `scores`. Namen werden wie bisher angehängt, bei Craft-Flips auch an jede Zutat.
  - Suche und „nur Favoriten“ gelten in allen Tabs; das Umgehen der Filter durch Favoriten bleibt nur im Flips-Tab.
  - Craft-Tab ohne Rezepte: statt Liste der Text „Noch keine Rezeptdaten. Der Snapshot-Workflow muss einmal gelaufen sein.“
  - Zähltext je Tab: „<n> von <m> Flips“.

- [ ] **Step 1: Tests** (`tests/data.test.js`; `globalThis.fetch` im Test durch eine eigene Funktion ersetzen und danach zurücksetzen):
  - `dataUrl('localhost') === './data/'`; `dataUrl('Tsaitunq.github.io')` ist die raw-URL
  - `loadScores` bei 404 → `{}`; bei `{ t: 1, s: { A: 5 } }` → `{ A: 5 }`
  - `loadRecipes` bei Netzfehler → `null`
  - `loadHistory('A', 1, Date.UTC(2026, 9, 9, 12))` fragt genau zwei URLs ab (`h/2026-10-08/1.json`, `h/2026-10-09/1.json`); eine davon 404 → Punkte aus der anderen
  - `parseRoute` dafür aus `app.js` in `data.js` oder ein eigenes kleines Modul zu verschieben ist nicht nötig: `parseRoute` in `render.js` neben `itemHref` ablegen und dort testen (`''` → `flips`, `'#/npc'` → `npc`, `'#/item/INK_SACK%3A4'` → `{ view: 'item', id: 'INK_SACK:4' }`, `'#/quatsch'` → `flips`).
- [ ] **Step 2:** schlägt fehl. **Step 3:** umsetzen. **Step 4:** `node --test` grün, `node --check app.js`.
- [ ] **Step 5:** Im Browser prüfen (Methode im Dispatch), vorher `node scripts/snapshot.mjs data` für lokale Daten: `#/flips`, `#/npc`, `#/craft` zeigen je Karten und den richtigen aktiven Tab; mit umbenanntem `data/`-Ordner zeigt `#/craft` den Hinweistext und `#/flips` weiterhin Karten.
- [ ] **Step 6:** Commit `feat: tabs for NPC and craft flips, data access, stability sort`.

### Task 7: Charts und Detailseite

**Files:** Create `chart.js`, `tests/chart.test.js`. Modify `render.js`, `tests/render.test.js`, `app.js`, `style.css`.

**Interfaces – Consumes:** `loadHistory(id, days)`, `marginSeries(points, tax)`, `parseRoute`, `icon`, `scoreBadge`, `esc`, `compact`, `percent`.

**Interfaces – Produces:**

- `chart.js`: `lineChart(series, { width = 340, height = 160, format }) → string`
  - `series = [{ color, points: [t, value][] }]`; alle Serien teilen sich beide Achsen
  - Liefert `''`, wenn keine Serie einen Punkt hat
  - Sonst ein `<svg viewBox="0 0 <width> <height>" class="chart" role="img">` mit einer `<polyline fill="none">` pro Serie, y-Beschriftung `format(max)` oben und `format(min)` unten, x-Beschriftung Start- und Endzeit (`de-DE`, Tag und Uhrzeit)
  - Konstante Werte oder ein einzelner Punkt: Linie bzw. Punkt in der Mitte, kein `NaN` und kein `Infinity` im Ergebnis
- `render.js`: `detailView({ id, name, flip, score, isFav, range, points, tax }) → string`
  - `flip` ist der Bazaar-Flip des Items oder `null` (dann ohne aktuelle Werte)
  - `range` ist `'24h'` oder `'7d'`; `points` sind bereits auf den Zeitraum gefiltert
  - Inhalt nach Spec Abschnitt 2: Zurück-Link (`<a href="#/flips">`), `icon(id, 48)`, Name, Stern-Button (`class="star"`, `data-id`), `scoreBadge`, aktuelle Werte, zwei Buttons `data-range="24h"` / `data-range="7d"` (aktiver mit `aria-pressed="true"`), Chart „Preise“ (Buy und Sell, mit Legende), Chart „Marge“ (`marginSeries`, Format Prozent)
  - `points === null` → Text „Lade Verlauf…“; leeres Array → „Noch kein Verlauf vorhanden“
- `app.js`: Route `item` zeigt die Detailseite statt Liste; Tabs, Suche und Sortierung sind dort ausgeblendet. Verlauf wird einmal pro Item mit `loadHistory(id, 7)` geladen und im Speicher gehalten; `24h` filtert clientseitig auf `t ≥ jetzt − 24 h`. Standard `24h`. Stern und Range-Buttons funktionieren über Event-Delegation. Ein Refresh aktualisiert die aktuellen Werte, ohne den Verlauf neu zu laden.

- [ ] **Step 1: Tests:**
  - `lineChart([], {})` → `''`; `lineChart([{ color: 'red', points: [] }], {})` → `''`
  - Zwei Serien mit je 3 Punkten → genau 2 `<polyline`; enthält `format(max)` und `format(min)`
  - Ein Punkt; konstante Werte → enthält weder `NaN` noch `Infinity`
  - `detailView` mit `points: []` enthält „Noch kein Verlauf vorhanden“; mit `points: null` „Lade Verlauf…“; mit 3 Punkten zwei `<svg`; `name: '<i>'` ist escaped; `range: '7d'` setzt `aria-pressed="true"` am 7d-Button
- [ ] **Step 2:** schlägt fehl. **Step 3:** umsetzen. **Step 4:** `node --test` grün, `node --check app.js`.
- [ ] **Step 5:** Im Browser prüfen: Für sichtbare Linien braucht es mehrere Snapshots. Dafür mit einem Wegwerf-Skript außerhalb des Repos `runSnapshot` 30-mal mit künstlich verschobenen Zeiten (20-Min-Schritte, Preise leicht variiert) in `./data` laufen lassen. `#/item/ENCHANTED_DIAMOND` zeigt zwei Charts mit Linien; ein Item ohne Daten zeigt den Hinweistext. Screenshot ansehen.
- [ ] **Step 6:** Commit `feat: item detail page with price and margin charts`.

### Task 8: Service Worker, Fußzeile

**Files:** Create `tests/sw.test.js`. Modify `sw.js`, `index.html`, `style.css`.

- `sw.js`:
  - `SHELL` enthält `./`, `index.html`, `style.css`, `manifest.webmanifest`, `icons/icon-192.png` und jede `.js`-Datei im Projektstamm außer `sw.js`.
  - Anfragen an `https://sky.coflnet.com/static/icon/`: Cache-first im Cache `bt-icons`; nur Antworten mit `res.ok` werden gespeichert; schlägt das Netz fehl und nichts ist im Cache, wird der Fehler durchgereicht (das `error`-Ereignis am Bild setzt dann den Platzhalter).
  - Same-Origin-GET bleibt Network-first wie bisher. Alle anderen Anfragen (Hypixel-API, raw.githubusercontent.com) werden nicht abgefangen.
- `index.html`: `<footer>` am Seitenende mit dem Text „Bilder: sky.coflnet.com · Rezepte: NotEnoughUpdates-REPO · Kein offizielles Hypixel-Produkt“, die ersten beiden als Links (`https://sky.coflnet.com/data`, `https://github.com/NotEnoughUpdates/NotEnoughUpdates-REPO`) mit `rel="noopener"`.
- `style.css`: Fußzeile klein und gedämpft.

- [ ] **Step 1: Test** (`tests/sw.test.js`): liest `sw.js` als Text, zieht die Einträge von `SHELL` heraus und prüft: jede genannte Datei existiert; jede `.js`-Datei im Projektstamm außer `sw.js` ist enthalten; `index.html` und `style.css` sind enthalten.
- [ ] **Step 2:** schlägt fehl. **Step 3:** umsetzen. **Step 4:** `node --test` grün, `node --check sw.js`.
- [ ] **Step 5:** Im Browser prüfen: Seite lädt, Fußzeile sichtbar, keine Fehlerzeile.
- [ ] **Step 6:** Commit `feat: cache item icons in service worker, add attribution footer`.

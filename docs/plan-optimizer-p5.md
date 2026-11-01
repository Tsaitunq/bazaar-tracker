# Optimizer Paket 5: Mining-Rangliste, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der Mining-Guide bekommt den Modus `Best value`: offene Schritte sortiert nach Score-Gewinn pro Million Netto-Kosten, mit einstellbaren Gewichten, Ausgleichswert und dem Vergleich "Best possible" gegen den gewählten Wardrobe-Slot.

**Architecture:** `optimizer.js` enthält reine Funktionen: Delta je Schritt, `rankUpgrades`, Netto-Preis, `bestLoadout`, dazu die Ansicht. Spieldaten liegen in `optimizer-data.js`. `progress.js` bekommt die Ansicht als Parameter von `app.js`, damit kein Import-Kreis entsteht. Der Ausgleichswert liegt in `stats.js` beim vorhandenen `statsEntry`.

**Tech Stack:** ES-Module ohne Abhängigkeiten, `node --test`.

**Spec:** `docs/spec-optimizer.md` (3.4, 4.1, 5.1 bis 5.7, Paket 5 in Abschnitt 8)

## Global Constraints

- Branch `feat/mining-rank` von `main`. Commits pro Task, nichts pushen.
- Tests nur mit Fixtures, nie gegen die API (`CLAUDE.md`). Tests gegen `personal/` überspringen sich ohne Datei und geben keine Werte aus.
- Keine UUID, kein Spieler- oder Loadout-Name in Repo, Commit oder Session-Ausgabe. Das Repo ist öffentlich: Dieser Plan und die Tests nennen nur Spieldaten, keine Guide-Texte.
- Spieldaten: Wiki zuerst. Was nur aus NEU stammt, trägt `src: 'not confirmed'` (`CLAUDE.md`, Spec 5.4). Fehlt ein Wert, wird nicht geschätzt: Der Schritt landet in "No gain data".
- Neue Root-`.js` in `SHELL` (`sw.js`). Farben nur als Tokens. UI-Texte Englisch. Changelog-Einträge mit `"personal": true`.
- Die Rangliste rechnet nie mit negativen Kosten (Spec 5.7). Summen ohne vollen Preis bekommen keinen Rang (Spec 5.1).
- `unknown` sperrt nichts und steht normal in der Rangliste, mit Hinweis (Spec 5.2). Nur `locked` wandert in die eigene Gruppe.
- Nach jeder Ersetzung per grep prüfen, ob sie angekommen ist (`CLAUDE.md`).

## Pristine-Prüfung (Spec 4.1)

**Ergebnis: unverändert gültig.** Am 2026-11-01 erneut gegen [Pristine](https://hypixelskyblock.minecraft.wiki/w/Pristine) geprüft, Stand der Seite 2026-10-31, 11:46, also derselbe wie in `docs/plan-optimizer-p3-4.md`. Formel: `Base Drop × (1 + Pristine × 79/100) × (1 + (Mining Fortune + Gemstone Fortune) / 100)`. Fortune wirkt auf beide Drops. Der Test `miningScore matches the derived spec values` hält die Werte schon fest. Die vier Grenzen aus dem Plan zu Paket 3/4 gelten weiter.

## Abweichungen von der Spec

Freigegeben am 2026-11-01: A1, A3 bis A12 wie geschrieben, A2 in der unten stehenden, geänderten Fassung. **A1 bis A3 ändern das Ergebnis der Rangliste.**

- **A1, Gemstone Fortune je Preset:** Spec 4.1 setzt je Preset nur Blockstärke und Gewichte. `miningScore` zählt `GEMSTONE_FORTUNE` aber immer mit, auch bei Mithril und Glacite, wo sie laut Wiki-Formel nicht gilt. Neu: Feld `gemFortune` je Preset (Gemstone `true`, sonst `false`). Standard bleibt `true`, vorhandene Aufrufe rechnen gleich. Ore-, Block- und Dwarven-Metal-Fortune zählen weiter nicht. Für Mithril und Glacite ist der Fortune-Term damit eher zu niedrig; das zeigt ein Hinweis im Modus.
- **A2, Erst Wiki, dann erst "No gain data":** Spec 5.4 will für jede Art ein Delta. Es gibt drei Ergebnisse: ein Delta aus belegten Werten; `{}` für "belegt kein Stat von uns" (Gruppe `zero`, "No mining gain"); `null` nur ohne festen Wert (Gruppe `noGain`, "No gain data"). Wiki-Stand 2026-11-01:
  - Enchant: `efficiency`, `fortune`, `pristine` (im Wiki "Prismatic"), `lapidary` mit Werten. `experience`, `compact`, `smelting_touch`, `paleontologist`: `{}`. `ultimate_flowstate` hängt von der Abbau-Serie ab: `null`.
  - Drill Engines (Speed / Fortune): Mithril 75/5, Titanium 150/15, Ruby 250/30, Sapphire 400/50, Amber 600/100.
  - Fuel Tanks: nur Kapazität, Perfectly-Cut dazu Cooldown: `{}`.
  - Upgrade-Module: Sunny Side +50 Mining Fortune. Blue Cheese +1 Stufe auf alle freigeschalteten HOTM-Perks, gerechnet über `computeStats` auf einer Kopie. Altes Modul ohne Tabellenwert: `null`.
  - Polarvoid: +10 Speed je Buch, einmalig +5 Fortune ab dem ersten Buch. Das Wiki lässt offen, ob die Fortune stapelt, gerechnet wird wie zitiert einmalig.
  - Divan's Powder Coating: Drill +500 Speed, Divan-Rüstung und -Pendant je +10 Fortune.
  - Amber Power Scroll: +30 Speed nur 5 s nach einer Fähigkeit, keine belegte Aktivzeit: `null`.
  - `held` und Consumables: nur über `gain`, sonst `null`.
  - Reforge: Werte aus Reforging/Armor, Reforging/Mining Tool und Blazing Reforge. Armor-Reforges ohne Mining-Stat zählen als 0. Aktuelles Reforge sonst unbekannt: `null`, denn das Delta wäre zu hoch.
  - Recomb: nur der Anteil von Reforge und Gems, also ohne Reforge-Wert nur Gems.
  - Der Abschlussbericht nennt die Anzahl je Gruppe vor und nach den neuen Tabellen.
- **A3, Lapidary zählt voll:** Das Wiki nennt Gemstone Fortune und Speed nur für Gemstones. Im Preset Gemstone zählt es voll, sonst `null` Delta und damit "No gain data".
- **A4, `optimizer-data.js` statt `.json`:** Als Modul lädt es synchron, ohne eigenen Ladepfad und Fehlerfall, wie `minioncosts.js`. Der Vermerk `src` bleibt je Eintrag.
- **A5, Accessory ohne ΔMP:** Keine Power in `POWERS` gibt Mining-Stats, ΔMP wäre im Mining immer 0. Es zählen nur die Item-Stats, abzüglich des schwächeren Teils derselben Familie. Paket 6 braucht ΔMP.
- **A6, "Best possible" ohne Pet:** Spec 2.5 nennt auch das beste Pet. Pet-Fähigkeiten stehen nicht in der Tabelle, ein Vergleich wäre also falsch. Es bleibt das gewählte Pet, der Vergleich sagt das. Set-Boni zählen dort auch nicht (Hinweis).
- **A7, "Best possible" ersetzt nicht die Wahl:** Spec 2.5 sah das automatische Loadout als Grundlage. Laut Paket 3/4 und deinem Auftrag zählt für die Bewertung der gewählte Slot, "Best possible" ist nur der Vergleich daneben.
- **A8, Offset ohne Item-Daten:** Fehlt `items.json`, entsteht kein Offset, weil die berechnete Seite ohne Werkzeug und mit doppelten Familien falsch wäre. Hinweis erscheint.
- **A9, Hinweis statt Sperre bei Slot-Wechsel:** Wie Spec 3.4 bleibt der Offset bei Slot- oder Pet-Wechsel in Kraft, es erscheint nur der Hinweis. Ausnahme: Wer speichert, mit anderem Slot oder Pet und unveränderten Zahlen, bekommt keinen Offset, denn die Zahlen gehören zum alten Setup.
- **A10, `priority` zählt in `Best value` nicht:** Der Modus sortiert nur nach Wert. Das Badge bleibt sichtbar.
- **A11, Soulbound beim Wiederverkauf:** `items.json` hat kein Soulbound-Feld. Abgedeckt über "kein Preis gleich kein Wiederverkauf" und `nt` im Guide. Das Snapshot-Format bleibt gleich.
- **A12, Zahlenformat:** `+1.2 % yield · 0.4 %/1M` mit Punkt, wie der Rest der englischen App. Die Spec schreibt Komma.
- **Aus dem Umfang:** Blaze-Rangliste (Paket 6), manueller Loadout-Override. Blaze-Guide bekommt kein `area` und daher keinen Modus.

## Review Focus

1. Eine Linie aus Büchern: Die Vorausschau darf Zwischenstufen nicht doppelt zählen, denn der Preis der letzten Stufe enthält sie (Test in Task 4).
2. Modus `Best value` gespeichert, dann Wechsel auf einen Guide ohne `area`: Die Seite fällt auf `By slot` zurück, ohne Fehler (Test in Task 6).
3. Altes Teil wird in der Forge verbraucht, liegt im Blaze-Loadout oder hat keinen Preis: Wiederverkauf 0 (Test in Task 5).
4. Tausch, bei dem der Ersatz schlechter ist, oder Speed über dem Softcap: Score ≤ 0 erscheint nicht als Rang und nicht als kostenlos (Test in Task 4).
5. Gewichtsfeld leer, 0 oder Unsinn: Blockstärke 0 ergibt keine Division durch null, ungültige Werte nehmen den Preset-Wert (Test in Task 3).

---

### Task 1: Ausgleichswert (Spec 3.4)

**Files:**
- Modify: `stats.js` (`statsEntry`, `areaView`), `app.js` (Speichern, Picker-Listener)
- Test: `tests/stats.test.js`

**Interfaces:**
- Produces: `statsEntry(area, form, at, measured?, previous?)` mit `measured: { total, boosts } | null`. Das Ergebnis enthält zusätzlich `offset: { [stat]: number }`, `offsetFor: { armor, equipment, pet } | null`, `offsetNote: 'boost'|'noitems'|'setup'|null`. `withOffset(total, entry) -> stats`, nie unter 0. `offsetStale(entry, setup) -> boolean`.

- [ ] **Step 1: Failing tests schreiben**

```js
test('the offset is in-game minus calculated, per typed stat', () => {
  const e = statsEntry('mining', { armor: 1, equipment: 1, boost: false, values: { MINING_SPEED: 1200, PRISTINE: '' } }, 1, { total: { MINING_SPEED: 1000, PRISTINE: 3 }, boosts: {} });
  assert.deepEqual(e.offset, { MINING_SPEED: 200 });
});
test('a value at the game maximum gives no offset', () => { /* blaze, ATTACK_SPEED 100, berechnet 90: kein Schlüssel */ });
test('boost box not matching the settings gives no offset and a note', () => { /* boost true, boosts {}: offset {}, offsetNote 'boost' */ });
test('the booster cookie setting alone matches the box', () => {});
test('the boost is not part of the offset', () => { /* God Potion an, Haken an: offset = inGame − total mit Boost; Boost aus: Basis sinkt um genau den Boost */ });
test('no item data gives no offset and a note', () => { /* measured null: offsetNote 'noitems' */ });
test('another slot with unchanged numbers gives no offset', () => { /* previous gleiche values, anderer armor: offsetNote 'setup' */ });
test('withOffset adds, never goes below 0 and leaves stats without offset alone', () => {});
test('offsetStale is true when wardrobe, equipment or pet differ', () => {});
test('a saved entry from 0.12 without offset counts as no offset', () => {});
test('the view shows the hint when the setup changed', () => {});
```

- [ ] **Step 2: Test ausführen.** `node --test tests/stats.test.js`. Erwartet: FAIL.
- [ ] **Step 3: Implementieren.** `STAT_MAX = { ATTACK_SPEED: 100 }`, Vergleich mit `>=`. Boost passt, wenn `entry.boost === (boosts.godPotion || boosts.boosterCookie)`. In `app.js` rechnet der Save-Handler `measured` aus `loadoutOf` und `computeStats` mit den Formularwerten und `boostsNow()`, ohne `itemData` ist es `null`. Hinweise in `areaView`: "Measure again: slot or pet changed." und je `offsetNote` ein Satz. Ein `change` auf `[data-stats-set]` blendet den Hinweis sofort ein, ohne zu speichern.
- [ ] **Step 4: `npm test` ausführen.** Erwartet: PASS.
- [ ] **Step 5: Commit** `feat: store the stat offset with each measurement`

### Task 2: Spieldaten und Delta je Schritt

**Files:**
- Create: `optimizer-data.js`, `optimizer.js`
- Modify: `progress.js` (`validStep` lässt `gain` durch, `validGuide` lässt `area` durch, `openStep`, `stepRow` exportieren), `sw.js`
- Test: `tests/optimizer.test.js`, `tests/progress.test.js`

**Interfaces:**
- Consumes: `loadoutOf`-Ergebnis aus `stats.js`, `items.json`, Schrittfelder `detect`, `items`, `gain`.
- Produces: `stepDelta(step, loadout, profile, items, settings, guide) -> stats | null`. `null` heißt: kein belegter Wert. `{}` heißt: bekannt, kein Gewinn. Aus `optimizer-data.js`: `ENCHANTS`, `GEMS`, `REFORGES`, jeweils mit `src`.

- [ ] **Step 1: Failing tests schreiben.** Zahlen aus dem Wiki, Stand 2026-11-01.

```js
test('enchant gain is the difference to the level on the tool', () => { /* efficiency 5 auf 10: 210 − 110 = 100 MINING_SPEED */ });
test('fortune and pristine follow the wiki table', () => { /* fortune 4: 45; pristine 5: 2.5 PRISTINE */ });
test('lapidary counts on gemstones only', () => { /* Gemstone-Preset: 50 GEMSTONE_FORTUNE und 100 MINING_SPEED bei Stufe 5; gemFortune false: null */ });
test('an enchant without a stat of ours gives {}', () => { /* experience, compact, smelting_touch, paleontologist */ });
test('flowstate has no fixed value and gives null', () => {});
test('an engine replaces the old one, a tank gives {}', () => { /* Titanium auf Amber: 450 Speed, 85 Fortune */ });
test('sunny side gives 50 fortune, blue cheese one level on all perks', () => {});
test('polarvoid counts the open books and the fortune once', () => {});
test('coating gives 500 speed on a drill and 10 fortune on armor', () => {});
test('the amber power scroll gives null', () => {});
test('a swap is new minus old base stats, reforge and gems carry over', () => {});
test('an item in no slot compares with the best owned item of its category', () => {});
test('an accessory subtracts the weaker one of its family', () => {});
test('a gem upgrade replaces the lower quality, by the rarity of the item', () => { /* Perfect Amber auf LEGENDARY statt Flawless: 80 − 58 */ });
test('a gem counts only for the slots still open', () => {});
test('a gem step on an item not owned yet uses the rarity of the new item', () => {});
test('recomb raises the rarity for gems', () => {});
test('a reforge without a known value gives null, also when the old one is unknown', () => {});
test('perk and attr steps come from computeStats on a changed copy', () => {});
test('the gain field is the fallback, never on top of a computed delta', () => {});
test('parts of a step add up, one part with null makes the whole step null', () => {});
test('validGuide keeps area and numeric gain and drops anything else', () => {});
```

- [ ] **Step 2: Test ausführen.** Erwartet: FAIL.
- [ ] **Step 3: Daten eintragen.** Quelle je Block als Kommentar.
  - `ENCHANTS` aus [Enchantments](https://hypixelskyblock.minecraft.wiki/w/Enchantments): `efficiency` 30, 50, 70, 90, 110, 130, 150, 170, 190, 210. `fortune` 10, 20, 30, 45. `pristine` 0.5, 1, 1.5, 2, 2.5. `lapidary` je Stufe 10 Gemstone Fortune und 20 Speed.
  - `GEMS` aus [Gemstone](https://hypixelskyblock.minecraft.wiki/w/Gemstone), je Typ, Qualität und Rarität. Nur `AMBER`, `JADE`, `TOPAZ` aller Qualitäten. Die Werte vor dem Eintragen am Rohtext gegen die Spaltenreihenfolge prüfen, denn der erste Abruf hat die Spalten nur aus der Reihenfolge zugeordnet.
  - `REFORGES`, `PARTS`, `POLARVOID`, `COATING`: Werte aus A2, Wiki-Seite als Kommentar. Nur NEU: `src: 'not confirmed'`. Nichts gefunden: Eintrag fehlt.
- [ ] **Step 4: `stepDelta` implementieren.** Ziel-Item je Teil: Loadout-Items mit einer ID aus `d.on` (Gruppen über `guide.groups`), sonst das Item aus `step.items`. Rarität: `items[id].tier`, plus eine Stufe bei `recomb`. `owned` und Item-Tausch: altes Teil gleicher `category` im Loadout. Nicht im Slot: siehe Tests. `anyOf`: die von `priceItem` gewählten `picked`. Teil-Erfüllung über `openStep` (Spec 6.3).
- [ ] **Step 5: `npm test` ausführen.** Erwartet: PASS.
- [ ] **Step 6: Commit** `feat: work out what a guide step adds to the mining stats`

### Task 3: Presets und Gewichte

**Files:**
- Modify: `stats.js` (`miningScore`, `heldOf`, `loadoutOf`), `optimizer.js`, `app.js`, `index.html`, `style.css`
- Test: `tests/stats.test.js`, `tests/optimizer.test.js`

**Interfaces:**
- Produces: `PRESETS = { gemstone, mithril, glacite }`, `miningSettings(raw) -> { preset, wF, wS, wP, blockStrength, gemFortune, keepOldGear }`. `loadoutOf` nimmt als fünftes Argument `settings` für die Wahl des Werkzeugs, Standard `GEMSTONE`. Gespeichert unter `settings.mining` und `settings.keepOldGear` in `bt.settings`.

- [ ] **Step 1: Failing tests schreiben**

```js
test('presets hold the spec values', () => {
  assert.deepEqual(pick(PRESETS.mithril), { blockStrength: 500, wF: 1, wS: 1, wP: 0 });
  assert.deepEqual(pick(PRESETS.glacite), { blockStrength: 6000, wF: 1, wS: 1, wP: 0 });
  assert.equal(softcap(PRESETS.gemstone), 20000);
  assert.equal(softcap(PRESETS.mithril), 3334);
  assert.equal(softcap(PRESETS.glacite), 40000);
});
test('gemFortune false leaves gemstone fortune out of the score', () => {});
test('gemFortune left out counts it, so old calls stay the same', () => {});
test('miningSettings replaces an empty, negative or unreadable field by the preset value', () => {});
test('a block strength of 0 falls back to the preset', () => {});
test('with the mithril preset the tool is picked by its mithril score', () => {});
```

- [ ] **Step 2: Test ausführen.** Erwartet: FAIL.
- [ ] **Step 3: Implementieren.** In `#hypixel-profile`: Auswahl Gemstone, Mithril, Glacite, drei Gewichtsfelder, Blockstärke, Knopf "Reset" (zurück auf Gemstone, Spec 4.1), Checkbox "I keep old gear" aus. Preset setzt die Felder, danach bleiben sie änderbar. Jede Änderung speichert und zeichnet neu.
- [ ] **Step 4: `npm test` ausführen.** Erwartet: PASS.
- [ ] **Step 5: Commit** `feat: add mining presets and weights`

### Task 4: `rankUpgrades` mit Gruppen und Vorausschau

**Files:**
- Modify: `optimizer.js`, `progress.js` (`nextUpgrades` bleibt, `openStep`, `bookOf` exportiert)
- Test: `tests/optimizer.test.js`

**Interfaces:**
- Consumes: `stepDelta` (Task 2), `withOffset` (Task 1), `miningSettings` (Task 3), `netCost` als Stub bis Task 5, `checkStep`, `nextUpgrades`, `stepCost`.
- Produces: `rankUpgrades(guide, checked, ctx, loadout, settings, base) -> { free: Row[], ranked: Row[], noPrice: Row[], noGain: Row[], zero: Row[], locked: Row[] }`, `Row = { section, step, delta, gain, net, perMillion, status, reasons, ahead }`. `gain` ist der Anteil, also 0.012 für 1,2 %. `perMillion = gain / (net / 1e6)`.

- [ ] **Step 1: Failing tests schreiben**

```js
test('ranked by gain per million, best first', () => {});
test('net cost of 0 or less with a gain goes to free, no rank', () => {});
test('a score of 0 or less goes to zero, no rank and not free', () => {});
test('a sum missing a price goes to noPrice, never ranked', () => {});
test('a delta of null goes to noGain', () => {});
test('locked goes to its own group with its reason', () => {});
test('unknown stays in the ranking and is marked', () => { assert.equal(rows.ranked[0].status, 'unknown'); });
test('a step of 0 gain in a line adds up to the first step with a gain', () => {});
test('a line of books counts the last book only', () => {});
test('a locked step ahead in the line locks the row', () => {});
test('the score uses the base with the offset', () => { /* Offset ändert die Reihenfolge von Fortune und Speed */ });
test('priority does not change the order', () => {});
test('a new tick moves the line on to its next step', () => {});
```

- [ ] **Step 2: Test ausführen.** Erwartet: FAIL.
- [ ] **Step 3: Implementieren** laut Spec 5.1 und 5.3. Vorausschau läuft über die übrigen offenen Schritte derselben `line`, in Guide-Reihenfolge, bis zum ersten mit Gewinn. `null` unterwegs beendet die Suche ohne Fund.
- [ ] **Step 4: Test ausführen.** Erwartet: PASS.
- [ ] **Step 5: Commit** `feat: rank open steps by gain per million`

### Task 5: Netto-Preis (Spec 5.7)

**Files:**
- Modify: `optimizer.js`
- Test: `tests/optimizer.test.js`

**Interfaces:**
- Consumes: `ahNet` aus `forge.js`, `walkBook` aus `craft.js`, `ctx.products`, `ctx.ah`, `ctx.cofl`, `ctx.forge`, `items[id].prestige`.
- Produces: `netCost(step, gross, loadout, otherLoadout, items, ctx, keepOldGear) -> { net, resale, soldId }`.

- [ ] **Step 1: Failing tests schreiben**

```js
test('net is the price minus the bazaar sell price after the bazaar tax', () => { /* 20M, verkauft für 8M, 1,25 %: resale 7,9M, net 12,1M */ });
test('without a bazaar price it takes the BIN after ahNet', () => {});
test('a forge ingredient or prestige step sells nothing', () => {});
test('a piece in the other area loadout sells nothing', () => {});
test('a piece without a price or marked nt sells nothing', () => {});
test('a piece not owned or no sync means the gross price', () => {});
test('keepOldGear means the gross price', () => {});
test('only an item swap has a resale, an enchant keeps the gross price', () => {});
test('net is never below 0', () => {});
test('By slot sums stay gross', () => {});
```

- [ ] **Step 2: Test ausführen.** Erwartet: FAIL.
- [ ] **Step 3: Implementieren.** Bazaar-Verkauf: `walkBook(products[id].sell_summary, 1, false) * (1 - ctx.tax)`, `ctx.tax` ist die Steuer aus den Settings als Anteil (dort ist Derpy schon berücksichtigt). Sonst `ahNet(bin, ctx.derpy)`, wobei `ctx.derpy` aus der vorhandenen Wahl in `app.js` kommt. Stub aus Task 4 ersetzen.
- [ ] **Step 4: `npm test` ausführen.** Erwartet: PASS.
- [ ] **Step 5: Commit** `feat: count resale of the replaced piece in the net price`

### Task 6: "Best possible" und Modus `Best value`

**Files:**
- Modify: `optimizer.js`, `progress.js` (`progressView`), `app.js`, `style.css`
- Local only: `personal/build-detect.mjs`, `personal/guides/mining.json` (`area: "mining"`), gitignored
- Test: `tests/optimizer.test.js`, `tests/progress.test.js`, `tests/profile-fixture.test.js`

**Interfaces:**
- Consumes: alles aus Task 1 bis 5, `stepRow`.
- Produces: `bestLoadout(profile, items, loadout, base, settings) -> { slots: [{ slot, current, best }], gain }`, `bestValueView({ guide, checked, ctx, name, products, profile, statsInput, settings, stepRow }) -> html`. `progressView` nimmt `bestValue` als Funktion. `app.js` reicht `bestValueView` durch und speichert den Modus `best` in `bt.guideMode`.

- [ ] **Step 1: Failing tests schreiben**

```js
test('bestLoadout picks per slot the owned item with the highest score', () => {});
test('each pick builds on the ones before it', () => {});
test('a slot already best is not listed and the gain is 0', () => {});
test('an item in the chest or a backpack counts, an accessory does not', () => {});
test('the mode button shows only on a guide with area mining', () => {});
test('a saved best mode on a guide without area shows By slot', () => {});
test('without a sync the mode says what is missing and links to the settings', () => {});
test('the row shows yield, per million, raw stats and the net line', () => {
  /* '+1.2 % yield · 0.4 %/1M', '+10 Fortune, +40 Speed', 'Net 12M (buy 20M − resale 8M)' */
});
test('locked rows stand under the ranking with their reason, no rank', () => {});
test('names and reasons are escaped', () => {});
test('the export after a sync still holds no offset or in-game value', () => {});
test('the real mining guide ranks without error and every group is an array', { skip: !hasFixtures }, () => {
  /* nur Anzahlen je Gruppe, keine Namen */
});
```

- [ ] **Step 2: Test ausführen.** Erwartet: FAIL.
- [ ] **Step 3: Implementieren.** Reihenfolge der Seite: Sync-Hinweise und Preset-Name, Karte "Best possible" mit Vergleich zum gewählten Wardrobe-Slot, `free`, `ranked`, dann getrennt `locked`, `noPrice`, `noGain`, `zero`. Die Karte nennt: "Pet stays as picked. Set bonuses are not counted." Bei Preset ohne `gemFortune` ein Hinweis zu A1. Gaps des Loadouts sichtbar. Neue Klassen nur mit Tokens.
- [ ] **Step 4: Guide lokal ändern.** `area: "mining"` über `personal/build-detect.mjs` setzen, Skript laufen lassen, per grep prüfen. Der Commit enthält das nicht.
- [ ] **Step 5: `npm test` ausführen.** Erwartet: PASS.
- [ ] **Step 6: Commit** `feat: add the Best value mode and best possible loadout`

### Task 7: Changelog 0.13.0, Abschluss

**Files:**
- Modify: `changelog.json`, `docs/spec-optimizer.md`, `sw.js` falls noch offen
- Test: `tests/onboarding.test.js`, `tests/sw.test.js`

- [ ] **Step 1: Changelog** `0.13.0` mit Datum des Abschlusses. Einträge mit `"personal": true`: "Best value" und "Best possible".
- [ ] **Step 2: Spec nachziehen.** In 3.4 "noch nicht gebaut" entfernen. In 4.1 die Pristine-Prüfung und A1 ergänzen. In 5.4 die Abdeckung nach A2.
- [ ] **Step 3: `npm test` ausführen.** Erwartet: alle PASS, auch `contrast`, `onboarding`, `sw`.
- [ ] **Step 4: Abdeckung melden.** Aus dem echten Guide nur Anzahlen je Gruppe in den Abschlussbericht, vor und nach den neuen Tabellen.
- [ ] **Step 5: Commit** `feat: release the mining ranking (0.13.0)`. Nicht pushen.

## Offene Punkte für den Test am Gerät

Nach dem Merge am Gerät prüfen: Reihenfolge plausibel, Offset nach neuer `/stats`-Messung. In `stats-preset.json` stehen Messwerte ohne Offset. Bis zum ersten Speichern rechnet die Rangliste ohne Ausgleich und sagt das.

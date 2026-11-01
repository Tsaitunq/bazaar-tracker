# Optimizer Pakete 3 und 4: Voraussetzungen und Stats, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der Guide zeigt, welche Upgrades noch gesperrt sind und warum. Die App berechnet Stats je Bereich aus der Lore und vergleicht sie mit `/stats`.

**Architecture:** `scripts/items.mjs` verdichtet die Item-Resource zu `items.json`. `requires.js` prüft Voraussetzungen, `stats.js` berechnet Summen, das Loadout aus dem gewählten Wardrobe-Slot und den Abgleich. Beide sind reine Funktionen über dem vorhandenen Profilstand aus `profile.js`.

**Tech Stack:** ES-Module ohne Abhängigkeiten, `node --test`.

**Spec:** `docs/spec-optimizer.md` (2.4 bis 2.6, 3, 4.1, 5.2, Pakete 3 und 4 in Abschnitt 8)

## Global Constraints

- Branch `feat/stats` von `main`. Commits pro Task, nichts pushen. Vor Task 7 anhalten.
- Tests nur mit Fixtures, nie gegen die API (`CLAUDE.md`). Tests gegen `personal/fixtures/` überspringen sich ohne Datei und geben keine Werte aus.
- Keine UUID, kein Spieler- oder Loadout-Name in Repo, Commit, Report oder Session-Ausgabe. Der Report zeigt nur Stat-Namen und Zahlen.
- Spieldaten: Wiki zuerst. Was nur aus NEU stammt, trägt `"src": "not confirmed"` (`CLAUDE.md`, Spec 5.4).
- Neue Root-`.js` in `SHELL` (`sw.js`). Farben nur als Tokens. UI-Texte Englisch.
- `unknown` sperrt nichts: Ein Schritt verschwindet nie wegen fehlender Daten (Spec 5.2).
- Nach jeder Ersetzung per grep prüfen, ob sie angekommen ist (`CLAUDE.md`).

## Prüfung der Pristine-Formel

**Ergebnis: Der Score-Term `wP · 0,79 · ΔP / (1 + 0,79·P)` stimmt mit dem Wiki überein.** Geprüft am 2026-11-01.

Quelle: [Pristine](https://hypixelskyblock.minecraft.wiki/w/Pristine), Abschnitte Mechanics und Expected Drop Calculation, zuletzt bearbeitet am 2026-10-31 (Revision `oldid=866262`). Der Rohtext war per Skript wegen einer Cloudflare-Abfrage nicht abrufbar. Die Zitate stammen aus der gerenderten Seite, ausgelesen über WebFetch.

- Formel im Wiki: `Average Rough Gemstones = Base Drop × (1 + Pristine × 79/100) × (1 + (Mining Fortune + Gemstone Fortune) × 1/100)`. Die Seite rendert die Brüche als `79100` und `1100`; der Rohtext-Abruf über WebFetch liefert `0.79`.
- Der Score-Term ist die Ableitung von `ln(1 + 0,79·P)`. Pristine und Fortune sind im Wiki Faktoren, die Terme addieren sich also korrekt zur prozentualen Änderung des Ertrags.
- Fortune wirkt auf beide Drops: "Then, Mining Fortune applies on both Rough and Flawed Ruby Gemstones."
- Zusammenspiel mit "+1 % je Pristine": "Every 1 Pristine grants a +1% chance to drop a Flawed Gemstone per Rough Gemstone initially yielded upon mining." Laut [Gemstone](https://hypixelskyblock.minecraft.wiki/w/Gemstone) ist ein Flawed 80 Rough wert.

Grenzen:

1. **Herkunft der 79 ist nicht belegt.** Das Wiki erklärt sie nicht. 79 passt, wenn ein Flawed einen Rough ersetzt (80 − 1), das ist aber eine Herleitung. Wäre der Flawed zusätzlich, ergäbe sich 0,80. Bei P=5 macht das für +1 Pristine 15,96 % gegen 16,00 %, ist für die Rangliste also unerheblich. Der Code nutzt 0,79 wie das Wiki.
2. **Der Term rechnet in Rough-Äquivalenten.** Ein Flawed zählt als 80 Rough, nicht zum Marktpreis. Weicht der Preis von Flawed zu 80 × Rough ab, stimmt die Ableitung für Coins nicht mehr exakt. Das Paket ändert daran nichts, `wP` bleibt einstellbar.
3. **Die Formel gilt laut Wiki für Gemstones.** Das passt zu `wP = 0` in den Presets Mithril und Glacite.
4. **Das Wiki hat kein Zahlenbeispiel**, nur das Ruby-Beispiel in Worten. Spec 4.1 verlangt einen Test auf das "Wiki-Rechenbeispiel". Task 4 hält stattdessen die Spec-Werte fest (F=1000, S=6000, P=5: 0,91 %, 0,83 %, 15,96 %), als Herleitung gekennzeichnet.

Im Code gibt es den Score noch nicht (grep auf `0.79` ohne Treffer). Task 4 legt ihn an, weil das Mining-Loadout ihn braucht.

## Attack-Speed-Shard

**Ergebnis: Die ID ist falsch, richtig ist `SHARD_BURNINGSOUL`.**

- [Wiki, Inferno Demonlord Shard](https://hypixelskyblock.minecraft.wiki/w/Inferno_Demonlord_Shard): Attack Speed, Epic, "Shard Item ID: BURNINGSOUL".
- NEU `attribute_shards.json`: `bazaarName: SHARD_BURNINGSOUL`, Name Inferno Demonlord.
- Bazaar-Resource vom 2026-11-01: `SHARD_BURNINGSOUL` vorhanden, `SHARD_INFERNO_DEMONLORD` nicht. Alle anderen Shard-IDs beider Guides sind vorhanden.
- Der Hinweis im Guide "not on the Bazaar" ist damit ebenfalls falsch und entfällt.

## Abweichungen von der Spec

- **Stufentabellen statt Skill-Resource:** Skill-, HOTM- und Slayer-Schwellen sind Konstanten aus dem Wiki in `requires.js`. Das spart einen zweiten Snapshot-Abruf.
- **Collections über `collTiers`:** `player_data.unlocked_coll_tiers` nennt freigeschaltete Stufen direkt (`GRAVEL_3`). Die Resource `/collections` entfällt.
- **`requires` im Guide-Schritt entfällt:** Kein Guide nutzt das Feld. Es zählt nur `items.requirements`.
- **`/stats` im Profilstand:** Die Werte liegen als `inGame` im vorhandenen Profil-Blob, also in `noBackupFilesDir`. Es gibt keine neue Native-Methode.
- **Verschoben auf Paket 5:** "In-Game-Wert als Basis der Bewertung" (Spec 3.4), weil es hier noch keine Bewertung gibt.
- **Loadout (Auftrag 2026-11-01, ersetzt Spec 2.5 für dieses Paket):** Der Nutzer wählt je Bereich Wardrobe-Slot und Equipment-Slot in `#personal-settings`. Accessories, Pet und Power gelten wie erkannt. Die automatische Wahl "best possible" kommt in Paket 5.
- **Blaze-Score:** `blazeScore = hit` (Spec 4.2). True Defense ≥ 140 und MP ≥ 800 sind nur Constraints.
- **`DAMAGE`:** nicht im `/stats`-Formular. Der Waffenschaden kommt aus der Lore.
- **Boost-Angabe:** Das Formular hat je Messung die Checkbox "God Potion / Booster Cookie active", der Report nennt sie bei Abweichungen.
- **Set-Boni:** werden nicht berechnet. `gaps` nennt ein volles Set im Loadout.
- **Abweichungsgrenzen:** Die UI markiert ab 5 % (Spec 3.4). Der lokale Report meldet nach Auftrag jede Abweichung über 2 %.

## Review Focus

1. `items.json` noch nicht auf dem Data-Branch oder Abruf fehlgeschlagen: alle Schritte `unknown`, kein Fehler, kein "locked" (Test in Task 2).
2. Requirement-Typ, den die App nicht lesen kann (`GARDEN_LEVEL`, `PROFILE_TYPE`): `unknown`, nie `locked` (Test in Task 2).
3. Der gewählte Slot ist der gerade getragene: Dessen Wardrobe-Eintrag ist leer, die Items kommen aus `inv_armor` und `equipment_contents` (Test in Task 4).
4. Zwei Accessories einer Familie: nur das stärkere zählt (Test in Task 4).
5. Sync nach eingetragenem `/stats`: Werte bleiben erhalten, Hinweis "older than last sync" erscheint (Test in Task 6).

---

### Task 1: `items.json` im Snapshot-Job

**Files:**
- Create: `scripts/items.mjs`
- Modify: `scripts/snapshot.mjs` (`runExtras`), `data.js`
- Test: `tests/snapshot.test.js`

**Interfaces:**
- Produces: `compactItems(resource, parents) -> { [id]: { name, category, sword_type, tier, stats, tiered_stats, gemstone_slots, requirements, prestige, parent, family } }`, `loadItemData() -> Promise<object|null>` in `data.js` (`loadItems` gibt es schon in `names.js`).

- [ ] **Step 1: Failing tests schreiben**

```js
test('compactItems keeps only the listed fields and folds stat names to upper case', () => {
  const out = compactItems({ items: [{ id: 'A', name: 'a', npc_sell_price: 9, stats: { mining_fortune: 5 }, museum_data: { parent: { x: 'B' } } }] }, {});
  assert.deepEqual(out.A.stats, { MINING_FORTUNE: 5 });
  assert.equal(out.A.npc_sell_price, undefined);
});
test('compactItems takes the accessory family from the parents list', () => { /* parents { TOP: ['LOW'] } -> LOW.family === TOP und TOP.family === TOP */ });
test('a failed item fetch keeps the old file and the snapshot still counts', async () => { /* get wirft für resources/skyblock/items */ });
```

- [ ] **Step 2: `node --test tests/snapshot.test.js` ausführen.** Erwartet: FAIL, Modul fehlt.
- [ ] **Step 3: Implementieren.** Abruf einmal pro 24 h über `recipesStale`. Felder laut Spec 1.2. `family` kommt aus NEU `parents.json` im vorhandenen Klon von `refreshRecipes` und gilt als "not confirmed". Vor dem Schreiben Pflichtprüfung: mindestens 1000 Items, sonst bleibt die alte Datei.
- [ ] **Step 4: Test ausführen.** Erwartet: PASS.
- [ ] **Step 5: Commit** `feat: add items.json to the snapshot job`

### Task 2: Voraussetzungen prüfen

**Files:**
- Create: `requires.js`
- Modify: `sw.js`
- Test: `tests/requires.test.js`

**Interfaces:**
- Consumes: `items.json` aus Task 1, Profilstand von `summarize`.
- Produces: `checkStep(step, items, profile) -> { status: 'ok'|'locked'|'unknown', reasons: string[] }`, `levelOf(table, xp) -> number`.

- [ ] **Step 1: Failing tests schreiben**

```js
test('HOTM below the tier locks with a reason', () => {
  const r = checkStep(step('DIVAN_DRILL'), { DIVAN_DRILL: { requirements: [{ type: 'HEART_OF_THE_MOUNTAIN', tier: 7 }] } }, profile({ hotmLevel: 5 }));
  assert.deepEqual(r, { status: 'locked', reasons: ['HOTM 7 needed, you have 5'] });
});
test('each known type decides: SKILL, SLAYER, KUUDRA_COMPLETION, COLLECTION', () => { /* je erfüllt und nicht erfüllt */ });
test('ANY_OF passes with one met entry, ONE_OF likewise', () => {});
test('an unreadable type is unknown, never locked', () => { /* GARDEN_LEVEL; ANY_OF nur aus PROFILE_TYPE */ });
test('collections off gives unknown', () => { /* collTiers null */ });
test('no items.json or no profile gives unknown', () => {});
test('locked beats unknown across the items of a step', () => {});
test('a step without items is ok', () => {});
test('levelOf stops at the top of the table', () => {});
```

- [ ] **Step 2: Test ausführen.** Erwartet: FAIL.
- [ ] **Step 3: Implementieren.** Schwellen für HOTM, Skills, Slayer (`vampire` hat eine eigene Tabelle) aus dem Wiki, mit Seitenname im Kommentar. Kuudra: `KUUDRA_COMPLETION.kuudra_tier` kleingeschrieben als Schlüssel in `profile.kuudra`, Abschluss heißt Wert > 0; die Bedeutung ist laut Spec [nicht bestätigt] und wird am Fixture geprüft. Collection: `` `${collection}_${tier}` `` in `collTiers`.
- [ ] **Step 4: Test ausführen.** Erwartet: PASS.
- [ ] **Step 5: Commit** `feat: check step requirements against the profile`

### Task 3: Gesperrte Upgrades anzeigen, Shard-ID korrigieren

**Files:**
- Modify: `progress.js` (`stepRow`, `nextUpgrades`, `progressView`), `app.js`, `style.css`
- Local only: `personal/guides/blaze-slayer.json`, gitignored
- Test: `tests/progress.test.js`, `tests/profile-fixture.test.js`

**Interfaces:**
- Consumes: `checkStep` aus Task 2, `loadItemData` aus Task 1. `ctx.items` kommt neu in den `ctx` von `progressView`.

- [ ] **Step 1: Failing tests schreiben**

```js
test('a locked step shows a badge with its reason and stays checkable', () => {});
test('Next upgrades marks a locked step and leaves order and totals unchanged', () => {});
test('an unknown step shows no badge', () => {});
test('a reason with HTML is escaped', () => {});
test('every shard id of the real guides appears in the checked list', { skip: !existsSync(GUIDES) }, () => { /* keine ID SHARD_INFERNO_DEMONLORD */ });
```

- [ ] **Step 2: Test ausführen.** Erwartet: FAIL.
- [ ] **Step 3: Implementieren.** Badge `locked` neben dem vorhandenen Badge `API`, Grund als `guide-hint`. Spec 5.1 trennt gesperrte Schritte erst in der Rangliste von Paket 5 ab, hier werden sie nur markiert. `items.json` lädt erst, wenn eine Guide-Ansicht offen ist.
- [ ] **Step 4: Guide ändern.** In `blaze-slayer.json` ID auf `SHARD_BURNINGSOUL` setzen und den Hinweis "not on the Bazaar" entfernen. Mit grep prüfen. `personal/` ist gitignored, also erscheint diese Änderung in keinem Commit, nur der Test.
- [ ] **Step 5: `npm test` ausführen.** Erwartet: PASS.
- [ ] **Step 6: Commit** `feat: show locked upgrades in the guide`

### Task 4: Stats aus der Lore und Loadout aus dem gewählten Slot

**Files:**
- Create: `stats.js`
- Modify: `profile.js` (Set-Index je Item, `wardrobe` im Stand), `sw.js`
- Test: `tests/stats.test.js`, `tests/profile.test.js`

**Interfaces:**
- Consumes: `items.json` (`category`, `family`), `profile.items`.
- Produces: `item.sets: ['armor:3', 'equipment:2']`, `summary.wardrobe: { armor: { equipped, sets: number[] }, equipment: { equipped, sets: number[] } }`, `miningScore(stats, delta, settings) -> number`, `blazeScore(stats) -> number`, `blazeConstraints(stats, mp) -> { trueDefense: 'ok'|'low'|'unknown', mp: 'ok'|'low'|'unknown' }`, `loadoutOf(profile, items, area, choice) -> { armor: Item[], equipment: Item[], held: Item|null, accessories: Item[], pet, gaps: string[] }` mit `choice: { armor: number, equipment: number }`.

- [ ] **Step 1: Failing tests schreiben**

```js
test('miningScore matches the derived spec values', () => {
  const base = { MINING_FORTUNE: 1000, MINING_SPEED: 6000, PRISTINE: 5 };
  assert.ok(Math.abs(miningScore(base, { MINING_FORTUNE: 10 }, GEMSTONE) - 10 / 1100) < 1e-9);
  assert.ok(Math.abs(miningScore(base, { MINING_SPEED: 50 }, GEMSTONE) - 50 / 6000) < 1e-9);
  assert.ok(Math.abs(miningScore(base, { PRISTINE: 1 }, GEMSTONE) - 0.79 / 4.95) < 1e-9);
});
test('speed above the softcap counts nothing', () => {});
test('wP = 0 removes pristine', () => {});
test('blazeScore is the hit of spec 4.2 and ignores true defense', () => {});
test('blazeConstraints: 140 TD and 800 MP pass, below is low, missing is unknown', () => {});
test('loadoutOf takes the chosen wardrobe and equipment set', () => {});
test('the worn set comes from the worn items', () => {});
test('an item shared by two sets belongs to both', () => {});
test('no choice falls back to the worn set and says so in gaps', () => {});
test('a saved profile without sets asks for a new sync in gaps', () => {});
test('two accessories of a family count once, the stronger one', () => {});
test('a full armor set is named in gaps, three pieces are not', () => {});
test('the held item is the best owned tool or the weapon with the most lore damage', () => {});
```

- [ ] **Step 2: Test ausführen.** Erwartet: FAIL.
- [ ] **Step 3: Implementieren.** Score laut Spec 4.1, `hit` laut Spec 4.2 ohne `A` und `M`. Der Slot enthält keine Waffe, darum gilt für `held`: Mining das Item der Kategorien Drill, Pickaxe oder Gauntlet mit dem höchsten `miningScore`, Blaze das Item der Kategorien Sword oder Longsword mit dem höchsten Lore-`DAMAGE`. Die UI zeigt die Wahl. Pet ist das Pet mit `active`. Volles Set: vier Rüstungsteile mit gleichem Namensstamm vor dem Slot-Suffix.
- [ ] **Step 4: Test ausführen.** Erwartet: PASS.
- [ ] **Step 5: Commit** `feat: add lore stats and the chosen loadout`

### Task 5: Weitere Stat-Quellen

**Files:**
- Modify: `stats.js`
- Test: `tests/stats.test.js`

**Interfaces:**
- Produces: `computeStats(profile, items, loadout, area) -> { total: stats, parts: { gear, accessories, power, pet, hotm, skills, collections, base }, gaps: string[] }`.

- [ ] **Step 1: Failing tests schreiben**

```js
test('HOTM adds 20 speed, 2 fortune and 0.1 pristine per level of the matching perk', () => {});
test('mining skill adds 4 fortune per level', () => {});
test('the MP multiplier follows the wiki formula', () => { /* 29.97 × ln(0.0019 × MP + 1)^1.2 */ });
test('tuning points add their stats', () => {});
test('the fortune collections add once per reached tier', () => {});
test('skills off leaves the part out and names it in gaps', () => {});
test('a pet not in the table is named in gaps, not guessed', () => {});
```

- [ ] **Step 2: Test ausführen.** Erwartet: FAIL.
- [ ] **Step 3: Implementieren.** Vor dem Einbau jede Konstante aus Spec 3.2 gegen das Wiki prüfen und den Seitennamen als Kommentar setzen. Weicht das Wiki von der Spec ab, gilt das Wiki und die Spec wird korrigiert. Pet-Tabelle nur für Pets, die in den Pet-Schritten der Guides vorkommen; Power-Stone-Grundwerte nur für den ausgewählten Stone. Alles andere landet in `gaps`.
- [ ] **Step 4: Test ausführen.** Erwartet: PASS.
- [ ] **Step 5: Commit** `feat: add hotm, skill, collection, power and pet stats`

### Task 6: `/stats`-Abgleich in der App

**Files:**
- Modify: `stats.js`, `sync.js`, `app.js`, `index.html`, `style.css`
- Test: `tests/stats.test.js`, `tests/sync.test.js`

**Interfaces:**
- Consumes: `computeStats` aus Task 5, `loadoutOf` aus Task 4.
- Produces: `compareStats(calculated, inGame) -> [{ stat, calculated, inGame, diff, percent, flag }]`. Im Profilstand: `statsInput: { mining: { choice: { armor, equipment }, values, boost, at }, blaze: { … } }`.

- [ ] **Step 1: Failing tests schreiben**

```js
test('compareStats flags from 5 percent', () => { /* 100 gegen 95: flag; 100 gegen 96: kein flag */ });
test('an in-game value of 0 gives no division by zero', () => {});
test('an empty field is left out', () => {});
test('a sync on the same profile keeps statsInput and an older value is marked stale', () => {});
test('another profile starts without statsInput', () => {});
test('DAMAGE is shown from the lore and is not compared', () => {});
test('the boost box is stored per measurement and shown at a flagged stat', () => {});
test('the export after a sync contains no in-game values', () => {});
test('the view escapes stat values and lists the loadout', () => {});
```

- [ ] **Step 2: Test ausführen.** Erwartet: FAIL.
- [ ] **Step 3: Implementieren.** Je Bereich in `#personal-settings`: Auswahl Wardrobe-Slot und Equipment-Slot (nur Index, getragener Slot markiert), Checkbox "God Potion / Booster Cookie active" und Formular mit den Stats aus Spec 3.3 ohne `DAMAGE`. Anzeige: berechnet, in-game, Abweichung absolut und in Prozent, ab 5 % gelb per Token. Darunter das erkannte Loadout und `gaps`. Hinweis im Formular: "Measure with the setup you actually play with." Ohne Plugin unsichtbar wie der Rest der Sync-Sektion.
- [ ] **Step 4: `npm test` ausführen.** Erwartet: PASS.
- [ ] **Step 5: Commit** `feat: compare calculated stats with /stats`

### Task 7: Lokaler Abgleich, Changelog 0.12.0

**Files:**
- Create: `scripts/stats-report.mjs`
- Modify: `changelog.json`, `docs/spec-optimizer.md` (geprüfte Punkte)
- Local only: `personal/fixtures/stats-ingame.json`, `personal/fixtures/items.json`

**Interfaces:**
- Consumes: `summarize`, `pickLoadout`, `computeStats`, `compareStats`.

- [ ] **Step 1: Report schreiben.** Ausgabe je Bereich als Tabelle mit Stat, berechnet, `/stats`, Abweichung in Prozent, sonst nichts. Bei einer Abweichung nennt der Report zusätzlich `boost`. Der Schalter `--slots` gibt stattdessen die Wardrobe- und Equipment-Slots mit Index und Teilezahl aus, ohne Namen. Ohne `stats-ingame.json` bricht es mit klarer Meldung ab. Format der Datei:

```json
{ "mining": { "MINING_FORTUNE": 0, "GEMSTONE_FORTUNE": 0, "MINING_SPEED": 0, "PRISTINE": 0, "boost": false, "armor": 0, "equipment": 0 },
  "blaze": { "STRENGTH": 0, "CRITICAL_DAMAGE": 0, "CRITICAL_CHANCE": 0, "ATTACK_SPEED": 0, "HEALTH": 0, "DEFENSE": 0, "TRUE_DEFENSE": 0, "boost": false, "armor": 0, "equipment": 0 } }
```

- [ ] **Step 2: `node scripts/stats-report.mjs` ausführen.** Jede Abweichung über 2 % ist ein Fund und wird im Abschlussbericht mit Ursache erklärt (fehlender Beitrag, Set-Bonus, Potion, anderes Setup, Parser).
- [ ] **Step 3: Offene Spec-Frage aus 2.4 beantworten:** Die 12 Lore-Zeilen, bei denen die erste Zahl kleiner ist als die Klammersumme, gegen den Abgleich prüfen.
- [ ] **Step 4: Changelog** `0.12.0` mit Datum 2026-11-01, Einträge mit `"personal": true`.
- [ ] **Step 5: `npm test` ausführen.** Erwartet: PASS, einschließlich `tests/onboarding.test.js`.
- [ ] **Step 6: Commit** `feat: release stats and requirements (0.12.0)`. Nicht pushen.

## Offene Voraussetzung für Task 7

`personal/fixtures/` enthält nur den Profilabruf vom 2026-10-31, **keine `/stats`-Werte**. Ohne sie ist der Vergleich nicht möglich. Die Werte müssen vom selben Stand stammen wie das Fixture und mit dem gewählten Wardrobe- und Equipment-Slot gemessen sein. Die App und `node scripts/stats-report.mjs --slots` nennen die Indizes.

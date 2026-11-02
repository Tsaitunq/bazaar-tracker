# Guide-App B2: Der Pfad ist die Rangliste, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der Pfad jedes Guides ist seine Rangliste. Der Best-value-Tab entfällt, alles funktioniert ohne Sync mit `/stats` und Haken.

**Architecture:** Neu sind zwei reine Module. `owned.js` hält den Item-Besitz über alle Guides und baut aus Haken ein virtuelles Profil, `path.js` berechnet die Reihenfolge. `guide/model.js` zeigt nur noch dieses Ergebnis. Die Rechenregeln aus `optimizer.js` (`stepDelta`, `blazeDelta`, `netCost`, `walkLine`, `chainCost`) bleiben und bekommen das virtuelle oder das echte Profil.

**Tech Stack:** ES-Module ohne Abhängigkeiten, `node --test`.

**Spec:** Keine eigene Datei. Die Entscheidungen stehen unten unter „Festgelegt".

## Global Constraints

- Branch `feat/guide-b2` von `main`. Commits pro Task, nichts pushen.
- Tests nur mit Fixtures, nie gegen eine Live-API. Tests gegen `personal/` überspringen sich ohne Datei und geben nur Zähler aus.
- Keine Guide-Texte, keine Bot-Zeilen, keine UUID und keine Spielernamen in Repo, Plan, Tests, Commits oder Session-Ausgabe.
- `personal/` bleibt in `.gitignore`. Die Guide-APK wird nie hochgeladen.
- Spieldaten: Wiki zuerst, sonst `src: 'not confirmed'`. Was keinen festen Wert hat, wird nicht geschätzt.
- Neue Dateien, die die App lädt, kommen in `SHELL` von `guide/sw.js`.
- Farben nur als Tokens. Nach jeder Ersetzung per grep prüfen, ob sie angekommen ist.
- Commits mit Git-Identität `Tsaitunq`.

## Festgelegt

| Thema | Entscheidung |
|---|---|
| Guides | Alter Mining-Guide bleibt und wird berechnet. Neuer Guide `shafting` („Shafting gear") hat feste Reihenfolge. |
| Besitz | Gemeinsam je Item-ID über alle Guides. Gilt nur für Item-Schritte (alle `detect`-Teile `owned`). Enchants, Gems und Reforges bleiben je Guide. |
| Preset | Neues `PRESETS.shafting`, Werte wie `gemstone`. „In Mineshafts"-Boni stehen voll in `gain`. Jade-/Sapphire-Abbau und Lapis-Corpse nur als `hint`. CR, GS, CDR werden angezeigt und ergeben keinen %-Wert. |
| Budget-Bremse | Grenze `settings.brake × max(ausgegeben, 1M)`, Standard 5, Einstellung in Settings. |
| Blaze-Werte | Fehlende Enchant- und Shard-Werte aus dem Wiki. Rest ans Ende in Guide-Reihenfolge. |
| Sections | „Consumables" wird `extra`. Optional-Sections werden gerankt. `priority`-Schritte stehen vorn. |
| Neuberechnung | Beim Öffnen, bei jedem Haken und beim ersten Laden der Bazaar-Preise. Danach ändern neue Preise nur angezeigte Zahlen. |
| Anzeige | `1.62M per 1 %`, `with the next N steps`. Änderbar über `SCORES`. |
| Stat-Basis | `/stats` plus Deltas der Schritte, die nach `entry.at` erledigt wurden. |
| Remove | Löscht Key, UUID und Sync-Daten, behält `statsInput` ohne `offset`-Felder. |

Ergänzungen nach Freigabe:

- Magical Power ist ein Feld im manuellen Blaze-Formular (`statsInput.blaze.mp`). Das virtuelle Profil nimmt diesen Wert statt `mp: null` (Task 4).
- Nach Task 6: ein Review-Subagent nur auf den Diff von Task 3 bis 6 (`owned.js`, virtuelles Profil, `path.js`). Fokus: Reihenfolge, Gruppen, Budget-Bremse, Besitz über Guides.
- Ausführung native. Tasks 1 bis 4 in einer Session, Tasks 5 bis 9 in der nächsten. Rulings stehen in `.superpowers/sdd/plan-guide-b2/progress.md`.

## Review Focus

1. Eine Gruppe ist teilweise erledigt: Der Kopf ist abgehakt, die Rest-Schritte zeigen die Summe des offenen Rests und bleiben zusammen. Test in Task 5.
2. Eine Gruppe enthält den zweiten Schritt einer `line`, deren erster offen ist: Die Gruppe wartet und überholt die Kette nicht. Test in Task 5.
3. Beim Ausstieg aus dem Sync oder nach Remove bleiben manuelle Haken und `pg.owned` erhalten und zählen weiter. Test in Task 3.
4. Haken in Guide A, dann Reset von Guide B: Der Besitz des gemeinsamen Items verschwindet in beiden, und der Dialog sagt das. Test in Task 3.
5. Alle Schritte kosten mehr als die Grenze: Der Pfad bleibt vollständig und nimmt den günstigsten zuerst. Test in Task 5.

---

## Dateien

- Neu: `owned.js` (Besitz, Item-Schritte, virtuelles Profil), `path.js` (Reihenfolge).
- Neu, privat: `personal/build-shafting.mjs`, `personal/guides/shafting.json`.
- Geändert: `progress.js`, `detect.js`, `optimizer.js`, `optimizer-data.js`, `native.js`, `guide/model.js`, `guide/app.js`, `guide/views/{guide,home,settings,parts}.js`, `guide/guide.css`, `guide/sw.js`, `guide/changelog.json`, `scripts/guide-shots.mjs`.
- Tests: `tests/owned.test.js`, `tests/path.test.js` (neu), `tests/shafting-guide.test.js` (neu, skip ohne Datei), plus bestehende Guide-Tests.

---

### Task 1: Remove behält die manuellen Stats

**Files:** Modify `native.js:84`, `guide/model.js`, `guide/app.js:228-239`. Test `tests/guide-model.test.js`, `tests/native.test.js`.

**Interfaces:** Produces `statsOnly(stand) -> {statsInput} | null` (`guide/model.js`), `clearApiKeyOnly() -> Promise<boolean>` (`native.js`).

- [ ] **Step 1: Failing tests schreiben**

```js
test('statsOnly keeps typed stats and drops what came from the sync', () => {
  const stand = { uuid: 'u', summary: {}, syncedAt: 1, statsInput: { mining: { values: { MINING_SPEED: 1 }, choice: { armor: null }, boost: false, at: 5, offset: { MINING_SPEED: 3 }, offsetFor: {}, offsetNote: null } } };
  assert.deepEqual(statsOnly(stand), { statsInput: { mining: { values: { MINING_SPEED: 1 }, choice: { armor: null }, boost: false, at: 5 } } });
});
test('statsOnly without typed stats is null', () => assert.equal(statsOnly({ uuid: 'u' }), null));
```

- [ ] **Step 2:** `node --test tests/guide-model.test.js` schlägt mit „statsOnly is not a function" fehl.
- [ ] **Step 3:** `statsOnly` implementieren. `clearProfileData` in `native.js` durch `clearApiKeyOnly` ersetzen und `tests/native.test.js` anpassen. `removeProfile` speichert zuerst `saveStand(statsOnly(stand))`, danach wird der Key gelöscht. Ist `statsOnly` null, ruft es den bestehenden `clearProfile`-Weg auf. Ohne Plugin gilt das Key-Löschen als Erfolg. Fehlt ein Schritt, bleibt die Meldung „Could not remove them.".
- [ ] **Step 4:** `npm test` läuft durch.
- [ ] **Step 5:** Commit `fix(guide): keep typed stats when removing key and profile data` (mit diesem Plan).

### Task 2: Guide-Format und Ein-Tab-Ansicht

**Files:** Modify `progress.js`, `guide/model.js`, `guide/views/guide.js`, `guide/views/home.js`, `scripts/guide-shots.mjs`. Test `tests/progress.test.js`, `tests/guide-views.test.js`, `tests/guide-model.test.js`.

**Interfaces:** Produces Guide-Felder `guide.order: 'fixed'|'value'` (Standard `value`), `guide.preset`, `section.extra: true`, `step.group: string`, `step.after: string[]`. Produces `nextPerGuide(models) -> [{area,name,step,text}]`.

- [ ] **Step 1: Failing tests:** `validGuide` behält die fünf Felder und verwirft falsche Typen. `parseRoute('#/guide/x/best', [{id:'x'}]).tab === 'path'`. Das Guide-Modell hat nur den Tab `path`. Abschnitte mit `extra` zählen nicht in `chaptersOf`.
- [ ] **Step 2:** Tests laufen rot.
- [ ] **Step 3:** Felder in `validStep`/`validGuide` durchlassen. `GUIDE_TABS = ['path']`. `bestTab`, `bestPanel`, `groupPanel`, `bestGroups`, `bestRow` und den Tab `best` entfernen. `bestPerGuide` wird `nextPerGuide`, die Startseite zeigt `NEXT STEP PER GUIDE` ohne den Sync-Hinweis. `chapterGroups` filtert `extra`-Abschnitte. `chaptersOf(guide, checked, costs, currentKey)`: `current` ist das Kapitel des aktuellen Schritts, ohne `currentKey` das erste offene wie bisher. Screenshots-Liste in `guide-shots.mjs` ohne `blaze-best`.
- [ ] **Step 4:** `npm test` läuft durch.
- [ ] **Step 5:** Commit `feat(guide): one path tab, guide fields for groups and extras`.

### Task 3: Gemeinsamer Besitz

**Files:** Create `owned.js`, `tests/owned.test.js`. Modify `progress.js` (Export), `guide/app.js`, `guide/model.js`, `guide/sw.js`, `guide/views/settings.js`.

**Interfaces:** Produces in `owned.js`:
- `isItemStep(step) -> boolean`: `detect` vorhanden, alle Teile `kind: 'owned'`.
- `idsToOwn(step, guide, ownedIds) -> string[]`: je noch nicht erfüllten Slot die erste ID, bis `need` erreicht ist.
- `idsOfStep(step, guide) -> string[]`: die ersten IDs aller Slots.
- `ownedAuto(guide, ownedIds, stepKey) -> Map<key,{have,need,ticked:true}>`: nur Item-Schritte.
- `mergeAuto(real, owned) -> Map`: echtes Ergebnis, außer es ist nicht erfüllt und `owned` schon.
- `migrateOwned(guides, checks) -> {owned, checks}`: Haken von Item-Schritten wandern nach `owned`, nur einmal.
- `impliedDone(guide, done) -> Set`: Schritte aus `step.after` erledigter Schritte.

Store: `pg.owned` (Array von IDs), `pg.ownedV1` als Migrations-Flag. Export und Import tragen `owned` mit.

- [ ] **Step 1: Failing tests** mit zwei Mini-Guides, die ein Item teilen:

```js
test('ticking an item step in one guide marks it in the other', () => {
  const owned = new Set(idsToOwn(stepA, guideA, new Set()));
  assert.equal(ownedAuto(guideB, owned, stepKey).get(keyB).have, 1);
});
test('a higher rung fulfils the step below it', () => { /* on: [['LOW','HIGH']], owned HIGH: met */ });
test('a gem step never lands in the shared store', () => assert.equal(isItemStep(gemStep), false));
test('migration moves ticks of item steps once and keeps the others', () => { /* zweiter Lauf ändert nichts */ });
test('real sync result beats a tick, a tick fills in where sync says no', () => { /* mergeAuto */ });
test('reset of a guide removes its items from the shared store', () => { /* idsOfStep */ });
```

Dazu der Review-Focus-Fall 3: `shownState` ohne `summary` plus `pg.owned` ergibt weiter erledigte Schritte.

- [ ] **Step 2:** Tests laufen rot.
- [ ] **Step 3:** `owned.js` implementieren.
  - `guide/app.js`: `toggle` schreibt bei Item-Schritten in `pg.owned`. Beim Abhaken werden `idsOfStep` entfernt, und ist der Schritt danach noch erfüllt, setzt `setMark` wie bisher `undone:`.
  - Überall, wo `detectGuide` läuft (`toggle`, `stampAll`, `guideModel`), wird `mergeAuto` genutzt.
  - `fromSync` im Modell verlangt `!found.ticked`.
  - `doneSet` bekommt die Schritte aus `impliedDone`. Das Modell zeigt solche und per höherer Stufe erfüllte Schritte mit `sub: 'skipped'`.
  - Reset-Dialog nennt: „Items you ticked also clear in your other guides."
  - `owned.js` in `SHELL`.
- [ ] **Step 4:** `npm test` läuft durch.
- [ ] **Step 5:** Commit `feat(guide): one owned state per item across guides`.

### Task 4: Virtuelles Profil und Stat-Basis

**Files:** Modify `owned.js`, `optimizer.js`, `tests/owned.test.js`.

**Interfaces:**
- Produces `virtualProfile(guide, marks, ownedIds, items) -> summary`: Form wie `profile.js`, `mp` aus dem Formular (sonst null), `attrs: {}`, `hotm: { nodes: {} }`, `missing: { inventory: false }`, `virtual: true`. Items tragen `lore: items[id].stats`.
- Produces `virtualLoadout(profile, items, area) -> loadout`: je Kategorie die höchste Stufe. Für Blaze zusätzlich `daggers`.
- Produces `applyStep(profile, step, guide, items) -> profile` (rein): trägt `owned`, `enchant`, `gem`, `reforge`, `recomb`, `coating`, `polarvoid`, `part`, `pet`, `attr`, `power`, `perk` ein. Unbekannte Arten ändern nichts.
- Produces `baseStats(typed, doneAfter) -> stats`: `typed` plus Deltas in Datumsreihenfolge. `entry.at` fehlt: keine Zuschläge. Stempel 0 zählen nie.
- `optimizer.js`: Für `guide.order === 'fixed'` gilt `step.gain` ungefiltert vor der Berechnung. Das Preset `shafting` kommt in `PRESETS`. Exportiert werden `blazeRules`, `walkLine`, `chainCost`.

- [ ] **Step 1: Failing tests:** `applyStep` ist idempotent und ändert die Eingabe nicht. Ein Dolch aus Haken erscheint in `daggersOf`. `baseStats` zählt nur nach `entry.at`. `miningSettings({preset:'shafting'})` liefert `wF:1, wS:1, wP:1, blockStrength:3000, gemFortune:true`. Bei `order:'fixed'` schlägt `gain` den `detect`-Wert. `miningScore` ignoriert `COLD_RESISTANCE`.
- [ ] **Step 2:** Tests laufen rot.
- [ ] **Step 3:** Implementieren.
- [ ] **Step 4:** `npm test` läuft durch. Mining-Ergebnisse der alten Tests bleiben gleich.
- [ ] **Step 5:** Commit `feat(guide): virtual profile from ticks and a stat base that follows them`.

### Task 5: Reihenfolge berechnen

**Files:** Create `path.js`, `tests/path.test.js`. Modify `guide/sw.js`.

**Interfaces:** Produces
`pathOf({ guide, checked, ctx, profile, loadout, base, settings, brake, other, keepOldGear, state }) -> { order: [Entry], limits, notes }` mit
`Entry = { key, section, step, group: {id, left} | null, gain, delta, coins, net, resale, unpriced, tier, status, reasons }` und
`tier: 'priority'|'requirement'|'free'|'value'|'overCap'|'noPrice'|'noGain'|'zero'|'locked'`.

Algorithmus (Runde für Runde, auf einer Kopie von Profil und Zustand):

```
Kandidaten: je line der erste offene Schritt (bis zum ersten mit Wert, walkLine), plus Schritte ohne line.
Gruppe: nur Kandidat, wenn jedes offene Mitglied erreichbar ist, wenn die davor geplant sind.
Grenze: brake × max(spent, 1e6). spent = Preise erledigter Schritte + bereits geplante.
Wahl: priority (höchster Wert zuerst, dann Guide-Index)
  → requirement (helps, nach pace)
  → free (gain > 0, net 0, nach gain)
  → value innerhalb der Grenze (nach Wert pro Coin)
  → sonst der günstigste über der Grenze (tier overCap)
Gleichstand: Guide-Index.
Keine Wahl mehr möglich: Rest in Guide-Reihenfolge, nach noPrice, noGain, zero, locked.
Nach jeder Wahl: applyStep und bei Blaze applyBlaze, spent erhöhen.
```

`order: 'fixed'`: Guide-Reihenfolge ohne Wahl, `base` läuft kumuliert mit, Gain und Tier je Schritt. Gruppen-Köpfe tragen die Summe, offene Mitglieder `group.left`. Extra-Abschnitte stehen nie in `order`.

- [ ] **Step 1: Failing tests** mit Mini-Guide und festen Preisen:

```js
test('best value per coin comes first', ...);
test('guide order breaks a tie', ...);
test('a step over brake x max(spent, 1M) waits and comes after spending', ...); // brake 5, Kosten 6M: erst nach 200k Ausgaben
test('every step over the cap: cheapest first, path stays complete', ...);
test('a priority step stays ahead of a better rate', ...);
test('a line keeps its order', ...);
test('a group ranks as one and stays together', ...);
test('a group with a member behind an open line step waits', ...);
test('half done group: head done, rest shows open sum and left', ...);
test('no price, no gain and zero stand after the ranked steps in guide order', ...);
test('without prices the order is the guide order', ...);
test('fixed order keeps the guide order and adds the gains up', ...);
```

- [ ] **Step 2:** Tests laufen rot.
- [ ] **Step 3:** `pathOf` implementieren, `path.js` in `SHELL`.
- [ ] **Step 4:** Fixture-Lauf mit 178 Dummy-Schritten: unter 1 s auf dem PC, sonst Ursache beheben. `npm test` läuft durch.
- [ ] **Step 5:** Commit `feat(guide): work out the path order`.

### Task 6: Pfad im Modell, Anzeige, Einstellung

**Files:** Modify `guide/model.js`, `guide/app.js`, `guide/views/{guide,parts,settings}.js`, `guide/guide.css`, `optimizer.js`, `tests/guide-*.test.js`.

**Interfaces:**
- Consumes `pathOf`, `virtualProfile`, `virtualLoadout`, `baseStats`.
- Produces `world.pathEpoch` (Zähler in `app.js`, steigt beim Öffnen eines Guides, bei jedem Haken und beim ersten Bazaar-Laden).
- Produces in `guide/model.js` den Cache `pathCached(guide, world)`, Schlüssel `guide.id|pathEpoch|syncedAt|stats at`.
- Produces `row.group = 'with the next N steps'`, `row.tier`. Neue `STATS`-Einträge für `COLD_RESISTANCE`, `GEMSTONE_SPREAD`, `PICKAXE_CDR`.

- [ ] **Step 1: Failing tests:**

```js
test('rate reads as coins per 1 %', () => assert.equal(SCORES.mining.rateText(0.01 / 1.62), '1.62M per 1 %'));
test('a head reads with the next N steps, one member reads with the next step', ...);
test('without a sync the rows have a rate from typed stats and ticks', ...);
test('rows follow the path order, done rows on top in guide order', ...);
test('a later price changes the number, not the place, until the next tick', ...);
test('a cold resistance step shows its stat and no rate', ...);
test('extras come last without a rate and can be ticked', ...);
test('swapping a score object changes every rate text', ...);
```

`rateText` empfängt weiter `perMillion` und rechnet `1e4 / perMillion`. Es gibt zwei Nachkommastellen aus, auch wenn `coins()` sonst kürzer rundet.

- [ ] **Step 2:** Tests laufen rot.
- [ ] **Step 3:** `guideModel` umstellen.
  - Quelle der Reihenfolge ist `pathCached`. Mit echter `summary` werden `loadoutOf` und `withOffset` wie in `rankMining`/`rankBlaze` genutzt, ohne sie das virtuelle Profil.
  - Kosten je Zeile bleiben live (`stepCost`, `netCost`), Gain kommt aus dem Cache. Die Rate wird aus beiden gebildet.
  - `missingNote` für `profile` entfällt. Limits-Chips, `notes` und `leftOut` wandern über den Pfad, die Warnung zum Dolchpaar ebenso.
  - Settings bekommen `Budget brake` (`data-brake`, Zahl > 0, sonst 5).
  - Gruppen-Mitglieder sind in der Zeile eingerückt (nur vorhandene Tokens).
- [ ] **Step 4:** `npm test` läuft durch. `tests/guide-css.test.js` bleibt grün.
- [ ] **Step 5:** Commit `feat(guide): the path shows the ranking, also without a sync`.

### Task 7: Wiki-Werte für Blaze und neue Erkennung

**Files:** Modify `optimizer-data.js`, `optimizer.js`, `detect.js`, `tests/optimizer.test.js`, `tests/detect*.test.js`.

**Interfaces:**
- Produces Einträge in `ENCHANTS` (bestehende Form) und `ATTRS = { <attr>: { stat, perLevel: number[] } }`. Ein Teil `attr` nutzt `ATTRS`, wenn `recomputed` nichts liefert.
- Produces Detect-Arten `essence: { perk, level }` (liest `profile.perks`) und `petItem: { types, item }` (liest `profile.pets[].heldItem`).

- [ ] **Step 1:** Die 16 Enchants und die Shard-Attribute der Blaze-Liste lokal auflisten, nur als Zähler in die Session. Pro Eintrag im Wiki prüfen, ob ein fester Wert für einen Blaze-Stat oder additiven Schaden existiert. Kein fester Wert heißt: kein Eintrag.
- [ ] **Step 2: Failing tests:** Beispiel-Enchant ergibt erwarteten Stat. Attribut ohne Tabelle bleibt `null`. `essence` und `petItem` melden `have/need`, ohne Daten keine Antwort.
- [ ] **Step 3:** Tests laufen rot, dann Daten und Regeln ergänzen. `perks`-Schlüssel gegen `personal/fixtures/profile-fixture.json` prüfen, nur Treffer zählen.
- [ ] **Step 4:** `npm test` läuft durch. Zähler ausgeben: Blaze-Schritte mit Wert, Wert 0, ohne Wert.
- [ ] **Step 5:** Commit `feat(guide): more blaze values from the wiki, essence and pet item detection`.

### Task 8: Shafting-Guide und Blaze-Daten (privat)

**Files:** Create `personal/build-shafting.mjs`, `personal/guides/shafting.json`. Modify `personal/guides/blaze-slayer.json`. Test `tests/shafting-guide.test.js`, `tests/guide-copy.test.js`.

Gruppen-Liste für Blaze: `personal/sources/blaze-groups-review.md`. Sie steht nicht hier, weil sie Guide-Texte enthält.

Der Builder liest die private Bot-Liste aus `personal/sources/` und schreibt den Guide:
- `title: 'Shafting gear'`, `area: 'mining'`, `order: 'fixed'`, `preset: 'shafting'`.
- Abschnitte als Kapitel, `extra: true` für Extras und Buffs.
- „mit den nächsten N" wird zu `group`. „nach X, ersetzt X" wird zur Slot-Leiter in `detect` (Items) oder zu `after` (Gems). Forge-Hinweise werden zu `item.forge` mit `without`.
- Eine Tabelle von Hand ordnet Namen IDs zu (7 fehlen: Divan-Teile, Pets).
- Slot-Unlock-Kosten kommen aus `items.json`, Essence-Kosten aus dem Wiki.
- Nicht zählende Boni stehen im `hint`.

- [ ] **Step 1: Failing test** (`skip` ohne Datei, Ausgabe nur Zähler): `validGuide` nimmt die Datei an. 119 Schritte in Rang-Abschnitten, 12 in Extra-Abschnitten. Alle Schritttexte eindeutig. 11 Gruppen mit den Größen 6, 4, 4, 6, 6, 2, 2, 2, 3, 6, 6. Alle `after`-Texte existieren. Alle Item-IDs stehen in `items.json`.
- [ ] **Step 2: Test in `guide-copy.test.js`:** Der Build enthält `personal/sources` nicht.
- [ ] **Step 3:** Builder schreiben und ausführen. In `blaze-slayer.json` die freigegebenen `group`-Felder setzen und „Consumables" auf `extra`.
- [ ] **Step 4:** `npm test` läuft durch. Zähler ausgeben: Schritte ohne Preis, Schritte mit Auto-Haken.
- [ ] **Step 5:** Commit nur der Tests: `test(guide): check the private shafting guide when present`. `git status` zeigt nichts aus `personal/`.

### Task 9: Aufräumen und Release-Vorbereitung

**Files:** Modify `optimizer.js`, `tests/optimizer.test.js`, `guide/changelog.json`, `scripts/guide-shots.mjs`.

- [ ] **Step 1:** Per grep prüfen, was keinen Aufrufer mehr hat (`rankArea`, `rankUpgrades`, `bestLoadout`, `bestBlaze`, `nextUpgrades`). Nur das löschen, samt Tests.
- [ ] **Step 2:** `guide/changelog.json`: Version `0.4.0`, heutiges Datum, Einträge für den Pfad als Rangliste, Shafting gear und gemeinsames Abhaken.
- [ ] **Step 3:** `npm test` läuft durch. `npm run guide:shots` und die Bilder ansehen: Pfad mit Gruppe, Extras, Settings mit Bremse. Die Bilder enthalten nur Fixture-Daten.
- [ ] **Step 4:** `npm run guide:build` läuft durch. Die APK bleibt lokal.
- [ ] **Step 5:** Commit `feat(guide): release 0.4.0`. Nicht pushen.

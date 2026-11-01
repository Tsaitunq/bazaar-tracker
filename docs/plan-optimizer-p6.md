# Optimizer Paket 6: Blaze-Rangliste, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der Blaze-Guide bekommt den Modus `Best value`: offene Schritte nach Schadensgewinn pro Million Netto-Kosten, mit True-Defense- und Magical-Power-Grenzen, Vergleich One For All gegen Guide-Weg, Ausgleichswert und "Best possible".

**Architecture:** `optimizer.js` wird bereichsfähig: Delta, Rang, Netto-Preis und Ansicht bekommen ein Bereichsobjekt (`mining`, `blaze`) mit Score, Stat-Liste und Hinweisen. Das Schadensmodell liegt als reine Funktionen in der neuen Datei `blaze.js`. `stepDelta` liefert weiter eine Stat-Änderung, für Blaze zusätzlich getrennt je Dolchlinie.

**Tech Stack:** ES-Module ohne Abhängigkeiten, `node --test`.

**Spec:** `docs/spec-optimizer.md` (3.2, 4.2, 4.3, 5.1 bis 5.7, Paket 6 in Abschnitt 8). **Aufbau auf:** `docs/plan-optimizer-p5.md`.

## Global Constraints

- Branch `feat/blaze-rank` von `main`. Commits pro Task, nichts pushen.
- Tests nur mit Fixtures, nie gegen die API (`CLAUDE.md`). Tests gegen `personal/` überspringen sich ohne Datei und geben keine Werte aus.
- Keine UUID, kein Spieler- oder Loadout-Name in Repo, Commit oder Session-Ausgabe. Keine Guide-Texte im Plan oder in Tests.
- Spieldaten: Wiki zuerst. Was nur aus NEU stammt, trägt `src: 'not confirmed'`. Was keinen festen Wert hat, wird nicht geschätzt, sondern landet in "No gain data".
- Kennzeichnung im UI überall "Estimate", nur relative Werte, keine Sekunden (Spec 4.2).
- `area: "blaze"` nur lokal in `personal/guides/blaze-slayer.json`.
- Mining-Ergebnisse bleiben gleich: Alle Tests aus Paket 5 laufen unverändert durch.
- Neue Root-`.js` in `SHELL` (`sw.js`). Farben nur als Tokens. Changelog mit `"personal": true`.
- Nach jeder Ersetzung per grep prüfen, ob sie angekommen ist.

## Formel-Quellen (Wiki, geprüft am 2026-11-01)

Abrufe liefen über WebFetch, also als Zusammenfassung, nicht als Rohtext. Task 2 trägt nur Werte ein, die hier stehen oder dort erneut gelesen werden.

| Teil | Wert | Seite |
|---|---|---|
| Treffer | `(5 + WD) × (1 + STR/100) × (1 + CD/100 bei Crit) × (1 + ΣAdditiv/100) × ΠMultiplikativ`, Ergebnis abgerundet | Damage Calculation |
| Crit | Wiki nennt nur "Crit Damage gilt bei einem Crit". Der Erwartungswert ist Herleitung, wie Spec 4.2 | Damage Calculation |
| Attack Speed | `Ticks = round(10 / (1 + AS/100))`, wirksam bis 82, Grenze 100. `hits/s = 20 / Ticks` ist Herleitung | Attack Speed |
| Dolche gegen Infernal | Ashen: 1,2 / 1,5 / 2. Spirit: 1,5 / 2,5 / 3,5 | Firedust, Kindlebane, Pyrochaos, Twilight, Mawdredge, Deathripper Dagger |
| Hellion Shield | 99 % Reduktion außer passende Dolchtreffer, Wechsel nach 8 Treffern, "excludes Ferocity" | Inferno Demonlord |
| One For All | +500 % additiv, entfernt alle anderen Enchants, "any Sword". Dolche sind nicht ausdrücklich genannt | One For All |
| Sharpness | 5, 10, 15, 20, 30, 40, 50 % | Enchantments |
| Critical | 10, 20, 30, 40, 50, 70, 100 Crit Damage | Enchantments |
| Dominus | Tooltip je Stufe, siehe "Dominus je Stufe" | Crimson Armor |
| Accessory Power | C 3, U 5, R 8, E 12, L 16, M 22, D 28, Special 3, Very Special 5; Hegemony doppelt | Accessory Power (früher Magical Power) |
| Multiplikator | `29.97 × ln(0.0019 × AP + 1)^1.2`, bei 250 AP 9,64 | Accessory Power, Powers |
| Powers | Shaded: CD 18, STR 4,8, dazu flach 3 AS. Strong: STR 12, CD 12, dazu flach 25 STR, 25 CD. Hurtful: STR 4,8, CD 19,2, dazu flach 15 AS (Tabellenwerte bei 250 AP geteilt durch 9,64) | Powers |
| Reforges Waffe | Fabled, Withered, Coldfused je Rarität | Reforging/Sword |
| Reforges Rüstung, Equipment | Ancient, Fierce, Renowned, Titanic, Mythic; Strengthened, Glistening, Blood-Soaked, Bloodshot | Reforging/Armor, Reforging/Equipment |
| Opal | True Defense, Perfect: C 5, U 6, R 7, E 9, L 11, M 13, keine Divine-Spalte | Gemstone |
| True Protection | +5 True Defense, Stufe I, nur Chestplate | True Protection |

## Dominus je Stufe

Geprüft am 2026-11-01 auf [Crimson Armor](https://hypixelskyblock.minecraft.wiki/w/Crimson_Armor), über den Rohtext (`?action=raw`, nur als Umschreibung abrufbar), die gerenderte Seite und die Weiterleitungen der Stufen. Alle drei stimmen überein. Bonus-Tooltip "Each Dominus stack grants ...":

| Stufe | Je Stack |
|---|---|
| Basic | 0.05 Swing Range |
| Hot | 0.1 Swing Range |
| Burning | 0.1 Swing Range, 1 Ferocity |
| Fiery | 0.1 Swing Range, 2 Ferocity |
| Infernal | 0.1 Swing Range, 2 Ferocity, 10% Damage (additive) |

**Ergebnis: Nur Infernal gibt Schaden, eine Tabelle je Stufe entfällt.** 10 Stacks und "Pieces Required: 2+" gelten für alle Stufen. Ferocity zählt gegen den Hellion Shield nicht. Die Seite sagt nicht, wie gemischte Sets zählen. Das Modell verlangt zwei Infernal-Teile.

## Abweichungen von der Spec

Freigegeben am 2026-11-01: B1 (`hit × hits/s`) und B2 bis B12. **B1 bis B4 ändern die Rangliste.**

- **B1, Score mit Attack Speed:** Dein Auftrag sagt "Score = hit", Spec 4.2 rechnet `hit × hits/s`. **Empfehlung: wie die Spec**, also Schaden pro Sekunde, Anzeige `+x % damage`. Mit reinem `hit` hätten alle Attack-Speed-Schritte 0 %. Bei reinem `hit` entfällt nur der Faktor.
- **B2, Firedust ×1,2 statt ×1,25:** Spec 4.2 nennt 1,25, das Wiki auf der Dolchseite 1,2. Es gilt das Wiki, die Spec wird korrigiert.
- **B3, Rangliste bleibt unter der Grenze aktiv:** Spec 4.3 graut die übrigen Schritte ohne Rang aus. Dein Auftrag verlangt Markieren und Kennzeichnen. Plan: Schritte, die eine verfehlte Bedingung erfüllen helfen, stehen in "Requirements first" mit Badge, die übrigen behalten ihren Rang, darüber steht ein deutlicher Warnhinweis `Below the limit`. Regel 2 der Spec bleibt: Ein Schritt, der eine erfüllte Bedingung bricht, steht in `locked` mit Grund.
- **B4, Reihenfolge in "Requirements first":** Spec sortiert nach Zugewinn pro 1M. True-Defense-Schritte haben aber oft 0 % Schaden. Daher zuerst nach Fortschritt der Bedingung pro Million (Anteil der Lücke), bei Gleichstand nach Schaden. Ohne vollen Preis ans Ende.
- **B5, nur ein Teil der Enchants bewertet:** Die Guide-Enchants teilen sich so auf:
  - Delta: `sharpness`, `critical`, `ultimate_one_for_all`, `true_protection`, dazu `growth` und `protection`, falls Task 2 die Werte auf Enchantments bestätigt.
  - `{}`, belegt ohne Schaden und ohne Bedingung: `looting`, `vampirism`, `life_steal`, `rejuvenate`.
  - `null`: `giant_killer` und `execute` skalieren mit Boss-HP, und das Wiki widerspricht sich bei Giant Killer. `thunderlord`, `fire_aspect` und `pyroclasm` nennt Spec 4.2 als nicht modelliert. `smite` hängt am Mob-Typ, den das Wiki für Demons nicht belegt. Alle übrigen Enchants und Ultimates ohne Wert ebenfalls.
- **B6, Coldfused:** Die Tabellenwerte zählen. Der Bonus "+75 Strength +55 Crit Damage while a Wisp is active" zählt nur, wenn das gewählte Pet ein Wisp ist. Withered und Ancient: der Anteil je Catacombs-Stufe zählt nicht, das Modell hat keine Catacombs-Daten.
- **B7, fehlender Dolch:** Spec 4.2 zieht ihn nach oben. Plan: Er steht in "Requirements first" mit `Dagger pair incomplete`. Bis dahin rechnet der Mittelwert nur über die vorhandene Linie.
- **B8, Pet-Schritte:** Delta aus der Tabelle in `stats.js` auf Maximalstufe (100, Golden Dragon 200), abzüglich des gewählten Pets. Fähigkeiten zählen nicht. Pet außerhalb der Tabelle: `null`. Die Zeile sagt "at max level".
- **B9, Accessories nur über die Tabelle:** Rarität aus `items.json`, Recomb +1 Stufe. Eine neue Familie bringt die volle AP, ein Ersatz die Differenz. Rift Prism und Abicase: `null`, weil Sonderregel. Basiswert ist `highest_magical_power`.
- **B10, Power-Schritte:** `power` zählt als Wechsel auf diese Power, gerechnet über `computeStats`. Der Spieler entscheidet selbst, ob er wechselt.
- **B11, Daggers und One For All:** Das Wiki sagt "any Sword" und nennt Dolche nicht. Der Guide führt den Schritt, darum rechnet das Modell damit, im UI als Estimate.
- **B12, Best possible hält die Grenze:** Ein Tausch, der True Defense unter 140 drückt, wird nicht vorgeschlagen, solange sie erfüllt ist. Waffen: je Linie der stärkste besessene Dolch.
- **Aus dem Umfang:** Thunderlord, Crimson-Swipe, Burning Vengeance, Fire Aspect, Venomous, Demonen-Phasen, Pillars (im UI genannt). Das vierte Crimson-Teil zeigt "set bonus not fully rated" (Spec 4.2).

## Review Focus

1. Zwei Dolche im Besitz, gewählt ist nur einer als `held`: Der Schritt für einen Dolch darf nicht den anderen als abgelöstes Teil ansehen (Test in Task 3).
2. Upgrade Kindlebane aus Firedust: Das alte Teil wird verbraucht, kein Wiederverkauf, auch ohne Forge-Eintrag (Test in Task 3).
3. One For All aktiv: Sharpness-Schritte zeigen 0 % mit "not used with One For All", und die Rangliste wechselt den Pfad nicht still (Test in Task 2).
4. True Defense fehlt, weil die Inventory-API aus ist: Bedingung `unknown`, Rangliste läuft mit Warnung, nichts wird gesperrt (Test in Task 4).
5. Attack Speed knapp unter einer Stufengrenze: Ein kleines Plus bringt 0 %, ein größeres springt (Test in Task 1).

---

### Task 1: Schadensmodell

**Files:**
- Create: `blaze.js`
- Modify: `sw.js`
- Test: `tests/blaze.test.js`

**Interfaces:**
- Produces: `DAGGERS = { FIREDUST_DAGGER: { line: 'ashen', m: 1.2 }, BURSTFIRE_DAGGER: { line: 'ashen', m: 1.5 }, HEARTFIRE_DAGGER: { line: 'ashen', m: 2 }, MAWDUST_DAGGER: { line: 'spirit', m: 1.5 }, BURSTMAW_DAGGER: { line: 'spirit', m: 2.5 }, HEARTMAW_DAGGER: { line: 'spirit', m: 3.5 } }`, `daggersOf(profile) -> { ashen: Item|null, spirit: Item|null }`, `additiveOf(dagger, armor, path) -> number`, `hitsPerSecond(as) -> number`, `blazeModel({ common, daggers, armor }) -> { lines, as }`, `blazeOutput(model, path?) -> number`, `activePath(daggers) -> 'guide'|'ofa'`.

- [ ] **Step 1: Failing tests schreiben**

```js
test('hit follows the wiki formula with the expected crit', () => {
  // (5 + 95) × 2 × (1 + 0.5 × 1) × (1 + 50/100) × 2
  near(hitOf({ DAMAGE: 95, STRENGTH: 100, CRITICAL_CHANCE: 50, CRITICAL_DAMAGE: 100 }, 50, 2), 900);
});
test('the dagger multipliers are the wiki values', () => {});
test('crit chance stops at 100', () => {});
test('ticks follow the wiki and hits per second is 20 over ticks', () => { assert.equal(hitsPerSecond(0), 2); assert.equal(hitsPerSecond(100), 4); });
test('a little attack speed below a step changes nothing, more jumps', () => {});
test('the output is the mean of the lines times hits per second', () => {});
test('one dagger: the mean is that line alone', () => {});
test('sharpness adds by its level, one for all adds 500 and drops the others', () => {});
test('infernal dominus adds 100 from two pieces, one piece or a lower tier adds none', () => {});
test('the active path follows a dagger with one for all', () => {});
test('daggersOf takes the highest tier owned per line', () => {});
```

- [ ] **Step 2: Test ausführen.** `node --test tests/blaze.test.js`. Erwartet: FAIL.
- [ ] **Step 3: Implementieren.** `blazeScore` in `stats.js` bleibt für `hit` ohne `A` und `M`, `blaze.js` baut darauf auf. Attack Speed kommt aus `common` plus Dolch.
- [ ] **Step 4: Test ausführen.** Erwartet: PASS.
- [ ] **Step 5: Commit** `feat: add the blaze damage model`

### Task 2: Daten und Delta für Blaze

**Files:**
- Modify: `optimizer-data.js`, `optimizer.js`, `stats.js` (`POWERS`, Pet-Werte exportieren)
- Test: `tests/optimizer.test.js`

**Interfaces:**
- Consumes: `blaze.js`.
- Produces: `stepDelta(step, loadout, profile, items, settings, guide, area = 'mining')`. Für Blaze: `{ stats, ashen?, spirit?, additive?, swap?, mp?, ofa? } | null`. `apMp(id, recomb, items) -> number`, `mpDelta(step, profile, loadout, items) -> number | null`.

- [ ] **Step 1: Failing tests schreiben**

```js
test('sharpness on both daggers raises the additive of both lines', () => {});
test('with one for all active a sharpness step gives 0 and a hint', () => {});
test('the one for all step removes the guide enchants and adds 500', () => {});
test('critical adds crit damage on the dagger it goes on', () => {});
test('an enchant without a fixed value gives null, a proven non-damage one {}', () => {});
test('a dagger upgrade replaces the stats and multiplier of its line only', () => {});
test('fabled, withered and coldfused follow the table, coldfused adds its bonus with a wisp', () => {});
test('perfect opal on a legendary piece gives 11 true defense', () => {});
test('true protection gives 5 true defense on a chestplate', () => {});
test('a new accessory family gives its full power, a replacement the difference', () => { /* E 12, Ersatz R auf L: 16 − 8 */ });
test('recomb on an accessory gives one rarity step of power', () => {});
test('hegemony counts double, rift prism gives null', () => {});
test('power gain goes through the multiplier', () => {});
test('switching power counts its stats, the three new powers follow the wiki', () => {});
test('a pet step compares max level with the picked pet, without a table null', () => {});
test('a mining step gives the same delta as before', () => {});
```

- [ ] **Step 2: Test ausführen.** Erwartet: FAIL.
- [ ] **Step 3: Daten eintragen.** Werte aus "Formel-Quellen". `growth`, `protection` und die übrigen Rüstungs-Enchants vorher auf Enchantments lesen. Opal hat keine Divine-Spalte: dort `null`. `GEMS` um `OPAL` und, falls ein Guide sie nutzt, weitere Typen erweitern.
- [ ] **Step 4: Implementieren.** `plus` filtert nicht mehr beim Rechnen, sondern am Ende je Bereich über `AREA_STATS`. Blaze-Teile zerlegen sich auf Dolchlinie oder Gemeinsames.
- [ ] **Step 5: `npm test` ausführen.** Erwartet: PASS, auch alle Mining-Tests.
- [ ] **Step 6: Commit** `feat: work out what a step adds to blaze damage`

### Task 3: Rang und Netto-Preis je Bereich

**Files:**
- Modify: `optimizer.js`
- Test: `tests/optimizer.test.js`

**Interfaces:**
- Produces: `rankUpgrades(guide, checked, ctx, loadout, settings, base, { area = 'mining', other, keepOldGear, model })`. Rückgabe zusätzlich `requirements: Row[]`, Row zusätzlich `helps: ('trueDefense'|'mp'|'dagger')[]`, `note`. `replaced` kennt Dolchlinien.

- [ ] **Step 1: Failing tests schreiben**

```js
test('blaze rows rank by damage gain per million', () => {});
test('a dagger of one line never takes the place of the other line', () => {});
test('a dagger upgrade sells nothing even without a forge recipe', () => {});
test('a look ahead works for blaze lines and a line of books', () => {});
test('a step that helps a missed limit goes to requirements with its reason', () => {});
test('requirements sort by progress on the limit per million, then damage', () => {});
test('a step that would break a met limit is locked with the reason', () => {});
test('a step that lifts a met limit further stays in the ranking', () => {});
test('the missing dagger goes to requirements as dagger pair incomplete', () => {});
test('magical power between 800 and 1100 locks nothing', () => {});
```

- [ ] **Step 2: Test ausführen.** Erwartet: FAIL.
- [ ] **Step 3: Implementieren.** Grenzen über `blazeConstraints`, 140 und 800 aus `stats.js`. Der Schritt prüft True Defense und MP vor und nach dem Delta.
- [ ] **Step 4: `npm test` ausführen.** Erwartet: PASS.
- [ ] **Step 5: Commit** `feat: rank blaze steps with their limits`

### Task 4: Modus, Vergleich, Best possible, Ausgleichswert

**Files:**
- Modify: `optimizer.js` (`bestLoadout`, `bestValueView`), `progress.js` (`ranks`), `app.js`, `style.css`
- Local only: `personal/guides/blaze-slayer.json` (`area: "blaze"`), gitignored
- Test: `tests/optimizer.test.js`, `tests/progress.test.js`

**Interfaces:**
- Consumes: alles aus Task 1 bis 3, `withOffset`, `offsetStale`.
- Produces: `bestLoadout(profile, items, loadout, base, settings, { area })`, `pathsLine(model) -> html`.

- [ ] **Step 1: Failing tests schreiben**

```js
test('the mode button shows on a guide with area blaze', () => {});
test('the row says damage, marks the estimate and shows the raw stats', () => { /* '+1.2 % damage · 0.4 %/1M' */ });
test('below a limit the page warns and shows both values', () => { /* 'Below the limit', True Defense und MP mit Stand und Grenze */ });
test('magical power under the target of 1100 is a note only', () => {});
test('a missing value shows unknown with a warning and ranks on', () => {});
test('the path line compares enchants and one for all', () => { /* 'Enchants: ×a · One For All: ×b · One For All leads by z %' */ });
test('the active path is named and never changes by itself', () => {});
test('the offset moves the blaze base, also in the requirements', () => {});
test('best possible keeps true defense at the limit', () => {});
test('best possible does not list a dagger swap between the lines', () => {});
test('the page names what the model leaves out', () => {});
test('the fourth crimson piece says set bonus not fully rated', () => {});
test('names and reasons are escaped', () => {});
test('the mining view stays as it was', () => {});
test('the real blaze guide ranks without error', { skip: !hasFixtures }, () => { /* nur Anzahlen */ });
```

- [ ] **Step 2: Test ausführen.** Erwartet: FAIL.
- [ ] **Step 3: Implementieren.** Reihenfolge: Grenzen und Warnhinweis, Pfad-Vergleich, Best possible, "Requirements first", `Best value`, `Locked`, `No price`, `No gain data`, `No damage gain`. Die Kopfzeile sagt "Estimate".
- [ ] **Step 4: Guide lokal ändern.** `area: "blaze"` in die JSON-Datei, per grep prüfen. Kein Commit dafür.
- [ ] **Step 5: `npm test` ausführen.** Erwartet: PASS.
- [ ] **Step 6: Commit** `feat: add the Best value mode for Blaze`

### Task 5: Changelog 0.14.0, Abschluss

**Files:**
- Modify: `changelog.json`, `docs/spec-optimizer.md`
- Test: `tests/onboarding.test.js`, `tests/sw.test.js`

- [ ] **Step 1: Changelog** `0.14.0`, Einträge mit `"personal": true`: Blaze-Rangliste, Grenzen, Vergleich.
- [ ] **Step 2: Spec nachziehen.** 4.2: Firedust ×1,2 und Stand der Quellen. 4.3: B3 und B4. 5.4: Abdeckung.
- [ ] **Step 3: `npm test` ausführen.** Erwartet: alle PASS.
- [ ] **Step 4: Abdeckung melden.** Aus dem echten Guide nur Anzahlen je Gruppe in den Abschlussbericht.
- [ ] **Step 5: Commit** `feat: release the blaze ranking (0.14.0)`. Nicht pushen.

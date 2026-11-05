# Bazaar Flip Helper V6 Implementation Plan

**Goal:** Die Vorschläge aus `docs/ux-audit.md` umsetzen: Einstellungen entwirren, Touren umbauen, einmalige Kontext-Hinweise, „How it works“ zum Aufklappen, Einfach- und Profi-Modus.

**Architecture:** Keine neue Datei, die die App lädt. Texte und Entscheidungen bleiben in `onboarding.js` (rein, in Node getestet), die Verdrahtung in `tour.js`. `render.js` markiert Profi-Elemente mit der Klasse `pro`; eine CSS-Regel blendet sie im Einfach-Modus aus. `app.js` kennt den Modus, die Tab-Liste je Modus und meldet, welche Hinweise gerade passen.

**Tech Stack:** unverändert (Vanilla JS, CSS, `node --test`, Capacitor, Gradle).

**Spec:** `docs/ux-audit.md`, Abschnitt 4.

## Global Constraints

- Flip- und Bewertungslogik bleibt, mit einer Ausnahme: `portfolio()` in `flips.js` (Task 0). `AlertLogic.java` kennt kein Portfolio und bleibt unverändert.
- Texte englisch. Farben nur über Tokens; Kontrasttest bleibt grün.
- Tests nur mit Fixtures, kein API-Aufruf.
- Commits auf Branch `v6`, kein Push.
- Changelog 6.0.0 mit höchstens vier Einträgen.

## Review Focus

1. Ein neuer Nutzer darf beim zweiten Start nicht als Bestandsnutzer gelten: Modus und `bt.hints` werden beim ersten Start geschrieben. Task 2 und 4.
2. Im Einfach-Modus führt kein Weg auf einen ausgeblendeten Tab (Wischen, Adresse, Tour). Task 4.
3. Ein Hinweis blockiert nie und erscheint nie zusammen mit Tour oder Fenster. Task 2.
4. Das Portfolio ohne `maxCapital` (0 oder nicht gesetzt) rechnet wie bisher. Task 0.

---

### Task 0: Einstellungen entwirren

**Files:** `flips.js`, `index.html`, `render.js`, `tests/flips.test.js`.

- `portfolio()`: Budget je Flip = `min(capital / slots, maxCapital)`; `maxCapital` 0 heißt keine Grenze.
- Beschriftungen: „Min. volume/week (Flips & NPC)“, „Min. margin % (Opportunities)“, „Min. volume/week (Opportunities)“, „Min. margin % (Favorite alerts)“. Hilfetexte von „Max. capital per flip“ und Portfolio nennen das Zusammenspiel.
- [ ] Test: Obergrenze greift, 0 greift nicht.

### Task 1: Touren

**Files:** `onboarding.js`, `tour.js`, `tests/onboarding.test.js`.

- Basis-Tour: A flip, Two numbers, Badges, Opportunities, Find, sort, favorites, Settings and help.
- Ablauf: Welcome → Basis-Tour → Setup. „Skip“ im Welcome und in der Tour zeigt einmal `setupOfferHtml()`.
- Advanced-Tour: Trends, Event radar, Portfolio, Forge, Alerts (nur Android). Angebot nur beim Wechsel auf Profi; `advancedOfferHtml(count)` nennt die echte Zahl.
- [ ] Tests: Titel, Reihenfolge, Zahl je Plattform, Angebotstexte.

### Task 2: Kontext-Hinweise

**Files:** `onboarding.js`, `tour.js`, `app.js`, `style.css`, Tests.

- `HINTS`: 13 IDs mit Text, Anker und Position. `hintHtml(id, opts)`, `pickHint(candidates, seen)`.
- `tour.js`: `bt.hints` lesen und schreiben, `refreshHints()` setzt den ersten passenden, ungesehenen Hinweis an seinen Anker. Tour-Stationen tragen ihre Hinweis-ID als gesehen ein.
- `app.js`: `hintsNow()` liefert die Kandidaten für den aktuellen Bildschirm.
- Bestandsnutzer starten mit allen Hinweisen als gesehen. „Show hints again“ im Hilfe-Fenster.
- [ ] Tests: Auswahl, Texte, Suspicious-Regeln, Bestandsnutzer.

### Task 3: How it works

**Files:** `onboarding.js`, `style.css`, Tests.

- Jeder Begriff ein `<details>`. Neu: What a flip is, Suspicious, Favorites, Portfolio, NPC flips, Craft flips, Volume per week; Events mit Dreier-Regel; Forge gekürzt.
- [ ] Test: Abschnitte vorhanden, Einfach-Modus zeigt nur die einfachen.

### Task 4: Einfach und Profi

**Files:** `index.html`, `app.js`, `render.js`, `onboarding.js`, `tour.js`, `style.css`, Tests.

- `settings.mode`; neue Nutzer `simple`, Bestandsnutzer `pro`. Umschalter und „Start setup“ oben in den Einstellungen.
- Klasse `pro` an Tabs, Radar, Karten-Feldern, Badges, Einstellungen; `[data-mode="simple"] .pro { display: none }`.
- `swipeTab` und `dragOffset` nehmen die Tab-Liste als Argument. Adresse eines Profi-Tabs führt im Einfach-Modus auf Flips.
- Im Einfach-Modus folgt „Max. capital per flip“ dem Total capital; Setup und Hilfe lassen Profi-Teile weg.
- Wechsel auf Profi bietet einmal die Advanced-Tour an.
- [ ] Tests: Klassen in Karten, Tab-Liste, Setup ohne Forge-Fragen.

### Task 5: Abschluss

- `changelog.json` 6.0.0, `DECISIONS.md`, `SUMMARY.md`.
- `node --test`, Gradle-Unit-Tests, Browser bei 360 px und Desktop mit Screenshots (Tour, Hinweise, beide Modi), `npm run android:build`.

# Bazaar Flip Helper V4 Implementation Plan

**Goal:** Willkommen, geführte Tour, Einrichtungs-Assistent und ein What's-new-System, ohne die Bewertungslogik anzufassen.

**Architecture:** `onboarding.js` enthält die reine Logik (Versionen, Startverhalten, Assistent, Tour-Stationen) und baut HTML-Strings; es ist in Node getestet. `tour.js` verdrahtet das mit dem DOM: ein `<dialog>` für Fenster, ein Overlay mit „Loch“ für das Spotlight. `changelog.json` ist die einzige Quelle für Version und Neuigkeiten.

**Tech Stack:** unverändert (Vanilla JS, CSS, `node --test`, Capacitor, Gradle).

**Spec:** `docs/spec-v4.md`

## Global Constraints

- Keine Änderung an `flips.js`, `npc.js`, `craft.js`, `history.js`, `AlertLogic.java`, `AlertWorker.java`.
- Texte englisch. Farben nur über die vorhandenen Tokens; Kontrasttest bleibt grün.
- Speicher-Schlüssel `bt.onboarding` = `{ done, version }`.
- Tests ohne Netz. Für Screenshots dient eine lokale Kopie der App, die gespeicherte API-Antworten lädt.
- Commits auf Branch `v4` (aufbauend auf `slide`), kein Push.

## Review Focus

1. Gelöschter Speicher verhält sich wie ein neuer Nutzer; kaputter Zustand führt nie zu einem Fehler. Tests in Task 1.
2. Mehrere übersprungene Versionen: alle Einträge erscheinen, neueste zuerst. Test in Task 1.
3. Ziel-Element fehlt (keine Daten, anderer Tab): Tour läuft weiter, Blase mittig. Task 3, Sichtprüfung.
4. `changelog.json` nicht ladbar: App startet normal, kein Fenster. Task 3.
5. Jede Datei, die die App lädt, steht in `SHELL` (sonst fehlt sie in der APK). Bestehender Test, erweitert in Task 3.

---

### Task 1: Logik und Changelog

**Files:** `changelog.json`, `onboarding.js`, `tests/onboarding.test.js`.

- `compareVersions(a, b)`, `currentVersion(log)`, `newsSince(log, version)`
- `startupAction(state, log, hadData) → { type: 'welcome' | 'tourOffer' | 'whatsNew' | 'none', current, news? }`
- `setupResult({ capital, activity, style }, slots) → [{ key, value, label, shown, reason }]`
- `tourSteps({ native, firstId }) → [{ title, text, target, route?, open? }]`
- HTML: `welcomeHtml()`, `newsHtml(versions, { offerTour, history })`, `setupFormHtml(defaults)`, `setupSummaryHtml(result)`, `bubbleHtml(step, index, count)`
- [ ] Tests laut Spec, alle mit Fixtures.

### Task 2: Fenster, Spotlight, Einbindung

**Files:** `tour.js`, `index.html`, `style.css`, `app.js`, `sw.js`.

- `<dialog id="sheet">` für Willkommen, What's new, Assistent; Overlay `#tour` mit `#tour-hole` und `#tour-bubble`.
- `initOnboarding({ native, ready, slots, apply })` aus `app.js`.
- Gruppe „Help“ in den Einstellungen; „?“-Buttons; Version in der Fußzeile.
- `SHELL` um `onboarding.js`, `tour.js`, `changelog.json` erweitern.

### Task 3: Android-Version, README, CLAUDE.md

**Files:** `android/app/build.gradle`, `README.md`, `CLAUDE.md`, `tests/sw.test.js`.

- `versionName` und `versionCode` aus `changelog.json`.
- Regel in `CLAUDE.md`: bei jedem Feature-Update Version erhöhen und Eintrag anlegen.

### Task 4: Prüfen und abschließen

- [ ] `node --test`, `gradlew testDebugUnitTest`, `npm run android:build`.
- [ ] Screenshots von Willkommen, jeder Tour-Station, Assistent und What's new bei 360 px und 1440 px ansehen, Fehler beheben.
- [ ] `SUMMARY.md` mit Testliste.

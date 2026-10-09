# Bazaar Flip Helper V3 Implementation Plan

**Goal:** Verlässlichere Kennzahlen (Orderbuch-Tiefe, Median-Regel, provisional) und ein überarbeitetes Design in Schwarz/Orange mit Desktop-Layout.

**Architecture:** Der Snapshot-Workflow liefert pro Item Score, Median und Verlaufsdauer in `stats.json`. `flips.js` und `AlertLogic.java` rechnen identisch und bekommen diese Kennzahlen als Eingabe. Die Oberfläche bleibt ohne Build-Schritt; `render.js` baut HTML, `chart.js` SVG.

**Tech Stack:** unverändert (Vanilla JS, CSS, Node-Tests, Capacitor 8, Java, JUnit).

**Spec:** `docs/spec-v3.md`

## Global Constraints

- Konstanten in `flips.js` und `AlertLogic.java` gleich: `MEDIAN_SPIKE = 0.3`, `PROVISIONAL_HOURS = 24`, `STABLE = 70`. (`DEPTH_UNITS` wurde vor dem Merge wieder entfernt, siehe `DECISIONS.md`.)
- Oberfläche englisch, Zahlenformat wie bisher (`coins`, `percent`).
- Farben: `#0D0D0D`, `#1A1A1A`, Akzent `#FF8A00`; Kontrast mindestens 4,5 : 1.
- Kein Name außer „Tsaitunq“ in Dateien, Commits, APK.
- Commits auf Branch `v3`, kein Push.

## Review Focus

1. Order ohne Menge oder leeres Buch: kein `NaN`, Rückfall auf die oberste Order bzw. kein Preis. Tests in Task 1.
2. `stats.json` fehlt oder Item fehlt darin: keine Badges bzw. „provisional“, kein Absturz, nichts in Opportunities. Tests in Task 2.
3. Median vorhanden, Preis genau an der Schwelle: nicht suspicious (strikt größer). Tests in Task 2 und 3.
4. Ältere installierte App liest weiter `scores.json`. Test in Task 1 (Datei wird weiter geschrieben).
5. Orange Akzent darf nie „Verlust“ oder „Warnung“ bedeuten. Sichtprüfung und Kontrasttest in Task 5 und 7.

---

### Task 1: Tiefe und Kennzahlen im Datenpfad

**Files:** `flips.js`, `history.js`, `scripts/snapshot.mjs`, Tests dazu.

- `depthPrice(orders) → number` (`NaN` ohne Orders) in `flips.js`; `bookPrices` nutzt sie für beide Seiten.
- `median(values)` und `itemStats(points) → [score, medianSell, hours]` in `history.js`.
- `runSnapshot` schreibt `stats.json` (`{ t, i }`) zusätzlich zu `scores.json`.
- [ ] Tests: 10 × 100 + 990 × 90 → 90,1; 500 × 10 + 2000 × 20 → 15; Buch mit 3 Stück → Durchschnitt der 3; Order ohne Menge → oberste; `median([3, 1, 2]) = 2`, `median([1, 2, 3, 4]) = 2,5`; `itemStats` für 13 Punkte über 4 h; Snapshot-Test prüft `stats.json` und `scores.json`.

### Task 2: Median-Regel und provisional (Web)

**Files:** `flips.js`, `npc.js`, `craft.js`, `data.js`, Tests.

- `statOf(stats, id) → { score, median, provisional }`; `computeFlip(…, median)`; `buildFlips`, `opportunities`, `npcFlips`, `craftFlips` nehmen `stats` statt `scores`.
- `loadStats()` in `data.js` (bei Fehler `null`).
- [ ] Tests: Sell 131 bei Median 100 → suspicious, 130 → nicht; ohne Median nicht; 23,9 h → provisional und Score `null`; 24 h → Score; fehlender Eintrag → provisional; `stats = null` → nichts provisional; Opportunities schließt provisional aus.

### Task 3: Dieselbe Logik in Java

**Files:** `AlertLogic.java`, `AlertWorker.java`, `AlertLogicTest.java`.

- `depthPrice` im Parser, `readStats`, `flip(…, median)`, `opportunities(…, stats)`; Worker lädt `stats.json`.
- [ ] Tests mit denselben Zahlen wie Task 1 und 2.

### Task 4: Oberfläche an die Kennzahlen anschließen

**Files:** `app.js`, `render.js`, Tests.

- `stats` ersetzt `scores` im Zustand; Badge „provisional“; „normal: X“ auf Karte und Detailseite; Leertexte im Tab „Opportunities“.

### Task 5: Design

**Files:** `style.css`, `index.html`, `render.js`, `app.js`, Tests.

- Farb-Tokens, Kartenhierarchie, Raster ab 900 px, SVG-Icons, gruppierte Einstellungen mit Erklärungen, Name in der Überschrift.
- [ ] Test `tests/contrast.test.js`: liest die Tokens aus `style.css` und prüft jede benutzte Vordergrund-Hintergrund-Kombination auf ≥ 4,5 : 1.

### Task 6: Charts

**Files:** `chart.js`, `app.js`, `style.css`, Tests.

- Hilfslinien mit Werten; `nearestIndex(times, t)`; Zeiger und Anzeige der Werte bei `pointermove` / `pointerdown`.

### Task 7: Icon, Splash, Systemfarben, Abschluss

**Files:** `scripts/icons.mjs` (ersetzt `scripts/android-icons.mjs`), Icons, `manifest.webmanifest`, Android-Ressourcen, `capacitor.config.json`.

- [ ] Screenshots 360 px und 1440 px ansehen, Fehler beheben.
- [ ] `node --test`, `gradlew testDebugUnitTest`, `npm run android:build`.
- [ ] `SUMMARY.md`.

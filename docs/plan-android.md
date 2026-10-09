# Bazaar Flip Helper (Android) Implementation Plan

**Goal:** Debug-APK der bestehenden PWA mit Hintergrund-Benachrichtigungen für Favoriten.

**Architecture:** Capacitor 8 bettet die unveränderten Web-Dateien ein (`www/` als Kopie). Ein lokales Capacitor-Plugin (`BazaarAlerts`, Java) speichert Einstellungen und Favoriten in `SharedPreferences` und plant einen WorkManager-Auftrag; der Worker lädt die Bazaar-API und meldet Favoriten, die die Mindestmarge neu überschreiten. Die Rechenlogik liegt in einer reinen Java-Klasse mit JUnit-Tests.

**Tech Stack:** Capacitor 8.5, Java 21 (Temurin), Android Gradle Plugin der Capacitor-Vorlage, WorkManager, Gson (nur Stream-Parser), JUnit 4.

**Spec:** `docs/spec-android.md`

## Global Constraints

- App-Name `Bazaar Flip Helper`, Paket-ID `com.tsaitunq.bazaarflip`.
- Kein echter Name in Code, Metadaten, Signatur.
- Web-Code bleibt ohne Build-Schritt und läuft im Browser wie bisher; `node --test` bleibt grün.
- Farben: Hintergrund `#0f1115`, Gold `#f2b94b`, dunkles Gold `#b07a1e`.
- Commits auf Branch `android`, kein Push.

## Review Focus

1. In der App ist der Host `localhost`: Verlaufsdaten müssen trotzdem von GitHub kommen. Test in Task 2.
2. Favorit ohne Orderbuch-Seite oder nicht in der Antwort: wird übersprungen, kein Absturz. Test in Task 3.
3. Benachrichtigung nur beim Überschreiten, nicht alle 15 Minuten. Test in Task 3.
4. Berechtigung abgelehnt: Schalter bleibt aus, kein geplanter Auftrag. Task 5, Code-Pfad.
5. Kein persönlicher Name in der APK. Prüfung in Task 7.

---

### Task 1: Werkzeuge

- [ ] JDK 21, Android SDK (Kommandozeilen-Tools, `platform-tools`, Plattform und Build-Tools laut Capacitor-Vorlage), Android Studio per winget.
- [ ] `JAVA_HOME` und `ANDROID_HOME` für die Builds setzen; `android/local.properties` mit `sdk.dir` (nicht eingecheckt).

### Task 2: Capacitor-Projekt

**Files:** Create `capacitor.config.json`, `scripts/copy-web.mjs`, `android/` (über `cap add android`). Modify `package.json`, `.gitignore`, `data.js`, `tests/data.test.js`, `app.js`.

- `copyWeb(root, out)` in `scripts/copy-web.mjs`: liest `SHELL` aus `sw.js`, kopiert diese Dateien (ohne `./`) und den ganzen Ordner `icons/` nach `out`, leert `out` vorher.
- `dataUrl(hostname, protocol)`: `./data/` nur bei `protocol === 'http:'` und Host `localhost` oder `127.0.0.1`; sonst die raw-URL.
- `app.js`: Service Worker nur registrieren, wenn nicht nativ (`window.Capacitor?.isNativePlatform?.()`).
- [ ] Tests: `dataUrl('localhost', 'https:')` → raw-URL; `dataUrl('localhost', 'http:')` → `./data/`; `copyWeb` in ein temporäres Verzeichnis: `index.html`, `app.js`, `icons/icon-192.png` vorhanden, `sw.js`, `tests`, `node_modules` nicht.
- [ ] `npx cap add android`, `npm run android:sync`, erster `gradlew assembleDebug` läuft durch. Commit.

### Task 3: Alarm-Logik (Java, rein)

**Files:** Create `android/app/src/main/java/com/tsaitunq/bazaarflip/AlertLogic.java`, `android/app/src/test/java/com/tsaitunq/bazaarflip/AlertLogicTest.java`. Modify `android/app/build.gradle` (Gson, WorkManager).

- `static Map<String, double[]> readPrices(Reader json, Set<String> ids)` – Stream über `products`; je ID `[buyOrder, sellOffer]` aus `sell_summary[0].pricePerUnit` und `buy_summary[0].pricePerUnit`; fehlt eine Seite, fehlt die ID. Wirft `IOException` bei `success != true`.
- `static double margin(double buy, double sell, double tax)`
- `static Set<String> above(Map<String, double[]> prices, double tax, double minMargin)`
- `static Set<String> crossed(Set<String> aboveNow, Set<String> aboveBefore)` – jetzt drüber, vorher nicht.
- `static String title(int count, double minMarginPercent)` und `static String line(String name, double margin)` – deutsche Texte, Prozent mit einer Nachkommastelle und Komma.
- [ ] Tests: buy 100 / sell 200 / Steuer 0,0125 → 0,975; `readPrices` mit zwei Produkten, einem ohne `buy_summary`, einem nicht angefragten → nur das vollständige angefragte; `success: false` → `IOException`; `above` mit Schwelle 0,05; `crossed({A,B}, {A})` → `{B}`; `title(2, 5)` → `2 Favoriten über 5 % Marge`, `title(1, 7.5)` → `1 Favorit über 7,5 % Marge`; `line("Enchanted Diamond", 0.1234)` → `Enchanted Diamond: 12,3 %`.
- [ ] `gradlew testDebugUnitTest` grün. Commit.

### Task 4: Plugin, Worker, Benachrichtigung

**Files:** Create `AlertsPlugin.java`, `AlertWorker.java`. Modify `MainActivity.java`, `AndroidManifest.xml`.

- `AlertsPlugin` (`@CapacitorPlugin(name = "BazaarAlerts")`, Berechtigungs-Alias `notifications` → `POST_NOTIFICATIONS`):
  - `configure({ enabled, minMargin, tax, favs: [{ id, name }] })` – `minMargin` und `tax` als Bruch. Speichert in `SharedPreferences` `alerts`; plant bei `enabled` und mindestens einem Favoriten den Auftrag (`enqueueUniquePeriodicWork("bazaar-alerts", UPDATE, 15 min, Netz nötig)`), sonst `cancelUniqueWork`.
  - `requestPermission()` → `{ granted }`. Unter Android 13 immer `true`.
- `AlertWorker`: liest Einstellungen, lädt die API (Timeout 30 s), `readPrices` → `above` → `crossed` gegen gespeicherten Stand, speichert neuen Stand, zeigt bei Treffern eine Benachrichtigung (Kanal `flips`, Tipp öffnet `MainActivity`). `IOException` → `Result.retry()`.
- Manifest: `POST_NOTIFICATIONS`.
- [ ] `gradlew assembleDebug testDebugUnitTest` grün. Commit.

### Task 5: Einstellungen in der Web-Oberfläche

**Files:** Create `native.js`, `tests/native.test.js`. Modify `app.js`, `index.html`, `style.css`, `sw.js` (SHELL), `tests/sw.test.js` bleibt gültig.

- `native.js`:
  - `alertConfig(settings, favs, names) → { enabled, minMargin, tax, favs: [{ id, name }] }` (rein; Brüche aus Prozent, Namen mit `fallbackName`)
  - `plugin()` → das Plugin-Objekt oder `null` im Browser
  - `syncAlerts(settings, favs, names)` – ruft `configure`, tut im Browser nichts
  - `requestAlertPermission() → Promise<boolean>`
- `index.html`: in `#settings` ein Bereich `#alert-settings` (versteckt, wenn nicht nativ) mit Checkbox `#alerts` und Zahlenfeld `#alertMargin` (0,1–1000, Schritt 0,1) sowie Hinweiszeile `#alert-hint`.
- `app.js`: Standardwerte `alerts: false`, `alertMargin: 5`; beim Einschalten erst Berechtigung, bei Ablehnung zurück auf aus mit Hinweis „Benachrichtigungen sind in den Android-Einstellungen für diese App blockiert.“; `syncAlerts` nach Start, nach Laden der Namen, nach Änderung von Einstellungen oder Favoriten.
- [ ] Tests: `alertConfig({ alerts: true, alertMargin: 5, tax: 1.25 }, new Set(['ENCHANTMENT_SHARPNESS_7']), {})` → `{ enabled: true, minMargin: 0.05, tax: 0.0125, favs: [{ id: 'ENCHANTMENT_SHARPNESS_7', name: 'Sharpness 7' }] }`; `syncAlerts` ohne Plugin wirft nicht.
- [ ] `node --test` grün; im Browser: Bereich unsichtbar, V2 unverändert. Commit.

### Task 6: Icon, Splash, Dark Mode

**Files:** Create `scripts/android-icons.mjs`. Modify Ressourcen unter `android/app/src/main/res/`, `capacitor.config.json`.

- [ ] Skript erzeugt `ic_launcher.png`, `ic_launcher_round.png`, `ic_launcher_foreground.png` in fünf Dichten (Münze im sicheren Bereich des adaptiven Icons); Hintergrundfarbe `#0f1115` als Ressource.
- [ ] Splash über Theme: `windowSplashScreenBackground` `#0f1115`, Icon = Vordergrund; die Splash-PNGs der Vorlage entfernen.
- [ ] Theme dunkel: Fenster-, Status- und Navigationsleistenfarbe `#0f1115`, keine hellen Leisten.
- [ ] Build grün. Commit.

### Task 7: Debug-APK prüfen

- [ ] `npm run android:build` fehlerfrei.
- [ ] `aapt2 dump badging`: Paket `com.tsaitunq.bazaarflip`, Label `Bazaar Flip Helper`, Berechtigungen.
- [ ] `apksigner verify --print-certs`: `CN=Android Debug`.
- [ ] APK entpacken und nach Benutzer- und Klarnamen suchen: 0 Treffer.
- [ ] Wenn ein Emulator verfügbar ist: installieren, starten, Screenshot.

### Task 8: Dokumentation

- [ ] `SUMMARY.md`: Pfad zur APK, Installation per Datei und per USB, Testliste, offene Punkte.

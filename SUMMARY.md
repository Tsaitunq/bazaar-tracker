# Bazaar Flip Helper (Android) – Zusammenfassung

Stand: 2026-10-09. Alles liegt auf dem lokalen Branch `android` (6 Commits vor
`main`). Nichts ist gepusht. Die Zusammenfassung von Version 2 liegt jetzt in
`docs/summary-v2.md`.

## Die APK

```
android\app\build\outputs\apk\debug\app-debug.apk
```

Der Pfad ist relativ zum Projektordner.

- 8,0 MB, Paket-ID `com.tsaitunq.bazaarflip`, Name „Bazaar Flip Helper“,
  Version 1.0, läuft ab Android 7 (API 24).
- Signiert mit dem Standard-Debug-Schlüssel (`CN=Android Debug`).
- Die APK ist nicht eingecheckt. Neu bauen: `npm run android:build`.

## Installation aufs Handy

### Per Datei

1. APK aufs Handy bringen (USB-Kabel als Dateiübertragung, Cloud, Mail an dich
   selbst).
2. Am Handy die Datei im Dateimanager antippen.
3. Android fragt, ob diese App (Dateimanager oder Browser) unbekannte Apps
   installieren darf: „Einstellungen“ → „Dieser Quelle vertrauen“ erlauben,
   zurück, „Installieren“.
4. Meldet Play Protect „Unbekannter Entwickler“: „Trotzdem installieren“.

### Per USB

1. Am Handy: Einstellungen → Über das Telefon → siebenmal auf „Build-Nummer“
   tippen. Dann Einstellungen → System → Entwickleroptionen →
   „USB-Debugging“ einschalten.
2. Handy per USB anschließen, die Abfrage „USB-Debugging zulassen?“ bestätigen.
3. In PowerShell im Projektordner:

```
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r "android\app\build\outputs\apk\debug\app-debug.apk"
```

`devices` muss dein Gerät mit dem Status `device` zeigen; `install` endet mit
`Success`.

## Fertig

| Nr. | Punkt | Stand |
|---|---|---|
| 0 | Werkzeuge | JDK 21, Android SDK (Plattform 36, Build-Tools 36.0.0), Emulator, Android Studio installiert |
| 1 | PWA per Capacitor 8 eingebettet, derselbe Web-Code | fertig |
| 2 | Hintergrund-Check alle 15 Min mit Benachrichtigung, Schalter und Mindestmarge, Berechtigungsabfrage | fertig |
| 3 | App-Icon, Splashscreen, dunkles Theme | fertig |
| 4 | `gradlew assembleDebug` | läuft fehlerfrei |

Kern-Dateien: `capacitor.config.json`, `native.js`, `scripts/copy-web.mjs`,
`scripts/android-build.mjs`, `scripts/android-icons.mjs` und unter
`android/app/src/main/java/com/tsaitunq/bazaarflip/` die Klassen
`MainActivity`, `AlertsPlugin`, `AlertWorker`, `AlertLogic`.

## Wie geprüft wurde

- `node --test`: 65 Tests grün (vorher 60).
- `gradlew testDebugUnitTest`: 7 Java-Tests grün (Preise auslesen, Marge,
  Schwelle, Überschreitung, Texte).
- APK: Paket-ID, Name und Berechtigungen per `aapt2`, Signatur per
  `apksigner`, Suche nach Windows-Benutzername und Klarnamen in allen 451
  Dateien der APK: 0 Treffer.
- Im Emulator (Android 15, Pixel 6):
  - App startet mit Splash (Münze auf dunklem Grund), lädt die Flip-Liste mit
    Bildern, Statusleiste dunkel, nichts verdeckt.
  - Favorit gesetzt, Schalter eingeschaltet: Berechtigungsdialog erscheint.
    „Nicht zulassen“ → Schalter bleibt aus, Hinweistext erscheint. Erneut
    eingeschaltet und zugelassen → der Hintergrund-Lauf meldete `SUCCESS` und
    die Benachrichtigung „1 Favorit über 5 % Marge – Fine Ruby Gemstone:
    117,7 %“ erschien.
  - Einstellungen und Favorit überleben einen Neustart der App; der
    Hintergrund-Auftrag ist danach und nach einer Neuinstallation weiter
    eingeplant.
  - Detailseite zeigt Charts mit echten Daten aus dem Branch `data`.
  - Zurück-Taste: von der Detailseite zur Liste, von der Liste aus der App.
- Die PWA im Browser läuft unverändert; der neue Einstellungsbereich ist dort
  unsichtbar.

Dabei gefunden und behoben: Die Zurück-Taste schloss die App auch auf der
Detailseite.

## Nicht geprüft

- **Kein echtes Handy.** Alles lief nur im Emulator.
- **Wiederholter Lauf:** Dass ein zweiter Lauf für denselben Favoriten nicht
  erneut meldet, ist nur per Unit-Test belegt. Den zweiten Lauf konnte ich im
  Emulator nicht erzwingen (WorkManager verschob ihn auf das nächste
  15-Minuten-Fenster).
- Verhalten über Stunden, im Stromsparmodus und nach einem Geräte-Neustart.
- Tipp auf die Benachrichtigung öffnet die App: nicht angetippt.
- Hersteller mit eigener Akku-Verwaltung (Xiaomi, Huawei, Samsung, OnePlus)
  beenden Hintergrund-Aufträge oft trotzdem.
- Android-Versionen unter 15.

## Testliste

1. APK installieren, App öffnen: Splash, dann die Liste. Tabs Flips, NPC,
   Craft und eine Detailseite durchgehen.
2. Zwei bis drei Favoriten setzen. Einstellungen (Zahnrad) → „Benachrichtigung
   bei Favoriten“ einschalten → Berechtigung zulassen.
3. Mindestmarge so wählen, dass mindestens ein Favorit darüber liegt (die
   Marge steht auf jeder Karte). Innerhalb weniger Sekunden sollte die erste
   Benachrichtigung kommen.
4. Benachrichtigung antippen: Die App öffnet sich.
5. App schließen (aus der Übersicht wischen), Handy weglegen. In den nächsten
   Stunden darf für dieselben Favoriten **keine** weitere Meldung kommen.
6. Mindestmarge senken, sodass ein weiterer Favorit darüber liegt: Beim
   nächsten Lauf (bis zu 15 Minuten, im Stromsparmodus länger) kommt eine
   Meldung nur für diesen.
7. Schalter aus: keine Meldungen mehr. Wieder an: aktuelle Treffer werden
   einmal gemeldet.
8. Berechtigung in den Android-Einstellungen entziehen, Schalter einschalten:
   Der Schalter springt zurück, der rote Hinweis erscheint.
9. Handy neu starten, App **nicht** öffnen: Meldungen kommen weiterhin (Test
   wie in Schritt 6 vorbereiten).
10. Zurück-Taste oder Zurück-Geste auf der Detailseite: zurück zur Liste.

## Offene Punkte

- **Android Studio ist installiert, aber noch nie gestartet.** Für den Build
  brauchst du es nicht. Beim ersten Start klickst du im Assistenten:
  1. „Do not import settings“ → OK
  2. Datenfreigabe: „Don't send“
  3. Welcome → Next
  4. Install Type: „Standard“ → Next
  5. Verify Settings: Der SDK-Pfad muss
     `%LOCALAPPDATA%\Android\Sdk` (ausgeschrieben) zeigen (dort liegt das SDK
     schon) → Next
  6. License Agreement: links jede Lizenz anklicken, jeweils „Accept“ → Finish
  7. Projekt öffnen: „Open“ → Ordner
     `android`
- Die Android-SDK-Lizenzen habe ich für den Kommandozeilen-Build per
  `sdkmanager --licenses` in deinem Namen angenommen.
- Der Hinweis bei abgelehnter Berechtigung sagt immer „in den
  Android-Einstellungen blockiert“, auch wenn du nur einmal „Nicht zulassen“
  getippt hast und der Dialog beim nächsten Versuch nochmal käme.
- Die App aktualisiert sich nicht von selbst. Änderungen am Web-Code kommen
  erst mit einer neu gebauten APK an.
- Keine Release-Signatur. Für eine Weitergabe an andere oder den Play Store
  braucht es einen eigenen Schlüssel; ein Wechsel des Schlüssels erfordert
  eine Deinstallation (Favoriten gehen dabei verloren).
- Der Check meldet nur Bazaar-Flips von Favoriten, mit einer gemeinsamen
  Schwelle. NPC- und Craft-Flips werden nicht überwacht.
- Wird `android` nach `main` gemergt, liegt auch `android/` im öffentlichen
  Repo und auf GitHub Pages (als Quelltext, ohne Wirkung auf die PWA).
- Platzbedarf der Werkzeuge: rund 9 GB (SDK und Emulator). Der Emulator lässt
  sich mit `sdkmanager --uninstall "emulator" "system-images;android-35;google_apis;x86_64"`
  und Löschen von `%USERPROFILE%\.android\avd` wieder entfernen.

## Nachtrag: Oberfläche auf Englisch

Seit der Umstellung sind alle Texte in PWA und App englisch. Die
Benachrichtigung lautet jetzt z. B. „1 favorite above 5% margin“, der
Schalter „Notify me about favorites“. Die Testliste oben gilt unverändert.

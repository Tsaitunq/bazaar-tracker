# Bazaar Flip Helper – Spec Android-App

Datum: 2026-10-09. Baut auf Version 2 der PWA auf (`docs/spec-v2.md`).
Entscheidungen mit Begründung: `DECISIONS.md`, Abschnitt „Android-App“.

## Ziel

Die bestehende PWA als installierbare Android-App (APK), ohne den Web-Code neu
zu schreiben. Zusätzlich das, was eine PWA nicht kann: ein Hintergrund-Check,
der bei lohnenden Favoriten eine Benachrichtigung schickt.

## Rahmen

- App-Name **Bazaar Flip Helper**, Paket-ID **`com.tsaitunq.bazaarflip`**.
- Capacitor 8 (Android): die Web-Dateien werden unverändert in die App kopiert.
- Kein echter Name in Code, Metadaten oder Signatur. Debug-Signatur mit dem
  Standard-Debug-Keystore von Android (`CN=Android Debug`).
- Die PWA auf GitHub Pages läuft unverändert weiter; Web-Code verhält sich im
  Browser wie bisher.
- minSdk, compileSdk und targetSdk: Vorgaben der Capacitor-8-Vorlage.

## 1. Einbettung

- `scripts/copy-web.mjs` kopiert die App-Dateien (dieselbe Liste wie `SHELL`
  im Service Worker, plus alle Icons) nach `www/`. `www/` ist nicht
  eingecheckt.
- `capacitor.config.json`: `appId`, `appName`, `webDir: "www"`, dunkle
  Hintergrundfarbe.
- `npm run android:sync` = kopieren + `cap sync android`.
  `npm run android:build` = sync + `gradlew assembleDebug`.
- In der App (`https://localhost`):
  - Verlaufsdaten kommen von `raw.githubusercontent.com`, nicht von `./data/`.
    `./data/` gilt nur noch für `http://localhost` und `http://127.0.0.1`
    (Entwicklungsserver).
  - Der Service Worker wird nicht registriert.

## 2. Hintergrund-Check

- Einstellungen (nur in der App sichtbar): Schalter „Benachrichtigung bei
  Favoriten“ (Standard aus) und „Mindestmarge %“ (Standard 5).
- Beim Einschalten fragt die App unter Android 13+ die Berechtigung
  `POST_NOTIFICATIONS` ab. Wird sie abgelehnt, springt der Schalter zurück auf
  aus und ein Hinweis erklärt, dass die Berechtigung fehlt.
- Die Web-Seite übergibt bei jeder Änderung an das native Plugin
  `BazaarAlerts`: an/aus, Mindestmarge, Steuersatz, Favoriten (ID und Name).
  Das Plugin speichert das in `SharedPreferences`, damit der Check auch bei
  geschlossener App arbeiten kann.
- WorkManager: periodischer Auftrag alle 15 Minuten (Android-Minimum), nur bei
  Netzverbindung, eindeutiger Name `bazaar-alerts`. Ausschalten oder leere
  Favoritenliste beendet den Auftrag.
- Der Worker lädt den Bazaar-Endpunkt, liest per Stream nur die Favoriten und
  rechnet wie die App:
  `marge = (sellOffer × (1 − steuer) − buyOrder) / buyOrder`.
- Benachrichtigt wird nur beim **Überschreiten**: ein Favorit, der im
  vorherigen Lauf unter der Schwelle lag (oder neu ist) und jetzt darüber
  liegt. Bleibt er darüber, kommt keine weitere Meldung. Fällt er darunter und
  steigt später wieder, kommt wieder eine.
- Eine Benachrichtigung pro Lauf, Titel z. B. „2 Favoriten über 5 % Marge“,
  Text mit Namen und Marge, Tipp öffnet die App.
- Netzfehler: der Lauf endet mit „retry“; der gespeicherte Zustand bleibt.

## 3. Aussehen

- Adaptives App-Icon: Goldmünze auf `#0f1115` (wie das PWA-Icon), dazu
  PNG-Varianten für ältere Launcher.
- Splashscreen: dunkler Hintergrund `#0f1115` mit dem Icon (Android-12-API,
  über `core-splashscreen` auch auf älteren Geräten).
- Status- und Navigationsleiste dunkel, helle Symbole; WebView-Hintergrund
  dunkel, damit beim Start nichts weiß aufblitzt.

## 4. Build

`gradlew assembleDebug` läuft fehlerfrei; Ergebnis
`android/app/build/outputs/apk/debug/app-debug.apk`.

## Tests

- Web: `node --test` (bestehende Tests plus Daten-URL in der App und
  Einstellungs-Standardwerte).
- Android: JUnit-Tests (`gradlew testDebugUnitTest`) für Preis-Auslesen,
  Marge und Überschreitungs-Logik.
- Prüfung der fertigen APK: Paket-ID, App-Name, Berechtigungen, Signatur,
  Suche nach persönlichen Namen.

## Nicht enthalten

Release-Signatur und Play-Store-Upload, iOS, Benachrichtigungen für NPC- oder
Craft-Flips, eigene Schwelle pro Item, Widget.

# Version 4 (Onboarding + What's new) – Zusammenfassung

Stand: 2026-10-10. Alles liegt auf dem lokalen Branch `v4`, der auf `slide`
(fließendes Wischen) aufbaut. Nichts ist gepusht; `main` und die Live-Seite
sind unverändert. Frühere Zusammenfassungen: `docs/summary-v2.md`,
`docs/summary-android.md`, `docs/summary-v3.md`.

## Fertig

| Nr. | Punkt | Umsetzung |
|---|---|---|
| 1 | Willkommen | Fenster beim allerersten Start mit „Take the tour“ und „Skip“ |
| 2 | Geführte Tour | Spotlight über der echten Oberfläche, 7 Stationen, in der Android-App 8; Next / Back / Skip, Fortschritt „3/8“ |
| 3 | Einrichtungs-Assistent | drei Fragen, danach „Your settings“ mit einem Satz Begründung pro Wert und „Apply“ |
| 4 | What's new | `changelog.json` als einzige Quelle; Fenster nach Updates, auch über mehrere Versionen; „Show me“ zeigt Einträge per Spotlight |
| 5 | Einstellungen | Gruppe „Help“ mit „Restart tour“, „Restart setup“, „What's new“; „?“ neben jedem Regler |
| 6 | README | `README.md` auf Englisch mit Features, Rechenweg und Disclaimer |

Dazu: `CLAUDE.md` mit der Regel, bei jedem Feature-Update die Version zu
erhöhen und einen Changelog-Eintrag anzulegen; Versionsnummer in der Fußzeile;
die Android-Version (jetzt 4.0.0) kommt aus `changelog.json`.

Die Bewertungslogik ist unverändert: `flips.js`, `npc.js`, `craft.js`,
`history.js` und der Android-Code unter `java/` haben gegenüber dem Stand
davor keine Änderung.

## Startverhalten

| Situation | Was erscheint |
|---|---|
| Neuer Nutzer oder gelöschter Speicher | Willkommen, kein What's new |
| Nutzer von vor Version 4 | What's new der aktuellen Version mit „New: app tour – take it now?“ |
| Update um eine oder mehrere Versionen | einmalig What's new mit allen Einträgen seit der zuletzt gesehenen Version |
| Gleiche Version | nichts |

## Wie geprüft wurde

- `node --test`: 115 Tests grün (vorher 98). Neu: 17 Tests für
  Versionsvergleich, Startverhalten (neuer Nutzer, Update um eine Version,
  mehrere übersprungene Versionen, gelöschter Speicher, Nutzer von vor
  Version 4, kaputter Zustand), Assistent, Tour-Stationen, Fenster-Inhalte und
  die Form von `changelog.json`. Kein Test ruft die Hypixel-API auf.
- Screenshots mit einer lokalen Kopie der App, die gespeicherte API-Antworten
  lädt, je bei 360 px und 1440 px: Willkommen, alle 7 Stationen, Assistent,
  Zusammenfassung, übernommene Einstellungen, What's new nach Update,
  Spotlight aus What's new, Tour-Angebot, Versionshistorie, Einstellungen mit
  „?“. 32 Bilder erzeugt, 17 davon selbst angesehen.
- Android-Emulator (360 dp): Start nach Update, Tour mit allen 8 Stationen
  inklusive „Alerts on your phone“, Assistent bis „Apply“, zweiter Start ohne
  Fenster.
- `npm run android:build` läuft fehlerfrei; die APK meldet `versionName 4.0.0`,
  `versionCode 40000`.

Dabei gefunden und behoben:

- Das Spotlight maß hohe oder spät geladene Ziele (Portfolio, Charts) zu früh
  und zeigte einen schmalen Streifen.
- Der Text der Sprechblase wechselte, bevor das Spotlight am neuen Ziel war.
- Das Assistenten-Fenster öffnete am Handy nach unten gescrollt.

## Nicht geprüft

- Kein echtes Handy.
- Die Übergänge (Gleiten von Spotlight und Blase) habe ich nicht in Bewegung
  gesehen; für die Screenshots waren sie abgeschaltet.
- „Bewegung reduzieren“ nur über das CSS, nicht mit umgeschalteter
  Systemeinstellung.
- Tastaturbedienung der Tour (Pfeiltasten, Escape) nur im Code.
- Die Android-Station am Desktop gibt es nicht; sie erscheint nur in der App.
- Die 15 nicht angesehenen Screenshots.

## Wichtig zu wissen

- **Das Design ist weiterhin Variante C.** Im Auftrag stand „Design Variante
  D“; zuletzt gewählt und eingebaut war aber C. Ich habe nichts umgestellt.
  Sag Bescheid, falls D gemeint war.
- **`v4` enthält das fließende Wischen aus `slide`**, das du noch nicht
  freigegeben hast. Ein Merge von `v4` bringt beides nach `main`.
- **Die Erklärtexte der Einstellungen sind jetzt eingeklappt** und öffnen sich
  über das „?“.
- Für dich als bestehenden Nutzer erscheint nach dem Update das Fenster mit dem
  Tour-Angebot, nicht das Willkommensfenster.

## APK

```
android\app\build\outputs\apk\debug\app-debug.apk
```

Relativ zum Projektordner. Version 4.0.0, lässt sich über die bestehende App
installieren.

## Veröffentlichen

`git switch main`, `git merge --ff-only v4`, `git push`.

## Testliste

Neuer Nutzer (privates Browserfenster oder App-Daten gelöscht):

1. Willkommensfenster erscheint. „Skip“ schließt es; beim nächsten Öffnen
   kommt es nicht wieder.
2. Erneut als neuer Nutzer: „Take the tour“. Sieben Stationen (in der App
   acht), das hervorgehobene Element passt jeweils zum Text.
3. „Back“ und „Next“ funktionieren, „Skip“ beendet die Tour.
4. Am Ende öffnet sich „Quick setup“. Drei Antworten wählen, „Continue“:
   „Your settings“ zeigt sechs Werte mit Begründung. „Apply“ übernimmt sie.
5. Einstellungen öffnen: Die Werte aus dem Assistenten stehen dort.

Bestehender Nutzer:

6. Erstes Öffnen nach dem Update: What's new mit „New: app tour – take it
   now?“. „Not now“ schließt; es kommt nicht wieder.
7. Einstellungen → „What's new“: komplette Historie ab 1.0.0.
8. Einstellungen → „Restart tour“ und „Restart setup“ starten beides erneut.
9. „?“ neben einem Regler blendet die Erklärung ein und wieder aus.

Android-App:

10. Station 8 „Alerts on your phone“ erscheint und zeigt den Bereich „Market
    alerts“.
11. Akku-Einstellung wie beschrieben auf „Unrestricted“ stellen und prüfen, ob
    Alerts danach zuverlässiger kommen.
12. Über der alten App installieren: Favoriten und Einstellungen bleiben.

Später:

13. Beim nächsten Feature-Update: Version in `changelog.json` erhöhen, App
    öffnen, What's new zeigt genau die neuen Einträge.

## Offen

- Die Tour erklärt Akku und Benachrichtigungen nur als Text; ein Button, der
  direkt in die Android-Einstellungen springt, bräuchte nativen Code.
- Die Werte des Assistenten („Play it safe“, „More profit“) sind Annahmen.
- Der Assistent setzt „Parallel flips“ nicht; er rechnet mit dem aktuellen
  Wert.
- Die Tour zeigt die Detailseite des obersten Items; hat es noch keinen
  Verlauf, wird statt der Charts der Kopf der Seite hervorgehoben.
- Kein Schritt zum Installieren der PWA auf dem Startbildschirm.

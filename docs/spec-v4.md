# Bazaar Flip Helper – Spec Version 4 (Onboarding + What's new)

Datum: 2026-10-10. Entscheidungen: `DECISIONS.md`, Abschnitt „Version 4“.

## Rahmen

- Die Bewertungslogik bleibt unverändert: Score, suspicious, provisional,
  Opportunities, Market Alerts, Portfolio. Version 4 fügt nur Oberfläche und
  Einstellungs-Vorschläge hinzu.
- Alle Texte englisch, kurz, einsteigerfreundlich.
- Tests arbeiten nur mit Fixtures; kein Test ruft die Hypixel-API auf.
- Gleiches Verhalten in PWA und Android-App.

## 1. Willkommen

Beim allerersten Start erscheint ein Fenster mit App-Name, einem Satz zur App
und den Buttons „Take the tour“ und „Skip“.

## 2. Geführte Tour

Die Tour läuft über die echte Oberfläche: Der Rest ist abgedunkelt, das
aktuelle Element hervorgehoben, eine Sprechblase erklärt es. Die Blase hat
„Back“, „Next“ und „Skip“ und zeigt den Fortschritt („3/8“).

| Nr. | Station | Ziel |
|---|---|---|
| 1 | Flip-Karte: Profit/h, Margin, Buy order, Sell offer, „normal: X“ | erste Karte |
| 2 | Badges: stable, medium, unstable, provisional, suspicious | Badges der ersten Karte |
| 3 | Tabs und Wischen | Tab-Leiste |
| 4 | Portfolio | Portfolio im Tab „Opportunities“ |
| 5 | Stern, Suche, Sortierung | Filterleiste |
| 6 | Detailseite mit Charts, Antippen für Werte | Charts der ersten Karte |
| 7 | Einstellungen | Einstellungs-Button |
| 8 | Nur Android: Market alerts, Benachrichtigungen erlauben, Akku „Unrestricted“ | Bereich „Market alerts“ |

- Fehlt ein Ziel (z. B. noch keine Daten), steht die Blase ohne Hervorhebung
  in der Mitte.
- Bedienbar per Tastatur: Pfeiltasten, Enter, Escape.
- Bei „Bewegung reduzieren“ gibt es keine Übergänge.
- Funktioniert bei 360 px und am Desktop.

## 3. Einrichtungs-Assistent

Startet am Ende der Tour und einzeln über die Einstellungen. Drei Fragen:

| Frage | Auswahl | Setzt |
|---|---|---|
| Kapital fürs Flippen | 10M, 50M, 200M, 1B oder eigener Wert | `Total capital`; `Max. capital per flip` = Kapital / parallele Flips |
| Wie aktiv? | rarely, about every 30 minutes, every few minutes | `Market share` 5 / 10 / 20 % |
| Sicher oder mehr Gewinn? | Play it safe, More profit | `Min. margin`, `Min. volume/week`, `Min. profit/h` der Opportunities |

Werte der dritten Frage:

| Auswahl | Min. margin | Min. volume/week | Min. profit/h |
|---|---|---|---|
| Play it safe | 15 % | 500 000 | 100 000 |
| More profit | 8 % | 100 000 | 250 000 |

Danach zeigt „Your settings“ jeden Wert mit einem Satz Begründung. „Apply“
übernimmt sie; „Back“ führt zu den Fragen zurück.

## 4. What's new

- `changelog.json` im Projektstamm ist die einzige Quelle: neueste Version
  zuerst, pro Version Datum und 1 bis 4 Einträge (`title`, `text`, optional
  `target` als CSS-Selektor und `route`).
- Die App-Version ist die oberste Version dieser Datei. Der Android-Build
  liest `versionName` und `versionCode` daraus.
- Lokal gespeichert unter `bt.onboarding`: `{ "done": true, "version": "4.0.0" }`
  (entspricht `onboardingDone` und `lastSeenVersion`).

| Situation beim Start | Verhalten |
|---|---|
| kein Zustand, keine App-Daten (neu oder Speicher gelöscht) | Willkommen, dann Tour oder Skip; kein What's new |
| kein Zustand, aber App-Daten vorhanden (Nutzer von vor Version 4) | Fenster mit den Einträgen der aktuellen Version und dem Angebot „New: app tour – take it now?“ |
| gespeicherte Version kleiner als aktuelle | einmalig „What's new“ mit allen Einträgen seit der gespeicherten Version |
| gespeicherte Version gleich oder größer | nichts |

In allen Fällen steht danach die aktuelle Version im Speicher. Einträge mit
`target` lassen sich über „Show me“ nacheinander per Spotlight zeigen.

## 5. Einstellungen

- Neue Gruppe „Help“ mit „Restart tour“, „Restart setup“ und „What's new“
  (komplette Historie).
- Neben jedem Regler ein „?“-Button, der die kurze Erklärung ein- und
  ausblendet (bisher stand sie immer darunter).
- Die Fußzeile zeigt die Versionsnummer.

## 6. README

`README.md` auf Englisch: Features, Rechenweg, Disclaimer (inoffizielles
Fan-Tool, nicht mit Hypixel oder Mojang verbunden).

## Tests

`node --test` mit Fixtures für: Versionsvergleich; Startverhalten (neuer
Nutzer, Update um eine Version, mehrere übersprungene Versionen, gelöschter
Speicher, Nutzer von vor Version 4, kaputter Zustand); Assistent (Werte und
Begründungen); Tour-Stationen (Android-Station nur in der App);
`changelog.json` (Form, Reihenfolge, 1 bis 4 Einträge). Sichtprüfung der Tour
und von „What's new“ per Screenshot bei 360 px und 1440 px.

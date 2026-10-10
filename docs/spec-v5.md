# Bazaar Flip Helper – Spec Version 5 (Forge, Events & Trends)

Datum: 2026-10-10. Entscheidungen: `DECISIONS.md`, Abschnitt „Version 5“.
Quellen für Events und Gebühren: `docs/events-sources.md`.

## Rahmen

- Die Bewertungslogik bleibt unverändert: Score, suspicious, provisional,
  Opportunities, Market Alerts, Portfolio. `flips.js`, `npc.js`, `craft.js`
  und der Android-Code unter `java/` werden nicht angefasst. `history.js`
  bleibt in seinen Funktionen gleich.
- Alle Texte englisch, Design wie bisher (Tokens aus `style.css`).
- Tests nur mit Fixtures. Die Hypixel-API wird von diesem Rechner nicht
  wiederholt abgerufen; die Abrufe laufen im GitHub-Workflow.

## 1. Forge-Flips (Tab „Forge“)

- Rezepte aus dem NEU-Repo: `recipes[].type == "forge"` mit `inputs`,
  `duration` (Sekunden), `count`; HotM-Stufe aus `crafttext`
  („Requires: … HotM 7“).
- Nur Rezepte, deren Zutaten alle im Bazaar handelbar sind (Coins als Zutat
  sind erlaubt und zählen zu den Kosten). Pets als Ergebnis fallen weg.
- Kosten: Zutaten zum Buy-Order-Preis, wie bei Craft-Flips.
- Erlös: Ist das Ergebnis im Bazaar, gilt der Sell-Offer-Preis minus
  Bazaar-Steuer. Sonst gilt der Lowest BIN aus `ah.json` minus AH-Gebühren.
- AH-Gebühren: Einstellgebühr 1 % (unter 10 M), 2 % (10 M bis 100 M), 2,5 %
  (über 100 M) plus 1 % Abholsteuer bei Verkäufen über 1 M (höchstens so viel,
  dass 1 M übrig bleibt).
- Anzeige je Karte: Profit/forge hour, Margin, Profit/item, Cost, Sells for,
  Duration, HotM tier, Zutatenliste.
- AH-Ergebnisse tragen das Badge „AH sale – estimate“ und den Satz, dass
  AH-Verkäufe langsamer und unsicherer sind.
- Filter über der Liste: „Bazaar only“ / „Incl. AH“. Einstellung „HotM tier“
  blendet Rezepte über der eigenen Stufe aus.
- Fünf Tabs: Die Tab-Leiste scrollt horizontal, der aktive Tab wird in den
  sichtbaren Bereich geholt. Wischen erreicht auch „Forge“.

### Daten aus dem Workflow

| Datei | Inhalt | Takt |
|---|---|---|
| `forge.json` | `{ t, r: { ID: { n, d, h, c?, i } } }` (Menge, Dauer s, HotM, Coins, Zutaten) | täglich, zusammen mit `recipes.json` |
| `ah.json` | `{ t, p: { ID: lowestBin } }`, nur Forge-Ergebnisse außerhalb des Bazaars | jeder Lauf |
| `election.json` | Mayor, Perks, Minister, laufende Wahl | jeder Lauf |
| `stats.json` | viertes Feld je Item: Trend (relative Änderung des Sell-Preises über 24 h) | jeder Lauf |

Schlägt ein Zusatzabruf fehl, bleibt die alte Datei stehen und der Lauf gilt
trotzdem als erfolgreich.

## 2. Mayor- & Event-Radar

- Einklappbare Karte oben in jeder Liste. Zugeklappt zeigt sie eine Zeile:
  Mayor, laufende Events, nächstes Event mit Countdown.
- Aufgeklappt: Mayor mit Perks und Minister (Texte aus der API), laufende
  Wahl mit Stimmenanteilen oder der Zeitpunkt der nächsten Wahl, danach die
  Events mit Countdown. Jede Zeile lässt sich antippen und zeigt Details und
  die Items, die „typically affected“ sind.
- Feste Events aus der SkyBlock-Zeit: Spooky Festival, Jerry's Workshop,
  Season of Jerry, New Year Celebration, Traveling Zoo, Hoppity's Hunt,
  Mayor election.
- Perk-gebundene Events erscheinen nur, wenn der Perk aktiv ist (Mayor oder
  Minister): Fishing Festival mit Terminen; Mining Fiesta und Mythological
  Ritual ohne Termin als aktiver Perk.
- Items eines laufenden oder in den nächsten 24 Stunden beginnenden Events
  und eines aktiven Perks tragen in allen Listen ein Event-Badge.

## 3. Trend-Signale

- Richtung aus der Steigung des Sell-Preises über die letzten 24 h
  (lineare Regression, relativ zum Mittelwert): über +3 % „rising“, unter
  −3 % „falling“, sonst „flat“. Mindestens 12 Punkte über mindestens 12 h.
- Niveau: aktueller Sell-Preis gegen den 7-Tage-Median: mehr als 10 %
  darunter „below normal“, mehr als 10 % darüber „above normal“.
- Ein Pfeil-Badge auf Karte und Detailseite, neue Sortierung „Trend“
  (steigend zuerst). Keine Wirkung auf Opportunities, Portfolio oder Alerts.

## 4. Erklärung für Nutzer

- `changelog.json` Version 5.0.0 mit Einträgen zu Forge, Event-Radar, Trends
  und der neuen Tour, jeweils mit Spotlight-Ziel.
- Tour in zwei Teilen. Basis (6 Stationen): Karte, Badges, Tabs,
  Opportunities, Suche, Einstellungen. Advanced: Portfolio, Forge,
  Event-Radar, Trends, in der Android-App zusätzlich Alerts. Am Ende der
  Basis-Tour das Angebot „Take the advanced tour?“. Beide sind über Help
  startbar.
- Bestehende Nutzer sehen nach dem Update What's new mit den v5-Einträgen und
  dem Button „Advanced tour“.
- Der Einrichtungs-Assistent stellt zwei weitere Fragen: HotM-Stufe und ob
  Auktionshaus-Verkäufe einbezogen werden.
- Help → „How it works“ erklärt zusätzlich Forge (mit AH-Schätzung), Events
  und Trends.

## Tests

Mit Fixtures: Forge-Rezept-Parser, Forge-Rechnung und AH-Gebühren,
Item-ID aus Auktionsdaten und Lowest BIN, Election-Verdichtung, SkyBlock-Zeit
und Event-Termine, Trend-Steigung und Schwellen, Karten und Radar-HTML,
Tour-Aufteilung, Assistent, Changelog-Form.

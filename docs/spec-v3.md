# Bazaar Flip Helper – Spec Version 3 (Qualität + Design)

Datum: 2026-10-09. Baut auf `docs/spec-v2.md` und `docs/spec-android.md` auf.
Entscheidungen: `DECISIONS.md`, Abschnitt „Version 3“.

## Grundsatz

Jede Rechenregel gilt gleich in `flips.js` (Web) und `AlertLogic.java`
(Android-Hintergrund). Konstanten haben in beiden Dateien denselben Namen und
Wert; Tests benutzen in beiden Sprachen dieselben Fälle.

## Datenqualität

### 1. Preis aus der Orderbuch-Tiefe

Statt der obersten Order gilt als Preis der mengengewichtete Durchschnitt der
ersten `DEPTH_UNITS = 1000` Stück je Buchseite.

```
preis = Σ(menge_i × preis_i) / Σ menge_i     über die besten Orders, bis 1000 Stück erreicht sind
```

- Die letzte Order zählt nur mit dem Teil, der bis 1000 fehlt.
- Liegen insgesamt weniger als 1000 Stück im Buch, zählt alles Vorhandene.
- Orders ohne Mengenangabe zählen nicht; zählt gar keine, gilt der Preis der
  obersten Order.
- Gilt überall, wo bisher „oberste Order“ stand: Flips, NPC, Craft,
  Favoriten-Alerts, Market Alerts und die Snapshots im Branch `data`.

### 2. Kennzahlen aus dem Verlauf (`stats.json`)

Der Snapshot-Workflow schreibt zusätzlich `stats.json`:

```
{"t": <unixMinuten>, "i": {"<id>": [<score|null>, <medianSell>, <stunden>]}}
```

- `score`: Stabilitäts-Score wie bisher (`null` unter 12 Punkten).
- `medianSell`: Median des Sell-Offer-Preises über den vorhandenen Verlauf
  (höchstens 7 Tage), 1 Nachkommastelle.
- `stunden`: Zeit zwischen erstem und letztem Punkt, 1 Nachkommastelle.
- `scores.json` wird weiter geschrieben (ältere installierte Apps lesen sie).

### 3. Suspicious über den Median

Zusätzlich zu den bisherigen Regeln gilt ein Flip als „suspicious“, wenn

```
sell > medianSell × (1 + MEDIAN_SPIKE)        MEDIAN_SPIKE = 0.3
```

Ohne Median (keine Verlaufsdaten) greift die Regel nicht.

### 4. Provisional

- Ein Item mit weniger als `PROVISIONAL_HOURS = 24` Stunden Verlauf (oder ganz
  ohne Eintrag in `stats.json`) bekommt das Badge „provisional“ statt
  stable / medium / unstable. Sein Score gilt als nicht vorhanden.
- Solche Items erscheinen nicht im Tab „Opportunities“ und lösen keine Market
  Alerts aus.
- Sind die Kennzahlen gar nicht ladbar, zeigt die App keine Badges; der Tab
  „Opportunities“ bleibt leer und sagt das.

### 5. Median als Kontext

Karte und Detailseite zeigen „normal: X“ (7-Tage-Median des Sell-Preises),
sofern vorhanden.

## Design

- **Name:** überall „Bazaar Flip Helper“, auch in der Überschrift.
- **Farben:** Hintergrund `#0D0D0D`, Karten `#1A1A1A`, Ränder dezent; Akzent
  Orange `#FF8A00` für aktiven Tab, Buttons, Schalter, Hervorhebungen und die
  Hauptlinie im Chart. Bedeutungsfarben getrennt vom Akzent: Gewinn grün,
  Verlust rot (auch bei Favoriten), „suspicious“ gelb; Badges stable / medium /
  unstable / provisional in vier unterscheidbaren Farben und immer mit Text.
- **Kontrast:** jede Text-Hintergrund-Kombination mindestens WCAG AA (4,5 : 1),
  per Test geprüft.
- **Karten:** Gewinn/h und Marge groß; übrige Werte klein und gedämpft.
- **Desktop:** ab 900 px mehrspaltiges Kartenraster, Detailseite mit Charts
  nebeneinander, Einstellungen mehrspaltig.
- **Icons:** eigene Inline-SVGs (Aktualisieren, Einstellungen, Stern, Zurück,
  Warnung), keine Bibliothek.
- **Einstellungen:** gruppiert (Calculation, List, Opportunities, Alerts), mit
  einem kurzen Erklärsatz unter jeder Option.
- **Charts:** waagerechte Hilfslinien mit Werten; beim Antippen oder Überfahren
  eine senkrechte Linie und die Werte des nächsten Zeitpunkts.
- **App-Icon und Splash:** eigenes Symbol (drei aufsteigende orange Balken) auf
  Schwarz, für PWA und Android aus einem Skript erzeugt.
- **Systemfarben:** `theme_color` und `background_color` im Manifest,
  Android-Status- und Navigationsleiste auf `#0D0D0D`.

## Tests

- Web (`node --test`): Orderbuch-Tiefe, Median-Regel, provisional,
  `stats.json` im Snapshot, Kontrast, Chart-Hilfslinien und Trefferpunkt.
- Java (`gradlew testDebugUnitTest`): dieselben Fälle für Tiefe, Median-Regel
  und provisional.
- Sichtprüfung per Screenshot bei 360 px und 1440 px.

## Nicht enthalten

Light Mode, längerer Verlauf als 7 Tage, Volumen-Chart, eigene Schwellen pro
Item.

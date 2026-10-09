# Bazaar-Tracker – Design (Version 1)

Datum: 2026-10-09

## Ziel

Am Android-Handy schnell sehen, welche Hypixel-SkyBlock-Bazaar-Flips sich mit dem
eigenen Kapital lohnen, ohne auf manipulierte Items hereinzufallen. Einzelnutzer,
kein Backend, kein Konto.

## Rahmen

- Installierbare PWA, nur Dark Mode, für Handybreite gebaut.
- Vanilla JS (ES-Module), kein Build-Schritt, keine Abhängigkeiten.
- Hosting: GitHub Pages (Unterpfad `/<repo>/`), daher nur relative Pfade.
- Push zu GitHub erst nach Freigabe durch den Nutzer.

## Daten

Geprüft am 2026-10-09: beide Endpunkte antworten ohne API-Key mit
`access-control-allow-origin: *`.

| Endpunkt | Zweck | Größe | Cache |
|---|---|---|---|
| `https://api.hypixel.net/v2/skyblock/bazaar` | Preise, Volumen | 3,6 MB | `max-age=60` |
| `https://api.hypixel.net/v2/resources/skyblock/items` | Item-Namen | 4,8 MB | lokal 7 Tage |

Die Bezeichnungen der API sind aus Sicht des Sofortkäufers:

- `sell_summary[0].pricePerUnit` = höchste Buy-Order = unser **Buy-Order-Preis**
- `buy_summary[0].pricePerUnit` = niedrigstes Sell-Offer = unser **Sell-Offer-Preis**

`quick_status.sellPrice/buyPrice` wird nicht benutzt (gewichteter Schnitt, verfälscht
die Spanne). Aus `quick_status` kommen nur `buyMovingWeek`, `sellMovingWeek`,
`buyOrders`, `sellOrders`.

Produkte ohne Eintrag auf einer der beiden Orderbuch-Seiten werden übersprungen.

## Rechnung (`flips.js`, reine Funktionen)

```
gewinn      = sell × (1 − steuer) − buy
marge       = gewinn / buy
stundenVol  = min(buyMovingWeek, sellMovingWeek) / 168
stueck      = maxKapital > 0 ? min(stundenVol, floor(maxKapital / buy)) : stundenVol
gewinnStd   = stueck × gewinn
```

- Steuer: Auswahl 1,25 % (Standard) / 1,125 % / 1,0 %.
- Wochenvolumen eines Flips = `min(buyMovingWeek, sellMovingWeek)`.

### Filter

- Mindestvolumen pro Woche (Standard 100 000).
- Max. Kapital pro Flip (Standard 5 000 000; 0 = kein Limit). Items mit
  `buy > maxKapital` fallen raus.
- Suche im Namen, ohne Groß-/Kleinschreibung.
- Nur Favoriten (Umschalter).
- Flips mit `gewinn ≤ 0` werden nicht gezeigt.

### Sortierung

Gewinn/Stunde (Standard), Gewinn/Stück, Marge %. Immer absteigend. Gezeigt werden
die ersten 100 Treffer.

### Warnung „verdächtig“

Ein Item bekommt ein Warn-Badge (wird nicht ausgeblendet), wenn eines zutrifft:

- Marge > 50 % **und** Stundenvolumen < 100 Stück
- weniger als 3 Orders auf einer der beiden Seiten (`buyOrders`, `sellOrders`)

Hinweis: Greift nur, wenn der Mindestvolumen-Filter das Item nicht schon entfernt.

## Namen (`names.js`)

1. Items-Ressource laden, auf `{id: name}` reduzieren, in `localStorage` mit
   Zeitstempel ablegen, 7 Tage gültig.
2. Fehlt die ID (ca. 1170 von 2200 Produkten: `ENCHANTMENT_*`, `SHARD_*`,
   `ESSENCE_*`, `FACTION_*`), Name aus der ID ableiten:
   - `ENCHANTMENT_ULTIMATE_WISE_5` → „Ultimate Wise 5“
   - `SHARD_X` → „X Shard“, `ESSENCE_X` → „X Essence“
   - sonst Unterstriche zu Leerzeichen, Wortanfänge groß
3. Schlägt das Laden fehl, gilt für alle IDs der Fallback; die Liste funktioniert
   trotzdem.

## Oberfläche

- Kopf: Titel, Zeitstempel „Stand HH:MM:SS“ (aus `lastUpdated` der API),
  Refresh-Knopf, Zahnrad für Einstellungen.
- Leiste: Suche, Sortierung, Umschalter „nur Favoriten“.
- Einstellungen (aufklappbar): Steuer, Mindestvolumen, max. Kapital,
  Refresh-Intervall 1 / 2 / 5 Min (Standard 2).
- Liste: eine Karte pro Flip mit Stern, Name, Warn-Badge, Buy-Order-Preis,
  Sell-Offer-Preis, Gewinn/Stück, Marge %, Gewinn/Stunde, Wochenvolumen.
- Zahlen kompakt formatiert (`1,2 Mio.`), Locale `de-DE`.
- Pull-to-Refresh: am Seitenanfang nach unten ziehen (> 70 px) löst Refresh aus.
  `overscroll-behavior-y: contain` verhindert das Browser-eigene Neuladen.

## Zustand

Alles in `localStorage`:

- `bt.settings` – Steuer, Mindestvolumen, max. Kapital, Intervall, Sortierung
- `bt.favs` – Liste der Produkt-IDs
- `bt.names` – `{t: Zeitstempel, m: {id: name}}`

## Refresh und Fehler

- Automatisch im gewählten Intervall; pausiert bei verstecktem Tab, lädt beim
  Zurückkehren sofort, wenn die Daten älter als das Intervall sind.
- Fehler (Netz, `success: false`): alte Liste bleibt stehen, Hinweiszeile mit
  Fehlertext, nächster Versuch im normalen Intervall.

## PWA

- `manifest.webmanifest`: `display: standalone`, dunkle Theme-Farbe, Icons 192
  und 512 (PNG, auch `maskable`), `start_url` und `scope` relativ (`./`).
- `sw.js`: cacht nur die App-Shell, Network-first mit Cache als Rückfall
  (neue Deployments kommen ohne Versionspflege an). API-Anfragen gehen immer
  direkt ans Netz.

## Dateien

```
index.html  style.css  app.js  flips.js  names.js
manifest.webmanifest  sw.js  icons/icon-192.png  icons/icon-512.png
tests/flips.test.js  tests/names.test.js
```

## Tests

`node --test` für `flips.js` (Gewinn mit Steuer, Kapitaldeckel, Filter,
Sortierung, Warnregel, fehlende Orderbuch-Seite) und den Namens-Fallback.
Oberfläche: manueller Test im Browser gegen die echte API.

## Nicht in Version 1

Preisverlauf, Charts, Benachrichtigungen, NPC- und Craft-Flips, Light Mode,
Offline-Anzeige alter Preise.

# Bazaar-Tracker – Spec Version 2

Datum: 2026-10-09. Baut auf `docs/superpowers/specs/2026-10-09-bazaar-tracker-design.md` (V1) auf.
Entscheidungen mit Begründung stehen in `DECISIONS.md`.

## Ziel

V1 zeigt nur den Moment. V2 ergänzt Verlauf (Charts, Stabilität), zwei weitere
Flip-Arten (NPC, Craft) und Item-Bilder. Weiterhin: kein Backend, kein Build,
keine Abhängigkeiten, nur Dark Mode, deutsche Oberfläche.

## 1. Verlaufsdaten (GitHub Actions → Branch `data`)

- Workflow `.github/workflows/snapshot.yml`, Cron `7,27,47 * * * *` (alle 20 Min)
  und manuell (`workflow_dispatch`).
- Skript `scripts/snapshot.mjs <dataDir>` holt den Bazaar-Endpunkt und speichert
  pro Produkt nur Buy-Order-Preis und Sell-Offer-Preis (Spitze des Orderbuchs,
  wie in V1), auf 1 Nachkommastelle gerundet.
- Der Branch `data` hat immer genau einen Commit (verwaist, Force-Push). So
  wächst das Repo nicht.
- Layout im Branch:

```
h/<YYYY-MM-DD>/<shard>.json   Verlauf, UTC-Tag, shard = 0..15
scores.json                   {"t": <unixMinuten>, "s": {"<id>": <0..100>}}
recipes.json                  {"t": <unixMs>, "r": {"<id>": {"n": <Anzahl>, "i": {"<zutatId>": <Menge>}}}}
```

- Shard-Datei: `{"t": [<unixMinuten>, …], "p": {"<id>": [[<buy>, …], [<sell>, …]]}}`.
  Die Preis-Arrays sind genauso lang wie `t`; fehlt ein Produkt in einem
  Snapshot, steht dort `null`.
- `shard = Summe der Zeichencodes der ID mod 16`.
- Ausdünnen: Tagesordner, die älter als 7 Tage sind, werden bei jedem Lauf
  gelöscht (es bleiben heute und die 7 Tage davor).
- Schlägt die API fehl, endet das Skript mit Exit-Code 1 und es wird nichts
  gepusht.
- Die App liest von
  `https://raw.githubusercontent.com/Tsaitunq/bazaar-tracker/data/`,
  auf `localhost`/`127.0.0.1` von `./data/` (lokal erzeugt, nicht eingecheckt).
- Fehlen die Daten (Branch existiert noch nicht, Netzfehler), läuft die App
  ohne Score, Charts und Craft-Tab-Inhalt weiter und sagt das im jeweiligen
  Bereich.

## 2. Detailseite

- Route `#/item/<encodeURIComponent(id)>`, erreichbar per Tipp auf eine Karte.
- Inhalt: Zurück-Link, Bild, Name, Favoriten-Stern, Stabilitäts-Badge,
  aktuelle Werte (Buy-Order, Sell-Offer, Gewinn/Stück, Marge), Umschalter
  24h / 7d, zwei Charts: Preise (Buy und Sell als zwei Linien) und Marge in %.
- Marge im Chart: `(sell × (1 − steuer) − buy) / buy` mit der eingestellten Steuer.
- Charts sind handgeschriebenes SVG (`chart.js`), keine Library. Achsen: Minimum
  und Maximum als Beschriftung, Start- und Endzeit.
- Ohne Verlauf: Text „Noch kein Verlauf vorhanden“.

## 3. Stabilitäts-Score

Aus den Punkten `[t, buy, sell]` der letzten 7 Tage, berechnet im Workflow
(`scores.json`), Steuer fest 1,25 %:

```
positiv    = Anteil der Punkte mit sell × (1 − 0,0125) − buy > 0
cv(x)      = Standardabweichung(x) / Mittelwert(x)      (Grundgesamtheit)
schwankung = (cv(buy) + cv(sell)) / 2
score      = runden(100 × positiv × max(0, 1 − 2 × schwankung))
```

- Weniger als 12 Punkte: kein Score (`null`).
- Badge: ≥ 70 „stabil“, 40–69 „mittel“, < 40 „instabil“; ohne Score kein Badge.
- Sortieroption „Stabilität“, absteigend, Items ohne Score ans Ende.

## 4. NPC-Flips (Tab „NPC“)

Im Bazaar per Buy-Order kaufen, an einen NPC verkaufen.

```
gewinn        = npc_sell_price − buyOrderPreis          (keine Bazaar-Steuer)
gewinnSofort  = npc_sell_price − sellOfferPreis         (Sofortkauf, kann negativ sein)
marge         = gewinn / buyOrderPreis
stundenVol    = sellMovingWeek / 168
```

`npc_sell_price` kommt aus der Items-Ressource. Gezeigt werden Flips mit
`gewinn > 0`; Mindestvolumen (`sellMovingWeek`), Kapitalgrenze und Marktanteil
gelten wie bei Bazaar-Flips.

## 5. Craft-Flips (Tab „Craft“)

Zutaten per Buy-Order kaufen, craften, Ergebnis per Sell-Offer verkaufen.

- Rezepte: NotEnoughUpdates-REPO (MIT-Lizenz), Ordner `items/`. Das
  Snapshot-Skript baut daraus `recipes.json` neu, wenn die Datei fehlt oder
  älter als 24 h ist.
- Aufgenommen werden nur Crafting-Rezepte, bei denen Ergebnis und alle Zutaten
  Bazaar-Produkte sind.

```
kosten       = Σ menge × buyOrderPreis(zutat)
erlös        = n × sellOfferPreis(ergebnis) × (1 − steuer)
gewinn       = erlös − kosten                             (pro Craft)
marge        = gewinn / kosten
craftsStunde = min(buyMovingWeek(ergebnis) / n, min über Zutaten(sellMovingWeek / menge)) / 168 × marktanteil
```

Kapitalgrenze: `kosten ≤ maxKapital`, Crafts pro Stunde zusätzlich durch
`floor(maxKapital / kosten)` gedeckelt. Karte zeigt die Zutatenliste mit Menge
und Stückpreis.

## 6. Item-Bilder

- Quelle: `https://sky.coflnet.com/static/icon/<id>` (CORS offen, 404 bei
  unbekannter ID). Es werden keine Texturdateien ins Repo kopiert.
- `<img loading="lazy" crossorigin="anonymous">`, feste Größe, in Liste und
  Detailseite.
- Fehlt das Bild: Platzhalter (eingebettetes SVG als Data-URI).
- Service Worker: Cache-first für diese URLs in eigenem Cache `bt-icons`.
- Fußzeile mit Links zu sky.coflnet.com (Bilder) und zum NEU-Repo (Rezepte)
  sowie dem Hinweis, dass die App nicht zu Hypixel gehört.

## Navigation

Tabs „Flips“, „NPC“, „Craft“ unter dem Kopf; Routen `#/flips` (Standard),
`#/npc`, `#/craft`, `#/item/<id>`. Suche, Sortierung, Favoriten-Umschalter und
Einstellungen gelten für alle Tabs. „Favoriten umgehen Filter“ gilt nur im
Flips-Tab.

## Nicht in Version 2

Benachrichtigungen, Verlauf älter als 7 Tage, Schmiede-/Trank-Rezepte,
Rezeptketten (Zutat selbst craften), Tooltip mit Einzelwerten im Chart,
Offline-Cache der Verlaufsdaten.

# Design: Guide-App

Quelle: Mockups „Guide-App Mockups“ (claude.ai, privat), Screens Startseite, Mining, Blaze, Farming.
Telefon-Layout 390 px breit, Schrift Space Grotesk (400/500/700), Zahlen mit Tausenderpunkt-Komma wie `3,459`. UI-Texte Englisch.

## Themes (Tokens)

Die Startseite ist lila. Jeder Guide ist komplett eingefärbt (Hintergrund, Flächen, Linien, Leiste), nicht nur Akzente.

| Token   | Home (lila) | Mining (Eisblau) | Blaze (Glut) | Farming (Grün) |
|---------|-------------|------------------|--------------|----------------|
| area    | #9B6BFF     | #5CC8FF          | #FF8A3D      | #5BD46B        |
| bg      | #0B0A10     | #090B0E          | #0D0908      | #0A0C0B        |
| surface | #15131C     | #111821          | #1A1210      | #121714        |
| raised  | #1A1626     | #15202C          | #22160F      | #16201A        |
| deep    | #0F0D16     | #0C1218          | #120C0A      | #0E1310        |
| line    | #2A2636     | #1E2A36          | #33221F      | #1F2A22        |
| track   | #221E2E     | #1A2532          | #2A1C1A      | #18221B        |
| muted   | #A39DB5     | #9AAAB8          | #B8A39C      | #A3B3A6        |
| soft    | #C9C4D6     | #C4D2DD          | #DCCBC5      | #C9D6CC        |
| text    | #F2F0F7     | #EEF3F7          | #F6F0EE      | #EFF4F0        |
| dim     | #3D3750     | #2A3A48          | #4A3330      | #33463A        |
| Ring K1/K2/K3 | –     | #BDEBFF / #5CC8FF / #2F6FD6 | #FFC27A / #FF8A3D / #C24A1F | #A8EBB1 / #5BD46B / #2E8A3C |
| Icon    | Profil      | Spitzhacke       | Flamme       | Blatt          |

Hypixel-Stat-Farben (überall gleich): Fortune/Speed ☘ ⸕ #FFAA00, Pristine ✧ #D255D2, Strength ❁ / Health ❤ #FF5555, Crit ☣ ☠ #8C96FF, Attack Speed ⚔ #FFFF55, Defense ❈ #55FF55, True Defense ❂ #FFFFFF, Magical Power ✦ #55FFFF, Wisdom ☯ #55FFFF. Gewinn/Delta immer #55FF55. Rarity-Rahmen: Common #FFFFFF, Uncommon #55FF55, Rare #6F7BFF, Epic #C355E0, Legendary #FFAA00, Mythic #FF55FF.

Kontrast: Fließtext ≥ 4.5:1 auf `bg`/`surface`. Touch-Ziele ≥ 44 px.

## Bausteine

1. **Geteilter Kapitel-Ring**: ein Kreis (r 47, Strich 11, rund), in 3 Bögen geteilt (je ein Kapitel, Lücke ~15 px), Hintergrund-Bogen `track`, Füllung je Kapitel in K1/K2/K3 nach Fortschritt. Mitte: Gesamt-% (22 px fett). Rechts daneben: Icon + Guide-Name (22 px) und Legende je Kapitel (Punkt, Name, %), aktuelles Kapitel fett.
2. **Stat-Raster**: Karte `surface`, Radius 20, 2 Spalten (Blaze: 3 Spalten, 6 Stats). Je Stat: kleine Zeile „Icon Label“ (Icon in Stat-Farbe, Label `muted`), darunter Wert 22 px fett in Stat-Farbe und daneben grünes Delta (`+8`) = Vorschau des markierten/nächsten Schritts.
3. **Punkte-Pfad**: senkrechte Linie (3 px) mit Punkten (22 px). Erledigt = gefüllt `area` mit ✓, aktuell = Ring `area` mit Glow, offen = Ring `dim`, gesperrt = Ring `line`, Text `muted`. Linie bis zum aktuellen Schritt in `area`, danach `line`. Zeile: Name (15 px) + Unterzeile (Stat-Gewinn in Stat-Farbe bzw. Grund bei gesperrt) + rechts `0.33 % / 1M` / `done` (grün) / `locked`.
4. **Aufgeklappte Schritt-Karte** (nur der nächste Schritt): `raised`, Rahmen `area`, Radius 18. Inhalt: Name + Ort (Slot/Item); Box `deep` mit dem Hypixel-Stat in Stat-Farbe (`+8 ☘ Mining Fortune`, Blaze ggf. mehrere Zeilen) und Gewinn grün (`+2.4 % more gems`); Zeile „Kosten“ links, „`0.61 % per 1M`“ rechts in `area`; Button „Mark done“ (`area`, Text `bg`, 44 px, rund). Optional Badge „★ BEST VALUE“ in `area`.
5. **Bedingungs-Chips** (nur Blaze): zwei kleine Karten „❂ True Def ≥ 140 · 164 ✓“ und „✦ Power · 820 / 1,100“.
6. **Untere Leiste**: Pill-Leiste `surface`, aktive Option `raised`. Guide-Screens: Path · Best value · Stats. Startseite: Home · Stats · Settings.
7. **Zurück**: oben links „‹ Guides“ in `muted`.

## Screens

- **Startseite (lila)**: „Synced … ago“, Titel „Your guides“, Profil-Button (rund, lila Rahmen). Karte „BEST DEAL RIGHT NOW“ (bester Schritt über alle Guides, mit Bereichsname in Bereichsfarbe, Stat-Gewinn, `% per 1M · costs`). Je Guide eine Karte in dessen Theme-Farben (`surface`/`line`) mit kleinem geteiltem Ring (70 px), Name, Kapitel, „Next: …“ in Bereichsfarbe → öffnet den Guide. Zwei Kacheln: „Coins for all next steps“, „Unlocked this week“.
- **Guide (je Theme)**: Zurück · Ring + Legende · Stat-Raster · (Blaze: Bedingungs-Chips) · Punkte-Pfad mit aufgeklappter Karte · Leiste.
- **Farming**: Theme fertig, Guide-Inhalt und Score-Formel folgen. Bis dahin Leerzustand im Farming-Theme („Guide coming soon“).

Werte wie „% per 1M“ immer mit Einheit ausschreiben, nie als nackte Zahl.

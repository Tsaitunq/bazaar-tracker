# Design-Varianten

Vorschläge für ein wärmeres Schwarz/Orange. A bis D sind je eine CSS-Datei,
die nach `style.css` geladen wird; E zeigt D mit breiterer Detailseite.

**Gewählt und in die App eingebaut ist Variante C („Forge“)**, zusammen mit
der breiteren Desktop-Detailseite aus E. Die Dateien hier bleiben als
Vergleich liegen; maßgeblich ist `style.css`.

Die Screenshots der nicht gewählten Varianten A, B, D und E wurden entfernt;
ihre CSS-Dateien und die Beschreibungen unten bleiben als Notiz. Vorhanden
sind nur noch die Bilder von C.

| Datei | Inhalt |
|---|---|
| `<x>-handy-liste.png`, `<x>-handy-detail.png` | Layout bei 360 px Breite (Bild auf 500 px vergrößert) |
| `<x>-desktop-liste.png`, `<x>-desktop-detail.png` | Layout bei 1440 px |
| `variant-<x>.css` | die Variante |
| `check-contrast.mjs` | prüft jede Textfarbe gegen jede Fläche (WCAG AA) |

Die Badges in den Bildern (stable, medium, unstable, provisional, suspicious)
stammen aus künstlich gemischten Kennzahlen, damit alle Farben zu sehen sind.

## A – „Ember“ (ruhig)

Warmes Schwarz mit leichtem Schein von oben, Karten mit kaum sichtbarem
Verlauf und eine feine orange Linie unter dem Kopf. Die Seltenheit steckt nur
im farbigen Ring um das runde Item-Bild; Namen bleiben weiß.

## B – „Glow“ (lebendig)

Oranger Dunst am oberen Rand, Kopf mit Verlauf, Leuchten am aktiven Tab, an
gedrückten Buttons, an der Chart-Linie und beim Überfahren einer Karte.
Item-Namen tragen die Rarity-Farbe, das Bild sitzt auf einer dunklen runden
Kachel.

## C – „Forge“ (strukturiert)

Feines Punktraster im Hintergrund, Tabs als unterstrichene Beschriftung,
kräftige orange Linie unter dem Kopf und zwischen den großen Zahlen und den
Details. Die Seltenheit zeigt ein farbiger Streifen links an der Karte plus
das Wort (COMMON, RARE, EPIC …); Namen bleiben weiß.

## D – „Glow + Ring“ (B mit weißen Namen)

Wie B: oranger Dunst, Kopf mit Verlauf, Leuchten an aktiven Elementen und an
der Chart-Linie. Die Item-Namen sind weiß; die Seltenheit zeigt wie in A ein
farbiger Ring um das runde Item-Bild, in Liste und Detailseite.

## E – D mit breiter Detailseite

Wie D. Auf der Desktop-Detailseite stehen die beiden großen Zahlen und die
Preistabelle (Buy order, Sell offer mit „normal“, Profit/item, Vol./week) in
einer Zeile über die volle Breite; am Handy bleibt alles untereinander. Die
Bilder zeigen den Zwischenstand, als D eingebaut war.

## Eingebaut: C mit breiter Detailseite

- Aussehen wie in den Bildern `c-*.png`.
- Die Detailseite am Desktop nutzt die volle Breite (große Zahlen und Preistabelle in einer Zeile).
- Karten im Tab „Opportunities“ haben einen orangen Rahmen (C kennt kein
  Leuchten).
- Eine große Zahl leuchtet kurz auf, wenn sich ihr Wert bei einem Refresh
  ändert; Karten blenden beim Laden ein. Beides ist bei „Bewegung reduzieren“
  aus.

## Geprüft

- Kontrast: alle vier bestehen `check-contrast.mjs`; niedrigster Wert A 5,73,
  B 4,94, C 5,85, D 4,94 (gefordert 4,5).
- Bewegung: Das Einblenden der Karten und das Anheben beim Überfahren stehen
  hinter `prefers-reduced-motion`.
- Leistung: nur Farbverläufe, Schatten und `opacity`/`transform`; kein
  `backdrop-filter`, keine Bilder.

## Zu beachten

- **Rarity-Farben auf Namen (nur B) kollidieren mit den Bedeutungsfarben.**
  Uncommon ist grün wie Gewinn und „stable“, Legendary gold nahe an
  „suspicious“ und am Akzent, Special rot wie Verlust. In A, C und D steht die
  Seltenheit deshalb nicht auf Text, sondern am Ring bzw. Streifen.
- Die Rarity-Töne sind gegenüber dem Spiel aufgehellt; das originale Blau
  (`#5555FF`) erreicht auf dunklem Grund nur etwa 3,4 : 1.
- Items ohne Eintrag in der Items-API (Enchantments, Shards, Essences) haben
  keine Seltenheit und erscheinen als Common.
- Noch nicht gebaut, kommt mit der gewählten Variante: Aufleuchten einer Zahl
  bei Änderung (braucht etwas Code in `app.js`) und das Leuchten der Karten im
  Tab „Opportunities“.
- Die Varianten lassen sich mischen, z. B. Hintergrund aus A mit dem Kopf aus
  B.

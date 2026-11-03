# Guide-App: Abgleich mit der Vorlage

Erzeugt von `npm run guide:shots` auf 390×844 mit Fixtures. Soll aus `docs/design-mockups/*.dc.html`, Ist aus dem berechneten CSS.

## Home

| Selektor | Eigenschaft | Vorlage | Berechnet | Abweichung |
|---|---|---|---|---|
| `.screen` | padding | 22px 20px 12px | 22px 20px 12px | keine |
| `.home-title h1` | font-size | 28px | 28px | keine |
| `.home-title small` | font-size | 13px | 13px | keine |
| `.profile` | width | 48px | 48px | keine |
| `.guide-card` | padding | 14px | 14px | keine |
| `.guide-card` | border-radius | 22px | 22px | keine |
| `.guide-info strong` | font-size | 17px | 17px | keine |
| `.tile` | padding | 14px | 14px | keine |
| `.tile` | border-radius | 20px | 20px | keine |
| `.bar` | height | 60px | 60px | keine |
| `.bar button` | height | 48px | 48px | keine |
| `.bar button[aria-current]` | background-color | rgb(34, 30, 46) | rgb(34, 30, 46) | keine |
| `.bests` | border-radius | 24px | 24px | keine. Holds one line per guide instead of the best deal card (C2). |

## Mining path

| Selektor | Eigenschaft | Vorlage | Berechnet | Abweichung |
|---|---|---|---|---|
| `.screen` | padding | 18px 20px 12px | 18px 20px 12px | keine |
| `.screen` | row-gap | 14px | 14px | keine |
| `.back` | height | 36px | 44px | Raised to 44 px for the touch target rule. |
| `.back` | font-size | 13px | 13px | keine |
| `.ring-title h1` | font-size | 22px | 20px | Smaller head from the device test, so the open step fits without a scroll. |
| `.legend` | font-size | 12px | 12px | keine |
| `.legend i` | width | 9px | 9px | keine |
| `.stats` | padding | 14px 16px | 8px 12px | Smaller head from the device test, so the open step fits without a scroll. |
| `.stats` | border-radius | 20px | 16px | Smaller head from the device test, so the open step fits without a scroll. |
| `.stats` | row-gap | 12px | 6px | Smaller head from the device test, so the open step fits without a scroll. |
| `.stat-label` | font-size | 12px | 11px | Smaller head from the device test, so the open step fits without a scroll. |
| `.stat-value` | font-size | 22px | 17px | Smaller head from the device test, so the open step fits without a scroll. |
| `.stat-delta` | font-size | 13px | 12px | Smaller head from the device test, so the open step fits without a scroll. |
| `.step-rail` | width | 28px | 28px | keine |
| `.rail-top` | width | 3px | 3px | keine |
| `.rail-top` | height | 14px | 14px | keine |
| `.step-dot` | width | 22px | 22px | keine |
| `.row` | padding | 11px 0px 10px | 11px 0px 10px | keine |
| `.row-name` | font-size | 15px | 15px | keine |
| `.row-sub` | font-size | 12px | 12px | keine |
| `.row-side` | font-size | 12px | 12px | keine |
| `.row-sub.c-orange` | color | rgb(255, 170, 0) | rgb(255, 170, 0) | keine |
| `.card` | padding | 14px | 14px | keine |
| `.card` | border-radius | 18px | 18px | keine |
| `.card-name` | font-size | 17px | 17px | keine |
| `.card-box` | padding | 10px 12px | 10px 12px | keine |
| `.card-box` | border-radius | 14px | 14px | keine |
| `.card-stat` | font-size | 15px | 15px | keine |
| `.card-gain` | font-size | 13px | 13px | keine |
| `.card-foot` | font-size | 13px | 13px | keine |
| `.primary` | height | 44px | 44px | keine |
| `.step-dot.dot-current` | box-shadow | rgb(92, 200, 255) 0px 0px 14px 0px | rgb(92, 200, 255) 0px 0px 14px 0px | keine |

## Blaze path

| Selektor | Eigenschaft | Vorlage | Berechnet | Abweichung |
|---|---|---|---|---|
| `.screen` | row-gap | 12px | 12px | keine |
| `.stats` | padding | 12px 14px | 8px 12px | Smaller head from the device test, so the open step fits without a scroll. |
| `.stats` | row-gap | 10px | 6px | Smaller head from the device test, so the open step fits without a scroll. |
| `.stats` | column-gap | 8px | 8px | keine |
| `.stat-label` | font-size | 11px | 11px | keine |
| `.stat-value` | font-size | 18px | 15px | Smaller head from the device test, so the open step fits without a scroll. |
| `.stat-delta` | font-size | 12px | 12px | keine |
| `.chip` | padding | 8px 12px | 6px 10px | Smaller head from the device test, so the open step fits without a scroll. |
| `.chip` | border-radius | 14px | 12px | Smaller head from the device test, so the open step fits without a scroll. |
| `.chips` | font-size | 12px | 12px | keine |
| `.card` | padding | 12px 14px | 12px 14px | keine |
| `.card-name` | font-size | 16px | 16px | keine |
| `.card-box` | padding | 8px 12px | 8px 12px | keine |
| `.card-box` | border-radius | 12px | 12px | keine |
| `.card-stat` | font-size | 14px | 14px | keine |
| `.row` | padding | 10px 0px 9px | 10px 0px 9px | keine |

## Farming

| Selektor | Eigenschaft | Vorlage | Berechnet | Abweichung |
|---|---|---|---|---|
| `.screen` | padding | 18px 20px 12px | 18px 20px 12px | keine |
| `.ring-title h1` | font-size | 22px | 20px | Smaller head from the device test, so the open step fits without a scroll. |

## Ohne Vorlage

Diese Ansichten nutzen dieselben Bausteine und Tokens, es gibt keine Maße zum Abgleich:

- Stats of all guides
- Settings

## Gewollte Abweichungen aus dem Plan

- C1: Farming zeigt den Leerzustand statt des vollen Guides der Vorlage.
- C2: Home zeigt je Guide eine Zeile statt der Karte "BEST DEAL RIGHT NOW".
- Score: die Karte zeigt die Einheit der Score-Funktion (`% yield`) statt `more gems`.
- C5: Teil-Erfüllung, `API` und `Undo` auf einer Zeile haben keine Vorlage.
- Der Pfad scrollt, Kopf und Leiste bleiben fest (statt `overflow: hidden`).

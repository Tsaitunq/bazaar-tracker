# UX-Bestandsaufnahme (Stand v5.1.0, 2026-10-10)

Reine Analyse, am Code ist nichts geändert. Grundlage: `index.html`, `app.js`, `render.js`, `onboarding.js`, `tour.js`, `changelog.json`, `flips.js`, `npc.js`, `craft.js`, `forge.js`, `trends.js`, `timing.js`.

## 1. Was es an Erklärung heute gibt

| Kanal | Inhalt | Wo im Code |
|---|---|---|
| **B** Basis-Tour | 6 Stationen: A flip, Badges, Five lists, Opportunities, Find and sort, Settings | `tourSteps()` |
| **A** Advanced-Tour | 4 Stationen (Portfolio, Forge, Event radar, Trends), in der Android-App eine fünfte (Alerts) | `advancedSteps()` |
| **N** What's new | 12 Versionen, 32 Einträge, 16 davon mit „Show me“-Ziel | `changelog.json` |
| **H** How it works | 7 Begriffe: Margin, Market share, Profit/h, Stability score, Forge, Events, Trends | `HOW` |
| **?** Hilfe an Einstellungen | Jede Einstellung hat ein `?`, das ihren Text aufklappt (standardmäßig zu) | `enhanceHelp()` |
| **I** Text direkt in der Oberfläche | Leerzustände, Hinweise auf Karten, Intro-Absätze in den Einstellungen | `render.js`, `app.js` |
| Setup-Assistent | 5 Fragen, danach eine Übersicht mit einem Satz Begründung je Wert | `setupFormHtml()` |

Ablauf beim allerersten Start: Welcome → Basis-Tour (6) → Angebot Advanced-Tour → Advanced-Tour (4 oder 5) → Setup (5 Fragen) → Übersicht. Wer alles mitnimmt, klickt sich durch bis zu 11 Sprechblasen, 3 Fenster und ein Formular, bevor er die App benutzt.

## 2. Inventar

Spalten: B, A, N, H, ? wie oben, I = Text direkt an der Stelle. ● erklärt, ◐ nur gestreift, leer = nicht erwähnt.
„Lücke“ bewertet, ob ein Einsteiger das Element ohne Erklärung versteht: **ja** = erklärungsbedürftig und nirgends ausreichend erklärt, **teils** = erklärt, aber nur an einer Stelle, die Neulinge nie sehen (meist What's new, das neue Nutzer nicht bekommen).

### 2.1 Kopfzeile und Filterleiste

| Element | B | A | N | H | ? | I | Lücke |
|---|---|---|---|---|---|---|---|
| Zeitstempel „Updated 12:34:56“ | | | | | | | nein |
| Refresh-Knopf | | | | | | | nein |
| Automatisches Nachladen (Intervall) | | | | | ● | | nein |
| Pull-to-refresh | | | ● | | | ● | nein (Pille erklärt sich selbst) |
| `?`-Knopf (Hilfe-Fenster) | ● | | ● | | | | nein |
| Einstellungs-Knopf | ● | | | | | | nein |
| Suche über den ganzen Bazaar | ● | | ● | | | | nein |
| Grund-Zeile bei Suchtreffern („Volume too low“ …) | | | ● | | | ● | nein |
| Sortierung Profit/h, Profit/item, Margin | ◐ | | | ● | | | nein |
| Sortierung Stability | ◐ | | | ● | | | nein |
| Sortierung Trend | | ● | ● | ● | | | nein |
| Stern in der Filterleiste (nur Favoriten) | | | | | | | **ja**: reines Icon; die Tour erwähnt nur den Stern auf der Karte |
| Tabs | ● | | ● | | | | nein |
| Wischen zwischen Tabs | ● | | ● | | | | nein |
| Zeile „100 of 432 flips“ | | | | | | | **ja**: die Obergrenze von 100 Karten steht nirgends |
| Zeile „3 flips, 5 other items“ bei Suche | | | ◐ | | | | nein |
| Fehlerzeile „Update failed: …“ | | | | | | ● | nein |

### 2.2 Flip-Karte (Flips, Opportunities)

| Element | B | A | N | H | ? | I | Lücke |
|---|---|---|---|---|---|---|---|
| Was ein Flip praktisch ist (Buy Order setzen, füllen lassen, als Sell Offer einstellen) | ◐ | | | | | | **ja**: Welcome und Tour setzen das Wissen voraus |
| Profit/h | ● | | | ● | | | nein; aber nirgends auf der Karte als Schätzung markiert |
| Margin | ● | | | ● | | | nein |
| Buy order, Sell offer | ● | | | | | | nein |
| „normal: …“ (7-Tage-Median) | ● | | | ◐ | | | teils: „what it usually sells for“, dass es der Median von 7 Tagen ist, steht nur unter Trends |
| Profit/item | | | | ◐ | | | nein |
| Vol./week | | | | ◐ | ◐ | | **ja**: dass es das kleinere von Kauf- und Verkaufsvolumen ist, steht nirgends; als Begriff nie definiert |
| Badge stable / medium / unstable mit Zahl | ● | | ● | ● | | | nein |
| Badge provisional | ● | | ● | ● | | | nein |
| Badge suspicious | ● | | ◐ | | | | **ja**: nur „looks manipulated“. Die vier Regeln (Marge über 200 %, Marge über 50 % bei unter 100 Stück/h, weniger als 3 Orders auf einer Seite, Preis über 30 % über normal) stehen nirgends; What's new nennt nur die letzte |
| Trend-Badge (rising/falling/flat, below/above normal) | | ● | ● | ● | | | nein |
| Event-Badge | | ● | | ● | | | nein |
| Seltenheit (Farbstreifen, Wort in der Ecke) | | | ● | | | | teils; für SkyBlock-Spieler selbsterklärend |
| Stern (Favorit setzen) | ● | | ● | | | | nein |
| Was ein Favorit bewirkt: bleibt in Flips, auch wenn Filter ihn ausblenden | | | | | | | **ja** |
| Tippen auf die Karte öffnet die Detailseite | | | ◐ | | | | **ja**: keine Tour sagt das |
| Aufblitzen geänderter Zahlen | | | | | | | nein (Dekoration) |

### 2.3 Detailseite

| Element | B | A | N | H | ? | I | Lücke |
|---|---|---|---|---|---|---|---|
| Detailseite überhaupt | | | ● | | | | **ja** (siehe oben) |
| Diagramm Prices mit Legende | | | ● | | | ● | nein |
| Diagramm Margin | | | ● | | | ● | nein |
| Umschalter 24 h / 7 days | | | | | | | nein |
| Antippen zeigt exakte Werte | | | ● | | | | teils: nur What's new 3.0.0 |
| Abschnitt Forge auf der Seite eines geschmiedeten Items | | | ● | ● | | | nein |
| Back | | | | | | | nein |

### 2.4 Opportunities und Portfolio

| Element | B | A | N | H | ? | I | Lücke |
|---|---|---|---|---|---|---|---|
| Bedingungen für Opportunities | ● | | ● | | ● | ● | nein |
| Leerzustand („needs 24 hours of price history“) | | | | | | ● | nein |
| Portfolio-Block | | ● | ● | | ● | ● | nein |
| Spalten Stake, Profit/h; „up to X per flip · N planned“ | | ◐ | | | ◐ | | teils |
| Hinweis „Assumes 5% market share“ | | | | ● | | ● | nein |
| Portfolio ignoriert „Max. capital per flip“ und rechnet mit Total capital ÷ Parallel flips | | | | | | | **ja**: zwei Kapital-Einstellungen, deren Verhältnis nirgends steht. Das Setup setzt sie passend, danach laufen sie auseinander |

### 2.5 NPC, Craft, Forge

| Element | B | A | N | H | ? | I | Lücke |
|---|---|---|---|---|---|---|---|
| NPC-Tab: was ein NPC-Flip ist | ◐ | | ◐ | | | | **ja**: nur „other ways to earn“ |
| NPC price | | | | | | | **ja** |
| Profit (instant buy) | | | | | | | **ja**: Gewinn, wenn man sofort zum Sell-Offer-Preis kauft statt per Buy Order |
| NPC: keine Steuer, Vol./week ist hier nur das Verkaufsvolumen | | | | | | | **ja** |
| Craft-Tab: was ein Craft-Flip ist | ◐ | | ◐ | | | | **ja** |
| Cost, Revenue, Profit/craft | | | | | | | **ja**: Cost = alle Zutaten per Buy Order, Revenue schon nach Steuer |
| Crafts/h | | | | | | | **ja**: begrenzt durch das knappste Material, Market share und Kapital |
| Zutatenliste „32× Name @ Preis“ | | | | | | | nein |
| Forge-Tab, Karte | | ● | ● | ● | | ● | nein |
| Schalter „Bazaar only / Incl. AH“ | | ◐ | ◐ | ● | | | teils: nur im Setup als Frage 5; steht nicht in den Einstellungen |
| „AH sale – estimate“, Lowest BIN | | ● | ● | ● | | ● | nein |
| „Limited by: Forge time / Sales volume“ | | ◐ | ● | ● | | | nein |
| Derpy-Hinweis | | | ● | ● | | ● | nein |
| HotM-Filter | | ● | ● | | ● | | nein |

### 2.6 Event-Radar

| Element | B | A | N | H | ? | I | Lücke |
|---|---|---|---|---|---|---|---|
| Radar-Zeile, auf- und zuklappen | | ● | ● | ● | | | nein |
| Mayor, Minister, Perks | | ● | ● | ● | | ● | nein |
| „Typically affected“ | | ● | ● | ● | | | nein |
| „Cheaper / More expensive during …“, „Expected: …“ | | | ● | | | ◐ | teils: nur What's new 5.1.0 |
| „not enough data yet (1/3)“, „Usually −8% during event (seen 3 times)“ | | | ● | | | ◐ | **ja**: die Dreier-Regel steht nur in What's new; How it works „Events“ kennt die Preis-Muster noch nicht |
| „Buy before / Sell during: the 24h before the start, then the 6h it runs“ | | | ◐ | | | | **ja**: als Satz kaum lesbar |
| Election (Kandidaten, Prozent, Perks) | | | | | | ● | nein |
| „only with the … perk“ | | | | | | ● | nein |

### 2.7 Einstellungen

Alle Felder haben ein `?`. Lücken liegen im Zusammenspiel, nicht am einzelnen Feld.

| Element | B | A | N | H | ? | Lücke |
|---|---|---|---|---|---|---|
| Tax, Market share, Max. capital per flip | ◐ | | | ● | ● | nein |
| Min. volume/week (List), Refresh | | | | | ● | nein |
| Opportunities: Min. margin, Min. volume/week, Min. profit/h | ◐ | | | | ● | nein |
| Zwei Felder heißen „Min. volume/week“, zwei „Min. margin %“ | | | | | ◐ | **ja**: gleiche Beschriftung, verschiedene Wirkung (Liste gegen Opportunities, Opportunities gegen Favoriten-Alerts) |
| Portfolio: Total capital, Parallel flips | | ◐ | ◐ | | ● | nein |
| Forge: HotM tier | | ● | | | ● | nein |
| Market alerts, Cooldown (nur Android) | | ● | ● | | ● | nein |
| Favorite alerts, eigene Min. margin (nur Android) | | | | | ● | teils: keine Tour, kein What's new |
| Event alerts, Mayor alerts (nur Android) | | | ● | | ● | nein |
| Akku auf „Unrestricted“ stellen | | ● | | | | teils: nur in der Advanced-Tour, danach nirgends nachlesbar |
| „Notifications … are blocked“ | | | | | | nein (erscheint im Fehlerfall) |

### 2.8 Onboarding selbst

| Element | Beobachtung |
|---|---|
| Welcome, „Skip“ | Wer überspringt, bekommt das Setup nie angeboten. Es liegt dann nur hinter `?` → „Start setup“. |
| Tour, „Skip“ mittendrin | Ebenso: kein Setup, kein Angebot der Advanced-Tour. |
| Angebot Advanced-Tour | Text sagt „Four more stops“, in der Android-App sind es fünf. |
| Hilfe-Fenster | Vier Knöpfe und darunter sieben Definitionen als Fließtext; der Forge-Absatz allein hat rund 110 Wörter. |
| How it works | Fehlt: suspicious, NPC, Craft, Portfolio, Vol./week, Preis-Muster im Radar. |
| What's new 4.0.0 | Nennt „Three quick questions“ und „restart in the settings“; beides stimmt nicht mehr. Alte Einträge dürfen laut `CLAUDE.md` nicht geändert werden, also so lassen. |

### 2.9 Die Lücken nach Gewicht

1. Was ein Flip ist und dass eine Karte antippbar ist. Das betrifft die ersten 30 Sekunden.
2. NPC- und Craft-Tab: zwei von fünf Tabs ohne ein erklärendes Wort, mit eigenen Begriffen.
3. Suspicious: die wichtigste Warnung der App, ohne Begründung.
4. Zwei Kapital-Einstellungen und doppelte Feldnamen in den Einstellungen.
5. Favoriten: Wirkung und der Filter-Stern.
6. Preis-Muster im Radar: Formulierung und fehlender Eintrag in How it works.
7. Kleinkram: Obergrenze 100 Karten, Vol./week, Akku-Hinweis nicht nachlesbar.

## 3. Wo die App für Einsteiger zu voll ist

| Stelle | Befund |
|---|---|
| Erster Start | Bis zu 11 Sprechblasen plus Setup, bevor ein einziger Flip angesehen wurde. Die Advanced-Tour erklärt Forge und Radar jemandem, der noch nicht weiß, was eine Buy Order ist. |
| Basis-Tour, Station 1 | Fünf Begriffe in einer Blase (Profit/h, Margin, Buy order, Sell offer, normal). Station 2 bringt fünf weitere (stable, medium, unstable, provisional, suspicious). |
| Flip-Karte | Bis zu 4 Badges, 2 große Zahlen, 4 Fakten, dazu „normal“, Seltenheit und Stern: rund 12 Informationen je Karte. Für den ersten Flip braucht man 4 (Kaufpreis, Verkaufspreis, Gewinn, Warnung). |
| Forge-Karte | 6 Fakten, Zutatenliste, bis zu zwei Hinweissätze. Die dichteste Karte der App. |
| Fünf Tabs | Auf dem Handy scrollt die Leiste seitlich. NPC, Craft und Forge sind drei weitere Geschäftsmodelle mit eigenen Begriffen. |
| Radar über jeder Liste | Zugeklappt nur eine Zeile, aber auf allen fünf Tabs. Aufgeklappt drei Ebenen ineinander (Radar → Event → Items mit Mustern) und drei Abschnitte. |
| Opportunities | Radar, dann Portfolio mit eigener Tabelle, erst danach die Liste. Auf dem Handy liegt die erste Karte unter dem Falz. |
| Einstellungen | 11 Felder in 5 Gruppen im Web, 17 Bedienelemente in 7 Gruppen in der Android-App, als ein langes Formular, das die Liste nach unten schiebt. Die Erklärungen sind alle zugeklappt. |
| Sortierung | Fünf Optionen; Einsteiger brauchen eine. |
| Hilfe-Fenster | Textwand, siehe 2.8. |

Nicht zu voll: Kopfzeile, Suche, Detailseite, Leerzustände. Die sind knapp und sagen, was los ist.

## 4. Vorschläge

### 4.1 Einmalige Kontext-Hinweise

Idee: Erklärung dort und dann, wo man sie braucht, statt alles vorab in Touren.

Umsetzung, kleinste Form: ein Schlüssel `bt.hints` (Liste gesehener IDs) und eine Funktion `hint(id)`. Darstellung als nicht-modale Zeile im Seitenfluss mit „Got it“; die Klasse `.hint` gibt es in `style.css` schon. Kein Spotlight, kein Overlay: ein Hinweis darf nie blockieren.

Regeln:
- Höchstens ein Hinweis gleichzeitig, keiner während Tour oder Fenster offen sind.
- Wer die Tour-Station zum selben Thema gesehen hat, bekommt den Hinweis nicht mehr (Tour trägt die ID ein).
- Bestandsnutzer (`hadData`) starten mit allen Hinweisen als gesehen, außer für Features, die nach ihrer letzten Version kamen. So wird niemand über Bekanntes belehrt.
- Im Hilfe-Fenster ein Knopf „Show hints again“.

| ID | Auslöser | Ort | Text (Englisch, wie die App) |
|---|---|---|---|
| `detail` | erste Detailseite | über den Diagrammen | „Tap a chart to read exact values. Switch between 24 h and 7 days above it.“ |
| `card` | erste Liste, wenn Tour übersprungen | über der Liste | „Tap a card for its price history. Place a buy order at the Buy order price, then sell with a sell offer.“ |
| `suspicious` | erste Detailseite eines Items mit suspicious | unter den Badges | „Suspicious means: margin too good to be true, hardly any orders, or a price far above normal. Often someone is manipulating it.“ |
| `fav` | erster gesetzter Stern | über der Liste | „Favorites stay in Flips even when your filters hide them. The star next to the sort box shows only favorites.“ In der Android-App ergänzt um: „You can get alerts for them in the settings.“ |
| `opps` | erster Besuch Opportunities, wenn Tour übersprungen | über der Liste | Text der heutigen Tour-Station „Opportunities“ |
| `portfolio` | Portfolio erstmals mit Inhalt sichtbar | im Portfolio-Block | „A plan, not a promise: your total capital split over the best safe flips. It uses Total capital ÷ Parallel flips, not Max. capital per flip.“ |
| `npc` | erster Besuch NPC | über der Liste | „Buy with a buy order, sell to an NPC shop for a fixed price. No bazaar tax. Profit (instant buy) is what is left if you buy at once instead of waiting.“ |
| `craft` | erster Besuch Craft | über der Liste | „Buy the ingredients with buy orders, craft, sell the result. Cost and revenue already include tax. Crafts/h is limited by the scarcest ingredient.“ |
| `forge` | erster Besuch Forge | über dem Schalter | „Set your HotM tier in the settings to hide recipes you cannot forge. Incl. AH adds results that sell on the Auction House; those are estimates.“ |
| `radar` | erstes Aufklappen des Radars | im Radar oben | „Tap an event or perk to see the items it affects. A price pattern appears once it happened the same way three times.“ |
| `search` | erste Suche mit „other items“ | unter der Zählzeile | „Items below the line are not a flip right now. The grey text says why.“ |
| `settings` | erstes Öffnen der Einstellungen | oben im Formular | „Every option has a ? that explains it. Not sure what to enter? [Start setup]“ |
| `alerts` | Android, erstes Einschalten eines Alerts | unter dem Schalter | Akku-Satz aus der Advanced-Tour. Damit ist er dauerhaft erreichbar. |

Bewusst kein Hinweis für: Pull-to-refresh, Wischen, Seltenheit, Aufblitzen, Wahl im Radar. Das erklärt sich selbst oder ist unwichtig.

### 4.2 Einfach- und Profi-Modus

Eine Einstellung `mode` (`simple` oder `pro`) in `bt.settings`, als Umschalter ganz oben in den Einstellungen. Technisch `document.body.dataset.mode` plus CSS zum Ausblenden; in JS nur dort verzweigen, wo CSS nicht reicht (Tab-Liste `TABS` für das Wischen, Optionen der Sortierung).

Voreinstellung: neue Nutzer `simple`, Bestandsnutzer (`hadData`) `pro`. Niemandem wird etwas weggenommen.

| Bereich | Einfach | nur Profi |
|---|---|---|
| Tabs | Flips, Opportunities | NPC, Craft, Forge |
| Über der Liste | Portfolio (in Opportunities) | Event-Radar |
| Flip-Karte, Zahlen | Profit/h, Margin, Buy order, Sell offer | „normal“, Profit/item, Vol./week |
| Flip-Karte, Badges | stable/medium/unstable, provisional, suspicious | Trend, Event, Zahl hinter dem Stabilitäts-Badge, Seltenheits-Wort |
| Sortierung | Profit/h, Margin % | Profit/item, Stability, Trend |
| Suche, Favoriten, Refresh, Hilfe | ja | |
| Detailseite | Kennzahlen, Diagramm Prices | Diagramm Margin, Abschnitt Forge |
| Einstellungen | Modus, Tax, Total capital, Knopf „Start setup“; Android: Market alerts | Market share, Max. capital per flip, Min. volume/week, Refresh, alle drei Opportunities-Schwellen, Parallel flips, HotM; Android: Cooldown, Favorite alerts, Event- und Mayor-Alerts |
| Touren | Basis-Tour | Advanced-Tour |

Begründungen für die strittigen Zuordnungen:
- **Portfolio bleibt im Einfach-Modus.** Es beantwortet die Einsteigerfrage „was mache ich mit meinen Coins“ direkter als jede Liste. Platz dafür schafft der Wegfall des Radars.
- **Einstellungen im Einfach-Modus: 3 statt 11 Felder.** Die ausgeblendeten Werte bleiben, wie das Setup sie gesetzt hat. Im Einfach-Modus sollte „Max. capital per flip“ automatisch Total capital ÷ Parallel flips sein; das löst nebenbei die Lücke mit den zwei Kapital-Werten.
- **NPC ist Profi**, obwohl das Prinzip einfach ist: ein dritter Tab mit eigenen Begriffen kostet mehr, als er Einsteigern bringt.

Was mitbedacht werden muss:
- „Show me“ in What's new zeigt auf `#radar`, den Forge-Tab und `#sort`. Im Einfach-Modus fehlt das Ziel; `waitFor` liefert dann `null` und die Blase steht mittig. Funktioniert, sieht aber unbeholfen aus. Besser: Einträge mit Profi-Ziel im Einfach-Modus mit dem Zusatz „in Pro mode“ zeigen.
- Benachrichtigungen verlinken nur auf `#/flips`, `#/opps` und `#/item/…`; das bleibt in beiden Modi gültig.
- Der Wechsel auf Profi ist der natürliche Moment, die Advanced-Tour anzubieten (einmalig).
- Favoriten-Alerts hängen an `settings.alerts`; im Einfach-Modus ist der Schalter unsichtbar, ein eingeschalteter Alert läuft aber weiter. In Ordnung, solange der Modus nichts zurücksetzt.

### 4.3 Touren

**Basis-Tour: bei 6 Stationen bleiben, aber umbauen.** Heute sind Station 1 und 2 überladen, Station 3 und 4 sagen fast dasselbe.

| Neu | Titel | Inhalt | Herkunft |
|---|---|---|---|
| 1 | A flip | Was man tut: Buy Order zu diesem Preis, warten, Sell Offer zu jenem Preis. Karte antippen für den Verlauf. | neu, schließt Lücke 1 |
| 2 | Two numbers | Profit/h (Schätzung) und Margin. | Hälfte der alten Station 1 |
| 3 | Badges | stable, medium, unstable und suspicious. „provisional“ raus, das erklärt das Badge beim ersten Auftreten. | alte Station 2, gekürzt |
| 4 | Opportunities | Die sichere Auswahl; Wischen zwischen den Tabs. | alte Stationen 3 und 4 zusammen |
| 5 | Find, sort, favorites | Wie heute, plus der Filter-Stern. | alte Station 5 |
| 6 | Settings and help | Wie heute. Der „Done“-Knopf führt ins Setup. | alte Station 6 |

„normal“ fällt aus der Tour; im Einfach-Modus ist es ohnehin ausgeblendet.

**Reihenfolge beim ersten Start ändern:** Welcome → Basis-Tour → Setup → fertig. Die Advanced-Tour wird beim ersten Start nicht mehr angeboten.
- Das Setup nützt jedem Einsteiger, die Advanced-Tour nur wenigen. Heute steht das Setup am Ende der längsten Kette und entfällt bei jedem „Skip“.
- „Skip“ im Welcome und in der Tour sollte trotzdem einmal das Setup anbieten („Set up in 30 seconds?“).
- Die Advanced-Tour bleibt im Hilfe-Fenster und wird beim Wechsel in den Profi-Modus angeboten. Mit den Kontext-Hinweisen aus 4.1 ist sie weitgehend ersetzt; falls sie später niemand vermisst, kann sie weg.

**Advanced-Tour umsortieren und kürzen:**
- Reihenfolge heute: Opportunities → Forge → Flips → Flips → Einstellungen. Die Seite springt zweimal zurück. Neu in Tab-Reihenfolge: Trends, Event radar (beide Flips) → Portfolio (Opportunities) → Forge → Alerts.
- Forge-Station von rund 70 Wörtern auf zwei Sätze; die Einzelheiten stehen in How it works.
- „Four more stops“ aus der Schrittzahl berechnen statt fest zu schreiben.

**How it works ergänzen und entschlacken:**
- Neu: Suspicious (die vier Regeln), NPC flips, Craft flips, Portfolio, Vol./week. Events um die Dreier-Regel der Preis-Muster erweitern.
- Jeden Begriff als `<details>` zuklappen, damit das Fenster eine Liste von Stichworten ist statt einer Textwand. Das Muster gibt es im Radar schon.
- Im Einfach-Modus nur Margin, Profit/h, Stability score, Suspicious, Portfolio zeigen.

**Nebenbei auffällig, außerhalb der Erklärungen:**
- Zwei Felder „Min. volume/week“ und zwei „Min. margin %“ umbenennen (z. B. „Min. volume/week for the list“), unabhängig vom Modus.
- Text im Radar „Buy before / Sell during: the 24h before the start, then the 6h it runs“ in einen Satz umformulieren: „Buy in the 24 h before it starts, sell during the 6 h it runs.“

## 5. Empfohlene Reihenfolge

1. Basis-Tour umbauen und Setup vor die Advanced-Tour ziehen. Kleinster Eingriff, nur Texte und eine Zeile Ablauf in `tour.js`; behebt Lücke 1.
2. Kontext-Hinweise `npc`, `craft`, `suspicious`, `fav`, `settings`. Schließt die Lücken 2, 3 und 5.
3. How it works ergänzen und zuklappbar machen.
4. Einfach- und Profi-Modus. Größter Eingriff, größte Wirkung gegen die Fülle; erst danach lohnt die Entscheidung, ob die Advanced-Tour bleibt.

Jeder Schritt ist für Spieler sichtbar und braucht nach `CLAUDE.md` einen Eintrag in `changelog.json`.

## 6. Nicht geprüft

- Die App wurde nicht gestartet; alle Befunde stammen aus dem Code. Wie voll die Karten auf einem echten Handy wirken, ist daher geschätzt.
- Benachrichtigungstexte der Android-App (`AlertWorker.java`, `AlertLogic.java`) nur auf ihre Sprungziele geprüft, nicht auf Verständlichkeit.
- Keine Nutzungsdaten: welche Tabs und Einstellungen wirklich benutzt werden, ist unbekannt. Die Zuordnung Einfach/Profi ist ein begründeter Vorschlag, kein Messergebnis.

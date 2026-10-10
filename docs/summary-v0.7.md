# Version 0.7.0 – Zusammenfassung

Stand: 2026-10-10. Alles liegt auf dem lokalen Branch `feat/v0.7` (ab `main`,
Version 0.6.7). Nichts ist gepusht oder gemergt; `main`, die Live-Seite und
der Branch `data` sind unverändert.

Spec: `docs/spec-v0.7.md`. Entscheidungen: `DECISIONS.md`, Abschnitt
„Entscheidungen Version 0.7“. Minion-Quellen: `docs/minions-sources.md`.

## Fertig

| Teil | Commit | Was |
|---|---|---|
| Spec | `93ce625` | `docs/spec-v0.7.md` |
| 0 Navigation | `ef265c6` | Feste Leiste unten: Today, Trade, Minions, Market. Trade hat die fünf Tabs, Suche, Sortierung, Filter und das Wischen. Market zeigt den Radar (immer offen) und eine Trends-Liste. Einfach-Modus: nur Today und Trade. Letzter Bereich wird gemerkt, der Trade-Knopf öffnet den letzten Trade-Tab. Basic-Tour beginnt an der Leiste. „Show me“ für alte Radar-Einträge führt nach Market. |
| 1 Crafts im Portfolio | `c37d14e` | Zeile „Craft into X: +Y/h · uses N orders“ am Flip, dazu der Satz, dass das Rezept freigeschaltet sein muss. Nur Anzeige, nur Profi. |
| 2 Warnungen | `a0bb716` | Gespeicherter Plan (`bt.plan`), Banner über dem Portfolio, vier Schalter plus Schwelle und Cooldown in den Einstellungen, Hintergrund-Check im Android-Worker mit eigener Benachrichtigung. |
| 3 Today | `3bc2ada` | Portfolio-Kurzfassung, Warnungen, „Coming up“ (Events, Wahl, betroffene Items), drei neue Chancen seit dem letzten Besuch. Jeder Block verlinkt. |
| 4 Minions | `0e877ec` | 13 Minions, Setup aus Tier, Anzahl, Fuel, zwei Upgrades. Coins/Tag Bazaar gegen NPC, Fuel abgezogen, bester zuerst, „not confirmed“ für offene Werte. |
| Abschluss | dieser Commit | Changelog 0.7.0 (vier Einträge mit „Show me“), README, dieser Bericht. APK gebaut. |

Hilfetexte („How it works“) und Hints gibt es für alle neuen Bereiche: Today,
Minions, Areas, Portfolio warnings, Craft hints. Die Advanced-Tour hat eine
Station „Minions“.

## Zurückgestellt oder kleiner als verlangt

- **Minions: 13 statt etwa 15.** Iron und Gold fehlen absichtlich (Erz ist
  nicht am Bazaar, der Super Compactor braucht den Auto Smelter im zweiten
  Slot). Wheat, Melon, Pumpkin, Cactus, Glowstone und Fishing fehlen, weil
  ihre Archivseiten im Lauf nicht luden.
- **Das offizielle Wiki gibt es nicht mehr.** `wiki.hypixel.net` leitet seit
  Juli 2026 auf die Abschalt-Ankündigung um. Die Zahlen stammen aus den
  Kopien im Internet Archive (Januar bis März 2026), drei Regeln aus dem
  Fandom-Wiki. Bitte entscheide, ob dir das als Quelle reicht.
- **„Bestes Setup oben“** ist als „bester Minion für dein Setup oben“
  umgesetzt. Eine Suche über alle Fuel- und Upgrade-Kombinationen gibt es
  nicht.
- **Kein Test auf Gerät oder Emulator.** Die App ist nur per Headless-Browser
  mit Fixture-Daten angesehen worden (alle vier Bereiche, Einfach und Profi,
  500 px breit). Benachrichtigungen, Safe Area, Wischen und Pull-to-Refresh
  sind auf Android ungeprüft; siehe Checkliste.
- **Der Worker-Code (`AlertWorker`, `AlertsPlugin`) hat keine eigenen Tests**,
  nur die Logik darunter (`AlertLogic`). Er kompiliert und ist im APK.

## Entscheidungen, die du kennen solltest

Alle stehen mit Begründung in `DECISIONS.md`. Die wichtigsten:

1. Die Trade-Tabs behalten ihre Adressen (`#/flips` usw.); neu sind nur
   `#/today`, `#/minions`, `#/market`.
2. Die App startet im zuletzt benutzten Bereich, beim ersten Mal in Today.
3. Warnungen vergleichen mit dem Plan, den du zuletzt gesehen hast. Solange
   eine Preis- oder Suspicious-Warnung aktiv ist, bleibt dieser Plan stehen;
   „Got it“ übernimmt den aktuellen.
4. Die vier Schalter gelten nur für Benachrichtigungen und sind aus. Das
   Banner zeigt immer alles.
5. Craft-Hinweis rechnet mit dem Einsatz des Flips, „+Y/h“ ist der Mehrertrag.
6. Minions: „Bazaar“ ist der Sofortverkauf an Buy-Orders mit deiner Tax. Ob
   dort Tax anfällt, steht in keinem Wiki.

## Tests

- `node --test`: 231 Tests, alle grün (vorher 209). Neu: `tests/minions.test.js`
  sowie Fälle in `craft`, `flips`, `events`, `native`, `render`, `onboarding`.
- `gradlew testDebugUnitTest`: 27 Tests, alle grün (vorher 22). Neu:
  `planWarnings`, Wahl, „Mayor geht“, `readCandidates`, Texte.
- `planWarnings` hat in `flips.js` und `AlertLogic.java` dieselben Fälle.
  `computeFlip`, `opportunities` und `portfolio` sind unverändert.
- Keine Tests rufen die Hypixel-API auf. Die Ansicht im Browser lief mit
  `tests/fixtures/bazaar-sample.json`.
- APK: `android/app/build/outputs/apk/debug/app-debug.apk`, Version 0.7.0,
  enthält `minions.js`, kein Benutzerpfad und kein Name darin.

## Checkliste fürs Handy

Navigation
- [ ] Leiste unten sitzt über der Android-Gesten-Leiste, nichts ist verdeckt.
- [ ] Letzte Karte jeder Liste lässt sich ganz über die Leiste scrollen.
- [ ] Wischen wechselt nur in Trade den Tab, nicht in Today, Minions, Market.
- [ ] Pull-to-Refresh geht in allen vier Bereichen.
- [ ] Beim Tippen in die Suche verschwindet die Leiste und kommt zurück.
- [ ] App schließen und öffnen: derselbe Bereich ist wieder da.
- [ ] Einfach-Modus: nur Today und Trade, in Trade nur Flips und Opportunities.
- [ ] Zurück-Taste von einer Item-Seite führt in den Bereich, aus dem du kamst.
- [ ] Help → Start tour: erste Station zeigt die Leiste; Tour endet auf Today.
- [ ] Help → What's new → „Show me“: vier Stationen, jede trifft ihr Ziel.

Portfolio
- [ ] Opportunities: Zeilen mit „Craft into …“ sind plausibel (Rezept im
      Spiel nachsehen, Profit im Craft-Tab vergleichen).
- [ ] Einstellungen → Portfolio: „Price drop warning %“ und die vier Schalter
      sind da; Einschalten fragt nach der Benachrichtigungs-Erlaubnis.
- [ ] Warnung auslösen: Schwelle auf 0.5 stellen, App 15 bis 30 Minuten
      schließen. Kommt eine Benachrichtigung „N portfolio warnings“? Öffnet
      sie Opportunities? Steht dort dasselbe im Banner?
- [ ] „Got it“ lässt Preis-Warnungen verschwinden.
- [ ] Dieselbe Warnung kommt innerhalb des Cooldowns nicht noch einmal.

Today
- [ ] Zahlen im Portfolio-Block stimmen mit dem Opportunities-Tab überein.
- [ ] „Coming up“: Countdowns stimmen mit dem Spielkalender.
- [ ] Nach über 30 Minuten Pause zeigt „New since your last visit“ nur Neues.
- [ ] Alle vier Links führen in den richtigen Tab.

Minions
- [ ] Ein Minion, den du besitzt: „Time Between Actions“ im Spiel gegen
      `docs/minions-sources.md` prüfen (Tier wie im Setup).
- [ ] Items/Tag für diesen Minion gegen das, was er wirklich sammelt.
- [ ] Mit Super Compactor: stimmt die Menge Enchanted Items pro Tag?
- [ ] Hyper Catalyst: Fuel/Tag ist viermal der aktuelle Preis.
- [ ] Im Spiel: Wird beim Sofortverkauf Tax abgezogen? (offener Punkt)
- [ ] Felder des Setups sind bei 360 px Breite lesbar.

Danach, wenn alles passt: `git checkout main && git merge feat/v0.7`.

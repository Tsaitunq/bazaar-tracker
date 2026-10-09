# Bazaar-Tracker V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Installierbare Dark-Mode-PWA, die Hypixel-Bazaar-Flips berechnet, filtert, sortiert und verdächtige Items markiert.

**Architecture:** Statische Seite ohne Build. `flips.js` und `names.js` sind reine, in Node testbare Module; `app.js` hält Zustand, lädt die API, rendert die Liste. Ein Service Worker cacht nur die App-Shell.

**Tech Stack:** Vanilla JS (ES-Module), CSS, `node --test`, keine Abhängigkeiten.

**Spec:** `docs/superpowers/specs/2026-10-09-bazaar-tracker-design.md`

## Global Constraints

- Keine Abhängigkeiten, kein Build-Schritt.
- Nur relative Pfade (GitHub Pages unter `/<repo>/`).
- Nur Dark Mode, Texte deutsch, Zahlen in `de-DE`.
- Bazaar: `https://api.hypixel.net/v2/skyblock/bazaar`; Items: `https://api.hypixel.net/v2/resources/skyblock/items`.
- Buy-Order-Preis = `sell_summary[0].pricePerUnit`, Sell-Offer-Preis = `buy_summary[0].pricePerUnit`.
- `localStorage`-Schlüssel: `bt.settings`, `bt.favs`, `bt.names`.
- Kein Push zu GitHub ohne Freigabe.

## Review Focus

1. Produkt mit leerem `sell_summary` oder `buy_summary`: wird übersprungen, kein `NaN` in der Liste. Test in Task 1.
2. Fehlendes `quick_status`: Volumen 0, Item gilt als verdächtig, kein Absturz. Test in Task 1.
3. Kaputtes JSON oder gesperrtes `localStorage`: App startet mit Standardwerten. Task 3 (`load`/`save` mit try/catch), manuell geprüft.
4. API-Fehler oder `success: false`: alte Liste bleibt, Fehlerzeile erscheint, nächster Versuch läuft. Task 3, manuell geprüft.
5. Ungültige gespeicherte Einstellung (Intervall 0, unbekannte Steuer): fällt auf Standard zurück, kein Refresh-Dauerfeuer. Task 3.

---

### Task 1: Flip-Rechnung

**Files:** Create `flips.js`, `tests/flips.test.js`, `package.json` (`"type": "module"`, Script `test: node --test`).

**Interfaces – Produces:**

- `computeFlip(id, product, tax, maxCapital) → Flip | null`
- `buildFlips(products, { tax, minVolume, maxCapital, sort }) → Flip[]`
- `Flip = { id, buy, sell, profit, margin, weekVol, hourVol, profitHour, suspicious }`
- `tax` ist ein Bruch (`0.0125`), `sort` ∈ `profitHour | profit | margin`.

- [ ] Tests schreiben: buy 100 / sell 200 / Steuer 0,0125 → `profit` 97,5, `margin` 0,975; Wochenvolumen `min(1 680 000, 3 360 000)` → `hourVol` 10 000; `maxCapital` 5000 → `profitHour` 4875; `maxCapital` 0 → 975 000; leere Orderbuch-Seite → `null`; fehlendes `quick_status` → `weekVol` 0, `suspicious` true; Warnregel (Marge > 0,5 und `hourVol` < 100; Orders < 3); `buildFlips` filtert `profit ≤ 0`, `weekVol < minVolume`, `buy > maxCapital` und sortiert absteigend.
- [ ] `node --test` → schlägt fehl (Modul fehlt).
- [ ] `flips.js` nach Spec-Abschnitt „Rechnung“ umsetzen.
- [ ] `node --test` → grün. Commit.

### Task 2: Namen

**Files:** Create `names.js`, `tests/names.test.js`.

**Interfaces – Produces:**

- `fallbackName(id) → string`
- `nameMap(items) → { [id]: name }` (entfernt `§x`-Farbcodes)
- `loadNames() → Promise<{ [id]: name }>`, wirft nie; nutzt `bt.names` 7 Tage, bei Netzfehler alter Cache oder `{}`.

- [ ] Tests: `ENCHANTMENT_ULTIMATE_WISE_5` → „Ultimate Wise 5“, `SHARD_SEA_ARCHER` → „Sea Archer Shard“, `ESSENCE_WITHER` → „Wither Essence“, `FACTION_RABBIT_WALKER` → „Faction Rabbit Walker“; `nameMap` mit `§6Name`.
- [ ] Umsetzen, `node --test` grün. Commit.

### Task 3: Oberfläche

**Files:** Create `index.html`, `style.css`, `app.js`.

**Interfaces – Consumes:** `buildFlips`, `loadNames`, `fallbackName`.

- [ ] `index.html`: Kopf (Titel, `#stamp`, `#refresh`, `#toggle-settings`), Leiste (`#search`, `#sort`, `#fav-only`), `#settings` (Steuer 1,25 / 1,125 / 1,0; Mindestvolumen; max. Kapital; Intervall 1 / 2 / 5), `#error` (`role="alert"`), `#ptr`, `#list`.
- [ ] `app.js`: Standardwerte `{ tax: 1.25, minVolume: 100000, maxCapital: 5000000, interval: 2, sort: 'profitHour', favOnly: false }`; ungültige gespeicherte Werte auf Standard; `refresh()` mit Fehlerbehandlung; Timer pausiert bei `document.hidden`; Pull-to-Refresh ab 70 px bei `scrollY === 0`; höchstens 100 Karten; alle API-Texte HTML-escaped.
- [ ] `style.css`: dunkle Tokens, Tippflächen ≥ 44 px, `overscroll-behavior-y: contain`.
- [ ] Prüfen: lokaler Server, Chrome headless bei 412 px Breite, Screenshot und DOM gegen die echte API. Commit.

### Task 4: PWA

**Files:** Create `manifest.webmanifest`, `sw.js`, `icons/icon-192.png`, `icons/icon-512.png`.

- [ ] Manifest: `start_url` und `scope` `./`, `display: standalone`, Icons mit `any` und `maskable`.
- [ ] `sw.js`: Network-first nur für Same-Origin-GET, Shell beim Install vorab cachen.
- [ ] Prüfen: Manifest ist gültiges JSON, alle Shell-Dateien antworten mit 200. Commit.

# Optimizer Paket 1: Sync und Dekodierung, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "Sync profile" holt das eigene Coop-Profil von Hypixel, dekodiert Inventare und zeigt lokal, was erkannt wurde. Keine Haken, keine Stats, keine Rangliste.

**Architecture:** `nbt.js` dekodiert, `profile.js` macht aus einem Member den gespeicherten Stand, `sync.js` enthält Abruf, Profilwahl und Fehlerklassen. Key und Stand liegen über `AlertsPlugin` und `ProfileStore.java` in `noBackupFilesDir`. Task 4 prüft die Feldpfade an einem echten Abruf, bevor `profile.js` entsteht.

**Tech Stack:** ES-Module ohne Abhängigkeiten, `DecompressionStream`, `node --test`, Capacitor 8, Java, Android Keystore.

**Spec:** `docs/spec-optimizer.md` (Abschnitte 1, 2, 7 und Paket 1 in Abschnitt 8)

## Global Constraints

- Branch `feat/optimizer`. Commits enden mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Key nie im Chat, Code, Log, Export, `localStorage` oder einer Fehlermeldung. Eingabe nur in der App.
- Keine UUID und keine Profildaten in Repo, Commit oder Testausgabe. Echte Daten nur unter `personal/fixtures/`.
- Keine neuen Abhängigkeiten. Kein CapacitorHttp.
- Tests rufen nie die API auf (`CLAUDE.md`).
- UI-Texte Englisch. Farben nur als Tokens in `:root` (`tests/contrast.test.js`). Jede neue Root-`.js` in `SHELL` (`sw.js`, von `tests/sw.test.js` geprüft).
- Sync-UI nur in `#personal-settings` und im Progress-Bereich; ohne Plugin (Browser) unsichtbar.
- Nach jeder Ersetzung per grep prüfen, ob sie angekommen ist (`CLAUDE.md`).

## Review Focus

1. Key beim Einfügen mit Leerzeichen oder Zeilenumbruch: wird getrimmt gespeichert und gesendet (Test in Task 3).
2. Gemerktes Profil gelöscht oder Coop verlassen: neue Auswahl statt Fehler oder falsches Profil (Test in Task 3).
3. Doppeltipp auf Sync: genau eine Anfrage (Test in Task 3).
4. Inventory-API nach einem guten Sync ausgeschaltet: erkannte Items bleiben, Hinweis erscheint (Test in Task 5).
5. Profilname oder Item-Name mit HTML: wird escaped angezeigt (Test in Task 6).

---

### Task 1: NBT-Dekodierung

**Files:**
- Create: `nbt.js`
- Test: `tests/nbt.test.js`, `tests/fixtures/nbt-encode.js` (kleiner Encoder nur für Tests; gzip über `node:zlib`)
- Modify: `sw.js` (`nbt.js` in `SHELL`)

**Interfaces:**
- Produces: `readNbt(bytes: Uint8Array) -> object`, `async decodeInventory(base64: string) -> object[]` (Liste aus Root-Feld `i`; leerer Slot ist `{}`). Beide werfen bei kaputten Daten.

- [ ] **Step 1: Failing tests schreiben**

```js
test('decodeInventory reads a slot with nested attributes', async () => {
  const b64 = encodeInventory([{ id: 278, Count: 1, tag: { ExtraAttributes: { id: 'DIVAN_DRILL', modifier: 'jaded', enchantments: { fortune: 4 } }, display: { Lore: ['§7Mining Speed: §a+1,800'] } } }]);
  const [slot] = await decodeInventory(b64);
  assert.equal(slot.tag.ExtraAttributes.id, 'DIVAN_DRILL');
  assert.equal(slot.tag.ExtraAttributes.enchantments.fortune, 4);
  assert.deepEqual(slot.tag.display.Lore, ['§7Mining Speed: §a+1,800']);
});
test('an empty slot decodes to an empty object', async () => { /* encodeInventory([{}]) -> [{}] */ });
test('readNbt covers all tag types', () => { /* Byte, Short, Int, Long, Float, Double, Byte_Array, String, List, Compound, Int_Array, Long_Array */ });
test('a long beyond the safe range stays exact as a string', () => { /* 2n**60n -> '1152921504606846976'; 5n -> 5 */ });
test('truncated, non-gzip and absurd-length data reject', async () => { /* gekürzt, 'bm90Z3ppcA==', Listenlänge 2**31-1, Verschachtelung > 64 */ });
```

- [ ] **Step 2: `node --test tests/nbt.test.js` ausführen.** Erwartet: FAIL, Modul fehlt.
- [ ] **Step 3: `readNbt` und `decodeInventory` schreiben.** Big-Endian per `DataView`, Strings per `TextDecoder`. Long: `Number` wenn sicher, sonst String, damit der Stand JSON-tauglich bleibt. Grenzen: Tiefe max. 64, Länge nie größer als die verbleibenden Bytes. Fehlt `DecompressionStream`, wirft die Funktion.
- [ ] **Step 4: `npm test`.** Erwartet: alles PASS.
- [ ] **Step 5: Commit** `feat: decode SkyBlock inventories from gzipped NBT`

### Task 2: Sicherer Speicher

**Files:**
- Create: `android/app/src/main/java/com/tsaitunq/bazaarflip/ProfileStore.java`
- Modify: `AlertsPlugin.java` (Methoden nach `setNames`), `native.js`
- Test: `tests/native.test.js`

**Interfaces:**
- Produces (Plugin): `setApiKey({key})`, `getApiKey() -> {key|null}`, `clearApiKey()`, `saveProfile({json})`, `loadProfile() -> {json|null}`, `clearProfile()`.
- Produces (`native.js`): `canSync() -> boolean`, `async getApiKey() -> string|null`, `async setApiKey(key) -> boolean`, `async clearProfileData() -> boolean` (Key und Stand), `async loadProfile() -> object|null`, `async saveProfile(obj) -> boolean`. Fehler ergeben `null` bzw. `false` wie bei `loadHeld`.

- [ ] **Step 1: Failing tests in `tests/native.test.js` schreiben:** mit dem dortigen `globalThis.Capacitor`-Muster: ohne Plugin `canSync() === false`, `getApiKey() === null`, `setApiKey('x') === false`; Plugin, das wirft, ergibt `null`/`false`; `saveProfile({a:1})` ruft das Plugin mit `{ json: '{"a":1}' }`; `loadProfile` mit kaputtem JSON ergibt `null`.
- [ ] **Step 2: `node --test tests/native.test.js`.** Erwartet: FAIL.
- [ ] **Step 3: `native.js` ergänzen.**
- [ ] **Step 4: `ProfileStore.java` schreiben.** Dateien `no_backup`-Verzeichnis über `getNoBackupFilesDir()`: `hypixel.key` (IV + AES/GCM/NoPadding, Keystore-Alias `hypixel_key`, 256 bit, ohne User-Auth) und `profile.json`. Lesefehler am Key (fehlender Alias, `AEADBadTagException`, `KeyPermanentlyInvalidatedException`) löschen die Datei und liefern `null`, wie "kein Key" (Spec, Risiko Keystore). Schreiben atomar über `.tmp` plus `renameTo`. Kein `Log`; `call.reject` nur mit festen Texten, ohne Exception-Objekt, damit nichts vom Key in Fehlern steht.
- [ ] **Step 5: Plugin-Methoden in `AlertsPlugin.java` ergänzen,** jede delegiert an `ProfileStore`.
- [ ] **Step 6: `npm test` und `npm run android:build`.** Erwartet: PASS und `BUILD SUCCESSFUL`.
- [ ] **Step 7: Commit** `feat: keep the API key and profile in encrypted, non-backed-up storage`

### Task 3: Abruf, Profilwahl, Anonymisieren, temporärer Knopf

**Files:**
- Create: `sync.js`, `tests/sync.test.js`
- Modify: `sw.js`, `index.html` (`#hypixel-profile`-Block in `#personal-settings`, nach dem Switch), `app.js`, `ProfileStore.java`, `AlertsPlugin.java`, `style.css` nur falls nötig

**Interfaces:**
- Consumes: Task 2.
- Produces in `sync.js`:
  - `normalizeUuid(s) -> string|null`: 32 Hex, klein, ohne Bindestriche.
  - `cleanKey(s) -> string|null`: getrimmt; leer ergibt `null`. Keine Formatprüfung, das Format ist nicht dokumentiert.
  - `async fetchProfiles({ uuid, key, get = fetch }) -> { ok: true, profiles } | { ok: false, error, retryIn? }`, `error` aus `'key' | 'input' | 'limit' | 'network' | 'format'`.
  - `eligibleProfiles(profiles, uuid) -> profile[]`
  - `chooseProfile(list, savedId) -> { profile } | { choices } | { none: true }`
  - `anonymize(profile, uuid) -> object`
  - `syncMessage(error, retryIn) -> string`
  - `createSync({ store, get, now, summarize }) -> { run(savedId) -> Promise<Result> }`; `Result`: `{ status: 'ok', state } | { status: 'choose', choices } | { status: 'error', error, retryIn? } | { status: 'busy' }`.
- `store` hat die Form `{ getApiKey, loadProfile, saveProfile }`; `state` ist `{ uuid, profileId, profileName, syncedAt, summary }`.

- [ ] **Step 1: Failing tests schreiben**

```js
test('fetchProfiles sends the key as a header, never caches and never puts it in the url', async () => {
  let seen; await fetchProfiles({ uuid: U, key: 'K', get: async (url, o) => { seen = { url, o }; return json(200, { success: true, profiles: [] }); } });
  assert.equal(seen.url, `https://api.hypixel.net/v2/skyblock/profiles?uuid=${U}`);
  assert.deepEqual(seen.o, { headers: { 'API-Key': 'K' }, cache: 'no-store' });
});
test('HTTP errors map to error classes', async () => { /* 403 key; 400, 422 input; 429 limit mit retryIn aus RateLimit-Reset; get wirft -> network; kein JSON oder success:false bei 200 -> format */ });
test('no message contains the key or uuid', () => { /* für alle Klassen: syncMessage enthält weder Key noch UUID */ });
test('normal profiles with this member only', () => { /* filtert fremdes Profil, deletion_notice, game_mode ironman/bingo/stranded */ });
test('chooseProfile: saved id, then selected, then ask', () => { /* savedId trifft; savedId weg + selected; kein selected, 2 Treffer -> choices; einer -> profile; 0 -> none */ });
test('anonymize keeps only this member and removes coop traces', () => {
  const out = JSON.stringify(anonymize(coopProfile, U));
  for (const secret of [U, MATE, 'profileid', 'CuteName', 'banking', 'coop_invitation']) assert.ok(!out.includes(secret));
  assert.ok(out.includes('"self"'));
});
test('a pasted key is trimmed', () => { assert.equal(cleanKey('  abc\n'), 'abc'); assert.equal(cleanKey(' '), null); });
test('a second run while one is busy sends no second request', async () => { /* zweites run -> busy, get 1x */ });
test('a run within 60 s of the last success sends no request', async () => { /* error 'limit', retryIn > 0 */ });
test('an error keeps the stored state', async () => { /* 403: saveProfile nicht aufgerufen */ });
test('coop mates never reach summarize or storage', async () => { /* summarize bekommt members[U]; gespeichertes JSON ohne MATE */ });
```

- [ ] **Step 2: `node --test tests/sync.test.js`.** Erwartet: FAIL.
- [ ] **Step 3: `sync.js` schreiben.** Meldungstexte wörtlich aus Spec 1.7. `anonymize`: nur `members[uuid]` unter Schlüssel `self`; entfernt `profile_id`, `cute_name`, `banking`, `community_upgrades`, `member.profile.coop_invitation`; ersetzt die UUID im serialisierten JSON. Kein `console.*`. In dieser Task übergibt `app.js` als `summarize` nur `(member) => ({})`.
- [ ] **Step 4: Settings-UI ergänzen.** Felder UUID und Key (`type="password"`, `autocomplete="off"`), Buttons Save und "Remove key and profile data"; nach dem Speichern nur "Key saved". UUID im Profilstand. Der Block ist versteckt, solange `!canSync()`. Knopf **Sync profile** mit Statuszeile `role="status"`. Bei `choose` Auswahl nach `cute_name` mit Mitgliederzahl.
- [ ] **Step 5: Temporär: `saveFixture({json})` in Plugin/Store** schreibt `no_backup/profile-fixture.json`; Knopf "Save test copy" ruft `anonymize` auf der letzten Antwort auf. Beides trägt den Kommentar `shortcut: temporary for field check, removed in Task 6`.
- [ ] **Step 6: `npm test`, `npm run android:build`.** Erwartet: PASS, `BUILD SUCCESSFUL`.
- [ ] **Step 7: Commit** `feat: fetch the SkyBlock profile on demand with clear errors`

### Task 4: Prüfstopp mit echtem Abruf (mit dir)

**Files:**
- Create: `scripts/check-fixture.mjs` (temporär)
- Modify: `docs/spec-optimizer.md`

Voraussetzung: Handy mit USB-Debugging oder Emulator, API-Settings im Profil an.

- [ ] **Step 1: `scripts/check-fixture.mjs <file>` schreiben.** Gibt nur Struktur aus: vorhandene Schlüssel und Typen, Anzahl Slots je Inventar, Stichprobe der Schlüssel in `ExtraAttributes` und `skill_tree`, Lore-Zeilen nur mit durch `N` ersetzten Zahlen und nur für bekannte Stat-Namen. **Keine Werte, Namen, UUIDs.** Bricht ab, wenn die Ausgabe ein UUID-Muster enthält.
- [ ] **Step 2: Du installierst das APK, trägst Key und UUID ein, tippst Sync und "Save test copy".** Der Key taucht in diesem Ablauf nirgends am Rechner auf.
- [ ] **Step 3: Datei holen, in Git Bash, damit `>` nicht UTF-16 schreibt:**

```bash
mkdir -p personal/fixtures
adb exec-out run-as com.tsaitunq.bazaarflip cat no_backup/profile-fixture.json > personal/fixtures/profile.json
git check-ignore personal/fixtures/profile.json
```
Erwartet: Pfad wird ausgegeben (ignoriert).

- [ ] **Step 4: Backup-Ausnahme prüfen:** `adb exec-out run-as com.tsaitunq.bazaarflip ls no_backup` zeigt `hypixel.key`, `profile.json`. `adb exec-out run-as com.tsaitunq.bazaarflip cat no_backup/hypixel.key` ist kein Klartext (nur Länge und Stichprobe auf Hex/UUID-Muster prüfen, nicht ausgeben).
- [ ] **Step 5: `node scripts/check-fixture.mjs personal/fixtures/profile.json` auswerten.** Zu klären: alle Pfade aus Spec 2.2, `wardrobe_contents`, Form von `skill_tree`, `gems`, Lore-Format mit Klammern, leere Slots, `selected` im Coop. Fehlt die Wardrobe, greift die Gegenmaßnahme aus Spec 9.
- [ ] **Step 6: Spec korrigieren:** geprüfte Punkte auf `[geprüft]` setzen, falsche Pfade ersetzen, Abholweg in Abschnitt 7 von `adb pull` auf `run-as` ändern. Abweichungen, die Tasks 5 oder 6 ändern, dort eintragen.
- [ ] **Step 7: Commit** nur Spec und Skript, `docs: confirm profile field paths against a real response`. Vorher `git diff --cached` auf UUID-Muster prüfen.

### Task 5: Member zu gespeichertem Stand

**Files:**
- Create: `profile.js`, `tests/profile.test.js`, `tests/profile-fixture.test.js`
- Modify: `sw.js`, `app.js` (echtes `summarize`, im Sync Vorstand mitgeben)

**Interfaces:**
- Consumes: `decodeInventory` (Task 1).
- Produces: `parseLore(lines: string[]) -> { STAT: number }`; `readItem(slot, where) -> Item|null`, Form aus Spec 2.3; `async summarize(member, previous = null) -> Summary`.
- `Summary`: `{ items: Item[], pets: [{type, exp, tier, active, heldItem}], mp, selectedPower, tuning, hotm, collections, skills, slayer, missing: { inventory: bool, collections: bool, skills: bool } }`. Pfade wie in Task 4 bestätigt.

- [ ] **Step 1: Failing tests schreiben**

```js
test('parseLore takes the first number and strips colours', () => {
  assert.deepEqual(parseLore(['§7Mining Speed: §a+1,234 §9(+20)', '§7Pristine: §a+2.5', '§7Unrelated text']), { MINING_SPEED: 1234, PRISTINE: 2.5 });
});
test('readItem finds reforge, enchants, gems, recomb, stars, parts', () => { /* eigene ExtraAttributes -> Item-Normalform */ });
test('readItem returns null for an empty slot and keeps no item uuid', () => { /* {} -> null; JSON ohne uuid */ });
test('summarize reads every storage and marks where', async () => { /* armor, equipment, wardrobe, inv, ender, backpacks, talisman */ });
test('missing APIs are reported, not treated as empty', async () => { /* ohne inventory, collection, experience */ });
test('inventory turned off keeps the items of the last sync', async () => { /* summarize(ohneInventory, vorher).items == vorher.items, missing.inventory true */ });
test('one broken inventory does not lose the others', async () => { /* kaputtes Backpack: übrige Items da */ });
```

Die Normalform enthält weder Lore-Text noch Item-UUID (Spec 2.6). `lore` ist nur das Ergebnis von `parseLore`. Stat-Namen: Liste aus Spec 3.3. Kaputte einzelne Inventare werden übersprungen; ist alles kaputt, wirft `summarize`, und `createSync` meldet `format`.

- [ ] **Step 2: `node --test tests/profile.test.js`.** Erwartet: FAIL.
- [ ] **Step 3: `profile.js` schreiben, in `app.js` als `summarize` einsetzen.**
- [ ] **Step 4: `tests/profile-fixture.test.js` schreiben:** `{ skip: !existsSync('personal/fixtures/profile.json') }`; prüft nur Formen (mindestens ein Item, Item-Felder korrekt typisiert, keine UUID im Ergebnis), gibt keine Werte aus.
- [ ] **Step 5: `npm test`.** Erwartet: PASS; ohne Fixture wird der Test übersprungen.
- [ ] **Step 6: Laufzeit prüfen:** Im Debug-Lauf auf dem Handy die Dekodierdauer einmal per `performance.now()` messen, Zahl notieren, Messcode nicht committen. Über 2 s: Dekodierung nacheinander mit `await` zwischen Inventaren und Statuszeile "Reading…".
- [ ] **Step 7: Commit** `feat: turn a profile member into the stored gear summary`

### Task 6: Anzeige, Absicherung, Release

**Files:**
- Modify: `sync.js` (`syncView`), `progress.js` (`progressView`-Parameter `syncBar`), `app.js`, `index.html`, `style.css`, `changelog.json`, `AlertsPlugin.java`, `ProfileStore.java`
- Delete: `scripts/check-fixture.mjs`, temporärer Knopf und `saveFixture`
- Test: `tests/sync.test.js`, `tests/progress.test.js`

**Interfaces:**
- Consumes: `Summary` (Task 5).
- Produces: `syncView(state, now, esc) -> string` mit Sync-Knopf `data-sync="run"`; `progressView({..., syncBar = ''})` setzt ihn über die Guide-Umschaltung. Bestehende Tests bleiben unverändert grün.

- [ ] **Step 1: Failing tests schreiben**

```js
test('syncView shows age, profile and what was seen', () => { /* 'Seen: 4 armor, 6 equipment, 2 weapons, 40 accessories, 23 pets · MP 823' */ });
test('syncView warns after 21 days without a sync', () => { /* Tag 20 kein Hinweis, Tag 21 Hinweis */ });
test('syncView names a switched-off API with the menu path', () => { /* missing.inventory -> 'SkyBlock Menu → Settings → API Settings' */ });
test('syncView escapes profile and item names', () => { /* '<img>' erscheint nicht roh */ });
test('export after a sync has no key, uuid or profile data', () => { /* exportData ist unverändert; Ausgabe enthält weder U noch Key */ });
test('the key header exists only in sync.js and nothing logs or stores there', () => {
  /* Root-*.js und index.html: 'API-Key' nur in sync.js; 'console.' und 'localStorage' weder in sync.js noch profile.js noch nbt.js */
});
```

- [ ] **Step 2: `npm test`.** Erwartet: die neuen schlagen fehl.
- [ ] **Step 3: `syncView` schreiben, `syncBar` einhängen, Klick `data-sync="run"` an `createSync` binden.** Nur bei `canSync()` sichtbar. "Remove key and profile data" löscht Key und Stand und braucht eine zweite Bestätigung wie `reset-yes`. Manuelle Haken bleiben.
- [ ] **Step 4: Temporäres entfernen.** Danach `git grep -n "saveFixture\|check-fixture\|Save test copy"`: keine Treffer.
- [ ] **Step 5: `changelog.json`:** neu oben `0.10.0`, Datum des Releases, ein Eintrag `{ "title": "Sync your profile", "text": "Progress can now read your own SkyBlock profile with your personal API key, stored only on this phone.", "personal": true }`.
- [ ] **Step 6: `npm test`, `npm run android:build`.** Erwartet: PASS, `BUILD SUCCESSFUL`.
- [ ] **Step 7: Am Gerät prüfen:** falscher Key zeigt die 403-Meldung und lässt den Stand; Flugmodus zeigt "No connection to Hypixel."; Inventory-API aus zeigt den Hinweis; Remove leert `no_backup`; App-Neustart behält Key und Stand. Export-Text enthält keinen Key.
- [ ] **Step 8: Commit** `feat: sync status in Progress and removal of key and profile data`

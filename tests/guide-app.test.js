import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseRoute, syncOutcome, applyImport, stampAll, swipeTarget, swipeAxis, swipeLands } from '../guide/model.js';
import { exportData, importData, stepKey } from '../progress.js';
import { homeView } from '../guide/views/home.js';
import { settingsView } from '../guide/views/settings.js';
import { miningSettings } from '../optimizer.js';

const guide = { id: 'mine', title: 'Mining', area: 'mining', sections: [{ name: 'Main', steps: [{ text: 'Jade' }, { text: 'Topaz' }] }] };
const app = readFileSync(new URL('../guide/app.js', import.meta.url), 'utf8');

test('parseRoute reads each route, an unknown guide goes home', () => {
  const guides = [guide];
  assert.deepEqual(parseRoute('', guides), { page: 'home' });
  assert.deepEqual(parseRoute('#/', guides), { page: 'home' });
  assert.deepEqual(parseRoute('#/stats', guides), { page: 'stats' });
  assert.deepEqual(parseRoute('#/settings', guides), { page: 'settings' });
  assert.deepEqual(parseRoute('#/guide/mine/best', guides), { page: 'guide', id: 'mine', tab: 'path' });
  assert.deepEqual(parseRoute('#/guide/mine/stats', guides), { page: 'guide', id: 'mine', tab: 'path' });
  assert.deepEqual(parseRoute('#/guide/mine/nope', guides), { page: 'guide', id: 'mine', tab: 'path' });
  assert.deepEqual(parseRoute('#/guide/farming/path', guides), { page: 'guide', id: 'farming', tab: 'path' });
  assert.deepEqual(parseRoute('#/guide/other/path', guides), { page: 'home' });
  assert.deepEqual(parseRoute('#/what', guides), { page: 'home' });
});

test('marks of pg.checks use the keys of the existing export', () => {
  const [section] = guide.sections;
  const key = stepKey(section, section.steps[0]);
  const json = JSON.parse(exportData([guide], { mine: [key] }));
  assert.equal(json.type, 'bt-progress');
  assert.deepEqual(json.progress.mine, ['Main|Jade']);
});

test('importing a bazaar export brings the checks over', () => {
  const data = importData(exportData([guide], { mine: ['Main|Jade'], gone: ['x|y'] }));
  const out = applyImport({ imported: [], checks: { other: ['a|b'] }, bundled: [] }, data);
  assert.deepEqual(out.checks, { other: ['a|b'], mine: ['Main|Jade'], gone: ['x|y'] });
  assert.equal(out.imported[0].id, 'mine');
});

test('a shipped guide coming back unchanged stays shipped', () => {
  const data = importData(exportData([guide], {}));
  const out = applyImport({ imported: [], checks: {}, bundled: data.guides }, data);
  assert.deepEqual(out.imported, []);
});

test('sync errors give the known messages and keep the last state', () => {
  const last = { syncedAt: 5 };
  assert.deepEqual(syncOutcome({ status: 'error', error: 'key' }, last), { state: last, message: 'Hypixel rejected the key. Check it in the developer dashboard.', choices: [] });
  assert.equal(syncOutcome({ status: 'error', error: 'network' }, last).message, 'No connection to Hypixel.');
  assert.equal(syncOutcome({ status: 'error', error: 'network' }, last).state, last);
  assert.match(syncOutcome({ status: 'error', error: 'limit', retryIn: 30 }, last).message, /30 s/);
  const fresh = { syncedAt: 9 };
  assert.deepEqual(syncOutcome({ status: 'ok', state: fresh }, last), { state: fresh, message: 'Synced.', choices: [] });
  const picks = [{ id: 'p', name: 'Apple', members: 1 }];
  assert.deepEqual(syncOutcome({ status: 'choose', choices: picks }, last), { state: last, message: 'Pick your profile.', choices: picks });
  assert.deepEqual(syncOutcome({ status: 'stale' }, last), { state: last, message: '', choices: [] });
});

test('done steps get dates: 0 at the first run, then the time they were first seen', () => {
  const checks = { mine: ['Main|Jade'] };
  const first = stampAll([guide], checks, {}, null, 100);
  assert.deepEqual(first, { mine: { 'Main|Jade': 0 } });
  const later = stampAll([guide], { mine: ['Main|Jade', 'Main|Topaz'] }, first, null, 200);
  assert.deepEqual(later, { mine: { 'Main|Jade': 0, 'Main|Topaz': 200 } });
  assert.deepEqual(stampAll([guide], { mine: ['Main|Jade', 'Main|Topaz'] }, first, null, 200, true).mine['Main|Topaz'], 0);
});

test('the worker registers only outside the native app', () => {
  assert.match(app, /'serviceWorker' in navigator && !plugin\(\)/);
});

test('a sync without plugin is not offered', () => {
  assert.match(app, /canSync: canSync\(\)/);
  const html = settingsView({ guides: [], personal: true, settings: miningSettings(null), canSync: false, state: null, now: 1, choices: [], message: '' });
  assert.doesNotMatch(html, /data-sync="run"/);
});

test('no guide file gives an empty home without an error', () => {
  const html = homeView({ guides: [], checks: {}, dates: {}, state: null, now: 1 });
  assert.match(html, /No guide yet/);
});

test('settings can remove the key and profile data, after a second tap', () => {
  const world = { guides: [], personal: true, settings: miningSettings(null), canSync: true, state: null, now: 1, choices: [], message: '' };
  assert.match(settingsView(world), /data-act="remove">Remove key and profile data</);
  assert.match(settingsView({ ...world, removeArmed: true }), /data-act="remove">Tap again to remove</);
});

test('a swipe moves between the guides of an area and from the first one home', () => {
  const family = ['mine', 'shaft'];
  const at = (id) => ({ page: 'guide', id, tab: 'path' });
  assert.deepEqual(swipeTarget(at('mine'), -80, family), { hash: '#/guide/shaft/path', back: false });
  assert.deepEqual(swipeTarget(at('shaft'), 80, family), { hash: '#/guide/mine/path', back: true });
  assert.deepEqual(swipeTarget(at('mine'), 80, family), { hash: '#/', back: true });
  assert.equal(swipeTarget(at('shaft'), -80, family), null);
  assert.deepEqual(swipeTarget(at('mine'), 80, ['mine']), { hash: '#/', back: true });
  assert.equal(swipeTarget(at('mine'), -80, ['mine']), null);
});

test('other screens have no swipe', () => {
  assert.equal(swipeTarget({ page: 'settings' }, 80, []), null);
  assert.equal(swipeTarget({ page: 'home' }, 80, []), null);
  assert.equal(swipeTarget({ page: 'guide', id: 'mine', tab: 'path' }, 0, ['path']), null);
});

test('the first 8 px decide between a swipe and a scroll', () => {
  assert.equal(swipeAxis(5, 5), null);
  assert.equal(swipeAxis(8, 0), 'x');
  assert.equal(swipeAxis(30, 15), 'x');
  assert.equal(swipeAxis(-30, 19), 'x');
  assert.equal(swipeAxis(30, 21), 'y'); // slanted stays a scroll
  assert.equal(swipeAxis(2, -40), 'y');
});

test('a swipe lands where its speed would carry it past 30 % of the width, otherwise it goes back', () => {
  assert.equal(swipeLands(-116, 0, 390), false);
  assert.equal(swipeLands(-117, 0, 390), true);
  assert.equal(swipeLands(40, 0.39, 390), true); // 40 + 78 px
  assert.equal(swipeLands(40, 0.3, 390), false);
  assert.equal(swipeLands(20, 1, 390), true); // a short flick
  assert.equal(swipeLands(-200, 0.8, 390), false); // far out, but flicked back
  assert.equal(swipeLands(-200, 2, 390), false); // flicked past the start: the other way is no landing
});

test('a tick before the profile is loaded gets no date, and what the sync found stays old', () => {
  const g = { id: 'g', title: 'G', sections: [{ name: 'S', steps: [{ text: 'owned', detect: { kind: 'owned', on: [['X']] } }, { text: 'tick' }] }] };
  const summary = { items: [{ id: 'X', enchants: {}, gems: [], parts: {} }], pets: [] };
  const known = stampAll([g], {}, {}, { summary }, 100);
  assert.equal(known.g['S|owned'], 0);
  const checks = { g: ['S|tick'] };
  assert.equal(stampAll([g], checks, known, undefined, 200), known);
  const after = stampAll([g], checks, known, { summary }, 300);
  assert.equal(after.g['S|owned'], 0);
  assert.equal(after.g['S|tick'], 300);
});

test('removing the profile saves the typed stats before the key goes, and survives a failed read', () => {
  const body = app.slice(app.indexOf('async function removeProfile'), app.indexOf('function saveSettings'));
  assert.ok(body.includes('statsOnly(await loadStand() ?? state)'));
  assert.ok(body.indexOf('saveStand(kept)') < body.indexOf('clearApiKeyOnly()'));
});

test('mark done closes the card first, then scrolls the next card into sight unless a hand moves the list', () => {
  assert.match(app, /step\.closest\('\.card'\)\) markCard\(/);
  assert.match(app, /marking = false;\s+redrawDue = false;\s+toggle\(key, true\);/);
  assert.match(app, /if \(stillMotion\(\)\) \{ toggle\(key, true\); return; \}/);
  assert.match(app, /if \(fromCard\) revealCard\(\)/);
  assert.match(app, /performance\.now\(\) - handAt < HAND_QUIET_MS\) return/);
  assert.match(app, /behavior: stillMotion\(\) \? 'auto' : 'smooth'/);
  const css = readFileSync(new URL('../guide/guide.css', import.meta.url), 'utf8');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.card-open/);
  assert.match(css, /\.marking \.rail-bottom::after/);
});

test('no redraw while mark done runs: the path is drawn again and scrolled to the card only after it', () => {
  const draw = app.slice(app.indexOf('function draw()'), app.indexOf('const scroller', app.indexOf('function draw()')));
  assert.match(draw, /if \(settling \|\| touch\?\.axis === 'x' \|\| marking\) \{ redrawDue = true; return; \}/);
  // no neighbour screens built, no swipe and no switch tap until the line has run
  assert.match(app, /if \(!touch && !settling && !marking\) targets/);
  assert.match(app, /if \(!link \|\| settling \|\| marking \|\|/);
  assert.match(app, /const free = e\.touches\.length === 1 && !settling && !marking &&/);
  // a redraw held back is not lost when the tick itself draws nothing
  assert.match(app, /toggle\(key, true\);\s+\/\/ [^\n]*\s+if \(root\.querySelector\('\.marking'\)\) draw\(\);/);
});

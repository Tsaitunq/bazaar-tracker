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
  assert.deepEqual(parseRoute('#/guide/mine/best', guides), { page: 'guide', id: 'mine', tab: 'best' });
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
  const html = settingsView({ guides: [], settings: miningSettings(null), canSync: false, state: null, now: 1, choices: [], message: '' });
  assert.doesNotMatch(html, /data-sync="run"/);
});

test('no guide file gives an empty home without an error', () => {
  const html = homeView({ guides: [], checks: {}, dates: {}, state: null, now: 1 });
  assert.match(html, /No guide yet/);
});

test('settings can remove the key and profile data, after a second tap', () => {
  const world = { guides: [], settings: miningSettings(null), canSync: true, state: null, now: 1, choices: [], message: '' };
  assert.match(settingsView(world), /data-act="remove">Remove key and profile data</);
  assert.match(settingsView({ ...world, removeArmed: true }), /data-act="remove">Tap again to remove</);
});

test('a swipe moves between the tabs of a guide and from the first one home', () => {
  const tabs = ['path', 'best'];
  const at = (tab) => ({ page: 'guide', id: 'mine', tab });
  assert.deepEqual(swipeTarget(at('path'), -80, tabs), { hash: '#/guide/mine/best', back: false });
  assert.deepEqual(swipeTarget(at('best'), 80, tabs), { hash: '#/guide/mine/path', back: true });
  assert.deepEqual(swipeTarget(at('path'), 80, tabs), { hash: '#/', back: true });
  assert.equal(swipeTarget(at('best'), -80, tabs), null);
  assert.deepEqual(swipeTarget(at('path'), 80, ['path']), { hash: '#/', back: true });
  assert.equal(swipeTarget(at('path'), -80, ['path']), null);
});

test('other screens have no swipe', () => {
  assert.equal(swipeTarget({ page: 'settings' }, 80, []), null);
  assert.equal(swipeTarget({ page: 'home' }, 80, []), null);
  assert.equal(swipeTarget({ page: 'guide', id: 'mine', tab: 'path' }, 0, ['path']), null);
});

test('the first movement decides between a swipe and a scroll', () => {
  assert.equal(swipeAxis(6, 6), null);
  assert.equal(swipeAxis(30, 10), 'x');
  assert.equal(swipeAxis(-30, 10), 'x');
  assert.equal(swipeAxis(30, 15), 'y'); // slanted stays a scroll
  assert.equal(swipeAxis(2, -40), 'y');
});

test('a swipe lands past 30 % of the width or with a flick in its direction, otherwise it springs back', () => {
  assert.equal(swipeLands(-116, 0, 390), false);
  assert.equal(swipeLands(-117, 0, 390), true);
  assert.equal(swipeLands(40, 0.5, 390), true);
  assert.equal(swipeLands(40, 0.49, 390), false);
  assert.equal(swipeLands(-200, 0.8, 390), false); // far out, but flicked back
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

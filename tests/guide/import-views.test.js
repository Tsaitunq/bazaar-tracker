import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { importSettings, importView, NOT_AFFILIATED } from '../../apps/guide/views/import.js';
import { settingsView } from '../../apps/guide/views/settings.js';
import { parseRoute } from '../../apps/guide/model.js';
import { isPickable } from '../../apps/guide/import/propose.js';
import { gamedata, emptyBuild } from '../fixtures/guide-world.js';

const imp = (over = {}) => ({ available: true, name: 'Apple', savedName: null, ownName: null, profiles: null, profileId: null, busy: false, message: '', cooling: 0, confirm: null, hasProfile: false, profileName: null, fetchedAt: null, undo: false, offline: false, since: false, picked: new Set(), ...over });
const world = (over) => ({ guides: [], checks: {}, base: {}, build: emptyBuild(), gamedata, settings: {}, imp: imp(over) });

test('route: the import page exists', () => {
  assert.deepEqual(parseRoute('#/import', []), { page: 'import' });
});

test('settings: outside the Android app there is only a note and the Hypixel line', () => {
  const html = importSettings(world({ available: false }));
  assert.match(html, /Android app only/);
  assert.match(html, new RegExp(NOT_AFFILIATED.replace('.', '\\.')));
  assert.doesNotMatch(html, /data-imp-name/);
});

test('settings: name, profile list with the selected one, the one-hour note, the Hypixel line', () => {
  const html = importSettings(world({ profiles: [{ id: 'a', cute_name: 'Apple', game_mode: 'ironman', selected: false }, { id: 'b', cute_name: 'Pear', game_mode: null, selected: true }], profileId: 'b' }));
  assert.match(html, /data-imp-name[^>]*value="Apple"/);
  assert.match(html, /<option value="b" selected>Pear · selected<\/option>/);
  assert.match(html, /<option value="a">Apple \(ironman\)<\/option>/);
  assert.match(html, /up to 1 hour old/);
  assert.match(html, /Not affiliated with or endorsed by Hypixel/);
  assert.doesNotMatch(html, /Delete profile data/); // nothing stored yet
});

test('settings: a stored profile offers reload, review, undo and delete; offline says so', () => {
  const html = importSettings(world({ hasProfile: true, profileName: 'Apple', fetchedAt: Date.UTC(2026, 10, 10, 9, 30), undo: true, offline: true }));
  assert.match(html, /data-act="imp-load"[^>]*>Reload</);
  assert.match(html, /href="#\/import"/);
  assert.match(html, /data-act="imp-undo"/);
  assert.match(html, /data-act="imp-clear"/);
  assert.match(html, /2026-11-10 09:30 UTC/);
  assert.match(html, /you are offline, showing the last import/);
});

test('settings: while loading or waiting the buttons are off, and the message shows the seconds', () => {
  const busy = importSettings(world({ busy: true, profileId: 'a' }));
  assert.match(busy, /data-act="imp-load"[^>]*disabled/);
  assert.match(busy, /Loading/);
  const wait = importSettings(world({ cooling: 42, message: 'Too many requests.', profileId: 'a' }));
  assert.match(wait, /data-act="imp-profiles"[^>]*disabled/);
  assert.match(wait, /Too many requests\. \(42 s\)/);
});

test('settings: the confirmations name what happens', () => {
  assert.match(importSettings(world({ confirm: 'replace', savedName: 'Old' })), /replaces your previous import state \(Old\)/);
  assert.match(importSettings(world({ confirm: 'clear' })), /checkmarks, build and measurements stay/);
  assert.match(importSettings(world({ confirm: 'foreign', ownName: 'Mine', name: 'Other' })), /Other\) is not the one you saved \(Mine\)/);
  assert.match(importSettings(world({ confirm: 'foreign', name: 'Other' })), /saved as yours/);
});

test('nothing from outside reaches the page unescaped', () => {
  const evil = '<img src=x onerror=alert(1)>';
  const html = importSettings(world({ name: evil, profiles: [{ id: 'a', cute_name: evil, game_mode: evil, selected: true }], profileId: 'a', message: evil, profileName: evil, hasProfile: true }));
  assert.doesNotMatch(html, /<img/);
  const view = importView(world({ hasProfile: true, name: evil, profileName: evil, areas: [{ id: 'gear', name: 'Gear', equal: 0, pick: 0, notes: [evil], rows: [{ id: 'r', area: 'gear', guide: 'g', title: evil, section: evil, label: evil, status: 'conflict', where: [evil], note: evil, from: evil, to: evil }] }] }));
  assert.doesNotMatch(view, /<img/);
});

test('settings page: the import block is part of it', () => {
  assert.match(settingsView(world()), /Profile import/);
});

const area = (id, name, rows, over = {}) => ({ id, name, rows, equal: 0, notes: [], pick: rows.filter(isPickable).length, ...over });
const rows = [
  { id: 'hotm:tier', area: 'hotm', label: 'HOTM tier', status: 'new', from: '–', to: 5, kind: 'part' },
  { id: 'hotm:level:x', area: 'hotm', label: 'Mining Speed', status: 'conflict', from: 9, to: 2, note: 'The profile has less than you entered. Not changed.' },
  { id: 'hotm:level:y', area: 'hotm', label: 'Fortune', status: 'different', blocked: 'Your measurement is newer than the profile data. Load the profile again later.', from: 1, to: 2, kind: 'part' },
];

test('screen: areas, the status of each row, one box per pickable row, "Apply all" per area', () => {
  const html = importView(world({ hasProfile: true, name: 'Apple', profileName: 'Pear', fetchedAt: 0, picked: new Set(['hotm:tier']), areas: [area('hotm', 'HOTM', rows, { equal: 4 }), area('gear', 'Gear', [])] }));
  assert.match(html, /data-page="import"/);
  assert.match(html, /<h2>HOTM<\/h2><small>1 to take · 4 already match<\/small>/);
  assert.match(html, /<input type="checkbox" data-imp-pick="hotm:tier" checked>/);
  assert.doesNotMatch(html, /data-imp-pick="hotm:level:x"/); // a conflict has no box
  assert.doesNotMatch(html, /data-imp-pick="hotm:level:y"/); // a blocked row has none either
  assert.match(html, /Your measurement is newer than the profile data/);
  assert.match(html, /data-imp-all="hotm">Apply all \(1\)/);
  assert.match(html, /data-imp-apply>Apply selected \(1\)/);
  assert.match(html, /not changed/);
  assert.match(html, /Not affiliated with or endorsed by Hypixel/);
});

test('screen: gear is grouped by guide and section and shows where the item was found', () => {
  const r = { id: 'gear:g:k', area: 'gear', guide: 'g', title: 'Shafting', section: 'Armor', label: 'Divan Helmet', status: 'new', from: 'open', to: 'done', where: ['Getragen', 'Wardrobe Set 3'], kind: 'tick' };
  const html = importView(world({ hasProfile: true, areas: [area('gear', 'Gear', [r])] }));
  assert.match(html, /<summary>Shafting<\/summary><h3>Armor<\/h3>/);
  assert.match(html, /Found: Getragen, Wardrobe Set 3/);
  assert.match(html, /data-keep-open="imp-g"/);
});

test('screen: a suggestion has its own button and no box; without a profile there is a pointer to the settings', () => {
  const s = { id: 'power:stone', area: 'power', label: 'Power stone in use', status: 'suggest', from: 'none', to: 'Beating Heart' };
  const html = importView(world({ hasProfile: true, areas: [area('power', 'Power', [s])] }));
  assert.match(html, /data-imp-one="power:stone">Use</);
  assert.doesNotMatch(html, /data-imp-pick="power:stone"/);
  assert.match(importView(world({ hasProfile: false })), /No profile loaded yet/);
});

test('screen: the switch for new-since-measurement and the undo button', () => {
  const html = importView(world({ hasProfile: true, areas: [], since: true, undo: true }));
  assert.match(html, /data-imp-since checked/);
  assert.match(html, /data-act="imp-undo"/);
});

// The privacy contract, checked on the source: the app keeps the profile in two keys of its own and nothing else.
const app = readFileSync(new URL('../../apps/guide/app.js', import.meta.url), 'utf8');

test('privacy: the profile is never part of an export, and deleting it keeps the player\'s progress', () => {
  assert.doesNotMatch(app, /exportData\([^)]*(profile|api|undo)/);
  const clear = app.match(/function impClear\(\) \{([\s\S]*?)\n\}/)[1];
  assert.match(clear, /drop\('pg\.profile'\)/);
  assert.match(clear, /drop\('pg\.api'\)/);
  assert.doesNotMatch(clear, /pg\.(checks|keys|owned|build|base|draft|dates)/);
});

test('privacy: only a tap starts a request', () => {
  const calls = app.split('\n').filter((l) => /\b(impLoad|impProfiles)\(/.test(l) && !/function imp/.test(l));
  // the click handler, and the confirmation that finishes a tapped load
  for (const line of calls) assert.match(line, /act === 'imp-|return impLoad\(true\)/, line);
  assert.ok(calls.length >= 3);
});

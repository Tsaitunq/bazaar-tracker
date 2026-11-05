import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseRoute, applyImport, stampAll, swipeTarget, swipeAxis, swipeLands } from '../../apps/guide/model.js';
import { exportData, importData, stepKey } from '../../apps/guide/progress.js';
import { homeView } from '../../apps/guide/views/home.js';

const guide = { id: 'mine', title: 'Mining', area: 'mining', sections: [{ name: 'Main', steps: [{ text: 'Jade' }, { text: 'Topaz' }] }] };
const app = readFileSync(new URL('../../apps/guide/app.js', import.meta.url), 'utf8');

test('parseRoute reads each route, an unknown guide goes home', () => {
  const guides = [guide];
  assert.deepEqual(parseRoute('', guides), { page: 'home' });
  assert.deepEqual(parseRoute('#/', guides), { page: 'home' });
  assert.deepEqual(parseRoute('#/stats', guides), { page: 'stats', tab: 'overview', area: 'mining' });
  assert.deepEqual(parseRoute('#/stats/hotm/blaze', guides), { page: 'stats', tab: 'hotm', area: 'blaze' });
  assert.deepEqual(parseRoute('#/stats/measure/farming', guides), { page: 'stats', tab: 'measure', area: 'farming' });
  assert.deepEqual(parseRoute('#/stats/measure/nope', guides), { page: 'stats', tab: 'measure', area: 'mining' });
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

test('done steps get dates: 0 at the first run, then the time they were first seen', () => {
  const checks = { mine: ['Main|Jade'] };
  const first = stampAll([guide], checks, {}, 100);
  assert.deepEqual(first, { mine: { 'Main|Jade': 0 } });
  const later = stampAll([guide], { mine: ['Main|Jade', 'Main|Topaz'] }, first, 200);
  assert.deepEqual(later, { mine: { 'Main|Jade': 0, 'Main|Topaz': 200 } });
});

test('the worker registers only outside the native app', () => {
  assert.match(app, /'serviceWorker' in navigator && !isNative\(\)/);
});

test('no guide file gives an empty home without an error', () => {
  const html = homeView({ guides: [], checks: {}, dates: {}, now: 1 });
  assert.match(html, /No guide yet/);
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

test('what is owned from the start is old, a later tick gets its date', () => {
  const g = { id: 'g', title: 'G', sections: [{ name: 'S', steps: [{ text: 'owned', detect: { kind: 'owned', on: [['X']] } }, { text: 'tick' }] }] };
  const known = stampAll([g], {}, {}, 100, ['X']);
  assert.equal(known.g['S|owned'], 0);
  const after = stampAll([g], { g: ['S|tick'] }, known, 300, ['X']);
  assert.equal(after.g['S|owned'], 0);
  assert.equal(after.g['S|tick'], 300);
});

test('mark done closes the card first, then scrolls the next card into sight unless a hand moves the list', () => {
  assert.match(app, /step\.closest\('\.card'\)\) markCard\(/);
  assert.match(app, /marking = false;\s+redrawDue = false;\s+toggle\(key, true\);/);
  assert.match(app, /if \(stillMotion\(\)\) \{ toggle\(key, true\); return; \}/);
  assert.match(app, /if \(fromCard\) revealCard\(\)/);
  assert.match(app, /performance\.now\(\) - handAt < HAND_QUIET_MS\) return/);
  assert.match(app, /behavior: stillMotion\(\) \? 'auto' : 'smooth'/);
  const css = readFileSync(new URL('../../apps/guide/guide.css', import.meta.url), 'utf8');
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

test('a sideways drag on a stats tab leads to the next tab and stops at the ends', () => {
  const at = (tab) => ({ page: 'stats', tab, area: 'blaze' });
  assert.deepEqual(swipeTarget(at('overview'), -50, []), { hash: '#/stats/hotm/blaze', back: false });
  assert.deepEqual(swipeTarget(at('attributes'), 50, []), { hash: '#/stats/hotm/blaze', back: true });
  assert.equal(swipeTarget(at('overview'), 50, []), null);
  assert.deepEqual(swipeTarget(at('power'), -50, []), { hash: '#/stats/essence/blaze', back: false });
  assert.equal(swipeTarget(at('essence'), -50, []), null);
  assert.deepEqual(swipeTarget(at('essence'), 50, []), { hash: '#/stats/power/blaze', back: true });
  assert.equal(swipeTarget({ page: 'stats', tab: 'measure', area: 'mining' }, -50, []), null);
});

test('a stats list never scrolls sideways, so the HOTM tree cannot swallow the swipe on a narrow phone', () => {
  const css = readFileSync(new URL('../../apps/guide/guide.css', import.meta.url), 'utf8');
  assert.match(css, /\.scroll \{[^}]*overflow-x: hidden/);
  assert.match(app, /function fitTrees/);
  assert.match(app, /paintFigures\(root\);\s+fitTrees\(root\);/);
  assert.match(app, /root\.append\(peek\);\s+fitTrees\(peek\);/);
});

test('a tap or a vertical scroll over a perk is no swipe', () => {
  assert.equal(swipeAxis(3, 2), null); // a tap with a little jitter
  assert.equal(swipeAxis(6, 30), 'y');
  assert.equal(swipeAxis(-12, 30), 'y');
});

test('the attribute sheet closes on its backdrop and button, does not swipe, and does not follow to another page', () => {
  assert.ok(app.includes("if (el('[data-attr-close]')) { ui = { ...ui, attr: undefined }; draw(); return; }"));
  assert.ok(app.includes("!e.target.closest('input, select, .bsheet, .sheet-back')"));
  assert.ok(app.includes('if (ui.attr && shownRoute && JSON.stringify(route()) !== shownRoute)'));
});

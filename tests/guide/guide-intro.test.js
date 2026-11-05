import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decide, finishTour, newsBetween, compareVersions, STEPS, tourHtml, newsHtml, SEEN_KEY, TOUR_KEY } from '../../guide/intro.js';
import { settingsView } from '../../guide/views/settings.js';

const log = { versions: [
  { version: '0.10.0', date: '2026-11-05', entries: [{ title: 'Tour', text: 'a' }] },
  { version: '0.9.0', date: '2026-11-04', entries: [{ title: 'Blaze', text: 'b' }] },
  { version: '0.8.2', date: '2026-11-03', entries: [{ title: 'Pet', text: 'c' }] },
  { version: '0.8.0', date: '2026-11-01', entries: [{ title: 'Editors', text: 'd' }] },
] };
const memory = (start = {}) => { const m = { ...start }; return { get: (k) => m[k] ?? null, set: (k, v) => { m[k] = v; }, m }; };

test('a first install gets the tour and no news', () => {
  const store = memory();
  assert.deepEqual(decide(store, log), { type: 'tour' });
  assert.equal(store.m[SEEN_KEY], '0.10.0');
});

test('the tour starts once: after Skip or Done it stays away', () => {
  const store = memory();
  assert.equal(decide(store, log).type, 'tour');
  finishTour(store); // Skip and Done both end here
  assert.equal(store.m[TOUR_KEY], true);
  assert.equal(decide(store, log).type, 'none');
  assert.equal(decide(store, log).type, 'none');
});

test('someone who updates from a version without a tour gets the tour, not the news', () => {
  const store = memory({ 'pg.checks': { mine: ['a|b'] } }); // old data, no seen version
  assert.equal(decide(store, log).type, 'tour');
});

test('an unfinished tour shows again and still hides the news', () => {
  const store = memory({ [SEEN_KEY]: '0.8.2' });
  assert.equal(decide(store, log).type, 'tour');
  assert.equal(decide(store, log).type, 'tour');
});

test("What's new lists exactly the entries after the seen version, newest first", () => {
  const store = memory({ [TOUR_KEY]: true, [SEEN_KEY]: '0.8.2' });
  const out = decide(store, log);
  assert.equal(out.type, 'news');
  assert.deepEqual(out.news.map((v) => v.version), ['0.10.0', '0.9.0']);
  assert.equal(store.m[SEEN_KEY], '0.10.0');
  assert.equal(decide(store, log).type, 'none'); // seen now
});

test('newsBetween keeps both ends right and ignores a downgrade', () => {
  assert.deepEqual(newsBetween(log, '0.9.0').map((v) => v.version), ['0.10.0']);
  assert.deepEqual(newsBetween(log, '0.10.0'), []);
  assert.deepEqual(newsBetween(log, '0.10.5'), []);
  assert.equal(compareVersions('0.10.0', '0.9.0'), 1);
});

test('a changelog that did not load still lets the tour run and shows no news', () => {
  assert.equal(decide(memory(), null).type, 'tour');
  assert.equal(decide(memory({ [TOUR_KEY]: true, [SEEN_KEY]: '0.8.0' }), null).type, 'none');
});

test('the tour has six steps with a text, a target and a route', () => {
  assert.equal(STEPS.length, 6);
  for (const s of STEPS) assert.ok(s.title && s.text && s.target && s.hash('mine'));
  assert.equal(STEPS[1].hash('mine'), '#/guide/mine/path');
  assert.equal(STEPS[1].hash(undefined), '#/'); // no guide loaded: the step still shows
});

test('the card has one dot per step, Skip until the last step, then Done', () => {
  const first = tourHtml(0);
  assert.equal(first.match(/<i/g).length, 6);
  assert.match(first, /data-tour="skip"/);
  assert.match(first, /Next/);
  assert.match(tourHtml(5), /Done/);
  assert.doesNotMatch(tourHtml(5), /data-tour="skip"/);
});

test('the news sheet lists every given version with its entries', () => {
  const html = newsHtml(log.versions);
  for (const v of log.versions) assert.ok(html.includes(v.version) && html.includes(v.entries[0].title));
});

test('settings can restart the tour and open the full list', () => {
  const html = settingsView({ settings: {}, guides: [] });
  assert.match(html, /data-act="tour"/);
  assert.match(html, /data-act="news"/);
});

test('the spotlight targets exist in the views, and the sheet respects reduced motion', () => {
  const views = ['home', 'guide', 'stats', 'settings', 'parts'].map((f) => readFileSync(`guide/views/${f}.js`, 'utf8')).join('');
  for (const cls of ['bests', 'card', 'data-stats-area', 'switch', 'stat-table', 'data-act="tour"']) assert.ok(views.includes(cls), cls);
  const css = readFileSync('guide/guide.css', 'utf8');
  assert.match(css, /prefers-reduced-motion: reduce\) \{ \.tour-hole \{ transition: none/);
});

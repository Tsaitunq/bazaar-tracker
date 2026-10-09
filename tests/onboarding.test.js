import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  compareVersions, currentVersion, newsSince, startupAction, setupResult, tourSteps,
  welcomeHtml, newsHtml, setupFormHtml, setupSummaryHtml, bubbleHtml, CAPITALS,
} from '../onboarding.js';

// a small changelog instead of the real file, so the tests do not change with every release
const entry = (title, target) => ({ title, text: `${title} text`, ...(target && { target }) });
const log = {
  versions: [
    { version: '4.0.0', date: '2026-10-10', entries: [entry('Tour'), entry('Help', '#toggle-settings')] },
    { version: '3.3.0', date: '2026-10-10', entries: [entry('Swipe', '#tabs')] },
    { version: '3.2.0', date: '2026-10-09', entries: [entry('Look')] },
    { version: '3.0.0', date: '2026-10-09', entries: [entry('Warnings')] },
  ],
};
const versions = (action) => action.news.map((v) => v.version);

test('compareVersions compares numbers, not text', () => {
  assert.equal(compareVersions('4.0.0', '3.9.9'), 1);
  assert.equal(compareVersions('3.10.0', '3.9.0'), 1);
  assert.equal(compareVersions('3.2.0', '3.2.0'), 0);
  assert.equal(compareVersions('3.2', '3.2.0'), 0);
  assert.equal(compareVersions('3.0.0', '3.0.1'), -1);
});

test('the newest entry of the changelog is the app version', () => {
  assert.equal(currentVersion(log), '4.0.0');
  assert.deepEqual(newsSince(log, '3.2.0').map((v) => v.version), ['4.0.0', '3.3.0']);
  assert.deepEqual(newsSince(log, '4.0.0'), []);
});

test('a new user gets the welcome screen and no news', () => {
  assert.deepEqual(startupAction(null, log, false), { type: 'welcome', current: '4.0.0' });
});

test('cleared storage is the same as a new user', () => {
  // everything is gone: no onboarding state and none of the app's own data
  assert.equal(startupAction(null, log, false).type, 'welcome');
  assert.equal(startupAction(undefined, log, false).type, 'welcome');
});

test('an update by one version shows that version once', () => {
  const action = startupAction({ done: true, version: '3.3.0' }, log, true);
  assert.equal(action.type, 'whatsNew');
  assert.deepEqual(versions(action), ['4.0.0']);
  // after it has been seen the stored version is the current one
  assert.equal(startupAction({ done: true, version: action.current }, log, true).type, 'none');
});

test('several skipped versions are all shown, newest first', () => {
  const action = startupAction({ done: true, version: '3.0.0' }, log, true);
  assert.deepEqual(versions(action), ['4.0.0', '3.3.0', '3.2.0']);
});

test('someone who used the app before it had a tour gets an offer, not an automatic tour', () => {
  const action = startupAction(null, log, true);
  assert.equal(action.type, 'tourOffer');
  assert.deepEqual(versions(action), ['4.0.0']);
});

test('a stored version from the future or a broken state never throws', () => {
  assert.equal(startupAction({ done: true, version: '9.0.0' }, log, true).type, 'none');
  for (const broken of [{}, { version: 4 }, { version: 'abc' }, 'x', 42, []]) {
    assert.equal(startupAction(broken, log, false).type, 'welcome');
    assert.equal(startupAction(broken, log, true).type, 'tourOffer');
  }
});

test('setupResult maps the three answers to settings with a reason each', () => {
  const result = setupResult({ capital: 200e6, activity: 'often', style: 'profit' }, 10);
  const values = Object.fromEntries(result.map((r) => [r.key, r.value]));
  assert.deepEqual(values, {
    portfolioCapital: 200000000, maxCapital: 20000000, share: 20,
    marketMargin: 8, marketMinVolume: 100000, marketMinProfit: 250000,
  });
  for (const r of result) assert.ok(r.label && r.shown && r.reason.endsWith('.'), r.key);
  assert.equal(result.find((r) => r.key === 'share').shown, '20%');
  assert.equal(result.find((r) => r.key === 'portfolioCapital').shown, '200M');

  const safe = Object.fromEntries(setupResult({ capital: 10e6, activity: 'rarely', style: 'safe' }, 4).map((r) => [r.key, r.value]));
  assert.deepEqual(safe, {
    portfolioCapital: 10000000, maxCapital: 2500000, share: 5,
    marketMargin: 15, marketMinVolume: 500000, marketMinProfit: 100000,
  });
  assert.equal(setupResult({ capital: 10e6, activity: 'sometimes', style: 'safe' }, 10).find((r) => r.key === 'share').value, 10);
});

test('setupResult survives missing or odd answers', () => {
  const values = Object.fromEntries(setupResult({ capital: NaN, activity: 'x', style: undefined }, 0).map((r) => [r.key, r.value]));
  assert.deepEqual(values, {
    portfolioCapital: 50000000, maxCapital: 50000000, share: 5,
    marketMargin: 15, marketMinVolume: 500000, marketMinProfit: 100000,
  });
});

test('the tour has the Android station only inside the app', () => {
  const web = tourSteps({ native: false, firstId: 'INK_SACK:4' });
  const app = tourSteps({ native: true, firstId: 'INK_SACK:4' });
  assert.equal(web.length, 7);
  assert.equal(app.length, 8);
  assert.match(app[7].text, /Unrestricted/);
  assert.ok(web.every((s) => s.title && s.text && s.target && s.route));
  assert.ok(web.some((s) => s.route === '#/item/INK_SACK%3A4'));
  assert.ok(web.some((s) => s.route === '#/opps' && s.target === '#portfolio .portfolio'));
  // without an item to open, the detail station stays on the list
  assert.ok(tourSteps({ native: false, firstId: undefined }).every((s) => !s.route.startsWith('#/item/')));
});

test('bubble shows progress and the right buttons', () => {
  const steps = tourSteps({ native: false, firstId: 'A' });
  const first = bubbleHtml(steps[0], 0, 7);
  assert.ok(first.includes('1/7') && first.includes('data-act="tour-next"') && first.includes('data-act="tour-skip"'));
  assert.ok(!first.includes('tour-back'));
  const last = bubbleHtml(steps[6], 6, 7);
  assert.ok(last.includes('7/7') && last.includes('tour-back') && last.includes('>Done<'));
  assert.ok(!bubbleHtml({ title: '<b>', text: '<i>', target: 'x' }, 0, 1).includes('<b>'));
});

test('welcome offers the tour and skip', () => {
  const html = welcomeHtml();
  assert.ok(html.includes('Bazaar Flip Helper') && html.includes('Take the tour') && html.includes('data-act="skip"'));
});

test('news window: plain update, tour offer and full history', () => {
  const update = newsHtml(log.versions.slice(0, 2));
  assert.ok(update.includes("What's new") && update.includes('Version 4.0.0') && update.includes('Version 3.3.0'));
  assert.ok(update.includes('data-act="news-show"') && update.includes('Got it'));
  assert.ok(update.indexOf('4.0.0') < update.indexOf('3.3.0'));

  const offer = newsHtml(log.versions.slice(0, 1), { offerTour: true });
  assert.ok(offer.includes('New: app tour – take it now?') && offer.includes('data-act="tour"') && offer.includes('Not now'));

  const history = newsHtml(log.versions, { history: true });
  assert.ok(history.includes('Version history') && history.includes('Version 3.0.0') && !history.includes('news-show'));

  // no entry with a target: nothing to point at
  assert.ok(!newsHtml(log.versions.slice(2, 3)).includes('news-show'));
  assert.ok(!newsHtml([{ version: '1.0.0', date: 'x', entries: [{ title: '<b>', text: '<i>' }] }]).includes('<b>'));
});

test('setup form preselects the answers and offers a free amount', () => {
  const html = setupFormHtml({ capital: 200e6, activity: 'often', style: 'profit' });
  assert.match(html, /name="capital" value="200000000" checked/);
  assert.match(html, /name="activity" value="often" checked/);
  assert.match(html, /name="style" value="profit" checked/);
  assert.ok(html.includes('name="custom"'));
  assert.match(setupFormHtml({ capital: 123456 }), /value="custom" checked/);
  assert.equal(CAPITALS.length, 4);
});

test('summary lists every setting with its reason', () => {
  const html = setupSummaryHtml(setupResult({ capital: 50e6, activity: 'rarely', style: 'safe' }, 10));
  assert.ok(html.includes('Your settings') && html.includes('data-act="setup-apply"'));
  for (const label of ['Total capital', 'Max. capital per flip', 'Market share', 'Min. margin', 'Min. volume/week', 'Min. profit/h']) {
    assert.ok(html.includes(label), label);
  }
});

test('changelog.json is well formed', () => {
  const real = JSON.parse(fs.readFileSync('changelog.json', 'utf8'));
  assert.ok(real.versions.length >= 1);
  real.versions.forEach((v, i) => {
    assert.match(v.version, /^\d+\.\d+\.\d+$/);
    assert.match(v.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(v.entries.length >= 1 && v.entries.length <= 4, `${v.version} has ${v.entries.length} entries`);
    for (const e of v.entries) assert.ok(e.title && e.text, `${v.version} entry needs title and text`);
    if (i > 0) assert.equal(compareVersions(real.versions[i - 1].version, v.version), 1, `${v.version} is out of order`);
  });
});

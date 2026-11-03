import test from 'node:test';
import assert from 'node:assert/strict';
import { homeView } from '../guide/views/home.js';
import { guideView, statsView } from '../guide/views/guide.js';
import { settingsView } from '../guide/views/settings.js';
import { nextPerGuide, guideModel, worldFor } from '../guide/model.js';
import { miningSettings } from '../optimizer.js';

const sold = (price) => ({ buy_summary: [{ pricePerUnit: price, amount: 100 }] });
const piece = (id, extra = {}) => ({ id, where: 'armor', gems: [], enchants: {}, parts: {}, reforge: null, recomb: false, polarvoid: 0, coating: false, lore: {}, ...extra });
const DRILL = 'TITANIUM_DRILL_4';
const items = { [DRILL]: { category: 'DRILL', tier: 'LEGENDARY', stats: { MINING_SPEED: 1600 } }, PLATE: { category: 'CHESTPLATE', tier: 'LEGENDARY', stats: {} }, GATE: { category: 'BOOTS', tier: 'RARE', stats: {}, requirements: [{ type: 'HEART_OF_THE_MOUNTAIN', tier: 7 }] } };
const profile = (over = {}) => ({
  items: [piece(DRILL, { where: 'inventory', lore: { MINING_SPEED: 1000, MINING_FORTUNE: 100 } }), piece('PLATE', { sets: ['armor:1'], lore: { TRUE_DEFENSE: 200, STRENGTH: 45 } })],
  pets: [], hotm: { experience: 0, nodes: {} }, skills: null, collTiers: null, attrs: {}, slayer: null, mp: 1200,
  wardrobe: { armor: { equipped: 1, sets: [1] }, equipment: { equipped: 1, sets: [1] } }, ...over,
});
const step = (text, id = 'A', gain = { MINING_FORTUNE: 8 }) => ({ text, gain, items: [{ id, qty: 1 }] });
const mining = { id: 'mine', title: 'Mining', area: 'mining', groups: { drill: [[DRILL]] }, sections: [{ name: 'Main', steps: [step('Jade'), step('Topaz', 'B')] }] };
const blaze = { id: 'fire', title: 'Blaze Slayer', area: 'blaze', groups: {}, sections: [{ name: 'Start', steps: [step('Boots', 'A', { STRENGTH: 20 })] }] };
const NOW = 1e12;
const world = (over = {}) => ({
  guides: [mining, blaze], checks: {}, dates: {}, state: { summary: profile(), syncedAt: NOW - 2 * 3600e3, profileName: 'P' }, products: { A: sold(1e6), B: sold(2e6) }, prices: { items },
  personal: true, settings: miningSettings(null), keepOldGear: false, boosts: {}, now: NOW, hasKey: false, uuid: '', canSync: true, message: '', choices: [], armed: null, name: String, ...over,
});

test('home shows one line per guide with its next step, value and unit, and no shared best deal card', () => {
  const html = homeView(world());
  assert.doesNotMatch(html, /BEST DEAL/);
  assert.match(html, /NEXT STEP PER GUIDE/);
  assert.match(html, /<b>Mining:<\/b> Jade <span>· [\d.]+[kMB]? per 1 %<\/span>/);
  assert.match(html, /<b>Blaze Slayer:<\/b> Boots <span>· [\d.]+[kMB]? per 1 %<\/span>/);
  const lines = nextPerGuide(world().guides.map((g) => guideModel(g, worldFor(world(), g))));
  assert.deepEqual(lines.map((l) => l.area), ['mining', 'blaze']);
  assert.equal(lines[0].step, 'Jade');
});

test('home has one card per guide in its theme, next step in area colour', () => {
  const html = homeView(world());
  assert.match(html, /data-theme="home"/);
  assert.match(html, /class="guide-card" data-theme="mining" href="#\/guide\/mine\/path"/);
  assert.match(html, /class="guide-card" data-theme="blaze" href="#\/guide\/fire\/path"/);
  assert.match(html, /<em>Next: Jade<\/em>/);
  assert.match(html, /Synced 2 h ago/);
});

test('home shows coins for all next steps and unlocked this week', () => {
  const html = homeView(world({ dates: { mine: { 'Main|Jade': NOW - 1000, 'Main|Old': 0 } } }));
  assert.doesNotMatch(html, /Coins for all next steps/);
  assert.match(html, /Unlocked this week<\/small><strong>1 <em>step<\/em><\/strong>/);
});

test('the guide screen sets its theme on the root', () => {
  assert.match(guideView(world(), 'fire', 'path'), /^<div class="screen screen-blaze" data-theme="blaze">/);
  assert.match(guideView(world(), 'mine', 'path'), /^<div class="screen" data-theme="mining">/);
});

test('blaze shows six stats in three columns and the two chips, mining four in two and none', () => {
  const fire = guideView(world(), 'fire', 'path');
  assert.match(fire, /class="stats stats-3"/);
  assert.equal(fire.match(/class="stat"/g).length, 6);
  assert.match(fire, /class="chips"/);
  const mine = guideView(world(), 'mine', 'path');
  assert.match(mine, /class="stats"/);
  assert.equal(mine.match(/class="stat"/g).length, 4);
  assert.doesNotMatch(mine, /class="chips"/);
});

test('the path has its card and its rows, and no bar', () => {
  const html = guideView(world(), 'mine', 'path');
  assert.match(html, /class="back"/);
  assert.match(html, /class="card"/);
  assert.match(html, /class="row" data-step="Main\|Topaz"/);
  assert.doesNotMatch(html, /class="bar"|data-tab=/);
});

test('below a limit the chip row says so, and without a block', () => {
  const low = world({ state: { summary: profile({ mp: 700 }), syncedAt: 1 } });
  const html = guideView(low, 'fire', 'path');
  assert.match(html, /chip-low/);
  assert.match(html, /c-red">700 ✗<\/span> \/ 800/);
  assert.doesNotMatch(html, /class="warn"[^>]*>Below|Below the limit/);
});

test('stats open from the profile button only: no bar names them', () => {
  const entry = { choice: { armor: 1, equipment: 1, pet: null }, values: { STRENGTH: '1' }, offset: {}, offsetFor: { armor: 1, equipment: 1, pet: null }, at: 2 };
  const s = world({ state: { summary: profile(), syncedAt: 1, statsInput: { blaze: entry } } });
  const all = statsView(s);
  assert.match(all, /data-stats-area="mining"/);
  assert.match(all, /data-stats-area="blaze"/);
  assert.match(all, /data-stats-set="armor"/);
  assert.match(all, /data-stats-stat="STRENGTH"/);
  assert.match(all, /class="stats-table"/);
  for (const html of [all, homeView(s), settingsView(s), guideView(s, 'fire', 'path')]) assert.doesNotMatch(html, /data-tab="stats"/);
  for (const html of [homeView(s), guideView(s, 'fire', 'path')]) assert.match(html, /class="profile" href="#\/stats"/);
  assert.doesNotMatch(guideView(s, 'fire', 'stats'), /data-stats-area/);
});

test('settings holds uuid, key state, weights, presets, keep gear, boosts, import, export, reset', () => {
  const html = settingsView(world({ uuid: 'abc' }));
  assert.match(html, /data-set="uuid"[^>]*value="abc"/);
  assert.match(html, /No key saved/);
  for (const key of ['wF', 'wS', 'wP', 'blockStrength']) assert.match(html, new RegExp(`data-mining="${key}"`));
  for (const preset of ['gemstone', 'mithril', 'glacite']) assert.match(html, new RegExp(`<option value="${preset}"`));
  assert.match(html, /data-act="import-file"/);
  for (const flag of ['keepOldGear', 'godPotion', 'boosterCookie']) assert.match(html, new RegExp(`data-flag="${flag}"`));
  assert.match(html, /data-act="import"/);
  assert.match(html, /data-act="export"/);
  assert.match(html, /data-reset="mine"/);
  assert.match(settingsView(world({ armed: 'mine' })), /data-reset-yes="mine"/);
});

test('the key field never shows the key', () => {
  const html = settingsView(world({ hasKey: true, key: 'secret-value' }));
  assert.match(html, /Key saved/);
  assert.doesNotMatch(html, /secret-value/);
  assert.match(html, /<input type="password"[^>]*data-set="key"[^>]*value=""/);
});

test('a sync without the plugin is not offered', () => {
  const html = settingsView(world({ canSync: false }));
  assert.doesNotMatch(html, /data-sync="run"/);
  assert.match(html, /Sync needs the Android app/);
  assert.match(settingsView(world()), /data-sync="run"/);
});

test('farming shows the empty state with its theme and no sample values', () => {
  const html = guideView(world(), 'farming', 'path');
  assert.match(html, /data-theme="farming"/);
  assert.match(html, /Guide coming soon/);
  assert.match(html, />0%</);
  assert.doesNotMatch(html, /class="stats|class="step"|data-tab="best"/);
  const home = homeView(world());
  assert.match(home, /class="guide-card" data-theme="farming" href="#\/guide\/farming\/path"/);
  assert.doesNotMatch(home.split('data-theme="farming"')[1].split('</a>')[0], /\d%/);
});

test('no guide at all shows an empty home', () => {
  const html = homeView(world({ guides: [] }));
  assert.match(html, /class="empty"/);
  assert.match(html, /No guide yet/);
  assert.doesNotMatch(html, /guide-card|class="bests"/);
  assert.match(html, /class="bar"/);
});

test('the start state offers typed-in stats and hides the key', () => {
  const off = world({ state: null, personal: false });
  const settings = settingsView(off);
  assert.match(settings, /data-flag="personal">/);
  assert.doesNotMatch(settings, /data-set="key"|data-set="uuid"|data-sync="run"|data-act="remove"/);
  assert.doesNotMatch(homeView(off), /Not synced yet/);
  assert.match(settingsView(world({ state: null })), /data-flag="personal" checked[^]*data-set="key"/);
});

test('typed-in stats fill the grid without a sync, and an empty field stays unknown', () => {
  const typed = world({ state: { uuid: '', statsInput: { mining: { values: { MINING_FORTUNE: 1234 }, at: 1 } } }, personal: false });
  const html = guideView(typed, 'mine', 'path');
  assert.match(html, /1,234/);
  assert.match(html, /–/);
  assert.doesNotMatch(guideView(world({ state: null, personal: false }), 'mine', 'path'), /class="stat-value/);
});

test('no sync shows what is missing and links to settings', () => {
  const off = world({ state: null });
  assert.match(homeView(off), /Not synced yet/);
  const path = guideView(off, 'mine', 'path');
  assert.match(path, /class="card"/);
  assert.match(path, /Type in your \/stats/);
  assert.match(path, /href="#\/stats"/);
  assert.match(guideView(world({ prices: {} }), 'mine', 'path'), /Loading item data/);
});

test('the old best route shows the path and no bar offers it', () => {
  assert.doesNotMatch(guideView(world(), 'mine', 'best'), /data-tab="best"|Best possible/);
});

test('an unknown guide id gives no screen', () => {
  assert.equal(guideView(world(), 'nope', 'path'), null);
});

test('the head links the source of a guide, with its text escaped, and only if it has one', () => {
  const w = world();
  assert.doesNotMatch(guideView(w, 'fire', 'path'), /class="source"/);
  w.guides = w.guides.map((g) => (g.id === 'fire' ? { ...g, source: 'https://example.com/?a="b' } : g));
  const html = guideView(w, 'fire', 'path');
  assert.match(html, /class="source" href="https:\/\/example\.com\/\?a=&#34;b" rel="noopener">Source</);
});

test('the notes wait behind the ⓘ of the head, not above the path', () => {
  const html = guideView(world(), 'fire', 'path');
  assert.match(html, /class="info" data-info/);
  const [before, sheet] = html.split('<dialog class="sheet">');
  assert.doesNotMatch(before, /Not modelled/);
  assert.match(sheet, /Not modelled/);
  assert.match(html, /class="chips"/);
  const plain = world({ state: { uuid: '', statsInput: { mining: { values: { MINING_FORTUNE: 1 }, at: 1 } } }, personal: false, settings: { ...miningSettings(null), gemFortune: true } });
  assert.doesNotMatch(guideView(plain, 'mine', 'path'), /data-info|<dialog/);
});

test('guides of one area share one home card and switch at the top', () => {
  const shaft = { ...mining, id: 'shaft', title: 'Shafting gear', sections: [{ name: 'Main', steps: [step('Drill', 'B')] }] };
  const w = world({ guides: [{ ...mining, label: 'Gear progression' }, shaft, blaze] });
  const home = homeView(w);
  assert.equal(home.match(/class="guide-card" data-theme="mining"/g).length, 1);
  assert.match(home, /href="#\/guide\/mine\/path"/);
  const html = guideView(w, 'shaft', 'path');
  assert.match(html, /<nav class="switch"[^>]*><span class="switch-thumb" aria-hidden="true" style="--n:2;--at:1"><\/span><a href="#\/guide\/mine\/path">Gear progression<\/a><a href="#\/guide\/shaft\/path" aria-current="page">Shafting gear<\/a><\/nav>/);
  assert.doesNotMatch(guideView(w, 'fire', 'path'), /class="switch"/);
});

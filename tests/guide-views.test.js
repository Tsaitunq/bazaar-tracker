import test from 'node:test';
import assert from 'node:assert/strict';
import { homeView } from '../guide/views/home.js';
import { guideView } from '../guide/views/guide.js';
import { statsView } from '../guide/views/stats.js';
import { gamedata, baseOf, emptyBuild } from './fixtures/guide-world.js';
import { settingsView } from '../guide/views/settings.js';
import { nextPerGuide, guideModel, worldFor } from '../guide/model.js';
import { miningSettings } from '../optimizer.js';

const sold = (price) => ({ buy_summary: [{ pricePerUnit: price, amount: 100 }] });
const DRILL = 'TITANIUM_DRILL_4';
const items = { [DRILL]: { category: 'DRILL', tier: 'LEGENDARY', stats: { MINING_SPEED: 1600 } }, PLATE: { category: 'CHESTPLATE', tier: 'LEGENDARY', stats: {} }, GATE: { category: 'BOOTS', tier: 'RARE', stats: {}, requirements: [{ type: 'HEART_OF_THE_MOUNTAIN', tier: 7 }] } };
const step = (text, id = 'A', gain = { MINING_FORTUNE: 8 }) => ({ text, gain, items: [{ id, qty: 1 }] });
const mining = { id: 'mine', title: 'Mining', area: 'mining', groups: { drill: [[DRILL]] }, sections: [{ name: 'Main', steps: [step('Jade'), step('Topaz', 'B')] }] };
const blaze = { id: 'fire', title: 'Blaze Slayer', area: 'blaze', groups: {}, sections: [{ name: 'Start', steps: [step('Boots', 'A', { STRENGTH: 20 })] }] };
const NOW = 1e12;
const base = (mp = 1200) => baseOf({ mining: { values: { MINING_SPEED: 1000, MINING_FORTUNE: 100 } }, blaze: { values: { TRUE_DEFENSE: 200, STRENGTH: 45 }, mp } });
const BASE = base();
const world = (over = {}) => ({
  guides: [mining, blaze], checks: {}, dates: {}, owned: [DRILL, 'PLATE'], base: BASE, build: emptyBuild(), gamedata, products: { A: sold(1e6), B: sold(2e6) }, prices: { items }, items,
  settings: miningSettings(null), keepOldGear: false, now: NOW, armed: null, name: String, ...over,
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
  const low = world({ base: base(700) });
  const html = guideView(low, 'fire', 'path');
  assert.match(html, /chip-low/);
  assert.match(html, /c-red">700 ✗<\/span> \/ 800/);
  assert.doesNotMatch(html, /class="warn"[^>]*>Below|Below the limit/);
});

test('stats open from the profile button only: no bar names them', () => {
  const s = world();
  for (const html of [homeView(s), settingsView(s), guideView(s, 'fire', 'path')]) assert.doesNotMatch(html, /data-tab="stats"/);
  for (const html of [homeView(s), guideView(s, 'fire', 'path')]) assert.match(html, /class="profile" href="#\/stats"/);
  assert.doesNotMatch(guideView(s, 'fire', 'stats'), /data-stats-area/);
});

test('the overview shows base, gear and total per stat, with the date of the measurement', () => {
  const html = statsView(world({ owned: [DRILL] }), { page: 'stats', tab: 'overview', area: 'mining' });
  assert.match(html, /data-theme="stats"/);
  assert.match(html, /class="stat-row stat-head"/);
  assert.match(html, /Mining Speed<\/span><span>1,000<\/span><span class="c-green">\+1,600<\/span><b class="c-orange">2,600<\/b>/);
  assert.match(html, /Base measured <b>[^<]* ago<\/b>, no gear/);
  assert.match(html, /href="#\/stats\/measure\/mining"/);
  assert.doesNotMatch(html, /data-tab="stats"/);
});

test('an area without a measurement says so and offers to measure', () => {
  const html = statsView(world({ base: {} }), { page: 'stats', tab: 'overview', area: 'blaze' });
  assert.match(html, /No base measured yet/);
  assert.match(html, /Measure Blaze base/);
});

test('the measure screen asks for each stat of the area, the buffs and the date stays out', () => {
  const html = statsView(world(), { page: 'stats', tab: 'measure', area: 'mining' });
  assert.match(html, /data-stats-area="mining"/);
  assert.match(html, /data-stats-stat="MINING_FORTUNE"/);
  assert.match(html, /data-buff="godPotion"/);
  assert.match(html, /data-stats-save/);
  assert.doesNotMatch(html, /data-stats-mp/);
  assert.match(statsView(world(), { page: 'stats', tab: 'measure', area: 'blaze' }), /data-stats-mp/);
});

const editor = (tab, over = {}) => statsView(world(over), { page: 'stats', tab, area: 'mining' });

test('HOTM editor draws the whole tree, the omelette and the level, and opens a sheet', () => {
  const html = editor('hotm', { ui: { perk: 'mining_fortune' } });
  assert.equal((html.match(/data-perk="/g) ?? []).length, 46);
  assert.match(html, /data-hotm-tier/);
  assert.match(html, /data-hotm-omelette/);
  assert.match(html, /data-perk-sheet="mining_fortune"/);
  assert.match(html, /To max: [0-9,.]+ Mithril powder/);
  assert.doesNotMatch(html, /comes with the next update/);
});

test('HOTM editor: rows above the HOTM level are greyed with a reason, unknown level greys nothing', () => {
  const locked = editor('hotm', { build: { ...emptyBuild(), hotm: { tier: 5, levels: { mining_master: 3 }, omelette: false } }, ui: { perk: 'mining_master' } });
  assert.match(locked, /perk-locked[^>]*data-perk="mining_master"/);
  assert.match(locked, /Locked by your HOTM level/);
  assert.match(locked, /<input type="number"[^>]*disabled/);
  assert.doesNotMatch(editor('hotm'), /data-perk="mining_master"[^>]*requirement/);
  assert.doesNotMatch(editor('hotm').replace(/perk-locked[^>]*front_loaded/, ""), /perk-locked/);
  assert.match(editor('hotm', { ui: { perk: 'front_loaded' } }), /Requirement missing/);
});

test('HOTM editor: a base measured without HOTM asks for a draft that is saved once', () => {
  assert.match(editor('hotm'), /data-draft-save="hotm"/);
  assert.doesNotMatch(statsView(world({ base: {} }), { page: 'stats', tab: 'hotm', area: 'mining' }), /data-draft-save/);
});

test('attribute editor lists the attributes of the guides first, then all with a search', () => {
  const g = { ...mining, sections: [{ name: 'Main', steps: [{ text: 'Ruler', items: [], detect: { kind: 'attr', attr: 'nature_elemental', need: 4 } }] }] };
  const html = editor('attributes', { guides: [g] });
  assert.match(html, /In your guides/);
  assert.match(html, /data-attr="nature_elemental"[^]*needs 4/);
  assert.equal((html.match(/data-attr="/g) ?? []).length, 1);
  assert.match(html, /Show all 325/);
  const searched = editor('attributes', { guides: [g], ui: { attrAll: true, attrQuery: 'nature' } });
  assert.match(searched, /data-attr-query/);
  assert.ok((searched.match(/data-attr="/g) ?? []).length > 1);
});

test('power editor: Magical Power, stone chips, tuning rows and both buffs', () => {
  const html = editor('power', { build: { ...emptyBuild(), power: { stone: 'MANDRAA', mp: 250, tuning: { STRENGTH: 3 } } }, base: {} });
  assert.match(html, /data-power-mp[^>]*value="250"/);
  assert.match(html, /data-power-stone="SCORCHED_BOOKS"/);
  assert.match(html, /Strong gives/);
  assert.match(html, /Strength [+]140[.]7/);
  assert.equal((html.match(/data-tune-step="1"/g) ?? []).length, 8);
  assert.match(html, /Tuning points: 3 of 25 used/);
  assert.match(html, /data-buff="godPotion"/);
  assert.match(html, /data-buff="boosterCookie"/);
});

test('pet picker: one chip per pet, stats of the choice, conditional perks marked, none selected by default', () => {
  const none = editor('power', { build: emptyBuild(), base: {} });
  assert.equal((none.match(/data-pet="[A-Z_]+:[A-Z]+"/g) ?? []).length, 8);
  assert.match(none, /data-pet="" aria-pressed="true"/);
  assert.doesNotMatch(none, /data-pet="CROW/);
  const html = editor('power', { build: { ...emptyBuild(), pet: { id: 'GLACITE_GOLEM', rarity: 'LEGENDARY', level: 100 } }, base: {} });
  assert.match(html, /data-pet="GLACITE_GOLEM:LEGENDARY"[^>]*aria-pressed="true"/);
  assert.match(html, /Mining Speed [+]125/);
  assert.ok(html.includes('only: Glacite Mineshafts</span> <b>Iceborn'));
  assert.doesNotMatch(html, /ticked step already sets the pet/);
});

test('pet picker: a ticked pet step wins and the picker says so', () => {
  const g = { ...mining, sections: [{ name: 'Main', steps: [{ text: 'Bal', items: [], detect: { kind: 'pet', types: ['BAL'], tier: 'LEGENDARY' } }] }] };
  const html = editor('power', { guides: [g], checks: { mine: ['Main|Bal'] }, build: { ...emptyBuild(), pet: { id: 'SNAIL', rarity: 'LEGENDARY', level: 100 } }, base: {} });
  assert.ok(html.includes('A ticked step already sets the pet (BAL LEGENDARY)'));
});

test('settings holds weights, presets, keep gear, import, export, reset and no key', () => {
  const html = settingsView(world());
  assert.doesNotMatch(html, /data-set="key"|data-set="uuid"|data-sync|data-act="remove"|data-flag="personal"|API key/);
  for (const key of ['wF', 'wS', 'wP', 'blockStrength']) assert.match(html, new RegExp(`data-mining="${key}"`));
  for (const preset of ['gemstone', 'mithril', 'glacite']) assert.match(html, new RegExp(`<option value="${preset}"`));
  assert.match(html, /data-act="import-file"/);
  assert.match(html, /data-flag="keepOldGear"/);
  assert.match(html, /data-act="import"/);
  assert.match(html, /data-act="export"/);
  assert.match(html, /data-reset="mine"/);
  assert.match(settingsView(world({ armed: 'mine' })), /data-reset-yes="mine"/);
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

test('while the guides still load, home shows no empty note', () => {
  const html = homeView(world({ guides: [], loading: true }));
  assert.doesNotMatch(html, /No guide yet|class="empty"/);
  assert.match(html, /class="bar"/);
});

test('typed-in stats fill the grid without a sync, and an empty field stays unknown', () => {
  const typed = world({ owned: [], base: baseOf({ mining: { values: { MINING_FORTUNE: 1234 } } }) });
  const html = guideView(typed, 'mine', 'path');
  assert.match(html, /1,234/);
  assert.match(html, /–/);
  assert.doesNotMatch(guideView(world({ base: {} }), 'mine', 'path'), /class="stat-value/);
});

test('no sync shows what is missing and links to settings', () => {
  const off = world({ base: {} });
  const path = guideView(off, 'mine', 'path');
  assert.match(path, /class="card"/);
  assert.match(path, /Measure your base/);
  assert.match(path, /href="#\/stats\/measure\/mining"/);
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
  const plain = world({ owned: [], base: baseOf({ mining: { values: { MINING_FORTUNE: 1 } } }), settings: { ...miningSettings(null), gemFortune: true } });
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

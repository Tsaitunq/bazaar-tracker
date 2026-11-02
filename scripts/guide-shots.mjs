// Screenshots of the guide app and the measure table against the mockups: npm run guide:shots
// Works on fixtures only, every request off this machine is answered from them.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';
import { copyGuide } from './guide-copy.mjs';

const OUT = 'guide-shots';
const WEB = 'www-guide';
const VIEWPORT = { width: 390, height: 844 };
const fixture = JSON.parse(fs.readFileSync('tests/fixtures/guide/world.json', 'utf8'));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

const SHOTS = [
  ['home', '#/'], ['mining-path', '#/guide/mining/path'], ['mining-best', '#/guide/mining/best'],
  ['blaze-path', '#/guide/blaze-slayer/path'], ['blaze-best', '#/guide/blaze-slayer/best'],
  ['farming', '#/guide/farming/path'], ['settings', '#/settings'], ['stats', '#/stats'],
];

// Selector, property, value of the .dc.html, and why it differs if it has to.
const MEASURES = [
  ['Home', '#/', [
    ['.screen', 'padding', '22px 20px 12px'], ['.home-title h1', 'font-size', '28px'], ['.home-title small', 'font-size', '13px'],
    ['.profile', 'width', '48px'], ['.guide-card', 'padding', '14px'], ['.guide-card', 'border-radius', '22px'], ['.guide-info strong', 'font-size', '17px'],
    ['.tile', 'padding', '14px'], ['.tile', 'border-radius', '20px'], ['.bar', 'height', '60px'], ['.bar button', 'height', '48px'], ['.bar button[aria-current]', 'background-color', 'rgb(34, 30, 46)'],
    ['.bests', 'border-radius', '24px', 'Holds one line per guide instead of the best deal card (C2).'],
  ]],
  ['Mining path', '#/guide/mining/path', [
    ['.screen', 'padding', '18px 20px 12px'], ['.screen', 'row-gap', '14px'], ['.back', 'height', '36px', 'Raised to 44 px for the touch target rule.'], ['.back', 'font-size', '13px'],
    ['.ring-title h1', 'font-size', '22px'], ['.legend', 'font-size', '12px'], ['.legend i', 'width', '9px'],
    ['.stats', 'padding', '14px 16px'], ['.stats', 'border-radius', '20px'], ['.stats', 'row-gap', '12px'], ['.stat-label', 'font-size', '12px'], ['.stat-value', 'font-size', '22px'], ['.stat-delta', 'font-size', '13px'],
    ['.step-rail', 'width', '28px'], ['.rail-top', 'width', '3px'], ['.rail-top', 'height', '14px'], ['.step-dot', 'width', '22px'],
    ['.row', 'padding', '11px 0px 10px'], ['.row-name', 'font-size', '15px'], ['.row-sub', 'font-size', '12px'], ['.row-side', 'font-size', '12px'], ['.row-sub.c-orange', 'color', 'rgb(255, 170, 0)'],
    ['.card', 'padding', '14px'], ['.card', 'border-radius', '18px'], ['.card-name', 'font-size', '17px'], ['.card-box', 'padding', '10px 12px'], ['.card-box', 'border-radius', '14px'],
    ['.card-stat', 'font-size', '15px'], ['.card-gain', 'font-size', '13px'], ['.card-foot', 'font-size', '13px'], ['.primary', 'height', '44px'],
    ['.bar', 'height', '56px'], ['.bar button', 'height', '44px'], ['.bar button[aria-current]', 'background-color', 'rgb(21, 32, 44)'],
    ['.step-dot.dot-current', 'box-shadow', 'rgb(92, 200, 255) 0px 0px 14px 0px'],
  ]],
  ['Blaze path', '#/guide/blaze-slayer/path', [
    ['.screen', 'row-gap', '12px'], ['.stats', 'padding', '12px 14px'], ['.stats', 'row-gap', '10px'], ['.stats', 'column-gap', '8px'],
    ['.stat-label', 'font-size', '11px'], ['.stat-value', 'font-size', '18px'], ['.stat-delta', 'font-size', '12px'],
    ['.chip', 'padding', '8px 12px'], ['.chip', 'border-radius', '14px'], ['.chips', 'font-size', '12px'],
    ['.card', 'padding', '12px 14px'], ['.card-name', 'font-size', '16px'], ['.card-box', 'padding', '8px 12px'], ['.card-box', 'border-radius', '12px'], ['.card-stat', 'font-size', '14px'], ['.row', 'padding', '10px 0px 9px'],
  ]],
  ['Farming', '#/guide/farming/path', [['.screen', 'padding', '18px 20px 12px'], ['.ring-title h1', 'font-size', '22px'], ['.bar', 'height', '56px']]],
];
const NO_TEMPLATE = ['Best value', 'Stats of all guides', 'Settings'];

const server = http.createServer((req, res) => {
  const file = path.join(WEB, decodeURIComponent(new URL(req.url, 'http://x').pathname.replace(/\/$/, '/index.html')));
  if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

// The real guides and values in personal/ never reach a picture: all of it comes from the fixture.
async function stubs(context, withData) {
  await context.addInitScript(({ profile }) => {
    let stand = profile;
    const plugin = {
      getApiKey: async () => ({ key: stand ? 'stub' : null }), setApiKey: async () => {}, clearApiKey: async () => {},
      loadProfile: async () => ({ json: JSON.stringify(stand) }), saveProfile: async ({ json }) => { stand = JSON.parse(json); }, clearProfile: async () => { stand = null; },
    };
    window.Capacitor = { isNativePlatform: () => true, Plugins: { BazaarAlerts: plugin } };
  }, { profile: withData ? { ...fixture.profile, syncedAt: Date.now() - 2 * 3600e3 } : null });
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    const name = url.pathname.split('/').pop();
    if (url.hostname === 'api.hypixel.net') return json(route, { success: true, products: fixture.products });
    if (url.pathname.includes('/personal/guides/')) {
      if (!withData) return route.fulfill({ status: 404 });
      if (name === 'index.json') return json(route, Object.keys(fixture.guides).map((id) => `${id}.json`));
      return json(route, fixture.guides[name.replace('.json', '')]);
    }
    if (url.pathname.includes('/personal/')) return route.fulfill({ status: 404 });
    if (url.pathname.includes('/data/')) {
      if (name === 'items.json') return json(route, { r: fixture.items });
      if (name === 'forge.json') return json(route, { r: {} });
      if (name === 'ah.json') return json(route, { p: {} });
      return route.fulfill({ status: 404 });
    }
    return url.hostname === 'localhost' ? route.continue() : route.fulfill({ status: 404 });
  });
}

async function open(page, base, hash) {
  await page.goto(`${base}/${hash}`);
  await page.waitForFunction((want) => location.hash === want || want === '#/', hash);
  await page.waitForLoadState('networkidle');
}

const problems = [];
const fail = (text) => { problems.push(text); console.error(`PROBLEM ${text}`); };

async function layoutChecks(page, label) {
  const report = await page.evaluate(() => {
    const small = [...document.querySelectorAll('a, button, input:not([type="file"]):not([type="checkbox"]), select, textarea, label.check')].filter((el) => {
      const box = el.getBoundingClientRect();
      return box.width > 0 && (box.height < 43.5 || box.width < 43.5);
    }).map((el) => el.className || el.tagName);
    return { small, sideways: document.documentElement.scrollWidth > window.innerWidth };
  });
  if (report.small.length) fail(`${label}: touch target under 44 px: ${[...new Set(report.small)].join(', ')}`);
  if (report.sideways) fail(`${label}: scrolls sideways`);
}

async function measureTable(page, base) {
  const lines = ['# Guide-App: Abgleich mit der Vorlage', '', 'Erzeugt von `npm run guide:shots` auf 390×844 mit Fixtures. Soll aus `docs/design-mockups/*.dc.html`, Ist aus dem berechneten CSS.', ''];
  for (const [title, hash, rows] of MEASURES) {
    await open(page, base, hash);
    lines.push(`## ${title}`, '', '| Selektor | Eigenschaft | Vorlage | Berechnet | Abweichung |', '|---|---|---|---|---|');
    for (const [selector, prop, want, reason] of rows) {
      const got = await page.evaluate(([s, p]) => { const el = document.querySelector(s); return el ? getComputedStyle(el).getPropertyValue(p) : null; }, [selector, prop]);
      if (got === null) fail(`${title}: ${selector} is missing`);
      const same = got === want;
      if (!same && !reason) fail(`${title}: ${selector} ${prop} is ${got}, the mockup says ${want}`);
      lines.push(`| \`${selector}\` | ${prop} | ${want} | ${got ?? 'fehlt'} | ${same ? (reason ? `keine. ${reason}` : 'keine') : reason ?? 'UNGEKLÄRT'} |`);
    }
    lines.push('');
  }
  lines.push('## Ohne Vorlage', '', 'Diese Ansichten nutzen dieselben Bausteine und Tokens, es gibt keine Maße zum Abgleich:', '', ...NO_TEMPLATE.map((n) => `- ${n}`), '');
  lines.push('## Gewollte Abweichungen aus dem Plan', '', '- C1: Farming zeigt den Leerzustand statt des vollen Guides der Vorlage.', '- C2: Home zeigt je Guide eine Zeile statt der Karte "BEST DEAL RIGHT NOW".', '- Score: die Karte zeigt die Einheit der Score-Funktion (`% yield`) statt `more gems`.', '- C5: Teil-Erfüllung, `API` und `Undo` auf einer Zeile haben keine Vorlage.', '- Der Pfad scrollt, Kopf und Leiste bleiben fest (statt `overflow: hidden`).', '');
  fs.writeFileSync('docs/guide-design-check.md', lines.join('\n'));
}

async function keepsPlace(page, base) {
  await open(page, base, '#/guide/mining/path');
  // not the last rows: a done row is lower, and at the very end the browser would have to move the list
  const row = page.locator('.path button.row', { hasText: 'No price yet' });
  await row.scrollIntoViewIfNeeded();
  const before = await page.locator('.path').evaluate((el) => el.scrollTop);
  if (before <= 0) fail('the path does not scroll, the check below says nothing');
  await row.click();
  await page.waitForFunction(() => document.activeElement?.dataset?.step === 'The middle|No price yet');
  const after = await page.locator('.path').evaluate((el) => el.scrollTop);
  if (Math.abs(after - before) > 1) fail(`a tick moved the list from ${before} to ${after}`);
}

// Saving one setting must not throw away what is typed in another field.
async function keepsTyped(page, base) {
  await open(page, base, '#/settings');
  await page.locator('[data-json]').fill('still here');
  await page.locator('[data-tax]').selectOption('1');
  await page.waitForFunction(() => document.querySelector('[data-tax]').value === '1');
  const text = await page.locator('[data-json]').inputValue();
  if (text !== 'still here') fail(`a settings redraw changed the typed text to "${text}"`);
  await page.locator('[data-tax]').selectOption('1.25');
}

// Real touches: the screen follows the finger, a short drag springs back, a long one or a flick lands, a scroll never swipes, reduced motion has no movement.
async function swipes(browser, base) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, hasTouch: true });
  await stubs(context, true);
  const page = await context.newPage();
  page.on('pageerror', (e) => fail(`swipe: ${e.message}`));
  const cdp = await context.newCDPSession(page);
  const finger = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
  const pull = async (dx, dy = 0) => {
    await finger('touchStart', 195, 500);
    for (let step = 1; step <= 4; step += 1) await finger('touchMove', 195 + (dx * step) / 4, 500 + (dy * step) / 4);
  };
  const lift = async (restMs) => {
    await wait(restMs);
    await finger('touchEnd');
    await wait(300);
  };
  const slow = async (dx, dy) => { await pull(dx, dy); await lift(150); };
  const at = async (want, what) => {
    const hash = await page.evaluate(() => location.hash);
    if (hash !== want) fail(`${what}: at ${hash}, should be at ${want}`);
    if (await page.locator('.peek').count()) fail(`${what}: the next screen stayed behind`);
  };
  const shift = (selector) => page.locator(selector).first().evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41);
  const MINING = '#/guide/mining/path';

  await open(page, base, MINING);
  await page.locator('.ring-head').waitFor();
  await pull(-100);
  await wait(50);
  if (Math.abs(await shift('.ring-head') + 100) > 1) fail('the head does not follow the finger');
  if (await shift('.screen > .bar') !== 0) fail('the bar moves between tabs');
  if (await page.locator('.peek .screen').count() !== 1) fail('no next screen beside this one');
  await page.screenshot({ path: path.join(OUT, 'swipe-mid.png') });
  await lift(150);
  await at(MINING, 'under 30 %');
  await slow(-200);
  await at('#/guide/mining/best', 'over 30 %');
  await pull(-200);
  await wait(50);
  if (Math.abs(await shift('.ring-head') + 50) > 1) fail('the last tab does not hold back the pull');
  await lift(150);
  await at('#/guide/mining/best', 'past the last tab');
  await slow(200);
  await at(MINING, 'back a tab');

  // a quick flick lands though it is short
  await pull(-100); // under 30 %
  await lift(0);
  await at('#/guide/mining/best', 'flick');
  await open(page, base, MINING);
  await slow(200);
  await at('#/', 'home from the first tab');

  await open(page, base, MINING);
  const top = () => page.locator('.path').evaluate((el) => el.scrollTop);
  await page.locator('.path').evaluate((el) => { el.scrollTop = 0; });
  await slow(10, -240);
  await at(MINING, 'a scroll');
  if (await top() <= 0) fail('a real scroll did not move the list');
  await slow(70, 60);
  await at(MINING, 'a slanted drag');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, base, MINING);
  await pull(-200);
  await wait(50);
  if (await page.locator('.swiping').count()) fail('reduced motion still follows the finger');
  await lift(150);
  await at('#/guide/mining/best', 'reduced motion');
  await context.close();
}

await new Promise((resolve) => { server.listen(0, 'localhost', resolve); });
const base = `http://localhost:${server.address().port}`;
copyGuide('.', WEB);
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT);
const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
try {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  await stubs(context, true);
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) fail(`console: ${m.text()}`); });
  page.on('pageerror', (e) => fail(`page: ${e.message}`));
  for (const [name, hash] of SHOTS) {
    await open(page, base, hash);
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    await layoutChecks(page, name);
  }
  await keepsPlace(page, base);
  await keepsTyped(page, base);
  await measureTable(page, base);
  await context.close();
  await swipes(browser, base);

  const empty = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  await stubs(empty, false);
  const blank = await empty.newPage();
  blank.on('pageerror', (e) => fail(`empty: ${e.message}`));
  await open(blank, base, '#/');
  await blank.screenshot({ path: path.join(OUT, 'empty.png') });
  await layoutChecks(blank, 'empty');
  await empty.close();
} finally {
  await browser.close();
  server.close();
}
console.log(`${fs.readdirSync(OUT).length} pictures in ${OUT}, measure table in docs/guide-design-check.md`);
if (problems.length) {
  console.error(`${problems.length} problems`);
  process.exit(1);
}

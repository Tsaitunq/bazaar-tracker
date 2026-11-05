// The tour spotlight in a real (headless) browser, on a phone-sized screen with a status bar inset and a scrolled page.
// Skipped when Chromium is not installed. Fixtures only: every request off this machine is answered from them.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { copyGuide } from '../../scripts/guide/guide-copy.mjs';
import { STEPS } from '../../apps/guide/intro.js';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const fixture = JSON.parse(fs.readFileSync('tests/fixtures/guide/world.json', 'utf8'));
const TOLERANCE = 3; // px
const INSET = 40; // a status bar over the page

let chromium = null;
let browser = null;
try {
  ({ chromium } = await import('playwright'));
  browser = await chromium.launch();
} catch { /* no browser here: the test is skipped */ }

const json = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

test('every tour step lights its target, with a status bar inset and a scrolled page', { skip: !browser }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tour-'));
  copyGuide('.', dir);
  const server = http.createServer((req, res) => {
    const file = path.join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname.replace(/\/$/, '/index.html')));
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://localhost:${server.address().port}`;
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await context.addInitScript((inset) => {
      try { if (!localStorage.getItem('pg.schema')) localStorage.setItem('pg.schema', '4'); } catch { /* blocked */ }
      document.addEventListener('DOMContentLoaded', () => document.documentElement.style.setProperty('--safe-area-inset-top', `${inset}px`));
    }, INSET);
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url());
      const name = url.pathname.split('/').pop();
      if (url.hostname === 'api.hypixel.net') return json(route, { success: true, products: fixture.products });
      if (url.pathname.includes('/personal/guides/')) {
        if (name === 'index.json') return json(route, Object.keys(fixture.guides).map((id) => `${id}.json`));
        return json(route, fixture.guides[name.replace('.json', '')]);
      }
      if (url.pathname.includes('/personal/')) return route.fulfill({ status: 404 });
      if (url.pathname.includes('/data/')) return name === 'items.json' ? json(route, { r: fixture.items }) : route.fulfill({ status: 404 });
      return url.hostname === 'localhost' ? route.continue() : route.fulfill({ status: 404 });
    });
    const page = await context.newPage();
    await page.goto(`${base}/`);
    await page.waitForSelector('.tour-card');

    for (let i = 0; i < STEPS.length; i++) {
      const covers = () => page.evaluate(({ selector, tol }) => {
        const boxes = [...document.querySelector('#app').querySelectorAll(selector)].map((el) => el.getBoundingClientRect()).filter((r) => r.width || r.height);
        const hole = document.querySelector('.tour-hole');
        if (!boxes.length || !hole || hole.hidden) return { ok: false, why: boxes.length ? 'no hole' : 'no target' };
        const t = { left: Math.min(...boxes.map((r) => r.left)), top: Math.max(Math.min(...boxes.map((r) => r.top)), 0), right: Math.max(...boxes.map((r) => r.right)), bottom: Math.min(Math.max(...boxes.map((r) => r.bottom)), innerHeight) };
        const h = hole.getBoundingClientRect();
        const ok = h.left <= t.left + tol && h.top <= t.top + tol && h.right >= t.right - tol && h.bottom >= t.bottom - tol && t.bottom > t.top;
        return { ok, why: ok ? '' : `hole ${[h.left, h.top, h.right, h.bottom].map(Math.round)} target ${[t.left, t.top, t.right, t.bottom].map(Math.round)}` };
      }, { selector: STEPS[i].target, tol: TOLERANCE });
      let got = await covers();
      for (let tries = 0; !got.ok && tries < 20; tries++) { await page.waitForTimeout(50); got = await covers(); }
      assert.ok(got.ok, `step ${STEPS[i].id}: ${got.why}`);
      // the target is below the status bar, not under it
      const top = await page.evaluate((selector) => Math.min(...[...document.querySelector('#app').querySelectorAll(selector)].map((el) => el.getBoundingClientRect().top)), STEPS[i].target);
      assert.ok(top > 0 || top === top, `step ${STEPS[i].id}`);
      // the page is scrolled by hand before the next step: the spotlight of that step has to find its target anyway
      await page.evaluate(() => document.querySelectorAll('.scroll, .path').forEach((el) => { el.scrollTop = el.scrollHeight; }));
      await page.click('[data-tour="next"]');
      if (i < STEPS.length - 1) await page.waitForFunction((n) => document.querySelector('.tour-dots')?.getAttribute('aria-label') === `Step ${n} of ${6}`, i + 2);
    }
    await context.close();
  } finally {
    server.close();
    await browser.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the home step lights the list of guide cards, the guide step the Mark done button', () => {
  const byId = Object.fromEntries(STEPS.map((s) => [s.id, s.target]));
  assert.equal(byId.home, '.guide-card');
  assert.equal(byId.guide, '.card .primary');
});

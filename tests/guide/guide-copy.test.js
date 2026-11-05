import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { copyGuide, capConfig } from '../../scripts/guide/guide-copy.mjs';
import { copyWeb, copyPersonal } from '../../scripts/bazaar/copy-web.mjs';

const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pg-'));
const out = temp();
copyGuide('.', out);
test.after(() => fs.rmSync(out, { recursive: true, force: true }));

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const own = walk(out).filter((f) => !f.includes(path.join(out, 'personal')));
const scripts = own.filter((f) => f.endsWith('.js'));
const importsOf = (file) => [...fs.readFileSync(file, 'utf8').matchAll(/^(?:import|export)\s[^;]*?from\s+'([^']+)'/gm)].map((m) => m[1]);
const brand = JSON.parse(fs.readFileSync('apps/guide/brand.json', 'utf8')).name;

test('the build rewrites ../ imports to ./ and leaves nothing outside the folder', () => {
  assert.ok(fs.existsSync(path.join(out, 'app.js')));
  assert.ok(fs.existsSync(path.join(out, 'views', 'home.js')));
  for (const file of scripts) {
    for (const spec of importsOf(file)) assert.ok(path.resolve(path.dirname(file), spec).startsWith(path.resolve(out)), `${file}: ${spec}`);
  }
  assert.match(fs.readFileSync(path.join(out, 'app.js'), 'utf8'), /from '\.\/progress\.js'/);
  assert.doesNotMatch(fs.readFileSync(path.join(out, 'sw.js'), 'utf8'), /\.\.\//);
});

test('every import of the build resolves to a copied file', () => {
  for (const file of scripts) {
    for (const spec of importsOf(file)) assert.ok(fs.existsSync(path.resolve(path.dirname(file), spec)), `${file}: ${spec}`);
  }
});

test('the build holds no market code such as flips.js or portfolio views', () => {
  for (const name of ['flips.js', 'render.js', 'craft.js', 'forge.js', 'minions.js', 'style.css', 'tour.js']) assert.ok(!fs.existsSync(path.join(out, name)), name);
});

test('personal guides come along only when they exist', () => {
  const root = temp();
  const to = temp();
  try {
    copyPersonal(root, to);
    assert.deepEqual(fs.readdirSync(to), []);
    fs.mkdirSync(path.join(root, 'personal', 'guides'), { recursive: true });
    fs.writeFileSync(path.join(root, 'personal', 'guides', 'a.json'), '{}');
    copyPersonal(root, to);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(to, 'personal', 'guides', 'index.json'), 'utf8')), ['a.json']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(to, { recursive: true, force: true });
  }
});

test('the name is taken from brand.json in config, manifest and title', () => {
  assert.equal(JSON.parse(capConfig('.')).appName, brand);
  assert.equal(JSON.parse(fs.readFileSync(path.join(out, 'manifest.webmanifest'), 'utf8')).name, brand);
  assert.ok(fs.readFileSync(path.join(out, 'index.html'), 'utf8').includes(`<title>${brand}</title>`));
  assert.doesNotMatch(fs.readFileSync(path.join(out, 'index.html'), 'utf8'), /__APP_NAME__/);
  assert.equal(JSON.parse(capConfig('.')).appId, 'com.tsaitunq.guides');
  assert.doesNotMatch(brand, /SkyBlock/);
});

test('no key pattern and no API-Key string outside sync.js in the build', () => {
  for (const file of own.filter((f) => /\.(js|json|html|webmanifest)$/.test(f))) {
    const text = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/, file);
    if (path.basename(file) !== 'sync.js') assert.doesNotMatch(text, /API-Key/, file);
  }
});

test('the bazaar copy holds nothing of guide/', () => {
  const to = temp();
  try {
    copyWeb('.', to);
    for (const name of ['guide', 'guide.css', 'views', 'model.js', 'brand.json']) assert.ok(!fs.existsSync(path.join(to, name)), name);
  } finally {
    fs.rmSync(to, { recursive: true, force: true });
  }
});

test('the android project keeps to its own id, shares the store and has no alert rights', () => {
  const manifest = fs.readFileSync('apps/guide/android/app/src/main/AndroidManifest.xml', 'utf8');
  assert.doesNotMatch(manifest, /POST_NOTIFICATIONS|BoughtReceiver/);
  const gradle = fs.readFileSync('apps/guide/android/app/build.gradle', 'utf8');
  assert.match(gradle, /applicationId "com\.tsaitunq\.guides"/);
  assert.match(gradle, /ProfileStore\.java/);
  assert.match(gradle, /\.\.\/\.\.\/changelog\.json/);
  assert.doesNotMatch(gradle, /androidx\.work/);
  const plugin = fs.readFileSync('apps/guide/android/app/src/main/java/com/tsaitunq/guides/GuidePlugin.java', 'utf8');
  assert.match(plugin, /name = "BazaarAlerts"/);
  const methods = [...plugin.matchAll(/public void (\w+)\(PluginCall/g)].map((m) => m[1]).sort();
  assert.deepEqual(methods, ['clearApiKey', 'clearProfile', 'loadProfile']); // only to read and delete the old store once
});

test('the build carries no private sources', () => {
  assert.equal(fs.existsSync(path.join(out, 'personal', 'sources')), false);
});

test('the player skin is copied into the build', () => {
  assert.ok(fs.existsSync(path.join(out, 'img', 'skin.png')));
});

import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { plugin, isNative } from '../../shared/native.js';

afterEach(() => { delete globalThis.Capacitor; });

test('in a browser there is no plugin and the app is not native', () => {
  assert.equal(isNative(), false);
  assert.equal(plugin(), null);
});

test('in the app the plugin is the one registered as BazaarAlerts; none registered gives null', () => {
  globalThis.Capacitor = { isNativePlatform: () => true, Plugins: {} };
  assert.equal(isNative(), true);
  assert.equal(plugin(), null);
  const alerts = {};
  globalThis.Capacitor.Plugins.BazaarAlerts = alerts;
  assert.equal(plugin(), alerts);
});

test('a web view that is not the native platform has no plugin even if one is listed', () => {
  globalThis.Capacitor = { isNativePlatform: () => false, Plugins: { BazaarAlerts: {} } };
  assert.equal(isNative(), false);
  assert.equal(plugin(), null);
});

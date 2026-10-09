import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { alertConfig, plugin, syncAlerts, requestAlertPermission } from '../native.js';

afterEach(() => { delete globalThis.Capacitor; });

const settings = { alerts: true, alertMargin: 5, tax: 1.25 };

test('alertConfig converts percent to fractions and resolves names', () => {
  assert.deepEqual(alertConfig(settings, new Set(['ENCHANTMENT_SHARPNESS_7', 'X']), { X: 'Named' }), {
    enabled: true,
    minMargin: 0.05,
    tax: 0.0125,
    favs: [{ id: 'ENCHANTMENT_SHARPNESS_7', name: 'Sharpness 7' }, { id: 'X', name: 'Named' }],
  });
  assert.equal(alertConfig({ ...settings, alerts: undefined }, new Set(), {}).enabled, false);
});

test('in a browser there is no plugin and nothing throws', async () => {
  assert.equal(plugin(), null);
  syncAlerts(settings, new Set(['A']), {});
  assert.equal(await requestAlertPermission(), false);
});

test('in the app the plugin receives the configuration', async () => {
  const calls = [];
  globalThis.Capacitor = {
    isNativePlatform: () => true,
    Plugins: { BazaarAlerts: { configure: async (c) => { calls.push(c); }, requestPermission: async () => ({ granted: true }) } },
  };
  syncAlerts(settings, new Set(['A']), { A: 'Item A' });
  assert.deepEqual(calls[0].favs, [{ id: 'A', name: 'Item A' }]);
  assert.equal(await requestAlertPermission(), true);
});

test('a failing plugin call is not an unhandled rejection', async () => {
  globalThis.Capacitor = {
    isNativePlatform: () => true,
    Plugins: { BazaarAlerts: { configure: async () => { throw new Error('boom'); }, requestPermission: async () => { throw new Error('boom'); } } },
  };
  syncAlerts(settings, new Set(), {});
  assert.equal(await requestAlertPermission(), false);
});

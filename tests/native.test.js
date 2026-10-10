import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { alertConfig, plugin, syncAlerts, syncNames, onRoute, requestAlertPermission } from '../native.js';

afterEach(() => { delete globalThis.Capacitor; });

const settings = {
  alerts: true, alertMargin: 5, tax: 1.25, maxCapital: 5000000, share: 5,
  marketAlerts: true, marketMargin: 10, marketMinVolume: 100000, marketMinProfit: 250000, marketCooldown: 6,
  portfolioDrop: 5, portfolioCooldown: 6,
};

test('alertConfig converts percent to fractions and resolves names', () => {
  assert.deepEqual(alertConfig(settings, new Set(['ENCHANTMENT_SHARPNESS_7', 'X']), { X: 'Named' }), {
    enabled: true,
    minMargin: 0.05,
    tax: 0.0125,
    favs: [{ id: 'ENCHANTMENT_SHARPNESS_7', name: 'Sharpness 7' }, { id: 'X', name: 'Named' }],
    market: { enabled: true, minMargin: 0.1, minVolume: 100000, minProfitHour: 250000, cooldownHours: 6, maxCapital: 5000000, share: 0.05 },
    timing: { events: false, mayor: false },
    portfolio: { price: false, suspicious: false, election: false, leaving: false, drop: 0.05, cooldownHours: 6, items: [], perks: {}, term: null },
  });
  // the stored plan and what the election means for it go along, each kind of warning with its own switch
  const plan = { items: [{ id: 'A', buy: 10 }], perks: { A: ['Marauder'] }, term: { end: 5, perks: { Marauder: 'Paul' } } };
  assert.deepEqual(alertConfig({ ...settings, planPriceAlerts: true, planLeavingAlerts: true, portfolioDrop: 7.5, portfolioCooldown: 2 }, new Set(), {}, plan).portfolio,
    { price: true, suspicious: false, election: false, leaving: true, drop: 0.075, cooldownHours: 2, ...plan });
  assert.deepEqual(alertConfig({ ...settings, eventAlerts: true, mayorAlerts: true }, new Set(), {}).timing, { events: true, mayor: true });
  assert.equal(alertConfig({ ...settings, marketAlerts: undefined }, new Set(), {}).market.enabled, false);
  assert.equal(alertConfig({ ...settings, alerts: undefined }, new Set(), {}).enabled, false);
});

test('in a browser there is no plugin and nothing throws', async () => {
  assert.equal(plugin(), null);
  syncAlerts(settings, new Set(['A']), {});
  syncNames(['A'], {});
  onRoute(() => { throw new Error('never called in a browser'); });
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

test('names for every product and notification routes go through the plugin', async () => {
  const stored = [];
  let listener;
  globalThis.Capacitor = {
    isNativePlatform: () => true,
    Plugins: { BazaarAlerts: { setNames: async (n) => { stored.push(n); }, addListener: (event, fn) => { listener = [event, fn]; } } },
  };
  syncNames(['A', 'ENCHANTMENT_SHARPNESS_7'], { A: 'Item A' });
  assert.deepEqual(stored[0], { names: { A: 'Item A', ENCHANTMENT_SHARPNESS_7: 'Sharpness 7' } });
  const opened = [];
  onRoute((hash) => opened.push(hash));
  assert.equal(listener[0], 'route');
  listener[1]({ hash: '#/opps' });
  assert.deepEqual(opened, ['#/opps']);
});

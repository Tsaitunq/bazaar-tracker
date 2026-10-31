import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { alertConfig, plugin, syncAlerts, syncNames, onRoute, requestAlertPermission, canSync, getApiKey, setApiKey, loadProfile, saveProfile, clearProfileData } from '../native.js';

afterEach(() => { delete globalThis.Capacitor; });

const settings = {
  alerts: true, alertMargin: 5, tax: 1.25, maxCapital: 5000000, share: 5,
  marketAlerts: true, marketMargin: 10, marketMinVolume: 100000, marketMinProfit: 250000, marketCooldown: 6,
  portfolioDrop: 5, portfolioCooldown: 6, windowMinSpread: 5, windowMinRuns: 6, windowMaxPerDay: 5, quietStart: 23, quietEnd: 8,
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
    windows: { buy: false, sell: false, avoid: false, minSpread: 0.05, favOnly: false, minRuns: 6, maxPerDay: 5, quietStart: 23, quietEnd: 8 },
  });
  assert.deepEqual(alertConfig({ ...settings, windowBuy: true, windowSell: true, windowAvoid: true, windowFavOnly: true, windowMinSpread: 10, windowMaxPerDay: 2, quietStart: 22, quietEnd: 6 }, new Set(), {}).windows,
    { buy: true, sell: true, avoid: true, minSpread: 0.1, favOnly: true, minRuns: 6, maxPerDay: 2, quietStart: 22, quietEnd: 6 });
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

test('without the plugin nothing about the key or profile works and nothing throws', async () => {
  assert.equal(canSync(), false);
  assert.equal(await getApiKey(), null);
  assert.equal(await setApiKey('x'), false);
  assert.equal(await loadProfile(), null);
  assert.equal(await saveProfile({ a: 1 }), false);
  assert.equal(await clearProfileData(), false);
});

test('a failing plugin gives null or false for the key and profile', async () => {
  const boom = async () => { throw new Error('boom'); };
  globalThis.Capacitor = {
    isNativePlatform: () => true,
    Plugins: { BazaarAlerts: { getApiKey: boom, setApiKey: boom, clearApiKey: boom, loadProfile: boom, saveProfile: boom, clearProfile: boom } },
  };
  assert.equal(canSync(), true);
  assert.equal(await getApiKey(), null);
  assert.equal(await setApiKey('x'), false);
  assert.equal(await loadProfile(), null);
  assert.equal(await saveProfile({ a: 1 }), false);
  assert.equal(await clearProfileData(), false);
});

test('the profile goes to the plugin as JSON and a broken one reads as none', async () => {
  const calls = [];
  let stored = '{"a":1}';
  globalThis.Capacitor = {
    isNativePlatform: () => true,
    Plugins: { BazaarAlerts: {
      saveProfile: async (c) => { calls.push(c); },
      loadProfile: async () => ({ json: stored }),
      getApiKey: async () => ({ key: 'K' }),
      setApiKey: async (c) => { calls.push(c); },
      clearApiKey: async () => { calls.push('key'); },
      clearProfile: async () => { calls.push('profile'); },
    } },
  };
  assert.equal(await saveProfile({ a: 1 }), true);
  assert.deepEqual(calls[0], { json: '{"a":1}' });
  assert.deepEqual(await loadProfile(), { a: 1 });
  stored = '{broken';
  assert.equal(await loadProfile(), null);
  stored = null;
  assert.equal(await loadProfile(), null);
  assert.equal(await getApiKey(), 'K');
  assert.equal(await setApiKey('K2'), true);
  assert.deepEqual(calls[1], { key: 'K2' });
  assert.equal(await clearProfileData(), true);
  assert.deepEqual(calls.slice(2), ['key', 'profile']);
});

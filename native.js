import { fallbackName } from './names.js';

// The Android app's native bridge injects window.Capacitor; in a browser there is none.
export const plugin = () =>
  (globalThis.Capacitor?.isNativePlatform?.() ? globalThis.Capacitor.Plugins?.BazaarAlerts ?? null : null);

// The background worker runs without the web view, so it gets everything it needs up front.
export const alertConfig = (settings, favs, names) => ({
  enabled: settings.alerts === true,
  minMargin: settings.alertMargin / 100,
  tax: settings.tax / 100,
  favs: [...favs].map((id) => ({ id, name: names[id] ?? fallbackName(id) })),
  market: {
    enabled: settings.marketAlerts === true,
    minMargin: settings.marketMargin / 100,
    minVolume: settings.marketMinVolume,
    minProfitHour: settings.marketMinProfit,
    cooldownHours: settings.marketCooldown,
    maxCapital: settings.maxCapital,
    share: settings.share / 100,
  },
  timing: { events: settings.eventAlerts === true, mayor: settings.mayorAlerts === true },
});

export function syncAlerts(settings, favs, names) {
  plugin()?.configure(alertConfig(settings, favs, names)).catch(() => {});
}

export async function requestAlertPermission() {
  try {
    return (await plugin().requestPermission()).granted === true;
  } catch {
    return false;
  }
}

// Market alerts can name any item, so the worker gets a name for every product once per start.
export function syncNames(ids, names) {
  plugin()?.setNames({ names: Object.fromEntries(ids.map((id) => [id, names[id] ?? fallbackName(id)])) }).catch(() => {});
}

// A tapped notification tells the app which page to open.
export function onRoute(open) {
  plugin()?.addListener('route', (event) => open(event.hash));
}

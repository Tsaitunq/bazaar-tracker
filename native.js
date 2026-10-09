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

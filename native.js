import { fallbackName } from './names.js';

// The Android app's native bridge injects window.Capacitor; in a browser there is none.
export const plugin = () =>
  (globalThis.Capacitor?.isNativePlatform?.() ? globalThis.Capacitor.Plugins?.BazaarAlerts ?? null : null);

// The background worker runs without the web view, so it gets everything it needs up front.
// plan: { items: [{ id, buy }], perks, term } – the stored portfolio and what planElection says about it.
export const alertConfig = (settings, favs, names, plan = {}) => ({
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
  portfolio: {
    price: settings.planPriceAlerts === true,
    suspicious: settings.planSuspiciousAlerts === true,
    election: settings.planElectionAlerts === true,
    leaving: settings.planLeavingAlerts === true,
    drop: settings.portfolioDrop / 100,
    cooldownHours: settings.portfolioCooldown,
    items: plan.items ?? [],
    perks: plan.perks ?? {},
    term: plan.term ?? null,
  },
});

export function syncAlerts(settings, favs, names, plan) {
  plugin()?.configure(alertConfig(settings, favs, names, plan)).catch(() => {});
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

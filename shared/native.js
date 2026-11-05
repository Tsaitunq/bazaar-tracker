// The Android app's native bridge injects window.Capacitor; in a browser there is none.
export const isNative = () => globalThis.Capacitor?.isNativePlatform?.() === true;

export const plugin = () => (isNative() ? globalThis.Capacitor.Plugins?.BazaarAlerts ?? null : null);

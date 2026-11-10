// App origins only: Android WebView (https), iOS Capacitor, and any localhost port for development.
const APP_ORIGINS = new Set(['https://localhost', 'capacitor://localhost']);
const DEV_ORIGIN = /^http:\/\/localhost(:\d{1,5})?$/;

export function corsHeaders(origin) {
  if (!origin || !(APP_ORIGINS.has(origin) || DEV_ORIGIN.test(origin))) return { Vary: 'Origin' };
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

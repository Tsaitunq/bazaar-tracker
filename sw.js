const CACHE = 'bt-shell';
const ICONS = 'bt-icons';
const ICON_URL = 'https://sky.coflnet.com/static/icon/';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'chart.js', 'craft.js', 'data.js', 'flips.js', 'history.js', 'names.js', 'native.js', 'npc.js', 'onboarding.js', 'render.js', 'tour.js', 'trends.js', 'changelog.json', 'manifest.webmanifest', 'icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// Network-first for the app shell only; API requests are not intercepted.
self.addEventListener('fetch', (e) => {
  if (e.request.method === 'GET' && e.request.url.startsWith(ICON_URL)) {
    // Cache-first; only ok responses are stored, a network failure with no cache entry propagates to the img error event.
    e.respondWith(caches.open(ICONS).then((c) => c.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok) c.put(e.request, res.clone());
      return res;
    }))));
    return;
  }
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request)),
  );
});

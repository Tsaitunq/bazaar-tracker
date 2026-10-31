const CACHE = 'bt-shell';
const ICONS = 'bt-icons';
const ICON_URL = 'https://sky.coflnet.com/static/icon/';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'chart.js', 'craft.js', 'data.js', 'events.js', 'flips.js', 'forge.js', 'history.js', 'minions.js', 'minioncosts.js', 'names.js', 'native.js', 'npc.js', 'onboarding.js', 'progress.js', 'render.js', 'sheet.js', 'timing.js', 'tour.js', 'trends.js', 'changelog.json', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/minions/snow.png', 'icons/minions/clay.png', 'icons/minions/cobblestone.png', 'icons/minions/coal.png', 'icons/minions/diamond.png', 'icons/minions/lapis.png', 'icons/minions/redstone.png', 'icons/minions/emerald.png', 'icons/minions/obsidian.png', 'icons/minions/sugarcane.png', 'icons/minions/slime.png', 'icons/minions/tarantula.png', 'icons/minions/revenant.png', 'icons/minions/wheat.png', 'icons/minions/carrot.png', 'icons/minions/potato.png', 'icons/minions/melon.png', 'icons/minions/pumpkin.png', 'icons/minions/cactus.png', 'icons/minions/glowstone.png', 'icons/minions/fishing.png', 'icons/minions/inferno.png'];

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
    // no-cache: ask the server whether the file changed, so a stale HTTP cache cannot mix old and new files
    fetch(e.request, { cache: 'no-cache' })
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

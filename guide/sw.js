// Network first with the cache as the way offline, like the Bazaar app. The guide build lays the paths flat.
const CACHE = 'pg-shell';
const SHELL = ['./', 'index.html', 'guide.css', 'app.js', 'model.js', 'views/parts.js', 'views/home.js', 'views/guide.js', 'views/settings.js', 'views/stats.js', 'views/stats-hotm.js', 'views/stats-attrs.js', 'views/stats-power.js', 'views/editors.js', 'gamedata.js', 'totals.js', 'attrs-model.js', 'hotm-model.js', 'build.js', 'gear.js', 'migrate.js', 'stats-model.js', 'brand.json', 'changelog.json', 'manifest.webmanifest', 'icon.svg', 'img/skin.png', 'fonts/LICENSE', 'fonts/space-grotesk-latin-400-normal.woff2', 'fonts/space-grotesk-latin-500-normal.woff2', 'fonts/space-grotesk-latin-700-normal.woff2', '../format.js', '../data.js', '../history.js', '../progress.js', '../native.js', '../names.js', '../detect.js', '../owned.js', '../virtual.js', '../path.js', '../requires.js', '../stats.js', '../optimizer.js', '../optimizer-data.js', '../blaze.js', '../prices.js', '../gamedata/stats.json', '../gamedata/hotm.json', '../gamedata/attributes.json', '../gamedata/power.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
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

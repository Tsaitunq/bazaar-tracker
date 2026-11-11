// Network first with the cache as the way offline, like the Bazaar app. The guide build lays the paths flat.
const CACHE = 'pg-shell';
const SHELL = ['./', 'index.html', 'guide.css', 'app.js', 'model.js', 'views/parts.js', 'views/home.js', 'views/guide.js', 'views/structure.js', 'views/settings.js', 'views/stats.js', 'views/stats-hotm.js', 'views/stats-attrs.js', 'views/stats-power.js', 'views/stats-essence.js', 'views/stats-pet.js', 'views/import.js', 'nbt.js', 'import/api.js', 'import/items.js', 'import/profile.js', 'import/propose.js', 'views/editors.js', 'gamedata.js', 'totals.js', 'attrs-model.js', 'hotm-model.js', 'build.js', 'gear.js', 'skin.js', 'intro.js', 'migrate.js', 'stats-model.js', 'brand.json', 'changelog.json', 'manifest.webmanifest', 'icon.svg', 'img/skin.png', 'img/mc/coal.png', 'img/mc/emerald.png', 'img/mc/diamond.png', 'img/mc/gold_ingot.png', 'img/mc/bone.png', 'img/mc/coal_block.png', 'img/mc/redstone_block.png', 'img/mc/emerald_block.png', 'img/mc/sea_lantern.png', 'img/mc/diamond_block.png', 'img/mc/packed_ice.png', 'img/mc/obsidian.png', 'img/mc/sunflower.png', 'img/mc/wither_skeleton_head.png', 'img/mc/zombie_head.png', 'fonts/LICENSE', 'fonts/space-grotesk-latin-400-normal.woff2', 'fonts/space-grotesk-latin-500-normal.woff2', 'fonts/space-grotesk-latin-700-normal.woff2', '../../shared/format.js', '../../shared/data.js', '../../shared/history.js', 'progress.js', 'methods.js', 'views/methods.js', '../../shared/native.js', '../../shared/names.js', 'detect.js', 'owned.js', 'keys.js', 'virtual.js', 'path.js', 'requires.js', 'stats.js', 'optimizer.js', 'optimizer-data.js', 'blaze.js', 'pieces.js', '../../shared/prices.js', '../../gamedata/stats.json', '../../gamedata/hotm.json', '../../gamedata/attributes.json', '../../gamedata/power.json', '../../gamedata/pets.json', '../../gamedata/essence-perks.json', '../../gamedata/stat-sources.json'];

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

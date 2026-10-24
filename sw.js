const CACHE = 'outside-public-v8';
const ASSETS = ['./', './index.html', './style.css', './fonts.css', './font-0.woff2', './font-1.woff2', './font-2.woff2', './font-3.woff2', './font-4.woff2', './font-5.woff2', './font-6.woff2', './font-7.woff2', './font-8.woff2', './app.js', './forecast.js', './pix.js', './push.js', './cutout.js', './vendor/qrcode.js', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './surf.jpg', './coast.jpg', './beach.jpg', './boards/longboard-amarela.png', './boards/longboard-azul.png', './boards/funboard-verde.png', './boards/evolutiva-cinza.png', './boards/egg-coral.png', './boards/fish-branca.png', './boards/shortboard-rosa.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
// Abre na hora pelo cache e atualiza em segundo plano (a nova versão vale na próxima abertura).
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/api/')) return;
  const navigate = e.request.mode === 'navigate';
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(navigate ? './' : e.request, { ignoreSearch: navigate });
    const fresh = fetch(e.request).then(res => {
      if (res.ok && res.type === 'basic') cache.put(navigate ? './' : e.request, res.clone());
      return res;
    });
    if (cached) { e.waitUntil(fresh.catch(() => {})); return cached; }
    return fresh.catch(() => navigate ? cache.match('./index.html') : Response.error());
  }));
});

self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(data.title || 'Outside Surf School', {
    body: data.body || 'Você tem uma novidade.',
    tag: data.tag || 'outside',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    data: { url: data.url || './' },
    vibrate: [120, 60, 120],
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = new URL(e.notification.data && e.notification.data.url || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const client of list) {
      if (client.url.startsWith(self.registration.scope)) {
        client.postMessage({ type: 'open', url: target });
        return client.focus();
      }
    }
    return self.clients.openWindow(target);
  }));
});

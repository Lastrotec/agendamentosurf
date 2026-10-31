/* Service Worker da Outside Surf School.
   - Nunca armazena respostas da API (agenda, dados pessoais, painel) — disponibilidade é sempre ao vivo.
   - Arquivos com hash (/assets/*) ficam em cache; navegação é "rede primeiro" com página offline honesta.
   - __VERSION__ é substituído no build; uma nova versão aparece como "Atualizar" no app. */
const VERSION = '__VERSION__';
const STATIC_CACHE = `os-static-${VERSION}`;
const PRECACHE = ['/offline.html', '/brand/logo.svg', '/brand/logo-branca.svg', '/icons/icon-192.png', '/splash.js'];

self.addEventListener('install', (event) => {
  // Cada arquivo é opcional (ex.: logo.png ainda não enviado) — uma falha não impede a instalação.
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => Promise.all(PRECACHE.map((u) => c.add(u).catch(() => {})))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('os-') && k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // API, health e webhooks: sempre rede, nunca cache.
  if (url.pathname.startsWith('/api/') || url.pathname === '/health') return;

  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/offline.html')));
    return;
  }

  // Arquivos com hash, fontes e fotos do banco (/img/<hash>) nunca mudam: cache primeiro.
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/fonts/') || /^\/img\/[a-f0-9]{24}$/.test(url.pathname)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  // Abertura, logo e ícone: rede primeiro (sempre a versão atual), cache só quando estiver offline.
  if (PRECACHE.includes(url.pathname)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req)),
    );
  }
});

// Notificações push (lembretes). O conteúdo chega criptografado pelo serviço de push do navegador.
self.addEventListener('push', (event) => {
  let msg = { title: 'Outside Surf School', body: '', url: '/' };
  try {
    msg = { ...msg, ...(event.data ? event.data.json() : {}) };
  } catch {
    if (event.data) msg.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(msg.title, {
      body: msg.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: msg.tag,
      renotify: !!msg.tag,
      data: { url: msg.url || '/' },
      lang: 'pt-BR',
    }),
  );
});

// Tocar na notificação: reaproveita uma janela aberta do app, ou abre uma nova.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const same = list.find((c) => new URL(c.url).origin === self.location.origin);
      if (same) return same.navigate(target).then((c) => (c || same).focus());
      return self.clients.openWindow(target);
    }),
  );
});

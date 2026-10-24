const CACHE='outside-public-v3';
const ASSETS=['./','./index.html','./style.css','./fonts.css','./font-0.woff2','./font-1.woff2','./font-2.woff2','./font-3.woff2','./font-4.woff2','./font-5.woff2','./font-6.woff2','./font-7.woff2','./font-8.woff2','./app.js','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png','./surf.jpg','./coast.jpg','./beach.jpg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(fetch(e.request).catch(()=>caches.match(e.request).then(r=>r||(e.request.mode==='navigate'?caches.match('./index.html'):Response.error()))))});

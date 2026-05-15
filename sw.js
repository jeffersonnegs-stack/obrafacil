// Service Worker — sem cache, sempre busca da internet
const CACHE_VERSION = '2026-05-14-v9';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => caches.delete(cacheName))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Sempre busca da internet, nunca do cache
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response('Sem conexão com a internet.', { status: 503 });
    })
  );
});

const OFFLINE_CACHE = 'obrafacil-offline-v1';
const OFFLINE_URL = new URL('offline.html', self.registration.scope);
const scope = new URL(self.registration.scope);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(OFFLINE_CACHE);
    await cache.add(new Request(OFFLINE_URL, { cache: 'reload' }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('obrafacil-offline-') && key !== OFFLINE_CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || request.mode !== 'navigate') return;
  const url = new URL(request.url);
  if (url.origin !== scope.origin || (url.pathname !== scope.pathname &&
      url.pathname !== new URL('index.html', scope).pathname)) return;
  event.respondWith(fetch(request).catch(async () => {
    return (await caches.match(OFFLINE_URL, { cacheName: OFFLINE_CACHE })) || Response.error();
  }));
});

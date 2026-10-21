const CACHE_NAME = 'anything-image-cache-v2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key.startsWith('anything-image-cache-') && key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// Cache-First strategy for images: serve instantly from local cache across all reloads
self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.method !== 'GET') return;

  // API URLs often contain image/social hostnames in query parameters.
  const isImageReq = req.destination === 'image';

  if (isImageReq) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) {
          return cached;
        }

        try {
          const fetched = await fetch(req);
          if (fetched && (fetched.status === 200 || fetched.type === 'opaque')) {
            cache.put(req, fetched.clone());
          }
          return fetched;
        } catch {
          return cached || Response.error();
        }
      })
    );
  }
});

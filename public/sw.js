const CACHE_NAME = 'anything-image-cache-v1';

const IMAGE_DOMAINS = [
  'images.unsplash.com',
  's0.wp.com',
  'unavatar.io',
  'pbs.twimg.com',
  'abs.twimg.com',
  'google.com/s2/favicons',
  'github.githubassets.com',
  'opengraph.githubassets.com',
  'redditstatic.com',
  'instagram.com',
  'ytimg.com',
];

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
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
  const url = req.url;

  if (req.method !== 'GET') return;

  const isImageReq =
    req.destination === 'image' ||
    /\.(png|jpg|jpeg|webp|svg|gif|ico|avif)(\?.*)?$/i.test(url) ||
    IMAGE_DOMAINS.some((domain) => url.includes(domain));

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

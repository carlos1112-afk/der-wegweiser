const CACHE_NAME_STATIC = 'der-wegweiser-static-v1';
const CACHE_NAME_TILES = 'der-wegweiser-map-tiles';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icons.svg',
];

// Install Event - Precache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME_STATIC).then((cache) => {
      console.log('[SW] Precaching static app shell');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean up old caches & take control immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME_STATIC && cacheName !== CACHE_NAME_TILES) {
            console.log('[SW] Removing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Helper: Check if request is for map tile (Carto, OpenStreetMap, or tile coordinates)
function isMapTileRequest(url) {
  return (
    url.includes('cartocdn.com') ||
    url.includes('openstreetmap.org') ||
    url.includes('/rastertiles/') ||
    url.includes('/voyager/') ||
    /\/\d+\/\d+\/\d+(\.png|\.jpg|\.jpeg)?$/.test(url)
  );
}

// Fetch Event - Stale-while-revalidate for static, Cache-first with network fallback for tiles
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = request.url;

  // Handle map tile caching specifically
  if (isMapTileRequest(url)) {
    event.respondWith(
      caches.open(CACHE_NAME_TILES).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }

        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          console.warn('[SW] Map tile fetch failed and not cached:', url, error);
          // Return a transparent 1x1 fallback tile or empty response if completely offline
          return new Response('', { status: 504, statusText: 'Offline tile unavailable' });
        }
      })
    );
    return;
  }

  // Handle generic app shell / static assets fetch
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch background update for static files (Stale-while-revalidate)
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && request.method === 'GET') {
            caches.open(CACHE_NAME_STATIC).then((cache) => cache.put(request, networkResponse));
          }
        }).catch(() => {/* ignore network error when offline */});

        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || request.method !== 'GET') {
          return networkResponse;
        }

        // Cache HTTP/HTTPS requests
        if (url.startsWith('http')) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME_STATIC).then((cache) => cache.put(request, responseToCache));
        }

        return networkResponse;
      }).catch(() => {
        // Fallback for HTML navigation when completely offline
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return new Response('Network error occurred', { status: 503, statusText: 'Offline' });
      });
    })
  );
});

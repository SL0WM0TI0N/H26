const CACHE_NAME = 'h26-v1';
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './icon.png'
];

// Install: cache static assets
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(STATIC_ASSETS).catch(() => {
                // Gracefully handle missing assets
            });
        })
    );
});

// Activate: clean up old caches
self.addEventListener('activate', event => {
    self.clients.claim();
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Fetch: Network-first for API, Cache-first for static
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // API calls: network-first with cache fallback
    if (url.hostname === 'api.tfl.gov.uk') {
        event.respondWith(
            fetch(request)
                .then(response => {
                    // Cache successful API responses
                    if (response && response.status === 200) {
                        const cloned = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(request, cloned);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Return cached API response if offline
                    return caches.match(request).then(response => {
                        if (response) return response;
                        // Return offline placeholder
                        return new Response(
                            JSON.stringify([]),
                            { headers: { 'Content-Type': 'application/json' } }
                        );
                    });
                })
        );
    } else {
        // Static assets: cache-first with network fallback
        event.respondWith(
            caches.match(request).then(response => {
                if (response) return response;
                return fetch(request).then(response => {
                    if (response && response.status === 200) {
                        const cloned = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(request, cloned);
                        });
                    }
                    return response;
                }).catch(() => {
                    // Return cached version if available
                    return caches.match(request);
                });
            })
        );
    }
});
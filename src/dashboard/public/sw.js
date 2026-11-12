/*
 * RecruitScout dashboard service worker.
 *
 * - Pages: network first, so a deploy shows up on the next load; the last
 *   good copy of the app shell is served when offline.
 * - Built assets (/assets/*, hashed filenames) and icons: cache first, since
 *   a given URL never changes.
 * - Everything else, including every Supabase / API request (other origins),
 *   goes straight to the network and is never cached: data stays live.
 *
 * Bump VERSION to drop every cached file on the next activation.
 */
const VERSION = 'v1';
const SHELL_CACHE = `rs-shell-${VERSION}`;
const ASSET_CACHE = `rs-assets-${VERSION}`;
const MAX_ASSETS = 80;
const SHELL_URLS = ['/', '/manifest.webmanifest', '/pwa/icon-192.png', '/pwa/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

async function trimAssets() {
  const cache = await caches.open(ASSET_CACHE);
  const keys = await cache.keys();
  // Oldest entries first: drop assets left over from earlier deploys
  for (let i = 0; i < keys.length - MAX_ASSETS; i++) await cache.delete(keys[i]);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // API calls: never intercepted

  // App pages (the dashboard and /blue): network first, cached shell when offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(url.pathname.startsWith('/blue') ? '/blue/' : '/', copy));
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(SHELL_CACHE);
          return (await cache.match(url.pathname.startsWith('/blue') ? '/blue/' : '/')) || (await cache.match('/')) || Response.error();
        })
    );
    return;
  }

  // Hashed build assets and icons: cache first
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/pwa/') || url.pathname.startsWith('/blue/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy)).then(trimAssets);
        }
        return response;
      }))
    );
  }
});

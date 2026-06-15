/* Silas's Piano — service worker.
   Strategy: network-first for everything, fall back to cache when offline.
   -> Online: you always get the freshest push (no stale-cache problem).
   -> Offline: cold-launches from the last copy that was fetched while online.
   Bump CACHE to force-evict all old caches (normally unnecessary; network-first
   already refreshes each asset on every successful online fetch). */
const CACHE = 'silas-cache-v1';
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './icon-152.png', './icon-180.png', './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});

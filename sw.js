/* Service worker: makes the dashboard installable and usable offline. */
const CACHE = 'kpi-dashboard-v2';

// Files of the app itself, saved when the app is installed.
const LOCAL_FILES = [
  './',
  './index.html',
  './styles.css',
  './data.js',
  './i18n.js',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './ejemplos/panaderia-de-barrio.csv',
  './ejemplos/grancola-internacional.csv',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(LOCAL_FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Remove caches left by older versions.
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const sameOrigin = new URL(request.url).origin === self.location.origin;

  if (sameOrigin) {
    // Own files: try the network first so edits show up, fall back to the cache offline.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((hit) => {
          if (hit) return hit;
          // Only page loads fall back to the app shell; other missing files fail normally.
          return request.mode === 'navigate' ? caches.match('./index.html') : Response.error();
        }))
    );
    return;
  }

  // Libraries and fonts from CDNs: use the saved copy if there is one, otherwise download and save it.
  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});

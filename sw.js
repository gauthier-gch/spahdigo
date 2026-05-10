// sw.js — Service Worker for Spahdigo PWA
const CACHE = "spahdigo-v3";
const BASE  = "/spahdigo";
const ASSETS = [
  `${BASE}/`,
  `${BASE}/index.html`,
  `${BASE}/css/style.css`,
  `${BASE}/manifest.json`,
  `${BASE}/js/app.js`,
  `${BASE}/js/auth.js`,
  `${BASE}/js/map.js`,
  `${BASE}/js/rating.js`,
  `${BASE}/js/social.js`,
  `${BASE}/js/analytics.js`,
  `${BASE}/js/firebase-config.js`,
  `${BASE}/js/messages.js`,
  `${BASE}/js/profile.js`,
  `${BASE}/js/bar-details.js`,
];

// Install: pre-cache assets and activate immediately
self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .catch(err => console.warn("[SW] Cache fill failed:", err))
  );
});

// Activate: delete ALL old caches, then take control of all clients
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch: serve from cache when available, fall back to network
self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request)
      .then(cached => cached || fetch(e.request))
  );
});

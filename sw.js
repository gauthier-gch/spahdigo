// sw.js — Service Worker for Spahdigo PWA
const CACHE = "spahdigo-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/css/style.css",
  "/js/app.js",
  "/js/auth.js",
  "/js/map.js",
  "/js/rating.js",
  "/js/social.js",
  "/js/analytics.js",
  "/js/firebase-config.js",
  "/manifest.json"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {})
  );
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

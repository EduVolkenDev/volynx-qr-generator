const CACHE = "volynx-cache-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/app/app.css",
  "/app/app.js",
  "/app/core.js",
  "/custom/overrides.js",
  "/custom/overrides.css",
  "/manifest.webmanifest"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith("/api/")) return; // nunca cache API
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});

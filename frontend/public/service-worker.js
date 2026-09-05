// SolarSafe pro Service Worker - offline shell + API cache
const CACHE_VERSION = "solarsafe-v1";
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon.ico",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GETs
  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin && !url.pathname.startsWith("/api")) return;

  // Skip WebSocket / HMR / analytics
  if (url.pathname.startsWith("/ws") || url.pathname.includes("sockjs")) return;

  // API: network-first with cache fallback
  const isApi = url.pathname.startsWith("/api");
  if (isApi) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(request, clone)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || new Response(JSON.stringify({ offline: true, data: [] }), { headers: { "Content-Type": "application/json" } })))
    );
    return;
  }

  // App shell / static: cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((res) => {
          if (res.ok && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(request, clone)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match("/index.html"));
    })
  );
});

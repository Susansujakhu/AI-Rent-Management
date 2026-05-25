// EasyRent service worker — offline fallback for navigation, cache-first for static assets.
// Bump CACHE name to invalidate old caches on deploy.

const CACHE = "easyrent-v1";
const OFFLINE_URL = "/offline";
const PRECACHE_URLS = [OFFLINE_URL, "/manifest.webmanifest", "/icon-192", "/icon-512"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(PRECACHE_URLS);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/data/") ||
    url.pathname.startsWith("/_next/webpack-hmr")
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cache = await caches.open(CACHE);
          const cached = await cache.match(OFFLINE_URL);
          return cached || new Response("Offline", { status: 503, statusText: "Offline" });
        }
      })()
    );
    return;
  }

  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    /\.(png|jpg|jpeg|svg|ico|webp|css|js|woff2?|ttf)$/i.test(url.pathname) ||
    url.pathname === "/icon-192" ||
    url.pathname === "/icon-512";

  if (isStatic) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const fresh = await fetch(request);
          if (fresh.ok) cache.put(request, fresh.clone());
          return fresh;
        } catch {
          return cached || Response.error();
        }
      })()
    );
  }
});

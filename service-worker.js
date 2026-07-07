/* =========================================================================
   service-worker.js
   Makes the app installable and usable offline. Only works when the app is
   served over HTTPS (or localhost) — browsers refuse to register service
   workers on file:// pages, so this silently has no effect when you're
   just double-clicking index.html locally. That's expected, not a bug.

   Strategy: network-first for everything (app shell AND CDN libraries).
   Whenever there's a connection, you always get the current files straight
   from the server — no stale-cache trap where updates silently stop
   showing up. The cache is purely a fallback for when there's genuinely no
   connection at all.

   Bump CACHE_VERSION whenever the app shell file list changes (e.g. a new
   file is added), so the old cache gets cleaned up.
   ========================================================================= */

const CACHE_VERSION = "kaizen-v5";

const APP_SHELL = [
  "./",
  "./index.html",
  "./login.html",
  "./style.css",
  "./app.js",
  "./storage.js",
  "./settings.js",
  "./register.js",
  "./ai.js",
  "./export.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  // Only intercept simple GET requests. Anything else — most importantly,
  // POST/PUT/DELETE calls to our own /api/ backend or to the Claude API —
  // passes straight through untouched. The Cache API can't store non-GET
  // responses anyway, and there's no reason to get in the way of dynamic
  // API calls that carry a request body.
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Never cache our own /api/ data. It's now shared across every device
  // that opens this site, so it must always come from the network live —
  // serving a stale cached copy here would show one device's out-of-date
  // view of another device's changes.
  if (url.pathname.startsWith("/api/")) return;

  // Network-first for everything else (app shell + CDN libraries): always
  // prefer the live version when online, fall back to cache only if
  // there's genuinely no connection.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

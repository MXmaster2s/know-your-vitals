/* Vitals service worker.
   Contract:
   - NEVER cache Supabase or any non-GET request — health data must not be
     served stale, and auth breaks if cached. The matcher is deliberately
     GENERIC (any "vitals-db.*" host, any *supabase* host, any /auth/ or
     /rest/ path) so a future domain change cannot poison the cache.
     Those requests fall through to the network untouched.
   - Cache-first for same-origin static assets (hashed /_next/static names).
   - Network-first for navigations, offline fallback to the cached shell. */
const VERSION = "v1"; // bump on every deploy that should invalidate
const SHELL_CACHE = `vitals-shell-${VERSION}`;
const SHELL = ["/", "/login", "/reports"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // 1) Supabase or any non-GET: do not intercept, never cache.
  if (
    event.request.method !== "GET" ||
    url.hostname.startsWith("vitals-db.") ||
    url.hostname.includes("supabase") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/rest/")
  ) {
    return;
  }

  // 2) Navigations: network-first, offline fallback to cached shell.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(event.request, copy));
          return res;
        })
        .catch(() =>
          caches.match(event.request).then((r) => r || caches.match("/"))
        )
    );
    return;
  }

  // 3) Same-origin static assets: cache-first.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((res) => {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(event.request, copy));
            return res;
          })
      )
    );
  }
});

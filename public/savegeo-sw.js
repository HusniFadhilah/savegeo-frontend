const CACHE_NAME = "savegeo-app-shell-v1";
const SHELL_URL = new URL("/", self.location.origin).href;
const FALLBACK_URL = new URL("/index.html", self.location.origin).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.add(SHELL_URL))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("savegeo-app-shell-") && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/cesium/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) await caches.open(CACHE_NAME).then((cache) => cache.put(FALLBACK_URL, response.clone()));
          return response;
        })
        .catch(async () => (await caches.match(FALLBACK_URL)) || (await caches.match(SHELL_URL)) || Response.error()),
    );
    return;
  }

  const isAppAsset = ["script", "style", "font", "image", "worker"].includes(request.destination)
    || url.pathname.startsWith("/assets/");
  if (!isAppAsset) return;

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then(async (response) => {
      const contentLength = Number(response.headers.get("content-length") || 0);
      if (response.ok && (!contentLength || contentLength <= 5 * 1024 * 1024)) {
        await caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
      }
      return response;
    })),
  );
});

const cachePrefix = "fxclient-";
const cacheName = cachePrefix + "1788536800086"; // timestamp gets replaced by the build script
const cachePromise = caches.open(cacheName);

self.addEventListener("message", (e) => {
  if (e.data?.update) self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const request = e.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    e.respondWith(
      fetch(request).then(async (response) => {
        if (response.ok) await (await cachePromise).put(request, response.clone());
        return response;
      }).catch(async () => (await cachePromise).match(request))
    );
    return;
  }
  e.respondWith(
    (async () => {
      const cache = await cachePromise;
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok && response.type === "basic") await cache.put(request, response.clone());
      return response;
    })()
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    Promise.all([
      caches.keys().then((keys) => Promise.all(
        keys.filter((key) => key.startsWith(cachePrefix) && key !== cacheName)
          .map((key) => caches.delete(key))
      )),
      self.clients.claim()
    ])
  );
});

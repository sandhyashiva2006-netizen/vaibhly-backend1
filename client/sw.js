self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // ✅ Always bypass API calls
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  event.respondWith(fetch(event.request));
});

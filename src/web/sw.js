// Service worker for the prototype: keeps the app shell available offline.
// Network first, so a new deploy shows up on the next load; the cache is only the offline fallback.
// Requests to /api/ are never touched or cached.
// Bump CACHE whenever SHELL changes, or installed apps keep the old list.
const CACHE = 'mj-shell-v4';
const FONT_HOSTS = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];
const SHELL = ['./', 'index.html', 'styles.css', 'flow5.css', 'app.js', 'full.js', 'flow5.js', 'live.js', 'manifest.webmanifest', 'assets/png/icon-192.png', 'assets/png/icon-512.png', 'assets/png/icon-180.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Google Fonts: cache first, so the app keeps its fonts offline. Font files never change at a given URL.
  // The stylesheet comes back opaque (status 0), so it's cached without the res.ok check.
  if (e.request.method === 'GET' && FONT_HOSTS.includes(url.origin)) {
    e.respondWith(
      caches.match(e.request).then(
        (hit) =>
          hit ||
          fetch(e.request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
            return res;
          }),
      ),
    );
    return;
  }
  if (e.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error()))),
  );
});

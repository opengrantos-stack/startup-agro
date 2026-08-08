self.addEventListener('install', (e) => {
  e.waitUntil(caches.open('agro-store').then((cache) => cache.addAll(['./', './index.html', './logo.png'])));
});
self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then((response) => response || fetch(e.request)));
});

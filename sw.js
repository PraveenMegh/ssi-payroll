self.addEventListener('install', e => {
  e.waitUntil(
    caches.open('ssi-v1').then(c => c.addAll([
      '/', '/index.html', '/js/app.js', '/js/auth.js'
      // add all your JS files here
    ]))
  );
});
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});

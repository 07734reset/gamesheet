// Offline support: the app itself is cached on install; the photo reader is cached the first time it is used.
const VERSION = 'gamesheet-v5';
const OCR = ['vendor/pdfjs/pdf.min.js', 'vendor/pdfjs/pdf.worker.min.js'];
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'data.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
  // The PDF reader (~1.5 MB): fetch it in the background so Gameday sheets can be read offline later.
  caches.open(VERSION).then(c => c.addAll(OCR)).catch(() => {});
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== VERSION + '-ocr').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // App files: network first so updates arrive, cache when offline.
    e.respondWith(fetch(req, { cache: 'no-cache' }).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
  }
});

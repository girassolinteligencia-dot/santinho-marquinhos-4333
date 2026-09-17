const CACHE_NAME = 'minha-colinha-v15';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './marquinhos_hero.webp',
  './marquinhos_hero.png',
  './marquinhos_boneco.png',
  './marquinhos_logo_oficial.png',
  './marquinhos_foto_hd.jpg',
  './marquinhos_painel_verde.jpg',
  './og-image.jpg',
  './urna_dispenser_crop.png',
  './favicon.svg',
  './favicon.ico',
  './favicon.png',
  './apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './data/candidatos.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => {
      return res || fetch(e.request).then((fetchRes) => {
        // Cache dinâmico de fotos webp
        if (e.request.url.includes('/fotos_tse/')) {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, fetchRes.clone());
            return fetchRes;
          });
        }
        return fetchRes;
      });
    }).catch(() => caches.match('./index.html'))
  );
});

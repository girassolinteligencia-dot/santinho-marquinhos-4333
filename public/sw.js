/**
 * MINHA COLINHA 2026 — Service Worker Resiliente de Alta Performance
 * Estratégia Híbrida: Network-First para navegação (evita necessidade de F5 no Cloudflare)
 * e Cache-First para assets estáticos e fotos.
 */

const CACHE_NAME = 'minha-colinha-v45';

// Pré-cache vital enxuto: apenas o núcleo da aplicação (instalação imediata sem travar)
const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './favicon.svg',
  './favicon.png',
  './favicon.ico',
  './apple-touch-icon.png',
  './base_fundo_santinho_916.webp',
  './welcome_marquinhos_hero.webp',
  './welcome_marquinhos_hero.png',
  './marquinhos_logo_oficial.webp',
  './marquinhos_logo_oficial.png',
  './marquinhos_sem_fundo.webp',
  './marquinhos_sem_fundo.png',
  './urna_dispenser_crop.png',
  './data/candidatos.json'
];

// Instalação do Service Worker com cache tolerante a falhas (não engasga a primeira visita)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Adiciona arquivos individualmente para que uma falha isolada não trave a ativação
      await Promise.allSettled(
        CORE_ASSETS.map((url) =>
          fetch(url, { cache: 'no-cache' })
            .then((res) => {
              if (res.ok) return cache.put(url, res);
            })
            .catch(() => {})
        )
      );
    })
  );
  self.skipWaiting();
});

// Ativação e limpeza de versões legadas de cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) {
            return caches.delete(k);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Estratégia inteligente de Fetch
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Apenas métodos GET são interceptados
  if (request.method !== 'GET') return;

  // Ignora extensões de navegador ou esquemas não-http
  if (!url.protocol.startsWith('http')) return;

  // 1. NAVEGAÇÃO HTML (index.html / root): NETWORK-FIRST
  // Garante que o usuário sempre veja a versão mais atual de primeira, sem precisar de F5
  if (request.mode === 'navigate' || request.destination === 'document' || url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(
      fetch(request)
        .then((networkRes) => {
          if (networkRes && networkRes.ok) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, resClone));
          }
          return networkRes;
        })
        .catch(async () => {
          // Fallback offline se a rede falhar
          const cachedRes = await caches.match(request);
          if (cachedRes) return cachedRes;
          return caches.match('./index.html');
        })
    );
    return;
  }

  // 2. FOTOS TSE E ASSETS DE MÍDIA: CACHE-FIRST com runtime caching
  if (url.pathname.includes('/fotos_tse/') || url.pathname.match(/\.(png|jpg|jpeg|webp|svg|ico)$/i)) {
    event.respondWith(
      caches.match(request).then((cachedRes) => {
        if (cachedRes) return cachedRes;
        return fetch(request).then((networkRes) => {
          if (networkRes && networkRes.ok) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, resClone));
          }
          return networkRes;
        }).catch(() => null);
      })
    );
    return;
  }

  // 3. DEMAIS ASSETS (CSS, JS, JSON): STALE-WHILE-REVALIDATE
  event.respondWith(
    caches.match(request).then((cachedRes) => {
      const fetchPromise = fetch(request)
        .then((networkRes) => {
          if (networkRes && networkRes.ok) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, resClone));
          }
          return networkRes;
        })
        .catch(() => cachedRes);

      return cachedRes || fetchPromise;
    })
  );
});

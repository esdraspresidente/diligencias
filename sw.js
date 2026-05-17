// Service Worker minimalista — não intercepta requisições externas
const CACHE = 'diligencias-v2';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Não intercepta nada — deixa todas as requisições passarem normalmente
self.addEventListener('fetch', e => {
  // Só serve cache para arquivos locais do app
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // ignora requisições externas
  if (e.request.method !== 'GET') return;
  // Para arquivos locais, tenta rede primeiro
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

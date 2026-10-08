const CACHE = 'diligencias-v11';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

self.addEventListener('push', e => {
  if (!e.data) return;
  const data = e.data.json();
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/diligencias/icon-192.png',
      badge: '/diligencias/icon-192.png',
      vibrate: [200, 100, 200],
      data: { url: data.url || '/diligencias/' }
    })
  );
});

// O aviso de tarefa manda url '/diligencias/#tarefas'. Com o app já aberto,
// navega a janela até lá em vez de só focar: senão a Naiarha toca no aviso
// e cai no Dashboard, procurando a tarefa.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const destino = (e.notification.data && e.notification.data.url) || '/diligencias/';
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      for (const client of list) {
        if (client.url.includes('diligencias') && 'focus' in client) {
          if (destino.includes('#') && 'navigate' in client) client.navigate(destino);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(destino);
    })
  );
});

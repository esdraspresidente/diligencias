const CACHE = 'diligencias-v3';

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

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      for (const client of list) {
        if (client.url.includes('diligencias') && 'focus' in client)
          return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/diligencias/');
    })
  );
});

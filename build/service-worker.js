self.addEventListener('install', (event) => {
  console.log('📦 Service Worker installing.');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker activating.');
});

self.addEventListener('push', (event) => {
  const data = event.data.json();
  const title = data.title || 'New Notification';
  const options = {
    body: data.body || '',
    icon: '/logo192.png',
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        const client = clientList[0];
        return client.focus();
      }
      return clients.openWindow('/');
    })
  );
});

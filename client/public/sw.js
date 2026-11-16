// Self-Hosted Service Worker for FloodSense Native Web Push Notifications

self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Flood Alert Warning', body: event.data.text() };
    }
  }

  const title = data.title || '🚨 Critical Flood Evacuation Alert';
  const options = {
    body: data.body || 'Water level has crossed the danger mark. Evacuate low-lying areas immediately!',
    icon: data.icon || '/favicon.svg',
    badge: data.badge || '/favicon.svg',
    tag: data.tag || 'flood-alert-urgent',
    vibrate: [200, 100, 200, 100, 400],
    requireInteraction: true,
    data: data.data || { url: '/' },
    actions: [
      { action: 'view', title: 'Open Incident Map' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});


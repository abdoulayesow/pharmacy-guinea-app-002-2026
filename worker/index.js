/**
 * Custom Service Worker Extensions for Seri App
 *
 * This file is automatically injected into the generated service worker by next-pwa.
 * It adds push notification handling and notification click handling.
 */

// Handle push notifications from server (future use)
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.log('Push event without data');
    return;
  }

  try {
    const data = event.data.json();

    const options = {
      body: data.body || '',
      icon: data.icon || '/icons/icon-192x192.svg',
      badge: data.badge || '/icons/icon-192x192.svg',
      tag: data.tag || 'seri-notification',
      renotify: data.renotify !== false,
      requireInteraction: data.requireInteraction || false,
      data: data.data || {},
      vibrate: data.vibrate || [200, 100, 200],
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Seri', options)
    );
  } catch (error) {
    console.error('Error handling push notification:', error);
  }
});

// Handle notification clicks - navigate to appropriate page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Get URL from notification data, default to stocks page with expiring filter
  const urlPath = event.notification.data?.url || '/stocks?filter=expiring';
  const fullUrl = new URL(urlPath, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        // If we have an existing window, focus it and navigate
        if ('focus' in client && 'navigate' in client) {
          return client.focus().then(() => {
            return client.navigate(fullUrl);
          });
        }
      }

      // No existing window, open a new one
      if (clients.openWindow) {
        return clients.openWindow(fullUrl);
      }
    })
  );
});

// Handle notification close (for analytics, if needed)
self.addEventListener('notificationclose', (event) => {
  // Could send analytics about dismissed notifications
  console.log('Notification closed:', event.notification.tag);
});

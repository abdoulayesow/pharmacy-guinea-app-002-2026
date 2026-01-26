/**
 * Push Notification Service for Expiration Alerts
 *
 * Provides local push notifications for expiring product batches.
 * Works offline using IndexedDB data.
 */

import { db } from './db';
import {
  getAlertBatchesWithProducts,
  getDaysUntilExpiration,
  type BatchWithProduct,
} from './expiration';
import { useNotificationStore } from '@/stores/notification';

// Notification tag to group/replace notifications
const EXPIRATION_NOTIFICATION_TAG = 'seri-expiration-alert';

/**
 * Check for expiring batches and show notification if appropriate
 * Called after each sync cycle
 */
export async function checkExpirationAndNotify(): Promise<void> {
  const store = useNotificationStore.getState();

  // Check if we can/should notify
  if (!store.canNotify()) {
    return;
  }

  try {
    // Get unnotified expiring batches
    const batches = await getUnnotifiedExpiringBatches();

    if (batches.length === 0) {
      return;
    }

    // Show notification
    await showExpirationNotification(batches);

    // Update store
    const batchIds = batches.map(b => b.id).filter((id): id is string => !!id);
    store.markBatchesNotified(batchIds);
    store.updateLastNotificationTime();
  } catch (error) {
    console.error('Error checking expiration notifications:', error);
  }
}

/**
 * Get expiring batches that haven't been notified yet
 */
export async function getUnnotifiedExpiringBatches(): Promise<BatchWithProduct[]> {
  const store = useNotificationStore.getState();
  const { notifiedBatchIds } = store;

  // Get all batches and products from IndexedDB
  const [batches, products] = await Promise.all([
    db.product_batches.toArray(),
    db.products.toArray(),
  ]);

  // Get alert batches with product info
  const alertBatches = getAlertBatchesWithProducts(batches, products);

  // Filter out already notified batches
  const notifiedSet = new Set(notifiedBatchIds);
  const unnotifiedBatches = alertBatches.filter(
    batch => batch.id && !notifiedSet.has(batch.id)
  );

  return unnotifiedBatches;
}

/**
 * Show expiration notification using Service Worker
 */
export async function showExpirationNotification(
  batches: BatchWithProduct[]
): Promise<void> {
  // Check if service worker and notifications are supported
  if (!('serviceWorker' in navigator) || !('Notification' in window)) {
    console.warn('Service Worker or Notifications not supported');
    return;
  }

  // Check permission
  if (Notification.permission !== 'granted') {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    // Build notification content
    const { title, body, data } = buildNotificationContent(batches);

    // Show notification via service worker
    // Note: Some options like renotify and vibrate may not be in TypeScript types
    // but are supported by browsers
    await registration.showNotification(title, {
      body,
      icon: '/icons/icon-192x192.svg',
      badge: '/icons/icon-192x192.svg',
      tag: EXPIRATION_NOTIFICATION_TAG,
      requireInteraction: false,
      data,
    } as NotificationOptions);
  } catch (error) {
    console.error('Error showing notification:', error);
  }
}

/**
 * Build notification title and body based on batch count and severity
 */
function buildNotificationContent(batches: BatchWithProduct[]): {
  title: string;
  body: string;
  data: { url: string; batchIds: string[] };
} {
  const expired = batches.filter(b => getDaysUntilExpiration(b.expiration_date) < 0);
  const critical = batches.filter(b => {
    const days = getDaysUntilExpiration(b.expiration_date);
    return days >= 0 && days < 30;
  });

  const batchIds = batches.map(b => b.id).filter((id): id is string => !!id);

  // Expired products take priority
  if (expired.length > 0) {
    if (expired.length === 1) {
      const batch = expired[0];
      const days = Math.abs(getDaysUntilExpiration(batch.expiration_date));
      return {
        title: 'Produit perime',
        body: `${batch.productName} est perime depuis ${days} jour${days > 1 ? 's' : ''}`,
        data: { url: '/stocks?filter=expiring', batchIds },
      };
    } else {
      const names = expired.slice(0, 2).map(b => b.productName);
      const remaining = expired.length - 2;
      const bodyNames = remaining > 0
        ? `${names.join(', ')} et ${remaining} autre${remaining > 1 ? 's' : ''}`
        : names.join(' et ');
      return {
        title: `${expired.length} produits perimes`,
        body: bodyNames,
        data: { url: '/stocks?filter=expiring', batchIds },
      };
    }
  }

  // Critical products (< 30 days)
  if (critical.length > 0) {
    if (critical.length === 1) {
      const batch = critical[0];
      const days = getDaysUntilExpiration(batch.expiration_date);
      return {
        title: 'Produit expirant',
        body: `${batch.productName} expire dans ${days} jour${days > 1 ? 's' : ''}`,
        data: { url: '/stocks?filter=expiring', batchIds },
      };
    } else {
      const names = critical.slice(0, 2).map(b => b.productName);
      const remaining = critical.length - 2;
      const bodyNames = remaining > 0
        ? `${names.join(', ')} et ${remaining} autre${remaining > 1 ? 's' : ''}`
        : names.join(' et ');
      return {
        title: `${critical.length} produits expirent bientot`,
        body: bodyNames,
        data: { url: '/stocks?filter=expiring', batchIds },
      };
    }
  }

  // Warning products (30-60 days)
  const count = batches.length;
  if (count === 1) {
    const batch = batches[0];
    const days = getDaysUntilExpiration(batch.expiration_date);
    return {
      title: 'Alerte expiration',
      body: `${batch.productName} expire dans ${days} jours`,
      data: { url: '/stocks?filter=expiring', batchIds },
    };
  }

  const names = batches.slice(0, 2).map(b => b.productName);
  const remaining = count - 2;
  const bodyNames = remaining > 0
    ? `${names.join(', ')} et ${remaining} autre${remaining > 1 ? 's' : ''}`
    : names.join(' et ');

  return {
    title: `${count} produits a surveiller`,
    body: bodyNames,
    data: { url: '/stocks?filter=expiring', batchIds },
  };
}

/**
 * Test notification (for development/debugging)
 */
export async function testExpirationNotification(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) {
    console.warn('Service Worker or Notifications not supported');
    return;
  }

  if (Notification.permission !== 'granted') {
    console.warn('Notification permission not granted');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification('Test - Produit expirant', {
      body: 'Paracetamol 500mg expire dans 5 jours',
      icon: '/icons/icon-192x192.svg',
      badge: '/icons/icon-192x192.svg',
      tag: 'seri-test-notification',
      data: { url: '/stocks?filter=expiring', batchIds: [] },
    });
  } catch (error) {
    console.error('Error showing test notification:', error);
  }
}

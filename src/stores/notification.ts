'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Throttle: 12 hours between notifications for same items
export const NOTIFICATION_THROTTLE_MS = 12 * 60 * 60 * 1000;

// Default thresholds (days)
export const EXPIRATION_ALERT_THRESHOLDS = {
  CRITICAL: 30,
  WARNING: 60,
};

export type NotificationPermissionStatus = 'default' | 'granted' | 'denied' | 'unsupported';

interface NotificationState {
  // Permission state
  permissionStatus: NotificationPermissionStatus;

  // User preferences
  expirationAlertsEnabled: boolean;

  // Throttling
  lastNotificationAt: string | null; // ISO timestamp
  notifiedBatchIds: string[]; // Track which batches we've notified about

  // Actions
  checkPermission: () => void;
  requestPermission: () => Promise<boolean>;
  setExpirationAlertsEnabled: (enabled: boolean) => void;
  markBatchesNotified: (batchIds: string[]) => void;
  clearNotifiedBatches: () => void;
  updateLastNotificationTime: () => void;
  canNotify: () => boolean;
}

function checkNotificationSupport(): NotificationPermissionStatus {
  if (typeof window === 'undefined') return 'unsupported';
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission as NotificationPermissionStatus;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      permissionStatus: 'default',
      expirationAlertsEnabled: false,
      lastNotificationAt: null,
      notifiedBatchIds: [],

      checkPermission: () => {
        const status = checkNotificationSupport();
        set({ permissionStatus: status });
      },

      requestPermission: async () => {
        if (typeof window === 'undefined' || !('Notification' in window)) {
          set({ permissionStatus: 'unsupported' });
          return false;
        }

        try {
          const permission = await Notification.requestPermission();
          const status = permission as NotificationPermissionStatus;
          set({
            permissionStatus: status,
            expirationAlertsEnabled: status === 'granted',
          });
          return status === 'granted';
        } catch (error) {
          console.error('Error requesting notification permission:', error);
          set({ permissionStatus: 'denied' });
          return false;
        }
      },

      setExpirationAlertsEnabled: (enabled: boolean) => {
        const { permissionStatus } = get();
        // Only enable if permission is granted
        if (enabled && permissionStatus !== 'granted') {
          return;
        }
        set({ expirationAlertsEnabled: enabled });
      },

      markBatchesNotified: (batchIds: string[]) => {
        const { notifiedBatchIds } = get();
        const newIds = [...new Set([...notifiedBatchIds, ...batchIds])];
        // Keep only last 100 IDs to prevent unbounded growth
        const trimmedIds = newIds.slice(-100);
        set({ notifiedBatchIds: trimmedIds });
      },

      clearNotifiedBatches: () => {
        set({ notifiedBatchIds: [] });
      },

      updateLastNotificationTime: () => {
        set({ lastNotificationAt: new Date().toISOString() });
      },

      canNotify: () => {
        const { permissionStatus, expirationAlertsEnabled, lastNotificationAt } = get();

        // Check if notifications are enabled and permitted
        if (permissionStatus !== 'granted' || !expirationAlertsEnabled) {
          return false;
        }

        // Check throttle
        if (lastNotificationAt) {
          const lastTime = new Date(lastNotificationAt).getTime();
          const now = Date.now();
          if (now - lastTime < NOTIFICATION_THROTTLE_MS) {
            return false;
          }
        }

        return true;
      },
    }),
    {
      name: 'seri-notification-prefs',
      partialize: (state) => ({
        expirationAlertsEnabled: state.expirationAlertsEnabled,
        lastNotificationAt: state.lastNotificationAt,
        notifiedBatchIds: state.notifiedBatchIds,
      }),
    }
  )
);

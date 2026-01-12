/**
 * Zustand store for sync state management
 * Tracks offline sync queue status and provides sync operations
 */

import { create } from 'zustand';
import {
  processSyncQueue,
  getPendingCount,
  setupBackgroundSync,
  getSyncStats,
} from '@/lib/client/sync';

export interface SyncState {
  // Status
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: string | null;
  lastError: string | null;

  // Statistics
  syncedCount: number;
  failedCount: number;

  // Actions
  checkOnlineStatus: () => void;
  manualSync: () => Promise<void>;
  updatePendingCount: () => Promise<void>;
  clearError: () => void;
  initializeSync: () => void;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  // Initial state
  isOnline: typeof window !== 'undefined' ? navigator.onLine : true,
  isSyncing: false,
  pendingCount: 0,
  lastSyncTime: null,
  lastError: null,
  syncedCount: 0,
  failedCount: 0,

  // Check online/offline status
  checkOnlineStatus: () => {
    if (typeof window === 'undefined') return;

    set({ isOnline: navigator.onLine });

    // If coming online, try to sync
    if (navigator.onLine && get().pendingCount > 0) {
      get().manualSync();
    }
  },

  // Manually trigger sync
  manualSync: async () => {
    const state = get();
    if (state.isSyncing || !state.isOnline) return;

    set({ isSyncing: true, lastError: null });

    try {
      const result = await processSyncQueue();

      set({
        isSyncing: false,
        lastSyncTime: new Date().toISOString(),
        syncedCount: result.synced,
        failedCount: result.failed,
        lastError: result.errors.length > 0 ? result.errors[0] : null,
      });

      // Update pending count
      await get().updatePendingCount();
    } catch (error) {
      set({
        isSyncing: false,
        lastError: error instanceof Error ? error.message : 'Sync failed',
      });
    }
  },

  // Update pending count
  updatePendingCount: async () => {
    const count = await getPendingCount();
    set({ pendingCount: count });
  },

  // Clear error message
  clearError: () => {
    set({ lastError: null });
  },

  // Initialize sync system on app startup
  initializeSync: () => {
    if (typeof window === 'undefined') return;

    // Set up online/offline listeners
    window.addEventListener('online', () => {
      set({ isOnline: true });
      get().manualSync();
    });

    window.addEventListener('offline', () => {
      set({ isOnline: false });
    });

    // Set up background sync
    setupBackgroundSync();

    // Initial sync if online
    if (navigator.onLine) {
      get().updatePendingCount().then(() => {
        if (get().pendingCount > 0) {
          get().manualSync();
        }
      });
    } else {
      get().updatePendingCount();
    }
  },
}));

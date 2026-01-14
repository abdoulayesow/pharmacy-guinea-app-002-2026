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
  pullFromServer,
  performInitialSync,
} from '@/lib/client/sync';

export interface SyncState {
  // Status
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: string | null;
  lastPullTime: string | null;
  lastError: string | null;

  // Statistics
  syncedCount: number;
  failedCount: number;
  pulledCount: number;

  // Actions
  checkOnlineStatus: () => void;
  manualSync: () => Promise<void>;
  pullSync: () => Promise<void>;
  fullSync: () => Promise<void>; // Push + Pull
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
  lastPullTime: null,
  lastError: null,
  syncedCount: 0,
  failedCount: 0,
  pulledCount: 0,

  // Check online/offline status
  checkOnlineStatus: () => {
    if (typeof window === 'undefined') return;

    set({ isOnline: navigator.onLine });

    // If coming online, try to sync
    if (navigator.onLine && get().pendingCount > 0) {
      get().manualSync();
    }
  },

  // Manually trigger push sync
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

  // Pull changes from server
  pullSync: async () => {
    const state = get();
    if (state.isSyncing || !state.isOnline) return;

    set({ isSyncing: true, lastError: null });

    try {
      const result = await pullFromServer();

      set({
        isSyncing: false,
        lastPullTime: result.serverTime ? result.serverTime.toISOString() : new Date().toISOString(),
        pulledCount: result.pulled,
        lastError: result.errors.length > 0 ? result.errors[0] : null,
      });
    } catch (error) {
      set({
        isSyncing: false,
        lastError: error instanceof Error ? error.message : 'Pull sync failed',
      });
    }
  },

  // Full sync: push + pull
  fullSync: async () => {
    const state = get();
    if (state.isSyncing || !state.isOnline) return;

    set({ isSyncing: true, lastError: null });

    try {
      // Push first
      const pushResult = await processSyncQueue();
      
      // Then pull
      const pullResult = await pullFromServer();

      set({
        isSyncing: false,
        lastSyncTime: new Date().toISOString(),
        lastPullTime: pullResult.serverTime ? pullResult.serverTime.toISOString() : new Date().toISOString(),
        syncedCount: pushResult.synced,
        failedCount: pushResult.failed,
        pulledCount: pullResult.pulled,
        lastError: pushResult.errors.length > 0 || pullResult.errors.length > 0
          ? pushResult.errors[0] || pullResult.errors[0]
          : null,
      });

      // Update pending count
      await get().updatePendingCount();
    } catch (error) {
      set({
        isSyncing: false,
        lastError: error instanceof Error ? error.message : 'Full sync failed',
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
      get().pullSync();
    });

    window.addEventListener('offline', () => {
      set({ isOnline: false });
    });

    // Set up background sync
    setupBackgroundSync();

    // Check if initial sync is needed (no lastSyncAt)
    const lastSyncAt = localStorage.getItem('seri-last-sync');
    const needsInitialSync = !lastSyncAt;

    // Initial sync if online
    if (navigator.onLine) {
      if (needsInitialSync) {
        // Perform initial sync (pull all data)
        performInitialSync().then((result) => {
          if (result.success) {
            set({ pulledCount: result.pulled });
          }
        });
      }
      
      get().updatePendingCount().then(() => {
        if (get().pendingCount > 0) {
          get().manualSync();
        }
      });
      
      // Also pull changes
      get().pullSync();
    } else {
      get().updatePendingCount();
    }
  },
}));

'use client';

import { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useSyncStore } from '@/stores/sync';

export function useSyncStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const initialized = useRef(false);
  const { initializeSync, manualSync } = useSyncStore();

  const pendingCount =
    useLiveQuery(() =>
      db.sync_queue.where('status').anyOf(['PENDING', 'FAILED']).count()
    ) ?? 0;

  useEffect(() => {
    // Check initial online status
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);

    const handleOnline = () => {
      setIsOnline(true);
      // Trigger sync when coming back online
      manualSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initialize sync system once
    if (!initialized.current) {
      initialized.current = true;
      initializeSync();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [initializeSync, manualSync]);

  return {
    isOnline,
    pendingCount,
    isSynced: pendingCount === 0,
    manualSync, // Expose for manual sync trigger
  };
}

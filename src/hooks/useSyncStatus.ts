'use client';

import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';

export function useSyncStatus() {
  const [isOnline, setIsOnline] = useState(true);

  const pendingCount =
    useLiveQuery(() =>
      db.sync_queue.where('status').anyOf(['PENDING', 'FAILED']).count()
    ) ?? 0;

  useEffect(() => {
    // Check initial online status
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isOnline,
    pendingCount,
    isSynced: pendingCount === 0,
  };
}

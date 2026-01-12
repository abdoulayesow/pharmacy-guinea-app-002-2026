'use client';

import { useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useSyncStore } from '@/stores/sync';

export function SyncStatusIndicator() {
  const {
    isOnline,
    isSyncing,
    pendingCount,
    lastError,
    lastSyncTime,
    checkOnlineStatus,
    manualSync,
    clearError,
    initializeSync,
  } = useSyncStore();

  // Initialize sync on mount
  useEffect(() => {
    initializeSync();

    // Check online status periodically
    const interval = setInterval(checkOnlineStatus, 2000);
    return () => clearInterval(interval);
  }, [initializeSync, checkOnlineStatus]);

  // Show nothing if online and no pending items
  if (isOnline && pendingCount === 0 && !lastError && !isSyncing) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
          Synchronisé
        </span>
      </div>
    );
  }

  // Offline indicator
  if (!isOnline) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-500/10 border border-slate-500/30">
        <Wifi className="w-4 h-4 text-slate-500" />
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
          Hors ligne
        </span>
        {pendingCount > 0 && (
          <span className="ml-1 text-xs font-semibold bg-slate-600 text-white rounded-full px-2 py-0.5">
            {pendingCount}
          </span>
        )}
      </div>
    );
  }

  // Syncing indicator
  if (isSyncing) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30">
        <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
        <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
          Synchronisation...
        </span>
      </div>
    );
  }

  // Pending items indicator
  if (pendingCount > 0) {
    return (
      <div
        onClick={() => manualSync()}
        className="flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 cursor-pointer hover:bg-amber-500/20 transition-colors"
      >
        <Wifi className="w-4 h-4 text-amber-500" />
        <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
          {pendingCount} en attente
        </span>
      </div>
    );
  }

  // Error indicator
  if (lastError) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-red-500/10 border border-red-500/30">
        <AlertCircle className="w-4 h-4 text-red-500 cursor-pointer" onClick={clearError} />
        <span
          className="text-xs font-medium text-red-600 dark:text-red-400 cursor-pointer"
          onClick={clearError}
          title={lastError}
        >
          Erreur sync
        </span>
      </div>
    );
  }

  return null;
}

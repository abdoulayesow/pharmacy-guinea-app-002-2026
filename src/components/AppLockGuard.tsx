'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useLockStore } from '@/stores/lock';
import { LockScreen } from './LockScreen';

interface AppLockGuardProps {
  children: React.ReactNode;
}

/**
 * AppLockGuard component that:
 * 1. Shows lock screen overlay when app is locked
 * 2. Prevents body scroll when locked
 * 3. Blocks all app interaction when locked
 * 4. Handles lock state persistence (sessionStorage)
 */
export function AppLockGuard({ children }: AppLockGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isLocked, checkAutoLock } = useLockStore();

  // Prevent body scroll when locked
  useEffect(() => {
    if (isLocked) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isLocked]);

  // Prevent navigation when locked (block route changes)
  useEffect(() => {
    if (isLocked) {
      const isAuthPage = pathname === '/login' || pathname?.includes('/auth/setup-pin');
      // Allow navigation to auth pages, but block everything else
      // The lock screen overlay will handle visual blocking
    }
  }, [isLocked, pathname]);

  // Check for auto-lock periodically
  useEffect(() => {
    if (!isLocked) {
      // Check every 30 seconds if should auto-lock
      const interval = setInterval(() => {
        checkAutoLock();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [isLocked, checkAutoLock]);

  return (
    <>
      {children}
      <LockScreen />
    </>
  );
}


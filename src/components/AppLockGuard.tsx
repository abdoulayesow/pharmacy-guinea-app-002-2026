'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useLockStore } from '@/stores/lock';
import { useAuthStore } from '@/stores/auth';
import { LockScreen } from './LockScreen';

interface AppLockGuardProps {
  children: React.ReactNode;
}

/**
 * AppLockGuard component that:
 * 1. Shows lock screen overlay when manually locked
 * 2. Redirects to login page when locked due to inactivity (for PIN re-entry)
 * 3. Prevents body scroll when locked
 * 4. Blocks all app interaction when locked
 *
 * Note: This is the ONLY place where inactivity redirects happen.
 * AuthGuard handles auth state, AppLockGuard handles lock/inactivity.
 */
export function AppLockGuard({ children }: AppLockGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status: sessionStatus } = useSession();
  const { isLocked, lockReason, unlock } = useLockStore();
  const { logout, updateActivity } = useAuthStore();

  // Prevent duplicate redirects
  const hasRedirectedRef = useRef(false);

  // Check if we're on an auth page
  const isAuthPage = pathname === '/login' || pathname?.startsWith('/auth/');

  // Reset redirect ref when pathname changes
  useEffect(() => {
    hasRedirectedRef.current = false;
  }, [pathname]);

  // Handle inactivity lock - redirect to login page instead of showing overlay
  const handleInactivityLock = useCallback(() => {
    if (hasRedirectedRef.current) return;
    if (!isAuthPage && sessionStatus === 'authenticated' && session?.user) {
      hasRedirectedRef.current = true;
      // Clear the lock state (we're redirecting instead)
      unlock();
      // Logout from auth store to clear auth state
      logout();
      // Redirect to login page - the login page will show PIN-only mode
      // because there's still a Google session but auth store is logged out
      router.push(`/login?callbackUrl=${encodeURIComponent(pathname || '/dashboard')}`);
    }
  }, [isAuthPage, sessionStatus, session, unlock, logout, router, pathname]);

  // When locked due to inactivity, redirect to login page
  useEffect(() => {
    if (isLocked && lockReason === 'inactivity') {
      handleInactivityLock();
    }
  }, [isLocked, lockReason, handleInactivityLock]);

  // Prevent body scroll when manually locked
  useEffect(() => {
    // Only prevent scroll for manual lock (not inactivity, which redirects)
    if (isLocked && lockReason === 'manual') {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isLocked, lockReason]);

  // Only show LockScreen for manual lock, not inactivity
  const showLockScreen = isLocked && lockReason === 'manual';

  return (
    <>
      {children}
      {showLockScreen && <LockScreen />}
    </>
  );
}


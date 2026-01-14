'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { Logo } from './Logo';
import { UserAvatar } from './UserAvatar';
import { NotificationBadge } from './NotificationBadge';
import { useAuthStore } from '@/stores/auth';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { cn } from '@/lib/utils';

export function Header() {
  const router = useRouter();
  const { data: session } = useSession();
  const { currentUser, logout } = useAuthStore();
  const { isOnline, pendingCount } = useSyncStatus();

  // Get user info from OAuth session or Zustand store
  const userName = session?.user?.name || currentUser?.name;
  const userImage = session?.user?.image || currentUser?.image;

  const handleLogout = async () => {
    // Clear Zustand auth state
    logout();
    // Clear localStorage JWT token
    if (typeof window !== 'undefined') {
      localStorage.removeItem('seri-jwt-token');
    }
    // Sign out from Auth.js session if exists
    if (session) {
      await signOut({ redirect: false });
    }
    router.push('/login');
  };

  return (
    <header className="bg-gray-900 border-b border-gray-700 dark:bg-gray-950 dark:border-gray-800 sticky top-0 z-40">
      <div className="max-w-md mx-auto px-3 sm:px-4 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <Logo variant="icon-simple" size="md" />
            <div className="flex-1 min-w-0">
              <h1 className="text-base sm:text-lg font-semibold text-white">Seri</h1>
              <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5">
                <div
                  className={cn(
                    'w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full',
                    isOnline ? 'bg-emerald-500' : 'bg-gray-500'
                  )}
                />
                <span className="text-xs text-gray-400 font-medium">
                  {isOnline ? 'En ligne' : 'Hors ligne'}
                </span>
                {pendingCount > 0 && (
                  <>
                    <span className="text-gray-600">&#8226;</span>
                    <span className="text-xs text-amber-400 font-medium">
                      {pendingCount}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Notification badge for urgent payment reminders */}
            <NotificationBadge />

            {/* User avatar with link to settings */}
            <Link href="/parametres" className="flex-shrink-0">
              <UserAvatar
                name={userName}
                image={userImage}
                size="sm"
                className="hover:ring-emerald-400/50 transition-all cursor-pointer"
              />
            </Link>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-all duration-200 border border-gray-600"
            >
              <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-300" />
              <span className="text-xs sm:text-sm font-medium text-gray-300 hidden xs:inline">
                Quitter
              </span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

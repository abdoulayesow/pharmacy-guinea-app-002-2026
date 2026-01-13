'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Logo } from './Logo';
import { NotificationBadge } from './NotificationBadge';
import { useAuthStore } from '@/stores/auth';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { cn } from '@/lib/utils';

export function Header() {
  const router = useRouter();
  const { currentUser, logout } = useAuthStore();
  const { isOnline, pendingCount } = useSyncStatus();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <header className="bg-gray-900 border-b border-gray-700 dark:bg-gray-950 dark:border-gray-800 sticky top-0 z-40">
      <div className="max-w-md mx-auto px-3 sm:px-4 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <Logo variant="icon-simple" size="sm" />
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
          <div className="flex items-center gap-2">
            {/* Notification badge for urgent payment reminders */}
            <NotificationBadge />

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

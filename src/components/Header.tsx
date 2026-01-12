'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Logo } from './Logo';
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
    <header className="bg-slate-900 border-b border-slate-700 sticky top-0 z-40">
      <div className="max-w-md mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Logo size="sm" />
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold text-white">Seri</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <div
                  className={cn(
                    'w-2 h-2 rounded-full',
                    isOnline ? 'bg-emerald-500' : 'bg-slate-500'
                  )}
                />
                <span className="text-xs text-slate-400 font-medium">
                  {isOnline ? 'En ligne' : 'Hors ligne'}
                </span>
                {pendingCount > 0 && (
                  <>
                    <span className="text-slate-600">&#8226;</span>
                    <span className="text-xs text-amber-400 font-medium">
                      {pendingCount} en attente
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-all duration-200 border border-slate-600"
            >
              <LogOut className="w-4 h-4 text-slate-300" />
              <span className="text-sm font-medium text-slate-300">
                Quitter
              </span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

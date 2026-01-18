'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ShoppingCart, Package, Users, Coins, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Accueil', icon: Home },
  { href: '/ventes/nouvelle', label: 'Vente', icon: ShoppingCart },
  { href: '/stocks', label: 'Stock', icon: Package },
  { href: '/fournisseurs', label: 'Fournisseurs', icon: Users },
  { href: '/depenses', label: 'Dépenses', icon: Coins },
  { href: '/parametres', label: 'Réglages', icon: Settings },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 backdrop-blur-lg border-t border-gray-700 dark:bg-gray-950 dark:border-gray-800 shadow-lg z-40 safe-area-bottom">
      <div className="max-w-md mx-auto flex items-center justify-around px-1 sm:px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 sm:gap-1.5 py-2 sm:py-3 relative transition-all duration-200',
                isActive
                  ? 'text-emerald-400'
                  : 'text-gray-400 hover:text-gray-300'
              )}
            >
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 sm:w-12 h-0.5 bg-emerald-400 rounded-full" />
              )}
              <div
                className={cn(
                  'w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center transition-all duration-200',
                  isActive ? 'bg-emerald-900/30' : 'bg-transparent'
                )}
              >
                <Icon className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
              </div>
              <span className={cn('text-[10px] sm:text-xs truncate max-w-full px-0.5', isActive ? 'font-semibold' : 'font-medium')}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

import { Home, ShoppingCart, Package, Coins } from 'lucide-react';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

type Screen = 'dashboard' | 'sale' | 'products' | 'expenses';

export function Navigation({ 
  currentScreen, 
  onNavigate,
  onLogout 
}: { 
  currentScreen: Screen; 
  onNavigate: (screen: Screen) => void;
  onLogout: () => void;
}) {
  const navItems = [
    { id: 'dashboard' as Screen, label: 'Accueil', icon: Home },
    { id: 'sale' as Screen, label: 'Vente', icon: ShoppingCart },
    { id: 'products' as Screen, label: 'Stock', icon: Package },
    { id: 'expenses' as Screen, label: 'Dépenses', icon: Coins },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 backdrop-blur-lg border-t border-gray-200 dark:border-gray-700 shadow-lg z-40 transition-colors duration-300">
      <div className="max-w-md mx-auto flex items-center justify-around px-2">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = currentScreen === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex-1 flex flex-col items-center gap-1.5 py-3 relative transition-all duration-200 ${
                isActive 
                  ? 'text-emerald-600 dark:text-emerald-400' 
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-emerald-600 dark:bg-emerald-400 rounded-full"></div>
              )}
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${
                isActive 
                  ? 'bg-emerald-100 dark:bg-emerald-900/30' 
                  : 'bg-transparent'
              }`}>
                <Icon className={`w-5 h-5`} />
              </div>
              <span className={`text-xs ${isActive ? 'font-semibold' : 'font-medium'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function Header({ userName, isOnline, pendingSyncCount, onLogout }: {
  userName: string;
  isOnline: boolean;
  pendingSyncCount: number;
  onLogout: () => void;
}) {
  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40 transition-colors duration-300">
      <div className="max-w-md mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Logo size="sm" />
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Seri</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                  {isOnline ? 'En ligne' : 'Hors ligne'}
                </span>
                {pendingSyncCount > 0 && (
                  <>
                    <span className="text-gray-300 dark:text-gray-600">•</span>
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                      {pendingSyncCount} en attente
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 border border-gray-200 dark:border-gray-600"
            >
              <svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Quitter</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
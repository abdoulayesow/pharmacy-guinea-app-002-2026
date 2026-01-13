'use client';

import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '@/stores/theme';

export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      className="relative w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center transition-all duration-200 hover:bg-gray-200 dark:hover:bg-gray-600"
      aria-label={isDark ? 'Activer le mode clair' : 'Activer le mode sombre'}
    >
      <div
        className={`absolute transition-all duration-300 ease-in-out ${
          isDark ? 'scale-0 opacity-0 rotate-180' : 'scale-100 opacity-100 rotate-0'
        }`}
      >
        <Sun className="w-5 h-5 text-amber-500" />
      </div>
      <div
        className={`absolute transition-all duration-300 ease-in-out ${
          isDark ? 'scale-100 opacity-100 rotate-0' : 'scale-0 opacity-0 -rotate-180'
        }`}
      >
        <Moon className="w-5 h-5 text-blue-400" />
      </div>
    </button>
  );
}

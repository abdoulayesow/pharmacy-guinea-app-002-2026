'use client';

import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/client/utils';

interface MobileSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function MobileSearchBar({
  value,
  onChange,
  placeholder = 'Rechercher...',
  className,
}: MobileSearchBarProps) {
  return (
    <div className={cn('relative', className)}>
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
        <Search className="w-5 h-5" />
      </div>
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-12 pl-12 pr-12 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 rounded-xl text-base"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center hover:bg-slate-600 transition-colors active:scale-95"
          aria-label="Effacer"
        >
          <X className="w-4 h-4 text-slate-300" />
        </button>
      )}
    </div>
  );
}


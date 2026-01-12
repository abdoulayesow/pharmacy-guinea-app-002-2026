# /seri-migrate - Figma to Next.js Migrator

Convert components from the Figma design implementation (React/Vite) to Next.js App Router with offline-first architecture.

## Instructions

When the user asks to migrate a component from Figma design:

1. **Read the source component** from `figma-design/src/components/`
2. **Apply conversion rules** below
3. **Create the Next.js version** in `src/app/` or `src/components/`
4. **Integrate with Dexie.js** for offline data
5. **Add Zustand** for UI state
6. **Test offline functionality**

## Conversion Checklist

For each component migration:

- [ ] Add `'use client'` directive (for interactive components)
- [ ] Replace `useApp` context with Zustand stores
- [ ] Replace mock data with Dexie.js `useLiveQuery`
- [ ] Update imports to Next.js paths (`@/lib/`, `@/components/`)
- [ ] Keep Tailwind classes exactly the same
- [ ] Keep all French text unchanged
- [ ] Add sync status indicators where data is modified
- [ ] Ensure touch targets are 48x48dp minimum

## Source to Target Mapping

| Figma Source | Next.js Target |
|--------------|----------------|
| `figma-design/src/components/LoginScreen.tsx` | `src/app/login/page.tsx` |
| `figma-design/src/components/Dashboard.tsx` | `src/app/dashboard/page.tsx` |
| `figma-design/src/components/NewSale.tsx` | `src/app/ventes/nouvelle/page.tsx` |
| `figma-design/src/components/ProductList.tsx` | `src/app/stocks/page.tsx` |
| `figma-design/src/components/ProductForm.tsx` | `src/components/ProductForm.tsx` |
| `figma-design/src/components/ExpenseList.tsx` | `src/app/depenses/page.tsx` |
| `figma-design/src/components/ExpenseForm.tsx` | `src/components/ExpenseForm.tsx` |
| `figma-design/src/components/Navigation.tsx` | `src/components/Navigation.tsx` |
| `figma-design/src/lib/types.ts` | `src/types/index.ts` |
| `figma-design/src/lib/utils.ts` | `src/lib/utils.ts` |

## Context to Zustand Conversion

### Before (Figma - useApp context)

```typescript
// figma-design/src/lib/context.tsx
const AppContext = createContext<AppContextType | null>(null);

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}

// Usage in component
import { useApp } from '../lib/context';

function MyComponent() {
  const { currentUser, products, addSale, cart, addToCart } = useApp();
  // ...
}
```

### After (Next.js - Zustand stores)

```typescript
// src/stores/auth.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      currentUser: null,
      isAuthenticated: false,
      login: (user) => set({ currentUser: user, isAuthenticated: true }),
      logout: () => set({ currentUser: null, isAuthenticated: false }),
    }),
    { name: 'seri-auth' }
  )
);
```

```typescript
// src/stores/cart.ts
import { create } from 'zustand';
import { Product, CartItem } from '@/types';

interface CartState {
  items: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  total: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  addToCart: (product) => set((state) => {
    const existing = state.items.find(i => i.product.id === product.id);
    if (existing) {
      return {
        items: state.items.map(i =>
          i.product.id === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        )
      };
    }
    return { items: [...state.items, { product, quantity: 1 }] };
  }),
  removeFromCart: (productId) => set((state) => ({
    items: state.items.filter(i => i.product.id !== productId)
  })),
  updateQuantity: (productId, quantity) => set((state) => ({
    items: state.items.map(i =>
      i.product.id === productId ? { ...i, quantity } : i
    )
  })),
  clearCart: () => set({ items: [] }),
  total: () => get().items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),
}));
```

## Mock Data to Dexie.js Conversion

### Before (Figma - mock data)

```typescript
// figma-design/src/lib/context.tsx
const [products, setProducts] = useState<Product[]>([
  { id: '1', name: 'Paracetamol 500mg', price: 15000, stock: 45, ... },
  { id: '2', name: 'Amoxicilline 250mg', price: 25000, stock: 8, ... },
]);
```

### After (Next.js - Dexie.js)

```typescript
// src/app/stocks/page.tsx
'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';

export default function StocksPage() {
  // Reactive query - auto-updates when data changes
  const products = useLiveQuery(() => db.products.toArray()) ?? [];

  // Loading state
  if (products === undefined) {
    return <div>Chargement...</div>;
  }

  return (
    <div>
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
```

## Full Component Migration Example

### Source: LoginScreen (Figma)

```typescript
// figma-design/src/components/LoginScreen.tsx
import { useState } from 'react';
import { useApp } from '../lib/context';
import { Button } from './ui/button';

export default function LoginScreen() {
  const { users, login } = useApp();
  const [selectedUser, setSelectedUser] = useState(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handlePinSubmit = () => {
    const user = users.find(u => u.id === selectedUser);
    if (user && user.pin === pin) {
      login(user);
    } else {
      setError('Code PIN incorrect');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-500 to-teal-600 p-4">
      {/* ... component JSX ... */}
    </div>
  );
}
```

### Target: LoginScreen (Next.js)

```typescript
// src/app/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();

  // Get users from IndexedDB
  const users = useLiveQuery(() => db.users.toArray()) ?? [];

  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);

  const handlePinSubmit = async () => {
    if (isLocked) return;

    const user = users.find(u => u.id === selectedUser);
    if (!user) return;

    // Verify PIN with bcrypt
    const isValid = await bcrypt.compare(pin, user.pinHash);

    if (isValid) {
      login(user);
      router.push('/dashboard');
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setError('Code PIN incorrect');
      setPin('');

      // Lock after 5 failed attempts
      if (newAttempts >= 5) {
        setIsLocked(true);
        setTimeout(() => {
          setIsLocked(false);
          setAttempts(0);
        }, 30 * 60 * 1000); // 30 minutes
      }
    }
  };

  // Keep exact same JSX structure and Tailwind classes
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-500 to-teal-600 p-4">
      {/* ... same component JSX with updated handlers ... */}
    </div>
  );
}
```

## Import Path Conversions

| Figma Import | Next.js Import |
|--------------|----------------|
| `'../lib/context'` | `'@/stores/auth'` or `'@/stores/cart'` |
| `'../lib/types'` | `'@/types'` |
| `'../lib/utils'` | `'@/lib/utils'` |
| `'./ui/button'` | `'@/components/ui/button'` |
| `'lucide-react'` | `'lucide-react'` (unchanged) |

## Navigation Migration

### Before (Figma - setState)

```typescript
// figma-design/src/components/Navigation.tsx
const { setCurrentScreen } = useApp();

<button onClick={() => setCurrentScreen('dashboard')}>
  Dashboard
</button>
```

### After (Next.js - router)

```typescript
// src/components/Navigation.tsx
'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Navigation() {
  const pathname = usePathname();

  const navItems = [
    { href: '/dashboard', label: 'Accueil', icon: Home },
    { href: '/ventes', label: 'Ventes', icon: ShoppingCart },
    { href: '/stocks', label: 'Stocks', icon: Package },
    { href: '/depenses', label: 'Dépenses', icon: Wallet },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t">
      <div className="flex justify-around">
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center p-3 min-w-[64px]',
              pathname === item.href ? 'text-emerald-600' : 'text-gray-500'
            )}
          >
            <item.icon className="w-6 h-6" />
            <span className="text-xs mt-1">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
```

## Add Sync Status Indicator

For any component that modifies data, add the sync status:

```typescript
// src/components/SyncIndicator.tsx
'use client';

import { useSyncStatus } from '@/hooks/useSyncStatus';
import { Cloud, CloudOff, RefreshCw } from 'lucide-react';

export function SyncIndicator() {
  const { isOnline, pendingCount, isSynced } = useSyncStatus();

  if (!isOnline) {
    return (
      <div className="flex items-center gap-1 text-orange-600">
        <CloudOff className="w-4 h-4" />
        <span className="text-xs">Hors ligne</span>
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div className="flex items-center gap-1 text-blue-600">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span className="text-xs">{pendingCount} en attente</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-emerald-600">
      <Cloud className="w-4 h-4" />
      <span className="text-xs">Synchronisé</span>
    </div>
  );
}
```

## Migration Commands

```bash
# 1. Read source component
cat figma-design/src/components/ComponentName.tsx

# 2. Create target directory
mkdir -p src/app/route-name

# 3. Create migrated component
# (Use the patterns above)

# 4. Test offline
# Open Chrome DevTools → Network → Offline
# Verify component works without network
```

# /seri-component - UI Component Builder

Build Next.js components that match the Figma design exactly for the Seri pharmacy app.

## Instructions

When the user asks to create a component, implement a screen, or build UI:

1. **Read the Figma design reference** first:
   - Check `figma-design/src/components/` for the corresponding component
   - Read `figma-design/src/lib/types.ts` for TypeScript interfaces
   - Read `figma-design/src/lib/utils.ts` for formatting helpers

2. **Convert to Next.js App Router**:
   - Add `'use client'` directive for interactive components
   - Use Next.js App Router file conventions (`page.tsx`, `layout.tsx`)
   - Place in `src/app/{route}/` or `src/components/`

3. **Integrate with offline-first architecture**:
   - Use Dexie.js via `useLiveQuery` for reactive data
   - Use Zustand store for UI state (auth, cart, etc.)
   - Add sync status indicators where appropriate

4. **Preserve design fidelity**:
   - Copy Tailwind classes exactly from Figma components
   - Keep all French text labels unchanged
   - Maintain dark mode support with `dark:` variants
   - Use emerald-600 as primary color
   - Module colors: blue (sales), purple (inventory), orange (expenses)

5. **Apply Seri conventions**:
   - Format currency with `formatCurrency()` → "15 000 GNF"
   - Format dates with `formatDate()` → "15/01/2026"
   - Use Lucide React icons
   - Ensure 48x48dp minimum touch targets

## Example Usage

User: "Create the login screen"
→ Read `figma-design/src/components/LoginScreen.tsx`
→ Create `src/app/login/page.tsx` with Next.js patterns
→ Add PIN validation with bcrypt
→ Integrate with auth Zustand store

User: "Build the dashboard"
→ Read `figma-design/src/components/Dashboard.tsx`
→ Create `src/app/dashboard/page.tsx`
→ Use `useLiveQuery` for sales/products/expenses data
→ Add sync status indicator

## Key Files to Reference

- `figma-design/src/components/LoginScreen.tsx` - PIN authentication
- `figma-design/src/components/Dashboard.tsx` - Main dashboard
- `figma-design/src/components/NewSale.tsx` - Sale flow (4 steps)
- `figma-design/src/components/ProductList.tsx` - Inventory list
- `figma-design/src/components/ProductForm.tsx` - Add/edit product
- `figma-design/src/components/ExpenseList.tsx` - Expense tracking
- `figma-design/src/components/ExpenseForm.tsx` - Add expense
- `figma-design/src/components/Navigation.tsx` - Bottom nav bar

## Code Pattern

```typescript
'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useAuthStore } from '@/stores/auth';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingCart } from 'lucide-react';

export default function ComponentName() {
  const { currentUser } = useAuthStore();
  const products = useLiveQuery(() => db.products.toArray()) ?? [];

  // Component logic matching Figma design
  return (
    <div className="space-y-4">
      {/* Copy Tailwind classes exactly from Figma */}
    </div>
  );
}
```

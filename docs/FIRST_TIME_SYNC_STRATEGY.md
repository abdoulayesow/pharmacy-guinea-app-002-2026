# First-Time Login Synchronization Strategy

**Date**: 2026-01-16
**Purpose**: Smart initialization of new user's IndexedDB from PostgreSQL with role-based data access

---

## Problem Statement

When a new user logs in for the first time (via Google OAuth):
1. Their IndexedDB is empty (no local data)
2. PostgreSQL contains pharmacy data (products, sales, expenses)
3. Demo data is currently seeded per-browser (causing stock inconsistencies)
4. Need role-based filtering: EMPLOYEE should not see expenses (OWNER-only)

---

## Solution: Smart First-Time Sync

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. User logs in via Google OAuth (first time)                  │
│    - NextAuth creates user in PostgreSQL                        │
│    - Sets mustChangePin = true, default PIN hash                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. AuthGuard detects first login                                │
│    - Checks localStorage.getItem('seri-first-sync-complete')    │
│    - If null → trigger performFirstTimeSync()                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. API: GET /api/sync/initial?role=EMPLOYEE                     │
│    - Server queries PostgreSQL for all data                     │
│    - Filters based on role (employees don't get expenses)       │
│    - Returns: products, suppliers, sales (last 30 days)         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Client merges data into IndexedDB                            │
│    - db.products.bulkAdd(products)                              │
│    - db.suppliers.bulkAdd(suppliers)                            │
│    - db.sales.bulkAdd(sales) (employees can VIEW past sales)    │
│    - Sets localStorage 'seri-first-sync-complete' = timestamp   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. User redirected to /auth/setup-pin (change default PIN)     │
│    - After PIN change, redirected to /dashboard                 │
│    - Background sync enabled for ongoing updates                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Role-Based Data Access Rules

| Data Type | OWNER Access | EMPLOYEE Access |
|-----------|--------------|-----------------|
| **Products** | ✅ Full (CRUD) | ✅ Full (CRUD) |
| **Suppliers** | ✅ Full (CRUD) | ✅ Full (CRUD) |
| **Supplier Orders** | ✅ Full (CRUD) | ✅ View only (no create/edit) |
| **Sales** | ✅ Full history | ✅ Last 30 days only (privacy) |
| **Expenses** | ✅ Full (CRUD) | ❌ **None** (owner-only) |
| **Stock Movements** | ✅ Full history | ✅ Last 30 days only |
| **Credit Payments** | ✅ Full history | ✅ Last 30 days only |

### Rationale
- **Expenses**: Sensitive financial data (rent, salary) - owner-only
- **Sales (limited history)**: Employees can see recent sales for context, but not full history (privacy)
- **Products/Suppliers**: All users need full access for daily operations
- **Supplier Orders**: Employees can view to check delivery status, but can't modify payments

---

## Implementation Details

### 1. New API Endpoint: `/api/sync/initial`

**Location**: `src/app/api/sync/initial/route.ts`

**Purpose**: Initial data sync for first-time login with role-based filtering

**Request**:
```typescript
GET /api/sync/initial?role=EMPLOYEE
```

**Response**:
```typescript
{
  success: true,
  data: {
    products: Product[],       // All products
    suppliers: Supplier[],     // All suppliers
    supplierOrders: SupplierOrder[], // All orders (view-only for employees)
    sales: Sale[],             // Last 30 days for employees, all for owner
    stockMovements: StockMovement[], // Last 30 days for employees
    creditPayments: CreditPayment[], // Last 30 days for employees
    expenses: Expense[]        // [] empty for employees, all for owner
  },
  serverTime: "2026-01-16T15:30:00Z"
}
```

**Server-Side Logic** (pseudo-code):
```typescript
// src/app/api/sync/initial/route.ts
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userRole = session.user.role; // OWNER | EMPLOYEE
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Fetch all products (both roles)
  const products = await prisma.product.findMany();

  // Fetch all suppliers (both roles)
  const suppliers = await prisma.supplier.findMany();

  // Fetch supplier orders (both roles, but employees view-only)
  const supplierOrders = await prisma.supplierOrder.findMany({
    include: { items: true }
  });

  // Fetch sales (filtered for employees)
  const sales = userRole === 'EMPLOYEE'
    ? await prisma.sale.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        include: { items: true }
      })
    : await prisma.sale.findMany({
        include: { items: true }
      });

  // Fetch expenses (OWNER only!)
  const expenses = userRole === 'OWNER'
    ? await prisma.expense.findMany()
    : [];

  // Fetch stock movements (filtered for employees)
  const stockMovements = userRole === 'EMPLOYEE'
    ? await prisma.stockMovement.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } }
      })
    : await prisma.stockMovement.findMany();

  return NextResponse.json({
    success: true,
    data: {
      products,
      suppliers,
      supplierOrders,
      sales,
      stockMovements,
      creditPayments: [], // TODO: filter like sales
      expenses
    },
    serverTime: now.toISOString()
  });
}
```

---

### 2. Client-Side: First-Time Sync Logic

**Location**: `src/lib/client/sync.ts`

**New Function**: `performFirstTimeSync()`

```typescript
/**
 * Perform first-time sync for new user
 * - Detects if user has synced before (localStorage flag)
 * - Pulls all data from /api/sync/initial (role-filtered)
 * - Merges into IndexedDB
 * - Sets flag to prevent re-sync
 */
export async function performFirstTimeSync(userRole: 'OWNER' | 'EMPLOYEE'): Promise<{
  success: boolean;
  pulled: number;
  errors: string[];
}> {
  console.log('[Sync] Performing first-time sync for role:', userRole);

  // Check if already synced
  const alreadySynced = localStorage.getItem('seri-first-sync-complete');
  if (alreadySynced) {
    console.log('[Sync] First-time sync already completed at:', alreadySynced);
    return { success: true, pulled: 0, errors: [] };
  }

  try {
    const response = await fetch(`/api/sync/initial?role=${userRole}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Include cookies for auth
      signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const { success, data, serverTime } = await response.json();

    if (!success) {
      throw new Error('Initial sync failed');
    }

    let totalMerged = 0;

    // Merge products
    if (data.products?.length > 0) {
      await db.products.bulkAdd(data.products.map((p: any) => ({
        name: p.name,
        price: p.price,
        priceBuy: p.priceBuy,
        stock: p.stock,
        minStock: p.minStock,
        category: p.category,
        expirationDate: p.expirationDate,
        lotNumber: p.lotNumber,
        serverId: p.id, // Map server ID
        synced: true,
        updatedAt: p.updatedAt,
      })));
      totalMerged += data.products.length;
    }

    // Merge suppliers
    if (data.suppliers?.length > 0) {
      await db.suppliers.bulkAdd(data.suppliers.map((s: any) => ({
        name: s.name,
        phone: s.phone,
        paymentTermsDays: s.paymentTermsDays,
        serverId: s.id,
        synced: true,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })));
      totalMerged += data.suppliers.length;
    }

    // Merge sales (role-filtered already by server)
    if (data.sales?.length > 0) {
      await db.sales.bulkAdd(data.sales.map((s: any) => ({
        total: s.total,
        payment_method: s.paymentMethod,
        payment_status: s.paymentStatus,
        payment_ref: s.paymentRef,
        customer_name: s.customerName,
        customer_phone: s.customerPhone,
        due_date: s.dueDate,
        amount_paid: s.amountPaid,
        amount_due: s.amountDue,
        created_at: s.createdAt,
        user_id: s.userId,
        modified_at: s.modifiedAt,
        modified_by: s.modifiedBy,
        edit_count: s.editCount,
        serverId: s.id,
        synced: true,
      })));
      totalMerged += data.sales.length;
    }

    // Merge expenses (empty for employees)
    if (data.expenses?.length > 0) {
      await db.expenses.bulkAdd(data.expenses.map((e: any) => ({
        date: e.date,
        description: e.description,
        amount: e.amount,
        category: e.category,
        user_id: e.userId,
        serverId: e.id,
        synced: true,
      })));
      totalMerged += data.expenses.length;
    }

    // Merge stock movements
    if (data.stockMovements?.length > 0) {
      await db.stock_movements.bulkAdd(data.stockMovements.map((m: any) => ({
        product_id: m.productId,
        type: m.type,
        quantity_change: m.quantityChange,
        reason: m.reason,
        created_at: m.createdAt,
        user_id: m.userId,
        serverId: m.id,
        synced: true,
      })));
      totalMerged += data.stockMovements.length;
    }

    // Set sync timestamp
    if (serverTime) {
      setLastSyncAt(new Date(serverTime));
    }

    // Mark first-time sync as complete
    localStorage.setItem('seri-first-sync-complete', new Date().toISOString());

    console.log(`[Sync] First-time sync complete: ${totalMerged} records merged`);
    return { success: true, pulled: totalMerged, errors: [] };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[Sync] First-time sync error:', error);
    return { success: false, pulled: 0, errors: [errorMsg] };
  }
}
```

---

### 3. AuthGuard Integration

**Location**: `src/components/AuthGuard.tsx`

**Changes**:
```typescript
// Add import
import { performFirstTimeSync } from '@/lib/client/sync';

// Add useEffect after line 59 (after initializeActivity)
useEffect(() => {
  if (status === 'authenticated' && session?.user?.id) {
    // ... existing syncProfileFromSession code ...

    // Check if first-time sync is needed
    const hasCompletedFirstSync = localStorage.getItem('seri-first-sync-complete');
    if (!hasCompletedFirstSync && session.user.role) {
      console.log('[AuthGuard] First login detected - starting initial sync');
      performFirstTimeSync(session.user.role as 'OWNER' | 'EMPLOYEE')
        .then(result => {
          if (result.success) {
            console.log(`[AuthGuard] Initial sync success: ${result.pulled} records`);
          } else {
            console.error('[AuthGuard] Initial sync failed:', result.errors);
          }
        })
        .catch(err => {
          console.error('[AuthGuard] Initial sync error:', err);
        });
    }
  }
}, [status, session]);
```

---

## Data Migration Plan

### Phase 1: Seed PostgreSQL (Server-Side)

**File**: `prisma/seed.ts`

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding PostgreSQL with demo data...');

  // Clear existing data (dev only!)
  await prisma.product.deleteMany();
  await prisma.supplier.deleteMany();

  // Seed products (single source of truth)
  await prisma.product.createMany({
    data: [
      {
        name: 'Paracetamol 500mg',
        category: 'Antidouleur',
        price: 15000,
        priceBuy: 10000,
        stock: 45,
        minStock: 10,
        expirationDate: new Date('2026-06-15'),
        lotNumber: 'LOT-2024-001',
      },
      // ... 7 more products
    ],
  });

  // Seed suppliers
  await prisma.supplier.createMany({
    data: [
      { name: 'Sopharma Guinée', phone: '+224 622 12 34 56', paymentTermsDays: 30 },
      { name: 'Pharmaguinée', phone: '+224 628 98 76 54', paymentTermsDays: 45 },
      // ... 3 more suppliers
    ],
  });

  console.log('Seeding complete!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

**Run**: `npx prisma db seed`

---

### Phase 2: Remove Client-Side Seeding

**File**: `src/lib/client/db.ts`

**Changes**:
```typescript
// DELETE seedInitialData() function (lines 218-423)
// OR keep it as no-op for backward compatibility:

export async function seedInitialData() {
  console.log('[Seri DB] Client-side seeding disabled - data synced from server');
  // No-op - data now comes from /api/sync/initial
}
```

---

### Phase 3: Clear Existing IndexedDB

**Manual Action (for testing)**:
1. Open Chrome DevTools → Application → IndexedDB → seri-db
2. Right-click → Delete database
3. Refresh page
4. First-time sync triggers automatically

**OR programmatic**:
```typescript
// In browser console
await Dexie.delete('seri-db');
localStorage.removeItem('seri-first-sync-complete');
localStorage.removeItem('seri-last-sync');
location.reload();
```

---

## Benefits

### 1. Single Source of Truth
- PostgreSQL is the authoritative data source
- No more per-browser demo data causing inconsistencies

### 2. Role-Based Security
- Employees don't see expenses (sensitive financial data)
- Employees see only last 30 days of history (privacy)

### 3. Faster Onboarding
- New user gets instant access to pharmacy data
- No manual data entry required

### 4. Consistent Stock Levels
- All users see same products with same stock
- Stock movements synced correctly

### 5. Offline-First Still Works
- After first sync, app works 100% offline
- Background sync keeps data updated

---

## Testing Checklist

### Test 1: Owner First Login
- [ ] Login as owner-abdoulaye-sow (new browser/incognito)
- [ ] Verify IndexedDB populated with:
  - [ ] 8 products
  - [ ] 5 suppliers
  - [ ] All sales (full history)
  - [ ] All expenses
  - [ ] All stock movements
- [ ] Verify localStorage flag set: `seri-first-sync-complete`

### Test 2: Employee First Login
- [ ] Login as employee-ablo-sow (new browser/incognito)
- [ ] Verify IndexedDB populated with:
  - [ ] 8 products (same as owner)
  - [ ] 5 suppliers (same as owner)
  - [ ] Sales (last 30 days only)
  - [ ] **0 expenses** (owner-only)
  - [ ] Stock movements (last 30 days only)
- [ ] Verify localStorage flag set

### Test 3: Stock Consistency
- [ ] Both users see **identical stock levels**
- [ ] Owner sells 5 units of Paracetamol
- [ ] Push sync completes
- [ ] Employee refreshes/pull syncs
- [ ] Employee sees updated stock (matching owner)

### Test 4: No Re-Sync on Second Login
- [ ] Logout and login again (same browser)
- [ ] Verify no `/api/sync/initial` call (check Network tab)
- [ ] Verify localStorage flag still present

---

## Rollback Plan

If first-time sync causes issues:

1. **Disable first-time sync in AuthGuard**:
   ```typescript
   // Comment out performFirstTimeSync() call
   ```

2. **Re-enable client-side seeding**:
   ```typescript
   // Restore seedInitialData() in db.ts
   ```

3. **Clear IndexedDB** to force re-seed:
   ```typescript
   await Dexie.delete('seri-db');
   location.reload();
   ```

---

## Next Steps

1. **Implement `/api/sync/initial` endpoint** (30 min)
2. **Add `performFirstTimeSync()` to sync.ts** (20 min)
3. **Update AuthGuard to trigger first-time sync** (10 min)
4. **Create `prisma/seed.ts`** (15 min)
5. **Seed PostgreSQL** (`npx prisma db seed`)
6. **Test with two users** (20 min)
7. **Fix version 5 duplication** (from previous analysis)
8. **Deploy to staging** and re-test

**Total Estimate**: 2 hours

---

## Related Documentation

- [Database Schema Analysis](./DATABASE_SCHEMA_ANALYSIS.md) - Root cause analysis
- [P0/P1 Sync Improvements](./summaries/2026-01-16_sync-improvements-p0-p1.md) - Sync architecture
- [Offline-First Sync Flow](./OFFLINE_FIRST_SYNC_FLOW.md) - Multi-user sync design

---

**Status**: Design complete, ready for implementation
**Priority**: P0 - Blocks testing of sync improvements
**Assigned**: Next session

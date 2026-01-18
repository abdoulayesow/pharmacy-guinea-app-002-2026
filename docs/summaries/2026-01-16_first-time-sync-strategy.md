# Session Summary: First-Time Sync Strategy Design

**Date**: 2026-01-16
**Duration**: ~45 minutes
**Focus**: Designing smart first-time login synchronization with role-based data access

---

## Overview

This session addressed a critical issue discovered during P0/P1 sync testing: **stock levels were different between users**. Analysis revealed the root cause was client-side demo data seeding, where each browser created its own local product instances. The solution is a smart first-time sync strategy that pulls all data from PostgreSQL (single source of truth) with role-based filtering.

---

## Completed Work

### 1. Problem Identification
- ✅ User reported stock inconsistencies between two test accounts
- ✅ Root cause analysis identified three critical issues:
  1. Version 5 duplication in db.ts (idempotency keys lost)
  2. Client-side seeding creates independent local databases
  3. Missing Customer table (design issue)

### 2. Strategy Design
- ✅ Created comprehensive first-time sync strategy document
- ✅ Defined role-based data access rules (OWNER vs EMPLOYEE)
- ✅ Designed new `/api/sync/initial` endpoint with role filtering
- ✅ Planned client-side `performFirstTimeSync()` function
- ✅ Designed AuthGuard integration for automatic first-sync detection
- ✅ Created PostgreSQL seeding plan (`prisma/seed.ts`)

### 3. Documentation
- ✅ Created `docs/FIRST_TIME_SYNC_STRATEGY.md` with complete implementation guide
- ✅ Included code examples for all components
- ✅ Added testing checklist with 4 test scenarios
- ✅ Documented rollback plan for safety

---

## Key Files Created/Modified

| File | Status | Purpose |
|------|--------|---------|
| `docs/FIRST_TIME_SYNC_STRATEGY.md` | Created | Complete design and implementation guide |
| `docs/DATABASE_SCHEMA_ANALYSIS.md` | Created (previous) | Root cause analysis of stock inconsistency |
| `docs/summaries/2026-01-16_dev-server-log-analysis.md` | Created (previous) | P0/P1 testing analysis |

---

## Key Design Decisions

### 1. Role-Based Data Filtering

**OWNER Access:**
- ✅ All products & suppliers
- ✅ All sales (full history)
- ✅ All expenses
- ✅ All stock movements

**EMPLOYEE Access:**
- ✅ All products & suppliers (needed for daily work)
- ✅ Sales from last 30 days only (privacy)
- ❌ **NO expenses** (sensitive financial data - owner only)
- ✅ Stock movements from last 30 days only

**Rationale:** Employees need operational data (products, suppliers) but shouldn't see sensitive financial information (rent, salaries) or full historical data (privacy).

### 2. Single Source of Truth

**Problem:** Client-side seeding creates independent databases per browser
```typescript
// OLD (PROBLEMATIC) - Each browser seeds independently
export async function seedInitialData() {
  await db.products.bulkAdd([
    { name: 'Paracetamol', stock: 45 }, // Browser 1: local ID 1
    // ...
  ]);
}
// User 1 sells 5 units → stock: 40
// User 2 still sees stock: 45 (different instance!)
```

**Solution:** Server-side seeding + first-time sync
```typescript
// NEW - Single source of truth in PostgreSQL
// prisma/seed.ts seeds PostgreSQL once
// All users pull from /api/sync/initial on first login
// Everyone sees same data with same stock levels
```

### 3. Smart First-Login Detection

**Mechanism:**
```typescript
// Check localStorage flag
const hasCompletedFirstSync = localStorage.getItem('seri-first-sync-complete');

if (!hasCompletedFirstSync && session?.user?.role) {
  // First login detected
  await performFirstTimeSync(session.user.role); // 'OWNER' | 'EMPLOYEE'
  localStorage.setItem('seri-first-sync-complete', new Date().toISOString());
}
```

**Benefits:**
- ✅ Runs only once per browser
- ✅ No redundant syncs on logout/login
- ✅ Can be reset for testing (delete flag + refresh)

### 4. API Design

**New Endpoint:** `GET /api/sync/initial?role=EMPLOYEE`

**Response:**
```typescript
{
  success: true,
  data: {
    products: Product[],       // All products
    suppliers: Supplier[],     // All suppliers
    sales: Sale[],             // Filtered by role
    expenses: Expense[],       // [] for EMPLOYEE, all for OWNER
    stockMovements: StockMovement[], // Filtered by role
  },
  serverTime: "2026-01-16T15:30:00Z"
}
```

---

## Architecture Flow

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
│    - db.sales.bulkAdd(sales) (employees see last 30 days)       │
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

## Implementation Plan

### Phase 1: Backend API (30 min)
**File:** `src/app/api/sync/initial/route.ts`

```typescript
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userRole = session.user.role; // OWNER | EMPLOYEE
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Fetch all products (both roles)
  const products = await prisma.product.findMany();

  // Fetch sales (filtered for employees)
  const sales = userRole === 'EMPLOYEE'
    ? await prisma.sale.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        include: { items: true }
      })
    : await prisma.sale.findMany({ include: { items: true } });

  // Fetch expenses (OWNER only!)
  const expenses = userRole === 'OWNER'
    ? await prisma.expense.findMany()
    : [];

  return NextResponse.json({
    success: true,
    data: { products, sales, expenses, /* ... */ },
    serverTime: new Date().toISOString()
  });
}
```

### Phase 2: Client-Side Sync Function (20 min)
**File:** `src/lib/client/sync.ts`

**Add function:**
```typescript
export async function performFirstTimeSync(
  userRole: 'OWNER' | 'EMPLOYEE'
): Promise<{ success: boolean; pulled: number; errors: string[] }> {
  // Check if already synced
  if (localStorage.getItem('seri-first-sync-complete')) {
    return { success: true, pulled: 0, errors: [] };
  }

  // Fetch from server
  const response = await fetch(`/api/sync/initial?role=${userRole}`, {
    method: 'GET',
    credentials: 'include',
  });

  const { data } = await response.json();

  // Merge into IndexedDB
  await db.products.bulkAdd(data.products.map(p => ({ ...p, serverId: p.id })));
  await db.sales.bulkAdd(data.sales.map(s => ({ ...s, serverId: s.id })));
  // ... etc

  // Mark complete
  localStorage.setItem('seri-first-sync-complete', new Date().toISOString());

  return { success: true, pulled: totalRecords, errors: [] };
}
```

### Phase 3: AuthGuard Integration (10 min)
**File:** `src/components/AuthGuard.tsx`

**Add after line 59:**
```typescript
import { performFirstTimeSync } from '@/lib/client/sync';

useEffect(() => {
  if (status === 'authenticated' && session?.user?.id) {
    // ... existing code ...

    // Check if first-time sync is needed
    const hasCompletedFirstSync = localStorage.getItem('seri-first-sync-complete');
    if (!hasCompletedFirstSync && session.user.role) {
      performFirstTimeSync(session.user.role as 'OWNER' | 'EMPLOYEE')
        .then(result => {
          console.log(`[AuthGuard] Initial sync: ${result.pulled} records`);
        });
    }
  }
}, [status, session]);
```

### Phase 4: PostgreSQL Seeding (15 min)
**File:** `prisma/seed.ts`

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Seed products (single source of truth)
  await prisma.product.createMany({
    data: [
      {
        name: 'Paracetamol 500mg',
        price: 15000,
        stock: 45,
        // ...
      },
      // ... 7 more products
    ],
  });

  // Seed suppliers
  await prisma.supplier.createMany({
    data: [/* ... */],
  });
}

main();
```

**Run:** `npx prisma db seed`

### Phase 5: Remove Client-Side Seeding
**File:** `src/lib/client/db.ts`

**Replace `seedInitialData()` function (lines 218-423):**
```typescript
export async function seedInitialData() {
  console.log('[Seri DB] Client-side seeding disabled - data synced from server');
  // No-op - data now comes from /api/sync/initial
}
```

### Phase 6: Fix Version 5 Duplication (CRITICAL)
**File:** `src/lib/client/db.ts`

**Delete lines 121-134** (second version 5 definition)

**Update lines 106-119** to merge both indexes:
```typescript
this.version(5).stores({
  users: 'id, role',
  products: '++id, serverId, name, category, expirationDate, synced',
  sales: '++id, serverId, created_at, payment_method, payment_status, due_date, modified_at, user_id, customer_name, synced',
  sale_items: '++id, sale_id, product_id',
  expenses: '++id, serverId, date, category, supplier_order_id, user_id, synced',
  stock_movements: '++id, serverId, product_id, created_at, synced',
  sync_queue: '++id, type, status, idempotencyKey, localId, createdAt', // Both indexes!
  suppliers: '++id, serverId, name, synced',
  supplier_orders: '++id, serverId, supplierId, status, dueDate, synced',
  supplier_returns: '++id, serverId, supplierId, productId, applied, synced',
  credit_payments: '++id, serverId, sale_id, payment_date, synced',
});
```

---

## Testing Checklist

### Test 1: Owner First Login
- [ ] Login as owner-abdoulaye-sow (new browser/incognito)
- [ ] Open DevTools → Network → Filter: `initial`
- [ ] Verify `GET /api/sync/initial?role=OWNER` called
- [ ] Open DevTools → Application → IndexedDB → seri-db
- [ ] Verify IndexedDB populated with:
  - [ ] 8 products (check stock levels)
  - [ ] 5 suppliers
  - [ ] All sales (full history)
  - [ ] All expenses (not empty)
  - [ ] All stock movements
- [ ] Verify localStorage flag: `seri-first-sync-complete`
- [ ] Logout and login again
- [ ] Verify NO second `/api/sync/initial` call (check Network tab)

### Test 2: Employee First Login
- [ ] Login as employee-ablo-sow (different browser/incognito)
- [ ] Verify `GET /api/sync/initial?role=EMPLOYEE` called
- [ ] Verify IndexedDB populated with:
  - [ ] 8 products (same stock as owner!)
  - [ ] 5 suppliers (same as owner)
  - [ ] Sales (last 30 days only - check count < owner)
  - [ ] **0 expenses** (empty array - CRITICAL CHECK)
  - [ ] Stock movements (last 30 days only)
- [ ] Verify localStorage flag set
- [ ] Navigate to `/depenses` (Expenses page)
- [ ] Verify UI shows "Access denied" or redirects (employee can't see expenses)

### Test 3: Stock Consistency (CRITICAL)
- [ ] Both users logged in (different browsers)
- [ ] Both see **identical stock levels** for Paracetamol
- [ ] Owner creates sale: 5 units of Paracetamol
- [ ] Owner's stock updates immediately (optimistic UI)
- [ ] Wait for push sync to complete (check Settings page)
- [ ] Employee: Trigger pull sync (refresh page or manual sync button)
- [ ] Employee sees updated stock (matching owner)
- [ ] **VERIFY:** Both users show same stock level (e.g., 40 if started at 45)

### Test 4: No Re-Sync on Second Login
- [ ] Logout from owner account
- [ ] Login again (same browser)
- [ ] Open DevTools → Network tab
- [ ] Verify NO `/api/sync/initial` call
- [ ] Verify localStorage flag still present
- [ ] Verify IndexedDB data still intact (not cleared)

---

## Remaining Tasks

### Immediate (P0 - Blocking)
1. **Fix Version 5 Duplication** (5 min)
   - Merge lines 106-134 in `src/lib/client/db.ts`
   - Keep both `idempotencyKey` and `modified_at` indexes

2. **Create `/api/sync/initial` Endpoint** (30 min)
   - New file: `src/app/api/sync/initial/route.ts`
   - Implement role-based filtering
   - Test with Postman/curl

3. **Add `performFirstTimeSync()` Function** (20 min)
   - Update `src/lib/client/sync.ts`
   - Handle localStorage flag
   - Map server IDs to local records

4. **Update AuthGuard** (10 min)
   - Add first-sync detection logic
   - Import and call `performFirstTimeSync()`

5. **Create PostgreSQL Seed File** (15 min)
   - New file: `prisma/seed.ts`
   - Copy product/supplier data from `db.ts`
   - Run `npx prisma db seed`

6. **Disable Client-Side Seeding** (5 min)
   - Convert `seedInitialData()` to no-op

### Testing (30 min)
7. Clear both browsers' IndexedDB
8. Run Test 1: Owner first login
9. Run Test 2: Employee first login
10. Run Test 3: Stock consistency
11. Run Test 4: No re-sync

### Post-Implementation
12. Add Customer table (from DATABASE_SCHEMA_ANALYSIS.md)
13. Migrate customer data from Sale.customerName to Customer.id
14. Fix auth profile sync error (non-blocking)

---

## Known Issues

### Issue 1: Version 5 Duplication (CRITICAL)
**File:** `src/lib/client/db.ts` lines 106-134

**Problem:** Version 5 defined twice, second overwrites first
```typescript
// Line 106: Version 5 with idempotencyKey
this.version(5).stores({ /* ... */ sync_queue: '++id, type, status, idempotencyKey, localId, createdAt' });

// Line 121: Version 5 with modified_at (OVERWRITES LINE 106!)
this.version(5).stores({ /* ... */ sync_queue: '++id, type, status, createdAt' }); // Lost indexes!
```

**Impact:** P0/P1 idempotency improvements broken

**Fix:** Merge both definitions (see Phase 6 above)

### Issue 2: Client-Side Seeding
**File:** `src/lib/client/db.ts` lines 218-423

**Problem:** Each browser seeds products locally with different IDs

**Impact:** Stock inconsistency between users

**Fix:** Remove seeding, use `/api/sync/initial` instead

### Issue 3: Auth Profile Sync Error (Low Priority)
**File:** `src/auth.ts` line 40

**Problem:** Tries to update user before they exist (new user creation)

**Impact:** Non-blocking (error logged, user created successfully)

**Fix:** Add existence check before update (deferred to later)

---

## Design Patterns Used

### 1. Offline-First with Server Reconciliation
- Local IndexedDB remains primary interface
- Server is source of truth for initial state
- Background sync keeps data updated

### 2. Role-Based Access Control (RBAC)
- Server enforces data filtering by role
- Client respects role boundaries in UI
- No client-side filtering bypass possible

### 3. Idempotency for Sync Operations
- UUID v4 keys prevent duplicate transactions
- Server tracks processed keys for 24 hours
- Automatic retry on network failure

### 4. Last-Write-Wins Conflict Resolution
- Compare `updatedAt` timestamps
- Server version wins ties (authoritative)
- Conflicts logged for manual review

---

## Dependencies

### Required for Implementation
- NextAuth session (already configured)
- Prisma client (already configured)
- Dexie.js (already installed)
- PostgreSQL database (Neon - already set up)

### No New Dependencies Needed
All implementation uses existing libraries and patterns.

---

## Performance Considerations

### Initial Sync Size Estimates

**OWNER:**
- Products: 8 records × 500 bytes = 4 KB
- Suppliers: 5 records × 300 bytes = 1.5 KB
- Sales (100 historical): 100 × 1 KB = 100 KB
- Expenses (50 records): 50 × 500 bytes = 25 KB
- **Total:** ~130 KB (acceptable on 3G)

**EMPLOYEE:**
- Products: 8 records × 500 bytes = 4 KB
- Suppliers: 5 records × 300 bytes = 1.5 KB
- Sales (last 30 days, ~20 records): 20 × 1 KB = 20 KB
- Expenses: 0 bytes (empty array)
- **Total:** ~25 KB (very fast on 3G)

### Optimization
- Gzip compression reduces by ~70%: 130 KB → 40 KB, 25 KB → 8 KB
- IndexedDB write time: ~100ms for 100 records
- **Total first-sync time:** < 5 seconds on 3G

---

## Rollback Plan

If first-time sync causes issues:

### Step 1: Disable First-Time Sync
**File:** `src/components/AuthGuard.tsx`

Comment out the first-sync logic:
```typescript
// const hasCompletedFirstSync = localStorage.getItem('seri-first-sync-complete');
// if (!hasCompletedFirstSync && session.user.role) {
//   performFirstTimeSync(session.user.role);
// }
```

### Step 2: Re-Enable Client-Side Seeding
**File:** `src/lib/client/db.ts`

Restore `seedInitialData()` function from git history:
```bash
git checkout HEAD~1 -- src/lib/client/db.ts
```

### Step 3: Clear IndexedDB
Users will need to clear their browser data:
```typescript
// In browser console
await Dexie.delete('seri-db');
localStorage.removeItem('seri-first-sync-complete');
location.reload();
```

---

## Resume Prompt for Next Session

```
IMPORTANT: Follow token optimization patterns from `.claude/skills/summary-generator/guidelines/token-optimization.md`:
- Use Grep before Read for searches
- Use Explore agent for multi-file exploration
- Reference this summary instead of re-reading files
- Keep responses concise

## Context
Previous session designed a first-time sync strategy to fix stock inconsistencies between users.

**Session summary:** docs/summaries/2026-01-16_first-time-sync-strategy.md
**Strategy document:** docs/FIRST_TIME_SYNC_STRATEGY.md

## Problem Solved
Users were seeing different stock levels because client-side seeding created independent local databases per browser. Solution: Pull all data from PostgreSQL (single source of truth) on first login, with role-based filtering (employees don't see expenses).

## Files to Review First
1. docs/FIRST_TIME_SYNC_STRATEGY.md - Complete implementation guide
2. src/lib/client/db.ts - Lines 106-134 (version 5 duplication to fix)
3. src/lib/client/sync.ts - Will add performFirstTimeSync() here
4. src/components/AuthGuard.tsx - Will add first-sync detection here

## Current Status
✅ Strategy designed and documented
❌ Not yet implemented (ready to start)

## Immediate Next Steps (in order)
1. Fix version 5 duplication in src/lib/client/db.ts (CRITICAL - 5 min)
2. Create src/app/api/sync/initial/route.ts (30 min)
3. Add performFirstTimeSync() to src/lib/client/sync.ts (20 min)
4. Update AuthGuard to trigger first-sync (10 min)
5. Create prisma/seed.ts and run npx prisma db seed (15 min)
6. Test with both user roles (30 min)

## Key Implementation Details
- API endpoint: GET /api/sync/initial?role=EMPLOYEE
- Role filtering: EMPLOYEE gets no expenses, last 30 days of sales only
- First-sync detection: localStorage.getItem('seri-first-sync-complete')
- All code examples in FIRST_TIME_SYNC_STRATEGY.md

## Blockers
None - ready to implement

## Questions for User
- Should I start with the critical version 5 fix, or the full implementation?
- Do you want me to create a git branch for this work?

Start implementation now.
```

---

## Related Documentation

- [First-Time Sync Strategy](../FIRST_TIME_SYNC_STRATEGY.md) - Implementation guide (this design)
- [Database Schema Analysis](../DATABASE_SCHEMA_ANALYSIS.md) - Root cause analysis
- [P0/P1 Sync Improvements](./2026-01-16_sync-improvements-p0-p1.md) - Previous sync work
- [Dev Server Log Analysis](./2026-01-16_dev-server-log-analysis.md) - Testing observations
- [Offline-First Sync Flow](../OFFLINE_FIRST_SYNC_FLOW.md) - Multi-user sync architecture

---

**Session completed successfully. Strategy designed and documented. Ready for implementation.**

**Estimated implementation time:** 2 hours
**Priority:** P0 - Blocks testing of P0/P1 sync improvements
**Next session:** Start with resume prompt above

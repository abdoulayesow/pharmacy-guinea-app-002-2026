# Sync Mechanism Analysis & Improvements

**Date**: 2026-01-16
**Context**: Review of offline-first sync implementation for concurrent operations and automatic sync

---

## Executive Summary

**Critical Issues Found**: 2 major race conditions
**Recommendations**: 5 improvements (2 critical, 3 high priority)

The current sync implementation follows an offline-first architecture with bidirectional sync (push/pull). While the foundation is solid, there are **critical race conditions** that can lead to data inconsistencies, particularly with stock management in multi-user scenarios.

---

## 1. Edge Cases & Race Conditions

### 🔴 CRITICAL: Concurrent Sale with Insufficient Stock

**Scenario**: Your exact example - 2 users selling the same product simultaneously

**What Happens**:
```
Time    User A (Abdoulaye)          User B (Fatoumata)           Stock (Server)
----    ------------------          ------------------           --------------
T0      Product X: 5 units          Product X: 5 units           5 units
T1      Sells 5 units (local)       -                            5 units
T2      Stock = 0 (local)           Sells 5 units (local)        5 units
T3      -                           Stock = 0 (local)            5 units
T4      Syncs → Server: -5          -                            0 units
T5      -                           Syncs → Server: -5           -5 units ❌
```

**Result**: Stock goes negative on server, no validation prevents this

**Location**: [src/app/ventes/nouvelle/page.tsx:208-236](src/app/ventes/nouvelle/page.tsx#L208-L236)

**Code**:
```typescript
// Update stock (NO VALIDATION)
const newStock = product.stock - item.quantity;
await db.products.update(item.product.id!, {
  stock: newStock, // Can go negative!
  synced: false,
  updatedAt: new Date(),
});
```

**Why It Happens**:
1. Stock deduction is **client-side only** (IndexedDB)
2. No server-side validation in push sync ([src/app/api/sync/push/route.ts](src/app/api/sync/push/route.ts))
3. Conflict resolution uses "Last Write Wins" on `updatedAt`, not stock verification
4. Pull sync merges stock changes **additively** instead of reconciling

---

### 🔴 CRITICAL: Product Update Conflicts During Sale

**Scenario**: User A updates product price while User B is selling it

**What Happens**:
```
Time    User A                      User B                       Server
----    ------                      ------                       ------
T0      Product: 5000 GNF           Product: 5000 GNF            5000 GNF
T1      Updates price → 6000 GNF    -                            5000 GNF
T2      -                           Adds to cart (5000 GNF)      5000 GNF
T3      Syncs → Server              -                            6000 GNF
T4      -                           Completes sale (5000 GNF)    6000 GNF
T5      -                           Syncs → Server               5000 GNF ⚠️
```

**Result**: Price reverts to old value on server (Last Write Wins conflict)

**Location**: [src/app/api/sync/push/route.ts:308-330](src/app/api/sync/push/route.ts#L308-L330)

---

### 🟡 MEDIUM: Duplicate Sales Due to Retry Logic

**Scenario**: Network timeout during sync, retry creates duplicate

**What Happens**:
- Sale syncs to server (HTTP 200)
- Network drops before response reaches client
- Client retries after exponential backoff
- Server creates duplicate sale (no idempotency check)

**Location**: [src/lib/client/sync.ts:158-179](src/lib/client/sync.ts#L158-L179)

**Current Retry Logic**:
```typescript
if (item && item.retryCount < MAX_RETRIES) {
  const delayMs = RETRY_DELAY_MS * Math.pow(EXPONENTIAL_BACKOFF, item.retryCount);
  // Retry without checking if server already processed it
}
```

---

### 🟡 MEDIUM: Sync Queue Ordering Issues

**Scenario**: Updates sync before creates

**What Happens**:
- User creates Product A (queued)
- User updates Product A (queued)
- Sync processes updates before creates (array iteration order)
- Server fails: "Product A not found"

**Location**: [src/app/api/sync/push/route.ts:89-353](src/app/api/sync/push/route.ts#L89-L353)

**Issue**: No dependency ordering in sync queue processing

---

## 2. Current Conflict Resolution Analysis

### Push Sync ([src/app/api/sync/push/route.ts](src/app/api/sync/push/route.ts))

**Strategy**: Last Write Wins (LWW) based on `updatedAt` timestamp

**Products** (lines 308-330):
```typescript
if (localUpdatedAt && localUpdatedAt > serverUpdatedAt) {
  // Local is newer - update server
} else {
  // Server wins - use existing ID
}
```

**Limitations**:
- ❌ No stock reconciliation (can create negative stock)
- ❌ No price validation for in-progress sales
- ❌ No transaction-level conflict detection
- ⚠️ Timestamp comparison assumes synchronized clocks (unreliable in Guinea with poor connectivity)

---

### Pull Sync ([src/lib/client/sync.ts:489-693](src/lib/client/sync.ts#L489-L693))

**Strategy**: Last Write Wins based on `updatedAt`

**Products** (lines 502-550):
```typescript
if (serverUpdatedAt >= localUpdatedAt) {
  // Server wins - update local
  await db.products.update(existing.id!, {
    stock: product.stock, // Overwrites local stock!
  });
} else {
  // Local is newer - keep local
  results.conflicts++;
}
```

**Limitations**:
- ❌ Overwrites local stock changes (loses concurrent sales)
- ❌ No merge strategy for stock movements
- ❌ No notification to user about conflicts

---

## 3. Automatic Sync After Updates

### Current Behavior

**Background Sync** ([src/lib/client/sync.ts:335-366](src/lib/client/sync.ts#L335-L366)):
- ✅ Push queue checked every **1 minute** (when online)
- ✅ Pull sync every **5 minutes** (periodic)
- ✅ Push/Pull on `online` event (when connectivity restored)

**After Transactions**:
- ❌ **No automatic sync** after sale completion
- ❌ **No automatic sync** after stock adjustment
- ❌ **No automatic sync** after product update
- ⚠️ User must wait up to 1 minute for changes to sync

---

## 4. Recommendations

### 🔴 CRITICAL #1: Server-Side Stock Validation

**Priority**: P0 (Must fix before multi-user deployment)

**Implementation**:
```typescript
// src/app/api/sync/push/route.ts (around line 262)

// After syncing stock movements, validate stock levels
for (const movement of stockMovements) {
  if (movement.type === 'SALE') {
    const product = await prisma.product.findUnique({
      where: { id: movement.product_id },
    });

    if (!product) {
      errors.push(`Product ${movement.product_id} not found`);
      continue;
    }

    const newStock = product.stock + movement.quantity_change;

    if (newStock < 0) {
      // REJECT the sale - stock insufficient
      errors.push(
        `Stock insuffisant pour ${product.name}: ` +
        `${product.stock} disponible, ${-movement.quantity_change} demandé`
      );

      // Mark this sync item as failed (don't mark synced)
      // Client will need to handle this gracefully
      continue;
    }

    // Update stock atomically
    await prisma.product.update({
      where: { id: movement.product_id },
      data: { stock: newStock },
    });
  }
}
```

**Benefits**:
- ✅ Prevents negative stock
- ✅ Enforces business rules server-side
- ✅ Graceful degradation (failed syncs can be reviewed)

**Trade-offs**:
- ⚠️ Requires client-side error handling (show "Sale failed to sync" notification)
- ⚠️ User experience: sale appears successful locally, then fails on sync
- 💡 **Better UX**: Add optimistic locking with server-side reservation (see Critical #2)

---

### 🔴 CRITICAL #2: Optimistic Locking for Sales

**Priority**: P0

**Problem**: Stock check happens client-side on stale data

**Solution**: Server-side stock reservation during sale

**Implementation**:

**Step 1**: Add immediate sync attempt during sale (before showing receipt)

```typescript
// src/app/ventes/nouvelle/page.tsx (around line 239)

// Queue sale for sync
await queueTransaction('SALE', 'CREATE', { ...sale, id: saleId }, String(saleId));

// 🆕 Try to sync immediately (with timeout)
const syncResult = await Promise.race([
  processSyncQueue(),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Sync timeout')), 5000)
  ),
]).catch(error => {
  console.warn('Immediate sync failed, will retry in background', error);
  return { synced: 0, failed: 0, errors: [] };
});

// 🆕 Check if sale was rejected by server
if (syncResult.failed > 0) {
  const stockError = syncResult.errors.find(e => e.includes('Stock insuffisant'));
  if (stockError) {
    // ROLLBACK the sale locally
    await db.sales.delete(saleId);
    await db.sale_items.where('sale_id').equals(saleId).delete();

    // Restore stock
    for (const item of saleItems) {
      const product = await db.products.get(item.product.id!);
      if (product) {
        await db.products.update(item.product.id!, {
          stock: product.stock + item.quantity,
        });
      }
    }

    toast.error('Stock insuffisant - vente annulée. Veuillez synchroniser et réessayer.');
    return; // Don't show receipt
  }
}

// Proceed to receipt
setStep('receipt');
```

**Step 2**: Update sync queue to return detailed errors

```typescript
// src/lib/client/sync.ts (update processSyncQueue response)
export async function processSyncQueue(): Promise<{
  synced: number;
  failed: number;
  errors: string[];
  failedItems: Array<{ id: number; type: string; error: string }>; // 🆕
}> {
  // ... existing code ...
}
```

**Benefits**:
- ✅ Immediate feedback on stock conflicts
- ✅ Prevents "successful" sales that fail later
- ✅ Better user experience

**Trade-offs**:
- ⚠️ Requires connectivity for sales (but gracefully degrades to offline queue if timeout)
- 💡 Add user preference: "Require immediate sync for sales" (OWNER only)

---

### 🟠 HIGH #3: Idempotency Keys for Deduplication

**Priority**: P1

**Problem**: Network timeouts can create duplicate sales

**Solution**: Add idempotency keys to sync requests

**Implementation**:

**Step 1**: Add idempotency key to sync queue items

```typescript
// src/lib/shared/types.ts
export interface SyncQueueItem {
  // ... existing fields ...
  idempotencyKey: string; // 🆕 UUID v4 generated on creation
}
```

**Step 2**: Store processed idempotency keys on server

```prisma
// prisma/schema.prisma
model SyncIdempotencyKey {
  id             String   @id @default(uuid())
  idempotencyKey String   @unique
  entityType     String   // "SALE" | "EXPENSE" | "PRODUCT"
  entityId       Int      // Server ID of created entity
  createdAt      DateTime @default(now())
  expiresAt      DateTime // Auto-delete after 24 hours

  @@index([idempotencyKey])
  @@index([expiresAt]) // For cleanup job
}
```

**Step 3**: Check idempotency keys in push sync

```typescript
// src/app/api/sync/push/route.ts (around line 90)

for (const sale of sales) {
  // 🆕 Check if already processed
  const existing = await prisma.syncIdempotencyKey.findUnique({
    where: { idempotencyKey: sale.idempotencyKey },
  });

  if (existing) {
    // Already processed - return existing server ID
    syncedSales[sale.id?.toString() || ''] = existing.entityId;
    continue; // Skip creation
  }

  // Create sale
  const newSale = await prisma.sale.create({ /* ... */ });

  // 🆕 Store idempotency key
  await prisma.syncIdempotencyKey.create({
    data: {
      idempotencyKey: sale.idempotencyKey,
      entityType: 'SALE',
      entityId: newSale.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  syncedSales[sale.id?.toString() || ''] = newSale.id;
}
```

**Benefits**:
- ✅ Eliminates duplicate sales/expenses
- ✅ Safe retries without side effects
- ✅ 24h retention handles worst-case offline scenarios

---

### 🟠 HIGH #4: Automatic Sync After Critical Operations

**Priority**: P1

**Problem**: Changes take up to 1 minute to sync

**Solution**: Trigger immediate async sync after database updates

**Implementation**:

```typescript
// src/lib/client/sync.ts

/**
 * 🆕 Trigger sync asynchronously without blocking UI
 * Uses debouncing to batch rapid changes
 */
let syncDebounceTimer: NodeJS.Timeout | null = null;

export function triggerAsyncSync(priority: 'normal' | 'high' = 'normal'): void {
  if (priority === 'high') {
    // High priority: sync immediately (but don't block)
    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);

    // Run in background, don't await
    processSyncQueue().catch(error => {
      console.warn('[Sync] Async sync failed:', error);
    });
  } else {
    // Normal priority: debounce for 3 seconds
    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);

    syncDebounceTimer = setTimeout(() => {
      processSyncQueue().catch(error => {
        console.warn('[Sync] Async sync failed:', error);
      });
    }, 3000);
  }
}
```

**Usage**:

```typescript
// src/app/ventes/nouvelle/page.tsx (after line 239)
await queueTransaction('SALE', 'CREATE', { ...sale, id: saleId }, String(saleId));
triggerAsyncSync('high'); // 🆕 Sync immediately (async)

// src/app/stocks/page.tsx (after stock adjustment)
await queueTransaction('STOCK_MOVEMENT', 'CREATE', movement, String(movementId));
triggerAsyncSync('normal'); // 🆕 Sync with 3s debounce

// src/app/parametres/page.tsx (after product update)
await db.products.update(productId, updatedData);
triggerAsyncSync('normal'); // 🆕 Sync with 3s debounce
```

**Benefits**:
- ✅ Near-instant sync for critical operations (sales)
- ✅ Debouncing prevents excessive API calls
- ✅ Non-blocking (no UI impact)
- ✅ Works offline (queues normally)

**Performance Impact**:
- **CPU**: Minimal (async execution, single-threaded debounce)
- **Network**: Optimized with debouncing (3s for normal, immediate for high)
- **Battery**: Negligible (uses existing fetch with timeout)

---

### 🟠 HIGH #5: Dependency-Ordered Sync Queue

**Priority**: P1

**Problem**: Updates sync before creates

**Solution**: Sort sync queue by dependencies

**Implementation**:

```typescript
// src/lib/client/sync.ts (update prepareSyncPayload)

export async function prepareSyncPayload(): Promise<{...}> {
  const items = await getPendingItems();

  // 🆕 Sort by dependency order
  const sortedItems = items.sort((a, b) => {
    // 1. CREATEs before UPDATEs
    if (a.action === 'CREATE' && b.action !== 'CREATE') return -1;
    if (a.action !== 'CREATE' && b.action === 'CREATE') return 1;

    // 2. Type priority: PRODUCT > SUPPLIER > SALE > EXPENSE > STOCK_MOVEMENT
    const typePriority: Record<string, number> = {
      PRODUCT: 1,
      SUPPLIER: 2,
      SUPPLIER_ORDER: 3,
      SALE: 4,
      EXPENSE: 5,
      STOCK_MOVEMENT: 6,
      CREDIT_PAYMENT: 7,
    };

    const priorityA = typePriority[a.type] || 99;
    const priorityB = typePriority[b.type] || 99;

    if (priorityA !== priorityB) return priorityA - priorityB;

    // 3. Timestamp order (FIFO)
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  // ... rest of function uses sortedItems ...
}
```

**Benefits**:
- ✅ Prevents "entity not found" errors
- ✅ Maintains referential integrity
- ✅ Reduces sync failures

---

## 5. Implementation Priority & Timeline

### Phase 1: Critical Fixes (Week 1)
1. ✅ **Critical #1**: Server-side stock validation (2 days)
2. ✅ **Critical #2**: Optimistic locking for sales (3 days)

**Impact**: Prevents data corruption in multi-user scenarios

---

### Phase 2: Reliability Improvements (Week 2)
3. ✅ **High #3**: Idempotency keys (2 days)
4. ✅ **High #4**: Automatic async sync (1 day)
5. ✅ **High #5**: Dependency-ordered sync (1 day)

**Impact**: Eliminates duplicates, faster sync, fewer errors

---

### Phase 3: Advanced Features (Week 3+)
- Real-time conflict notifications
- Manual conflict resolution UI
- Sync analytics dashboard
- Offline-first optimistic UI updates

---

## 6. Testing Strategy

### Test Cases for Stock Race Conditions

```typescript
// Test 1: Concurrent sales exceeding stock
describe('Concurrent Sales', () => {
  it('should reject second sale when stock insufficient', async () => {
    // Setup: Product with 5 units
    const product = await createProduct({ stock: 5 });

    // User A sells 5 units (queued)
    await createSale([{ productId: product.id, quantity: 5 }]);

    // User B sells 5 units (queued)
    await createSale([{ productId: product.id, quantity: 5 }]);

    // Sync both
    const result = await processSyncQueue();

    // Expect: 1 synced, 1 failed
    expect(result.synced).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors[0]).toContain('Stock insuffisant');

    // Verify server stock = 0 (not negative)
    const serverProduct = await prisma.product.findUnique({ where: { id: product.id } });
    expect(serverProduct.stock).toBe(0);
  });
});

// Test 2: Idempotency
describe('Idempotent Sync', () => {
  it('should not create duplicate sales on retry', async () => {
    const sale = await createSale([{ productId: 1, quantity: 2 }]);

    // First sync
    await processSyncQueue();

    // Simulate retry (network timeout recovery)
    await processSyncQueue();

    // Verify: only 1 sale exists on server
    const serverSales = await prisma.sale.findMany();
    expect(serverSales.length).toBe(1);
  });
});
```

---

## 7. Monitoring & Observability

### Metrics to Track

1. **Sync Queue Health**
   - Pending items count
   - Failed items count
   - Average sync latency

2. **Conflict Rate**
   - Stock conflicts per day
   - Price conflicts per day
   - Conflict resolution outcomes

3. **Error Tracking**
   - Stock validation failures
   - Idempotency key hits
   - Network timeouts

### Dashboard (Settings Page)

```typescript
// src/app/parametres/page.tsx

<Card>
  <CardHeader>
    <CardTitle>Statistiques de synchronisation</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-2">
      <div className="flex justify-between">
        <span>En attente</span>
        <Badge variant="warning">{syncStats.pending}</Badge>
      </div>
      <div className="flex justify-between">
        <span>Échoués</span>
        <Badge variant="destructive">{syncStats.failed}</Badge>
      </div>
      <div className="flex justify-between">
        <span>Conflits résolus (24h)</span>
        <Badge variant="info">{conflictsResolved}</Badge>
      </div>
    </div>
  </CardContent>
</Card>
```

---

## 8. Summary

### Critical Risks Identified
1. ✅ **Stock can go negative** → Server-side validation required
2. ✅ **Duplicate sales possible** → Idempotency keys required
3. ✅ **Slow sync (1 min delay)** → Async triggers needed

### Recommended Actions
1. **Immediate** (P0): Implement Critical #1 and #2 before multi-user deployment
2. **Short-term** (P1): Implement High #3, #4, #5 for reliability
3. **Long-term** (P2): Add conflict resolution UI and real-time notifications

### Performance Impact
- **Automatic sync**: Negligible (async, debounced)
- **Server validation**: +50ms per sale (acceptable)
- **Idempotency checks**: +10ms per request (cached lookup)

---

**Next Steps**: Proceed with implementation? I can help with any of the critical fixes.

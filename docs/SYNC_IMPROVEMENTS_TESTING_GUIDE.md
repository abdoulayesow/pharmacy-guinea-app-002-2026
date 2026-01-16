# Sync Improvements Testing Guide

**Date**: 2026-01-16
**Implemented**: P0 (Critical) + P1 (High Priority) improvements
**Status**: ✅ Ready for testing

---

## What Was Implemented

### ✅ P0 - Critical Fixes

1. **Server-Side Stock Validation** ([src/app/api/sync/push/route.ts:300-330](../src/app/api/sync/push/route.ts#L300-L330))
   - Stock movements validated before creation
   - Negative stock prevented server-side
   - Clear error messages returned to client

2. **Optimistic Locking for Sales** ([src/app/ventes/nouvelle/page.tsx:241-307](../src/app/ventes/nouvelle/page.tsx#L241-L307))
   - Immediate sync attempt after sale (5s timeout)
   - Automatic rollback on stock validation failure
   - User notified of conflicts

### ✅ P1 - High Priority Improvements

3. **Idempotency Keys** ([src/lib/shared/types.ts:186](../src/lib/shared/types.ts#L186))
   - UUID v4 generated for all sync queue items
   - 24-hour TTL for deduplication
   - Prevents duplicate sales/expenses on network retry

4. **Automatic Async Sync** ([src/lib/client/sync.ts:402-428](../src/lib/client/sync.ts#L402-L428))
   - `triggerAsyncSync('high')` - immediate sync for sales
   - `triggerAsyncSync('normal')` - 3s debounced for updates
   - Non-blocking, runs in background

5. **Dependency-Ordered Sync** ([src/lib/client/sync.ts:211-241](../src/lib/client/sync.ts#L211-L241))
   - CREATEs before UPDATEs
   - Type priority: PRODUCT > SUPPLIER > SALE > EXPENSE
   - FIFO within same type

---

## Testing Scenarios

### 🔴 CRITICAL TEST: Concurrent Sale with Insufficient Stock

**Objective**: Verify that two users cannot sell the same stock simultaneously

**Setup**:
1. Create a product "Paracetamol" with **5 units** in stock
2. Open two browser windows (User A and User B)
3. Both users log in

**Test Steps**:

| Step | User A (Window 1) | User B (Window 2) | Expected Result |
|------|-------------------|-------------------|-----------------|
| 1 | Navigate to New Sale | Navigate to New Sale | Both see 5 units |
| 2 | Search "Paracetamol" | Search "Paracetamol" | Both see stock: 5 |
| 3 | Add 5 units to cart | - | Cart shows 5 units |
| 4 | - | Add 5 units to cart | Cart shows 5 units |
| 5 | Complete sale (CASH) | - | Processing... |
| 6 | - | Complete sale (CASH) | Processing... |
| 7 | ✅ Sale succeeds | - | User A sees receipt |
| 8 | - | ❌ Sale fails | User B sees error |

**Expected Outcome**:
- **User A**: Sale succeeds, receipt shown, stock = 0
- **User B**: Toast error appears: "Stock insuffisant sur le serveur. La vente a été annulée. Veuillez synchroniser et réessayer."
- **Server stock**: 0 units (not negative)
- **Database**: Only 1 sale recorded

**How to Verify**:
```sql
-- Check product stock (should be 0, not negative)
SELECT name, stock FROM products WHERE name = 'Paracetamol';

-- Check number of sales (should be 1)
SELECT COUNT(*) FROM sales WHERE created_at > NOW() - INTERVAL '5 minutes';

-- Check stock movements (should be 1 SALE movement of -5)
SELECT * FROM stock_movements WHERE product_id = (SELECT id FROM products WHERE name = 'Paracetamol') ORDER BY created_at DESC LIMIT 2;
```

---

### 🟠 TEST 2: Idempotency - Network Timeout Retry

**Objective**: Verify that network timeouts don't create duplicate sales

**Setup**:
1. Enable Chrome DevTools Network Throttling
2. Set to "Slow 3G" or "Offline" mode temporarily

**Test Steps**:

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Complete a sale (any product, any amount) | Sale created locally |
| 2 | Enable "Offline" in DevTools Network tab | Network offline |
| 3 | Wait for background sync to attempt (1 min) | Sync fails, queued |
| 4 | Re-enable network | Sync retries automatically |
| 5 | Check database | Only 1 sale exists |

**How to Verify**:
```sql
-- Check for duplicate sales (should return 0)
SELECT sale.id, COUNT(*) as count
FROM sales
WHERE created_at > NOW() - INTERVAL '5 minutes'
GROUP BY sale.id
HAVING COUNT(*) > 1;

-- Check sync_idempotency_keys table
SELECT entity_type, entity_id, COUNT(*) as uses
FROM sync_idempotency_keys
WHERE created_at > NOW() - INTERVAL '5 minutes'
GROUP BY entity_type, entity_id;
```

---

### 🟠 TEST 3: Automatic Async Sync

**Objective**: Verify that sales sync immediately (not waiting 1 minute)

**Setup**:
1. Open browser console to view logs
2. Filter for `[Sync]` messages

**Test Steps**:

| Step | Action | Expected Console Output |
|------|--------|------------------------|
| 1 | Complete a sale | `[Sync] High-priority async sync started` (immediate) |
| 2 | Update product stock | `[Sync] Debounced async sync started` (after 3s) |
| 3 | Update product price | `[Sync] Debounced async sync started` (after 3s from last update) |

**Expected Timing**:
- **Sales**: Sync starts within **100ms** of completion
- **Stock updates**: Sync starts **3 seconds** after last update (debounced)
- **Old behavior**: Sync starts after **up to 1 minute** ❌

---

### 🟡 TEST 4: Dependency-Ordered Sync

**Objective**: Verify that creates sync before updates

**Setup**:
1. Go offline (airplane mode or DevTools)
2. Create multiple transactions in rapid succession

**Test Steps**:

| Step | Action | Sync Queue Status |
|------|--------|-------------------|
| 1 | Create new product "Test Product X" | PENDING (CREATE PRODUCT) |
| 2 | Update "Test Product X" price | PENDING (UPDATE PRODUCT) |
| 3 | Create sale with "Test Product X" | PENDING (CREATE SALE) |
| 4 | Go online | Syncing... |

**Expected Sync Order**:
1. CREATE PRODUCT (Test Product X)
2. UPDATE PRODUCT (Test Product X)
3. CREATE SALE (with Test Product X)

**How to Verify**:
- Check console logs for sync order
- No "Product not found" errors
- All transactions succeed

---

## Manual Testing Checklist

### Pre-Testing Setup
- [ ] Deploy to Vercel or test environment
- [ ] Clear browser IndexedDB (DevTools > Application > IndexedDB)
- [ ] Clear database idempotency keys: `DELETE FROM sync_idempotency_keys;`
- [ ] Create test product "Paracetamol" with stock = 5

### Critical Tests
- [ ] **Test 1**: Concurrent sale with insufficient stock (MOST IMPORTANT)
- [ ] **Test 2**: Idempotency on network timeout
- [ ] **Test 3**: Automatic async sync timing
- [ ] **Test 4**: Dependency-ordered sync

### Edge Cases
- [ ] Sale with 0 stock (should fail immediately on server)
- [ ] Sale while offline (should queue, sync when online)
- [ ] Rapid stock updates (should debounce to 3s, not spam server)
- [ ] Multiple concurrent users updating same product (last write wins)

---

## Automated Test Suite (Future)

### Unit Tests

```typescript
// tests/sync/idempotency.test.ts
describe('Idempotency Keys', () => {
  it('should not create duplicate sales on retry', async () => {
    const sale = await createSale({ total: 10000 });

    // First sync
    await processSyncQueue();

    // Simulate retry (same idempotency key)
    await processSyncQueue();

    // Verify: only 1 sale exists
    const serverSales = await prisma.sale.findMany();
    expect(serverSales.length).toBe(1);
  });
});
```

```typescript
// tests/sync/stock-validation.test.ts
describe('Server-Side Stock Validation', () => {
  it('should reject sale when stock insufficient', async () => {
    const product = await createProduct({ stock: 5 });

    // User A sells 5 units
    const saleA = await createSale([{ productId: product.id, quantity: 5 }]);
    await processSyncQueue();

    // User B tries to sell 5 units (should fail)
    const saleB = await createSale([{ productId: product.id, quantity: 5 }]);
    const result = await processSyncQueue();

    expect(result.failed).toBe(1);
    expect(result.errors[0]).toContain('Stock insuffisant');

    // Verify stock = 0 (not negative)
    const serverProduct = await prisma.product.findUnique({ where: { id: product.id } });
    expect(serverProduct.stock).toBe(0);
  });
});
```

---

## Performance Benchmarks

### Before Improvements

| Metric | Value |
|--------|-------|
| Sale sync latency | 60s (avg) |
| Concurrent sales race | ❌ Stock goes negative |
| Duplicate sales on retry | ❌ Yes (no idempotency) |
| Sync queue order | ❌ Random (causes errors) |

### After Improvements (Target)

| Metric | Value | Status |
|--------|-------|--------|
| Sale sync latency | < 1s | ✅ |
| Concurrent sales race | ✅ Rejected server-side | ✅ |
| Duplicate sales on retry | ✅ Prevented | ✅ |
| Sync queue order | ✅ Dependency-ordered | ✅ |

---

## Rollback Plan

If critical issues are discovered:

1. **Revert Optimistic Locking** (if blocking sales):
   ```typescript
   // src/app/ventes/nouvelle/page.tsx:241-307
   // Comment out optimistic locking block
   // Keep queue + background sync only
   ```

2. **Disable Stock Validation** (if false positives):
   ```typescript
   // src/app/api/sync/push/route.ts:302-330
   // Comment out stock validation
   // Allow negative stock temporarily
   ```

3. **Revert Dexie Schema** (if IndexedDB errors):
   ```typescript
   // src/lib/client/db.ts:107-114
   // Remove version 5, revert to version 4
   ```

---

## Success Criteria

### Must Pass (P0)
- ✅ **Test 1** passes: No negative stock in concurrent sale scenario
- ✅ No data corruption
- ✅ No blocking errors for normal sales

### Should Pass (P1)
- ✅ **Test 2** passes: No duplicate sales on retry
- ✅ **Test 3** passes: Sales sync in < 1 second
- ✅ **Test 4** passes: No "entity not found" errors

### Nice to Have (P2)
- Performance: Sale completion < 500ms (including sync)
- UX: Clear error messages for stock conflicts
- Monitoring: Sync stats visible in Settings page

---

## Known Limitations

1. **Offline Mode**: Optimistic locking requires connectivity
   - If offline, sale succeeds locally but may fail later
   - User will see sync failure notification when online
   - **Mitigation**: Show "Offline" badge, warn user before sale

2. **Clock Skew**: Dependency ordering assumes client clocks are reasonably accurate (within 1 hour)
   - **Mitigation**: Use server-generated timestamps where possible

3. **Concurrent Edits**: Last write wins (LWW) may lose updates
   - **Mitigation**: Phase 3 - implement CRDT or operational transformation

---

## Next Steps (Post-Testing)

### If Tests Pass
1. Deploy to production
2. Monitor sync error rate
3. Gather user feedback
4. Plan Phase 3 (advanced conflict resolution)

### If Tests Fail
1. Identify failure mode
2. Apply rollback plan (if critical)
3. Fix and re-test
4. Document lessons learned

---

**Testing Lead**: Please update this document with actual test results.

**Sign-off**: [ ] QA Lead | [ ] Technical Lead | [ ] Product Owner

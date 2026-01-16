# Concurrent Stock Update Test Guide

## Purpose
Verify that the stock transaction log pattern prevents data loss from concurrent updates.

## Test Scenario

**Problem being tested:**
- User A sells 10 units → stock should be 90
- User B sells 5 units → stock should be 85
- **Expected**: Final stock = 85 ✅
- **Old bug**: Final stock = 95 ❌ (lost 10 units)

---

## Prerequisites

1. ✅ Dev server running (`npm run dev`)
2. ✅ PostgreSQL seeded with products
3. ✅ Two browsers (or incognito + normal)
4. ✅ Owner account: marsow07@gmail.com

---

## Test Steps

### Setup (5 min)

1. **Open Browser A** (Chrome normal)
   - Go to http://localhost:3000
   - Open DevTools → Application → IndexedDB
   - Delete `seri-db` database
   - Open DevTools → Console (watch logs)

2. **Open Browser B** (Chrome incognito)
   - Go to http://localhost:3000
   - Open DevTools → Application → IndexedDB
   - Delete `seri-db` database
   - Open DevTools → Console (watch logs)

3. **Login both browsers**
   - Login as marsow07@gmail.com (OWNER)
   - Wait for initial sync to complete
   - Check console: `[AuthGuard] ✅ Initial sync success`

4. **Verify starting stock**
   - In Browser A: Go to Stocks page
   - Find "Paracetamol 500mg" (should have stock = 100)
   - **Record starting stock**: ___________

---

### Test 1: Concurrent Sales (CRITICAL)

**Simulate two users selling the same product simultaneously**

1. **Browser A: Create Sale (DON'T SYNC)**
   - Go to "Nouvelle Vente"
   - Search: "Paracetamol"
   - Add to cart: Quantity = 10
   - Complete sale (Cash)
   - **DON'T go to Settings yet** (keep offline)
   - Console should show: `[Sale] Created sale #1`

2. **Browser B: Create Sale (DON'T SYNC)**
   - Go to "Nouvelle Vente"
   - Search: "Paracetamol"
   - Add to cart: Quantity = 5
   - Complete sale (Cash)
   - **DON'T go to Settings yet** (keep offline)
   - Console should show: `[Sale] Created sale #1`

3. **Verify Local Stock (before sync)**
   - Browser A → Stocks page → Paracetamol: **Should show 90** ✅
   - Browser B → Stocks page → Paracetamol: **Should show 95** ✅
   - Both are correct locally (each applied their own movement)

4. **Browser A: Sync to Server**
   - Go to Settings page
   - Wait 5 seconds (auto-sync should trigger)
   - Or manually trigger sync (if available)
   - Console should show:
     ```
     [Sync] Pushing 1 sales, 1 stock movements
     [Sync] ✅ Push success: 2 synced
     ```

5. **Browser B: Sync to Server**
   - Go to Settings page
   - Wait 5 seconds (auto-sync should trigger)
   - Console should show:
     ```
     [Sync] Pushing 1 sales, 1 stock movements
     [Sync] ✅ Push success: 2 synced
     [Sync] ✅ Pull success: X records updated
     ```

6. **Verify Final Stock (CRITICAL)**
   - Browser A → Stocks page → Paracetamol: **Expected: 85** ✅
   - Browser B → Stocks page → Paracetamol: **Expected: 85** ✅
   - Both should show the same value after sync

   **🚨 If stock is NOT 85, the fix has a bug!**

---

### Test 2: Stock Movement Audit Trail

**Verify movements are preserved as audit trail**

1. **Check IndexedDB in Browser A**
   - DevTools → Application → IndexedDB → seri-db → stock_movements
   - Should see 2 movements:
     - `{ product_id: X, quantity_change: -10, synced: true }`
     - `{ product_id: X, quantity_change: -5, synced: true }`

2. **Verify movements are marked synced**
   - Both movements should have `synced: true`
   - This prevents double-counting

---

### Test 3: Offline Resilience

**Test that local changes show immediately**

1. **Browser A: Go offline**
   - DevTools → Network tab → Set "Offline"
   - Or: Disable network in browser

2. **Create another sale**
   - Paracetamol: Quantity = 3
   - Complete sale
   - **Expected stock**: 85 - 3 = 82 ✅

3. **Verify calculated stock**
   - Stock should show 82 immediately
   - Even though not synced yet
   - Console: Check calculated stock includes unsynced movement

4. **Go back online**
   - Enable network
   - Wait for auto-sync (5 seconds)
   - Stock should remain 82 ✅

---

## Expected Results Summary

| Stage | Browser A Stock | Browser B Stock | Server Stock | Status |
|-------|----------------|----------------|--------------|--------|
| Initial | 100 | 100 | 100 | ✅ |
| A sells 10 (offline) | 90 | 100 | 100 | ✅ |
| B sells 5 (offline) | 90 | 95 | 100 | ✅ |
| A syncs | 90 | 95 | 90 | ✅ |
| B syncs | 85 | 85 | 85 | ✅ CRITICAL |
| A sells 3 (offline) | 82 | 85 | 85 | ✅ |
| A syncs | 82 | 82 | 82 | ✅ |

---

## What to Look For

### ✅ Success Indicators

1. **Final stock is 85** after both users sync (not 90 or 95)
2. **Stock movements preserved** in IndexedDB with `synced: true`
3. **Console shows no errors** during sync
4. **Both browsers show same stock** after sync
5. **Unsynced changes visible immediately** (optimistic UI)

### ❌ Failure Indicators

1. **Final stock is 90 or 95** → One sale was lost (bug!)
2. **Stock movements not marked synced** → Will be double-counted
3. **Console errors** about stock validation
4. **Browsers show different stock** after sync
5. **Stock doesn't update** when offline

---

## Debugging

### If Final Stock is Wrong

1. **Check stock movements in IndexedDB**
   ```
   stock_movements table → Filter by product_id
   Count: Should be 2 movements (-10, -5)
   synced: Should be true for both
   ```

2. **Check console logs**
   ```
   Search for: "[Sync]"
   Look for: "Push success", "Pull success"
   Errors: Stock validation, merge conflicts
   ```

3. **Check calculated stock logic**
   ```javascript
   // In browser console:
   const movements = await db.stock_movements.where('product_id').equals(1).toArray();
   const unsynced = movements.filter(m => !m.synced);
   console.log('Total movements:', movements.length);
   console.log('Unsynced movements:', unsynced.length);
   console.log('Total change:', movements.reduce((s, m) => s + m.quantity_change, 0));
   ```

4. **Check server stock**
   ```sql
   -- In PostgreSQL:
   SELECT id, name, stock FROM "Product" WHERE name LIKE '%Paracetamol%';

   SELECT * FROM "StockMovement"
   WHERE "productId" = (SELECT id FROM "Product" WHERE name LIKE '%Paracetamol%')
   ORDER BY "createdAt" DESC;
   ```

---

## Advanced Test: Triple Concurrent

**Test 3 users selling simultaneously**

1. Open 3 browsers
2. Each sells different quantities: 10, 5, 3
3. Sync in order: A → B → C
4. **Expected final stock**: 100 - 10 - 5 - 3 = 82 ✅

---

## Rollback Test

**Test that failed syncs rollback correctly**

1. Create sale offline (10 units)
2. Manually fail sync by:
   - Stopping dev server, OR
   - Going to Network tab → Block API requests
3. Verify sale stays in sync queue
4. Re-enable network
5. Verify sync completes successfully

---

## Performance Test

**Ensure stock calculation is fast**

1. Create 100+ products
2. Create 1000+ stock movements
3. Measure time to load Stocks page
4. **Target**: < 500ms for stock calculation

---

## Test Results

**Date**: _________________
**Tester**: _________________

| Test | Result | Notes |
|------|--------|-------|
| Concurrent Sales (Test 1) | ☐ Pass ☐ Fail | Final stock: _____ |
| Audit Trail (Test 2) | ☐ Pass ☐ Fail | Movements synced: _____ |
| Offline Resilience (Test 3) | ☐ Pass ☐ Fail | |
| Triple Concurrent | ☐ Pass ☐ Fail | |
| Rollback Test | ☐ Pass ☐ Fail | |
| Performance Test | ☐ Pass ☐ Fail | Time: _____ ms |

**Overall Status**: ☐ All Pass ☐ Issues Found

**Issues / Notes**:
```
[Write any issues or observations here]
```

---

## Related Files

- [src/lib/client/db.ts](../src/lib/client/db.ts#L185-L241) - Stock calculation helpers
- [src/app/ventes/nouvelle/page.tsx](../src/app/ventes/nouvelle/page.tsx#L81-L115) - Calculated stock in sales
- [src/lib/client/sync.ts](../src/lib/client/sync.ts#L150-L158) - Mark movements as synced
- [src/app/api/sync/push/route.ts](../src/app/api/sync/push/route.ts#L350-L354) - Server stock update

---

## Quick Verification Command

Run this in browser console to check stock calculation:

```javascript
// Check product stock calculation
(async () => {
  const db = (await import('/src/lib/client/db.js')).db;
  const productId = 1; // Paracetamol ID

  const product = await db.products.get(productId);
  const movements = await db.stock_movements.where('product_id').equals(productId).toArray();
  const unsyncedMovements = movements.filter(m => !m.synced);

  console.log('=== Stock Calculation Debug ===');
  console.log('Product base stock:', product.stock);
  console.log('Total movements:', movements.length);
  console.log('Unsynced movements:', unsyncedMovements.length);
  console.log('Unsynced total:', unsyncedMovements.reduce((s, m) => s + m.quantity_change, 0));
  console.log('Calculated stock:', product.stock + unsyncedMovements.reduce((s, m) => s + m.quantity_change, 0));
})();
```

# Push Sync Verification Test Plan - FEFO Phase 3

**Date**: 2026-01-17
**Objective**: Verify that product batch quantity changes sync correctly from IndexedDB to PostgreSQL

---

## Prerequisites

- ✅ FEFO batch deduction logic working (verified in [session summary](summaries/2026-01-17_fefo-phase-3-push-sync-verification.md))
- ✅ Product batch ID mapping fixed (commit `9c5b33e`)
- ✅ Push sync endpoint implemented ([src/app/api/sync/push/route.ts:466-552](../src/app/api/sync/push/route.ts#L466-L552))
- ✅ Sync UI ready in Settings page ([src/app/parametres/page.tsx:584](../src/app/parametres/page.tsx#L584))

---

## Test Data Setup

From previous session testing, we have:

| Product | Batch | Lot Number | Quantity | Expiration | Status |
|---------|-------|------------|----------|------------|--------|
| Paracétamol 500mg | Batch 1 | LOT-2026-001 | **0 units** | 5 days | Fully depleted |
| Paracétamol 500mg | Batch 2 | LOT-2026-002 | **50 units** | 45 days | Available |
| Paracétamol 500mg | Batch 3 | LOT-2026-003 | **20 units** | 120 days | Available |

**Note**: Batch 1 is already depleted from previous testing.

---

## Test Procedure

### Step 1: Record Current State

**Action**: Check current batch quantities in IndexedDB

**Method**: Navigate to `/test-db` diagnostic page

**Expected Result**:
```
Batch 1 (LOT-2026-001): 0 units
Batch 2 (LOT-2026-002): 50 units
Batch 3 (LOT-2026-003): 20 units
```

**Verification**: ✅ / ❌

---

### Step 2: Check Sync Queue Before Sale

**Action**: Open browser DevTools console and run:
```javascript
(async () => {
  const { db } = await import('./src/lib/client/db');
  const pending = await db.sync_queue.where('status').equals('PENDING').toArray();
  console.log('Pending sync items:', pending.length);
  pending.forEach(item => console.log(`- ${item.type}: ${item.action}`));
})();
```

**Expected Result**: May show some pending items from previous activity

**Verification**: ✅ / ❌
**Pending Count**: ______

---

### Step 3: Create Test Sale to Trigger Batch Deduction

**Action**: Make a sale of Paracétamol 500mg (quantity: 15 units)

**Navigation**:
1. Go to `/ventes/nouvelle` (New Sale page)
2. Search for "Paracétamol 500mg"
3. Add 15 units to cart
4. Complete payment (Cash)

**Expected Behavior**:
- FEFO logic selects Batch 2 (LOT-2026-002) since Batch 1 is depleted
- Batch 2 quantity: 50 → **35 units**
- Sale creates sync queue items:
  - SALE (CREATE)
  - SALE_ITEM (CREATE)
  - PRODUCT_BATCH (UPDATE) ← **This is what we're testing**

**Verification**: ✅ / ❌

---

### Step 4: Verify Batch Deduction in IndexedDB

**Action**: Return to `/test-db` page and refresh

**Expected Result**:
```
Batch 1 (LOT-2026-001): 0 units (unchanged)
Batch 2 (LOT-2026-002): 35 units (50 - 15)  ← Deducted
Batch 3 (LOT-2026-003): 20 units (unchanged)
```

**Verification**: ✅ / ❌

---

### Step 5: Check Sync Queue After Sale

**Action**: In DevTools console, run:
```javascript
(async () => {
  const { db } = await import('./src/lib/client/db');
  const pending = await db.sync_queue
    .where('status')
    .anyOf(['PENDING', 'FAILED'])
    .toArray();

  console.log('Total pending items:', pending.length);

  const batchUpdates = pending.filter(item => item.type === 'PRODUCT_BATCH');
  console.log('Product batch updates:', batchUpdates.length);

  batchUpdates.forEach(item => {
    console.log('Batch update:', {
      localId: item.localId,
      quantity: item.payload.quantity,
      lotNumber: item.payload.lot_number,
      idempotencyKey: item.idempotencyKey
    });
  });
})();
```

**Expected Result**:
- At least 1 pending PRODUCT_BATCH update
- Payload shows quantity = 35
- Idempotency key present

**Verification**: ✅ / ❌
**Product Batch Updates Count**: ______

---

### Step 6: Navigate to Settings Page

**Action**: Go to `/parametres` (Settings)

**Expected UI State**:
- "Synchroniser maintenant" button enabled (if online)
- Pending sync count displayed (e.g., "3 changements en attente")
- Last sync time shown (if any previous syncs)

**Verification**: ✅ / ❌
**Pending Count in UI**: ______

---

### Step 7: Manually Trigger Push Sync

**Action**: Click "Synchroniser maintenant" button

**Expected Behavior**:
1. Button shows "Synchronisation en cours..." with spinner
2. Request sent to `/api/sync/push`
3. Server processes batch update
4. Sync queue items marked as `SYNCED`
5. Button returns to "Synchroniser maintenant"
6. Pending count drops to 0

**Monitoring**: Open Network tab in DevTools to observe:
- `POST /api/sync/push` request
- Response should show `success: true`

**Verification**: ✅ / ❌
**Sync Duration**: ______ seconds

---

### Step 8: Verify Sync Queue Cleared

**Action**: In DevTools console, run:
```javascript
(async () => {
  const { db } = await import('./src/lib/client/db');
  const pending = await db.sync_queue
    .where('status')
    .equals('PENDING')
    .toArray();

  const synced = await db.sync_queue
    .where('status')
    .equals('SYNCED')
    .toArray();

  console.log('Pending:', pending.length);
  console.log('Synced:', synced.length);

  // Check if product batch got serverId mapped
  const batch2 = await db.product_batches
    .where('lot_number')
    .equals('LOT-2026-002')
    .first();

  console.log('Batch 2 details:', {
    quantity: batch2?.quantity,
    serverId: batch2?.serverId,
    synced: batch2?.synced
  });
})();
```

**Expected Result**:
- Pending: 0
- Synced: 3+ (including batch update)
- Batch 2: `serverId` populated, `synced: true`

**Verification**: ✅ / ❌

---

### Step 9: Verify PostgreSQL Database (Optional - Requires Database Access)

**Action**: Connect to Neon PostgreSQL and run:
```sql
-- Check product batch quantity in PostgreSQL
SELECT
  pb.id,
  pb.lot_number,
  pb.quantity,
  pb.initial_qty,
  pb.updated_at,
  p.name AS product_name
FROM product_batches pb
JOIN products p ON pb.product_id = p.id
WHERE pb.lot_number = 'LOT-2026-002';
```

**Expected Result**:
```
id | lot_number    | quantity | initial_qty | product_name
---|---------------|----------|-------------|----------------
 2 | LOT-2026-002  | 35       | 50          | Paracétamol 500mg
```

**Verification**: ✅ / ❌

**Alternative (No DB Access)**: Use `/api/sync/pull` to verify:
```javascript
fetch('/api/sync/pull', { credentials: 'include' })
  .then(r => r.json())
  .then(data => {
    const batch2 = data.data.productBatches.find(b => b.lot_number === 'LOT-2026-002');
    console.log('Server batch 2:', batch2);
  });
```

---

### Step 10: Test Multi-Device Sync (Optional - Advanced)

**Action**:
1. Open app in second browser (or incognito window)
2. Login with same account
3. Initial sync should pull batch quantity changes
4. Navigate to `/test-db` in second browser

**Expected Result**: Batch 2 shows **35 units** (not 50)

**Verification**: ✅ / ❌

---

## Expected Test Results Summary

| Step | Description | Status | Notes |
|------|-------------|--------|-------|
| 1 | Record current state | ⏸️ | Baseline data |
| 2 | Check sync queue before | ⏸️ | May have pending items |
| 3 | Create test sale | ⏸️ | 15 units of Paracétamol |
| 4 | Verify batch deduction | ⏸️ | Batch 2: 50 → 35 |
| 5 | Check sync queue after | ⏸️ | PRODUCT_BATCH update queued |
| 6 | Navigate to Settings | ⏸️ | UI shows pending count |
| 7 | Trigger push sync | ⏸️ | Manual sync via button |
| 8 | Verify queue cleared | ⏸️ | 0 pending, serverId mapped |
| 9 | Verify PostgreSQL | ⏸️ | Batch quantity = 35 |
| 10 | Multi-device sync | ⏸️ | Optional |

---

## Success Criteria

### Critical (Must Pass)
- ✅ Batch quantity deduction works (50 → 35)
- ✅ PRODUCT_BATCH sync queue item created
- ✅ Push sync completes without errors
- ✅ Sync queue shows 0 pending after push
- ✅ Batch has `serverId` populated and `synced: true`

### Important (Should Pass)
- ✅ Settings UI shows correct pending count
- ✅ Sync duration < 5 seconds
- ✅ No JavaScript errors in console

### Nice to Have (Optional)
- ✅ PostgreSQL database shows correct quantity
- ✅ Multi-device sync propagates changes

---

## Known Issues & Edge Cases

### Already Identified
1. **Date Type Handling**: Fixed in commit `9c5b33e` - dates now safely converted
2. **Product ID Mapping**: Fixed in commit `9c5b33e` - server IDs mapped correctly

### Potential Edge Cases to Watch
1. **Multiple Batches Deducted**: Sale quantity > single batch (e.g., 55 units)
   - Should create multiple PRODUCT_BATCH updates
   - All should sync successfully

2. **Offline Sale**: Create sale while offline
   - Batch updates queued
   - Should sync on reconnection

3. **Concurrent Sales**: Two users selling from same batch
   - Last Write Wins conflict resolution
   - May need manual reconciliation

4. **Batch Depletion**: Batch quantity reaches 0
   - Should sync correctly
   - Batch should remain in database with quantity=0

---

## Troubleshooting

### Issue: Sync Queue Not Creating Batch Updates
**Symptom**: No PRODUCT_BATCH items in sync queue after sale

**Diagnosis**:
```javascript
// Check if sale actually deducted batch
const sale = await db.sales.orderBy('created_at').reverse().first();
const saleItems = await db.sale_items.where('sale_id').equals(sale.id).toArray();
console.log('Sale items:', saleItems.map(i => ({
  product_id: i.product_id,
  product_batch_id: i.product_batch_id,  // ← Should NOT be null
  quantity: i.quantity
})));
```

**Fix**: Check [src/app/ventes/nouvelle/page.tsx](../src/app/ventes/nouvelle/page.tsx) - ensure `selectBatchForSale()` is called

---

### Issue: Push Sync Fails with 400/500 Error
**Symptom**: `/api/sync/push` returns error

**Diagnosis**: Check Network tab response body

**Common Causes**:
1. Product ID mismatch (local ID sent instead of server ID)
2. Missing idempotency key
3. Invalid date format

**Fix**: Check [src/app/api/sync/push/route.ts:466-552](../src/app/api/sync/push/route.ts#L466-L552) logs

---

### Issue: Batch Not Marked as Synced
**Symptom**: `synced: false` after push sync

**Diagnosis**:
```javascript
const batch = await db.product_batches.where('lot_number').equals('LOT-2026-002').first();
console.log('Batch sync status:', {
  synced: batch.synced,
  serverId: batch.serverId,
  updatedAt: batch.updatedAt
});
```

**Fix**: Check [src/lib/client/sync.ts:354-381](../src/lib/client/sync.ts#L354-L381) - `markSynced()` logic

---

## Next Steps After Verification

### If All Tests Pass ✅
1. Update FEFO implementation status in CLAUDE.md
2. Create git commit for any fixes
3. Proceed to Phase 3 UX improvements:
   - Expiration alerts
   - Dashboard widget
   - Batch history tracking

### If Tests Fail ❌
1. Document failure details (step, error message, console logs)
2. Identify root cause using troubleshooting section
3. Fix issue
4. Re-run verification from Step 1

---

## Automated Verification Script

Save this as `scripts/verify-push-sync.js` for quick testing:

```javascript
/**
 * Push Sync Verification Script
 *
 * Usage:
 * 1. Make a sale first (15 units of Paracétamol)
 * 2. Run this in browser console before push sync
 * 3. Trigger push sync via Settings page
 * 4. Run this again after sync completes
 */

(async () => {
  const { db } = await import('./src/lib/client/db.js');

  console.log('=== Push Sync Verification ===\n');

  // 1. Batch quantities
  console.log('📦 Product Batches:');
  const batches = await db.product_batches
    .where('product_id')
    .equals(17)  // Paracétamol product ID
    .toArray();

  batches.forEach(b => {
    console.log(`  ${b.lot_number}: ${b.quantity}/${b.initial_qty} units (exp: ${new Date(b.expiration_date).toLocaleDateString('fr-FR')})`);
    console.log(`    synced: ${b.synced}, serverId: ${b.serverId || 'null'}`);
  });

  // 2. Sync queue status
  console.log('\n📋 Sync Queue:');
  const pending = await db.sync_queue
    .where('status')
    .anyOf(['PENDING', 'FAILED'])
    .toArray();

  const synced = await db.sync_queue
    .where('status')
    .equals('SYNCED')
    .toArray();

  console.log(`  Pending: ${pending.length}`);
  console.log(`  Synced: ${synced.length}`);

  const batchUpdates = pending.filter(i => i.type === 'PRODUCT_BATCH');
  if (batchUpdates.length > 0) {
    console.log(`\n  🔄 Batch Updates (${batchUpdates.length}):`);
    batchUpdates.forEach(item => {
      console.log(`    - Lot: ${item.payload.lot_number}, Qty: ${item.payload.quantity}`);
    });
  }

  // 3. Recent sales
  console.log('\n🛒 Recent Sales (last 5):');
  const recentSales = await db.sales
    .orderBy('created_at')
    .reverse()
    .limit(5)
    .toArray();

  for (const sale of recentSales) {
    const items = await db.sale_items.where('sale_id').equals(sale.id).toArray();
    console.log(`  Sale #${sale.id}: ${sale.total} GNF (${items.length} items)`);
    items.forEach(item => {
      console.log(`    - Product ${item.product_id}, Qty: ${item.quantity}, Batch: ${item.product_batch_id || 'N/A'}`);
    });
  }

  console.log('\n=== End Verification ===');
})();
```

---

**Test Status**: ⏸️ Ready to execute
**Estimated Duration**: 10-15 minutes
**Last Updated**: 2026-01-17

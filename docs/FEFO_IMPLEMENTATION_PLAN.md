# FEFO Phase 3 - Implementation Plan

**Date:** 2026-01-17
**Status:** Ready for Implementation
**Priority:** P0 - Critical for pharmacy compliance
**Estimated Time:** 6-9 hours (Phase 1 only)

---

## Table of Contents

1. [Implementation Overview](#implementation-overview)
2. [Pre-Implementation Checklist](#pre-implementation-checklist)
3. [Phase 1: Critical Gaps](#phase-1-critical-gaps)
4. [Phase 2: ID Mapping Fixes](#phase-2-id-mapping-fixes)
5. [Testing Strategy](#testing-strategy)
6. [Rollback Plan](#rollback-plan)

---

## Implementation Overview

### Current State

✅ **What's Ready (90%):**
- Schemas defined (Prisma + IndexedDB)
- Sync mechanism working (push/pull/conflict resolution)
- ID mapping logic correct where implemented
- UI components exist for all flows
- `selectBatchForSale()` helper function already written

❌ **What's Missing (10%):**
- Batch creation in delivery confirmation
- FEFO integration in sales flow
- Complete sync queue preparation

### Success Criteria

**Phase 1 Completion:**
- [ ] ProductBatch records are created when supplier orders are delivered
- [ ] Sales deduct from oldest batches first (FEFO)
- [ ] Sale items track which batch was sold (`product_batch_id`)
- [ ] All entities (batches, orders, items) sync to server
- [ ] No data loss in offline/online transitions
- [ ] Push sync test passes (batch changes appear in PostgreSQL)

### Architecture Reference

See [docs/SUPPLIER_STOCK_INTEGRATION_ARCHITECTURE.md](SUPPLIER_STOCK_INTEGRATION_ARCHITECTURE.md) for complete architecture details.

---

## Pre-Implementation Checklist

### 1. Environment Setup

- [ ] Branch created: `feature/phase-3-fefo-batch-tracking-implementation`
- [ ] Local database backed up
- [ ] PostgreSQL database accessible
- [ ] Test data available (supplier orders, products)

### 2. Documentation Review

- [ ] Read [SUPPLIER_STOCK_INTEGRATION_ARCHITECTURE.md](SUPPLIER_STOCK_INTEGRATION_ARCHITECTURE.md)
- [ ] Understand ID mapping logic (client IDs vs server IDs)
- [ ] Review sync mechanism (push/pull flow)
- [ ] Understand FEFO algorithm (`selectBatchForSale`)

### 3. Testing Preparation

- [ ] Test supplier order created (with delivery items)
- [ ] Test products exist for delivery confirmation
- [ ] Browser DevTools open (IndexedDB inspection)
- [ ] PostgreSQL client ready (verify sync results)

---

## Phase 1: Critical Gaps

**Goal:** Enable basic FEFO functionality

**Estimated Time:** 6-9 hours

### Task 1.1: Add Batch Creation in Delivery Confirmation

**Estimated Time:** 2-3 hours

#### File to Modify

`src/app/fournisseurs/commande/[id]/page.tsx`

#### Current Code (Lines ~341-360)

```typescript
// Update existing product stock
const product = await db.products.get(productId);
const newStock = product.stock + deliveryItem.receivedQuantity;

await db.products.update(productId, {
  stock: newStock,
  expirationDate: deliveryItem.expirationDate, // ❌ Overwrites old expiration
  lotNumber: deliveryItem.lotNumber,           // ❌ Overwrites old lot
});
```

#### New Code (To Add After Stock Update)

```typescript
// Update existing product stock
const product = await db.products.get(productId);
const newStock = product.stock + deliveryItem.receivedQuantity;

await db.products.update(productId, {
  stock: newStock,
  // ✅ Remove expirationDate and lotNumber (use batches instead)
});

// ✅ Step 2: Create ProductBatch (NEW)
const batchId = await db.product_batches.add({
  product_id: productId,
  lot_number: deliveryItem.lotNumber || generateLotNumber(order.id!, productId),
  expiration_date: new Date(deliveryItem.expirationDate),
  quantity: deliveryItem.receivedQuantity,
  initial_qty: deliveryItem.receivedQuantity,
  unit_cost: deliveryItem.unitPrice,
  supplier_order_id: order.id,
  received_date: new Date(),
  synced: false,
});

console.log(`[FEFO] Created batch ${batchId} for product ${productId}: ${deliveryItem.lotNumber}, expires ${deliveryItem.expirationDate}, qty ${deliveryItem.receivedQuantity}`);

// ✅ Step 3: Queue batch for sync (NEW)
await queueTransaction('PRODUCT_BATCH', 'CREATE', {
  id: batchId,
  product_id: productId,
  lot_number: deliveryItem.lotNumber || generateLotNumber(order.id!, productId),
  expiration_date: deliveryItem.expirationDate,
  quantity: deliveryItem.receivedQuantity,
  initial_qty: deliveryItem.receivedQuantity,
  unit_cost: deliveryItem.unitPrice,
  supplier_order_id: order.id,
  received_date: new Date(),
});

console.log(`[FEFO] Queued batch ${batchId} for sync`);
```

#### Helper Function (Add Before `handleConfirmDelivery`)

```typescript
/**
 * Generate a unique lot number if not provided
 * Format: LOT-YYYYMMDD-OrderID-Random3
 * Example: LOT-20260117-5-834
 */
function generateLotNumber(orderId: number, productId: number | null): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `LOT-${year}${month}${day}-${orderId}-${random}`;
}
```

#### Verification Steps

1. **Before Delivery:**
   ```javascript
   // In Browser DevTools Console:
   const db = window.db;
   const batchesBefore = await db.product_batches.toArray();
   console.log('Batches before:', batchesBefore.length);
   ```

2. **Confirm Delivery:**
   - Navigate to supplier order detail page
   - Fill delivery quantities
   - Click "Confirmer la réception"

3. **After Delivery:**
   ```javascript
   const batchesAfter = await db.product_batches.toArray();
   console.log('Batches after:', batchesAfter.length);
   console.log('New batches:', batchesAfter.filter(b => !batchesBefore.find(old => old.id === b.id)));
   ```

4. **Verify Batch Data:**
   ```javascript
   const batch = batchesAfter[batchesAfter.length - 1];
   console.log('Last batch:', {
     product_id: batch.product_id,
     lot_number: batch.lot_number,
     expiration_date: batch.expiration_date,
     quantity: batch.quantity,
     supplier_order_id: batch.supplier_order_id,
     synced: batch.synced, // Should be false
   });
   ```

5. **Verify Sync Queue:**
   ```javascript
   const syncQueue = await db.sync_queue
     .where('type').equals('PRODUCT_BATCH')
     .filter(item => item.status === 'PENDING')
     .toArray();
   console.log('Queued batches:', syncQueue.length);
   console.log('Last queued batch:', syncQueue[syncQueue.length - 1]);
   ```

**Expected Result:**
- ✅ New `ProductBatch` record created in IndexedDB
- ✅ Batch has correct `product_id`, `lot_number`, `expiration_date`, `quantity`
- ✅ Batch links to `supplier_order_id`
- ✅ Batch queued for sync (`sync_queue` has PRODUCT_BATCH item)
- ✅ Product stock updated correctly

---

### Task 1.2: Implement FEFO in Sales Flow

**Estimated Time:** 3-4 hours

#### Files to Modify

**Primary:**
- `src/app/ventes/nouvelle/page.tsx` (new sale)
- `src/app/ventes/credit/page.tsx` (credit sale)

**Helper (Already Exists):**
- `src/lib/client/db.ts:285-322` (selectBatchForSale function)

#### Current Code Pattern (Multiple Files)

```typescript
// ❌ WRONG: Direct product stock deduction
const handleCompleteSale = async () => {
  for (const item of cartItems) {
    const product = await db.products.get(item.productId);
    await db.products.update(item.productId, {
      stock: product.stock - item.quantity, // No batch tracking
    });

    await db.sale_items.add({
      sale_id: saleId,
      product_id: item.productId,
      // product_batch_id: undefined (not set!)
      quantity: item.quantity,
      unit_price: item.unitPrice,
      subtotal: item.subtotal,
    });
  }
};
```

#### New Code (FEFO Implementation)

```typescript
// ✅ CORRECT: FEFO batch deduction
const handleCompleteSale = async () => {
  for (const item of cartItems) {
    console.log(`[FEFO] Processing sale for product ${item.productId}, qty ${item.quantity}`);

    // ✅ Step 1: Select batches using FEFO (oldest expiration first)
    const batchAllocations = await selectBatchForSale(item.productId, item.quantity);

    if (batchAllocations.insufficientStock) {
      toast.error(
        `Stock insuffisant pour ${item.productName}. ` +
        `Disponible: ${item.quantity - batchAllocations.shortfall}, ` +
        `Demandé: ${item.quantity}`
      );
      throw new Error(`Stock insuffisant pour ${item.productName}`);
    }

    console.log(`[FEFO] Allocated ${batchAllocations.allocations.length} batches for ${item.productName}`);

    // ✅ Step 2: Deduct from each batch
    for (const allocation of batchAllocations.allocations) {
      const batch = await db.product_batches.get(allocation.batchId);

      if (!batch) {
        console.error(`[FEFO] Batch ${allocation.batchId} not found!`);
        continue;
      }

      const newQuantity = batch.quantity - allocation.quantity;

      console.log(`[FEFO] Deducting ${allocation.quantity} from batch ${allocation.batchId} (${batch.lot_number}): ${batch.quantity} → ${newQuantity}`);

      await db.product_batches.update(allocation.batchId, {
        quantity: newQuantity,
        synced: false, // Mark for sync
      });

      // ✅ Queue batch update for sync
      await queueTransaction('PRODUCT_BATCH', 'UPDATE', {
        id: allocation.batchId,
        serverId: batch.serverId, // Important for server update
        product_id: batch.product_id,
        quantity: newQuantity,
        updatedAt: new Date(),
      });

      // ✅ Create sale item WITH batch tracking
      await db.sale_items.add({
        sale_id: saleId,
        product_id: item.productId,
        product_batch_id: allocation.batchId, // ✅ Track which batch
        quantity: allocation.quantity,
        unit_price: item.unitPrice,
        subtotal: item.unitPrice * allocation.quantity,
      });

      console.log(`[FEFO] Created sale item with batch ${allocation.batchId}`);
    }

    // ✅ Step 3: Update product aggregate stock
    const product = await db.products.get(item.productId);
    await db.products.update(item.productId, {
      stock: product.stock - item.quantity,
    });

    console.log(`[FEFO] Updated product ${item.productId} stock: ${product.stock} → ${product.stock - item.quantity}`);
  }
};
```

#### Import Required Function

At the top of the file:

```typescript
import { selectBatchForSale } from '@/lib/client/db';
```

#### Verification Steps

1. **Before Sale:**
   ```javascript
   // Check batches for a product
   const productId = 17; // Replace with actual product ID
   const batches = await db.product_batches
     .where('product_id').equals(productId)
     .filter(b => b.quantity > 0)
     .toArray();

   console.log('Batches before sale:', batches.map(b => ({
     id: b.id,
     lot: b.lot_number,
     expiry: b.expiration_date,
     qty: b.quantity,
   })));
   ```

2. **Create Sale:**
   - Add product to cart
   - Enter quantity
   - Complete sale

3. **After Sale:**
   ```javascript
   const batchesAfter = await db.product_batches
     .where('product_id').equals(productId)
     .toArray();

   console.log('Batches after sale:', batchesAfter.map(b => ({
     id: b.id,
     lot: b.lot_number,
     expiry: b.expiration_date,
     qty: b.quantity,
   })));
   ```

4. **Verify Sale Items:**
   ```javascript
   const saleItems = await db.sale_items
     .where('sale_id').equals(saleId)
     .toArray();

   console.log('Sale items:', saleItems.map(si => ({
     product_id: si.product_id,
     product_batch_id: si.product_batch_id, // ✅ Should NOT be undefined
     quantity: si.quantity,
   })));
   ```

5. **Verify FEFO Order:**
   ```javascript
   // Verify oldest batch was depleted first
   const oldestBatch = batches.sort((a, b) =>
     new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime()
   )[0];

   const oldestBatchAfter = batchesAfter.find(b => b.id === oldestBatch.id);

   console.log('Oldest batch before:', oldestBatch.quantity);
   console.log('Oldest batch after:', oldestBatchAfter?.quantity);
   console.log('✅ FEFO working:', oldestBatchAfter.quantity < oldestBatch.quantity);
   ```

**Expected Result:**
- ✅ Oldest batches are depleted first (FEFO)
- ✅ Multiple batches may be used for a single sale item
- ✅ `sale_items.product_batch_id` is set (not undefined)
- ✅ Batch quantities updated correctly
- ✅ Batch updates queued for sync

---

### Task 1.3: Complete Sync Queue Preparation

**Estimated Time:** 1-2 hours

#### File to Modify

`src/lib/client/sync.ts`

#### Current Code (Lines 214-304)

```typescript
async function prepareSyncPayload(items: SyncQueueItem[]): Promise<SyncPushRequest> {
  const sales: any[] = [];
  const saleItems: any[] = [];
  const expenses: any[] = [];
  const stockMovements: any[] = [];
  const products: any[] = [];
  const productBatches: any[] = [];
  // ❌ MISSING: suppliers, supplierOrders, etc.

  for (const item of items) {
    const payloadWithKey = {
      ...item.payload,
      idempotencyKey: item.idempotencyKey,
    };

    switch (item.type) {
      case 'SALE':
        sales.push(payloadWithKey);
        break;
      case 'EXPENSE':
        expenses.push(payloadWithKey);
        break;
      case 'PRODUCT':
        products.push(payloadWithKey);
        break;
      case 'PRODUCT_BATCH':
        productBatches.push(payloadWithKey);
        break;
      case 'STOCK_MOVEMENT':
        stockMovements.push(payloadWithKey);
        break;
      // ❌ MISSING CASES
    }
  }

  return {
    sales,
    saleItems,
    expenses,
    products,
    productBatches,
    stockMovements,
    // ❌ MISSING: suppliers, supplierOrders, etc.
  };
}
```

#### New Code (Complete Implementation)

```typescript
async function prepareSyncPayload(items: SyncQueueItem[]): Promise<SyncPushRequest> {
  const sales: any[] = [];
  const saleItems: any[] = [];
  const expenses: any[] = [];
  const stockMovements: any[] = [];
  const products: any[] = [];
  const productBatches: any[] = [];
  const suppliers: any[] = [];
  const supplierOrders: any[] = [];
  const supplierOrderItems: any[] = [];
  const supplierReturns: any[] = [];
  const productSuppliers: any[] = [];
  const creditPayments: any[] = [];

  for (const item of items) {
    const payloadWithKey = {
      ...item.payload,
      idempotencyKey: item.idempotencyKey,
    };

    switch (item.type) {
      case 'SALE':
        sales.push(payloadWithKey);
        break;
      case 'EXPENSE':
        expenses.push(payloadWithKey);
        break;
      case 'PRODUCT':
        products.push(payloadWithKey);
        break;
      case 'PRODUCT_BATCH':
        productBatches.push(payloadWithKey);
        break;
      case 'STOCK_MOVEMENT':
        stockMovements.push(payloadWithKey);
        break;
      // ✅ ADD MISSING CASES:
      case 'SUPPLIER':
        suppliers.push(payloadWithKey);
        break;
      case 'SUPPLIER_ORDER':
        supplierOrders.push(payloadWithKey);
        break;
      case 'SUPPLIER_ORDER_ITEM':
        supplierOrderItems.push(payloadWithKey);
        break;
      case 'SUPPLIER_RETURN':
        supplierReturns.push(payloadWithKey);
        break;
      case 'PRODUCT_SUPPLIER':
        productSuppliers.push(payloadWithKey);
        break;
      case 'CREDIT_PAYMENT':
        creditPayments.push(payloadWithKey);
        break;
      default:
        console.warn(`[Sync] Unknown queue item type: ${item.type}`);
    }
  }

  console.log('[Sync] Prepared payload:', {
    sales: sales.length,
    saleItems: saleItems.length,
    expenses: expenses.length,
    stockMovements: stockMovements.length,
    products: products.length,
    productBatches: productBatches.length,
    suppliers: suppliers.length,
    supplierOrders: supplierOrders.length,
    supplierOrderItems: supplierOrderItems.length,
    supplierReturns: supplierReturns.length,
    productSuppliers: productSuppliers.length,
    creditPayments: creditPayments.length,
  });

  return {
    sales,
    saleItems,
    expenses,
    products,
    productBatches,
    stockMovements,
    suppliers,
    supplierOrders,
    supplierOrderItems,
    supplierReturns,
    productSuppliers,
    creditPayments,
  };
}
```

#### Update Return Type

Find the `SyncPushRequest` type definition in `src/lib/shared/types.ts` and verify it includes all entity arrays:

```typescript
export interface SyncPushRequest {
  sales?: any[];
  saleItems?: any[];
  expenses?: any[];
  stockMovements?: any[];
  products?: any[];
  productBatches?: any[];
  suppliers?: any[];
  supplierOrders?: any[];
  supplierOrderItems?: any[];
  supplierReturns?: any[];
  productSuppliers?: any[];
  creditPayments?: any[];
}
```

#### Verification Steps

1. **Check Sync Queue:**
   ```javascript
   const allQueued = await db.sync_queue.where('status').equals('PENDING').toArray();
   const byType = allQueued.reduce((acc, item) => {
     acc[item.type] = (acc[item.type] || 0) + 1;
     return acc;
   }, {});
   console.log('Queued items by type:', byType);
   ```

2. **Trigger Sync:**
   - Navigate to Settings page (`/parametres`)
   - Click "Synchroniser maintenant" button
   - Watch console for prepared payload log

3. **Verify All Types Synced:**
   ```javascript
   // After sync completes
   const stillPending = await db.sync_queue.where('status').equals('PENDING').toArray();
   console.log('Still pending:', stillPending.length);
   console.log('Pending items:', stillPending.map(i => ({ type: i.type, id: i.id })));
   ```

**Expected Result:**
- ✅ All entity types are included in sync payload
- ✅ Console shows counts for all entity types
- ✅ No "Unknown queue item type" warnings
- ✅ Pending count decreases to 0 after successful sync

---

## Phase 2: ID Mapping Fixes

**Estimated Time:** 5 hours (defer to later if needed)

### Task 2.1: Fix ProductBatch product_id Mapping in Push Sync

**File:** `src/app/api/sync/push/route.ts`

**Current Code (Line ~482):**

```typescript
const serverProductId = syncedProducts[batch.product_id?.toString() || ''] || batch.product_id;
```

**Issue:** Fails if product wasn't synced in the same batch

**Fix:**

```typescript
// Look up product serverId from local database first
let serverProductId = syncedProducts[batch.product_id?.toString() || ''];

if (!serverProductId) {
  // Product not in current sync batch - look up in database
  const localProduct = await db.products.get(batch.product_id);
  serverProductId = localProduct?.serverId || batch.product_id;
}

if (!serverProductId) {
  errors.push(`Product ${batch.product_id} has no serverId for batch ${batch.id}`);
  continue;
}
```

**Note:** This requires importing `db` in server route, which is not allowed. Instead, we should ensure products are always synced before batches (handled by sync queue priority).

**Alternative Fix:** Ensure sync queue sorts items by dependency (already implemented in lines 214-224).

---

### Task 2.2: Add supplier_order_id Mapping

**Files:**
- `src/app/api/sync/push/route.ts` (push sync)
- `src/lib/client/sync.ts` (pull sync merge)

**Current:** `supplier_order_id` is not mapped (uses local ID on client, PostgreSQL ID on server)

**Fix:** Same pattern as `product_id` mapping (map using `serverId`)

**Implementation:** See architecture doc for details.

---

## Testing Strategy

### Unit Tests (Optional)

```typescript
// Test FEFO algorithm
describe('selectBatchForSale', () => {
  it('should select oldest batch first', async () => {
    // Create 3 batches with different expiration dates
    // Request quantity that requires 2 batches
    // Verify oldest 2 batches are selected
  });

  it('should return insufficient stock error', async () => {
    // Create batches with total qty < requested
    // Verify insufficientStock flag is true
  });
});
```

### Integration Tests

**Test 1: Batch Creation Flow**
1. Create supplier order with 3 items
2. Confirm delivery
3. Verify 3 batches created in IndexedDB
4. Verify batches queued for sync
5. Trigger sync
6. Verify batches appear in PostgreSQL

**Test 2: FEFO Sales Flow**
1. Create product with 3 batches (different expiration dates)
2. Make sale for quantity requiring 2 batches
3. Verify oldest 2 batches depleted
4. Verify sale items have correct batch_id
5. Trigger sync
6. Verify batch quantities updated in PostgreSQL

**Test 3: Multi-Device Sync**
1. Create batch on Device A
2. Sync to server
3. Pull sync on Device B
4. Verify batch appears on Device B with correct IDs
5. Make sale on Device B using batch
6. Sync to server
7. Pull sync on Device A
8. Verify sale and batch update appear on Device A

### Manual Testing Checklist

- [ ] Batch creation works offline
- [ ] Batch creation syncs when online
- [ ] FEFO sales work offline
- [ ] FEFO sales sync when online
- [ ] Multi-batch sales work correctly
- [ ] Insufficient stock error shown correctly
- [ ] Expiring batch warnings shown (if implemented)
- [ ] Batch history visible in product details (if implemented)
- [ ] No console errors
- [ ] No data loss

---

## Rollback Plan

### If Issues Arise

**Step 1: Identify Issue**
- Check console errors
- Check sync queue status
- Check PostgreSQL for duplicate/invalid data

**Step 2: Stop Sync**
- Navigate to Settings
- Disable background sync temporarily
- Clear pending sync queue if needed:
  ```javascript
  await db.sync_queue.where('status').equals('FAILED').delete();
  ```

**Step 3: Rollback Code**
```bash
git checkout main
git branch -D feature/phase-3-fefo-batch-tracking-implementation
```

**Step 4: Clean Database**
- IndexedDB: Clear `product_batches` table
- PostgreSQL: Run cleanup SQL if needed

### Data Recovery

If data is corrupted:

1. **Restore from backup:**
   ```bash
   # IndexedDB: Clear browser storage and re-sync
   # PostgreSQL: Restore from snapshot
   ```

2. **Re-sync from server:**
   ```javascript
   // Clear local data
   await db.product_batches.clear();
   await db.sync_queue.where('type').equals('PRODUCT_BATCH').delete();

   // Trigger full sync
   await performFirstTimeSync();
   ```

---

## Next Steps After Phase 1

1. **Test thoroughly** (2-3 hours)
2. **Fix any bugs** (varies)
3. **Update documentation** (1 hour)
4. **Create pull request**
5. **Code review**
6. **Deploy to staging**
7. **User acceptance testing**
8. **Deploy to production**

---

## Success Metrics

**Phase 1 Success:**
- [ ] 100% batch creation rate (every delivery creates batches)
- [ ] 100% FEFO compliance (sales always use oldest batches)
- [ ] 0% data loss (all batches sync correctly)
- [ ] 0 critical bugs
- [ ] < 500ms performance impact on sales flow

**Phase 2 Success:**
- [ ] 100% ID mapping accuracy
- [ ] 0 orphaned records
- [ ] Multi-device sync working

---

## Contact & Support

**Questions:** Review [SUPPLIER_STOCK_INTEGRATION_ARCHITECTURE.md](SUPPLIER_STOCK_INTEGRATION_ARCHITECTURE.md)

**Issues:** Check browser console, IndexedDB inspector, and PostgreSQL logs

**Rollback:** Follow rollback plan above

---

**Status:** Ready for implementation ✅

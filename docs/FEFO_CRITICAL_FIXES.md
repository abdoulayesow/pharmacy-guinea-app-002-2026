# FEFO Phase 3 - Critical Implementation Fixes

**Status**: 🚧 90% infrastructure ready, 3 critical gaps identified
**Priority**: P0 (Blocking FEFO functionality)
**Estimated Time**: 6-9 hours total

---

## Overview

Based on [SUPPLIER_STOCK_INTEGRATION_ARCHITECTURE.md](SUPPLIER_STOCK_INTEGRATION_ARCHITECTURE.md) and [FEFO_IMPLEMENTATION_PLAN.md](FEFO_IMPLEMENTATION_PLAN.md), the FEFO system has the following status:

✅ **Completed**:
- Product batch schema (IndexedDB + PostgreSQL)
- Batch selection algorithm (`selectBatchForSale()`)
- Sync mechanism (push/pull)
- Product ID mapping (serverId)
- Date handling fixes

❌ **Missing** (3 critical gaps):
1. Batch creation in supplier order delivery
2. FEFO integration in sales flow
3. Sync queue completion for supplier entities

---

## Gap #1: Batch Creation Missing in Delivery Confirmation

**File**: [src/app/fournisseurs/commande/[id]/page.tsx](../src/app/fournisseurs/commande/[id]/page.tsx#L240-L447)
**Function**: `handleConfirmDelivery()`
**Lines**: 240-447

### Current Behavior

When confirming a supplier order delivery, the code:
1. ✅ Updates product stock (`product.stock += receivedQuantity`)
2. ✅ Creates stock movement record
3. ❌ **NEVER creates ProductBatch records**

**Impact**: Batches never get created, so FEFO logic has no data to work with.

### Root Cause

Lines 325-341 update product stock directly but don't create batches:

```typescript
// Current code (INCORRECT):
const product = await db.products.get(productId);
if (product) {
  const newStock = product.stock + deliveryItem.receivedQuantity;

  await db.products.update(productId, {
    stock: newStock,
    synced: false,
    updatedAt: new Date(),
  });

  // ❌ NO BATCH CREATION HERE!
}
```

### Required Fix

**Step 1**: Import batch utilities
```typescript
// Add to top of file
import { generateLocalId } from '@/lib/shared/utils';
```

**Step 2**: Add `db.product_batches` to transaction
```typescript
// Line 255 - Update transaction stores array:
await db.transaction(
  'rw',
  [
    db.products,
    db.supplier_order_items,
    db.product_suppliers,
    db.stock_movements,
    db.supplier_orders,
    db.product_batches,  // ← ADD THIS
    db.sync_queue
  ],
  async () => {
    // ...
  }
);
```

**Step 3**: Create batch after stock update (insert after line 341)

```typescript
// After product stock update (line 341):
await db.products.update(productId, productUpdates);

// 🆕 CREATE PRODUCT BATCH
const newBatch = await db.product_batches.add({
  product_id: productId,
  lot_number: deliveryItem.lotNumber || `LOT-${Date.now()}-${productId}`, // Generate if not provided
  expiration_date: deliveryItem.expirationDate
    ? new Date(deliveryItem.expirationDate)
    : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Default: 1 year from now
  quantity: deliveryItem.receivedQuantity, // Current quantity
  initial_qty: deliveryItem.receivedQuantity, // Original quantity
  unit_cost: deliveryItem.unitPrice,
  supplier_order_id: order.id,
  received_date: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  synced: false,
});

// Queue batch for sync
await queueTransaction('PRODUCT_BATCH', 'CREATE', {
  id: newBatch,
  product_id: productId,
  lot_number: deliveryItem.lotNumber || `LOT-${Date.now()}-${productId}`,
  expiration_date: deliveryItem.expirationDate
    ? new Date(deliveryItem.expirationDate)
    : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  quantity: deliveryItem.receivedQuantity,
  initial_qty: deliveryItem.receivedQuantity,
  unit_cost: deliveryItem.unitPrice,
  supplier_order_id: order.id,
  received_date: new Date(),
});
```

### Verification Steps

1. Open app at `/fournisseurs`
2. View existing supplier order
3. Click "Recevoir" button
4. Confirm delivery with lot number + expiration date
5. Run in console:
```javascript
(async () => {
  const { db } = await import('/src/lib/client/db.js');
  const batches = await db.product_batches.toArray();
  console.log('Product batches:', batches);
  // Should show newly created batch
})();
```

**Expected Result**: New batch record created with correct `lot_number`, `expiration_date`, and `quantity`.

---

## Gap #2: FEFO Not Integrated in Sales Flow

**Files**: Multiple sale creation flows
**Impact**: Sales deduct from `product.stock` directly, not from batches in FEFO order

### Affected Files

1. [src/app/ventes/nouvelle/page.tsx](../src/app/ventes/nouvelle/page.tsx) - Main sale flow
2. [src/app/dashboard/page.tsx](../src/app/dashboard/page.tsx) - Quick sale widget (if exists)

### Current Behavior

```typescript
// Current code (INCORRECT):
const product = await db.products.get(productId);
await db.products.update(productId, {
  stock: product.stock - quantity,  // ❌ Direct stock deduction
});
```

### Required Fix

**Step 1**: Import batch selection utility
```typescript
// Add to top of file
import { selectBatchForSale } from '@/lib/client/db';
```

**Step 2**: Replace direct stock deduction with FEFO batch selection

```typescript
// Find where sale items are created (search for "db.sale_items.add")
// Replace stock deduction logic with:

for (const item of saleItems) {
  const product = await db.products.get(item.productId);

  if (!product) {
    throw new Error(`Produit ${item.productId} introuvable`);
  }

  // 🆕 Use FEFO batch selection
  const batchDeduction = await selectBatchForSale(item.productId, item.quantity);

  if (!batchDeduction.success) {
    throw new Error(`Stock insuffisant pour ${product.name}: ${batchDeduction.error}`);
  }

  // Update product total stock
  await db.products.update(item.productId, {
    stock: product.stock - item.quantity,
    synced: false,
    updatedAt: new Date(),
  });

  // Create sale item with batch tracking
  await db.sale_items.add({
    sale_id: saleId,
    product_id: item.productId,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    subtotal: item.subtotal,
    product_batch_id: batchDeduction.batchesUsed[0]?.batchId || null, // Track first batch used
  });

  // Queue batch updates for sync
  for (const batchUpdate of batchDeduction.batchesUsed) {
    const batch = await db.product_batches.get(batchUpdate.batchId);
    if (batch) {
      await queueTransaction('PRODUCT_BATCH', 'UPDATE', {
        id: batch.id,
        product_id: batch.product_id,
        lot_number: batch.lot_number,
        expiration_date: batch.expiration_date,
        quantity: batch.quantity, // Updated quantity after deduction
        initial_qty: batch.initial_qty,
        unit_cost: batch.unit_cost,
        supplier_order_id: batch.supplier_order_id,
        received_date: batch.received_date,
        createdAt: batch.createdAt,
        updatedAt: new Date(),
      });
    }
  }
}
```

### Where to Find Sale Creation Logic

**Method 1: Search for sale creation**
```bash
# In terminal:
grep -r "db.sales.add" src/app/ventes
```

**Method 2: Look for payment completion**
```javascript
// Search for this pattern:
const saleId = await db.sales.add({
  total: ...,
  payment_method: ...,
  // ...
});
```

**Expected Location**: [src/app/ventes/nouvelle/page.tsx](../src/app/ventes/nouvelle/page.tsx) around line 150-250 (exact line varies)

### Verification Steps

1. Create sale of 15 units of Paracétamol
2. Run verification script:
```javascript
(async () => {
  const { db } = await import('/src/lib/client/db.js');

  // Check last sale
  const sale = await db.sales.orderBy('created_at').reverse().first();
  const items = await db.sale_items.where('sale_id').equals(sale.id).toArray();

  console.log('Sale items:');
  items.forEach(item => {
    console.log(`  Product ${item.product_id}: ${item.quantity} units`);
    console.log(`  Batch tracked: ${item.product_batch_id ? 'YES ✓' : 'NO ✗'}`);
  });

  // Check batch quantities
  const batches = await db.product_batches.toArray();
  console.log('\nBatch quantities:');
  batches.forEach(b => {
    console.log(`  ${b.lot_number}: ${b.quantity}/${b.initial_qty} units`);
  });
})();
```

**Expected Result**:
- Sale item has `product_batch_id` populated
- Oldest batch quantity reduced by sale amount

---

## Gap #3: Sync Queue Incomplete for Supplier Entities

**File**: [src/lib/client/sync.ts](../src/lib/client/sync.ts#L214-L304)
**Function**: `prepareSyncPayload()`
**Lines**: 214-304

### Current Behavior

The function handles these entity types:
- ✅ SALE
- ✅ EXPENSE
- ✅ PRODUCT
- ✅ PRODUCT_BATCH
- ✅ STOCK_MOVEMENT
- ❌ SUPPLIER (not handled)
- ❌ SUPPLIER_ORDER (not handled)
- ❌ SUPPLIER_ORDER_ITEM (not handled)
- ❌ SUPPLIER_RETURN (not handled)
- ❌ PRODUCT_SUPPLIER (not handled)
- ❌ CREDIT_PAYMENT (not handled)

### Required Fix

**Location**: Line 272-289 in `prepareSyncPayload()` switch statement

**Add missing cases**:

```typescript
// After existing cases (line 289):
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

  // 🆕 ADD THESE CASES:
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
}
```

**Also update function signature** (line 214):

```typescript
export async function prepareSyncPayload(): Promise<{
  sales: Array<Sale & { id: string; idempotencyKey: string }>;
  saleItems: Array<SaleItem & { id: string }>;
  expenses: Array<Expense & { id: string; idempotencyKey: string }>;
  products: Array<Product & { id: string; idempotencyKey: string }>;
  productBatches: any[];
  stockMovements: any[];
  suppliers: any[];              // ← ADD
  supplierOrders: any[];         // ← ADD
  supplierOrderItems: any[];     // ← ADD
  supplierReturns: any[];        // ← ADD
  productSuppliers: any[];       // ← ADD
  creditPayments: any[];         // ← ADD
}> {
```

**Initialize arrays** (line 257):

```typescript
const sales: any[] = [];
const saleItems: any[] = [];
const expenses: any[] = [];
const products: any[] = [];
const productBatches: any[] = [];
const stockMovements: any[] = [];
const suppliers: any[] = [];              // ← ADD
const supplierOrders: any[] = [];         // ← ADD
const supplierOrderItems: any[] = [];     // ← ADD
const supplierReturns: any[] = [];        // ← ADD
const productSuppliers: any[] = [];       // ← ADD
const creditPayments: any[] = [];         // ← ADD
```

**Return all arrays** (line 303):

```typescript
return {
  sales,
  saleItems,
  expenses,
  products,
  productBatches,
  stockMovements,
  suppliers,              // ← ADD
  supplierOrders,         // ← ADD
  supplierOrderItems,     // ← ADD
  supplierReturns,        // ← ADD
  productSuppliers,       // ← ADD
  creditPayments          // ← ADD
};
```

### Verification Steps

1. Create supplier order and confirm delivery (Gap #1 must be fixed first)
2. Open Settings page (`/parametres`)
3. Check pending sync count (should show queued supplier entities)
4. Trigger manual sync
5. Check PostgreSQL database:
```sql
SELECT * FROM suppliers WHERE name = 'Test Supplier';
SELECT * FROM supplier_orders WHERE supplier_id = ...;
SELECT * FROM supplier_order_items WHERE order_id = ...;
```

**Expected Result**: All supplier-related entities sync to PostgreSQL without errors.

---

## Implementation Order

**Recommended sequence** (dependencies matter):

1. **Gap #3 first** (30 min) - Enable sync for supplier entities
   - Low risk, no UI changes
   - Unblocks testing of Gap #1

2. **Gap #1 second** (3-4 hours) - Add batch creation in delivery
   - Creates test data for Gap #2
   - Can verify batches sync correctly

3. **Gap #2 last** (3-4 hours) - Integrate FEFO in sales
   - Depends on batches existing (from Gap #1)
   - Most complex integration

---

## Testing Strategy

### Unit Testing (Console)

After each gap fix, run verification script:

**Gap #1 verification**:
```javascript
// After delivery confirmation
const batches = await db.product_batches.toArray();
console.log('Batches created:', batches.length); // Should be > 0
```

**Gap #2 verification**:
```javascript
// After sale creation
const lastSale = await db.sales.orderBy('created_at').reverse().first();
const items = await db.sale_items.where('sale_id').equals(lastSale.id).toArray();
console.log('Items with batch tracking:', items.filter(i => i.product_batch_id).length);
```

**Gap #3 verification**:
```javascript
// After sync
const pendingSuppliers = await db.sync_queue
  .where('type')
  .equals('SUPPLIER')
  .toArray();
console.log('Supplier sync items:', pendingSuppliers.length);
```

### Integration Testing (Manual)

**End-to-End FEFO Flow**:

1. Create supplier order with 3 products
2. Confirm delivery with lot numbers + expiration dates
3. Verify batches created in `/test-db` page
4. Create sale (15 units of oldest-expiring product)
5. Verify batch quantity reduced (FEFO order)
6. Trigger sync from Settings page
7. Check PostgreSQL for synced batches

---

## Rollback Plan

If any fix causes issues:

1. **Immediate**: Revert commit with `git revert <commit-hash>`
2. **Database cleanup**:
```javascript
// Clear product batches (if needed)
await db.product_batches.clear();

// Clear related sync queue items
await db.sync_queue.where('type').equals('PRODUCT_BATCH').delete();
```
3. **Re-sync products**: Trigger pull sync to restore product quantities

---

## Success Criteria

### Critical (Must Pass)
- ✅ Batches created on supplier order delivery
- ✅ Batches deducted in FEFO order during sales
- ✅ Sale items track `product_batch_id`
- ✅ Batch quantity changes sync to PostgreSQL
- ✅ Supplier entities sync without errors

### Important (Should Pass)
- ✅ No JavaScript errors in console
- ✅ Sync queue shows 0 pending after push
- ✅ Multiple batches handled correctly (sale > single batch qty)

### Nice to Have (Optional)
- ✅ Batch expiration warnings in UI
- ✅ Dashboard shows expiring batches
- ✅ Batch history tracking

---

## Time Estimates

| Gap | Task | Estimated Time |
|-----|------|----------------|
| #3 | Update sync queue | 30 min |
| #1 | Add batch creation | 3-4 hours |
| #2 | Integrate FEFO in sales | 3-4 hours |
| - | Testing & verification | 1-2 hours |
| **Total** | | **6-9 hours** |

---

## Related Documentation

- [SUPPLIER_STOCK_INTEGRATION_ARCHITECTURE.md](SUPPLIER_STOCK_INTEGRATION_ARCHITECTURE.md) - Complete architecture
- [FEFO_IMPLEMENTATION_PLAN.md](FEFO_IMPLEMENTATION_PLAN.md) - Original implementation plan
- [PUSH_SYNC_VERIFICATION_TEST.md](PUSH_SYNC_VERIFICATION_TEST.md) - Push sync testing guide
- [Session Summary](summaries/2026-01-17_fefo-phase-3-push-sync-verification.md) - Recent work

---

**Status**: 📋 Ready for implementation
**Last Updated**: 2026-01-17

# Supplier-Stock Integration Architecture

**Date:** 2026-01-17
**Status:** 🚧 Implementation Incomplete
**Priority:** P0 - Critical for FEFO Phase 3

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Schema Design](#schema-design)
4. [Data Flow](#data-flow)
5. [Sync Mechanism](#sync-mechanism)
6. [Critical Gaps](#critical-gaps)
7. [Implementation Plan](#implementation-plan)

---

## Executive Summary

### Current State

The Seri application has **three interconnected subsystems**:

1. **Stock Management** (FEFO Phase 3) - Product batches with expiration tracking
2. **Supplier Management** - Orders, returns, and supplier relationships
3. **Sales & Expenses** - Customer transactions and business expenses

**Problem:** These subsystems have **well-defined schemas** and **working sync mechanisms**, but **critical implementation gaps** prevent them from functioning together:

- ❌ **ProductBatch records are NEVER created** during supplier order delivery
- ❌ **FEFO batch deduction is NOT implemented** in sales flow
- ❌ **Supplier order items are NOT queued for sync** to server
- ⚠️ **ID mapping** works where implemented but needs expansion

### Impact

- FEFO (First Expired First Out) compliance: **0%** - No batch tracking exists
- Inventory traceability: **Incomplete** - Can't trace batches to supplier orders
- Multi-user sync: **Partial** - Some entities don't sync properly
- Data integrity: **At risk** - Local and server data may diverge

### Good News

**90% of infrastructure is ready:**
- ✅ Schemas are well-designed and aligned
- ✅ Sync mechanism is robust (push/pull/conflict resolution)
- ✅ ID mapping logic is correct
- ✅ UI components exist for all flows

**Fixes are surgical** - No major architectural changes needed, just:
1. Add batch creation in delivery confirmation (1 function)
2. Integrate FEFO in sales flow (1 helper function call)
3. Complete sync queue preparation (add missing entity types)

---

## Architecture Overview

### System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    SERI APPLICATION                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Supplier   │  │    Stock     │  │    Sales     │          │
│  │  Management  │  │  Management  │  │  & Expenses  │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         │   ❌ MISSING    │   ❌ MISSING    │                   │
│         │   Integration   │   Integration   │                   │
│         │                 │                 │                   │
│  ┌──────▼─────────────────▼─────────────────▼───────┐          │
│  │         IndexedDB (Offline-First)                │          │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐ │          │
│  │  │Products│  │ Batches│  │ Orders │  │ Sales  │ │          │
│  │  └────────┘  └────────┘  └────────┘  └────────┘ │          │
│  └───────────────────────┬───────────────────────────┘          │
│                          │                                       │
│  ┌───────────────────────▼───────────────────────────┐          │
│  │         Sync Queue (Offline-First)                │          │
│  │   ⚠️ Incomplete: Missing supplier entities       │          │
│  └───────────────────────┬───────────────────────────┘          │
└──────────────────────────┼───────────────────────────────────────┘
                           │
                           │ Push/Pull Sync
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│                    POSTGRESQL (Server)                            │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐    │
│  │Products│  │ Batches│  │ Orders │  │ Items  │  │ Sales  │    │
│  └────────┘  └────────┘  └────────┘  └────────┘  └────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

### Component Relationships

```
Supplier Order (ORDERED)
    │
    ├─→ Supplier Order Items (orderItems)
    │       └─→ Product (productId, may be null for new products)
    │
    ▼ [Delivery Confirmed]
    │
    ├─→ Product Stock Updated (+quantity)
    ├─→ ❌ MISSING: ProductBatch Created (lot, expiry, qty)
    └─→ StockMovement Created (type: RECEIPT)

ProductBatch (created on delivery)
    │
    ├─→ Product (productId) - ONE product, MANY batches
    ├─→ Supplier Order (supplierOrderId) - link to source order
    │
    ▼ [Sale Created with FEFO]
    │
    ├─→ ❌ MISSING: Batch Selection (sorted by expiry)
    ├─→ ❌ MISSING: Batch Quantity Deduction
    └─→ SaleItem (product_batch_id) - tracks which batch was sold
```

---

## Schema Design

### Server Schema (PostgreSQL - Prisma)

#### ProductBatch Table

```prisma
model ProductBatch {
  id              Int       @id @default(autoincrement())
  productId       Int       @map("product_id")        // Link to product
  lotNumber       String    @map("lot_number")        // e.g., "LOT-2026-001"
  expirationDate  DateTime  @map("expiration_date")   // For FEFO sorting
  quantity        Int       @default(0)               // Current qty (decreases with sales)
  initialQty      Int       @map("initial_qty")       // Original qty received
  unitCost        Int?      @map("unit_cost")         // Cost per unit
  supplierOrderId Int?      @map("supplier_order_id") // ✅ Link to source order
  receivedDate    DateTime  @default(now()) @map("received_date")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  // Relations
  product         Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
  saleItems       SaleItem[] // ✅ Track which batch was sold

  @@index([productId])
  @@index([expirationDate])  // For FEFO queries
  @@index([quantity])        // For filtering non-empty batches
  @@map("product_batches")
}
```

**Key Design Decisions:**

1. **`quantity` vs `initialQty`:**
   - `quantity`: Current stock (decreases with sales, may reach 0)
   - `initialQty`: Original quantity (immutable, for waste tracking)
   - Waste = `initialQty - quantity - soldQuantity`

2. **`supplierOrderId` (optional):**
   - Links batch to source supplier order
   - Enables inventory traceability (which supplier, when, how much paid)
   - Optional: manual batch creation (adjustments, transfers) won't have this

3. **Indexes:**
   - `expirationDate`: Critical for FEFO queries (`ORDER BY expiration_date ASC`)
   - `quantity`: Filter out empty batches (`WHERE quantity > 0`)
   - `productId`: Fast lookup of all batches for a product

#### SaleItem Update

```prisma
model SaleItem {
  id             Int   @id @default(autoincrement())
  saleId         Int   @map("sale_id")
  productId      Int   @map("product_id")
  productBatchId Int?  @map("product_batch_id") // ✅ Track which batch was sold
  quantity       Int
  unitPrice      Int   @map("unit_price")
  subtotal       Int

  // Relations
  sale         Sale          @relation(fields: [saleId], references: [id], onDelete: Cascade)
  product      Product       @relation(fields: [productId], references: [id])
  productBatch ProductBatch? @relation(fields: [productBatchId], references: [id])

  @@map("sale_items")
}
```

**Design Decision:** `productBatchId` is **optional** to support:
- Legacy sales (before batch tracking was enabled)
- Manual adjustments where batch isn't known
- Transition period (FEFO not yet mandatory)

### Client Schema (IndexedDB - Dexie)

#### ProductBatch Table (Version 8)

```typescript
// Schema definition
product_batches: '++id, serverId, product_id, expiration_date, quantity, synced'

// TypeScript interface
interface ProductBatch {
  id?: number;                     // Local auto-increment ID
  serverId?: number;               // Maps to PostgreSQL ID
  product_id: number;              // Local product ID (17-26 range)
  lot_number: string;              // Batch identifier
  expiration_date: Date;           // Expiration date (for FEFO)
  quantity: number;                // Current quantity
  initial_qty: number;             // Original quantity
  unit_cost?: number;              // Cost per unit
  supplier_order_id?: number;      // Local supplier order ID
  received_date: Date;             // Received date
  synced: boolean;                 // Sync status flag
}
```

**Key Fields:**

- **`id`**: Auto-increment local ID (unique within IndexedDB)
- **`serverId`**: Maps to PostgreSQL `id` after sync (enables conflict resolution)
- **`product_id`**: **LOCAL** product ID (NOT PostgreSQL ID)
- **`supplier_order_id`**: **LOCAL** supplier order ID (NOT PostgreSQL ID)

**Indexes:**
- `++id`: Primary key, auto-increment
- `serverId`: For sync mapping (find local batch by server ID)
- `product_id`: Fast lookup (`db.product_batches.where('product_id').equals(17)`)
- `expiration_date`: FEFO sorting (`toArray().sort((a,b) => a.expiration_date - b.expiration_date)`)
- `quantity`: Filter non-empty (`filter(b => b.quantity > 0)`)
- `synced`: Find unsynced batches

### Schema Alignment

| Field | Prisma Name | Prisma Type | Dexie Name | Dexie Type | Mapping Needed? |
|-------|-------------|-------------|------------|------------|-----------------|
| ID | `id` | `Int @id` | `id` | `number` | ✅ `serverId` mapping |
| Product ID | `productId` | `Int` | `product_id` | `number` | ✅ **YES** (Pg: 1-10, IDB: 17-26) |
| Lot Number | `lotNumber` | `String` | `lot_number` | `string` | ❌ Direct copy |
| Expiration | `expirationDate` | `DateTime` | `expiration_date` | `Date` | ❌ Direct copy |
| Quantity | `quantity` | `Int` | `quantity` | `number` | ❌ Direct copy |
| Initial Qty | `initialQty` | `Int` | `initial_qty` | `number` | ❌ Direct copy |
| Unit Cost | `unitCost` | `Int?` | `unit_cost` | `number?` | ❌ Direct copy |
| Supplier Order | `supplierOrderId` | `Int?` | `supplier_order_id` | `number?` | ✅ **YES** (Pg: 1-5, IDB: 10-15) |
| Received Date | `receivedDate` | `DateTime` | `received_date` | `Date` | ❌ Direct copy |
| Server ID | N/A | N/A | `serverId` | `number` | ✅ Client-only |
| Synced | N/A | N/A | `synced` | `boolean` | ✅ Client-only |

**Critical Mappings:**

1. **Product ID Mapping:**
   - PostgreSQL: Auto-increment starting from 1 (1, 2, 3, ...)
   - IndexedDB: Auto-increment starting from 17+ (17, 18, 19, ...)
   - **Solution:** Use `product.serverId` to map local → server ID

2. **Supplier Order ID Mapping:**
   - PostgreSQL: Auto-increment (1, 2, 3, ...)
   - IndexedDB: Auto-increment (10, 11, 12, ...)
   - **Solution:** Use `supplier_order.serverId` to map local → server ID

---

## Data Flow

### Flow 1: Supplier Order → Batch Creation

#### Current Implementation (Incomplete)

**File:** `src/app/fournisseurs/commande/[id]/page.tsx`

```typescript
const handleConfirmDelivery = async () => {
  // Step 1: Update product stock
  for (const deliveryItem of deliveryItems) {
    let productId = deliveryItem.productId;

    if (deliveryItem.isNewProduct || !productId) {
      // Create new product
      productId = await db.products.add({
        name: deliveryItem.productName,
        price: deliveryItem.unitPrice * 1.3, // 30% markup
        priceBuy: deliveryItem.unitPrice,
        stock: deliveryItem.receivedQuantity,
        expirationDate: deliveryItem.expirationDate,
        lotNumber: deliveryItem.lotNumber,
        synced: false,
      });

      await queueTransaction('PRODUCT', 'CREATE', { ... });
    } else {
      // Update existing product stock
      const product = await db.products.get(productId);
      const newStock = product.stock + deliveryItem.receivedQuantity;

      await db.products.update(productId, {
        stock: newStock,
        expirationDate: deliveryItem.expirationDate, // ❌ Overwrites old expiration!
        lotNumber: deliveryItem.lotNumber,           // ❌ Overwrites old lot!
      });
    }

    // ❌ CRITICAL MISSING STEP: Create ProductBatch
    // Should be here but is NOT implemented!

    // Step 2: Create stock movement
    await db.stock_movements.add({
      product_id: productId,
      type: 'RECEIPT',
      quantity_change: deliveryItem.receivedQuantity,
      reason: `Réception commande #${order.id}`,
      supplier_order_id: order.id,
      synced: false,
    });

    await queueTransaction('STOCK_MOVEMENT', 'CREATE', { ... });
  }

  // Step 3: Update order status
  await db.supplier_orders.update(order.id!, {
    status: 'DELIVERED',
    deliveryDate: new Date(),
  });
};
```

**Problems:**

1. **No batch creation** - ProductBatch records are never created
2. **Product fields overwritten** - `expirationDate` and `lotNumber` are single values, get overwritten on each delivery
3. **Loss of traceability** - Can't trace which batch came from which order

#### Correct Implementation (Required)

```typescript
const handleConfirmDelivery = async () => {
  for (const deliveryItem of deliveryItems) {
    let productId = deliveryItem.productId;

    // Step 1: Ensure product exists (create or get)
    if (deliveryItem.isNewProduct || !productId) {
      productId = await db.products.add({
        name: deliveryItem.productName,
        price: deliveryItem.unitPrice * 1.3,
        priceBuy: deliveryItem.unitPrice,
        stock: deliveryItem.receivedQuantity, // Initial stock
        synced: false,
        // ✅ Remove expirationDate/lotNumber (use batches instead)
      });
      await queueTransaction('PRODUCT', 'CREATE', { ... });
    } else {
      // Update existing product stock (aggregate)
      const product = await db.products.get(productId);
      const newStock = product.stock + deliveryItem.receivedQuantity;
      await db.products.update(productId, { stock: newStock });
    }

    // ✅ Step 2: Create ProductBatch (NEW)
    const batchId = await db.product_batches.add({
      product_id: productId,
      lot_number: deliveryItem.lotNumber || generateLotNumber(order.id!, deliveryItem.productId),
      expiration_date: new Date(deliveryItem.expirationDate),
      quantity: deliveryItem.receivedQuantity,
      initial_qty: deliveryItem.receivedQuantity,
      unit_cost: deliveryItem.unitPrice,
      supplier_order_id: order.id,
      received_date: new Date(),
      synced: false,
    });

    // ✅ Step 3: Queue batch for sync (NEW)
    await queueTransaction('PRODUCT_BATCH', 'CREATE', {
      id: batchId,
      product_id: productId,
      lot_number: deliveryItem.lotNumber,
      expiration_date: deliveryItem.expirationDate,
      quantity: deliveryItem.receivedQuantity,
      initial_qty: deliveryItem.receivedQuantity,
      unit_cost: deliveryItem.unitPrice,
      supplier_order_id: order.id,
      received_date: new Date(),
    });

    // Step 4: Create stock movement
    await db.stock_movements.add({
      product_id: productId,
      type: 'RECEIPT',
      quantity_change: deliveryItem.receivedQuantity,
      reason: `Réception commande #${order.id} - Lot ${deliveryItem.lotNumber}`,
      supplier_order_id: order.id,
      synced: false,
    });

    await queueTransaction('STOCK_MOVEMENT', 'CREATE', { ... });
  }

  // Update order status
  await db.supplier_orders.update(order.id!, {
    status: 'DELIVERED',
    deliveryDate: new Date(),
  });
};

// ✅ Helper: Generate lot number if missing
function generateLotNumber(orderId: number, productId: number | null): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `LOT-${year}${month}${day}-${orderId}-${random}`;
}
```

**Benefits:**

1. ✅ **Multiple batches per product** - Each delivery creates a new batch
2. ✅ **Traceability** - Each batch links to `supplier_order_id`
3. ✅ **FEFO ready** - Batches have expiration dates for sorting
4. ✅ **Sync ready** - Batches are queued for server sync

---

### Flow 2: Sales → Batch Deduction (FEFO)

#### Current Implementation (Incorrect)

**File:** Multiple sale creation flows

```typescript
// ❌ WRONG: Direct product stock deduction
const handleCompleteSale = async () => {
  for (const item of cartItems) {
    // Direct stock deduction (no FEFO)
    const product = await db.products.get(item.productId);
    await db.products.update(item.productId, {
      stock: product.stock - item.quantity, // ❌ No batch tracking
    });

    // Create sale item WITHOUT batch tracking
    await db.sale_items.add({
      sale_id: saleId,
      product_id: item.productId,
      // ❌ product_batch_id: undefined (not set!)
      quantity: item.quantity,
      unit_price: item.unitPrice,
      subtotal: item.subtotal,
    });
  }
};
```

**Problem:** Sales deduct from aggregate `product.stock` without tracking which batch was sold.

#### Correct Implementation (FEFO)

```typescript
// ✅ CORRECT: FEFO batch deduction
const handleCompleteSale = async () => {
  for (const item of cartItems) {
    // ✅ Step 1: Select batches using FEFO (oldest expiration first)
    const batchAllocations = await selectBatchForSale(item.productId, item.quantity);

    if (batchAllocations.insufficientStock) {
      throw new Error(`Stock insuffisant pour ${item.productName}`);
    }

    // ✅ Step 2: Deduct from each batch
    for (const allocation of batchAllocations.allocations) {
      const batch = await db.product_batches.get(allocation.batchId);
      const newQuantity = batch.quantity - allocation.quantity;

      await db.product_batches.update(allocation.batchId, {
        quantity: newQuantity,
        synced: false, // Mark for sync
      });

      // ✅ Queue batch update for sync
      await queueTransaction('PRODUCT_BATCH', 'UPDATE', {
        id: allocation.batchId,
        quantity: newQuantity,
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
    }

    // ✅ Step 3: Update product aggregate stock
    const product = await db.products.get(item.productId);
    await db.products.update(item.productId, {
      stock: product.stock - item.quantity,
    });
  }
};

// ✅ FEFO Helper Function (already exists in db.ts:285-322)
async function selectBatchForSale(productId: number, requestedQty: number) {
  // Get all non-empty batches, sorted by expiration (FEFO)
  const batches = await db.product_batches
    .where('product_id').equals(productId)
    .filter(b => b.quantity > 0)
    .toArray();

  // Sort by expiration date (earliest first)
  batches.sort((a, b) => a.expiration_date.getTime() - b.expiration_date.getTime());

  // Allocate from earliest batches
  const allocations = [];
  let remaining = requestedQty;

  for (const batch of batches) {
    if (remaining <= 0) break;

    const qtyFromBatch = Math.min(batch.quantity, remaining);
    allocations.push({
      batchId: batch.id!,
      quantity: qtyFromBatch,
      expirationDate: batch.expiration_date,
      lotNumber: batch.lot_number,
    });
    remaining -= qtyFromBatch;
  }

  // Check if we have enough stock
  const insufficientStock = remaining > 0;

  return { allocations, insufficientStock, shortfall: remaining };
}
```

**Benefits:**

1. ✅ **FEFO compliance** - Always sells oldest batches first
2. ✅ **Full traceability** - `sale_items.product_batch_id` tracks which batch was sold
3. ✅ **Expiry prevention** - Oldest batches are depleted first
4. ✅ **Audit trail** - Can generate batch usage reports

---

## Sync Mechanism

### Push Sync Flow

**File:** `src/app/api/sync/push/route.ts`

#### ProductBatch Sync Logic (Lines 466-552)

```typescript
// Sync ProductBatches
if (productBatches && productBatches.length > 0) {
  for (const batch of productBatches) {
    try {
      // ✅ Step 1: Map local product_id to server productId
      const serverProductId = syncedProducts[batch.product_id?.toString() || ''] || batch.product_id;

      // ⚠️ ISSUE: If batch.product_id is local ID (17-26) and product wasn't just synced,
      // syncedProducts won't have the mapping!
      // FIX: Should look up product.serverId from IndexedDB before sync

      // ✅ Step 2: Find existing batch by serverId or lotNumber+productId
      let existingBatch = null;

      if (batch.serverId) {
        existingBatch = await prisma.productBatch.findUnique({
          where: { id: batch.serverId },
        });
      }

      if (!existingBatch && batch.lot_number && batch.product_id) {
        const batchesByLot = await prisma.productBatch.findMany({
          where: {
            lotNumber: batch.lot_number,
            productId: serverProductId,
          },
          orderBy: { updatedAt: 'desc' },
          take: 1,
        });
        existingBatch = batchesByLot[0] || null;
      }

      // ✅ Step 3: Conflict resolution (Last Write Wins)
      if (existingBatch) {
        const serverUpdatedAt = existingBatch.updatedAt;
        const localUpdatedAt = batch.updatedAt ? new Date(batch.updatedAt) : null;

        if (localUpdatedAt && localUpdatedAt > serverUpdatedAt) {
          // Local is newer - update server
          const updated = await prisma.productBatch.update({
            where: { id: existingBatch.id },
            data: {
              productId: serverProductId,
              lotNumber: batch.lot_number,
              expirationDate: batch.expiration_date ? new Date(batch.expiration_date) : existingBatch.expirationDate,
              quantity: batch.quantity,
              initialQty: batch.initial_qty,
              unitCost: batch.unit_cost || null,
              supplierOrderId: batch.supplier_order_id || null,
              receivedDate: batch.received_date ? new Date(batch.received_date) : existingBatch.receivedDate,
            },
          });
          syncedProductBatches[batch.id?.toString() || ''] = updated.id;
        } else {
          // Server is newer or same - skip update
          syncedProductBatches[batch.id?.toString() || ''] = existingBatch.id;
        }
      } else {
        // ✅ Step 4: Create new batch
        const newBatch = await prisma.productBatch.create({
          data: {
            productId: serverProductId,
            lotNumber: batch.lot_number,
            expirationDate: batch.expiration_date ? new Date(batch.expiration_date) : new Date(),
            quantity: batch.quantity,
            initialQty: batch.initial_qty,
            unitCost: batch.unit_cost || null,
            supplierOrderId: batch.supplier_order_id || null,
            receivedDate: batch.received_date ? new Date(batch.received_date) : new Date(),
          },
        });
        syncedProductBatches[batch.id?.toString() || ''] = newBatch.id;
      }
    } catch (error) {
      errors.push(`Failed to sync product batch ${batch.id}: ${error.message}`);
    }
  }
}
```

**ID Mapping Fix Needed:**

```typescript
// ❌ CURRENT (may fail if product not in syncedProducts)
const serverProductId = syncedProducts[batch.product_id?.toString() || ''] || batch.product_id;

// ✅ CORRECT (look up from IndexedDB first)
const localProduct = await db.products.get(batch.product_id);
const serverProductId = syncedProducts[batch.product_id?.toString()]
  || localProduct?.serverId
  || batch.product_id;
```

### Pull Sync Flow

**File:** `src/app/api/sync/pull/route.ts`

#### ProductBatch Pull (Lines 139-147, 356-371)

```typescript
// Query batches updated after lastSyncAt
const productBatches = await prisma.productBatch.findMany({
  where: lastSyncAt ? { updatedAt: { gt: lastSyncAt } } : undefined,
  orderBy: { updatedAt: 'asc' },
});

// Transform to client format
const transformedProductBatches = productBatches.map((b) => ({
  id: b.id,                     // Server ID
  serverId: b.id,               // Duplicate for consistency
  product_id: b.productId,      // ⚠️ PostgreSQL product ID (needs mapping)
  lot_number: b.lotNumber,
  expiration_date: b.expirationDate,
  quantity: b.quantity,
  initial_qty: b.initialQty,
  unit_cost: b.unitCost,
  supplier_order_id: b.supplierOrderId, // ⚠️ PostgreSQL order ID (needs mapping)
  received_date: b.receivedDate,
  synced: true,
}));
```

**ID Mapping in Client:**

**File:** `src/lib/client/sync.ts` (Lines 786-864)

```typescript
// ✅ Correct ID mapping during merge
for (const batch of data.productBatches) {
  // Step 1: Map server product_id to local product ID
  const localProduct = await db.products
    .where('serverId')
    .equals(batch.product_id)  // Find by server ID
    .first();

  if (!localProduct) {
    results.errors.push(`Product with serverId=${batch.product_id} not found`);
    continue;
  }

  const localProductId = localProduct.id!;

  // Step 2: Find existing batch by serverId
  const existing = await db.product_batches
    .where('serverId')
    .equals(batch.serverId)
    .first();

  if (existing) {
    // Update existing batch with mapped ID
    await db.product_batches.update(existing.id!, {
      product_id: localProductId,  // ✅ Mapped to local ID
      lot_number: batch.lot_number,
      expiration_date: new Date(batch.expiration_date),
      quantity: batch.quantity,
      initial_qty: batch.initial_qty,
      unit_cost: batch.unit_cost,
      supplier_order_id: batch.supplier_order_id, // TODO: Map this too
      received_date: new Date(batch.received_date),
      synced: true,
    });
  } else {
    // Create new batch with mapped ID
    await db.product_batches.add({
      serverId: batch.serverId,
      product_id: localProductId,  // ✅ Mapped to local ID
      // ... rest of fields
    });
  }
}
```

**Missing:** `supplier_order_id` mapping (needs same treatment as `product_id`)

### Sync Queue Preparation

**File:** `src/lib/client/sync.ts` (Lines 214-304)

#### Current Implementation (Incomplete)

```typescript
async function prepareSyncPayload(items: SyncQueueItem[]): Promise<SyncPushRequest> {
  const sales: any[] = [];
  const saleItems: any[] = [];
  const expenses: any[] = [];
  const stockMovements: any[] = [];
  const products: any[] = [];
  const productBatches: any[] = [];

  // ❌ MISSING: suppliers, supplierOrders, supplierOrderItems, etc.

  for (const item of items) {
    const payloadWithKey = {
      ...item.payload,
      idempotencyKey: item.idempotencyKey, // Add idempotency key
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
      // ❌ MISSING CASES:
      // case 'SUPPLIER': ...
      // case 'SUPPLIER_ORDER': ...
      // case 'SUPPLIER_ORDER_ITEM': ...  // ⚠️ Defined in typePriority but NOT handled!
      // case 'SUPPLIER_RETURN': ...
      // case 'PRODUCT_SUPPLIER': ...
      // case 'CREDIT_PAYMENT': ...
    }
  }

  return {
    sales,
    saleItems,
    expenses,
    products,
    productBatches,
    stockMovements,
    // ❌ MISSING: suppliers, supplierOrders, supplierOrderItems, etc.
  };
}
```

#### Required Implementation (Complete)

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
    }
  }

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

---

## Critical Gaps

### Gap 1: Batch Creation Missing

**Location:** `src/app/fournisseurs/commande/[id]/page.tsx:240-447`

**Issue:** Delivery confirmation updates product stock but **NEVER creates ProductBatch records**

**Impact:**
- FEFO impossible (no batch data exists)
- No expiration tracking
- No supplier traceability
- Stock movements don't reference batches

**Fix Required:**
1. Add `db.product_batches.add()` after product stock update
2. Queue batch for sync with `queueTransaction('PRODUCT_BATCH', 'CREATE', ...)`
3. Remove `expirationDate` and `lotNumber` from product updates (use batches instead)

**Implementation:** See [Flow 1: Correct Implementation](#correct-implementation-required)

---

### Gap 2: FEFO Sales Not Implemented

**Location:** All sale creation flows

**Issue:** Sales deduct from `product.stock` directly, not from batches using FEFO

**Impact:**
- No batch tracking in sales
- Expired products may be sold
- No compliance with FEFO regulations
- `sale_items.product_batch_id` is always null

**Fix Required:**
1. Call `selectBatchForSale(productId, quantity)` before creating sale
2. Deduct from each batch in allocation
3. Set `sale_items.product_batch_id` for traceability
4. Queue batch updates for sync

**Implementation:** See [Flow 2: Correct Implementation](#correct-implementation-fefo)

---

### Gap 3: Incomplete Sync Queue

**Location:** `src/lib/client/sync.ts:214-304`

**Issue:** `prepareSyncPayload` doesn't handle all entity types

**Missing Types:**
- `SUPPLIER`
- `SUPPLIER_ORDER`
- `SUPPLIER_ORDER_ITEM` (defined in priority but NOT handled)
- `SUPPLIER_RETURN`
- `PRODUCT_SUPPLIER`
- `CREDIT_PAYMENT`

**Impact:**
- Supplier data never syncs to server
- Order items are created locally but never pushed
- Multi-user sync incomplete
- Server database diverges from client

**Fix Required:**
1. Add all missing entity types to `prepareSyncPayload` switch statement
2. Update return type to include all entity arrays
3. Ensure sync queue items are properly sorted by dependency order

---

### Gap 4: ID Mapping Edge Cases

**Location:** Multiple files

**Issues:**

1. **ProductBatch product_id mapping:**
   - Current: `syncedProducts[batch.product_id] || batch.product_id`
   - Problem: Fails if product wasn't synced in same batch
   - Fix: Look up `product.serverId` from IndexedDB first

2. **ProductBatch supplier_order_id mapping:**
   - Current: Not mapped at all
   - Problem: References local order ID instead of server ID
   - Fix: Map using `supplier_order.serverId`

3. **Pull sync supplier_order_id:**
   - Current: Uses PostgreSQL ID directly
   - Problem: Client needs local order ID
   - Fix: Map in `mergePulledData` like `product_id`

**Fix Required:**
1. Update push sync to look up serverIds from IndexedDB
2. Add supplier_order_id mapping in pull sync
3. Test with multi-device scenario to verify mapping works

---

## Implementation Plan

### Phase 1: Critical Gaps (Priority P0)

**Goal:** Enable basic FEFO functionality

**Tasks:**

1. **Add Batch Creation in Delivery Confirmation** (2-3 hours)
   - File: `src/app/fournisseurs/commande/[id]/page.tsx`
   - Add `db.product_batches.add()` in `handleConfirmDelivery`
   - Queue batch for sync
   - Add `generateLotNumber()` helper
   - Remove product-level `expirationDate`/`lotNumber` updates

2. **Implement FEFO in Sales Flow** (3-4 hours)
   - Files: All sale creation flows (nouvelle vente, credit sales, etc.)
   - Call `selectBatchForSale()` (already exists in `db.ts`)
   - Deduct from batches and update `product_batch.quantity`
   - Set `sale_items.product_batch_id`
   - Queue batch updates for sync

3. **Complete Sync Queue Preparation** (1-2 hours)
   - File: `src/lib/client/sync.ts`
   - Add missing entity types to `prepareSyncPayload`
   - Update return type to include all entities
   - Test sync with all entity types

**Acceptance Criteria:**
- ✅ Batches are created when supplier orders are delivered
- ✅ Sales deduct from oldest batches first (FEFO)
- ✅ Sale items track which batch was sold
- ✅ All entity types sync to server

**Estimated Time:** 6-9 hours

---

### Phase 2: ID Mapping Fixes (Priority P1)

**Goal:** Ensure data integrity across sync

**Tasks:**

1. **Fix ProductBatch product_id Mapping in Push Sync** (1 hour)
   - File: `src/app/api/sync/push/route.ts`
   - Look up `product.serverId` from local before mapping
   - Handle case where product has no serverId yet

2. **Add supplier_order_id Mapping** (2 hours)
   - Push sync: Map local order ID to server ID
   - Pull sync: Map server order ID to local ID
   - Update `mergePulledData` in `sync.ts`

3. **Test Multi-Device Sync** (2 hours)
   - Create batch on Device A
   - Verify batch appears on Device B with correct IDs
   - Make sale on Device B using batch
   - Verify sale syncs back to Device A

**Acceptance Criteria:**
- ✅ ProductBatch `product_id` maps correctly in all scenarios
- ✅ ProductBatch `supplier_order_id` maps correctly
- ✅ Multi-device sync works without ID conflicts

**Estimated Time:** 5 hours

---

### Phase 3: UI Enhancements (Priority P2)

**Goal:** Improve user experience

**Tasks:**

1. **Batch Expiry Warnings in Sales Flow** (2 hours)
   - Show warning if selling batch expiring in < 30 days
   - Visual indicator (orange/red badge)
   - Confirmation dialog for expired batches

2. **Dashboard Expiring Batches Widget** (2 hours)
   - List batches expiring in < 30 days
   - Show quantity, product name, days until expiry
   - Link to batch details

3. **Batch History in Product Details** (1 hour)
   - Show all batches for a product
   - Display: lot number, expiry, quantity, status (active/depleted/expired)
   - Sort by expiry date

**Acceptance Criteria:**
- ✅ Users are warned about expiring products
- ✅ Dashboard shows expiring batches summary
- ✅ Product details show batch history

**Estimated Time:** 5 hours

---

### Phase 4: Testing & Documentation (Priority P2)

**Goal:** Ensure reliability and maintainability

**Tasks:**

1. **End-to-End Testing** (3 hours)
   - Create supplier order → Delivery → Batches created
   - Make sale → FEFO applied → Batch quantities updated
   - Sync → Verify all data reaches server
   - Multi-device → Verify sync works correctly

2. **Update Documentation** (2 hours)
   - Update CLAUDE.md with batch tracking details
   - Document FEFO algorithm
   - Add batch creation workflow diagram
   - Update sync mechanism documentation

3. **Add Code Comments** (1 hour)
   - Comment batch creation logic
   - Comment FEFO selection algorithm
   - Comment ID mapping logic

**Acceptance Criteria:**
- ✅ All workflows tested end-to-end
- ✅ Documentation updated and accurate
- ✅ Code is well-commented

**Estimated Time:** 6 hours

---

## Total Estimated Time

| Phase | Tasks | Hours |
|-------|-------|-------|
| Phase 1: Critical Gaps | Batch creation, FEFO sales, Sync queue | 6-9 hours |
| Phase 2: ID Mapping | ID mapping fixes, Multi-device testing | 5 hours |
| Phase 3: UI Enhancements | Warnings, Dashboard, History | 5 hours |
| Phase 4: Testing & Docs | E2E testing, Documentation | 6 hours |
| **Total** | | **22-25 hours** |

---

## Success Criteria

### Phase 1 Success (Minimum Viable FEFO)

- [ ] Product batches are created when supplier orders are delivered
- [ ] Sales deduct from oldest batches first (FEFO)
- [ ] Sale items track which batch was sold (`product_batch_id`)
- [ ] All entities (batches, orders, items) sync to server
- [ ] No data loss in offline/online transitions

### Phase 2 Success (Data Integrity)

- [ ] ID mapping works correctly for all entity types
- [ ] Multi-device sync works without conflicts
- [ ] No orphaned records (batches without products, etc.)
- [ ] Conflict resolution (Last Write Wins) works correctly

### Phase 3 Success (User Experience)

- [ ] Users are warned about expiring products
- [ ] Dashboard shows expiring batches
- [ ] Product details show batch history
- [ ] No performance degradation

### Phase 4 Success (Quality)

- [ ] All workflows tested end-to-end
- [ ] Documentation is complete and accurate
- [ ] Code is maintainable with good comments
- [ ] Zero critical bugs

---

## Conclusion

The Seri application has **90% of the FEFO infrastructure ready**. The schemas are well-designed, the sync mechanism is robust, and the ID mapping logic is correct where implemented.

**The remaining 10%** consists of three surgical fixes:
1. Add batch creation in delivery confirmation
2. Integrate FEFO in sales flow
3. Complete sync queue preparation

These fixes are **low-risk** (no schema changes), **high-impact** (enable full FEFO compliance), and **straightforward** to implement (6-9 hours estimated).

Once implemented, Seri will have **full FEFO compliance** with:
- ✅ Batch tracking from supplier orders
- ✅ Expiration-based sales deduction
- ✅ Full traceability (batch → order → supplier)
- ✅ Multi-device sync with conflict resolution
- ✅ Offline-first reliability

**Next Step:** Update CLAUDE.md with this architecture, then proceed with Phase 1 implementation.

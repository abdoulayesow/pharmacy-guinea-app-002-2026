# FEFO Batch Tracking - Design Document

**Date:** 2026-01-16
**Phase:** 3 - Consolidation
**Priority:** P0 (Critical for pharmacy compliance)
**Complexity:** Intermediate Automation

---

## Overview

Implement First Expired First Out (FEFO) batch tracking with intermediate automation to:
1. Track product batches with expiration dates
2. Auto-sort products by expiration in sale flow
3. Show dashboard widget for expiring items
4. Alert users about near-expiry products

---

## Business Requirements

### Problem Statement
- Pharmacies must sell products before expiration to avoid waste and regulatory issues
- Manual FEFO is error-prone (easy to grab wrong batch)
- Need visibility into expiring inventory for proactive management

### User Stories

**As Oumar (Owner):**
- I want to see which products are expiring soon so I can plan promotions or returns
- I want to prevent employees from accidentally selling expired products
- I want reports on waste due to expiration

**As Abdoulaye (Employee):**
- I want the system to automatically select the earliest expiring batch when I make a sale
- I want visual alerts when adding near-expiry products to a sale
- I don't want to manually track lot numbers

---

## Data Model Design

### Current State (Prisma)
```prisma
model Product {
  id             Int       @id @default(autoincrement())
  name           String
  price          Int
  priceBuy       Int?
  stock          Int       @default(0)
  minStock       Int       @default(10)
  category       String?
  expirationDate DateTime? // ❌ Single value - can't track multiple batches
  lotNumber      String?   // ❌ Single value - inadequate for FEFO
  ...
}
```

**Problem:** Can only store ONE expiration date per product. If we receive 3 shipments of Paracetamol with different expiration dates, we can't track them separately.

### New Design: ProductBatch Table

```prisma
model ProductBatch {
  id             Int       @id @default(autoincrement())
  productId      Int       @map("product_id")
  lotNumber      String    @map("lot_number")         // e.g., "LOT-2024-001"
  expirationDate DateTime  @map("expiration_date")    // e.g., "2026-12-31"
  quantity       Int       @default(0)                // Current quantity in this batch
  initialQty     Int       @map("initial_qty")        // Original quantity received
  unitCost       Int?      @map("unit_cost")          // Cost per unit (optional)
  supplierOrderId Int?     @map("supplier_order_id")  // Link to supplier order
  receivedDate   DateTime  @default(now()) @map("received_date")
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  // Relations
  product        Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
  saleItems      SaleItem[]

  @@index([productId])
  @@index([expirationDate])
  @@index([quantity]) // For filtering out depleted batches
  @@map("product_batches")
}
```

**Key Fields:**
- `lotNumber`: Batch identifier (e.g., "LOT-2024-001")
- `expirationDate`: When this batch expires
- `quantity`: Current stock in this batch (decremented on sales)
- `initialQty`: Original quantity (for tracking waste/usage)
- `unitCost`: Cost per unit (for profit calculations)
- `supplierOrderId`: Optional link to supplier order (if tracked)

### Updated SaleItem Model

```prisma
model SaleItem {
  id             Int           @id @default(autoincrement())
  saleId         Int           @map("sale_id")
  productId      Int           @map("product_id")
  productBatchId Int?          @map("product_batch_id") // 🆕 Track which batch was sold
  quantity       Int
  unitPrice      Int           @map("unit_price")
  subtotal       Int

  // Relations
  sale           Sale          @relation(...)
  product        Product       @relation(...)
  productBatch   ProductBatch? @relation(fields: [productBatchId], references: [id]) // 🆕

  @@map("sale_items")
}
```

**Change:** Add optional `productBatchId` to track which batch was used in each sale item.

---

## IndexedDB Schema (Dexie)

Add to `src/lib/client/db.ts`:

```typescript
// Version 7: Add product batch tracking for FEFO (Phase 3)
this.version(7).stores({
  users: 'id, role',
  products: '++id, serverId, name, category, expirationDate, synced',
  product_batches: '++id, serverId, product_id, expiration_date, quantity, synced', // 🆕
  sales: '++id, serverId, created_at, payment_method, payment_status, due_date, modified_at, user_id, customer_name, synced',
  sale_items: '++id, sale_id, product_id, product_batch_id', // 🆕 Added product_batch_id index
  expenses: '++id, serverId, date, category, supplier_order_id, user_id, synced',
  stock_movements: '++id, serverId, product_id, created_at, supplier_order_id, synced',
  sync_queue: '++id, type, status, createdAt',
  suppliers: '++id, serverId, name, synced',
  supplier_orders: '++id, serverId, supplierId, status, dueDate, synced',
  supplier_order_items: '++id, serverId, order_id, product_id, synced',
  supplier_returns: '++id, serverId, supplierId, productId, applied, synced',
  product_suppliers: '++id, serverId, product_id, supplier_id, is_primary, synced',
  credit_payments: '++id, serverId, sale_id, payment_date, synced',
});
```

**Indexes:**
- `product_id`: Query batches for a product
- `expiration_date`: Sort by expiration (FEFO)
- `quantity`: Filter out depleted batches
- `synced`: Track sync status

---

## FEFO Algorithm

### Automatic Batch Selection (Sale Flow)

When adding a product to cart:

```typescript
async function selectBatchForSale(productId: number, requestedQty: number): Promise<BatchAllocation[]> {
  // 1. Get all non-empty batches for this product, sorted by expiration (earliest first)
  const batches = await db.product_batches
    .where('product_id').equals(productId)
    .and(batch => batch.quantity > 0)
    .sortBy('expiration_date'); // FEFO: First Expired First Out

  // 2. Allocate quantity across batches (earliest first)
  const allocations: BatchAllocation[] = [];
  let remainingQty = requestedQty;

  for (const batch of batches) {
    if (remainingQty <= 0) break;

    const qtyFromBatch = Math.min(batch.quantity, remainingQty);
    allocations.push({
      batchId: batch.id,
      lotNumber: batch.lotNumber,
      expirationDate: batch.expirationDate,
      quantity: qtyFromBatch,
    });

    remainingQty -= qtyFromBatch;
  }

  // 3. Check if we have enough stock
  if (remainingQty > 0) {
    throw new Error(`Insufficient stock: need ${requestedQty}, available ${requestedQty - remainingQty}`);
  }

  return allocations;
}
```

**Example:**
- Product: Paracetamol (ID: 123)
- Batches:
  - LOT-001: Exp 2026-03-15, Qty 50
  - LOT-002: Exp 2026-05-20, Qty 100
  - LOT-003: Exp 2026-08-10, Qty 75
- Sale request: 120 units
- **Allocation:**
  - 50 from LOT-001 (expires soonest)
  - 70 from LOT-002 (next to expire)
  - 0 from LOT-003 (not needed)

### Stock Deduction on Sale

```typescript
async function completeSale(saleId: number, items: CartItem[]) {
  for (const item of items) {
    // 1. Select batches using FEFO
    const allocations = await selectBatchForSale(item.productId, item.quantity);

    // 2. Create SaleItem entries (one per batch allocation)
    for (const alloc of allocations) {
      await db.sale_items.add({
        saleId,
        productId: item.productId,
        productBatchId: alloc.batchId, // 🆕 Track which batch
        quantity: alloc.quantity,
        unitPrice: item.unitPrice,
        subtotal: alloc.quantity * item.unitPrice,
      });

      // 3. Decrement batch quantity
      await db.product_batches.update(alloc.batchId, {
        quantity: (await db.product_batches.get(alloc.batchId))!.quantity - alloc.quantity,
      });
    }

    // 4. Update product total stock
    await db.products.update(item.productId, {
      stock: (await db.products.get(item.productId))!.stock - item.quantity,
    });
  }
}
```

---

## Expiration Alerts

### Alert Thresholds

| Threshold | Description | Color | Action |
|-----------|-------------|-------|--------|
| **< 7 days** | Critical - Expires within a week | 🔴 Red | Urgent sale/return needed |
| **< 30 days** | Warning - Expires within a month | 🟠 Orange | Plan promotion |
| **< 90 days** | Notice - Expires within 3 months | 🟡 Yellow | Monitor inventory |

### Dashboard Widget

```typescript
interface ExpiringBatch {
  productId: number;
  productName: string;
  lotNumber: string;
  expirationDate: Date;
  quantity: number;
  daysUntilExpiry: number;
  severity: 'critical' | 'warning' | 'notice';
}

async function getExpiringBatches(): Promise<ExpiringBatch[]> {
  const now = new Date();
  const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const batches = await db.product_batches
    .where('expiration_date').below(in90Days)
    .and(batch => batch.quantity > 0)
    .toArray();

  return batches.map(batch => {
    const daysUntilExpiry = Math.floor(
      (batch.expirationDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
    );

    return {
      productId: batch.productId,
      productName: batch.product.name, // Join with product
      lotNumber: batch.lotNumber,
      expirationDate: batch.expirationDate,
      quantity: batch.quantity,
      daysUntilExpiry,
      severity:
        daysUntilExpiry < 7 ? 'critical' :
        daysUntilExpiry < 30 ? 'warning' : 'notice',
    };
  }).sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry); // Soonest first
}
```

### Visual Indicators

**In sale flow (product search results):**
```tsx
{batch.daysUntilExpiry < 30 && (
  <Badge variant={batch.daysUntilExpiry < 7 ? 'destructive' : 'warning'}>
    Expire {batch.daysUntilExpiry}j
  </Badge>
)}
```

**Dashboard widget:**
```tsx
<Card>
  <CardHeader>
    <CardTitle>Produits expirant bientôt</CardTitle>
  </CardHeader>
  <CardContent>
    {expiringBatches.length === 0 ? (
      <p className="text-gray-500">Aucun produit expirant dans les 90 jours</p>
    ) : (
      <ul className="space-y-2">
        {expiringBatches.slice(0, 5).map(batch => (
          <li key={batch.lotNumber} className="flex justify-between items-center">
            <div>
              <p className="font-medium">{batch.productName}</p>
              <p className="text-sm text-gray-500">Lot: {batch.lotNumber}</p>
            </div>
            <Badge variant={batch.severity === 'critical' ? 'destructive' : 'warning'}>
              {batch.daysUntilExpiry}j
            </Badge>
          </li>
        ))}
      </ul>
    )}
  </CardContent>
</Card>
```

---

## UI Flow Changes

### 1. Stock Receipt (Adding New Batches)

**Current:** Add stock → enter quantity → done

**New:** Add stock → enter quantity → **add batch details** → done

```tsx
// New batch entry form
<Dialog>
  <DialogTitle>Réception de stock - {product.name}</DialogTitle>
  <DialogContent>
    <Label>Quantité reçue</Label>
    <Input type="number" value={quantity} onChange={setQuantity} />

    <Label>Numéro de lot</Label>
    <Input placeholder="LOT-2024-001" value={lotNumber} onChange={setLotNumber} />

    <Label>Date d'expiration</Label>
    <Input type="date" value={expirationDate} onChange={setExpirationDate} />

    <Label>Coût unitaire (optionnel)</Label>
    <Input type="number" value={unitCost} onChange={setUnitCost} />

    <Button onClick={handleReceiveStock}>Enregistrer</Button>
  </DialogContent>
</Dialog>
```

**Validation:**
- Lot number required
- Expiration date required
- Warn if expiration date is < 90 days

### 2. Sale Flow (Product Selection)

**Current:** Search product → select → add to cart

**New:** Search product → select → **show batch info** → add to cart (auto-FEFO)

```tsx
// Product card in search results
<Card>
  <CardHeader>
    <CardTitle>{product.name}</CardTitle>
    <p>{formatGNF(product.price)}</p>
  </CardHeader>
  <CardContent>
    <p>Stock: {product.stock}</p>
    {earliestBatch && (
      <div className="mt-2">
        <p className="text-sm text-gray-600">Lot le plus ancien:</p>
        <Badge variant={getDaysUntilExpiry(earliestBatch) < 30 ? 'warning' : 'default'}>
          {earliestBatch.lotNumber} - Exp: {formatDate(earliestBatch.expirationDate)}
        </Badge>
      </div>
    )}
  </CardContent>
</Card>
```

**User feedback:**
- Show earliest expiring batch info
- Highlight if < 30 days from expiration
- Automatic batch selection (transparent to user)

### 3. Dashboard Widget

**New widget:** "Produits expirant bientôt"

- Shows top 5 soonest expiring batches
- Color-coded badges (red < 7 days, orange < 30 days, yellow < 90 days)
- Click to view full list
- Link to expiration alerts page

---

## Migration Strategy

### Phase 1: Schema Migration
1. Add `product_batches` table to Prisma schema
2. Add `productBatchId` to `sale_items` table
3. Run migration: `npx prisma migrate dev --name add-batch-tracking`
4. Update Dexie schema (version 7)

### Phase 2: Data Migration
For existing products with `expirationDate` and `lotNumber`:
```typescript
async function migrateExistingBatches() {
  const products = await db.products.where('expirationDate').above(new Date()).toArray();

  for (const product of products) {
    if (product.expirationDate && product.stock > 0) {
      // Create a single batch for existing stock
      await db.product_batches.add({
        productId: product.id,
        lotNumber: product.lotNumber || `MIGRATED-${product.id}`,
        expirationDate: product.expirationDate,
        quantity: product.stock,
        initialQty: product.stock,
        receivedDate: new Date(),
      });
    }
  }
}
```

### Phase 3: UI Updates
1. Update stock receipt flow to capture batch details
2. Update sale flow to show batch info and use FEFO
3. Add dashboard widget for expiring batches
4. Create expiration alerts page

### Phase 4: Sync Logic
1. Update push sync to handle `product_batches`
2. Update pull sync to fetch batch updates
3. Handle batch conflict resolution (last-write-wins by `updatedAt`)

---

## API Endpoints

### POST /api/batches (Create batch)
```typescript
{
  productId: number;
  lotNumber: string;
  expirationDate: string; // ISO 8601
  quantity: number;
  unitCost?: number;
  supplierOrderId?: number;
}
```

### GET /api/batches?productId=123 (Get batches for product)
```typescript
{
  batches: [
    {
      id: number;
      lotNumber: string;
      expirationDate: string;
      quantity: number;
      daysUntilExpiry: number;
    }
  ]
}
```

### GET /api/batches/expiring?threshold=30 (Get expiring batches)
```typescript
{
  batches: [
    {
      id: number;
      productId: number;
      productName: string;
      lotNumber: string;
      expirationDate: string;
      quantity: number;
      daysUntilExpiry: number;
      severity: 'critical' | 'warning' | 'notice';
    }
  ]
}
```

---

## Testing Strategy

### Unit Tests
- `selectBatchForSale()` - FEFO algorithm
- `getExpiringBatches()` - Expiration threshold logic
- Batch stock deduction on sale

### Integration Tests
- Stock receipt → batch creation → IndexedDB storage
- Sale → FEFO batch selection → stock deduction
- Sync: push batch data → PostgreSQL → pull on other device

### Manual Tests
- **Scenario 1: Single batch**
  - Add product with 1 batch
  - Sell partial quantity
  - Verify batch quantity decremented

- **Scenario 2: Multiple batches (FEFO)**
  - Add product with 3 batches (different expiration dates)
  - Sell quantity > first batch quantity
  - Verify FEFO allocation (earliest batch used first)

- **Scenario 3: Expiration alerts**
  - Add batches expiring in 5 days, 20 days, 60 days
  - Check dashboard widget shows correct severity colors
  - Verify sorting (soonest first)

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Waste reduction** | -50% expired products | Compare pre/post FEFO waste |
| **FEFO compliance** | 95% sales use earliest batch | Audit sale_items batch selection |
| **Alert visibility** | 100% expiring batches flagged | Dashboard widget accuracy |
| **User adoption** | 80% batch tracking on receipts | % of stock receipts with batch data |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Users forget to enter batch data** | High | Make lot number + expiration required fields |
| **Performance with 1000+ batches** | Medium | Add pagination to batch queries, limit dashboard to top 10 |
| **Barcode scanning not available** | Medium | Manual entry is acceptable for Phase 3 (barcode in Phase 4) |
| **Data migration errors** | High | Test migration on staging data first, add rollback script |

---

## Future Enhancements (Phase 4)

1. **Barcode Scanning**: Scan lot number from product packaging
2. **Advanced FEFO**: Allow manual batch override (with confirmation)
3. **Batch Transfers**: Move batches between locations
4. **Regulatory Reports**: Batch traceability reports for audits
5. **Supplier Integration**: Auto-populate batch info from supplier invoices

---

## Conclusion

This design provides **intermediate FEFO automation** that:
- ✅ Tracks multiple batches per product
- ✅ Auto-selects earliest expiring batch on sales (transparent to user)
- ✅ Shows visual alerts for near-expiry products
- ✅ Provides dashboard visibility into expiring inventory
- ✅ Maintains offline-first architecture
- ✅ Syncs batch data to PostgreSQL

**Next Steps:**
1. Update Prisma schema
2. Update Dexie schema
3. Implement FEFO algorithm
4. Build batch entry UI
5. Add dashboard widget
6. Test and deploy

---

*Phase 3 - FEFO Batch Tracking - Ready for Implementation*

# Database Schema Analysis - Critical Issues Found

**Date**: 2026-01-16
**Issue**: Different stock levels between users (sync not working correctly)
**Root Cause**: Database initialization and schema mismatches

---

## Critical Issues Identified

### 🔴 Issue 1: IndexedDB Schema Versions Conflict (CRITICAL)

**Problem**: Version 5 is defined **TWICE** in [src/lib/client/db.ts](../src/lib/client/db.ts)

**Lines 106-119** (Version 5 - First Definition):
```typescript
// 🆕 Version 5: Add idempotencyKey index to sync_queue (for P0/P1 improvements)
this.version(5).stores({
  users: 'id, role',
  products: '++id, serverId, name, category, expirationDate, synced',
  sales: '++id, serverId, created_at, payment_method, payment_status, due_date, user_id, customer_name, synced',
  sale_items: '++id, sale_id, product_id',
  expenses: '++id, serverId, date, category, supplier_order_id, user_id, synced',
  stock_movements: '++id, serverId, product_id, created_at, synced',
  sync_queue: '++id, type, status, idempotencyKey, localId, createdAt', // 🆕 Added idempotencyKey and localId indexes
  suppliers: '++id, serverId, name, synced',
  supplier_orders: '++id, serverId, supplierId, status, dueDate, synced',
  supplier_returns: '++id, serverId, supplierId, productId, applied, synced',
  credit_payments: '++id, serverId, sale_id, payment_date, synced',
});
```

**Lines 121-134** (Version 5 - Second Definition - OVERWRITES FIRST):
```typescript
// Version 5: Add sale editing support (Phase 3 - modified_at index)
this.version(5).stores({
  users: 'id, role',
  products: '++id, serverId, name, category, expirationDate, synced',
  sales: '++id, serverId, created_at, payment_method, payment_status, due_date, modified_at, user_id, customer_name, synced', // 🆕 Added modified_at index
  sale_items: '++id, sale_id, product_id',
  expenses: '++id, serverId, date, category, supplier_order_id, user_id, synced',
  stock_movements: '++id, serverId, product_id, created_at, synced',
  sync_queue: '++id, type, status, createdAt', // ❌ MISSING idempotencyKey and localId!
  suppliers: '++id, serverId, name, synced',
  supplier_orders: '++id, serverId, supplierId, status, dueDate, synced',
  supplier_returns: '++id, serverId, supplierId, productId, applied, synced',
  credit_payments: '++id, serverId, sale_id, payment_date, synced',
});
```

**Impact**:
- ❌ **Second version 5 definition OVERWRITES the first**
- ❌ **`idempotencyKey` and `localId` indexes are LOST**
- ❌ **Sync queue queries by `idempotencyKey` will be SLOW**
- ❌ **Different users may have different schema versions**

**Why This Causes Different Stock Levels**:
1. User 1 (owner-abdoulaye-sow) logged in first → Got version 7 schema with demo data
2. User 2 (employee-ablo-sow) logged in later → Got version 7 schema BUT demo data already synced from User 1
3. **Demo data seeding happens locally per browser** → Each user's IndexedDB is independent
4. **Pull sync didn't update User 2's local data** → Sync issue

---

### 🔴 Issue 2: No Customer Table (Design Issue)

**Current Design** ([prisma/schema.prisma:96-119](../prisma/schema.prisma#L96-L119)):
```prisma
model Sale {
  id              Int       @id @default(autoincrement())
  total           Int
  paymentMethod   String    @map("payment_method") // CASH | ORANGE_MONEY | CREDIT
  paymentStatus   String    @default("PAID") @map("payment_status")
  customerName    String?   @map("customer_name")      // ❌ Embedded in Sale table
  customerPhone   String?   @map("customer_phone")     // ❌ Embedded in Sale table
  // ... other fields
}
```

**Problem**:
- ❌ **No referential integrity** - Customer data duplicated in every sale
- ❌ **No customer history** - Can't track total purchases or outstanding credit per customer
- ❌ **No credit limits** - Can't enforce credit limits per customer
- ❌ **Data inconsistency** - "Mamadou Diallo" vs "M. Diallo" vs "Mamadou DIALLO" are different

**Why This Is Bad for Credit Sales**:
- Can't answer: "How much credit does Mamadou Diallo have outstanding?"
- Can't answer: "What's the total purchase history for this customer?"
- Can't enforce: "Don't allow more than 500,000 GNF credit per customer"

---

### 🟠 Issue 3: Missing Customer Table in IndexedDB

**Current IndexedDB Tables** ([src/lib/client/db.ts:31-45](../src/lib/client/db.ts#L31-L45)):
```typescript
class SeriDatabase extends Dexie {
  users!: Table<User>;
  products!: Table<Product>;
  sales!: Table<Sale>;
  sale_items!: Table<SaleItem>;
  expenses!: Table<Expense>;
  stock_movements!: Table<StockMovement>;
  sync_queue!: Table<SyncQueueItem>;
  suppliers!: Table<Supplier>;
  supplier_orders!: Table<SupplierOrder>;
  supplier_order_items!: Table<SupplierOrderItem>;
  supplier_returns!: Table<SupplierReturn>;
  product_suppliers!: Table<ProductSupplier>;
  credit_payments!: Table<CreditPayment>;
  // ❌ NO customers table!
}
```

**Missing**:
```typescript
customers!: Table<Customer>;
```

---

## Root Cause: Demo Data Seeding Per Browser

**Current Behavior** ([src/lib/client/db.ts:218-423](../src/lib/client/db.ts#L218-L423)):

```typescript
export async function seedInitialData() {
  // If already seeded or currently seeding, skip
  if (seedingComplete || isSeeding) {
    return;
  }

  const productCount = await db.products.count();

  if (productCount === 0) {
    isSeeding = true;
    console.log('[Seri DB] Seeding demo products and suppliers...');

    // Seeds 8 products locally
    await db.products.bulkAdd([...]);

    // Seeds 5 suppliers locally
    await db.suppliers.bulkAdd([...]);

    // Seeds 2 orders locally
    await db.supplier_orders.bulkAdd([...]);
  }
}
```

**Problem**:
1. **User 1** logs in → `seedInitialData()` runs → 8 products added to **User 1's IndexedDB**
2. **User 2** logs in (different browser/device) → `seedInitialData()` runs → 8 products added to **User 2's IndexedDB**
3. **Both users have different `id` values** for the same products (auto-increment)
4. **Stock levels are INDEPENDENT** per user's IndexedDB
5. **Sync doesn't merge demo data** → Users see different stock levels

---

## Schema Comparison

### PostgreSQL (Server - Single Source of Truth)

```prisma
model Product {
  id             Int       @id @default(autoincrement())
  name           String
  price          Int       // Stored in GNF
  priceBuy       Int?      @map("price_buy")
  stock          Int       @default(0)
  minStock       Int       @default(10) @map("stock_min")
  category       String?
  expirationDate DateTime? @map("expiration_date")
  lotNumber      String?   @map("lot_number")
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  // ✅ Relations defined
  saleItems        SaleItem[]
  stockMovements   StockMovement[]
  productSuppliers ProductSupplier[]
}
```

### IndexedDB (Client - Per-User Cache)

**Current (Version 7)**:
```typescript
products: '++id, serverId, name, category, expirationDate, synced'
```

**Issues**:
- ✅ `++id` - Auto-increment local ID
- ✅ `serverId` - Maps to PostgreSQL `id`
- ✅ `synced` - Sync status flag
- ❌ **No `updatedAt` index** - Can't efficiently query "products updated since X"
- ❌ **No `stock` index** - Can't efficiently filter by stock level

---

## Recommended Fixes

### Fix 1: Merge Version 5 Definitions (CRITICAL)

**Action**: Combine both version 5 definitions into a single version

**File**: [src/lib/client/db.ts](../src/lib/client/db.ts#L106-L134)

**Current** (lines 106-134):
```typescript
// Version 5: Add idempotencyKey index (FIRST - CORRECT)
this.version(5).stores({ ... });

// Version 5: Add sale editing support (SECOND - OVERWRITES FIRST)
this.version(5).stores({ ... });
```

**Fixed**:
```typescript
// Version 5: Add idempotencyKey + sale editing support
this.version(5).stores({
  users: 'id, role',
  products: '++id, serverId, name, category, expirationDate, synced',
  sales: '++id, serverId, created_at, payment_method, payment_status, due_date, modified_at, user_id, customer_name, synced', // Both modified_at AND other indexes
  sale_items: '++id, sale_id, product_id',
  expenses: '++id, serverId, date, category, supplier_order_id, user_id, synced',
  stock_movements: '++id, serverId, product_id, created_at, synced',
  sync_queue: '++id, type, status, idempotencyKey, localId, createdAt', // BOTH idempotencyKey AND localId
  suppliers: '++id, serverId, name, synced',
  supplier_orders: '++id, serverId, supplierId, status, dueDate, synced',
  supplier_returns: '++id, serverId, supplierId, productId, applied, synced',
  credit_payments: '++id, serverId, sale_id, payment_date, synced',
});
```

---

### Fix 2: Add Customer Table (HIGH Priority)

**Step 1: Add Prisma Model**

**File**: [prisma/schema.prisma](../prisma/schema.prisma)

**Add after line 150**:
```prisma
// Customer model for credit sales tracking
model Customer {
  id            Int       @id @default(autoincrement())
  name          String
  phone         String?   @unique
  address       String?
  creditLimit   Int       @default(500000) @map("credit_limit") // Max credit in GNF (default 500K)
  currentCredit Int       @default(0) @map("current_credit") // Outstanding credit amount
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  // Relations
  sales         Sale[]

  @@map("customers")
}
```

**Step 2: Update Sale Model**

**File**: [prisma/schema.prisma:96-119](../prisma/schema.prisma#L96-L119)

**Current**:
```prisma
model Sale {
  id              Int       @id @default(autoincrement())
  total           Int
  customerName    String?   @map("customer_name")    // ❌ Remove this
  customerPhone   String?   @map("customer_phone")   // ❌ Remove this
  // ...
}
```

**Updated**:
```prisma
model Sale {
  id              Int       @id @default(autoincrement())
  total           Int
  customerId      Int?      @map("customer_id")      // 🆕 Foreign key to Customer
  customerName    String?   @map("customer_name")    // ✅ Keep for backward compatibility
  customerPhone   String?   @map("customer_phone")   // ✅ Keep for backward compatibility
  // ...

  // Relations
  customer        Customer? @relation(fields: [customerId], references: [id])
  // ...
}
```

**Step 3: Add IndexedDB Customer Table**

**File**: [src/lib/client/db.ts](../src/lib/client/db.ts)

**Add to class definition** (line 45):
```typescript
class SeriDatabase extends Dexie {
  users!: Table<User>;
  products!: Table<Product>;
  sales!: Table<Sale>;
  sale_items!: Table<SaleItem>;
  expenses!: Table<Expense>;
  stock_movements!: Table<StockMovement>;
  sync_queue!: Table<SyncQueueItem>;
  suppliers!: Table<Supplier>;
  supplier_orders!: Table<SupplierOrder>;
  supplier_order_items!: Table<SupplierOrderItem>;
  supplier_returns!: Table<SupplierReturn>;
  product_suppliers!: Table<ProductSupplier>;
  credit_payments!: Table<CreditPayment>;
  customers!: Table<Customer>; // 🆕 Add this
}
```

**Add to version 8** (new version):
```typescript
// Version 8: Add customers table
this.version(8).stores({
  users: 'id, role',
  products: '++id, serverId, name, category, expirationDate, synced',
  sales: '++id, serverId, created_at, payment_method, payment_status, due_date, modified_at, user_id, customer_id, customer_name, synced',
  sale_items: '++id, sale_id, product_id',
  expenses: '++id, serverId, date, category, supplier_order_id, user_id, synced',
  stock_movements: '++id, serverId, product_id, created_at, supplier_order_id, synced',
  sync_queue: '++id, type, status, idempotencyKey, localId, createdAt',
  suppliers: '++id, serverId, name, synced',
  supplier_orders: '++id, serverId, supplierId, type, status, paymentStatus, dueDate, synced',
  supplier_order_items: '++id, serverId, order_id, product_id, synced',
  supplier_returns: '++id, serverId, supplierId, productId, applied, synced',
  product_suppliers: '++id, serverId, product_id, supplier_id, is_primary, synced',
  credit_payments: '++id, serverId, sale_id, payment_date, synced',
  customers: '++id, serverId, name, phone, current_credit, synced', // 🆕 New table
});
```

**Step 4: Add Customer Type**

**File**: [src/lib/shared/types.ts](../src/lib/shared/types.ts)

**Add after CreditPayment interface**:
```typescript
export interface Customer {
  id?: number;
  serverId?: number;
  name: string;
  phone?: string;
  address?: string;
  credit_limit: number;
  current_credit: number;
  created_at?: Date;
  updated_at?: Date;
  synced: boolean;
}
```

---

### Fix 3: Remove Per-Browser Demo Data Seeding (CRITICAL)

**Problem**: Demo data should come from server, not client

**Current Approach** (❌ Wrong):
```
User 1 Browser → seedInitialData() → 8 products in IndexedDB (local ids 1-8)
User 2 Browser → seedInitialData() → 8 products in IndexedDB (local ids 1-8)
                                     ↑ Same local IDs, different data!
```

**Correct Approach** (✅ Right):
```
PostgreSQL → 8 products (server ids 1-8)
   ↓
User 1 Browser → Pull sync → 8 products in IndexedDB (serverId 1-8, local id 1-8)
User 2 Browser → Pull sync → 8 products in IndexedDB (serverId 1-8, local id 9-16)
                                                       ↑ Same serverIds, consistent data!
```

**Action 1: Seed Demo Data in PostgreSQL Only**

Create a new file: `prisma/seed.ts`

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Seed products
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
      // ... other products
    ],
    skipDuplicates: true,
  });

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

**Action 2: Update package.json**

```json
{
  "prisma": {
    "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
  }
}
```

**Action 3: Remove Client-Side Seeding**

**File**: [src/lib/client/db.ts:218-423](../src/lib/client/db.ts#L218-L423)

**Current**:
```typescript
export async function seedInitialData() {
  // Seeds products locally
  await db.products.bulkAdd([...]);
}
```

**Updated**:
```typescript
export async function seedInitialData() {
  // ❌ REMOVE ALL SEEDING
  // Products and suppliers come from server via pull sync
  console.log('[Seri DB] Demo data comes from server, skipping local seed');
  return;
}
```

---

## Migration Plan

### Phase 1: Critical Fixes (Immediate)

1. ✅ **Fix Version 5 Duplication** (blocks P0/P1 testing)
   - Merge both version 5 definitions
   - Test with `localStorage.clear()` to force re-init

2. ✅ **Seed PostgreSQL** (fixes stock consistency)
   - Create `prisma/seed.ts`
   - Run `npx prisma db seed`
   - Verify data in Prisma Studio

3. ✅ **Remove Client Seeding** (prevents future issues)
   - Update `seedInitialData()` to be a no-op
   - Force users to pull from server

### Phase 2: Customer Table (Short-term)

4. ⏳ **Add Customer Model**
   - Update Prisma schema
   - Run migration: `npx prisma migrate dev --name add-customers`
   - Update IndexedDB to version 8
   - Update types

5. ⏳ **Update Sales Flow**
   - Add customer selection to new sale page
   - Update credit sale to use `customerId`
   - Add customer credit limit validation

### Phase 3: Testing (Before Production)

6. ⏳ **Test Multi-User Sync**
   - Clear both browsers' IndexedDB
   - User 1 logs in → Pull sync → Should see server products
   - User 2 logs in → Pull sync → Should see same products
   - User 1 sells 5 units → User 2 should see updated stock after pull sync

---

## Immediate Action Required

**Before continuing P0/P1 testing**, fix the version 5 duplication:

```typescript
// DELETE lines 121-134 (duplicate version 5)
// UPDATE lines 106-119 to include BOTH features:

this.version(5).stores({
  users: 'id, role',
  products: '++id, serverId, name, category, expirationDate, synced',
  sales: '++id, serverId, created_at, payment_method, payment_status, due_date, modified_at, user_id, customer_name, synced',
  sale_items: '++id, sale_id, product_id',
  expenses: '++id, serverId, date, category, supplier_order_id, user_id, synced',
  stock_movements: '++id, serverId, product_id, created_at, synced',
  sync_queue: '++id, type, status, idempotencyKey, localId, createdAt',
  suppliers: '++id, serverId, name, synced',
  supplier_orders: '++id, serverId, supplierId, status, dueDate, synced',
  supplier_returns: '++id, serverId, supplierId, productId, applied, synced',
  credit_payments: '++id, serverId, sale_id, payment_date, synced',
});
```

Then:
1. Clear IndexedDB in both browsers (DevTools → Application → IndexedDB → Delete)
2. Refresh both pages
3. Verify sync works correctly

---

## Summary

### Critical Issues
1. 🔴 **Version 5 defined twice** → Overwrites idempotencyKey indexes → Sync issues
2. 🔴 **Demo data seeded per browser** → Different stock levels per user → Not single source of truth
3. 🔴 **No customer table** → Can't track credit properly → Data inconsistency

### Immediate Fixes
1. Merge version 5 definitions
2. Seed PostgreSQL instead of client
3. Remove client-side seeding

### Short-term Improvements
1. Add Customer table
2. Update sales flow to use customerId
3. Add credit limit validation

---

**Next Steps**: Apply Fix 1 (merge version 5), then re-test P0/P1 sync improvements.

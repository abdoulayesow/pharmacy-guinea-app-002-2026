# Database Architecture Documentation

**Last Updated**: 2026-01-15
**Author**: System Analysis
**Status**: Review Required

---

## Table of Contents

1. [Overview](#overview)
2. [Dual Database Architecture](#dual-database-architecture)
3. [IndexedDB Schema (Dexie.js)](#indexeddb-schema-dexiejs)
4. [PostgreSQL Schema (Prisma)](#postgresql-schema-prisma)
5. [Schema Comparison & Mapping](#schema-comparison--mapping)
6. [Sync Mechanism](#sync-mechanism)
7. [API Interactions](#api-interactions)
8. [Identified Issues](#identified-issues)
9. [Recommended Improvements](#recommended-improvements)

---

## Overview

Seri uses a **dual-database architecture** for offline-first functionality:

- **Client (IndexedDB)**: Primary data store for PWA, enables offline operation
- **Server (PostgreSQL)**: Source of truth for multi-user collaboration and data persistence

**Architecture Pattern**: Offline-first with bidirectional sync

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (PWA)                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  IndexedDB (Dexie.js)                                      │ │
│  │  - Primary data store                                      │ │
│  │  - Works offline                                           │ │
│  │  - Auto-incremented local IDs                              │ │
│  │  - Sync queue for pending changes                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↕                                   │
│                    Sync Queue Processing                         │
│                              ↕                                   │
└─────────────────────────────────────────────────────────────────┘
                               ↕
                      /api/sync/push (POST)
                      /api/sync/pull (GET)
                               ↕
┌─────────────────────────────────────────────────────────────────┐
│                     Server (Vercel + Neon)                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  PostgreSQL (Prisma)                                       │ │
│  │  - Source of truth                                         │ │
│  │  - Multi-user support                                      │ │
│  │  - Server-assigned IDs                                     │ │
│  │  - Conflict resolution via timestamps                      │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Dual Database Architecture

### Why Dual Databases?

1. **Offline-First Requirement**: App must work without internet (< 12h electricity/day in Guinea)
2. **Multi-User Collaboration**: Multiple employees need to see each other's changes
3. **Data Reliability**: Local IndexedDB prevents data loss during outages
4. **Performance**: Local queries are instant, no network latency

### Data Flow

```
User Action → IndexedDB (immediate) → Sync Queue → Push to Server → Pull from Server
                    ↓                                                        ↓
              UI Update (optimistic)                           Merge remote changes
```

---

## IndexedDB Schema (Dexie.js)

**Location**: `src/lib/client/db.ts`
**Database Name**: `seri-db`
**Current Version**: 7

### Schema Evolution

IndexedDB uses versioned migrations. Current version: **7**

#### Version History

| Version | Changes |
|---------|---------|
| v1 | Initial schema (users, products, sales, sale_items, expenses, stock_movements, sync_queue) |
| v2 | Added supplier tables + expiration tracking |
| v3 | Added credit sales support (customer info + payment tracking) |
| v4 | Added payment_method index to sales |
| v5 | Added sale editing support (modified_at index) |
| v6 | Added supplier order items and product-supplier links |
| v7 | Unified orders/returns, added payment status and delivery confirmation |

### Tables

#### Core Tables

| Table | Primary Key | Indexes | Description |
|-------|-------------|---------|-------------|
| `users` | `id` (String) | `role` | User accounts (Google OAuth + PIN) |
| `products` | `++id` (auto) | `serverId`, `name`, `category`, `expirationDate`, `synced` | Product catalog with expiration tracking |
| `sales` | `++id` (auto) | `serverId`, `created_at`, `payment_method`, `payment_status`, `due_date`, `modified_at`, `user_id`, `customer_name`, `synced` | Sales transactions with credit support |
| `sale_items` | `++id` (auto) | `sale_id`, `product_id` | Line items for sales |
| `expenses` | `++id` (auto) | `serverId`, `date`, `category`, `supplier_order_id`, `user_id`, `synced` | Business expenses |
| `stock_movements` | `++id` (auto) | `serverId`, `product_id`, `created_at`, `supplier_order_id`, `synced` | Stock change audit trail |
| `sync_queue` | `++id` (auto) | `type`, `status`, `createdAt` | Pending sync operations |

#### Supplier Management Tables (Added v2-v7)

| Table | Primary Key | Indexes | Description |
|-------|-------------|---------|-------------|
| `suppliers` | `++id` (auto) | `serverId`, `name`, `synced` | Supplier directory |
| `supplier_orders` | `++id` (auto) | `serverId`, `supplierId`, `type`, `status`, `paymentStatus`, `dueDate`, `synced` | Orders and returns (unified) |
| `supplier_order_items` | `++id` (auto) | `serverId`, `order_id`, `product_id`, `synced` | Order line items |
| `supplier_returns` | `++id` (auto) | `serverId`, `supplierId`, `productId`, `applied`, `synced` | Legacy returns (kept for backward compatibility) |
| `product_suppliers` | `++id` (auto) | `serverId`, `product_id`, `supplier_id`, `is_primary`, `synced` | Product-supplier relationships |
| `credit_payments` | `++id` (auto) | `serverId`, `sale_id`, `payment_date`, `synced` | Partial payment tracking |

### Index Notation

- `++id`: Auto-incremented primary key
- `serverId`: Maps to PostgreSQL ID after sync
- `synced`: Boolean flag for sync status

### Example: Product Schema

```typescript
// IndexedDB (Dexie.js)
products: '++id, serverId, name, category, expirationDate, synced'

// Fields stored:
{
  id: 123,              // Local auto-increment
  serverId: 45,         // PostgreSQL ID after sync
  name: "Paracetamol 500mg",
  category: "Antidouleur",
  price: 15000,
  priceBuy: 10000,
  stock: 45,
  minStock: 10,
  expirationDate: new Date('2026-06-15'),
  lotNumber: 'LOT-2024-001',
  synced: true,
  updatedAt: new Date(),
}
```

---

## PostgreSQL Schema (Prisma)

**Location**: `prisma/schema.prisma`
**Provider**: PostgreSQL (Neon Serverless)

### Core Models

#### User Model

```prisma
model User {
  id            String    @id @default(cuid())
  name          String
  email         String?   @unique
  phone         String?
  pinHash       String?
  mustChangePin Boolean   @default(true)
  role          String    @default("EMPLOYEE")
  avatar        String?
  createdAt     DateTime  @default(now())

  // Relations
  accounts       Account[]
  sessions       Session[]
  sales          Sale[]
  expenses       Expense[]
  stockMovements StockMovement[]
}
```

**Key Differences from IndexedDB**:
- Uses `cuid()` for IDs (not auto-increment)
- Includes NextAuth relations (accounts, sessions)
- Stores `emailVerified` timestamp

#### Product Model

```prisma
model Product {
  id            Int       @id @default(autoincrement())
  name          String
  price         Int
  priceBuy      Int?
  stock         Int       @default(0)
  stockMin      Int       @default(10)
  category      String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  saleItems        SaleItem[]
  stockMovements   StockMovement[]
  productSuppliers ProductSupplier[]
}
```

**Missing Fields**:
- ❌ `expirationDate` - Present in IndexedDB but NOT in Prisma schema
- ❌ `lotNumber` - Present in IndexedDB but NOT in Prisma schema

#### Sale Model

```prisma
model Sale {
  id              Int       @id @default(autoincrement())
  total           Int
  paymentMethod   String
  paymentStatus   String    @default("PAID")
  paymentRef      String?
  amountPaid      Int       @default(0)
  amountDue       Int       @default(0)
  dueDate         DateTime?
  customerName    String?
  customerPhone   String?
  createdAt       DateTime  @default(now())
  userId          String
  modifiedAt      DateTime?
  modifiedBy      String?
  editCount       Int       @default(0)

  // Relations
  user            User             @relation(fields: [userId], references: [id])
  items           SaleItem[]
  creditPayments  CreditPayment[]
}
```

#### Supplier Models

```prisma
model Supplier {
  id               Int       @id @default(autoincrement())
  name             String
  phone            String?
  paymentTermsDays Int       @default(30)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  orders           SupplierOrder[]
  returns          SupplierReturn[]
  productSuppliers ProductSupplier[]
}

model SupplierOrder {
  id              Int       @id @default(autoincrement())
  supplierId      Int
  type            String    @default("ORDER")
  orderDate       DateTime  @default(now())
  deliveryDate    DateTime?
  totalAmount     Int
  calculatedTotal Int?
  amountPaid      Int       @default(0)
  dueDate         DateTime
  status          String    @default("PENDING")
  paymentStatus   String    @default("PENDING")
  cancelledAt     DateTime?
  notes           String?
  returnReason    String?
  returnProductId Int?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  supplier        Supplier            @relation(fields: [supplierId], references: [id])
  items           SupplierOrderItem[]
  appliedReturns  SupplierReturn[]    @relation("AppliedToOrder")

  @@index([type])
  @@index([paymentStatus])
}
```

---

## Schema Comparison & Mapping

### Field Naming Conventions

| IndexedDB (snake_case) | PostgreSQL (camelCase) | Notes |
|------------------------|------------------------|-------|
| `payment_method` | `paymentMethod` | ✅ Mapped in API |
| `payment_status` | `paymentStatus` | ✅ Mapped in API |
| `created_at` | `createdAt` | ✅ Mapped in API |
| `updated_at` | `updatedAt` | ✅ Mapped in API |
| `user_id` | `userId` | ✅ Mapped in API |
| `sale_id` | `saleId` | ✅ Mapped in API |
| `product_id` | `productId` | ✅ Mapped in API |

### Missing Fields in PostgreSQL

#### 🚨 Critical Issues

| Field | IndexedDB | PostgreSQL | Impact |
|-------|-----------|------------|--------|
| `expirationDate` | ✅ Present | ❌ Missing | **HIGH** - Expiration alerts won't sync |
| `lotNumber` | ✅ Present | ❌ Missing | **HIGH** - Lot tracking data lost on sync |

#### Other Differences

| Field | IndexedDB | PostgreSQL | Impact |
|-------|-----------|------------|--------|
| `minStock` | ✅ Present | `stockMin` | **LOW** - Naming inconsistency |
| `priceBuy` | ✅ Present | `priceBuy` | ✅ Consistent |
| `serverId` | ✅ Present | N/A (mapped to `id`) | ✅ Correct mapping |

### Type Mismatches

| Entity | IndexedDB Type | PostgreSQL Type | Issue |
|--------|----------------|-----------------|-------|
| User ID | `String` | `String (cuid)` | ✅ Compatible |
| Product ID | `Number (auto)` | `Int (autoincrement)` | ✅ Compatible |
| Sale ID | `Number (auto)` | `Int (autoincrement)` | ✅ Compatible |
| Timestamps | `Date` | `DateTime` | ✅ Compatible |

---

## Sync Mechanism

### Sync Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Sync Queue (IndexedDB)                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ { id: 1, type: 'SALE', action: 'CREATE',                  │ │
│  │   payload: {...}, status: 'PENDING', retryCount: 0 }       │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                               ↓
                    Push Sync (every 30s if online)
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│                   POST /api/sync/push                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Request Body:                                              │ │
│  │ {                                                          │ │
│  │   sales: [...],                                            │ │
│  │   expenses: [...],                                         │ │
│  │   products: [...],                                         │ │
│  │   suppliers: [...],                                        │ │
│  │   supplierOrders: [...],                                   │ │
│  │   ...                                                      │ │
│  │ }                                                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                               ↓                                  │
│              Conflict Resolution (Last Write Wins)               │
│                               ↓                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Response:                                                  │ │
│  │ {                                                          │ │
│  │   success: true,                                           │ │
│  │   synced: {                                                │ │
│  │     sales: { "123": 456 }, // localId -> serverId         │ │
│  │     expenses: { "789": 101 }                               │ │
│  │   }                                                        │ │
│  │ }                                                          │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                               ↓
                    Pull Sync (every 5 min)
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│            GET /api/sync/pull?lastSyncAt=2026-01-15T10:00:00Z   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Response:                                                  │ │
│  │ {                                                          │ │
│  │   success: true,                                           │ │
│  │   data: {                                                  │ │
│  │     products: [...],                                       │ │
│  │     sales: [...],                                          │ │
│  │     expenses: [...]                                        │ │
│  │   },                                                       │ │
│  │   serverTime: "2026-01-15T10:30:00Z"                       │ │
│  │ }                                                          │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                               ↓
                    Merge into IndexedDB
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│              Conflict Resolution (Compare updatedAt)             │
│  - If serverUpdatedAt > localUpdatedAt: Update local            │
│  - If localUpdatedAt > serverUpdatedAt: Keep local (will push)  │
└─────────────────────────────────────────────────────────────────┘
```

### Sync Types

**Location**: `src/lib/client/sync.ts`

| Type | Entities Synced | Frequency | Direction |
|------|----------------|-----------|-----------|
| Push Sync | Sales, Expenses, Products, StockMovements, Suppliers, SupplierOrders, SupplierOrderItems, SupplierReturns, ProductSuppliers, CreditPayments | Every 30s | Client → Server |
| Pull Sync | Same as above | Every 5 min | Server → Client |
| Initial Sync | All entities | On first login | Server → Client |
| Manual Sync | All entities | User-triggered | Bidirectional |

### Conflict Resolution Strategy

**Algorithm**: Last Write Wins (LWW)

```typescript
// Push Sync Conflict Resolution (src/app/api/sync/push/route.ts)
if (existingRecord) {
  const serverUpdatedAt = existingRecord.updatedAt;
  const localUpdatedAt = new Date(localRecord.updatedAt);

  if (localUpdatedAt > serverUpdatedAt) {
    // Local is newer - update server
    await prisma.update({ where: { id }, data: localRecord });
  } else {
    // Server wins - keep server version
    // (Local will be overwritten on next pull)
  }
}

// Pull Sync Conflict Resolution (src/lib/client/sync.ts)
if (existingLocal) {
  const serverUpdatedAt = new Date(serverRecord.updatedAt);
  const localUpdatedAt = new Date(existingLocal.updatedAt);

  if (serverUpdatedAt >= localUpdatedAt) {
    // Server wins - update local
    await db.products.update(existingLocal.id, serverRecord);
  } else {
    // Local is newer - keep local (will be pushed on next sync)
  }
}
```

### Sync Queue Processing

**Location**: `src/lib/client/sync.ts` → `processSyncQueue()`

1. Check if online (`navigator.onLine`)
2. Get pending items (`status: 'PENDING' | 'FAILED'`)
3. Prepare payload by type
4. POST to `/api/sync/push`
5. Map `localId` → `serverId` from response
6. Update IndexedDB records with `serverId`
7. Mark sync queue items as `SYNCED`
8. On failure: Retry with exponential backoff (max 3 retries)

---

## API Interactions

### Push Sync API

**Endpoint**: `POST /api/sync/push`
**Location**: `src/app/api/sync/push/route.ts`

#### Request Flow

```typescript
// 1. Authentication
const user = await requireAuth(request);

// 2. Parse request body
const { sales, expenses, products, ... } = await request.json();

// 3. Sync each entity type
for (const sale of sales) {
  // Find existing by serverId
  const existing = await prisma.sale.findUnique({ where: { id: sale.serverId } });

  if (existing) {
    // Conflict resolution: compare timestamps
    if (localUpdatedAt > serverUpdatedAt) {
      await prisma.sale.update({ where: { id }, data: {...} });
    }
  } else {
    // Create new record
    const newSale = await prisma.sale.create({ data: {...} });
    syncedSales[sale.id] = newSale.id; // Map localId -> serverId
  }
}

// 4. Return mapping of localId -> serverId
return { success: true, synced: { sales: {...}, expenses: {...} } };
```

#### Response Format

```typescript
{
  success: true,
  synced: {
    sales: { "123": 456 },      // localId -> serverId
    expenses: { "789": 101 },
    products: { "111": 222 },
    ...
  },
  errors: ["Failed to sync sale 555: ..."]
}
```

### Pull Sync API

**Endpoint**: `GET /api/sync/pull?lastSyncAt=2026-01-15T10:00:00Z`
**Location**: `src/app/api/sync/pull/route.ts`

#### Request Flow

```typescript
// 1. Authentication
const user = await requireAuth(request);

// 2. Get lastSyncAt from query params
const lastSyncAt = searchParams.get('lastSyncAt')
  ? new Date(searchParams.get('lastSyncAt'))
  : null;

// 3. Query entities updated since lastSyncAt
const products = await prisma.product.findMany({
  where: { updatedAt: { gt: lastSyncAt } }
});

const sales = await prisma.sale.findMany({
  where: {
    OR: [
      { createdAt: { gt: lastSyncAt } },
      { modifiedAt: { gt: lastSyncAt } }
    ]
  },
  include: { items: true } // Include nested sale items
});

// 4. Transform Prisma models to client types (camelCase -> snake_case)
const transformedProducts = products.map(p => ({
  id: p.id,
  serverId: p.id,
  name: p.name,
  price: p.price,
  minStock: p.stockMin, // Naming inconsistency here
  synced: true
}));

// 5. Return data + serverTime
return {
  success: true,
  data: { products, sales, expenses, ... },
  serverTime: new Date()
};
```

#### Response Format

```typescript
{
  success: true,
  data: {
    products: [
      { id: 456, serverId: 456, name: "Paracetamol", ... }
    ],
    sales: [
      { id: 789, serverId: 789, total: 50000, items: [...] }
    ],
    expenses: [...],
    stockMovements: [...],
    suppliers: [...],
    supplierOrders: [...],
    supplierOrderItems: [...],
    supplierReturns: [...],
    productSuppliers: [...],
    creditPayments: [...]
  },
  serverTime: "2026-01-15T10:30:00Z"
}
```

---

## Identified Issues

### 🚨 Critical Issues

#### 1. Missing Fields in PostgreSQL Schema

**Severity**: HIGH
**Impact**: Data loss on sync

| Field | Present in IndexedDB | Present in PostgreSQL | User Feature |
|-------|---------------------|----------------------|--------------|
| `expirationDate` | ✅ | ❌ | Expiration alerts (MVP feature) |
| `lotNumber` | ✅ | ❌ | Lot tracking (MVP feature) |

**Problem**:
- Users can add products with expiration dates and lot numbers in IndexedDB
- When synced to PostgreSQL, these fields are **silently dropped**
- When pulled back from server, products lose expiration tracking
- Expiration alerts stop working after sync

**Evidence**:
```typescript
// src/lib/client/db.ts:224
{
  name: 'Paracetamol 500mg',
  expirationDate: new Date('2026-06-15'), // ✅ Stored locally
  lotNumber: 'LOT-2024-001',              // ✅ Stored locally
  ...
}

// prisma/schema.prisma:75-92
model Product {
  id         Int      @id @default(autoincrement())
  name       String
  price      Int
  // ❌ expirationDate NOT DEFINED
  // ❌ lotNumber NOT DEFINED
}

// src/app/api/sync/push/route.ts:252 (silently ignores these fields)
const newProduct = await prisma.product.create({
  data: {
    name: product.name,
    price: product.price,
    // expirationDate: product.expirationDate, // ❌ NOT SYNCED
    // lotNumber: product.lotNumber,           // ❌ NOT SYNCED
  }
});
```

#### 2. Naming Inconsistencies

**Severity**: MEDIUM
**Impact**: Confusion, potential bugs

| IndexedDB Field | PostgreSQL Field | Issue |
|----------------|------------------|-------|
| `minStock` | `stockMin` | Inconsistent naming |
| `priceBuy` | `priceBuy` | ✅ Consistent |

**Problem**:
- Code uses different field names for the same concept
- Pull sync transforms `stockMin` → `minStock` but this is error-prone
- Developers must remember two different names

**Evidence**:
```typescript
// src/lib/client/db.ts (IndexedDB)
minStock: 10

// prisma/schema.prisma (PostgreSQL)
stockMin: Int @default(10)

// src/app/api/sync/pull/route.ts:138 (manual transformation required)
minStock: p.stockMin, // Developer must remember to map this
```

#### 3. SaleItem Sync Issues

**Severity**: HIGH
**Impact**: Incomplete sales data

**Problem**:
- Sale items are stored separately in IndexedDB (`sale_items` table)
- Push sync creates sales but **does NOT sync sale items**
- Pull sync returns sale items nested in sales, but no code to merge them into `sale_items` table

**Evidence**:
```typescript
// Push sync (src/app/api/sync/push/route.ts:92)
const newSale = await prisma.sale.create({
  data: {
    total: sale.total,
    // ❌ items: sale.items NOT INCLUDED
  }
});
// Sale items are never created in PostgreSQL!

// Pull sync (src/app/api/sync/pull/route.ts:162)
items: s.items.map((item) => ({
  id: item.id,
  sale_id: item.saleId,
  product_id: item.productId,
  ...
}))
// Returns nested items, but mergePulledData() doesn't handle them
```

#### 4. Stock Integrity Risk

**Severity**: HIGH
**Impact**: Stock count desync between users

**Problem**:
- Stock updates happen in two places:
  1. Product `stock` field
  2. StockMovement records
- If sync conflicts occur, stock count can desync from movement history
- No reconciliation mechanism

**Example Scenario**:
```
User A (offline):
- Sells 5 units of Product X
- Local stock: 50 → 45
- StockMovement: -5 (SALE)

User B (offline):
- Adjusts Product X inventory
- Local stock: 50 → 48
- StockMovement: -2 (ADJUSTMENT)

Both sync to server:
- Conflict: Which stock value wins? (Last Write Wins → 48)
- StockMovements show -7 total change
- But stock only changed by -2
- Data integrity violation!
```

### ⚠️ Medium Issues

#### 5. Supplier Order Type Migration Incomplete

**Severity**: MEDIUM
**Impact**: Confusion between old and new data models

**Problem**:
- Version 7 migration unifies orders and returns into `supplier_orders` table with `type` field
- But `supplier_returns` table still exists (kept for "backward compatibility")
- Unclear when to use which table
- API sync handles both tables separately

**Evidence**:
```typescript
// db.ts:138 (Version 7 migration)
supplier_orders: '++id, serverId, supplierId, type, status, paymentStatus, dueDate, synced'
supplier_returns: '++id, serverId, supplierId, productId, applied, synced' // Keep for backward compatibility

// types.ts:264-267
/**
 * @deprecated Use SupplierOrder with type='RETURN' instead
 */
export interface SupplierReturn { ... }
```

#### 6. No Validation on Type Fields

**Severity**: MEDIUM
**Impact**: Invalid data can be stored

**Problem**:
- IndexedDB doesn't enforce type constraints
- String fields like `status`, `type`, `payment_method` can have any value
- PostgreSQL has `String` type (not enum) so also doesn't enforce
- Invalid values can propagate through sync

**Example**:
```typescript
// IndexedDB allows:
await db.sales.add({
  payment_method: "INVALID_METHOD", // ❌ Should be CASH | ORANGE_MONEY | CREDIT
  payment_status: "WRONG_STATUS",   // ❌ Should be PAID | PENDING | etc.
});

// No error thrown, syncs to server with invalid data
```

### ℹ️ Low Issues

#### 7. Redundant `totalAmount` vs `calculatedTotal`

**Severity**: LOW
**Impact**: Confusion, potential data inconsistency

**Problem**:
- `SupplierOrder` has both `totalAmount` and `calculatedTotal`
- Documentation says `totalAmount` is "kept for backward compatibility"
- Unclear which one to trust if they differ

**Evidence**:
```typescript
// types.ts:218-219
totalAmount: number; // Total order/return amount in GNF (kept for backward compatibility)
calculatedTotal?: number; // Calculated from order items (preferred)
```

#### 8. Sync Queue Never Clears Old Synced Items

**Severity**: LOW
**Impact**: Database bloat over time

**Problem**:
- Sync queue items marked as `SYNCED` are never deleted
- Over months of usage, `sync_queue` table grows indefinitely
- No cleanup mechanism

**Recommendation**: Add periodic cleanup of old SYNCED items (e.g., delete items older than 30 days)

---

## Recommended Improvements

### Priority 1: Critical Fixes

#### Fix 1: Add Missing Fields to PostgreSQL Schema

**File**: `prisma/schema.prisma`

```prisma
model Product {
  id              Int       @id @default(autoincrement())
  name            String
  price           Int
  priceBuy        Int?
  stock           Int       @default(0)
  stockMin        Int       @default(10)
  category        String?
  expirationDate  DateTime? @map("expiration_date") // 🆕 ADD THIS
  lotNumber       String?   @map("lot_number")      // 🆕 ADD THIS
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  saleItems        SaleItem[]
  stockMovements   StockMovement[]
  productSuppliers ProductSupplier[]

  @@map("products")
}
```

**Migration Required**: Yes

```sql
-- Add missing columns
ALTER TABLE products ADD COLUMN expiration_date TIMESTAMP;
ALTER TABLE products ADD COLUMN lot_number VARCHAR(255);
```

**Update Push Sync**: `src/app/api/sync/push/route.ts`

```typescript
const newProduct = await prisma.product.create({
  data: {
    name: product.name,
    price: product.price,
    priceBuy: product.priceBuy || null,
    stock: product.stock,
    stockMin: product.minStock || 10,
    category: product.category || null,
    expirationDate: product.expirationDate ? new Date(product.expirationDate) : null, // 🆕
    lotNumber: product.lotNumber || null, // 🆕
  },
});
```

**Update Pull Sync**: `src/app/api/sync/pull/route.ts`

```typescript
const transformedProducts = products.map((p) => ({
  id: p.id,
  serverId: p.id,
  name: p.name,
  category: p.category || '',
  price: p.price,
  priceBuy: p.priceBuy || undefined,
  stock: p.stock,
  minStock: p.stockMin,
  expirationDate: p.expirationDate || undefined, // 🆕
  lotNumber: p.lotNumber || undefined,           // 🆕
  synced: true,
  updatedAt: p.updatedAt,
}));
```

#### Fix 2: Sync Sale Items

**Update Push Sync**: `src/app/api/sync/push/route.ts`

```typescript
// After creating sale, sync sale items
if (sale.items && sale.items.length > 0) {
  for (const item of sale.items) {
    await prisma.saleItem.create({
      data: {
        saleId: newSale.id,
        productId: item.product_id,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        subtotal: item.subtotal,
      },
    });
  }
}
```

**Update Pull Sync Merge**: `src/lib/client/sync.ts`

```typescript
// In mergePulledData(), add sale items merge
for (const sale of data.sales) {
  // ... merge sale ...

  // Merge sale items
  if (sale.items) {
    for (const item of sale.items) {
      const existingItem = await db.sale_items
        .where({ sale_id: localSaleId, product_id: item.product_id })
        .first();

      if (!existingItem) {
        await db.sale_items.add({
          sale_id: localSaleId,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.subtotal,
        });
      }
    }
  }
}
```

#### Fix 3: Stock Reconciliation

**Add Reconciliation Function**: `src/lib/client/sync.ts`

```typescript
/**
 * Reconcile product stock from stock movements
 * Ensures stock count matches sum of movements
 */
async function reconcileProductStock(productId: number): Promise<void> {
  // Calculate expected stock from movements
  const movements = await db.stock_movements
    .where('product_id')
    .equals(productId)
    .toArray();

  const totalChange = movements.reduce((sum, m) => sum + m.quantity_change, 0);

  // Get current stock
  const product = await db.products.get(productId);
  if (!product) return;

  // If mismatch, log warning and create adjustment movement
  if (product.stock !== totalChange) {
    console.warn(`[Sync] Stock mismatch for product ${productId}: expected ${totalChange}, actual ${product.stock}`);

    // Create reconciliation movement
    await db.stock_movements.add({
      product_id: productId,
      type: 'ADJUSTMENT',
      quantity_change: totalChange - product.stock,
      reason: 'Stock reconciliation after sync conflict',
      created_at: new Date(),
      user_id: 'system',
      synced: false,
    });

    // Update stock
    await db.products.update(productId, { stock: totalChange });
  }
}

// Call after pull sync
export async function pullFromServer() {
  // ... existing code ...

  // Reconcile stock for all pulled products
  for (const product of data.products) {
    if (product.serverId) {
      const local = await db.products.where('serverId').equals(product.serverId).first();
      if (local?.id) {
        await reconcileProductStock(local.id);
      }
    }
  }
}
```

### Priority 2: Naming Consistency

#### Fix 4: Standardize Field Names

**Option A**: Rename PostgreSQL field (Breaking change, requires migration)

```prisma
model Product {
  minStock Int @default(10) @map("min_stock") // Changed from stockMin
}
```

**Option B**: Rename IndexedDB field (Non-breaking, update client code)

```typescript
// Update all client code to use stockMin instead of minStock
products: '++id, serverId, name, category, expirationDate, stockMin, synced'
```

**Recommendation**: Use Option A for consistency with other `snake_case` database columns.

### Priority 3: Data Validation

#### Fix 5: Add Enum Constraints to PostgreSQL

```prisma
enum PaymentMethod {
  CASH
  ORANGE_MONEY
  CREDIT
}

enum PaymentStatus {
  PAID
  PARTIALLY_PAID
  PENDING
  OVERDUE
}

enum SupplierOrderStatus {
  PENDING
  DELIVERED
  CANCELLED
}

model Sale {
  paymentMethod   PaymentMethod // Changed from String
  paymentStatus   PaymentStatus // Changed from String
}

model SupplierOrder {
  status          SupplierOrderStatus // Changed from String
}
```

**Migration Required**: Yes (convert String columns to enum)

#### Fix 6: Add Client-Side Validation

**File**: `src/lib/shared/validators.ts` (NEW)

```typescript
import { z } from 'zod';

export const PaymentMethodSchema = z.enum(['CASH', 'ORANGE_MONEY', 'CREDIT']);
export const PaymentStatusSchema = z.enum(['PAID', 'PARTIALLY_PAID', 'PENDING', 'OVERDUE']);

export const SaleSchema = z.object({
  total: z.number().positive(),
  payment_method: PaymentMethodSchema,
  payment_status: PaymentStatusSchema,
  customer_name: z.string().optional(),
  // ... other fields
});

// Use in forms and API
const sale = SaleSchema.parse(formData); // Throws if invalid
```

### Priority 4: Performance Optimizations

#### Fix 7: Sync Queue Cleanup

**File**: `src/lib/client/sync.ts`

```typescript
/**
 * Clean up old synced items from queue (older than 30 days)
 */
export async function cleanupSyncQueue(): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const oldItems = await db.sync_queue
    .where('status')
    .equals('SYNCED')
    .and(item => item.createdAt < thirtyDaysAgo)
    .toArray();

  for (const item of oldItems) {
    if (item.id) {
      await db.sync_queue.delete(item.id);
    }
  }

  return oldItems.length;
}

// Run periodically (e.g., on app startup or daily)
setupBackgroundSync() {
  // ... existing code ...

  // Cleanup old sync queue items daily
  setInterval(() => {
    cleanupSyncQueue().then(count => {
      console.log(`[Sync] Cleaned up ${count} old sync queue items`);
    });
  }, 24 * 60 * 60 * 1000); // 24 hours
}
```

#### Fix 8: Index Optimization

**Add Missing Indexes**:

```prisma
model Sale {
  // ... fields ...

  @@index([paymentStatus])  // 🆕 For filtering unpaid sales
  @@index([dueDate])        // 🆕 For overdue alerts
  @@index([createdAt])      // 🆕 For date range queries
}

model Product {
  // ... fields ...

  @@index([expirationDate]) // 🆕 For expiration alerts
  @@index([stock])          // 🆕 For low stock alerts
}
```

### Priority 5: Code Organization

#### Fix 9: Remove Deprecated `SupplierReturn` Table

**Phase 1**: Migrate existing data to `SupplierOrder` with `type='RETURN'`

```typescript
// Migration script
async function migrateReturnsToOrders() {
  const returns = await db.supplier_returns.toArray();

  for (const ret of returns) {
    await db.supplier_orders.add({
      supplierId: ret.supplierId,
      type: 'RETURN',
      orderDate: ret.returnDate,
      totalAmount: ret.creditAmount,
      amountPaid: ret.applied ? ret.creditAmount : 0,
      dueDate: ret.returnDate,
      status: 'DELIVERED',
      paymentStatus: ret.applied ? 'PAID' : 'PENDING',
      returnReason: ret.reason,
      returnProductId: ret.productId,
      createdAt: ret.createdAt,
      updatedAt: new Date(),
      synced: false,
    });
  }

  // Clear old table
  await db.supplier_returns.clear();
}
```

**Phase 2**: Remove table from schema (Version 8)

```typescript
// db.ts - Version 8
this.version(8).stores({
  // ... all existing tables ...
  // supplier_returns: null, // 🗑️ Remove deprecated table
});
```

---

## Summary of Critical Actions

### Immediate Actions (Must Fix Before Production)

1. ✅ **Add `expirationDate` and `lotNumber` to Prisma schema** → Data loss prevention
2. ✅ **Fix sale items sync** → Complete sales data
3. ✅ **Implement stock reconciliation** → Data integrity

### Short-Term Improvements (Next Sprint)

4. ✅ **Standardize field naming** (`stockMin` vs `minStock`)
5. ✅ **Add enum constraints** to prevent invalid data
6. ✅ **Add client-side validation** (Zod schemas)

### Long-Term Optimizations (Future)

7. ✅ **Sync queue cleanup** (prevent bloat)
8. ✅ **Add database indexes** (performance)
9. ✅ **Migrate away from deprecated tables** (`supplier_returns`)

---

## Testing Checklist

After implementing fixes, test:

- [ ] Create product with expiration date → Sync → Verify expiration date preserved
- [ ] Create product with lot number → Sync → Verify lot number preserved
- [ ] Create sale with items → Sync → Verify sale items appear on other devices
- [ ] Multi-user stock adjustment → Verify stock count reconciles correctly
- [ ] Invalid payment method → Verify validation error
- [ ] Sync queue with 1000+ items → Verify cleanup works
- [ ] Offline mode → Create data → Come online → Verify bidirectional sync

---

**Document Status**: ✅ Complete
**Next Steps**: Review with team, prioritize fixes, create migration plan

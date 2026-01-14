# Offline-First Data Synchronization Flow

> Complete explanation of how data flows between IndexedDB (local) and PostgreSQL (server) in Seri PWA

---

## Overview: Two Databases

| Database | Location | Purpose | Technology |
|----------|----------|---------|------------|
| **IndexedDB** | Browser (client) | Primary storage - always available | Dexie.js |
| **PostgreSQL** | Server (cloud) | Backup & multi-device sync | Prisma + Neon |

**Golden Rule**: The app works as if it were always offline. Network connectivity is a bonus.

---

## Multi-User Support

### Architecture

✅ **Yes, the app supports multiple users!**

- **Each user** has their own IndexedDB (client-side, per device)
- **All users** sync to the same PostgreSQL database (server-side, shared)
- Each transaction is tagged with `userId` to track who created/modified it
- Authentication ensures users only see/modify their own data (with role-based permissions)

### Current Status (MVP)

| Feature | Status | Notes |
|---------|--------|-------|
| **Push Sync** (Local → Server) | ✅ Implemented | Users can push their changes to server |
| **Pull Sync** (Server → Local) | 🚧 Phase 2 | Users will see other users' changes when implemented |
| **Real-time Updates** | 🚧 Phase 2 | Will use polling or WebSockets |

### How Multi-User Sync Works (When Fully Implemented)

```
User A (Device 1)                    User B (Device 2)
     │                                    │
     ├─ Creates Sale #1                  │
     │  Saves to IndexedDB (local)       │
     │  Pushes to PostgreSQL (server)     │
     │                                    │
     │                                    ├─ Pulls changes from server
     │                                    │  Sees Sale #1 from User A
     │                                    │  Updates local IndexedDB
     │                                    │  UI updates automatically
```

**When Pull Sync is Implemented (Phase 2):**
1. User A creates a sale → saves locally → pushes to server
2. User B's device periodically pulls changes from server (every 5 minutes or on-demand)
3. User B's IndexedDB is updated with User A's sale
4. User B's UI automatically updates via Dexie React Hooks
5. Both users see the same data when online

**Conflict Resolution:**
- Uses "Last Write Wins" strategy
- Conflicts are logged for audit
- Each record has `createdAt` and `updatedAt` timestamps

---

## Scenario 1: When ONLINE ⚡

### Creating Data (e.g., New Sale)

```typescript
// User creates a sale
async function createSale(saleData: Sale) {
  // STEP 1: Save to IndexedDB FIRST (immediate, always works)
  const localId = await db.sales.add({
    ...saleData,
    synced: false,  // Mark as not synced yet
    createdAt: new Date(),
  });
  
  // STEP 2: Queue for server sync (non-blocking)
  await queueTransaction('SALE', 'CREATE', saleData, localId);
  
  // STEP 3: Show success immediately (optimistic UI)
  toast.success('Vente enregistrée');
  
  // STEP 4: Try immediate sync if online
  if (navigator.onLine) {
    processSyncQueue(); // Background sync
  }
  
  return localId;
}
```

**Flow Diagram:**
```
User Action (Create Sale)
    ↓
1. Save to IndexedDB (instant) ✅
    ↓
2. Add to Sync Queue (PENDING) 📋
    ↓
3. Show Success Toast (optimistic UI) 🎉
    ↓
4. Background Sync (if online) 🔄
    ├─→ POST /api/sync/push
    ├─→ Server saves to PostgreSQL
    ├─→ Server returns serverId
    └─→ Update IndexedDB: synced=true, serverId=xxx
```

### Reading Data (e.g., View Products)

```typescript
// Always read from IndexedDB (fast, offline-safe)
const products = useLiveQuery(() => db.products.toArray()) ?? [];
```

**Flow:**
```
Component Renders
    ↓
Read from IndexedDB (instant) 📦
    ↓
Display in UI (live updates via Dexie React Hooks) 🖥️
```

**Note**: Data is pulled from server on initial load or when explicitly syncing, but all reads come from IndexedDB.

---

## Scenario 2: When OFFLINE 📴

### Creating Data (e.g., New Sale)

```typescript
// Same code works offline!
async function createSale(saleData: Sale) {
  // STEP 1: Save to IndexedDB (works offline)
  const localId = await db.sales.add({
    ...saleData,
    synced: false,  // Will sync later
    createdAt: new Date(),
  });
  
  // STEP 2: Queue for later sync
  await queueTransaction('SALE', 'CREATE', saleData, localId);
  
  // STEP 3: Show success (user doesn't know we're offline)
  toast.success('Vente enregistrée');
  
  // STEP 4: Sync fails silently (queued for later)
  if (navigator.onLine) {
    processSyncQueue(); // Won't run - offline
  }
  
  return localId;
}
```

**Flow Diagram:**
```
User Action (Create Sale)
    ↓
1. Save to IndexedDB (instant) ✅
    ↓
2. Add to Sync Queue (PENDING) 📋
    ↓
3. Show Success Toast 🎉
    ↓
4. Background Sync Attempt ❌
    └─→ navigator.onLine = false
    └─→ Queue item stays PENDING
    └─→ Will sync when online
```

### Reading Data (e.g., View Products)

```typescript
// Still reads from IndexedDB (works perfectly offline)
const products = useLiveQuery(() => db.products.toArray()) ?? [];
```

**Flow:**
```
Component Renders
    ↓
Read from IndexedDB (instant, offline-safe) 📦
    ↓
Display in UI (shows last synced data) 🖥️
```

---

## Scenario 3: Transitioning OFFLINE → ONLINE 🔄

### Automatic Sync Trigger

```typescript
// src/lib/client/sync.ts - setupBackgroundSync()

// 1. Listen for 'online' event
window.addEventListener('online', () => {
  console.log('Device is online - starting sync');
  processSyncQueue(); // Automatically sync pending items
});

// 2. Periodic check (every 30 seconds)
setInterval(() => {
  if (navigator.onLine) {
    getPendingCount().then((count) => {
      if (count > 0) {
        processSyncQueue(); // Sync if there are pending items
      }
    });
  }
}, 30000);
```

### Sync Process

```typescript
// src/lib/client/sync.ts - processSyncQueue()

async function processSyncQueue() {
  // 1. Check if online
  if (!navigator.onLine) {
    return { synced: 0, failed: 0, errors: ['Device is offline'] };
  }
  
  // 2. Get all pending items
  const pendingItems = await getPendingItems();
  // Items with status: 'PENDING' or 'FAILED'
  
  // 3. Prepare payload
  const payload = await prepareSyncPayload();
  // Groups items by type: sales, expenses, products, etc.
  
  // 4. Send to server
  const response = await fetch('/api/sync/push', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  
  // 5. Mark items as synced
  for (const item of pendingItems) {
    await markSynced(item.id, serverId);
    // Updates IndexedDB: synced=true, serverId=xxx
  }
}
```

**Flow Diagram:**
```
Device Goes Online
    ↓
'online' Event Fired 📡
    ↓
processSyncQueue() Called
    ↓
1. Get PENDING items from sync_queue table
    ↓
2. Group by type (sales, expenses, products)
    ↓
3. POST /api/sync/push with all pending data
    ↓
4. Server saves to PostgreSQL
    ↓
5. Server returns serverIds
    ↓
6. Update IndexedDB:
   - Mark items as SYNCED ✅
   - Store serverId for each item
   - Update synced flag on records
```

### Retry Logic

```typescript
// If sync fails, retry with exponential backoff
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000; // 1 second
const EXPONENTIAL_BACKOFF = 2; // Double each retry

// Retry 1: After 1 second
// Retry 2: After 2 seconds  
// Retry 3: After 4 seconds
// Then mark as FAILED permanently
```

---

## Complete Example: Creating a Sale

### Step-by-Step Flow

```typescript
// User clicks "Finaliser la vente"
const handleCompleteSale = async () => {
  // ============================================
  // PHASE 1: SAVE LOCALLY (Always works)
  // ============================================
  
  // 1. Create sale record in IndexedDB
  const saleId = await db.sales.add({
    total: 50000,
    paymentMethod: 'CASH',
    userId: currentUser.id,
    synced: false,  // Not synced yet
    createdAt: new Date(),
  });
  
  // 2. Create sale items in IndexedDB
  for (const item of cartItems) {
    await db.sale_items.add({
      saleId,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.price,
      subtotal: item.quantity * item.price,
    });
  }
  
  // 3. Update product stock in IndexedDB
  await db.products.update(item.productId, {
    stock: product.stock - item.quantity,
  });
  
  // 4. Create stock movement in IndexedDB
  await db.stock_movements.add({
    productId: item.productId,
    type: 'SALE',
    quantityChange: -item.quantity,
    userId: currentUser.id,
    synced: false,
  });
  
  // ============================================
  // PHASE 2: QUEUE FOR SYNC
  // ============================================
  
  // 5. Queue sale for sync
  await queueTransaction('SALE', 'CREATE', {
    id: saleId,
    total: 50000,
    paymentMethod: 'CASH',
    // ... full sale data
  }, saleId);
  
  // 6. Queue stock movement for sync
  await queueTransaction('STOCK_MOVEMENT', 'CREATE', {
    productId: item.productId,
    type: 'SALE',
    quantityChange: -item.quantity,
    // ... full movement data
  });
  
  // ============================================
  // PHASE 3: OPTIMISTIC UI
  // ============================================
  
  // 7. Show success (user sees this immediately)
  toast.success('Vente enregistrée');
  router.push('/ventes/historique');
  
  // ============================================
  // PHASE 4: BACKGROUND SYNC (if online)
  // ============================================
  
  // 8. Try to sync immediately
  if (navigator.onLine) {
    processSyncQueue(); // Runs in background
  }
  // If offline, sync will happen automatically when online
};
```

---

## Sync Queue States

| Status | Meaning | What Happens Next |
|--------|---------|-------------------|
| `PENDING` | Queued, waiting to sync | Will sync when online |
| `SYNCING` | Currently being sent to server | Wait for response |
| `SYNCED` | Successfully synced to server | Done ✅ |
| `FAILED` | Sync failed (will retry) | Retry with backoff (max 3 times) |

---

## Multi-User Visibility (Phase 2)

### Current Status: Push-Only (MVP)

**What works now:**
- ✅ Each user can create/modify data offline
- ✅ Each user's changes are pushed to the server when online
- ✅ All users' data is stored in the same PostgreSQL database

**What's coming in Phase 2:**
- 🚧 Pull sync: Users will see other users' changes
- 🚧 Periodic background sync (every 5 minutes)
- 🚧 On-demand sync (pull button in settings)
- 🚧 Real-time updates (WebSockets or polling)

### How It Will Work (Phase 2)

```typescript
// User A creates a sale
User A → IndexedDB → Push to Server → PostgreSQL

// User B sees User A's sale
User B → Pull from Server → Update IndexedDB → UI Updates
```

**Example Flow:**
1. User A (Employee 1) creates Sale #100 offline
2. User A goes online → Sale #100 is pushed to server
3. User B (Employee 2) goes online → Pulls changes from server
4. User B's IndexedDB is updated with Sale #100
5. User B's UI automatically shows Sale #100 (via Dexie React Hooks)

---

## Data Consistency

### Conflict Resolution

Currently using **"Last Write Wins"** strategy:
- If same record is modified on multiple devices
- The last write to server wins
- Conflicts are logged for manual review (Phase 2)

### Sync Order

1. **Sales** (most critical - money transactions)
2. **Stock Movements** (inventory accuracy)
3. **Expenses** (financial tracking)
4. **Products** (catalog updates)

---

## Monitoring Sync Status

```typescript
// Check pending items
const pendingCount = await getPendingCount();

// Get sync statistics
const stats = await getSyncStats();
// {
//   total: 150,
//   pending: 5,
//   syncing: 1,
//   synced: 144,
//   failed: 0
// }
```

**UI Indicators:**
- Settings page shows: "X opérations en attente"
- Green dot = All synced
- Yellow dot = Pending sync
- Red dot = Sync failed

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/client/db.ts` | IndexedDB schema & operations |
| `src/lib/client/sync.ts` | Sync queue management |
| `src/app/api/sync/push/route.ts` | Server endpoint (receives data) |
| `src/app/api/sync/pull/route.ts` | Server endpoint (sends data) |
| `src/stores/sync.ts` | Zustand store for sync state |

---

## Summary

### ✅ When Online
1. Save to IndexedDB first
2. Queue for sync
3. Show success immediately
4. Sync in background
5. Update IndexedDB with serverId

### ✅ When Offline
1. Save to IndexedDB first
2. Queue for sync
3. Show success immediately
4. Sync fails silently (queued)
5. Wait for online event

### ✅ Offline → Online
1. `online` event fires
2. `processSyncQueue()` runs automatically
3. All pending items synced
4. IndexedDB updated with serverIds
5. UI updates via Dexie React Hooks

### ✅ Multi-User Support

**Current (MVP):**
- ✅ Multiple users can use the app simultaneously
- ✅ Each user has their own IndexedDB (per device)
- ✅ All users' data syncs to the same PostgreSQL database
- ✅ Push sync works (local → server)
- 🚧 Pull sync coming in Phase 2 (server → local)

**Phase 2 (Planned):**
- Users will see other users' changes via pull sync
- Background sync every 5 minutes
- On-demand sync button
- Real-time updates

**The app always works, whether online or offline!** 🎉

**Note:** Currently, users can push their changes to the server, but cannot yet pull other users' changes. This will be implemented in Phase 2.


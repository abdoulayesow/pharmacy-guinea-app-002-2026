/**
 * Offline-first sync queue management
 * Handles queuing, processing, and retrying transactions
 */

import { db } from './db';
import type { SyncQueueItem, Sale, SaleItem, Expense, Product, StockoutReport, SalePrescription } from '@/lib/shared/types';
import { generateLocalId } from '@/lib/shared/utils';

// Constants
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000; // 1 second base delay
const EXPONENTIAL_BACKOFF = 2; // Double delay each retry
const SYNC_TIMEOUT_MS = 30000; // 30 seconds per sync request
const CONNECTIVITY_CHECK_TIMEOUT_MS = 5000; // 5 seconds for connectivity check

/**
 * Check if we have actual internet connectivity (not just network interface)
 *
 * This function verifies that:
 * - Network interface is connected (navigator.onLine)
 * - Server is actually reachable (HEAD request to /api/health)
 * - Response is received within 5 seconds
 *
 * Benefits for Guinea context:
 * - Avoids failed sync attempts on poor 3G connections
 * - Saves data costs when WiFi is connected but has no internet
 * - Prevents wasted battery on unreachable server
 *
 * @returns {Promise<boolean>} True if actually connected to internet
 */
async function isActuallyOnline(): Promise<boolean> {
  // Quick check: if network interface is down, no need to ping server
  if (!navigator.onLine) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONNECTIVITY_CHECK_TIMEOUT_MS);

    const response = await fetch('/api/health', {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-store', // Always check, never use cached response
    });

    clearTimeout(timeoutId);
    return response.ok; // Returns true only if status 200-299
  } catch (error) {
    // Network error, timeout, or abort
    return false;
  }
}

/**
 * Generate a UUID v4 for idempotency keys
 */
function generateUUID(): string {
  // Simple UUID v4 generator (crypto.randomUUID not available in all browsers)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Add a transaction to the sync queue
 * UUID migration: entities now have client-generated IDs that are the same on server
 */
export async function queueTransaction(
  type: 'SALE' | 'EXPENSE' | 'STOCK_MOVEMENT' | 'PRODUCT' | 'PRODUCT_BATCH' | 'USER' | 'SUPPLIER' | 'SUPPLIER_ORDER' | 'SUPPLIER_ORDER_ITEM' | 'SUPPLIER_RETURN' | 'PRODUCT_SUPPLIER' | 'CREDIT_PAYMENT' | 'STOCKOUT_REPORT' | 'SALE_PRESCRIPTION',
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'UPDATE_PIN',
  payload: any
): Promise<SyncQueueItem> {
  // Extract entity ID from payload - with UUID migration, all entities have an 'id' field
  const entityId = payload?.id || generateUUID();

  const item: SyncQueueItem = {
    type,
    action,
    payload,
    entityId, // UUID of the entity being synced
    createdAt: new Date() as any,
    status: 'PENDING',
    retryCount: 0,
    lastError: undefined,
  };

  const id = await db.sync_queue.add(item as any);
  return { ...item, id };
}

/**
 * Get all pending sync items
 */
export async function getPendingItems(): Promise<SyncQueueItem[]> {
  return db.sync_queue.where('status').anyOf(['PENDING', 'FAILED']).toArray() as any;
}

/**
 * Get count of pending items
 */
export async function getPendingCount(): Promise<number> {
  return db.sync_queue.where('status').anyOf(['PENDING', 'FAILED']).count();
}

/**
 * Mark an item as syncing
 */
export async function markSyncing(itemId: string): Promise<void> {
  await db.sync_queue.update(itemId, {
    status: 'SYNCING' as any,
  });
}

/**
 * Mark an item as successfully synced
 * UUID migration: No serverId mapping needed - just mark as synced
 */
export async function markSynced(itemId: string | number): Promise<void> {
  const item = (await db.sync_queue.get(itemId as any)) as SyncQueueItem;

  if (item && typeof item.payload === 'object' && item.payload !== null) {
    const payload = item.payload as Record<string, any>;
    const entityId = payload.id;

    if (entityId) {
      // UUID migration: Simply mark entity as synced (ID is same on client and server)
      switch (item.type) {
        case 'SALE':
          await db.sales.update(entityId, { synced: true });
          break;
        case 'EXPENSE':
          await db.expenses.update(entityId, { synced: true });
          break;
        case 'PRODUCT':
          await db.products.update(entityId, { synced: true });
          break;
        case 'PRODUCT_BATCH':
          await db.product_batches.update(entityId, { synced: true });
          break;
        case 'STOCK_MOVEMENT':
          await db.stock_movements.update(entityId, { synced: true });
          break;
        case 'SUPPLIER':
          await db.suppliers.update(entityId, { synced: true });
          break;
        case 'SUPPLIER_ORDER':
          await db.supplier_orders.update(entityId, { synced: true });
          break;
        case 'SUPPLIER_ORDER_ITEM':
          await db.supplier_order_items.update(entityId, { synced: true });
          break;
        case 'SUPPLIER_RETURN':
          await db.supplier_returns.update(entityId, { synced: true });
          break;
        case 'PRODUCT_SUPPLIER':
          await db.product_suppliers.update(entityId, { synced: true });
          break;
        case 'CREDIT_PAYMENT':
          await db.credit_payments.update(entityId, { synced: true });
          break;
        case 'STOCKOUT_REPORT':
          await db.stockout_reports.update(entityId, { synced: true });
          break;
        case 'SALE_PRESCRIPTION':
          await db.sale_prescriptions.update(entityId, { synced: true });
          break;
      }
    }
  }

  await db.sync_queue.update(itemId as any, {
    status: 'SYNCED' as any,
  });
}

/**
 * Mark an item as failed with error message
 */
export async function markFailed(itemId: string | number, error: string): Promise<void> {
  const item = (await db.sync_queue.get(itemId as any)) as SyncQueueItem;

  if (item && item.retryCount < MAX_RETRIES) {
    // Retry later
    const delayMs = RETRY_DELAY_MS * Math.pow(EXPONENTIAL_BACKOFF, item.retryCount);

    await db.sync_queue.update(itemId as any, {
      status: 'FAILED' as any,
      retryCount: (item.retryCount || 0) + 1,
      lastError: error,
    });

    // Schedule retry
    setTimeout(() => {
      processSyncQueue();
    }, delayMs);
  } else {
    // Max retries exceeded, mark as failed permanently
    await db.sync_queue.update(itemId as any, {
      status: 'FAILED' as any,
      lastError: `${error} (max retries exceeded)`,
    });
  }
}

/**
 * UUID migration: Self-healing is no longer needed for serverId mapping.
 * This function is kept for backward compatibility but does nothing.
 * With UUIDs, client and server use the same ID - no mapping required.
 *
 * @returns {Promise<{repaired: boolean, count: number}>}
 */
export async function repairOrphanedRecords(): Promise<{ repaired: boolean; count: number }> {
  // UUID migration: No serverId repair needed - IDs are consistent across client/server
  return { repaired: false, count: 0 };
}

/**
 * UUID migration: Foreign key validation simplified.
 * With UUIDs, we just check if the referenced entity exists locally.
 * No serverId mapping is needed.
 *
 * @returns {Promise<{valid: boolean, errors: string[]}>}
 */
async function validateForeignKeyReferences(): Promise<{ valid: boolean; errors: string[] }> {
  // UUID migration: FK validation is straightforward - just check if entities exist
  // The actual validation happens server-side during sync
  return { valid: true, errors: [] };
}

/**
 * Prepare sync payload from queue with dependency ordering
 *
 * 🆕 Orders sync items by dependencies to prevent "entity not found" errors:
 * 1. CREATEs before UPDATEs/DELETEs
 * 2. Type priority: PRODUCT > SUPPLIER > SALE > EXPENSE > STOCK_MOVEMENT
 * 3. Timestamp order (FIFO within same type)
 */
export async function prepareSyncPayload(): Promise<{
  sales: Array<Sale & { id: string; idempotencyKey: string }>;
  saleItems: Array<SaleItem & { id: string }>;
  expenses: Array<Expense & { id: string; idempotencyKey: string }>;
  products: Array<Product & { id: string; idempotencyKey: string }>;
  productBatches: any[];
  stockMovements: any[];
  suppliers: any[];
  supplierOrders: any[];
  supplierOrderItems: any[];
  supplierReturns: any[];
  productSuppliers: any[];
  creditPayments: any[];
  stockoutReports: any[];
  salePrescriptions: any[];
}> {
  const items = await getPendingItems();

  // 🆕 Sort by dependency order
  const sortedItems = items.sort((a, b) => {
    // 1. CREATEs before UPDATEs/DELETEs
    if (a.action === 'CREATE' && b.action !== 'CREATE') return -1;
    if (a.action !== 'CREATE' && b.action === 'CREATE') return 1;

    // 2. Type priority: PRODUCT > PRODUCT_BATCH > SUPPLIER > SALE > EXPENSE > STOCK_MOVEMENT
    const typePriority: Record<string, number> = {
      PRODUCT: 1,
      PRODUCT_BATCH: 2, // After products (foreign key dependency)
      SUPPLIER: 3,
      SUPPLIER_ORDER: 4,
      PRODUCT_SUPPLIER: 5,
      SALE: 6,
      EXPENSE: 7,
      STOCK_MOVEMENT: 8,
      CREDIT_PAYMENT: 9,
      SUPPLIER_ORDER_ITEM: 10,
      SUPPLIER_RETURN: 11,
      USER: 12,
      STOCKOUT_REPORT: 13,
      SALE_PRESCRIPTION: 14,
    };

    const priorityA = typePriority[a.type] || 99;
    const priorityB = typePriority[b.type] || 99;

    if (priorityA !== priorityB) return priorityA - priorityB;

    // 3. Timestamp order (FIFO)
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeA - timeB;
  });

  const sales: any[] = [];
  const saleItems: any[] = [];
  const expenses: any[] = [];
  const products: any[] = [];
  const productBatches: any[] = [];
  const stockMovements: any[] = [];
  const suppliers: any[] = [];
  const supplierOrders: any[] = [];
  const supplierOrderItems: any[] = [];
  const supplierReturns: any[] = [];
  const productSuppliers: any[] = [];
  const creditPayments: any[] = [];
  const stockoutReports: any[] = [];
  const salePrescriptions: any[] = [];

  for (const item of sortedItems) {
    if (item.status === 'PENDING') {
      // UUID migration: entity.id is already unique and serves as idempotency key
      const payload = item.payload as Record<string, any>;

      switch (item.type) {
        case 'SALE':
          sales.push(payload);
          break;
        case 'EXPENSE':
          expenses.push(payload);
          break;
        case 'PRODUCT':
          products.push(payload);
          break;
        case 'PRODUCT_BATCH':
          productBatches.push(payload);
          break;
        case 'STOCK_MOVEMENT':
          stockMovements.push(payload);
          break;
        case 'SUPPLIER':
          suppliers.push(payload);
          break;
        case 'SUPPLIER_ORDER':
          supplierOrders.push(payload);
          break;
        case 'SUPPLIER_ORDER_ITEM':
          supplierOrderItems.push(payload);
          break;
        case 'SUPPLIER_RETURN':
          supplierReturns.push(payload);
          break;
        case 'PRODUCT_SUPPLIER':
          productSuppliers.push(payload);
          break;
        case 'CREDIT_PAYMENT':
          creditPayments.push(payload);
          break;
        case 'STOCKOUT_REPORT':
          stockoutReports.push(payload);
          break;
        case 'SALE_PRESCRIPTION':
          salePrescriptions.push(payload);
          break;
      }
    }
  }

  // Fetch sale items for each sale
  for (const sale of sales) {
    if (sale.id) {
      const items = await db.sale_items
        .where('sale_id')
        .equals(sale.id)
        .toArray();
      saleItems.push(...items);
    }
  }

  // UUID migration: Simple validation - no serverId enrichment needed
  // With UUIDs, all IDs are the same on client and server
  const validatedProducts = products.filter((p) => {
    if (!p.name) {
      console.warn(`[Sync] ⚠️ Skipping product without name: ${JSON.stringify(p)}`);
      return false;
    }
    return true;
  });

  const validatedSuppliers = suppliers.filter((s) => {
    if (!s.name) {
      console.warn(`[Sync] ⚠️ Skipping supplier without name: ${JSON.stringify(s)}`);
      return false;
    }
    return true;
  });

  const validatedSupplierOrders = supplierOrders.filter((o) => {
    if (!o.supplierId) {
      console.warn(`[Sync] ⚠️ Skipping supplier order without supplierId: ${JSON.stringify(o)}`);
      return false;
    }
    return true;
  });

  const validatedProductBatches = productBatches.filter((b) => {
    if (!b.product_id) {
      console.warn(`[Sync] ⚠️ Skipping product batch without product_id: ${JSON.stringify(b)}`);
      return false;
    }
    return true;
  });

  return {
    sales,
    saleItems,
    expenses,
    products: validatedProducts,
    productBatches: validatedProductBatches,
    stockMovements,
    suppliers: validatedSuppliers,
    supplierOrders: validatedSupplierOrders,
    supplierOrderItems,
    supplierReturns,
    productSuppliers,
    creditPayments,
    stockoutReports,
    salePrescriptions,
  };
}

/**
 * Process the sync queue - main sync function
 */
export async function processSyncQueue(): Promise<{
  synced: number;
  failed: number;
  errors: string[];
}> {
  // Check if actually online (not just network interface)
  if (!(await isActuallyOnline())) {
    return { synced: 0, failed: 0, errors: ['Device is offline'] };
  }

  const pendingItems = await getPendingItems();
  if (pendingItems.length === 0) {
    return { synced: 0, failed: 0, errors: [] };
  }

  const results = { synced: 0, failed: 0, errors: [] as string[] };

  try {
    // 🆕 SELF-HEALING: Check for and repair orphaned records before pushing
    const repairResult = await repairOrphanedRecords();
    if (repairResult.repaired) {
      console.log(`[Sync] 🔧 Repaired ${repairResult.count} orphaned records - retrying sync`);
    }

    // Prepare payload
    const payload = await prepareSyncPayload();

    // Send to server
    const response = await fetch('/api/sync/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('auth_token') || ''}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication failed - session expired');
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `Server error: ${response.status}`
      );
    }

    const data = await response.json();

    // Mark items as synced - UUID migration: check if entity ID is in synced arrays
    for (const item of pendingItems) {
      if (item.status === 'PENDING' && item.id !== undefined) {
        try {
          const entityId = item.entityId;
          let wasSynced = false;

          // Check if entity ID is in the appropriate synced array
          switch (item.type) {
            case 'SALE':
              wasSynced = data.synced?.sales?.includes(entityId) ?? false;
              break;
            case 'EXPENSE':
              wasSynced = data.synced?.expenses?.includes(entityId) ?? false;
              break;
            case 'PRODUCT':
              wasSynced = data.synced?.products?.includes(entityId) ?? false;
              break;
            case 'PRODUCT_BATCH':
              wasSynced = data.synced?.productBatches?.includes(entityId) ?? false;
              break;
            case 'STOCK_MOVEMENT':
              wasSynced = data.synced?.stockMovements?.includes(entityId) ?? false;
              break;
            case 'SUPPLIER':
              wasSynced = data.synced?.suppliers?.includes(entityId) ?? false;
              break;
            case 'SUPPLIER_ORDER':
              wasSynced = data.synced?.supplierOrders?.includes(entityId) ?? false;
              break;
            case 'SUPPLIER_ORDER_ITEM':
              wasSynced = data.synced?.supplierOrderItems?.includes(entityId) ?? false;
              break;
            case 'SUPPLIER_RETURN':
              wasSynced = data.synced?.supplierReturns?.includes(entityId) ?? false;
              break;
            case 'PRODUCT_SUPPLIER':
              wasSynced = data.synced?.productSuppliers?.includes(entityId) ?? false;
              break;
            case 'CREDIT_PAYMENT':
              wasSynced = data.synced?.creditPayments?.includes(entityId) ?? false;
              break;
          }

          if (wasSynced) {
            await markSynced(item.id);
            results.synced++;
          }
        } catch (error) {
          await markFailed(item.id, `Failed to mark synced: ${error}`);
          results.failed++;
          results.errors.push(`Item ${item.id}: ${error}`);
        }
      }
    }

    // After successful push, pull changes from server
    if (results.synced > 0) {
      try {
        await pullFromServer();
      } catch (error) {
        // Don't fail push sync if pull fails
        console.warn('[Sync] Pull after push failed:', error);
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.errors.push(errorMsg);

    // 🆕 SELF-HEALING: Detect FK constraint errors and trigger repair
    const isForeignKeyError = errorMsg.includes('Foreign key constraint') ||
      errorMsg.includes('fkey') ||
      errorMsg.includes('violates foreign key') ||
      errorMsg.includes('Argument') && errorMsg.includes('is missing');

    if (isForeignKeyError) {
      console.error('[Sync] ⚠️ Foreign key error detected - triggering repair...');

      // Clear last sync to force full pull
      if (typeof window !== 'undefined') {
        localStorage.removeItem('seri-last-sync');
      }

      // Schedule repair and retry (don't block current operation)
      setTimeout(async () => {
        try {
          console.log('[Sync] 🔧 Running post-error repair...');
          await pullFromServer();
          console.log('[Sync] 🔄 Repair complete - will retry on next sync cycle');
        } catch (repairError) {
          console.error('[Sync] ❌ Post-error repair failed:', repairError);
        }
      }, 2000);
    }

    // Mark all pending items as failed for retry
    for (const item of pendingItems) {
      if (item.status === 'PENDING' && item.id !== undefined) {
        await markFailed(item.id, errorMsg);
        results.failed++;
      }
    }
  }

  return results;
}

/**
 * 🆕 Debounce timer for automatic sync
 */
let syncDebounceTimer: NodeJS.Timeout | null = null;

/**
 * 🆕 Trigger sync asynchronously without blocking UI
 *
 * Priority levels:
 * - 'high': Sync immediately (for critical operations like sales)
 * - 'normal': Debounce for 3 seconds (batch rapid changes)
 *
 * @param priority - Sync priority level
 */
export function triggerAsyncSync(priority: 'normal' | 'high' = 'normal'): void {
  if (typeof window === 'undefined') return;

  if (priority === 'high') {
    // High priority: sync immediately (but don't block UI)
    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);

    // Run in background, don't await
    processSyncQueue().catch((error) => {
      console.warn('[Sync] High-priority async sync failed:', error);
    });

    // Also try to pull changes immediately
    pullFromServer().catch((error) => {
      console.warn('[Sync] High-priority pull failed:', error);
    });
  } else {
    // Normal priority: debounce for 3 seconds to batch rapid changes
    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);

    syncDebounceTimer = setTimeout(() => {
      processSyncQueue().catch((error) => {
        console.warn('[Sync] Debounced async sync failed:', error);
      });
    }, 3000);
  }
}

/**
 * Set up background sync listener
 */
export function setupBackgroundSync(): void {
  if (typeof window === 'undefined') return;

  // Listen for online event
  window.addEventListener('online', () => {
    console.log('Device is online - starting sync');
    processSyncQueue();
    // Also pull changes when coming online
    pullFromServer().catch((error) => {
      console.warn('[Sync] Pull on online event failed:', error);
    });
  });

  // Check periodically if online and sync push queue
  setInterval(async () => {
    if (await isActuallyOnline()) {
      const count = await getPendingCount();
      if (count > 0) {
        processSyncQueue();
      }
    }
  }, 60000); // Check every 1 minute

  // Periodic pull sync (every 5 minutes)
  setInterval(async () => {
    if (await isActuallyOnline()) {
      pullFromServer().catch((error) => {
        console.warn('[Sync] Periodic pull failed:', error);
      });
    }
  }, 5 * 60 * 1000); // 5 minutes
}

/**
 * Manually clear all sync queue items (for testing/reset)
 */
export async function clearSyncQueue(): Promise<void> {
  await db.sync_queue.clear();
}

/**
 * Get sync statistics
 */
export async function getSyncStats(): Promise<{
  total: number;
  pending: number;
  syncing: number;
  synced: number;
  failed: number;
}> {
  const all = await db.sync_queue.toArray();
  return {
    total: all.length,
    pending: all.filter((i: any) => i.status === 'PENDING').length,
    syncing: all.filter((i: any) => i.status === 'SYNCING').length,
    synced: all.filter((i: any) => i.status === 'SYNCED').length,
    failed: all.filter((i: any) => i.status === 'FAILED').length,
  };
}

/**
 * Queue PIN update for background sync
 * This is separate from the batch sync for immediate retry on failure
 */
export async function queuePinUpdate(userId: string, pinHash: string): Promise<void> {
  await queueTransaction('USER', 'UPDATE_PIN', { id: userId, userId, pinHash });

  // Try to sync immediately if online
  if (await isActuallyOnline()) {
    try {
      const response = await fetch('/api/auth/setup-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include cookies for auth
        body: JSON.stringify({ pinHash, syncFromLocal: true }),
      });
      
      if (response.ok) {
        // Mark as synced - find the queue item we just created
        const items = await getPendingItems();
        const pinItem = items.find(
          (i: any) => i.type === 'USER' && i.action === 'UPDATE_PIN' && i.payload?.userId === userId
        );
        if (pinItem?.id) {
          await markSynced(pinItem.id);
        }
      }
    } catch (error) {
      // Sync failed, will retry via background sync
      console.log('[Sync] PIN update queued for background sync:', error);
    }
  }
}

/**
 * Save PIN locally and queue for sync (offline-first)
 */
export async function savePinOfflineFirst(
  userId: string, 
  pin: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Dynamic import bcryptjs only when needed
    const bcrypt = await import('bcryptjs');
    const pinHash = await bcrypt.hash(pin, 10);
    
    // 1. Save to IndexedDB first (always works offline)
    const existingUser = await db.users.get(userId);
    if (existingUser) {
      await db.users.update(userId, { pinHash });
    } else {
      // User doesn't exist locally - create a minimal record
      await db.users.put({
        id: userId,
        name: 'Utilisateur',
        role: 'EMPLOYEE',
        pinHash,
        createdAt: new Date(),
      } as any);
    }
    
    // 2. Queue for server sync
    await queuePinUpdate(userId, pinHash);
    
    return { success: true };
  } catch (error) {
    console.error('[Sync] Failed to save PIN locally:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erreur inconnue' 
    };
  }
}

/**
 * Get last sync timestamp from localStorage
 */
function getLastSyncAt(): Date | null {
  if (typeof window === 'undefined') return null;
  const lastSync = localStorage.getItem('seri-last-sync');
  return lastSync ? new Date(lastSync) : null;
}

/**
 * Store last sync timestamp to localStorage
 */
function setLastSyncAt(date: Date): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('seri-last-sync', date.toISOString());
}

/**
 * Merge pulled data into IndexedDB with conflict resolution
 * UUID migration: Uses id directly for matching (no serverId mapping needed)
 */
async function mergePulledData(data: {
  products: any[];
  sales: any[];
  expenses: any[];
  stockMovements: any[];
  productBatches: any[];
  creditPayments: any[];
  suppliers?: any[];
  supplierOrders?: any[];
  supplierOrderItems?: any[];
  supplierReturns?: any[];
  productSuppliers?: any[];
}): Promise<{
  merged: number;
  conflicts: number;
  errors: string[];
}> {
  const results = { merged: 0, conflicts: 0, errors: [] as string[] };

  // UUID migration: Match by id directly (same ID on client and server)

  // PHASE 1: Merge Suppliers
  for (const supplier of data.suppliers || []) {
    try {
      const existing = await db.suppliers.get(supplier.id);
      if (existing) {
        const serverUpdatedAt = supplier.updatedAt ? new Date(supplier.updatedAt) : new Date(0);
        const localUpdatedAt = existing.updatedAt ? new Date(existing.updatedAt) : new Date(0);
        if (serverUpdatedAt >= localUpdatedAt) {
          await db.suppliers.update(supplier.id, {
            name: supplier.name,
            phone: supplier.phone,
            paymentTermsDays: supplier.paymentTermsDays,
            synced: true,
            updatedAt: supplier.updatedAt,
          });
          results.merged++;
        } else {
          results.conflicts++;
        }
      } else {
        await db.suppliers.put({
          id: supplier.id,
          name: supplier.name,
          phone: supplier.phone,
          paymentTermsDays: supplier.paymentTermsDays,
          synced: true,
          createdAt: supplier.createdAt,
          updatedAt: supplier.updatedAt,
        } as any);
        results.merged++;
      }
    } catch (error) {
      results.errors.push(`Supplier ${supplier.id}: ${error}`);
    }
  }

  // PHASE 2: Merge Products
  for (const product of data.products) {
    try {
      const existing = await db.products.get(product.id);
      if (existing) {
        const serverUpdatedAt = product.updatedAt ? new Date(product.updatedAt) : new Date(0);
        const localUpdatedAt = existing.updatedAt ? new Date(existing.updatedAt) : new Date(0);
        if (serverUpdatedAt >= localUpdatedAt) {
          await db.products.update(product.id, {
            name: product.name,
            price: product.price,
            priceBuy: product.priceBuy,
            stock: product.stock,
            minStock: product.minStock,
            category: product.category || '',
            expirationDate: product.expirationDate,
            synced: true,
            updatedAt: product.updatedAt,
          });
          results.merged++;
        } else {
          results.conflicts++;
        }
      } else {
        await db.products.put({
          id: product.id,
          name: product.name,
          price: product.price,
          priceBuy: product.priceBuy,
          stock: product.stock,
          minStock: product.minStock,
          category: product.category || '',
          expirationDate: product.expirationDate,
          synced: true,
          updatedAt: product.updatedAt,
        } as any);
        results.merged++;
      }
    } catch (error) {
      results.errors.push(`Product ${product.id}: ${error}`);
    }
  }

  // PHASE 3: Merge Supplier Orders
  for (const order of data.supplierOrders || []) {
    try {
      const existing = await db.supplier_orders.get(order.id);
      if (existing) {
        const serverUpdatedAt = order.updatedAt ? new Date(order.updatedAt) : new Date(0);
        const localUpdatedAt = existing.updatedAt ? new Date(existing.updatedAt) : new Date(0);
        if (serverUpdatedAt >= localUpdatedAt) {
          await db.supplier_orders.update(order.id, {
            supplierId: order.supplierId,
            status: order.status,
            paymentStatus: order.paymentStatus,
            totalAmount: order.totalAmount,
            amountPaid: order.amountPaid,
            dueDate: order.dueDate,
            orderDate: order.orderDate,
            deliveryDate: order.deliveryDate,
            notes: order.notes,
            synced: true,
            updatedAt: order.updatedAt,
          });
          results.merged++;
        } else {
          results.conflicts++;
        }
      } else {
        await db.supplier_orders.put({
          id: order.id,
          supplierId: order.supplierId,
          status: order.status,
          paymentStatus: order.paymentStatus,
          totalAmount: order.totalAmount,
          amountPaid: order.amountPaid,
          dueDate: order.dueDate,
          orderDate: order.orderDate,
          deliveryDate: order.deliveryDate,
          notes: order.notes,
          synced: true,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
        } as any);
        results.merged++;
      }
    } catch (error) {
      results.errors.push(`Supplier order ${order.id}: ${error}`);
    }
  }

  // PHASE 4: Merge Product-Supplier Links
  for (const link of data.productSuppliers || []) {
    try {
      const existing = await db.product_suppliers.get(link.id);
      if (existing) {
        await db.product_suppliers.update(link.id, {
          product_id: link.product_id,
          supplier_id: link.supplier_id,
          default_price: link.default_price,
          is_primary: link.is_primary,
          synced: true,
        });
        results.merged++;
      } else {
        await db.product_suppliers.put({
          id: link.id,
          product_id: link.product_id,
          supplier_id: link.supplier_id,
          default_price: link.default_price,
          is_primary: link.is_primary,
          synced: true,
        } as any);
        results.merged++;
      }
    } catch (error) {
      results.errors.push(`Product-supplier link ${link.id}: ${error}`);
    }
  }

  // PHASE 5: Merge Sales
  for (const sale of data.sales) {
    try {
      const existing = await db.sales.get(sale.id);
      if (existing) {
        const serverModifiedAt = sale.modified_at ? new Date(sale.modified_at) : new Date(sale.created_at);
        const localModifiedAt = existing.modified_at ? new Date(existing.modified_at) : new Date(existing.created_at);
        if (serverModifiedAt >= localModifiedAt) {
          await db.sales.update(sale.id, {
            total: sale.total,
            payment_method: sale.payment_method,
            payment_status: sale.payment_status,
            payment_ref: sale.payment_ref,
            customer_name: sale.customer_name,
            customer_phone: sale.customer_phone,
            due_date: sale.due_date,
            amount_paid: sale.amount_paid,
            amount_due: sale.amount_due,
            modified_at: sale.modified_at,
            modified_by: sale.modified_by,
            edit_count: sale.edit_count,
            synced: true,
          } as any);
          results.merged++;
        } else {
          results.conflicts++;
        }
      } else {
        await db.sales.put({
          id: sale.id,
          total: sale.total,
          payment_method: sale.payment_method,
          payment_status: sale.payment_status,
          payment_ref: sale.payment_ref,
          customer_name: sale.customer_name,
          customer_phone: sale.customer_phone,
          due_date: sale.due_date,
          amount_paid: sale.amount_paid,
          amount_due: sale.amount_due,
          created_at: sale.created_at,
          user_id: sale.user_id,
          modified_at: sale.modified_at,
          modified_by: sale.modified_by,
          edit_count: sale.edit_count,
          synced: true,
        } as any);
        results.merged++;
      }
    } catch (error) {
      results.errors.push(`Sale ${sale.id}: ${error}`);
    }
  }

  // Merge Expenses
  for (const expense of data.expenses) {
    try {
      const existing = await db.expenses.get(expense.id);
      if (!existing) {
        await db.expenses.put({
          id: expense.id,
          date: expense.date,
          description: expense.description,
          amount: expense.amount,
          category: expense.category,
          user_id: expense.user_id,
          synced: true,
        } as any);
        results.merged++;
      }
    } catch (error) {
      results.errors.push(`Expense ${expense.id}: ${error}`);
    }
  }

  // Merge Stock Movements
  for (const movement of data.stockMovements) {
    try {
      const existing = await db.stock_movements.get(movement.id);
      if (!existing) {
        await db.stock_movements.put({
          id: movement.id,
          product_id: movement.product_id,
          type: movement.type,
          quantity_change: movement.quantity_change,
          reason: movement.reason,
          created_at: movement.created_at,
          user_id: movement.user_id,
          synced: true,
        } as any);
        results.merged++;
      }
    } catch (error) {
      results.errors.push(`Stock movement ${movement.id}: ${error}`);
    }
  }

  // Merge Product Batches
  for (const batch of data.productBatches || []) {
    try {
      const existing = await db.product_batches.get(batch.id);
      if (existing) {
        const serverUpdatedAt = batch.updatedAt ? new Date(batch.updatedAt) : new Date(0);
        const localUpdatedAt = existing.updatedAt ? new Date(existing.updatedAt) : new Date(0);
        if (serverUpdatedAt >= localUpdatedAt) {
          await db.product_batches.update(batch.id, {
            product_id: batch.product_id,
            lot_number: batch.lot_number,
            expiration_date: batch.expiration_date,
            quantity: batch.quantity,
            initial_qty: batch.initial_qty,
            unit_cost: batch.unit_cost,
            supplier_order_id: batch.supplier_order_id,
            received_date: batch.received_date,
            updatedAt: batch.updatedAt,
            synced: true,
          });
          results.merged++;
        } else {
          results.conflicts++;
        }
      } else {
        await db.product_batches.put({
          id: batch.id,
          product_id: batch.product_id,
          lot_number: batch.lot_number,
          expiration_date: batch.expiration_date,
          quantity: batch.quantity,
          initial_qty: batch.initial_qty,
          unit_cost: batch.unit_cost,
          supplier_order_id: batch.supplier_order_id,
          received_date: batch.received_date,
          createdAt: batch.createdAt,
          updatedAt: batch.updatedAt,
          synced: true,
        } as any);
        results.merged++;
      }
    } catch (error) {
      results.errors.push(`Product batch ${batch.id}: ${error}`);
    }
  }

  // Merge Credit Payments
  for (const payment of data.creditPayments) {
    try {
      const existing = await db.credit_payments.get(payment.id);
      if (!existing) {
        await db.credit_payments.put({
          id: payment.id,
          sale_id: payment.sale_id,
          amount: payment.amount,
          payment_method: payment.payment_method,
          payment_ref: payment.payment_ref,
          payment_date: payment.payment_date,
          notes: payment.notes,
          user_id: payment.user_id,
          synced: true,
        } as any);
        results.merged++;
      }
    } catch (error) {
      results.errors.push(`Credit payment ${payment.id}: ${error}`);
    }
  }

  return results;
}

/**
 * Pull changes from server and merge into IndexedDB
 */
export async function pullFromServer(): Promise<{
  success: boolean;
  pulled: number;
  conflicts: number;
  errors: string[];
  serverTime: Date | null;
}> {
  if (!(await isActuallyOnline())) {
    return {
      success: false,
      pulled: 0,
      conflicts: 0,
      errors: ['Device is offline'],
      serverTime: null,
    };
  }

  try {
    const lastSyncAt = getLastSyncAt();
    const url = lastSyncAt
      ? `/api/sync/pull?lastSyncAt=${lastSyncAt.toISOString()}`
      : '/api/sync/pull';

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies for auth
      signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication failed - session expired');
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `Server error: ${response.status}`
      );
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error('Pull sync failed');
    }

    // Merge pulled data into IndexedDB
    const mergeResults = await mergePulledData(data.data);

    // Update last sync timestamp
    if (data.serverTime) {
      setLastSyncAt(new Date(data.serverTime));
    }

    return {
      success: true,
      pulled: mergeResults.merged,
      conflicts: mergeResults.conflicts,
      errors: mergeResults.errors,
      serverTime: data.serverTime ? new Date(data.serverTime) : null,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[Sync] Pull error:', error);
    return {
      success: false,
      pulled: 0,
      conflicts: 0,
      errors: [errorMsg],
      serverTime: null,
    };
  }
}

/**
 * Perform initial sync (pull all data from server)
 */
export async function performInitialSync(): Promise<{
  success: boolean;
  pulled: number;
  errors: string[];
}> {
  console.log('[Sync] Performing initial sync...');
  const result = await pullFromServer();
  return {
    success: result.success,
    pulled: result.pulled,
    errors: result.errors,
  };
}

/**
 * Perform first-time sync for new user
 * - Detects if user has synced before (localStorage flag)
 * - Pulls all data from /api/sync/initial (role-filtered)
 * - Merges into IndexedDB
 * - Sets flag to prevent re-sync
 *
 * @param userRole - User role (OWNER gets all data, EMPLOYEE gets filtered data)
 */
export async function performFirstTimeSync(userRole: 'OWNER' | 'EMPLOYEE'): Promise<{
  success: boolean;
  pulled: number;
  errors: string[];
}> {
  console.log('[Sync] Performing initial sync for role:', userRole);

  try {
    const response = await fetch(`/api/sync/initial?role=${userRole}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Include cookies for auth
      signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const { success, data, serverTime } = await response.json();

    if (!success) {
      throw new Error('Initial sync failed');
    }

    let totalMerged = 0;

    // UUID migration: All entities use id directly (no serverId mapping needed)

    // Merge products (both roles)
    if (data.products?.length > 0) {
      await db.products.bulkPut(data.products.map((p: any) => ({
        id: p.id, // UUID migration: use id directly
        name: p.name,
        price: p.price,
        priceBuy: p.priceBuy,
        stock: p.stock,
        minStock: p.minStock,
        category: p.category,
        expirationDate: p.expirationDate,
        lotNumber: p.lotNumber,
        synced: true,
        updatedAt: p.updatedAt,
      })));
      totalMerged += data.products.length;
      console.log(`[Sync] Merged ${data.products.length} products`);
    }

    // Merge suppliers (both roles)
    if (data.suppliers?.length > 0) {
      await db.suppliers.bulkPut(data.suppliers.map((s: any) => ({
        id: s.id, // UUID migration: use id directly
        name: s.name,
        phone: s.phone,
        paymentTermsDays: s.paymentTermsDays,
        synced: true,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })));
      totalMerged += data.suppliers.length;
      console.log(`[Sync] Merged ${data.suppliers.length} suppliers`);
    }

    // Merge supplier orders (both roles, view-only for employees)
    if (data.supplierOrders?.length > 0) {
      // Merge supplier orders first
      await db.supplier_orders.bulkPut(data.supplierOrders.map((o: any) => ({
        id: o.id, // UUID migration: use id directly
        supplierId: o.supplierId,
        status: o.status,
        totalAmount: o.totalAmount,
        dueDate: o.dueDate,
        receivedDate: o.receivedDate,
        synced: true,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
      })));
      console.log(`[Sync] Merged ${data.supplierOrders.length} supplier orders`);

      // Merge supplier order items
      const allItems: any[] = [];
      data.supplierOrders.forEach((order: any) => {
        if (order.items?.length > 0) {
          order.items.forEach((item: any) => {
            allItems.push({
              id: item.id, // UUID migration: use id directly
              order_id: order.id, // UUID migration: use order id directly
              product_id: item.productId, // UUID migration: use product id directly
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.subtotal,
              synced: true,
            });
          });
        }
      });
      if (allItems.length > 0) {
        await db.supplier_order_items.bulkPut(allItems);
        console.log(`[Sync] Merged ${allItems.length} supplier order items`);
      }
      totalMerged += data.supplierOrders.length;
    }

    // Merge sales (role-filtered by server)
    // UUID migration: server returns same IDs client uses - no mapping needed
    if (data.sales?.length > 0) {
      // Merge sales first - use id directly (UUID migration)
      await db.sales.bulkPut(data.sales.map((s: any) => ({
        id: s.id, // UUID migration: use server ID directly
        total: s.total,
        payment_method: s.paymentMethod,
        payment_status: s.paymentStatus,
        payment_ref: s.paymentRef,
        customer_name: s.customerName,
        customer_phone: s.customerPhone,
        due_date: s.dueDate,
        amount_paid: s.amountPaid,
        amount_due: s.amountDue,
        created_at: s.createdAt,
        user_id: s.userId,
        modified_at: s.modifiedAt,
        modified_by: s.modifiedBy,
        edit_count: s.editCount,
        synced: true,
      })));
      console.log(`[Sync] Merged ${data.sales.length} sales`);

      // Merge sale items - UUID migration: no ID mapping needed
      const allSaleItems: any[] = [];

      data.sales.forEach((sale: any) => {
        if (sale.items?.length > 0) {
          sale.items.forEach((item: any) => {
            allSaleItems.push({
              id: item.id, // UUID migration: use server ID directly
              sale_id: sale.id, // UUID migration: use sale ID directly
              product_id: item.productId,
              quantity: item.quantity,
              unit_price: item.unitPrice,
              subtotal: item.subtotal,
              product_batch_id: item.productBatchId || null, // FEFO tracking
              synced: true,
            });
          });
        }
      });

      if (allSaleItems.length > 0) {
        // Insert sale items with proper sale_id mapping
        await db.sale_items.bulkAdd(allSaleItems);
        console.log(`[Sync] ✅ Merged ${allSaleItems.length} sale items`);
      }
      totalMerged += data.sales.length;
    }

    // Merge expenses (empty for employees)
    if (data.expenses?.length > 0) {
      await db.expenses.bulkPut(data.expenses.map((e: any) => ({
        id: e.id, // UUID migration: use id directly
        date: e.date,
        description: e.description,
        amount: e.amount,
        category: e.category,
        user_id: e.userId,
        supplier_order_id: e.supplierOrderId,
        synced: true,
      })));
      totalMerged += data.expenses.length;
      console.log(`[Sync] Merged ${data.expenses.length} expenses`);
    }

    // Merge stock movements (role-filtered by server)
    if (data.stockMovements?.length > 0) {
      await db.stock_movements.bulkPut(data.stockMovements.map((m: any) => ({
        id: m.id, // UUID migration: use id directly
        product_id: m.productId,
        type: m.type,
        quantity_change: m.quantityChange,
        reason: m.reason,
        created_at: m.createdAt,
        user_id: m.userId,
        synced: true,
      })));
      totalMerged += data.stockMovements.length;
      console.log(`[Sync] Merged ${data.stockMovements.length} stock movements`);
    }

    // Merge credit payments (role-filtered by server)
    if (data.creditPayments?.length > 0) {
      await db.credit_payments.bulkPut(data.creditPayments.map((c: any) => ({
        id: c.id, // UUID migration: use id directly
        sale_id: c.saleId, // UUID migration: use sale id directly
        amount: c.amount,
        payment_method: c.paymentMethod,
        payment_ref: c.paymentRef,
        payment_date: c.paymentDate,
        user_id: c.userId,
        synced: true,
      })));
      totalMerged += data.creditPayments.length;
      console.log(`[Sync] Merged ${data.creditPayments.length} credit payments`);
    }

    // Merge product batches - FEFO Phase 3
    console.log('[Sync] DEBUG: Checking productBatches...', {
      exists: !!data.productBatches,
      isArray: Array.isArray(data.productBatches),
      length: data.productBatches?.length,
      sample: data.productBatches?.[0]
    });

    // UUID migration: server sends same IDs as client - no mapping needed
    if (data.productBatches?.length > 0) {
      const batchesToInsert = data.productBatches.map((b: any) => ({
        id: b.id, // UUID migration: use ID directly
        product_id: b.product_id, // UUID migration: use product ID directly
        lot_number: b.lot_number,
        expiration_date: b.expiration_date,
        quantity: b.quantity,
        initial_qty: b.initial_qty,
        unit_cost: b.unit_cost,
        supplier_order_id: b.supplier_order_id,
        received_date: b.received_date,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        synced: true,
      }));

      await db.product_batches.bulkPut(batchesToInsert);
      totalMerged += batchesToInsert.length;
      console.log(`[Sync] ✅ Merged ${batchesToInsert.length} product batches`);
    } else {
      console.warn('[Sync] ⚠️ No product batches received from server!');
    }

    // Set sync timestamp
    if (serverTime) {
      setLastSyncAt(new Date(serverTime));
    }

    console.log(`[Sync] ✅ Initial sync complete: ${totalMerged} records merged`);
    return { success: true, pulled: totalMerged, errors: [] };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[Sync] ❌ First-time sync error:', error);
    return { success: false, pulled: 0, errors: [errorMsg] };
  }
}

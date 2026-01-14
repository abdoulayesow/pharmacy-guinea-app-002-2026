/**
 * Offline-first sync queue management
 * Handles queuing, processing, and retrying transactions
 */

import { db } from './db';
import type { SyncQueueItem, Sale, Expense, Product } from '@/lib/shared/types';
import { generateLocalId } from '@/lib/shared/utils';

// Constants
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000; // 1 second base delay
const EXPONENTIAL_BACKOFF = 2; // Double delay each retry
const SYNC_TIMEOUT_MS = 30000; // 30 seconds per sync request

/**
 * Add a transaction to the sync queue
 */
export async function queueTransaction(
  type: 'SALE' | 'EXPENSE' | 'STOCK_MOVEMENT' | 'PRODUCT' | 'USER',
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'UPDATE_PIN',
  payload: any,
  localId?: string
): Promise<SyncQueueItem> {
  const item: SyncQueueItem = {
    type,
    action,
    payload,
    localId: localId ? parseInt(localId, 10) : Math.floor(Math.random() * 1000000),
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
 */
export async function markSynced(
  itemId: string | number,
  serverId?: string | number
): Promise<void> {
  const item = (await db.sync_queue.get(itemId as any)) as SyncQueueItem;

  if (item && serverId && typeof item.payload === 'object' && item.payload !== null) {
    const payload = item.payload as Record<string, any>;
    // Update the corresponding record with the server ID
    switch (item.type) {
      case 'SALE': {
        const localSaleId = payload.id;
        if (localSaleId) {
          await db.sales.update(localSaleId, { serverId: serverId as any });
        }
        break;
      }
      case 'EXPENSE': {
        const localExpenseId = payload.id;
        if (localExpenseId) {
          await db.expenses.update(localExpenseId, { serverId: serverId as any });
        }
        break;
      }
      case 'PRODUCT': {
        const localProductId = payload.id;
        if (localProductId) {
          await db.products.update(localProductId, { serverId: serverId as any });
        }
        break;
      }
      case 'STOCK_MOVEMENT': {
        const localMovementId = payload.id;
        if (localMovementId) {
          await db.stock_movements.update(localMovementId, { serverId: serverId as any });
        }
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
 * Prepare sync payload from queue
 */
export async function prepareSyncPayload(): Promise<{
  sales: Array<Sale & { id: string }>;
  expenses: Array<Expense & { id: string }>;
  products: Array<Product & { id: string }>;
  stockMovements: any[];
}> {
  const items = await getPendingItems();

  const sales: any[] = [];
  const expenses: any[] = [];
  const products: any[] = [];
  const stockMovements: any[] = [];

  for (const item of items) {
    if (item.status === 'PENDING') {
      switch (item.type) {
        case 'SALE':
          sales.push(item.payload);
          break;
        case 'EXPENSE':
          expenses.push(item.payload);
          break;
        case 'PRODUCT':
          products.push(item.payload);
          break;
        case 'STOCK_MOVEMENT':
          stockMovements.push(item.payload);
          break;
      }
    }
  }

  return { sales, expenses, products, stockMovements };
}

/**
 * Process the sync queue - main sync function
 */
export async function processSyncQueue(): Promise<{
  synced: number;
  failed: number;
  errors: string[];
}> {
  // Check if online
  if (!navigator.onLine) {
    return { synced: 0, failed: 0, errors: ['Device is offline'] };
  }

  const pendingItems = await getPendingItems();
  if (pendingItems.length === 0) {
    return { synced: 0, failed: 0, errors: [] };
  }

  const results = { synced: 0, failed: 0, errors: [] as string[] };

  try {
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

    // Mark items as synced
    for (const item of pendingItems) {
      if (item.status === 'PENDING' && item.id !== undefined) {
        try {
          let serverId: string | undefined;

          // Get the server ID from response (now using Record<string, number>)
          const localIdStr = item.localId.toString();
          if (item.type === 'SALE' && data.synced?.sales?.[localIdStr]) {
            serverId = data.synced.sales[localIdStr].toString();
          } else if (item.type === 'EXPENSE' && data.synced?.expenses?.[localIdStr]) {
            serverId = data.synced.expenses[localIdStr].toString();
          } else if (item.type === 'PRODUCT' && data.synced?.products?.[localIdStr]) {
            serverId = data.synced.products[localIdStr].toString();
          } else if (item.type === 'STOCK_MOVEMENT' && data.synced?.stockMovements?.[localIdStr]) {
            serverId = data.synced.stockMovements[localIdStr].toString();
          }

          await markSynced(item.id, serverId);
          results.synced++;
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
  setInterval(() => {
    if (navigator.onLine) {
      getPendingCount().then((count) => {
        if (count > 0) {
          processSyncQueue();
        }
      });
    }
  }, 30000); // Check every 30 seconds

  // Periodic pull sync (every 5 minutes)
  setInterval(() => {
    if (navigator.onLine) {
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
  await queueTransaction('USER', 'UPDATE_PIN', { userId, pinHash }, userId);
  
  // Try to sync immediately if online
  if (navigator.onLine) {
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
 */
async function mergePulledData(data: {
  products: any[];
  sales: any[];
  expenses: any[];
  stockMovements: any[];
  creditPayments: any[];
}): Promise<{
  merged: number;
  conflicts: number;
  errors: string[];
}> {
  const results = { merged: 0, conflicts: 0, errors: [] as string[] };

  // Merge Products
  for (const product of data.products) {
    try {
      const existing = product.serverId
        ? await db.products.where('serverId').equals(product.serverId).first()
        : null;

      if (existing) {
        // Conflict: compare timestamps
        const serverUpdatedAt = product.updatedAt ? new Date(product.updatedAt) : new Date(0);
        const localUpdatedAt = existing.updatedAt ? new Date(existing.updatedAt) : new Date(0);

        if (serverUpdatedAt >= localUpdatedAt) {
          // Server wins - update local
          await db.products.update(existing.id!, {
            name: product.name,
            price: product.price,
            priceBuy: product.priceBuy,
            stock: product.stock,
            minStock: product.minStock,
            serverId: product.serverId,
            synced: true,
            updatedAt: product.updatedAt,
          });
          results.merged++;
        } else {
          // Local is newer - keep local (will be pushed on next sync)
          results.conflicts++;
        }
      } else {
        // New product - insert
        await db.products.add({
          name: product.name,
          price: product.price,
          priceBuy: product.priceBuy,
          stock: product.stock,
          minStock: product.minStock,
          serverId: product.serverId,
          synced: true,
          updatedAt: product.updatedAt,
          category: product.category || '',
          expirationDate: product.expirationDate,
        } as any);
        results.merged++;
      }
    } catch (error) {
      results.errors.push(`Product ${product.id}: ${error}`);
    }
  }

  // Merge Sales
  for (const sale of data.sales) {
    try {
      const existing = sale.serverId
        ? await db.sales.where('serverId').equals(sale.serverId).first()
        : null;

      if (existing) {
        // Check if server version is newer
        const serverModifiedAt = sale.modified_at
          ? new Date(sale.modified_at)
          : new Date(sale.created_at);
        const localModifiedAt = existing.modified_at
          ? new Date(existing.modified_at)
          : new Date(existing.created_at);

        if (serverModifiedAt >= localModifiedAt) {
          // Server wins - update local
          await db.sales.update(existing.id!, {
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
            serverId: sale.serverId,
            synced: true,
          } as any);
          results.merged++;
        } else {
          results.conflicts++;
        }
      } else {
        // New sale - insert
        await db.sales.add({
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
          serverId: sale.serverId,
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
      const existing = expense.serverId
        ? await db.expenses.where('serverId').equals(expense.serverId).first()
        : null;

      if (!existing) {
        await db.expenses.add({
          date: expense.date,
          description: expense.description,
          amount: expense.amount,
          category: expense.category,
          user_id: expense.user_id,
          serverId: expense.serverId,
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
      const existing = movement.serverId
        ? await db.stock_movements.where('serverId').equals(movement.serverId).first()
        : null;

      if (!existing) {
        await db.stock_movements.add({
          product_id: movement.product_id,
          type: movement.type,
          quantity_change: movement.quantity_change,
          reason: movement.reason,
          created_at: movement.created_at,
          user_id: movement.user_id,
          serverId: movement.serverId,
          synced: true,
        } as any);
        results.merged++;
      }
    } catch (error) {
      results.errors.push(`Stock movement ${movement.id}: ${error}`);
    }
  }

  // Merge Credit Payments
  for (const payment of data.creditPayments) {
    try {
      const existing = payment.serverId
        ? await db.credit_payments.where('serverId').equals(payment.serverId).first()
        : null;

      if (!existing) {
        await db.credit_payments.add({
          sale_id: payment.sale_id,
          amount: payment.amount,
          payment_method: payment.payment_method,
          payment_ref: payment.payment_ref,
          payment_date: payment.payment_date,
          notes: payment.notes,
          user_id: payment.user_id,
          serverId: payment.serverId,
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
  if (!navigator.onLine) {
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

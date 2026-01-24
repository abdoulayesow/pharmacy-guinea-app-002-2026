/**
 * Client-side IndexedDB Database (Dexie.js)
 *
 * This is the offline-first local database for the PWA.
 * All data is stored locally and synced to PostgreSQL when online.
 *
 * IMPORTANT: This file should ONLY be imported in client components
 * (files with 'use client' directive)
 *
 * UUID MIGRATION (2026-01): All entity IDs are now client-generated CUIDs.
 * Same ID used on client (IndexedDB) and server (PostgreSQL) - no serverId mapping needed.
 */

import Dexie, { type Table } from 'dexie';
import type {
  User,
  Product,
  ProductBatch,
  Sale,
  SaleItem,
  Expense,
  StockMovement,
  SyncQueueItem,
  Supplier,
  SupplierOrder,
  SupplierOrderItem,
  SupplierReturn,
  ProductSupplier,
  CreditPayment,
  StockoutReport,
  SalePrescription,
  ProductSubstitute,
} from '@/lib/shared/types';

// Database name - changed for UUID migration (Dexie can't change PK types)
// Old database 'seri-db' used auto-increment integers
// New database 'seri-db-uuid' uses CUID strings
const DB_NAME = 'seri-db-uuid';
const OLD_DB_NAME = 'seri-db';

/**
 * Delete old database on first run (one-time migration).
 * This cleans up the old integer-PK database.
 */
async function cleanupOldDatabase(): Promise<void> {
  if (typeof indexedDB === 'undefined') return; // SSR guard

  try {
    const databases = await indexedDB.databases();
    const oldDb = databases.find(db => db.name === OLD_DB_NAME);

    if (oldDb) {
      console.log('[Seri DB] Deleting old database for UUID migration...');
      await Dexie.delete(OLD_DB_NAME);
      console.log('[Seri DB] Old database deleted successfully.');
    }
  } catch (error) {
    // indexedDB.databases() not supported in some browsers
    try {
      await Dexie.delete(OLD_DB_NAME);
    } catch {
      // Ignore - old DB may not exist
    }
  }
}

// Run cleanup on module load (non-blocking)
const cleanupPromise = cleanupOldDatabase();

/**
 * Seri IndexedDB Database Schema
 */
class SeriDatabase extends Dexie {
  users!: Table<User>;
  products!: Table<Product>;
  product_batches!: Table<ProductBatch>;
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
  // Phase 4: Pharmacy workflow
  stockout_reports!: Table<StockoutReport>;
  sale_prescriptions!: Table<SalePrescription>;
  product_substitutes!: Table<ProductSubstitute>;

  constructor() {
    super(DB_NAME);

    // ============================================================================
    // Version 1: UUID Schema - Fresh start with CUID string primary keys
    // ============================================================================
    // Note: This is a NEW database (seri-db-uuid) - old 'seri-db' is deleted on first run.
    // All IDs are client-generated CUIDs, same on client and server.
    //
    this.version(1).stores({
      // Users use string IDs (from Auth.js)
      users: '&id, role',

      // Entity tables: &id = unique string primary key
      products: '&id, name, category, synced',
      product_batches: '&id, product_id, expiration_date, quantity, synced',
      sales: '&id, created_at, payment_method, payment_status, due_date, modified_at, user_id, customer_name, synced',
      sale_items: '&id, sale_id, product_id, product_batch_id, synced',
      expenses: '&id, date, category, supplier_order_id, user_id, synced',
      stock_movements: '&id, product_id, created_at, supplier_order_id, synced',
      suppliers: '&id, name, synced',
      supplier_orders: '&id, supplierId, type, status, paymentStatus, dueDate, synced',
      supplier_order_items: '&id, order_id, product_id, synced',
      supplier_returns: '&id, supplierId, productId, applied, synced',
      product_suppliers: '&id, product_id, supplier_id, is_primary, synced',
      credit_payments: '&id, sale_id, synced',

      // Sync queue: Keep auto-increment for queue management (local only)
      sync_queue: '++id, type, status, entityId, createdAt',
    });

    // ============================================================================
    // Version 2: Pharmacy Workflow - Stockouts, Prescriptions, Substitutes
    // ============================================================================
    // Note: Explicitly redefine all tables (not using null) to ensure proper initialization
    this.version(2).stores({
      // Core tables (same schema as v1)
      users: '&id, role',
      products: '&id, name, category, synced',
      product_batches: '&id, product_id, expiration_date, quantity, synced',
      sales: '&id, created_at, payment_method, payment_status, due_date, modified_at, user_id, customer_name, synced',
      sale_items: '&id, sale_id, product_id, product_batch_id, synced',
      expenses: '&id, date, category, supplier_order_id, user_id, synced',
      stock_movements: '&id, product_id, created_at, supplier_order_id, synced',
      suppliers: '&id, name, synced',
      supplier_orders: '&id, supplierId, type, status, paymentStatus, dueDate, synced',
      supplier_order_items: '&id, order_id, product_id, synced',
      supplier_returns: '&id, supplierId, productId, applied, synced',
      product_suppliers: '&id, product_id, supplier_id, is_primary, synced',
      credit_payments: '&id, sale_id, synced',
      sync_queue: '++id, type, status, entityId, createdAt',

      // New Phase 4 tables
      stockout_reports: '&id, product_id, product_name, created_at, reported_by, synced',
      sale_prescriptions: '&id, sale_id, captured_at, synced',
      product_substitutes: '&id, product_id, substitute_id, equivalence_type, priority, synced',
    });
  }
}

// Create and export database instance
export const db = new SeriDatabase();

/**
 * Ensure database is ready (old database cleanup complete).
 * Call this before first database operation in app initialization.
 */
export async function ensureDbReady(): Promise<void> {
  await cleanupPromise;
  if (!db.isOpen()) {
    await db.open();
  }
}

// ============================================================================
// Stock Calculation Helper (Transaction Log Pattern)
// ============================================================================

/**
 * Calculate current stock from initial stock + all stock movements
 * This prevents data loss from concurrent updates
 *
 * @param productId - Product ID (CUID string) to calculate stock for
 * @returns Current stock quantity
 */
export async function calculateProductStock(productId: string): Promise<number> {
  const product = await db.products.get(productId);
  if (!product) {
    throw new Error(`Product ${productId} not found`);
  }

  // Get all stock movements for this product
  const movements = await db.stock_movements
    .where('product_id')
    .equals(productId)
    .toArray();

  // Sum all movements (positive = received, negative = sold/damaged/etc)
  const totalMovements = movements.reduce((sum, movement) => {
    return sum + movement.quantity_change;
  }, 0);

  // Current stock = product's base stock + all movements
  // Note: product.stock is now a "snapshot" that we update periodically
  // but movements are the source of truth
  return product.stock + totalMovements;
}

/**
 * Get products with calculated stock (from movements)
 * Use this instead of directly reading product.stock
 */
export async function getProductsWithCalculatedStock(): Promise<Product[]> {
  const products = await db.products.toArray();

  // Calculate stock for each product
  const productsWithStock = await Promise.all(
    products.map(async (product) => {
      if (!product.id) return product;

      const calculatedStock = await calculateProductStock(product.id);

      return {
        ...product,
        stock: calculatedStock, // Replace with calculated value
      };
    })
  );

  return productsWithStock;
}

// ============================================================================
// FEFO Batch Selection (Phase 3 - First Expired First Out)
// ============================================================================

/**
 * Batch allocation result
 */
export interface BatchAllocation {
  batchId: string;
  lotNumber: string;
  expirationDate: Date;
  quantity: number;
}

/**
 * Select batches for a sale using FEFO (First Expired First Out) algorithm
 *
 * @param productId - Product ID (CUID string) to select batches for
 * @param requestedQty - Quantity requested
 * @returns Array of batch allocations (earliest expiring first)
 * @throws Error if insufficient stock available
 */
export async function selectBatchForSale(
  productId: string,
  requestedQty: number
): Promise<BatchAllocation[]> {
  // 1. Get all non-empty batches for this product, sorted by expiration (earliest first)
  const batches = await db.product_batches
    .where('product_id')
    .equals(productId)
    .filter((batch) => batch.quantity > 0)
    .sortBy('expiration_date'); // FEFO: First Expired First Out

  // 2. Allocate quantity across batches (earliest first)
  const allocations: BatchAllocation[] = [];
  let remainingQty = requestedQty;

  for (const batch of batches) {
    if (remainingQty <= 0) break;

    const qtyFromBatch = Math.min(batch.quantity, remainingQty);
    allocations.push({
      batchId: batch.id,
      lotNumber: batch.lot_number,
      expirationDate: batch.expiration_date,
      quantity: qtyFromBatch,
    });

    remainingQty -= qtyFromBatch;
  }

  // 3. Check if we have enough stock
  if (remainingQty > 0) {
    throw new Error(
      `Stock insuffisant: besoin de ${requestedQty}, disponible ${requestedQty - remainingQty}`
    );
  }

  return allocations;
}

/**
 * Get batches expiring within a given number of days
 *
 * @param daysThreshold - Number of days until expiration
 * @returns Array of batches expiring within threshold
 */
export async function getExpiringBatches(daysThreshold: number): Promise<ProductBatch[]> {
  const now = new Date();
  const thresholdDate = new Date(now);
  thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

  const batches = await db.product_batches
    .filter((batch) => {
      return (
        batch.quantity > 0 &&
        batch.expiration_date >= now &&
        batch.expiration_date <= thresholdDate
      );
    })
    .sortBy('expiration_date');

  return batches;
}

/**
 * Get expiration alert level for a batch
 *
 * @param expirationDate - Expiration date of the batch
 * @returns 'critical' | 'warning' | 'notice' | 'ok'
 */
export function getExpirationAlertLevel(
  expirationDate: Date
): 'critical' | 'warning' | 'notice' | 'ok' {
  const now = new Date();
  const daysUntilExpiry = Math.floor(
    (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilExpiry < 0) return 'critical'; // Already expired
  if (daysUntilExpiry < 7) return 'critical'; // < 7 days
  if (daysUntilExpiry < 30) return 'warning'; // < 30 days
  if (daysUntilExpiry < 90) return 'notice'; // < 90 days
  return 'ok';
}

/**
 * Get total available stock for a product across all batches
 *
 * @param productId - Product ID (CUID string)
 * @returns Total quantity across all non-empty batches
 */
export async function getTotalBatchStock(productId: string): Promise<number> {
  const batches = await db.product_batches
    .where('product_id')
    .equals(productId)
    .filter((batch) => batch.quantity > 0)
    .toArray();

  return batches.reduce((total, batch) => total + batch.quantity, 0);
}

// ============================================================================
// Seed Demo Data (Products, Suppliers - NOT Users)
// ============================================================================

import { generateId } from '@/lib/shared/utils';

// Mutex to prevent concurrent seeding
let isSeeding = false;
let seedingComplete = false;

/**
 * Seed demo products and suppliers for testing/demo purposes.
 *
 * NOTE: Users are NOT seeded here. Real users are created via:
 * 1. Google OAuth login (creates user in Postgres)
 * 2. NextAuth createUser event (sets default PIN + mustChangePin flag)
 * 3. User data syncs to IndexedDB for offline access
 *
 * Uses mutex to prevent race conditions when called from multiple pages.
 */
export async function seedInitialData() {
  // If already seeded or currently seeding, skip
  if (seedingComplete || isSeeding) {
    return;
  }

  const productCount = await db.products.count();

  if (productCount === 0) {
    isSeeding = true;
    console.log('[Seri DB] Seeding demo products and suppliers...');

    try {
      // Generate stable IDs for seeding (used for FK references)
      const productIds = Array.from({ length: 8 }, () => generateId());
      const supplierIds = Array.from({ length: 5 }, () => generateId());
      const orderIds = Array.from({ length: 2 }, () => generateId());
      const batchIds = Array.from({ length: 8 }, () => generateId());

      // Add demo products
      await db.products.bulkAdd([
        {
          id: productIds[0],
          name: 'Paracetamol 500mg',
          category: 'Antidouleur',
          price: 15000,
          priceBuy: 10000,
          stock: 45,
          minStock: 10,
          expirationDate: new Date('2026-06-15'),
          lotNumber: 'LOT-2024-001',
          synced: true,
          updatedAt: new Date(),
        },
        {
          id: productIds[1],
          name: 'Amoxicilline 250mg',
          category: 'Antibiotique',
          price: 25000,
          priceBuy: 18000,
          stock: 8,
          minStock: 10,
          expirationDate: new Date('2026-02-28'),
          lotNumber: 'LOT-2024-002',
          synced: true,
          updatedAt: new Date(),
        },
        {
          id: productIds[2],
          name: 'Ibuprofene 400mg',
          category: 'Antidouleur',
          price: 18000,
          priceBuy: 12000,
          stock: 32,
          minStock: 10,
          expirationDate: new Date('2027-01-20'),
          lotNumber: 'LOT-2024-003',
          synced: true,
          updatedAt: new Date(),
        },
        {
          id: productIds[3],
          name: 'Vitamine C 1000mg',
          category: 'Vitamines',
          price: 12000,
          priceBuy: 8000,
          stock: 60,
          minStock: 15,
          expirationDate: new Date('2026-03-10'),
          lotNumber: 'LOT-2024-004',
          synced: true,
          updatedAt: new Date(),
        },
        {
          id: productIds[4],
          name: 'Doliprane 1000mg',
          category: 'Antidouleur',
          price: 20000,
          priceBuy: 14000,
          stock: 25,
          minStock: 10,
          synced: true,
          updatedAt: new Date(),
        },
        {
          id: productIds[5],
          name: 'Metformine 500mg',
          category: 'Diabete',
          price: 35000,
          priceBuy: 25000,
          stock: 0,
          minStock: 5,
          synced: true,
          updatedAt: new Date(),
        },
        {
          id: productIds[6],
          name: 'Omeprazole 20mg',
          category: 'Gastro',
          price: 22000,
          priceBuy: 15000,
          stock: 18,
          minStock: 8,
          expirationDate: new Date('2026-08-05'),
          lotNumber: 'LOT-2024-006',
          synced: true,
          updatedAt: new Date(),
        },
        {
          id: productIds[7],
          name: 'Aspirine 100mg',
          category: 'Antidouleur',
          price: 8000,
          priceBuy: 5000,
          stock: 3,
          minStock: 10,
          expirationDate: new Date('2026-01-25'),
          lotNumber: 'LOT-2024-007',
          synced: true,
          updatedAt: new Date(),
        },
      ]);

      // Add demo suppliers
      await db.suppliers.bulkAdd([
        {
          id: supplierIds[0],
          name: 'Sopharma Guinee',
          phone: '+224 622 12 34 56',
          paymentTermsDays: 30,
          createdAt: new Date(),
          updatedAt: new Date(),
          synced: true,
        },
        {
          id: supplierIds[1],
          name: 'Pharmaguinee',
          phone: '+224 628 98 76 54',
          paymentTermsDays: 45,
          createdAt: new Date(),
          updatedAt: new Date(),
          synced: true,
        },
        {
          id: supplierIds[2],
          name: 'UBIPHARM',
          phone: '+224 620 11 22 33',
          paymentTermsDays: 30,
          createdAt: new Date(),
          updatedAt: new Date(),
          synced: true,
        },
        {
          id: supplierIds[3],
          name: 'Sagapharm',
          phone: '+224 625 44 55 66',
          paymentTermsDays: 20,
          createdAt: new Date(),
          updatedAt: new Date(),
          synced: true,
        },
        {
          id: supplierIds[4],
          name: 'Comptoir Pharmaceutique',
          phone: '+224 627 77 88 99',
          paymentTermsDays: 30,
          createdAt: new Date(),
          updatedAt: new Date(),
          synced: true,
        },
      ]);

      // Add demo supplier orders
      await db.supplier_orders.bulkAdd([
        {
          id: orderIds[0],
          supplierId: supplierIds[0], // Sopharma
          type: 'ORDER',
          orderDate: new Date('2026-01-05'),
          deliveryDate: new Date('2026-01-08'),
          totalAmount: 2500000,
          amountPaid: 0,
          dueDate: new Date('2026-02-04'),
          status: 'DELIVERED',
          paymentStatus: 'UNPAID',
          notes: 'Commande mensuelle',
          createdAt: new Date('2026-01-05'),
          updatedAt: new Date('2026-01-08'),
          synced: true,
        },
        {
          id: orderIds[1],
          supplierId: supplierIds[1], // Pharmaguinee
          type: 'ORDER',
          orderDate: new Date('2025-12-20'),
          deliveryDate: new Date('2025-12-22'),
          totalAmount: 1800000,
          amountPaid: 800000,
          dueDate: new Date('2026-02-03'),
          status: 'DELIVERED',
          paymentStatus: 'PARTIALLY_PAID',
          notes: 'Antibiotiques et vitamines',
          createdAt: new Date('2025-12-20'),
          updatedAt: new Date('2026-01-10'),
          synced: true,
        },
      ]);

      // Add demo product batches for FEFO testing
      await db.product_batches.bulkAdd([
        // Paracetamol 500mg - Multiple batches
        {
          id: batchIds[0],
          product_id: productIds[0],
          lot_number: 'LOT-2024-001',
          expiration_date: new Date('2026-02-28'),
          quantity: 15,
          initial_qty: 50,
          unit_cost: 10000,
          received_date: new Date('2024-12-01'),
          createdAt: new Date('2024-12-01'),
          updatedAt: new Date(),
          synced: true,
        },
        {
          id: batchIds[1],
          product_id: productIds[0],
          lot_number: 'LOT-2024-015',
          expiration_date: new Date('2026-06-15'),
          quantity: 30,
          initial_qty: 100,
          unit_cost: 10000,
          received_date: new Date('2025-11-15'),
          createdAt: new Date('2025-11-15'),
          updatedAt: new Date(),
          synced: true,
        },
        // Amoxicilline 250mg - Near expiry
        {
          id: batchIds[2],
          product_id: productIds[1],
          lot_number: 'LOT-2024-002',
          expiration_date: new Date('2026-01-25'),
          quantity: 8,
          initial_qty: 20,
          unit_cost: 18000,
          received_date: new Date('2024-11-10'),
          createdAt: new Date('2024-11-10'),
          updatedAt: new Date(),
          synced: true,
        },
        // Ibuprofene 400mg
        {
          id: batchIds[3],
          product_id: productIds[2],
          lot_number: 'LOT-2024-003',
          expiration_date: new Date('2027-01-20'),
          quantity: 32,
          initial_qty: 50,
          unit_cost: 12000,
          received_date: new Date('2025-10-05'),
          createdAt: new Date('2025-10-05'),
          updatedAt: new Date(),
          synced: true,
        },
        // Vitamine C 1000mg - Multiple batches
        {
          id: batchIds[4],
          product_id: productIds[3],
          lot_number: 'LOT-2024-004A',
          expiration_date: new Date('2026-03-10'),
          quantity: 35,
          initial_qty: 50,
          unit_cost: 8000,
          received_date: new Date('2024-09-10'),
          createdAt: new Date('2024-09-10'),
          updatedAt: new Date(),
          synced: true,
        },
        {
          id: batchIds[5],
          product_id: productIds[3],
          lot_number: 'LOT-2025-012',
          expiration_date: new Date('2026-08-20'),
          quantity: 25,
          initial_qty: 40,
          unit_cost: 8000,
          received_date: new Date('2025-12-01'),
          createdAt: new Date('2025-12-01'),
          updatedAt: new Date(),
          synced: true,
        },
        // Omeprazole 20mg
        {
          id: batchIds[6],
          product_id: productIds[6],
          lot_number: 'LOT-2024-006',
          expiration_date: new Date('2026-08-05'),
          quantity: 18,
          initial_qty: 30,
          unit_cost: 15000,
          received_date: new Date('2025-08-05'),
          createdAt: new Date('2025-08-05'),
          updatedAt: new Date(),
          synced: true,
        },
        // Aspirine 100mg - CRITICAL expiry
        {
          id: batchIds[7],
          product_id: productIds[7],
          lot_number: 'LOT-2024-007',
          expiration_date: new Date('2026-01-25'),
          quantity: 3,
          initial_qty: 10,
          unit_cost: 5000,
          received_date: new Date('2024-10-15'),
          createdAt: new Date('2024-10-15'),
          updatedAt: new Date(),
          synced: true,
        },
      ]);

      console.log('[Seri DB] Demo data seeding complete (products + suppliers + batches)');
      seedingComplete = true;
    } catch (error: unknown) {
      // Ignore ConstraintError (duplicate key) - data already exists
      const err = error as { name?: string; failures?: Array<{ name?: string }> };
      if (err?.name === 'BulkError' && err?.failures?.some((f) => f?.name === 'ConstraintError')) {
        console.log('[Seri DB] Demo data already seeded, skipping');
        seedingComplete = true;
      } else {
        console.error('[Seri DB] Failed to seed demo data:', error);
        throw error;
      }
    } finally {
      isSeeding = false;
    }
  } else {
    // Demo data already exists
    seedingComplete = true;
  }
}

// ============================================================================
// Database Utilities
// ============================================================================

/**
 * Clear all data from the database (useful for testing)
 */
export async function clearDatabase() {
  await db.users.clear();
  await db.products.clear();
  await db.product_batches.clear();
  await db.sales.clear();
  await db.sale_items.clear();
  await db.expenses.clear();
  await db.stock_movements.clear();
  await db.sync_queue.clear();
  await db.suppliers.clear();
  await db.supplier_orders.clear();
  await db.supplier_order_items.clear();
  await db.supplier_returns.clear();
  await db.product_suppliers.clear();
  await db.credit_payments.clear();
  // Phase 4 tables
  await db.stockout_reports.clear();
  await db.sale_prescriptions.clear();
  await db.product_substitutes.clear();
  console.log('[Seri DB] Database cleared');
}

/**
 * Get database statistics
 */
export async function getDatabaseStats() {
  return {
    users: await db.users.count(),
    products: await db.products.count(),
    productBatches: await db.product_batches.count(),
    sales: await db.sales.count(),
    expenses: await db.expenses.count(),
    stockMovements: await db.stock_movements.count(),
    suppliers: await db.suppliers.count(),
    supplierOrders: await db.supplier_orders.count(),
    supplierOrderItems: await db.supplier_order_items.count(),
    supplierReturns: await db.supplier_returns.count(),
    productSuppliers: await db.product_suppliers.count(),
    creditPayments: await db.credit_payments.count(),
    // Phase 4 stats
    stockoutReports: await db.stockout_reports.count(),
    salePrescriptions: await db.sale_prescriptions.count(),
    productSubstitutes: await db.product_substitutes.count(),
    pendingSync: await db.sync_queue.where('status').equals('PENDING').count(),
  };
}

/**
 * Client-side IndexedDB Database (Dexie.js)
 *
 * This is the offline-first local database for the PWA.
 * All data is stored locally and synced to PostgreSQL when online.
 *
 * IMPORTANT: This file should ONLY be imported in client components
 * (files with 'use client' directive)
 */

import Dexie, { type Table } from 'dexie';
import type {
  User,
  Product,
  ProductBatch, // 🆕 Batch tracking for FEFO
  Sale,
  SaleItem,
  Expense,
  StockMovement,
  SyncQueueItem,
  Supplier,
  SupplierOrder,
  SupplierOrderItem, // 🆕 Order line items
  SupplierReturn,
  ProductSupplier, // 🆕 Product-supplier links
  CreditPayment, // 🆕 Credit payment tracking
} from '@/lib/shared/types';

/**
 * Seri IndexedDB Database Schema
 */
class SeriDatabase extends Dexie {
  users!: Table<User>;
  products!: Table<Product>;
  product_batches!: Table<ProductBatch>; // 🆕 Batch tracking for FEFO
  sales!: Table<Sale>;
  sale_items!: Table<SaleItem>;
  expenses!: Table<Expense>;
  stock_movements!: Table<StockMovement>;
  sync_queue!: Table<SyncQueueItem>;
  // 🆕 Supplier tables (from user research 2026-01)
  suppliers!: Table<Supplier>;
  supplier_orders!: Table<SupplierOrder>;
  supplier_order_items!: Table<SupplierOrderItem>; // 🆕 Order line items
  supplier_returns!: Table<SupplierReturn>;
  product_suppliers!: Table<ProductSupplier>; // 🆕 Product-supplier links
  credit_payments!: Table<CreditPayment>; // 🆕 Partial payment tracking

  constructor() {
    super('seri-db');

    // Version 1: Initial schema
    this.version(1).stores({
      users: 'id, role',
      products: '++id, serverId, name, category, synced',
      sales: '++id, serverId, created_at, user_id, synced',
      sale_items: '++id, sale_id, product_id',
      expenses: '++id, serverId, date, category, user_id, synced',
      stock_movements: '++id, serverId, product_id, created_at, synced',
      sync_queue: '++id, type, status, createdAt',
    });

    // Version 2: Add supplier tables + expiration tracking (2026-01)
    this.version(2).stores({
      users: 'id, role',
      products: '++id, serverId, name, category, expirationDate, synced', // 🆕 Added expirationDate index
      sales: '++id, serverId, created_at, user_id, synced',
      sale_items: '++id, sale_id, product_id',
      expenses: '++id, serverId, date, category, supplier_order_id, user_id, synced', // 🆕 Added supplier_order_id index
      stock_movements: '++id, serverId, product_id, created_at, synced',
      sync_queue: '++id, type, status, createdAt',
      // 🆕 New supplier tables
      suppliers: '++id, serverId, name, synced',
      supplier_orders: '++id, serverId, supplierId, status, dueDate, synced',
      supplier_returns: '++id, serverId, supplierId, productId, applied, synced',
    });

    // Version 3: Add credit sales support (customer info + payment tracking)
    this.version(3).stores({
      users: 'id, role',
      products: '++id, serverId, name, category, expirationDate, synced',
      sales: '++id, serverId, created_at, payment_status, due_date, user_id, customer_name, synced', // 🆕 Added payment_status, due_date, customer_name indexes
      sale_items: '++id, sale_id, product_id',
      expenses: '++id, serverId, date, category, supplier_order_id, user_id, synced',
      stock_movements: '++id, serverId, product_id, created_at, synced',
      sync_queue: '++id, type, status, createdAt',
      suppliers: '++id, serverId, name, synced',
      supplier_orders: '++id, serverId, supplierId, status, dueDate, synced',
      supplier_returns: '++id, serverId, supplierId, productId, applied, synced',
      credit_payments: '++id, serverId, sale_id, payment_date, synced', // 🆕 New table for partial payments
    });

    // Version 4: Add payment_method index to sales table (for credit sales filtering)
    this.version(4).stores({
      users: 'id, role',
      products: '++id, serverId, name, category, expirationDate, synced',
      sales: '++id, serverId, created_at, payment_method, payment_status, due_date, user_id, customer_name, synced', // 🆕 Added payment_method index
      sale_items: '++id, sale_id, product_id',
      expenses: '++id, serverId, date, category, supplier_order_id, user_id, synced',
      stock_movements: '++id, serverId, product_id, created_at, synced',
      sync_queue: '++id, type, status, createdAt',
      suppliers: '++id, serverId, name, synced',
      supplier_orders: '++id, serverId, supplierId, status, dueDate, synced',
      supplier_returns: '++id, serverId, supplierId, productId, applied, synced',
      credit_payments: '++id, serverId, sale_id, payment_date, synced',
    });

    // 🆕 Version 5: Add idempotencyKey index to sync_queue + sale editing support (modified_at)
    this.version(5).stores({
      users: 'id, role',
      products: '++id, serverId, name, category, expirationDate, synced',
      sales: '++id, serverId, created_at, payment_method, payment_status, due_date, modified_at, user_id, customer_name, synced', // 🆕 Added modified_at index
      sale_items: '++id, sale_id, product_id',
      expenses: '++id, serverId, date, category, supplier_order_id, user_id, synced',
      stock_movements: '++id, serverId, product_id, created_at, synced',
      sync_queue: '++id, type, status, idempotencyKey, localId, createdAt', // 🆕 Added idempotencyKey and localId indexes
      suppliers: '++id, serverId, name, synced',
      supplier_orders: '++id, serverId, supplierId, status, dueDate, synced',
      supplier_returns: '++id, serverId, supplierId, productId, applied, synced',
      credit_payments: '++id, serverId, sale_id, payment_date, synced',
    });

    // Version 6: Add supplier order items and product-supplier links (2026-01)
    this.version(6).stores({
      users: 'id, role',
      products: '++id, serverId, name, category, expirationDate, synced',
      sales: '++id, serverId, created_at, payment_method, payment_status, due_date, modified_at, user_id, customer_name, synced',
      sale_items: '++id, sale_id, product_id',
      expenses: '++id, serverId, date, category, supplier_order_id, user_id, synced',
      stock_movements: '++id, serverId, product_id, created_at, supplier_order_id, synced', // 🆕 Added supplier_order_id index
      sync_queue: '++id, type, status, createdAt',
      suppliers: '++id, serverId, name, synced',
      supplier_orders: '++id, serverId, supplierId, status, dueDate, synced',
      supplier_order_items: '++id, serverId, order_id, product_id, synced', // 🆕 New table for order line items
      supplier_returns: '++id, serverId, supplierId, productId, applied, synced',
      product_suppliers: '++id, serverId, product_id, supplier_id, is_primary, synced', // 🆕 New table for product-supplier links
      credit_payments: '++id, serverId, sale_id, payment_date, synced',
    });

    // Version 7: Unify orders and returns, add payment status and delivery confirmation (2026-01)
    this.version(7).stores({
      users: 'id, role',
      products: '++id, serverId, name, category, expirationDate, synced',
      sales: '++id, serverId, created_at, payment_method, payment_status, due_date, modified_at, user_id, customer_name, synced',
      sale_items: '++id, sale_id, product_id',
      expenses: '++id, serverId, date, category, supplier_order_id, user_id, synced',
      stock_movements: '++id, serverId, product_id, created_at, supplier_order_id, synced',
      sync_queue: '++id, type, status, createdAt',
      suppliers: '++id, serverId, name, synced',
      supplier_orders: '++id, serverId, supplierId, type, status, paymentStatus, dueDate, synced', // 🆕 Added type and paymentStatus indexes
      supplier_order_items: '++id, serverId, order_id, product_id, synced',
      supplier_returns: '++id, serverId, supplierId, productId, applied, synced', // Keep for backward compatibility
      product_suppliers: '++id, serverId, product_id, supplier_id, is_primary, synced',
      credit_payments: '++id, serverId, sale_id, payment_date, synced',
    }).upgrade(async (tx) => {
      // Migrate existing orders: set type='ORDER' and status mapping
      const orders = await tx.table('supplier_orders').toArray();
      for (const order of orders) {
        const updates: any = { type: 'ORDER' };

        // Map old statuses to new statuses
        if (order.status === 'ORDERED') {
          updates.status = 'PENDING';
        } else if (order.status === 'DELIVERED') {
          updates.status = 'DELIVERED';
        } else if (order.status === 'PARTIALLY_PAID' || order.status === 'PAID') {
          updates.status = 'DELIVERED';
        }

        // Set paymentStatus based on old status
        if (order.status === 'PAID') {
          updates.paymentStatus = 'PAID';
        } else if (order.status === 'PARTIALLY_PAID') {
          updates.paymentStatus = 'PENDING'; // Partial payment still pending
        } else {
          updates.paymentStatus = 'PENDING';
        }

        await tx.table('supplier_orders').update(order.id, updates);
      }
    });

    // Version 8: Add product batch tracking for FEFO (Phase 3 - 2026-01-16)
    this.version(8).stores({
      users: 'id, role',
      products: '++id, serverId, name, category, expirationDate, synced',
      product_batches: '++id, serverId, product_id, expiration_date, quantity, synced', // 🆕 Batch tracking
      sales: '++id, serverId, created_at, payment_method, payment_status, due_date, modified_at, user_id, customer_name, synced',
      sale_items: '++id, sale_id, product_id, product_batch_id, synced', // 🆕 Added product_batch_id index
      expenses: '++id, serverId, date, category, supplier_order_id, user_id, synced',
      stock_movements: '++id, serverId, product_id, created_at, supplier_order_id, synced',
      sync_queue: '++id, type, status, createdAt',
      suppliers: '++id, serverId, name, synced',
      supplier_orders: '++id, serverId, supplierId, type, status, paymentStatus, dueDate, synced',
      supplier_order_items: '++id, serverId, order_id, product_id, synced',
      supplier_returns: '++id, serverId, supplierId, productId, applied, synced',
      product_suppliers: '++id, serverId, product_id, supplier_id, is_primary, synced',
      credit_payments: '++id, serverId, sale_id, payment_date, synced',
    });
  }
}

export const db = new SeriDatabase();

// ============================================================================
// Stock Calculation Helper (Transaction Log Pattern)
// ============================================================================

/**
 * Calculate current stock from initial stock + all stock movements
 * This prevents data loss from concurrent updates
 *
 * @param productId - Product ID to calculate stock for
 * @returns Current stock quantity
 */
export async function calculateProductStock(productId: number): Promise<number> {
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
  batchId: number;
  lotNumber: string;
  expirationDate: Date;
  quantity: number;
}

/**
 * Select batches for a sale using FEFO (First Expired First Out) algorithm
 *
 * @param productId - Product ID to select batches for
 * @param requestedQty - Quantity requested
 * @returns Array of batch allocations (earliest expiring first)
 * @throws Error if insufficient stock available
 */
export async function selectBatchForSale(
  productId: number,
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
      batchId: batch.id!,
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
 * @param productId - Product ID
 * @returns Total quantity across all non-empty batches
 */
export async function getTotalBatchStock(productId: number): Promise<number> {
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
      // Add demo products
      await db.products.bulkAdd([
      {
        name: 'Paracetamol 500mg',
        category: 'Antidouleur',
        price: 15000,
        priceBuy: 10000,
        stock: 45,
        minStock: 10,
        expirationDate: new Date('2026-06-15'), // 🆕 Expires in 5 months
        lotNumber: 'LOT-2024-001',
        synced: true,
        updatedAt: new Date(),
      },
      {
        name: 'Amoxicilline 250mg',
        category: 'Antibiotique',
        price: 25000,
        priceBuy: 18000,
        stock: 8,
        minStock: 10,
        expirationDate: new Date('2026-02-28'), // 🆕 Expires in 1.5 months (WARNING)
        lotNumber: 'LOT-2024-002',
        synced: true,
        updatedAt: new Date(),
      },
      {
        name: 'Ibuprofène 400mg',
        category: 'Antidouleur',
        price: 18000,
        priceBuy: 12000,
        stock: 32,
        minStock: 10,
        expirationDate: new Date('2027-01-20'), // 🆕 Expires in 12 months (OK)
        lotNumber: 'LOT-2024-003',
        synced: true,
        updatedAt: new Date(),
      },
      {
        name: 'Vitamine C 1000mg',
        category: 'Vitamines',
        price: 12000,
        priceBuy: 8000,
        stock: 60,
        minStock: 15,
        expirationDate: new Date('2026-03-10'), // 🆕 Expires in 2 months (WARNING)
        lotNumber: 'LOT-2024-004',
        synced: true,
        updatedAt: new Date(),
      },
      {
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
        name: 'Metformine 500mg',
        category: 'Diabète',
        price: 35000,
        priceBuy: 25000,
        stock: 0,
        minStock: 5,
        synced: true,
        updatedAt: new Date(),
      },
      {
        name: 'Oméprazole 20mg',
        category: 'Gastro',
        price: 22000,
        priceBuy: 15000,
        stock: 18,
        minStock: 8,
        expirationDate: new Date('2026-08-05'), // 🆕 Expires in 7 months (OK)
        lotNumber: 'LOT-2024-006',
        synced: true,
        updatedAt: new Date(),
      },
      {
        name: 'Aspirine 100mg',
        category: 'Antidouleur',
        price: 8000,
        priceBuy: 5000,
        stock: 3,
        minStock: 10,
        expirationDate: new Date('2026-01-25'), // 🆕 Expires in 2 weeks (CRITICAL)
        lotNumber: 'LOT-2024-007',
        synced: true,
        updatedAt: new Date(),
      },
    ]);

      // 🆕 Add demo suppliers (5 common suppliers in Guinea)
      await db.suppliers.bulkAdd([
        {
          name: 'Sopharma Guinée',
          phone: '+224 622 12 34 56',
          paymentTermsDays: 30,
          createdAt: new Date(),
          updatedAt: new Date(),
          synced: true,
        },
        {
          name: 'Pharmaguinée',
          phone: '+224 628 98 76 54',
          paymentTermsDays: 45,
          createdAt: new Date(),
          updatedAt: new Date(),
          synced: true,
        },
        {
          name: 'UBIPHARM',
          phone: '+224 620 11 22 33',
          paymentTermsDays: 30,
          createdAt: new Date(),
          updatedAt: new Date(),
          synced: true,
        },
        {
          name: 'Sagapharm',
          phone: '+224 625 44 55 66',
          paymentTermsDays: 20,
          createdAt: new Date(),
          updatedAt: new Date(),
          synced: true,
        },
        {
          name: 'Comptoir Pharmaceutique',
          phone: '+224 627 77 88 99',
          paymentTermsDays: 30,
          createdAt: new Date(),
          updatedAt: new Date(),
          synced: true,
        },
      ]);

      // 🆕 Add demo supplier orders (2 pending payments)
      await db.supplier_orders.bulkAdd([
        {
          supplierId: 1, // Sopharma
          type: 'ORDER',
          orderDate: new Date('2026-01-05'),
          deliveryDate: new Date('2026-01-08'),
          totalAmount: 2500000, // 2.5M GNF
          amountPaid: 0,
          dueDate: new Date('2026-02-04'), // 30 days from order
          status: 'DELIVERED',
          paymentStatus: 'UNPAID',
          notes: 'Commande mensuelle',
          createdAt: new Date('2026-01-05'),
          updatedAt: new Date('2026-01-08'),
          synced: true,
        },
        {
          supplierId: 2, // Pharmaguinée
          type: 'ORDER',
          orderDate: new Date('2025-12-20'),
          deliveryDate: new Date('2025-12-22'),
          totalAmount: 1800000, // 1.8M GNF
          amountPaid: 800000, // Partially paid
          dueDate: new Date('2026-02-03'), // 45 days from order
          status: 'DELIVERED',
          paymentStatus: 'PARTIALLY_PAID',
          notes: 'Antibiotiques et vitamines',
          createdAt: new Date('2025-12-20'),
          updatedAt: new Date('2026-01-10'),
          synced: true,
        },
      ]);

      // 🆕 Add demo product batches for FEFO testing (Phase 3)
      await db.product_batches.bulkAdd([
        // Paracetamol 500mg (Product ID: 1) - Multiple batches with different expiration dates
        {
          product_id: 1,
          lot_number: 'LOT-2024-001',
          expiration_date: new Date('2026-02-28'), // Expires in ~1.5 months (WARNING)
          quantity: 15,
          initial_qty: 50,
          unit_cost: 10000,
          received_date: new Date('2024-12-01'),
          createdAt: new Date('2024-12-01'),
          updatedAt: new Date(),
          synced: true,
        },
        {
          product_id: 1,
          lot_number: 'LOT-2024-015',
          expiration_date: new Date('2026-06-15'), // Expires in 5 months (OK)
          quantity: 30,
          initial_qty: 100,
          unit_cost: 10000,
          received_date: new Date('2025-11-15'),
          createdAt: new Date('2025-11-15'),
          updatedAt: new Date(),
          synced: true,
        },

        // Amoxicilline 250mg (Product ID: 2) - Near expiry batch
        {
          product_id: 2,
          lot_number: 'LOT-2024-002',
          expiration_date: new Date('2026-01-25'), // Expires in ~9 days (CRITICAL)
          quantity: 8,
          initial_qty: 20,
          unit_cost: 18000,
          received_date: new Date('2024-11-10'),
          createdAt: new Date('2024-11-10'),
          updatedAt: new Date(),
          synced: true,
        },

        // Ibuprofène 400mg (Product ID: 3) - Good stock with far expiry
        {
          product_id: 3,
          lot_number: 'LOT-2024-003',
          expiration_date: new Date('2027-01-20'), // Expires in 12 months (OK)
          quantity: 32,
          initial_qty: 50,
          unit_cost: 12000,
          received_date: new Date('2025-10-05'),
          createdAt: new Date('2025-10-05'),
          updatedAt: new Date(),
          synced: true,
        },

        // Vitamine C 1000mg (Product ID: 4) - Multiple batches with different expiration
        {
          product_id: 4,
          lot_number: 'LOT-2024-004A',
          expiration_date: new Date('2026-03-10'), // Expires in ~2 months (WARNING)
          quantity: 35,
          initial_qty: 50,
          unit_cost: 8000,
          received_date: new Date('2024-09-10'),
          createdAt: new Date('2024-09-10'),
          updatedAt: new Date(),
          synced: true,
        },
        {
          product_id: 4,
          lot_number: 'LOT-2025-012',
          expiration_date: new Date('2026-08-20'), // Expires in 7 months (OK)
          quantity: 25,
          initial_qty: 40,
          unit_cost: 8000,
          received_date: new Date('2025-12-01'),
          createdAt: new Date('2025-12-01'),
          updatedAt: new Date(),
          synced: true,
        },

        // Oméprazole 20mg (Product ID: 7) - Good batch
        {
          product_id: 7,
          lot_number: 'LOT-2024-006',
          expiration_date: new Date('2026-08-05'), // Expires in 7 months (OK)
          quantity: 18,
          initial_qty: 30,
          unit_cost: 15000,
          received_date: new Date('2025-08-05'),
          createdAt: new Date('2025-08-05'),
          updatedAt: new Date(),
          synced: true,
        },

        // Aspirine 100mg (Product ID: 8) - CRITICAL expiry
        {
          product_id: 8,
          lot_number: 'LOT-2024-007',
          expiration_date: new Date('2026-01-25'), // Expires in ~9 days (CRITICAL)
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
    } catch (error: any) {
      // Ignore ConstraintError (duplicate key) - data already exists
      if (error?.name === 'BulkError' && error?.failures?.some((f: any) => f?.name === 'ConstraintError')) {
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
  await db.product_batches.clear(); // 🆕
  await db.sales.clear();
  await db.sale_items.clear();
  await db.expenses.clear();
  await db.stock_movements.clear();
  await db.sync_queue.clear();
  await db.suppliers.clear(); // 🆕
  await db.supplier_orders.clear(); // 🆕
  await db.supplier_order_items.clear(); // 🆕
  await db.supplier_returns.clear(); // 🆕
  await db.product_suppliers.clear(); // 🆕
  await db.credit_payments.clear(); // 🆕
  console.log('[Seri DB] Database cleared');
}

/**
 * Get database statistics
 */
export async function getDatabaseStats() {
  return {
    users: await db.users.count(),
    products: await db.products.count(),
    productBatches: await db.product_batches.count(), // 🆕
    sales: await db.sales.count(),
    expenses: await db.expenses.count(),
    stockMovements: await db.stock_movements.count(),
    suppliers: await db.suppliers.count(), // 🆕
    supplierOrders: await db.supplier_orders.count(), // 🆕
    supplierOrderItems: await db.supplier_order_items.count(), // 🆕
    supplierReturns: await db.supplier_returns.count(), // 🆕
    productSuppliers: await db.product_suppliers.count(), // 🆕
    creditPayments: await db.credit_payments.count(), // 🆕
    pendingSync: await db.sync_queue.where('status').equals('PENDING').count(),
  };
}

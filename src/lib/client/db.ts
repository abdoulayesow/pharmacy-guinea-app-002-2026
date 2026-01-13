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
  Sale,
  SaleItem,
  Expense,
  StockMovement,
  SyncQueueItem,
  Supplier,
  SupplierOrder,
  SupplierReturn,
  CreditPayment, // 🆕 Credit payment tracking
} from '@/lib/shared/types';

/**
 * Seri IndexedDB Database Schema
 */
class SeriDatabase extends Dexie {
  users!: Table<User>;
  products!: Table<Product>;
  sales!: Table<Sale>;
  sale_items!: Table<SaleItem>;
  expenses!: Table<Expense>;
  stock_movements!: Table<StockMovement>;
  sync_queue!: Table<SyncQueueItem>;
  // 🆕 Supplier tables (from user research 2026-01)
  suppliers!: Table<Supplier>;
  supplier_orders!: Table<SupplierOrder>;
  supplier_returns!: Table<SupplierReturn>;
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

    // Version 5: Add sale editing support (Phase 3 - modified_at index)
    this.version(5).stores({
      users: 'id, role',
      products: '++id, serverId, name, category, expirationDate, synced',
      sales: '++id, serverId, created_at, payment_method, payment_status, due_date, modified_at, user_id, customer_name, synced', // 🆕 Added modified_at index
      sale_items: '++id, sale_id, product_id',
      expenses: '++id, serverId, date, category, supplier_order_id, user_id, synced',
      stock_movements: '++id, serverId, product_id, created_at, synced',
      sync_queue: '++id, type, status, createdAt',
      suppliers: '++id, serverId, name, synced',
      supplier_orders: '++id, serverId, supplierId, status, dueDate, synced',
      supplier_returns: '++id, serverId, supplierId, productId, applied, synced',
      credit_payments: '++id, serverId, sale_id, payment_date, synced',
    });
  }
}

export const db = new SeriDatabase();

// ============================================================================
// Seed Initial Data
// ============================================================================

// Mutex to prevent concurrent seeding
let isSeeding = false;
let seedingComplete = false;

/**
 * Seed initial users if database is empty
 * These are the demo users for "Pharmacie Thierno Mamadou"
 * Uses mutex to prevent race conditions when called from multiple pages
 */
export async function seedInitialData() {
  // If already seeded or currently seeding, skip
  if (seedingComplete || isSeeding) {
    return;
  }

  const userCount = await db.users.count();

  if (userCount === 0) {
    isSeeding = true;
    console.log('[Seri DB] Seeding initial data...');

    try {
      // Add demo users
      // PIN is "1234" for all users (hashed with bcrypt)
      await db.users.bulkAdd([
        {
          id: 'user-owner-oumar',
          name: 'Oumar',
          role: 'OWNER',
          pinHash: '$2a$10$KAtt6JktpbwwmJxE115FEe6sO2KxNhKcEB.TGYqjtkCn5fhfbNQJO', // 1234
          avatar: 'O',
          createdAt: new Date(),
        },
        {
          id: 'user-employee-abdoulaye',
          name: 'Abdoulaye',
          role: 'EMPLOYEE',
          pinHash: '$2a$10$KAtt6JktpbwwmJxE115FEe6sO2KxNhKcEB.TGYqjtkCn5fhfbNQJO', // 1234
          avatar: 'A',
          createdAt: new Date(),
        },
      ]);

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
          orderDate: new Date('2026-01-05'),
          deliveryDate: new Date('2026-01-08'),
          totalAmount: 2500000, // 2.5M GNF
          amountPaid: 0,
          dueDate: new Date('2026-02-04'), // 30 days from order
          status: 'DELIVERED',
          notes: 'Commande mensuelle',
          createdAt: new Date('2026-01-05'),
          updatedAt: new Date('2026-01-08'),
          synced: true,
        },
        {
          supplierId: 2, // Pharmaguinée
          orderDate: new Date('2025-12-20'),
          deliveryDate: new Date('2025-12-22'),
          totalAmount: 1800000, // 1.8M GNF
          amountPaid: 800000, // Partially paid
          dueDate: new Date('2026-02-03'), // 45 days from order
          status: 'PARTIALLY_PAID',
          notes: 'Antibiotiques et vitamines',
          createdAt: new Date('2025-12-20'),
          updatedAt: new Date('2026-01-10'),
          synced: true,
        },
      ]);

      console.log('[Seri DB] Seed data complete');
      seedingComplete = true;
    } catch (error: any) {
      // Ignore ConstraintError (duplicate key) - data already exists
      if (error?.name === 'BulkError' && error?.failures?.some((f: any) => f?.name === 'ConstraintError')) {
        console.log('[Seri DB] Data already seeded, skipping');
        seedingComplete = true;
      } else {
        console.error('[Seri DB] Failed to seed data:', error);
        throw error;
      }
    } finally {
      isSeeding = false;
    }
  } else {
    // Data already exists
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
  await db.sales.clear();
  await db.sale_items.clear();
  await db.expenses.clear();
  await db.stock_movements.clear();
  await db.sync_queue.clear();
  await db.suppliers.clear(); // 🆕
  await db.supplier_orders.clear(); // 🆕
  await db.supplier_returns.clear(); // 🆕
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
    sales: await db.sales.count(),
    expenses: await db.expenses.count(),
    stockMovements: await db.stock_movements.count(),
    suppliers: await db.suppliers.count(), // 🆕
    supplierOrders: await db.supplier_orders.count(), // 🆕
    supplierReturns: await db.supplier_returns.count(), // 🆕
    creditPayments: await db.credit_payments.count(), // 🆕
    pendingSync: await db.sync_queue.where('status').equals('PENDING').count(),
  };
}

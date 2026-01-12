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

  constructor() {
    super('seri-db');

    this.version(1).stores({
      // id is the primary key, other fields are indexed for queries
      users: 'id, role',
      products: '++id, serverId, name, category, synced',
      sales: '++id, serverId, created_at, user_id, synced',
      sale_items: '++id, sale_id, product_id',
      expenses: '++id, serverId, date, category, user_id, synced',
      stock_movements: '++id, serverId, product_id, created_at, synced',
      sync_queue: '++id, type, status, createdAt',
    });
  }
}

export const db = new SeriDatabase();

// ============================================================================
// Seed Initial Data
// ============================================================================

/**
 * Seed initial users if database is empty
 * These are the demo users for "Pharmacie Thierno Mamadou"
 */
export async function seedInitialData() {
  const userCount = await db.users.count();

  if (userCount === 0) {
    console.log('[Seri DB] Seeding initial data...');

    // Add demo users
    // PIN is "1234" for all users (hashed with bcrypt)
    await db.users.bulkAdd([
      {
        id: 'user-owner-mamadou',
        name: 'Mamadou',
        role: 'OWNER',
        pinHash: '$2a$10$KAtt6JktpbwwmJxE115FEe6sO2KxNhKcEB.TGYqjtkCn5fhfbNQJO', // 1234
        avatar: 'M',
        createdAt: new Date(),
      },
      {
        id: 'user-employee-fatoumata',
        name: 'Fatoumata',
        role: 'EMPLOYEE',
        pinHash: '$2a$10$KAtt6JktpbwwmJxE115FEe6sO2KxNhKcEB.TGYqjtkCn5fhfbNQJO', // 1234
        avatar: 'F',
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
        synced: true,
        updatedAt: new Date(),
      },
    ]);

    console.log('[Seri DB] Seed data complete');
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
    pendingSync: await db.sync_queue.where('status').equals('PENDING').count(),
  };
}

# /seri-offline - Offline-First Implementation

Implement offline-first patterns for the Seri pharmacy app using Dexie.js (local) and Neon PostgreSQL (cloud sync).

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      SERI APP (PWA)                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              IndexedDB (Dexie.js)                    │   │
│  │   - Immediate local storage                          │   │
│  │   - Works 100% offline                               │   │
│  │   - Sync queue for pending operations               │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                   │
│                    Background Sync                           │
│                    (when online)                             │
└──────────────────────────┼──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    VERCEL + NEON                             │
│  ┌─────────────────┐    ┌─────────────────────────────┐    │
│  │ API Routes      │───▶│ Neon PostgreSQL              │    │
│  │ (Serverless)    │    │ (Serverless, auto-scaling)   │    │
│  └─────────────────┘    └─────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Dexie.js Database Schema

```typescript
// src/lib/db.ts
import Dexie, { Table } from 'dexie';

export interface User {
  id: string;
  name: string;
  role: 'owner' | 'employee';
  pinHash: string;
}

export interface Product {
  id?: number;
  serverId?: number;  // ID from Neon
  name: string;
  category: string;
  price: number;
  priceBuy?: number;
  stock: number;
  minStock: number;
  synced: boolean;
  updatedAt: Date;
}

export interface Sale {
  id?: number;
  serverId?: number;
  date: Date;
  items: SaleItem[];
  total: number;
  paymentMethod: 'cash' | 'orange-money';
  paymentRef?: string;
  userId: string;
  synced: boolean;
}

export interface SaleItem {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Expense {
  id?: number;
  serverId?: number;
  date: Date;
  description: string;
  amount: number;
  category: 'STOCK_PURCHASE' | 'RENT' | 'SALARY' | 'ELECTRICITY' | 'TRANSPORT' | 'OTHER';
  userId: string;
  synced: boolean;
}

export interface StockMovement {
  id?: number;
  serverId?: number;
  productId: number;
  type: 'SALE' | 'ADJUSTMENT' | 'INVENTORY' | 'DAMAGED' | 'EXPIRED';
  quantityChange: number;
  reason: string;
  date: Date;
  userId: string;
  synced: boolean;
}

export interface SyncQueueItem {
  id?: number;
  type: 'SALE' | 'EXPENSE' | 'PRODUCT' | 'STOCK_MOVEMENT';
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: any;
  localId: number;
  createdAt: Date;
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  retryCount: number;
  lastError?: string;
}

class SeriDatabase extends Dexie {
  users!: Table<User>;
  products!: Table<Product>;
  sales!: Table<Sale>;
  expenses!: Table<Expense>;
  stockMovements!: Table<StockMovement>;
  syncQueue!: Table<SyncQueueItem>;

  constructor() {
    super('seri-db');
    this.version(1).stores({
      users: 'id, role',
      products: '++id, serverId, name, category, synced',
      sales: '++id, serverId, date, userId, synced',
      expenses: '++id, serverId, date, category, userId, synced',
      stockMovements: '++id, serverId, productId, date, synced',
      syncQueue: '++id, type, status, createdAt'
    });
  }
}

export const db = new SeriDatabase();
```

## Neon + Prisma Setup

```typescript
// prisma/schema.prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

model User {
  id        String   @id @default(cuid())
  name      String
  pinHash   String
  role      UserRole
  createdAt DateTime @default(now())

  sales     Sale[]
  expenses  Expense[]
  stockMovements StockMovement[]
}

enum UserRole {
  OWNER
  EMPLOYEE
}

model Product {
  id         Int       @id @default(autoincrement())
  name       String
  category   String
  priceSell  Int       // Store in GNF (integer)
  priceBuy   Int?
  stock      Int
  minStock   Int       @default(5)
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  saleItems  SaleItem[]
  stockMovements StockMovement[]
}

model Sale {
  id            Int       @id @default(autoincrement())
  date          DateTime  @default(now())
  total         Int       // GNF
  paymentMethod PaymentMethod
  paymentRef    String?
  userId        String
  user          User      @relation(fields: [userId], references: [id])

  items         SaleItem[]
}

enum PaymentMethod {
  CASH
  ORANGE_MONEY
}

model SaleItem {
  id        Int     @id @default(autoincrement())
  saleId    Int
  sale      Sale    @relation(fields: [saleId], references: [id])
  productId Int
  product   Product @relation(fields: [productId], references: [id])
  quantity  Int
  unitPrice Int
  subtotal  Int
}

model Expense {
  id          Int      @id @default(autoincrement())
  date        DateTime @default(now())
  description String
  amount      Int      // GNF
  category    ExpenseCategory
  userId      String
  user        User     @relation(fields: [userId], references: [id])
}

enum ExpenseCategory {
  STOCK_PURCHASE
  RENT
  SALARY
  ELECTRICITY
  TRANSPORT
  OTHER
}

model StockMovement {
  id             Int       @id @default(autoincrement())
  productId      Int
  product        Product   @relation(fields: [productId], references: [id])
  type           StockMovementType
  quantityChange Int
  reason         String
  date           DateTime  @default(now())
  userId         String
  user           User      @relation(fields: [userId], references: [id])
}

enum StockMovementType {
  SALE
  ADJUSTMENT
  INVENTORY
  DAMAGED
  EXPIRED
}
```

## Prisma Client with Neon

```typescript
// src/lib/prisma.ts
import { Pool, neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';
import ws from 'ws';

// Required for Neon serverless
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaNeon(pool);

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

## Sync Service

```typescript
// src/lib/sync.ts
import { db, SyncQueueItem } from './db';

export async function queueSync(
  type: SyncQueueItem['type'],
  action: SyncQueueItem['action'],
  payload: any,
  localId: number
) {
  await db.syncQueue.add({
    type,
    action,
    payload,
    localId,
    createdAt: new Date(),
    status: 'PENDING',
    retryCount: 0
  });

  // Attempt sync if online
  if (navigator.onLine) {
    processSyncQueue();
  }
}

export async function processSyncQueue() {
  const pending = await db.syncQueue
    .where('status')
    .anyOf(['PENDING', 'FAILED'])
    .and(item => item.retryCount < 3)
    .toArray();

  for (const item of pending) {
    try {
      await db.syncQueue.update(item.id!, { status: 'SYNCING' });

      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: item.type,
          action: item.action,
          payload: item.payload
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      // Update local record with server ID
      if (result.serverId) {
        const table = getTableForType(item.type);
        await table.update(item.localId, {
          serverId: result.serverId,
          synced: true
        });
      }

      await db.syncQueue.update(item.id!, { status: 'SYNCED' });

    } catch (error) {
      await db.syncQueue.update(item.id!, {
        status: 'FAILED',
        retryCount: item.retryCount + 1,
        lastError: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

function getTableForType(type: string) {
  switch (type) {
    case 'SALE': return db.sales;
    case 'EXPENSE': return db.expenses;
    case 'PRODUCT': return db.products;
    case 'STOCK_MOVEMENT': return db.stockMovements;
    default: throw new Error(`Unknown type: ${type}`);
  }
}

// Auto-sync when coming online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Back online - processing sync queue');
    processSyncQueue();
  });
}
```

## API Route for Sync

```typescript
// src/app/api/sync/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { type, action, payload } = await request.json();

    let result;

    switch (type) {
      case 'SALE':
        result = await handleSaleSync(action, payload);
        break;
      case 'EXPENSE':
        result = await handleExpenseSync(action, payload);
        break;
      case 'PRODUCT':
        result = await handleProductSync(action, payload);
        break;
      case 'STOCK_MOVEMENT':
        result = await handleStockMovementSync(action, payload);
        break;
      default:
        return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}

async function handleSaleSync(action: string, payload: any) {
  if (action === 'CREATE') {
    const sale = await prisma.sale.create({
      data: {
        date: new Date(payload.date),
        total: payload.total,
        paymentMethod: payload.paymentMethod,
        paymentRef: payload.paymentRef,
        userId: payload.userId,
        items: {
          create: payload.items.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal
          }))
        }
      }
    });

    // Update stock in Neon
    for (const item of payload.items) {
      await prisma.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } }
      });
    }

    return { serverId: sale.id };
  }

  throw new Error(`Unknown action: ${action}`);
}

// Similar handlers for EXPENSE, PRODUCT, STOCK_MOVEMENT...
```

## Vercel Environment Variables

Set these in Vercel dashboard:
```
DATABASE_URL=postgres://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
DIRECT_URL=postgres://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

## Sync Status Hook

```typescript
// src/hooks/useSyncStatus.ts
'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useState, useEffect } from 'react';

export function useSyncStatus() {
  const [isOnline, setIsOnline] = useState(true);

  const pendingCount = useLiveQuery(
    () => db.syncQueue.where('status').anyOf(['PENDING', 'FAILED']).count()
  ) ?? 0;

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, pendingCount, isSynced: pendingCount === 0 };
}
```

## Testing Offline Mode

1. Open Chrome DevTools → Network → Check "Offline"
2. Create a sale - should work and show "1 en attente"
3. Check IndexedDB in Application tab - data is stored
4. Uncheck "Offline"
5. Watch sync status change to "Synchronisé"
6. Verify data in Neon dashboard

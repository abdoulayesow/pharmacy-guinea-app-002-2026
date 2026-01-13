/**
 * GET /api/sync/pull
 *
 * Pull server changes to local database
 * Returns all data modified since last sync
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import type { SyncPullResponse } from '@/lib/shared/types';

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(request);

    // Get lastSyncAt from query params
    const searchParams = request.nextUrl.searchParams;
    const lastSyncAt = searchParams.get('lastSyncAt')
      ? new Date(searchParams.get('lastSyncAt')!)
      : null;

    console.log('[API] Sync pull request from:', user.userId);
    console.log('[API] Last sync at:', lastSyncAt);

    // In MVP (offline-first), all data stays in IndexedDB
    // This endpoint will be implemented in Phase 2 when we add server sync

    // TODO: Phase 2 - Implement server-side sync
    // 1. Query PostgreSQL for records updated after lastSyncAt
    // 2. Return products, sales, expenses, stock movements
    // 3. Client merges with local IndexedDB data

    return NextResponse.json<SyncPullResponse>(
      {
        success: true,
        data: {
          products: [],
          sales: [],
          expenses: [],
          stockMovements: [],
          suppliers: [],
          supplierOrders: [],
          supplierReturns: [],
          creditPayments: [], // 🆕 Credit payment tracking
        },
        serverTime: new Date(),
      },
      { status: 501 } // Not Implemented
    );

    // Phase 2 implementation (commented out for now):
    /*
    const products = await prisma.product.findMany({
      where: lastSyncAt ? {
        updatedAt: { gt: lastSyncAt }
      } : undefined,
    });

    const sales = await prisma.sale.findMany({
      where: lastSyncAt ? {
        createdAt: { gt: lastSyncAt }
      } : undefined,
      include: {
        items: true
      }
    });

    const expenses = await prisma.expense.findMany({
      where: lastSyncAt ? {
        date: { gt: lastSyncAt }
      } : undefined,
    });

    const stockMovements = await prisma.stockMovement.findMany({
      where: lastSyncAt ? {
        createdAt: { gt: lastSyncAt }
      } : undefined,
    });

    const suppliers = await prisma.supplier.findMany({
      where: lastSyncAt ? {
        updatedAt: { gt: lastSyncAt }
      } : undefined,
    });

    const supplierOrders = await prisma.supplierOrder.findMany({
      where: lastSyncAt ? {
        updatedAt: { gt: lastSyncAt }
      } : undefined,
    });

    const supplierReturns = await prisma.supplierReturn.findMany({
      where: lastSyncAt ? {
        createdAt: { gt: lastSyncAt }
      } : undefined,
    });

    return NextResponse.json<SyncPullResponse>({
      success: true,
      data: {
        products,
        sales,
        expenses,
        stockMovements,
        suppliers,
        supplierOrders,
        supplierReturns,
      },
      serverTime: new Date(),
    });
    */
  } catch (error) {
    console.error('[API] Sync pull error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json<SyncPullResponse>(
        {
          success: false,
          data: {
            products: [],
            sales: [],
            expenses: [],
            stockMovements: [],
            suppliers: [],
            supplierOrders: [],
            supplierReturns: [],
            creditPayments: [], // 🆕
          },
          serverTime: new Date(),
        },
        { status: 401 }
      );
    }

    return NextResponse.json<SyncPullResponse>(
      {
        success: false,
        data: {
          products: [],
          sales: [],
          expenses: [],
          stockMovements: [],
          suppliers: [],
          supplierOrders: [],
          supplierReturns: [],
          creditPayments: [], // 🆕
        },
        serverTime: new Date(),
      },
      { status: 500 }
    );
  }
}

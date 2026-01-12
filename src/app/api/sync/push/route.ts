/**
 * POST /api/sync/push
 *
 * Push local changes to the server
 * Handles offline-first sync queue
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import type { SyncPushRequest, SyncPushResponse } from '@/lib/shared/types';

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(request);

    // Parse request body
    const body: SyncPushRequest = await request.json();
    const { sales, expenses, stockMovements, products } = body;

    console.log('[API] Sync push request from:', user.userId);
    console.log('[API] Items to sync:', {
      sales: sales?.length || 0,
      expenses: expenses?.length || 0,
      stockMovements: stockMovements?.length || 0,
      products: products?.length || 0,
    });

    // In MVP (offline-first), all data stays in IndexedDB
    // This endpoint will be implemented in Phase 2 when we add server sync

    // TODO: Phase 2 - Implement server-side sync
    // 1. Validate all incoming data
    // 2. Insert into PostgreSQL via Prisma
    // 3. Return server IDs for local records
    // 4. Handle conflicts (last-write-wins with logging)

    return NextResponse.json<SyncPushResponse>(
      {
        success: true,
        synced: {
          sales: [],
          expenses: [],
          stockMovements: [],
          products: [],
        },
        errors: ['MVP: Sync handled client-side. Server sync coming in Phase 2.'],
      },
      { status: 501 } // Not Implemented
    );

    // Phase 2 implementation (commented out for now):
    /*
    const syncedSales: number[] = [];
    const syncedExpenses: number[] = [];
    const syncedStockMovements: number[] = [];
    const syncedProducts: number[] = [];
    const errors: string[] = [];

    // Sync sales
    if (sales && sales.length > 0) {
      for (const sale of sales) {
        try {
          const result = await prisma.sale.create({
            data: {
              total: sale.total,
              paymentMethod: sale.payment_method,
              paymentRef: sale.payment_ref,
              userId: user.userId,
              createdAt: sale.created_at,
            },
          });
          syncedSales.push(sale.id!);
        } catch (error) {
          errors.push(`Failed to sync sale ${sale.id}: ${error.message}`);
        }
      }
    }

    // Sync expenses (similar pattern)
    // Sync stock movements (similar pattern)
    // Sync products (similar pattern)

    return NextResponse.json<SyncPushResponse>({
      success: true,
      synced: {
        sales: syncedSales,
        expenses: syncedExpenses,
        stockMovements: syncedStockMovements,
        products: syncedProducts,
      },
      errors: errors.length > 0 ? errors : undefined,
    });
    */
  } catch (error) {
    console.error('[API] Sync push error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json<SyncPushResponse>(
        {
          success: false,
          synced: {
            sales: [],
            expenses: [],
            stockMovements: [],
            products: [],
          },
          errors: ['Non autorisé'],
        },
        { status: 401 }
      );
    }

    return NextResponse.json<SyncPushResponse>(
      {
        success: false,
        synced: {
          sales: [],
          expenses: [],
          stockMovements: [],
          products: [],
        },
        errors: ['Erreur serveur'],
      },
      { status: 500 }
    );
  }
}

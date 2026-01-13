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
    const { sales, expenses, stockMovements, products, suppliers, supplierOrders, supplierReturns, creditPayments } = body; // 🆕 Added creditPayments

    console.log('[API] Sync push request from:', user.userId);
    console.log('[API] Items to sync:', {
      sales: sales?.length || 0,
      expenses: expenses?.length || 0,
      stockMovements: stockMovements?.length || 0,
      products: products?.length || 0,
      suppliers: suppliers?.length || 0,
      supplierOrders: supplierOrders?.length || 0,
      supplierReturns: supplierReturns?.length || 0,
      creditPayments: creditPayments?.length || 0, // 🆕
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
          suppliers: [],
          supplierOrders: [],
          supplierReturns: [],
          creditPayments: [], // 🆕
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
    const syncedSuppliers: number[] = [];
    const syncedSupplierOrders: number[] = [];
    const syncedSupplierReturns: number[] = [];
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

    // Sync suppliers
    if (suppliers && suppliers.length > 0) {
      for (const supplier of suppliers) {
        try {
          const result = await prisma.supplier.create({
            data: {
              name: supplier.name,
              phone: supplier.phone,
              paymentTermsDays: supplier.paymentTermsDays,
              createdAt: supplier.createdAt,
              updatedAt: supplier.updatedAt,
            },
          });
          syncedSuppliers.push(supplier.id!);
        } catch (error) {
          errors.push(`Failed to sync supplier ${supplier.id}: ${error.message}`);
        }
      }
    }

    // Sync supplier orders
    if (supplierOrders && supplierOrders.length > 0) {
      for (const order of supplierOrders) {
        try {
          const result = await prisma.supplierOrder.create({
            data: {
              supplierId: order.supplierId,
              orderDate: order.orderDate,
              deliveryDate: order.deliveryDate,
              totalAmount: order.totalAmount,
              amountPaid: order.amountPaid,
              dueDate: order.dueDate,
              status: order.status,
              notes: order.notes,
              createdAt: order.createdAt,
              updatedAt: order.updatedAt,
            },
          });
          syncedSupplierOrders.push(order.id!);
        } catch (error) {
          errors.push(`Failed to sync supplier order ${order.id}: ${error.message}`);
        }
      }
    }

    // Sync supplier returns
    if (supplierReturns && supplierReturns.length > 0) {
      for (const returnItem of supplierReturns) {
        try {
          const result = await prisma.supplierReturn.create({
            data: {
              supplierId: returnItem.supplierId,
              productId: returnItem.productId,
              quantity: returnItem.quantity,
              reason: returnItem.reason,
              creditAmount: returnItem.creditAmount,
              returnDate: returnItem.returnDate,
              applied: returnItem.applied,
              appliedToOrderId: returnItem.appliedToOrderId,
              createdAt: returnItem.createdAt,
            },
          });
          syncedSupplierReturns.push(returnItem.id!);
        } catch (error) {
          errors.push(`Failed to sync supplier return ${returnItem.id}: ${error.message}`);
        }
      }
    }

    return NextResponse.json<SyncPushResponse>({
      success: true,
      synced: {
        sales: syncedSales,
        expenses: syncedExpenses,
        stockMovements: syncedStockMovements,
        products: syncedProducts,
        suppliers: syncedSuppliers,
        supplierOrders: syncedSupplierOrders,
        supplierReturns: syncedSupplierReturns,
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
            suppliers: [],
            supplierOrders: [],
            supplierReturns: [],
            creditPayments: [], // 🆕
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
          suppliers: [],
          supplierOrders: [],
          supplierReturns: [],
          creditPayments: [], // 🆕
        },
        errors: ['Erreur serveur'],
      },
      { status: 500 }
    );
  }
}

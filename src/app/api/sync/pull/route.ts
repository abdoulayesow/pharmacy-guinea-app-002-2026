/**
 * GET /api/sync/pull
 *
 * Pull server changes to local database
 * Returns all data modified since last sync
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
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

    // Phase 2: Implement server-side pull sync
    const serverTime = new Date();

    // Query Products (updated after lastSyncAt)
    const products = await prisma.product.findMany({
      where: lastSyncAt
        ? {
            updatedAt: { gt: lastSyncAt },
          }
        : undefined,
      orderBy: { updatedAt: 'asc' },
    });

    // Query Sales (created or modified after lastSyncAt, include sale items)
    const sales = await prisma.sale.findMany({
      where: lastSyncAt
        ? {
            OR: [
              { createdAt: { gt: lastSyncAt } },
              { modifiedAt: { gt: lastSyncAt } },
            ],
          }
        : undefined,
      include: {
        items: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Query Expenses (date after lastSyncAt)
    const expenses = await prisma.expense.findMany({
      where: lastSyncAt
        ? {
            date: { gt: lastSyncAt },
          }
        : undefined,
      orderBy: { date: 'asc' },
    });

    // Query Stock Movements (created after lastSyncAt)
    const stockMovements = await prisma.stockMovement.findMany({
      where: lastSyncAt
        ? {
            createdAt: { gt: lastSyncAt },
          }
        : undefined,
      orderBy: { createdAt: 'asc' },
    });

    // Query Credit Payments (created after lastSyncAt)
    const creditPayments = await prisma.creditPayment.findMany({
      where: lastSyncAt
        ? {
            createdAt: { gt: lastSyncAt },
          }
        : undefined,
      orderBy: { createdAt: 'asc' },
    });

    // Transform Prisma models to client types
    const transformedProducts = products.map((p) => ({
      id: p.id,
      serverId: p.id,
      name: p.name,
      category: '', // Not in schema yet
      price: p.price,
      priceBuy: p.priceBuy || undefined,
      stock: p.stock,
      minStock: p.stockMin,
      synced: true,
      updatedAt: p.updatedAt,
    }));

    const transformedSales = sales.map((s) => ({
      id: s.id,
      serverId: s.id,
      created_at: s.createdAt,
      total: s.total,
      payment_method: s.paymentMethod as 'CASH' | 'ORANGE_MONEY' | 'CREDIT',
      payment_status: s.paymentStatus as 'PAID' | 'PARTIALLY_PAID' | 'PENDING' | 'OVERDUE',
      payment_ref: s.paymentRef || undefined,
      user_id: s.userId,
      customer_name: s.customerName || undefined,
      customer_phone: s.customerPhone || undefined,
      due_date: s.dueDate || undefined,
      amount_paid: s.amountPaid,
      amount_due: s.amountDue,
      modified_at: s.modifiedAt || undefined,
      modified_by: s.modifiedBy || undefined,
      edit_count: s.editCount,
      synced: true,
      // Include sale items as nested array
      items: s.items.map((item) => ({
        id: item.id,
        sale_id: item.saleId,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        subtotal: item.subtotal,
      })),
    }));

    const transformedExpenses = expenses.map((e) => ({
      id: e.id,
      serverId: e.id,
      date: e.date,
      description: e.description,
      amount: e.amount,
      category: e.category as any,
      user_id: e.userId,
      synced: true,
    }));

    const transformedStockMovements = stockMovements.map((m) => ({
      id: m.id,
      serverId: m.id,
      product_id: m.productId,
      type: m.type as any,
      quantity_change: m.quantityChange,
      reason: m.reason || '',
      created_at: m.createdAt,
      user_id: m.userId,
      synced: true,
    }));

    const transformedCreditPayments = creditPayments.map((p) => ({
      id: p.id,
      serverId: p.id,
      sale_id: p.saleId,
      amount: p.amount,
      payment_method: p.method as 'CASH' | 'ORANGE_MONEY',
      payment_ref: p.reference || undefined,
      payment_date: p.createdAt,
      notes: p.notes || undefined,
      user_id: p.recordedBy,
      synced: true,
    }));

    return NextResponse.json<SyncPullResponse>({
      success: true,
      data: {
        products: transformedProducts,
        sales: transformedSales,
        expenses: transformedExpenses,
        stockMovements: transformedStockMovements,
        suppliers: [], // Not yet in schema
        supplierOrders: [], // Not yet in schema
        supplierReturns: [], // Not yet in schema
        creditPayments: transformedCreditPayments,
      },
      serverTime,
    });
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

/**
 * GET /api/sync/pull
 *
 * Pull server changes to local database
 * Returns all data modified since last sync
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import type { SyncPullResponse, SupplierPaymentStatus } from '@/lib/shared/types';

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

    // Query Suppliers (updated after lastSyncAt)
    const suppliers = await prisma.supplier.findMany({
      where: lastSyncAt
        ? {
            updatedAt: { gt: lastSyncAt },
          }
        : undefined,
      orderBy: { updatedAt: 'asc' },
    });

    // Query Supplier Orders (updated after lastSyncAt, include items)
    const supplierOrders = await prisma.supplierOrder.findMany({
      where: lastSyncAt
        ? {
            updatedAt: { gt: lastSyncAt },
          }
        : undefined,
      include: {
        items: true,
      },
      orderBy: { updatedAt: 'asc' },
    });

    // Query Supplier Returns (created after lastSyncAt)
    const supplierReturns = await prisma.supplierReturn.findMany({
      where: lastSyncAt
        ? {
            createdAt: { gt: lastSyncAt },
          }
        : undefined,
      orderBy: { createdAt: 'asc' },
    });

    // Query Product-Supplier Links (created after lastSyncAt)
    const productSuppliers = await prisma.productSupplier.findMany({
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
      category: p.category || '',
      price: p.price,
      priceBuy: p.priceBuy || undefined,
      stock: p.stock,
      minStock: p.minStock,
      expirationDate: p.expirationDate || undefined,
      lotNumber: p.lotNumber || undefined,
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

    // Transform Suppliers
    const transformedSuppliers = suppliers.map((s) => ({
      id: s.id,
      serverId: s.id,
      name: s.name,
      phone: s.phone || undefined,
      paymentTermsDays: s.paymentTermsDays,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      synced: true,
    }));

    // Transform Supplier Orders (with nested items)
    const transformedSupplierOrders = supplierOrders.map((o) => {
      // Map database status to client status type
      let clientStatus: 'PENDING' | 'DELIVERED' | 'CANCELLED' = 'PENDING';
      switch (o.status) {
        case 'PENDING':
          clientStatus = 'PENDING';
          break;
        case 'DELIVERED':
          clientStatus = 'DELIVERED';
          break;
        case 'CANCELLED':
          clientStatus = 'CANCELLED';
          break;
        default:
          clientStatus = 'PENDING';
      }

      // Determine payment status based on amountPaid
      let paymentStatus: SupplierPaymentStatus = 'UNPAID';
      if (o.amountPaid === 0) {
        paymentStatus = 'UNPAID';
      } else if (o.amountPaid >= o.totalAmount) {
        paymentStatus = 'PAID';
      } else {
        paymentStatus = 'PARTIALLY_PAID';
      }

      return {
        id: o.id,
        serverId: o.id,
        supplierId: o.supplierId,
        type: 'ORDER' as const, // Default to ORDER for supplier orders
        orderDate: o.orderDate,
        deliveryDate: o.deliveryDate || undefined,
        totalAmount: o.totalAmount,
        calculatedTotal: o.calculatedTotal || undefined,
        amountPaid: o.amountPaid,
        dueDate: o.dueDate,
        status: clientStatus,
        paymentStatus,
        notes: o.notes || undefined,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
        synced: true,
      };
    });

    // Transform Supplier Order Items (flattened from orders)
    const transformedSupplierOrderItems = supplierOrders.flatMap((o) =>
      o.items.map((item) => ({
        id: item.id,
        serverId: item.id,
        order_id: item.orderId,
        product_id: item.productId || undefined,
        product_name: item.productName,
        category: item.category || undefined,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        subtotal: item.subtotal,
        notes: item.notes || undefined,
        synced: true,
      }))
    );

    // Transform Supplier Returns
    // Map DB reason to client ReturnReason type
    const transformedSupplierReturns = supplierReturns.map((r) => {
      // Map database reason to client type (EXPIRING | DAMAGED | OTHER)
      let clientReason: 'EXPIRING' | 'DAMAGED' | 'OTHER' = 'OTHER';
      switch (r.reason) {
        case 'EXPIRED':
        case 'EXPIRING':
          clientReason = 'EXPIRING';
          break;
        case 'DAMAGED':
          clientReason = 'DAMAGED';
          break;
        default:
          clientReason = 'OTHER';
      }

      return {
        id: r.id,
        serverId: r.id,
        supplierId: r.supplierId,
        supplierOrderId: r.supplierOrderId || undefined,
        productId: r.productId,
        quantity: r.quantity,
        reason: clientReason,
        creditAmount: r.creditAmount,
        returnDate: r.returnDate,
        applied: r.applied,
        appliedToOrderId: r.appliedToOrderId || undefined,
        createdAt: r.createdAt,
        synced: true,
      };
    });

    // Transform Product-Supplier Links
    const transformedProductSuppliers = productSuppliers.map((ps) => ({
      id: ps.id,
      serverId: ps.id,
      product_id: ps.productId,
      supplier_id: ps.supplierId,
      supplier_product_code: ps.supplierProductCode || undefined,
      supplier_product_name: ps.supplierProductName || undefined,
      default_price: ps.defaultPrice || undefined,
      is_primary: ps.isPrimary,
      last_ordered_date: ps.lastOrderedDate || undefined,
      synced: true,
    }));

    return NextResponse.json<SyncPullResponse>({
      success: true,
      data: {
        products: transformedProducts,
        sales: transformedSales,
        expenses: transformedExpenses,
        stockMovements: transformedStockMovements,
        suppliers: transformedSuppliers,
        supplierOrders: transformedSupplierOrders,
        supplierOrderItems: transformedSupplierOrderItems,
        supplierReturns: transformedSupplierReturns,
        productSuppliers: transformedProductSuppliers,
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
            supplierOrderItems: [],
            supplierReturns: [],
            productSuppliers: [],
            creditPayments: [],
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
          supplierOrderItems: [],
          supplierReturns: [],
          productSuppliers: [],
          creditPayments: [],
        },
        serverTime: new Date(),
      },
      { status: 500 }
    );
  }
}

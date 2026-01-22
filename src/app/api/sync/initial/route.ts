/**
 * GET /api/sync/initial?role=EMPLOYEE
 *
 * First-time sync endpoint for new users
 * Returns all data from PostgreSQL (single source of truth)
 * Role-based filtering:
 * - EMPLOYEE: No expenses, last 30 days of sales/movements only
 * - OWNER: All data
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import type { UserRole } from '@/lib/shared/types';

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(request);

    // Get role from query params (fallback to session role)
    const searchParams = request.nextUrl.searchParams;
    const roleParam = searchParams.get('role') as UserRole | null;
    const userRole: UserRole = (roleParam || user.role) as UserRole;

    console.log('[API] Initial sync request from user:', user.userId, 'role:', userRole);

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Fetch all products (both roles need this for stock consistency)
    const products = await prisma.product.findMany({
      orderBy: { name: 'asc' },
    });
    console.log('[API] Fetched products:', products.length);

    // Fetch all suppliers (both roles need this)
    const suppliers = await prisma.supplier.findMany({
      orderBy: { name: 'asc' },
    });
    console.log('[API] Fetched suppliers:', suppliers.length);

    // Fetch supplier orders with items (both roles, view-only for employees)
    const supplierOrders = await prisma.supplierOrder.findMany({
      include: {
        items: true, // Items don't have a product relation (productId is nullable)
      },
      orderBy: { createdAt: 'desc' },
    });
    console.log('[API] Fetched supplier orders:', supplierOrders.length);

    // Fetch sales (filtered for employees: last 30 days only)
    const sales = userRole === 'EMPLOYEE'
      ? await prisma.sale.findMany({
          where: { createdAt: { gte: thirtyDaysAgo } },
          include: {
            items: {
              include: {
                product: true, // Include product details for receipt
              }
            }
          },
          orderBy: { createdAt: 'desc' },
        })
      : await prisma.sale.findMany({
          include: {
            items: {
              include: {
                product: true,
              }
            }
          },
          orderBy: { createdAt: 'desc' },
        });
    console.log('[API] Fetched sales:', sales.length, `(role: ${userRole})`);

    // Fetch stock movements (filtered for employees: last 30 days only)
    const stockMovements = userRole === 'EMPLOYEE'
      ? await prisma.stockMovement.findMany({
          where: { createdAt: { gte: thirtyDaysAgo } },
          orderBy: { createdAt: 'desc' },
        })
      : await prisma.stockMovement.findMany({
          orderBy: { createdAt: 'desc' },
        });
    console.log('[API] Fetched stock movements:', stockMovements.length, `(role: ${userRole})`);

    // Fetch expenses (OWNER only - employees get empty array)
    const expenses = userRole === 'OWNER'
      ? await prisma.expense.findMany({
          orderBy: { date: 'desc' },
        })
      : [];
    console.log('[API] Fetched expenses:', expenses.length, `(role: ${userRole})`);

    // Fetch credit payments (filtered for employees: last 30 days only)
    const creditPayments = userRole === 'EMPLOYEE'
      ? await prisma.creditPayment.findMany({
          where: { createdAt: { gte: thirtyDaysAgo } },
          orderBy: { createdAt: 'desc' },
        })
      : await prisma.creditPayment.findMany({
          orderBy: { createdAt: 'desc' },
        });
    console.log('[API] Fetched credit payments:', creditPayments.length, `(role: ${userRole})`);

    // Fetch product batches - FEFO Phase 3 (all batches for both roles)
    const productBatches = await prisma.productBatch.findMany({
      orderBy: { expirationDate: 'asc' }, // FEFO order
    });
    console.log('[API] Fetched product batches:', productBatches.length);

    // Transform product batches to client format (match ProductBatch interface)
    // UUID migration: No serverId needed - id is the same on client and server
    const transformedProductBatches = productBatches.map((b) => ({
      id: b.id,
      product_id: b.productId,
      lot_number: b.lotNumber,
      expiration_date: b.expirationDate,
      quantity: b.quantity,
      initial_qty: b.initialQty,
      unit_cost: b.unitCost,
      supplier_order_id: b.supplierOrderId,
      received_date: b.receivedDate,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      synced: true,
    }));

    // Return all data
    return NextResponse.json({
      success: true,
      data: {
        products,
        suppliers,
        supplierOrders,
        sales,
        stockMovements,
        creditPayments,
        productBatches: transformedProductBatches, // 🆕 FEFO Phase 3
        expenses,
      },
      serverTime: now.toISOString(),
      userRole, // Echo back for client verification
    });

  } catch (error) {
    console.error('[API] Initial sync error:', error);

    // Handle auth errors (401)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Handle other errors (500)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Initial sync failed'
      },
      { status: 500 }
    );
  }
}

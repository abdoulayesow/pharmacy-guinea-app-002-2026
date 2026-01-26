/**
 * GET /api/sync/audit
 *
 * Data integrity audit endpoint
 * Compares local IndexedDB snapshot with PostgreSQL to detect inconsistencies
 *
 * Request body (POST):
 * {
 *   products: Array<{id: string, stock: number, updatedAt: string}>,
 *   sales: Array<{id: string, total: number, createdAt: string}>,
 *   stockMovements: Array<{id: string, productId: string, quantityChange: number}>,
 *   expenses: Array<{id: string, amount: number}>,
 * }
 *
 * Response:
 * {
 *   success: true,
 *   audit: {
 *     products: { matches: number, mismatches: Array<...> },
 *     sales: { matches: number, mismatches: Array<...> },
 *     stockMovements: { matches: number, mismatches: Array<...> },
 *     expenses: { matches: number, mismatches: Array<...> },
 *   },
 *   summary: {
 *     totalChecked: number,
 *     totalMismatches: number,
 *     status: 'HEALTHY' | 'ISSUES_FOUND'
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import type { UserRole } from '@/lib/shared/types';

interface ProductSnapshot {
  id: string;
  stock: number;
  updatedAt: string;
}

interface SaleSnapshot {
  id: string;
  total: number;
  createdAt: string;
}

interface StockMovementSnapshot {
  id: string;
  productId: string;
  quantityChange: number;
}

interface ExpenseSnapshot {
  id: string;
  amount: number;
}

interface AuditRequest {
  products: ProductSnapshot[];
  sales: SaleSnapshot[];
  stockMovements: StockMovementSnapshot[];
  expenses: ExpenseSnapshot[];
}

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(request);
    console.log('[API] Audit request from user:', user.userId, 'role:', user.role);

    // Parse request body
    const body = await request.json() as AuditRequest;

    // Audit products
    const productAudit = await auditProducts(body.products);

    // Audit sales
    const salesAudit = await auditSales(body.sales);

    // Audit stock movements
    const stockMovementsAudit = await auditStockMovements(body.stockMovements);

    // Audit expenses (OWNER only)
    const expensesAudit = user.role === 'OWNER'
      ? await auditExpenses(body.expenses)
      : { matches: 0, mismatches: [] };

    // Calculate summary
    const totalChecked =
      productAudit.matches + productAudit.mismatches.length +
      salesAudit.matches + salesAudit.mismatches.length +
      stockMovementsAudit.matches + stockMovementsAudit.mismatches.length +
      expensesAudit.matches + expensesAudit.mismatches.length;

    const totalMismatches =
      productAudit.mismatches.length +
      salesAudit.mismatches.length +
      stockMovementsAudit.mismatches.length +
      expensesAudit.mismatches.length;

    console.log('[API] Audit complete:', {
      totalChecked,
      totalMismatches,
      productMismatches: productAudit.mismatches.length,
      salesMismatches: salesAudit.mismatches.length,
      stockMovementsMismatches: stockMovementsAudit.mismatches.length,
      expensesMismatches: expensesAudit.mismatches.length,
    });

    return NextResponse.json({
      success: true,
      audit: {
        products: productAudit,
        sales: salesAudit,
        stockMovements: stockMovementsAudit,
        expenses: expensesAudit,
      },
      summary: {
        totalChecked,
        totalMismatches,
        status: totalMismatches === 0 ? 'HEALTHY' : 'ISSUES_FOUND',
      },
      serverTime: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[API] Audit error:', error);

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
        error: error instanceof Error ? error.message : 'Audit failed'
      },
      { status: 500 }
    );
  }
}

/**
 * Audit products: Compare stock and updatedAt
 */
async function auditProducts(localProducts: ProductSnapshot[]) {
  const mismatches: any[] = [];
  let matches = 0;

  for (const local of localProducts) {
    const server = await prisma.product.findUnique({
      where: { id: local.id },
      select: { id: true, stock: true, updatedAt: true, name: true },
    });

    if (!server) {
      mismatches.push({
        id: local.id,
        type: 'MISSING_ON_SERVER',
        local: { stock: local.stock, updatedAt: local.updatedAt },
        server: null,
      });
      continue;
    }

    // Compare stock
    if (server.stock !== local.stock) {
      mismatches.push({
        id: local.id,
        name: server.name,
        type: 'STOCK_MISMATCH',
        local: { stock: local.stock },
        server: { stock: server.stock },
      });
      continue;
    }

    matches++;
  }

  return { matches, mismatches };
}

/**
 * Audit sales: Compare total and existence
 */
async function auditSales(localSales: SaleSnapshot[]) {
  const mismatches: any[] = [];
  let matches = 0;

  for (const local of localSales) {
    const server = await prisma.sale.findUnique({
      where: { id: local.id },
      select: { id: true, total: true, createdAt: true },
    });

    if (!server) {
      mismatches.push({
        id: local.id,
        type: 'MISSING_ON_SERVER',
        local: { total: local.total, createdAt: local.createdAt },
        server: null,
      });
      continue;
    }

    // Compare total
    if (server.total !== local.total) {
      mismatches.push({
        id: local.id,
        type: 'TOTAL_MISMATCH',
        local: { total: local.total },
        server: { total: server.total },
      });
      continue;
    }

    matches++;
  }

  return { matches, mismatches };
}

/**
 * Audit stock movements: Compare quantity change
 */
async function auditStockMovements(localMovements: StockMovementSnapshot[]) {
  const mismatches: any[] = [];
  let matches = 0;

  for (const local of localMovements) {
    const server = await prisma.stockMovement.findUnique({
      where: { id: local.id },
      select: {
        id: true,
        productId: true,
        quantityChange: true,
        type: true,
        reason: true,
      },
    });

    if (!server) {
      mismatches.push({
        id: local.id,
        type: 'MISSING_ON_SERVER',
        local: {
          productId: local.productId,
          quantityChange: local.quantityChange
        },
        server: null,
      });
      continue;
    }

    // Compare quantity change
    if (server.quantityChange !== local.quantityChange) {
      mismatches.push({
        id: local.id,
        type: 'QUANTITY_MISMATCH',
        local: { quantityChange: local.quantityChange },
        server: { quantityChange: server.quantityChange },
      });
      continue;
    }

    matches++;
  }

  return { matches, mismatches };
}

/**
 * Audit expenses: Compare amount
 */
async function auditExpenses(localExpenses: ExpenseSnapshot[]) {
  const mismatches: any[] = [];
  let matches = 0;

  for (const local of localExpenses) {
    const server = await prisma.expense.findUnique({
      where: { id: local.id },
      select: {
        id: true,
        amount: true,
        category: true,
        description: true,
      },
    });

    if (!server) {
      mismatches.push({
        id: local.id,
        type: 'MISSING_ON_SERVER',
        local: { amount: local.amount },
        server: null,
      });
      continue;
    }

    // Compare amount
    if (server.amount !== local.amount) {
      mismatches.push({
        id: local.id,
        type: 'AMOUNT_MISMATCH',
        local: { amount: local.amount },
        server: { amount: server.amount },
      });
      continue;
    }

    matches++;
  }

  return { matches, mismatches };
}

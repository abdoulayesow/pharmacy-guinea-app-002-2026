/**
 * /api/supplier-returns
 *
 * CRUD operations for supplier product returns
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import type { SupplierReturn, ReturnReason } from '@/lib/shared/types';

// Response types
interface ReturnsResponse {
  success: boolean;
  data?: SupplierReturn[];
  error?: string;
}

interface ReturnResponse {
  success: boolean;
  data?: SupplierReturn;
  error?: string;
}

/**
 * GET /api/supplier-returns
 * Get all supplier returns (optionally filtered by supplierId)
 */
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(request);

    // Get optional supplierId filter from query params
    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get('supplierId');

    console.log('[API] Get supplier returns request from:', user.userId);

    // In MVP (offline-first), all data stays in IndexedDB
    // This endpoint will be implemented in Phase 2 when we add server sync

    // TODO: Phase 2 - Get returns from PostgreSQL
    // const returns = await prisma.supplierReturn.findMany({
    //   where: supplierId ? { supplierId: parseInt(supplierId) } : {},
    //   orderBy: { returnDate: 'desc' },
    // });

    return NextResponse.json<ReturnsResponse>(
      {
        success: true,
        data: [],
        error: 'MVP: Data handled client-side via IndexedDB. Server sync coming in Phase 2.',
      },
      { status: 501 } // Not Implemented
    );

    // Phase 2 implementation:
    /*
    const returns = await prisma.supplierReturn.findMany({
      where: supplierId ? { supplierId: parseInt(supplierId) } : {},
      orderBy: { returnDate: 'desc' },
      include: {
        supplier: true,
        product: true,
      },
    });

    return NextResponse.json<ReturnsResponse>({
      success: true,
      data: returns,
    });
    */
  } catch (error) {
    console.error('[API] Get supplier returns error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json<ReturnsResponse>(
        {
          success: false,
          error: 'Non autorisé',
        },
        { status: 401 }
      );
    }

    return NextResponse.json<ReturnsResponse>(
      {
        success: false,
        error: 'Erreur serveur',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/supplier-returns
 * Create a new supplier return
 */
export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(request);

    // Parse request body
    const body = await request.json();
    const { supplierId, productId, quantity, reason, creditAmount, returnDate } = body;

    // Validate input
    if (!supplierId || !productId || !quantity || !reason || !creditAmount || !returnDate) {
      return NextResponse.json<ReturnResponse>(
        {
          success: false,
          error: 'Tous les champs sont requis',
        },
        { status: 400 }
      );
    }

    if (quantity <= 0) {
      return NextResponse.json<ReturnResponse>(
        {
          success: false,
          error: 'Quantité invalide',
        },
        { status: 400 }
      );
    }

    if (creditAmount < 0) {
      return NextResponse.json<ReturnResponse>(
        {
          success: false,
          error: 'Montant du crédit invalide',
        },
        { status: 400 }
      );
    }

    const validReasons: ReturnReason[] = ['EXPIRING', 'DAMAGED', 'OTHER'];
    if (!validReasons.includes(reason)) {
      return NextResponse.json<ReturnResponse>(
        {
          success: false,
          error: 'Raison du retour invalide',
        },
        { status: 400 }
      );
    }

    console.log('[API] Create supplier return request from:', user.userId);

    // TODO: Phase 2 - Create return in PostgreSQL
    // const supplierReturn = await prisma.supplierReturn.create({
    //   data: {
    //     supplierId: parseInt(supplierId),
    //     productId: parseInt(productId),
    //     quantity: parseInt(quantity),
    //     reason: reason as ReturnReason,
    //     creditAmount: parseInt(creditAmount),
    //     returnDate: new Date(returnDate),
    //     applied: false,
    //   },
    // });

    return NextResponse.json<ReturnResponse>(
      {
        success: true,
        error: 'MVP: Data handled client-side via IndexedDB. Server sync coming in Phase 2.',
      },
      { status: 501 } // Not Implemented
    );

    // Phase 2 implementation:
    /*
    const supplierReturn = await prisma.supplierReturn.create({
      data: {
        supplierId: parseInt(supplierId),
        productId: parseInt(productId),
        quantity: parseInt(quantity),
        reason: reason as ReturnReason,
        creditAmount: parseInt(creditAmount),
        returnDate: new Date(returnDate),
        applied: false,
      },
    });

    return NextResponse.json<ReturnResponse>({
      success: true,
      data: supplierReturn,
    }, { status: 201 });
    */
  } catch (error) {
    console.error('[API] Create supplier return error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json<ReturnResponse>(
        {
          success: false,
          error: 'Non autorisé',
        },
        { status: 401 }
      );
    }

    return NextResponse.json<ReturnResponse>(
      {
        success: false,
        error: 'Erreur serveur',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/supplier-returns
 * Apply credit to an order
 */
export async function PUT(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(request);

    // Parse request body
    const body = await request.json();
    const { id, appliedToOrderId } = body;

    // Validate input
    if (!id || !appliedToOrderId) {
      return NextResponse.json<ReturnResponse>(
        {
          success: false,
          error: 'ID de retour et ID de commande sont requis',
        },
        { status: 400 }
      );
    }

    console.log('[API] Apply return credit request from:', user.userId);

    // TODO: Phase 2 - Apply credit to order in PostgreSQL
    // const supplierReturn = await prisma.supplierReturn.findUnique({
    //   where: { id: parseInt(id) },
    // });
    //
    // if (!supplierReturn) {
    //   return NextResponse.json<ReturnResponse>(
    //     {
    //       success: false,
    //       error: 'Retour non trouvé',
    //     },
    //     { status: 404 }
    //   );
    // }
    //
    // if (supplierReturn.applied) {
    //   return NextResponse.json<ReturnResponse>(
    //     {
    //       success: false,
    //       error: 'Ce crédit a déjà été appliqué',
    //     },
    //     { status: 400 }
    //   );
    // }
    //
    // const updatedReturn = await prisma.supplierReturn.update({
    //   where: { id: parseInt(id) },
    //   data: {
    //     applied: true,
    //     appliedToOrderId: parseInt(appliedToOrderId),
    //   },
    // });

    return NextResponse.json<ReturnResponse>(
      {
        success: true,
        error: 'MVP: Data handled client-side via IndexedDB. Server sync coming in Phase 2.',
      },
      { status: 501 } // Not Implemented
    );

    // Phase 2 implementation:
    /*
    const supplierReturn = await prisma.supplierReturn.findUnique({
      where: { id: parseInt(id) },
    });

    if (!supplierReturn) {
      return NextResponse.json<ReturnResponse>(
        {
          success: false,
          error: 'Retour non trouvé',
        },
        { status: 404 }
      );
    }

    if (supplierReturn.applied) {
      return NextResponse.json<ReturnResponse>(
        {
          success: false,
          error: 'Ce crédit a déjà été appliqué',
        },
        { status: 400 }
      );
    }

    const updatedReturn = await prisma.supplierReturn.update({
      where: { id: parseInt(id) },
      data: {
        applied: true,
        appliedToOrderId: parseInt(appliedToOrderId),
      },
    });

    return NextResponse.json<ReturnResponse>({
      success: true,
      data: updatedReturn,
    });
    */
  } catch (error) {
    console.error('[API] Apply return credit error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json<ReturnResponse>(
        {
          success: false,
          error: 'Non autorisé',
        },
        { status: 401 }
      );
    }

    return NextResponse.json<ReturnResponse>(
      {
        success: false,
        error: 'Erreur serveur',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/supplier-returns
 * Delete a supplier return
 */
export async function DELETE(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(request);

    // Get return ID from query params
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json<ReturnResponse>(
        {
          success: false,
          error: 'ID de retour requis',
        },
        { status: 400 }
      );
    }

    console.log('[API] Delete supplier return request from:', user.userId);

    // TODO: Phase 2 - Delete return from PostgreSQL
    // Check if credit has been applied first
    // const supplierReturn = await prisma.supplierReturn.findUnique({
    //   where: { id: parseInt(id) },
    // });
    //
    // if (!supplierReturn) {
    //   return NextResponse.json<ReturnResponse>(
    //     {
    //       success: false,
    //       error: 'Retour non trouvé',
    //     },
    //     { status: 404 }
    //   );
    // }
    //
    // if (supplierReturn.applied) {
    //   return NextResponse.json<ReturnResponse>(
    //     {
    //       success: false,
    //       error: 'Impossible de supprimer: le crédit a été appliqué',
    //     },
    //     { status: 400 }
    //   );
    // }
    //
    // await prisma.supplierReturn.delete({
    //   where: { id: parseInt(id) },
    // });

    return NextResponse.json<ReturnResponse>(
      {
        success: true,
        error: 'MVP: Data handled client-side via IndexedDB. Server sync coming in Phase 2.',
      },
      { status: 501 } // Not Implemented
    );

    // Phase 2 implementation:
    /*
    const supplierReturn = await prisma.supplierReturn.findUnique({
      where: { id: parseInt(id) },
    });

    if (!supplierReturn) {
      return NextResponse.json<ReturnResponse>(
        {
          success: false,
          error: 'Retour non trouvé',
        },
        { status: 404 }
      );
    }

    if (supplierReturn.applied) {
      return NextResponse.json<ReturnResponse>(
        {
          success: false,
          error: 'Impossible de supprimer: le crédit a été appliqué',
        },
        { status: 400 }
      );
    }

    await prisma.supplierReturn.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json<ReturnResponse>({
      success: true,
    });
    */
  } catch (error) {
    console.error('[API] Delete supplier return error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json<ReturnResponse>(
        {
          success: false,
          error: 'Non autorisé',
        },
        { status: 401 }
      );
    }

    return NextResponse.json<ReturnResponse>(
      {
        success: false,
        error: 'Erreur serveur',
      },
      { status: 500 }
    );
  }
}

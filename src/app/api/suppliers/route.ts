/**
 * /api/suppliers
 *
 * CRUD operations for suppliers
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import type { Supplier } from '@/lib/shared/types';

// Response types
interface SuppliersResponse {
  success: boolean;
  data?: Supplier[];
  error?: string;
}

interface SupplierResponse {
  success: boolean;
  data?: Supplier;
  error?: string;
}

/**
 * GET /api/suppliers
 * Get all suppliers
 */
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(request);

    console.log('[API] Get suppliers request from:', user.userId);

    // In MVP (offline-first), all data stays in IndexedDB
    // This endpoint will be implemented in Phase 2 when we add server sync

    // TODO: Phase 2 - Get suppliers from PostgreSQL
    // const suppliers = await prisma.supplier.findMany({
    //   orderBy: { name: 'asc' },
    // });

    return NextResponse.json<SuppliersResponse>(
      {
        success: true,
        data: [],
        error: 'MVP: Data handled client-side via IndexedDB. Server sync coming in Phase 2.',
      },
      { status: 501 } // Not Implemented
    );

    // Phase 2 implementation:
    /*
    const suppliers = await prisma.supplier.findMany({
      orderBy: { name: 'asc' },
    });

    return NextResponse.json<SuppliersResponse>({
      success: true,
      data: suppliers,
    });
    */
  } catch (error) {
    console.error('[API] Get suppliers error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json<SuppliersResponse>(
        {
          success: false,
          error: 'Non autorisé',
        },
        { status: 401 }
      );
    }

    return NextResponse.json<SuppliersResponse>(
      {
        success: false,
        error: 'Erreur serveur',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/suppliers
 * Create a new supplier
 */
export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(request);

    // Parse request body
    const body = await request.json();
    const { name, phone, paymentTermsDays } = body;

    // Validate input
    if (!name || !paymentTermsDays) {
      return NextResponse.json<SupplierResponse>(
        {
          success: false,
          error: 'Nom et délai de paiement sont requis',
        },
        { status: 400 }
      );
    }

    if (paymentTermsDays < 0 || paymentTermsDays > 365) {
      return NextResponse.json<SupplierResponse>(
        {
          success: false,
          error: 'Délai de paiement invalide (0-365 jours)',
        },
        { status: 400 }
      );
    }

    console.log('[API] Create supplier request from:', user.userId);

    // TODO: Phase 2 - Create supplier in PostgreSQL
    // const supplier = await prisma.supplier.create({
    //   data: {
    //     name: name.trim(),
    //     phone: phone?.trim() || null,
    //     paymentTermsDays: parseInt(paymentTermsDays),
    //   },
    // });

    return NextResponse.json<SupplierResponse>(
      {
        success: true,
        error: 'MVP: Data handled client-side via IndexedDB. Server sync coming in Phase 2.',
      },
      { status: 501 } // Not Implemented
    );

    // Phase 2 implementation:
    /*
    const supplier = await prisma.supplier.create({
      data: {
        name: name.trim(),
        phone: phone?.trim() || null,
        paymentTermsDays: parseInt(paymentTermsDays),
      },
    });

    return NextResponse.json<SupplierResponse>({
      success: true,
      data: supplier,
    }, { status: 201 });
    */
  } catch (error) {
    console.error('[API] Create supplier error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json<SupplierResponse>(
        {
          success: false,
          error: 'Non autorisé',
        },
        { status: 401 }
      );
    }

    return NextResponse.json<SupplierResponse>(
      {
        success: false,
        error: 'Erreur serveur',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/suppliers
 * Update a supplier
 */
export async function PUT(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(request);

    // Parse request body
    const body = await request.json();
    const { id, name, phone, paymentTermsDays } = body;

    // Validate input
    if (!id || !name || !paymentTermsDays) {
      return NextResponse.json<SupplierResponse>(
        {
          success: false,
          error: 'ID, nom et délai de paiement sont requis',
        },
        { status: 400 }
      );
    }

    if (paymentTermsDays < 0 || paymentTermsDays > 365) {
      return NextResponse.json<SupplierResponse>(
        {
          success: false,
          error: 'Délai de paiement invalide (0-365 jours)',
        },
        { status: 400 }
      );
    }

    console.log('[API] Update supplier request from:', user.userId);

    // TODO: Phase 2 - Update supplier in PostgreSQL
    // const supplier = await prisma.supplier.update({
    //   where: { id: parseInt(id) },
    //   data: {
    //     name: name.trim(),
    //     phone: phone?.trim() || null,
    //     paymentTermsDays: parseInt(paymentTermsDays),
    //     updatedAt: new Date(),
    //   },
    // });

    return NextResponse.json<SupplierResponse>(
      {
        success: true,
        error: 'MVP: Data handled client-side via IndexedDB. Server sync coming in Phase 2.',
      },
      { status: 501 } // Not Implemented
    );

    // Phase 2 implementation:
    /*
    const supplier = await prisma.supplier.update({
      where: { id: parseInt(id) },
      data: {
        name: name.trim(),
        phone: phone?.trim() || null,
        paymentTermsDays: parseInt(paymentTermsDays),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json<SupplierResponse>({
      success: true,
      data: supplier,
    });
    */
  } catch (error) {
    console.error('[API] Update supplier error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json<SupplierResponse>(
        {
          success: false,
          error: 'Non autorisé',
        },
        { status: 401 }
      );
    }

    return NextResponse.json<SupplierResponse>(
      {
        success: false,
        error: 'Erreur serveur',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/suppliers
 * Delete a supplier
 */
export async function DELETE(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(request);

    // Get supplier ID from query params
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json<SupplierResponse>(
        {
          success: false,
          error: 'ID du fournisseur requis',
        },
        { status: 400 }
      );
    }

    console.log('[API] Delete supplier request from:', user.userId);

    // TODO: Phase 2 - Delete supplier from PostgreSQL
    // Check for existing orders first
    // const orderCount = await prisma.supplierOrder.count({
    //   where: { supplierId: parseInt(id) },
    // });
    //
    // if (orderCount > 0) {
    //   return NextResponse.json<SupplierResponse>(
    //     {
    //       success: false,
    //       error: 'Impossible de supprimer: ce fournisseur a des commandes',
    //     },
    //     { status: 400 }
    //   );
    // }
    //
    // await prisma.supplier.delete({
    //   where: { id: parseInt(id) },
    // });

    return NextResponse.json<SupplierResponse>(
      {
        success: true,
        error: 'MVP: Data handled client-side via IndexedDB. Server sync coming in Phase 2.',
      },
      { status: 501 } // Not Implemented
    );

    // Phase 2 implementation:
    /*
    const orderCount = await prisma.supplierOrder.count({
      where: { supplierId: parseInt(id) },
    });

    if (orderCount > 0) {
      return NextResponse.json<SupplierResponse>(
        {
          success: false,
          error: 'Impossible de supprimer: ce fournisseur a des commandes',
        },
        { status: 400 }
      );
    }

    await prisma.supplier.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json<SupplierResponse>({
      success: true,
    });
    */
  } catch (error) {
    console.error('[API] Delete supplier error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json<SupplierResponse>(
        {
          success: false,
          error: 'Non autorisé',
        },
        { status: 401 }
      );
    }

    return NextResponse.json<SupplierResponse>(
      {
        success: false,
        error: 'Erreur serveur',
      },
      { status: 500 }
    );
  }
}

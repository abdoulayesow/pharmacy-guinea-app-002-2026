/**
 * /api/supplier-orders
 *
 * CRUD operations for supplier orders
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import type { SupplierOrder, SupplierOrderStatus } from '@/lib/shared/types';

// Response types
interface OrdersResponse {
  success: boolean;
  data?: SupplierOrder[];
  error?: string;
}

interface OrderResponse {
  success: boolean;
  data?: SupplierOrder;
  error?: string;
}

/**
 * GET /api/supplier-orders
 * Get all supplier orders (optionally filtered by supplierId)
 */
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(request);

    // Get optional supplierId filter from query params
    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get('supplierId');

    console.log('[API] Get supplier orders request from:', user.userId);

    // In MVP (offline-first), all data stays in IndexedDB
    // This endpoint will be implemented in Phase 2 when we add server sync

    // TODO: Phase 2 - Get orders from PostgreSQL
    // const orders = await prisma.supplierOrder.findMany({
    //   where: supplierId ? { supplierId: parseInt(supplierId) } : {},
    //   orderBy: { orderDate: 'desc' },
    // });

    return NextResponse.json<OrdersResponse>(
      {
        success: true,
        data: [],
        error: 'MVP: Data handled client-side via IndexedDB. Server sync coming in Phase 2.',
      },
      { status: 501 } // Not Implemented
    );

    // Phase 2 implementation:
    /*
    const orders = await prisma.supplierOrder.findMany({
      where: supplierId ? { supplierId: parseInt(supplierId) } : {},
      orderBy: { orderDate: 'desc' },
      include: {
        supplier: true,
      },
    });

    return NextResponse.json<OrdersResponse>({
      success: true,
      data: orders,
    });
    */
  } catch (error) {
    console.error('[API] Get supplier orders error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json<OrdersResponse>(
        {
          success: false,
          error: 'Non autorisé',
        },
        { status: 401 }
      );
    }

    return NextResponse.json<OrdersResponse>(
      {
        success: false,
        error: 'Erreur serveur',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/supplier-orders
 * Create a new supplier order
 */
export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(request);

    // Parse request body
    const body = await request.json();
    const { supplierId, orderDate, deliveryDate, totalAmount, notes } = body;

    // Validate input
    if (!supplierId || !orderDate || !totalAmount) {
      return NextResponse.json<OrderResponse>(
        {
          success: false,
          error: 'Fournisseur, date et montant sont requis',
        },
        { status: 400 }
      );
    }

    if (totalAmount <= 0) {
      return NextResponse.json<OrderResponse>(
        {
          success: false,
          error: 'Montant invalide',
        },
        { status: 400 }
      );
    }

    console.log('[API] Create supplier order request from:', user.userId);

    // TODO: Phase 2 - Create order in PostgreSQL
    // // Get supplier to calculate due date
    // const supplier = await prisma.supplier.findUnique({
    //   where: { id: parseInt(supplierId) },
    // });
    //
    // if (!supplier) {
    //   return NextResponse.json<OrderResponse>(
    //     {
    //       success: false,
    //       error: 'Fournisseur non trouvé',
    //     },
    //     { status: 404 }
    //   );
    // }
    //
    // // Calculate due date
    // const orderDateObj = new Date(orderDate);
    // const dueDate = new Date(orderDateObj);
    // dueDate.setDate(dueDate.getDate() + supplier.paymentTermsDays);
    //
    // const order = await prisma.supplierOrder.create({
    //   data: {
    //     supplierId: parseInt(supplierId),
    //     orderDate: orderDateObj,
    //     deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
    //     totalAmount: parseInt(totalAmount),
    //     amountPaid: 0,
    //     dueDate,
    //     status: 'ORDERED',
    //     notes: notes?.trim() || null,
    //   },
    // });

    return NextResponse.json<OrderResponse>(
      {
        success: true,
        error: 'MVP: Data handled client-side via IndexedDB. Server sync coming in Phase 2.',
      },
      { status: 501 } // Not Implemented
    );

    // Phase 2 implementation:
    /*
    const supplier = await prisma.supplier.findUnique({
      where: { id: parseInt(supplierId) },
    });

    if (!supplier) {
      return NextResponse.json<OrderResponse>(
        {
          success: false,
          error: 'Fournisseur non trouvé',
        },
        { status: 404 }
      );
    }

    const orderDateObj = new Date(orderDate);
    const dueDate = new Date(orderDateObj);
    dueDate.setDate(dueDate.getDate() + supplier.paymentTermsDays);

    const order = await prisma.supplierOrder.create({
      data: {
        supplierId: parseInt(supplierId),
        orderDate: orderDateObj,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        totalAmount: parseInt(totalAmount),
        amountPaid: 0,
        dueDate,
        status: 'ORDERED',
        notes: notes?.trim() || null,
      },
    });

    return NextResponse.json<OrderResponse>({
      success: true,
      data: order,
    }, { status: 201 });
    */
  } catch (error) {
    console.error('[API] Create supplier order error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json<OrderResponse>(
        {
          success: false,
          error: 'Non autorisé',
        },
        { status: 401 }
      );
    }

    return NextResponse.json<OrderResponse>(
      {
        success: false,
        error: 'Erreur serveur',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/supplier-orders
 * Update a supplier order (status, payment, delivery, etc.)
 */
export async function PUT(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(request);

    // Parse request body
    const body = await request.json();
    const { id, amountPaid, status, deliveryDate, notes } = body;

    // Validate input
    if (!id) {
      return NextResponse.json<OrderResponse>(
        {
          success: false,
          error: 'ID de commande requis',
        },
        { status: 400 }
      );
    }

    console.log('[API] Update supplier order request from:', user.userId);

    // TODO: Phase 2 - Update order in PostgreSQL
    // const updateData: any = {
    //   updatedAt: new Date(),
    // };
    //
    // if (amountPaid !== undefined) {
    //   updateData.amountPaid = parseInt(amountPaid);
    // }
    //
    // if (status) {
    //   updateData.status = status as SupplierOrderStatus;
    // }
    //
    // if (deliveryDate) {
    //   updateData.deliveryDate = new Date(deliveryDate);
    // }
    //
    // if (notes !== undefined) {
    //   updateData.notes = notes?.trim() || null;
    // }
    //
    // const order = await prisma.supplierOrder.update({
    //   where: { id: parseInt(id) },
    //   data: updateData,
    // });

    return NextResponse.json<OrderResponse>(
      {
        success: true,
        error: 'MVP: Data handled client-side via IndexedDB. Server sync coming in Phase 2.',
      },
      { status: 501 } // Not Implemented
    );

    // Phase 2 implementation:
    /*
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (amountPaid !== undefined) {
      updateData.amountPaid = parseInt(amountPaid);
    }

    if (status) {
      updateData.status = status as SupplierOrderStatus;
    }

    if (deliveryDate) {
      updateData.deliveryDate = new Date(deliveryDate);
    }

    if (notes !== undefined) {
      updateData.notes = notes?.trim() || null;
    }

    const order = await prisma.supplierOrder.update({
      where: { id: parseInt(id) },
      data: updateData,
    });

    return NextResponse.json<OrderResponse>({
      success: true,
      data: order,
    });
    */
  } catch (error) {
    console.error('[API] Update supplier order error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json<OrderResponse>(
        {
          success: false,
          error: 'Non autorisé',
        },
        { status: 401 }
      );
    }

    return NextResponse.json<OrderResponse>(
      {
        success: false,
        error: 'Erreur serveur',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/supplier-orders
 * Delete a supplier order
 */
export async function DELETE(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(request);

    // Get order ID from query params
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json<OrderResponse>(
        {
          success: false,
          error: 'ID de commande requis',
        },
        { status: 400 }
      );
    }

    console.log('[API] Delete supplier order request from:', user.userId);

    // TODO: Phase 2 - Delete order from PostgreSQL
    // Check if order has payments first
    // const order = await prisma.supplierOrder.findUnique({
    //   where: { id: parseInt(id) },
    // });
    //
    // if (!order) {
    //   return NextResponse.json<OrderResponse>(
    //     {
    //       success: false,
    //       error: 'Commande non trouvée',
    //     },
    //     { status: 404 }
    //   );
    // }
    //
    // if (order.amountPaid > 0) {
    //   return NextResponse.json<OrderResponse>(
    //     {
    //       success: false,
    //       error: 'Impossible de supprimer: cette commande a des paiements',
    //     },
    //     { status: 400 }
    //   );
    // }
    //
    // await prisma.supplierOrder.delete({
    //   where: { id: parseInt(id) },
    // });

    return NextResponse.json<OrderResponse>(
      {
        success: true,
        error: 'MVP: Data handled client-side via IndexedDB. Server sync coming in Phase 2.',
      },
      { status: 501 } // Not Implemented
    );

    // Phase 2 implementation:
    /*
    const order = await prisma.supplierOrder.findUnique({
      where: { id: parseInt(id) },
    });

    if (!order) {
      return NextResponse.json<OrderResponse>(
        {
          success: false,
          error: 'Commande non trouvée',
        },
        { status: 404 }
      );
    }

    if (order.amountPaid > 0) {
      return NextResponse.json<OrderResponse>(
        {
          success: false,
          error: 'Impossible de supprimer: cette commande a des paiements',
        },
        { status: 400 }
      );
    }

    await prisma.supplierOrder.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json<OrderResponse>({
      success: true,
    });
    */
  } catch (error) {
    console.error('[API] Delete supplier order error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json<OrderResponse>(
        {
          success: false,
          error: 'Non autorisé',
        },
        { status: 401 }
      );
    }

    return NextResponse.json<OrderResponse>(
      {
        success: false,
        error: 'Erreur serveur',
      },
      { status: 500 }
    );
  }
}

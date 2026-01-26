/**
 * Debug endpoint to list products on server
 * GET /api/debug/products
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';

export async function GET(request: NextRequest) {
  try {
    const products = await prisma.product.findMany({
      select: { id: true, name: true },
      take: 20,
    });

    return NextResponse.json({
      count: products.length,
      products: products.map(p => ({ id: p.id, name: p.name })),
    });
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

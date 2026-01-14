/**
 * Check PIN status API endpoint
 * 
 * GET /api/auth/check-pin-status
 * Returns the actual mustChangePin status from the database
 * Used to verify if JWT token is stale
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/server/prisma';

export async function GET() {
  try {
    // Verify user is authenticated
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Non authentifie' },
        { status: 401 }
      );
    }

    // Fetch user from database to get actual mustChangePin status
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { pinHash: true, mustChangePin: true },
    });

    return NextResponse.json({
      hasPin: !!dbUser?.pinHash,
      mustChangePin: dbUser?.mustChangePin ?? false,
    });
  } catch (error) {
    console.error('[Check PIN Status] Error:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}


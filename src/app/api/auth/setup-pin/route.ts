/**
 * PIN Setup API endpoint
 *
 * POST /api/auth/setup-pin
 * Allows authenticated users to set or update their PIN
 */

import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { auth } from '@/auth';
import { prisma } from '@/lib/server/prisma';
import { isValidPin } from '@/lib/shared/utils';

const BCRYPT_ROUNDS = 10;

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated via OAuth
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Non authentifie' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { pin, confirmPin } = body;

    // Validate PIN format
    if (!pin || !isValidPin(pin)) {
      return NextResponse.json(
        { success: false, error: 'Le PIN doit contenir exactement 4 chiffres' },
        { status: 400 }
      );
    }

    // Validate PIN confirmation
    if (pin !== confirmPin) {
      return NextResponse.json(
        { success: false, error: 'Les PINs ne correspondent pas' },
        { status: 400 }
      );
    }

    // Hash PIN
    const pinHash = await hash(pin, BCRYPT_ROUNDS);

    // Update user with PIN
    await prisma.user.update({
      where: { id: session.user.id },
      data: { pinHash },
    });

    return NextResponse.json({
      success: true,
      message: 'PIN configure avec succes',
    });
  } catch (error) {
    console.error('[Setup PIN] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

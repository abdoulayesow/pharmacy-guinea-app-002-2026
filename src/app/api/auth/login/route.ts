/**
 * POST /api/auth/login
 *
 * Authenticate user with PIN and return JWT token
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyPin, generateToken } from '@/lib/server/auth';
import { isValidPin } from '@/lib/shared/utils';
import type { LoginRequest, LoginResponse } from '@/lib/shared/types';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: LoginRequest = await request.json();
    const { userId, pin } = body;

    // Validate input
    if (!userId || !pin) {
      return NextResponse.json<LoginResponse>(
        {
          success: false,
          error: 'userId et PIN sont requis',
        },
        { status: 400 }
      );
    }

    if (!isValidPin(pin)) {
      return NextResponse.json<LoginResponse>(
        {
          success: false,
          error: 'PIN invalide (doit être 4 chiffres)',
        },
        { status: 400 }
      );
    }

    // In MVP, we use IndexedDB on the client side
    // For now, this endpoint returns a stub response
    // In Phase 2, this will verify against Neon PostgreSQL

    // TODO: Phase 2 - Query user from Prisma/Neon
    // const user = await prisma.user.findUnique({ where: { id: userId } });

    // For MVP, simulate successful login (client handles PIN verification)
    // This is because we're offline-first and user data is in IndexedDB
    return NextResponse.json<LoginResponse>(
      {
        success: true,
        error: 'MVP: Authentication handled client-side via IndexedDB',
      },
      { status: 501 } // Not Implemented (will be implemented in Phase 2)
    );

    // Phase 2 implementation (commented out for now):
    /*
    if (!user) {
      return NextResponse.json<LoginResponse>(
        {
          success: false,
          error: 'Utilisateur non trouvé',
        },
        { status: 404 }
      );
    }

    // Verify PIN
    const isPinValid = await verifyPin(pin, user.pinHash);
    if (!isPinValid) {
      return NextResponse.json<LoginResponse>(
        {
          success: false,
          error: 'PIN incorrect',
        },
        { status: 401 }
      );
    }

    // Generate JWT token
    const token = await generateToken({
      id: user.id,
      name: user.name,
      role: user.role,
      avatar: user.avatar,
      createdAt: user.createdAt,
    });

    return NextResponse.json<LoginResponse>({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        createdAt: user.createdAt,
      },
    });
    */
  } catch (error) {
    console.error('[API] Login error:', error);
    return NextResponse.json<LoginResponse>(
      {
        success: false,
        error: 'Erreur serveur',
      },
      { status: 500 }
    );
  }
}

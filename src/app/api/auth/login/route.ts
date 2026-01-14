/**
 * POST /api/auth/login
 *
 * Authenticate user with PIN and return JWT token
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyPin, generateToken } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import { verifyCsrf } from '@/lib/server/middleware';
import { isValidPin } from '@/lib/shared/utils';
import type { LoginRequest, LoginResponse, UserRole } from '@/lib/shared/types';

export async function POST(request: NextRequest) {
  try {
    // CSRF protection - verify origin matches host
    if (!verifyCsrf(request)) {
      return NextResponse.json<LoginResponse>(
        {
          success: false,
          error: 'Requête non autorisée',
        },
        { status: 403 }
      );
    }

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

    // Query user from Prisma/Neon database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        avatar: true,
        pinHash: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json<LoginResponse>(
        {
          success: false,
          error: 'Utilisateur non trouvé',
        },
        { status: 404 }
      );
    }

    // Check if user has PIN configured
    if (!user.pinHash) {
      return NextResponse.json<LoginResponse>(
        {
          success: false,
          error: 'PIN non configuré. Connectez-vous avec Google.',
        },
        { status: 400 }
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
      email: user.email,
      phone: user.phone,
      role: user.role as UserRole,
      avatar: user.avatar,
      createdAt: user.createdAt,
    });

    // Create response with user data
    const response = NextResponse.json<LoginResponse>({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role as UserRole,
        avatar: user.avatar,
        createdAt: user.createdAt,
      },
    });

    // Set JWT as httpOnly cookie (secure against XSS)
    response.cookies.set('seri-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    return response;
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

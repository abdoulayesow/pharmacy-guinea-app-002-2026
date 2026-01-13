/**
 * Server-side authentication utilities
 *
 * IMPORTANT: This file should ONLY be imported in:
 * - API Route Handlers (src/app/api/*)
 * - Server Components
 * - Server Actions
 */

import { SignJWT, jwtVerify } from 'jose';
import { compare } from 'bcryptjs';
import type { User } from '@/lib/shared/types';

// JWT configuration
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'seri-secret-key-change-in-production'
);
const JWT_ALGORITHM = 'HS256';
const JWT_EXPIRATION = '7d'; // 7 days

/**
 * Verify PIN against hash using bcrypt
 */
export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  try {
    return await compare(pin, hash);
  } catch (error) {
    console.error('[Auth] PIN verification error:', error);
    return false;
  }
}

/**
 * Generate JWT token for authenticated user
 */
export async function generateToken(user: Omit<User, 'pinHash'>): Promise<string> {
  try {
    const payload: Record<string, string> = {
      userId: user.id,
      name: user.name,
      role: user.role,
    };

    // Optionally include email and phone if present
    if (user.email) {
      payload.email = user.email;
    }
    if (user.phone) {
      payload.phone = user.phone;
    }

    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: JWT_ALGORITHM })
      .setIssuedAt()
      .setExpirationTime(JWT_EXPIRATION)
      .sign(JWT_SECRET);

    return token;
  } catch (error) {
    console.error('[Auth] Token generation error:', error);
    throw new Error('Failed to generate token');
  }
}

/**
 * Verify JWT token and extract user data
 */
export async function verifyToken(token: string): Promise<{
  userId: string;
  name: string;
  role: string;
  email?: string;
  phone?: string;
} | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      userId: payload.userId as string,
      name: payload.name as string,
      role: payload.role as string,
      email: payload.email as string | undefined,
      phone: payload.phone as string | undefined,
    };
  } catch (error) {
    console.error('[Auth] Token verification error:', error);
    return null;
  }
}

/**
 * Extract token from Authorization header
 */
export function extractToken(authHeader: string | null): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Get user from request headers
 */
export async function getUserFromRequest(request: Request): Promise<{
  userId: string;
  name: string;
  role: string;
} | null> {
  const authHeader = request.headers.get('Authorization');
  const token = extractToken(authHeader);

  if (!token) return null;

  return await verifyToken(token);
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth(request: Request) {
  const user = await getUserFromRequest(request);

  if (!user) {
    throw new Error('Unauthorized');
  }

  return user;
}

/**
 * Require OWNER role - throws if not owner
 */
export async function requireOwner(request: Request) {
  const user = await requireAuth(request);

  if (user.role !== 'OWNER') {
    throw new Error('Forbidden: OWNER role required');
  }

  return user;
}

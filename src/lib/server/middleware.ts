/**
 * API Route Protection Middleware
 *
 * Provides helper functions to protect API routes with authentication.
 * IMPORTANT: This file should ONLY be imported in API Route Handlers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOwner } from './auth';

/**
 * Generic error response type for API routes
 */
export type ApiErrorResponse = {
  error: string;
  details?: string;
};

/**
 * Wrapper for protected API routes
 *
 * Usage:
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   return withAuth(request, async (user) => {
 *     // Your route logic here with authenticated user
 *     return NextResponse.json({ data: 'success', user });
 *   });
 * }
 * ```
 */
export async function withAuth<T>(
  request: NextRequest,
  handler: (user: { userId: string; name: string; role: string }) => Promise<NextResponse<T>>
): Promise<NextResponse<T | ApiErrorResponse>> {
  try {
    const user = await requireAuth(request);
    return await handler(user);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication failed';

    if (message === 'Unauthorized') {
      return NextResponse.json<ApiErrorResponse>(
        { error: 'Non authentifié', details: 'Token manquant ou invalide' },
        { status: 401 }
      );
    }

    return NextResponse.json<ApiErrorResponse>(
      { error: 'Erreur d\'authentification', details: message },
      { status: 500 }
    );
  }
}

/**
 * Wrapper for owner-only API routes
 *
 * Usage:
 * ```typescript
 * export async function DELETE(request: NextRequest) {
 *   return withOwner(request, async (user) => {
 *     // Your owner-only route logic here
 *     return NextResponse.json({ success: true });
 *   });
 * }
 * ```
 */
export async function withOwner<T>(
  request: NextRequest,
  handler: (user: { userId: string; name: string; role: string }) => Promise<NextResponse<T>>
): Promise<NextResponse<T | ApiErrorResponse>> {
  try {
    const user = await requireOwner(request);
    return await handler(user);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authorization failed';

    if (message === 'Unauthorized') {
      return NextResponse.json<ApiErrorResponse>(
        { error: 'Non authentifié', details: 'Token manquant ou invalide' },
        { status: 401 }
      );
    }

    if (message.includes('Forbidden') || message.includes('OWNER')) {
      return NextResponse.json<ApiErrorResponse>(
        { error: 'Accès refusé', details: 'Réservé au propriétaire' },
        { status: 403 }
      );
    }

    return NextResponse.json<ApiErrorResponse>(
      { error: 'Erreur d\'autorisation', details: message },
      { status: 500 }
    );
  }
}

/**
 * Rate limiting helper (optional - requires Upstash Redis)
 *
 * Usage:
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const rateLimitResult = await rateLimit(request);
 *   if (!rateLimitResult.success) {
 *     return NextResponse.json(
 *       { error: 'Trop de requêtes' },
 *       { status: 429 }
 *     );
 *   }
 *
 *   // Continue with route logic
 * }
 * ```
 */
export async function rateLimit(
  request: NextRequest,
  options: { limit?: number; window?: string } = {}
): Promise<{ success: boolean; remaining?: number }> {
  // If Upstash is not configured, skip rate limiting
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return { success: true };
  }

  try {
    // Dynamic import to avoid bundling if not needed
    const { Ratelimit } = await import('@upstash/ratelimit');
    const { Redis } = await import('@upstash/redis');

    const redis = Redis.fromEnv();
    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(options.limit || 100, options.window || '15 m'),
      analytics: true,
    });

    // Use IP address for rate limiting
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const { success, remaining } = await ratelimit.limit(ip);

    return { success, remaining };
  } catch (error) {
    console.error('[Middleware] Rate limit error:', error);
    // On error, allow the request (fail open)
    return { success: true };
  }
}

/**
 * Request validation helper
 *
 * Usage:
 * ```typescript
 * const body = await validateRequest(request, {
 *   name: 'string',
 *   price: 'number',
 *   stock: 'number'
 * });
 * ```
 */
export async function validateRequest<T extends Record<string, unknown>>(
  request: NextRequest,
  schema: Record<keyof T, 'string' | 'number' | 'boolean' | 'object'>
): Promise<T> {
  try {
    const body = await request.json();

    for (const [key, expectedType] of Object.entries(schema)) {
      const value = body[key];

      if (value === undefined || value === null) {
        throw new Error(`Champ requis manquant: ${key}`);
      }

      const actualType = Array.isArray(value) ? 'object' : typeof value;
      if (actualType !== expectedType) {
        throw new Error(
          `Type invalide pour ${key}: attendu ${expectedType}, reçu ${actualType}`
        );
      }
    }

    return body as T;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('JSON invalide dans la requête');
    }
    throw error;
  }
}

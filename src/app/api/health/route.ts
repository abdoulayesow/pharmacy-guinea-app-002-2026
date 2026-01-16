/**
 * Health Check Endpoint
 *
 * Lightweight endpoint for connectivity verification.
 * Used by the client to check actual internet connectivity (not just network interface).
 *
 * Returns:
 * - 200 OK if server is reachable
 * - No database queries (fast response)
 * - No authentication required (public endpoint)
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge'; // Use edge runtime for faster cold starts

/**
 * HEAD /api/health
 * Lightweight connectivity check
 */
export async function HEAD(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

/**
 * GET /api/health
 * Optional GET handler for browser testing
 */
export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}

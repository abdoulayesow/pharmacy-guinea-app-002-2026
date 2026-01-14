/**
 * Prisma Client for Neon Serverless PostgreSQL
 *
 * IMPORTANT: This file should ONLY be imported in:
 * - API Route Handlers (src/app/api/*)
 * - Server Components
 * - Server Actions
 */

import { PrismaClient } from '@prisma/client';
import { neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import ws from 'ws';

// Configure Neon to use WebSocket in development (Node.js environment)
if (process.env.NODE_ENV !== 'production') {
  neonConfig.webSocketConstructor = ws;
}

// Prevent multiple instances of Prisma Client in development
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Create Prisma Client with Neon adapter (Prisma 7)
 */
function createPrismaClient() {
  // Use unpooled connection for more reliable connections in serverless
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // Create adapter with connection string (Prisma 7 / adapter-neon 7.x format)
  const adapter = new PrismaNeon({ connectionString });

  // Create Prisma Client with adapter (Prisma 7 format)
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

/**
 * Singleton Prisma Client instance
 */
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Save to global in development to prevent hot-reload issues
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Gracefully disconnect on process termination
 */
if (typeof window === 'undefined') {
  // Only run in Node.js environment
  process.on('beforeExit', async () => {
    await prisma.$disconnect();
  });
}

/**
 * Auth.js (NextAuth v5) main configuration
 *
 * Uses Prisma adapter for database persistence
 * Google OAuth as primary provider
 */

import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/server/prisma';
import { authConfig } from './auth.config';

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  callbacks: {
    ...authConfig.callbacks,
    // Check if user needs PIN setup after Google sign-in
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        // Check if user exists and has PIN set
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { pinHash: true },
        });

        // User will be redirected to PIN setup if no PIN (handled in middleware)
        return true;
      }
      return true;
    },
    async jwt({ token, user, account, trigger }) {
      // On sign in, fetch user role from database
      if (user) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true, pinHash: true },
        });
        token.id = user.id;
        token.role = dbUser?.role || 'EMPLOYEE';
        token.hasPin = !!dbUser?.pinHash;
      }
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        (session.user as { hasPin?: boolean }).hasPin = token.hasPin as boolean;
      }
      return session;
    },
  },
  events: {
    // When a new user is created via OAuth, set default role
    async createUser({ user }) {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: 'EMPLOYEE' },
      });
    },
  },
});

// Re-export types for convenience
export type { Session } from 'next-auth';

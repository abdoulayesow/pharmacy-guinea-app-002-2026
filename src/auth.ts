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
    // Sync Google profile data on every sign-in
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google' && user.id && profile) {
        try {
          // Build update data with only defined values
          const updateData: { name?: string; image?: string; email?: string } = {};

          const newName = profile.name || user.name;
          if (newName) updateData.name = newName;

          const newImage = (profile as { picture?: string }).picture || user.image;
          if (newImage) updateData.image = newImage;

          const newEmail = profile.email || user.email;
          if (newEmail) updateData.email = newEmail;

          // Only update if we have data
          if (Object.keys(updateData).length > 0) {
            await prisma.user.update({
              where: { id: user.id },
              data: updateData,
            });
            console.log('[Auth] Synced Google profile for user:', user.id);
          }
        } catch (error) {
          // User might not exist yet (first sign-in) - adapter will create them
          console.log('[Auth] Profile sync skipped (new user):', error);
        }
      }
      return true;
    },
    async jwt({ token, user, account, trigger }) {
      // On sign in, fetch user role from database
      if (user && user.id) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { role: true, pinHash: true },
          });
          token.id = user.id;
          token.role = dbUser?.role || 'EMPLOYEE';
          token.hasPin = !!dbUser?.pinHash;
        } catch (error) {
          console.error('[Auth] JWT callback error:', error);
          // Set defaults if DB query fails
          token.id = user.id;
          token.role = 'EMPLOYEE';
          token.hasPin = false;
        }
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
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { role: 'EMPLOYEE' },
        });
      } catch (error) {
        console.error('[Auth] createUser event error:', error);
        // Non-fatal - role defaults to EMPLOYEE in schema
      }
    },
  },
});

// Re-export types for convenience
export type { Session } from 'next-auth';

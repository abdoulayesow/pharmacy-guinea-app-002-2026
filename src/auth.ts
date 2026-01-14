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
  // AUTH_SECRET is automatically read from process.env.AUTH_SECRET
  // If you see "no matching decryption secret" errors, it means there are old
  // session cookies encrypted with a different secret. This is harmless - 
  // NextAuth will treat them as invalid and create new sessions.
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
      // On sign in or update, fetch user data from database
      const userId = user?.id || token.id;
      
      if (userId && (user || trigger === 'update')) {
        try {
          // Fetch user data with all needed fields
          const dbUser = await prisma.user.findUnique({
            where: { id: userId as string },
            select: { 
              role: true, 
              pinHash: true, 
              // @ts-expect-error - mustChangePin exists in schema but TypeScript types may be stale
              mustChangePin: true,
            },
          }) as { role: string; pinHash: string | null; mustChangePin: boolean | null } | null;
          
          if (dbUser) {
            // Update token with fresh data from database
            token.id = userId as string;
            token.role = dbUser.role || 'EMPLOYEE';
            token.hasPin = !!dbUser.pinHash;
            token.mustChangePin = dbUser.mustChangePin ?? false;
          } else {
            // User not found in database - keep existing token values
            console.warn('[Auth] User not found in database:', userId);
            // Don't overwrite existing token values
          }
        } catch (error) {
          console.error('[Auth] JWT callback error:', error);
          // On error, preserve existing token values (don't overwrite)
          // Only set defaults on initial sign-in (when user exists)
          if (user) {
            token.id = user.id;
            token.role = 'EMPLOYEE';
            token.hasPin = false;
            token.mustChangePin = true;
          }
          // If trigger === 'update' and error, keep existing token values
        }
      }
      
      // Preserve access token if account exists
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
        (session.user as { mustChangePin?: boolean }).mustChangePin = token.mustChangePin as boolean;
      }
      return session;
    },
  },
  events: {
    // When a new user is created via OAuth, set default role and default PIN
    async createUser({ user }) {
      try {
        // Import config and bcrypt dynamically
        const { AUTH_CONFIG } = await import('@/lib/shared/config');
        const bcrypt = await import('bcryptjs');
        
        // Hash the default PIN
        const defaultPinHash = await bcrypt.hash(AUTH_CONFIG.DEFAULT_PIN, 10);
        
        await prisma.user.update({
          where: { id: user.id },
          data: { 
            role: 'EMPLOYEE',
            pinHash: defaultPinHash,
            mustChangePin: true, // Force user to change default PIN
          } as { role: string; pinHash: string; mustChangePin: boolean },
        });
        console.log('[Auth] Created user with default PIN:', user.id);
      } catch (error) {
        console.error('[Auth] createUser event error:', error);
        // Non-fatal - role defaults to EMPLOYEE in schema
      }
    },
  },
});

// Re-export types for convenience
export type { Session } from 'next-auth';

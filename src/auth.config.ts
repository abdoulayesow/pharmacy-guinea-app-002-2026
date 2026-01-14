/**
 * Auth.js Edge-compatible configuration
 * This file can be imported in middleware (Edge runtime)
 */

import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';

export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Allow linking Google account to existing users with same email
      // Safe for this app since email is verified by Google
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    // Include user role in JWT
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role || 'EMPLOYEE';
      }
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    // Include user data in session
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
    // Redirect to PIN setup if user has no PIN
    async redirect({ url, baseUrl }) {
      // If signing in, check if PIN setup is needed (handled in signIn callback)
      if (url.startsWith(baseUrl)) return url;
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      return baseUrl;
    },
  },
  session: {
    strategy: 'jwt',
    // Configurable via SESSION_MAX_AGE_DAYS env var (default: 7 days)
    maxAge: parseInt(process.env.SESSION_MAX_AGE_DAYS || '7', 10) * 24 * 60 * 60,
  },
};

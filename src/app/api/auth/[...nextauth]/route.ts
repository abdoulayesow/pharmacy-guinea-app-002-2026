/**
 * Auth.js (NextAuth v5) route handler
 *
 * Handles all OAuth callbacks:
 * - GET /api/auth/signin
 * - GET /api/auth/signout
 * - GET /api/auth/callback/google
 * - GET /api/auth/session
 * - POST /api/auth/signin/*
 * - POST /api/auth/signout
 */

import { handlers } from '@/auth';

export const { GET, POST } = handlers;

/**
 * Utility functions for Seri
 *
 * This file re-exports utilities from the shared and client libraries
 * for backwards compatibility.
 *
 * New code should import directly from:
 * - @/lib/shared/utils (for shared utilities)
 * - @/lib/client/utils (for UI utilities)
 */

// Re-export all shared utilities
export * from '@/lib/shared/utils';

// Re-export all client utilities
export * from '@/lib/client/utils';

/**
 * Expiration Date Utilities
 *
 * Based on user research: Expiration tracking is the TOP pain point
 * and must be moved from V2 to MVP.
 *
 * Color coding:
 * - 🟢 Green: > 60 days until expiration
 * - 🟡 Yellow: 30-60 days until expiration
 * - 🔴 Red: < 30 days until expiration
 * - ⚫ Black: Expired
 */

import type { Product } from '@/lib/shared/types';

export type ExpirationStatus = 'ok' | 'warning' | 'critical' | 'expired';

export interface ExpirationInfo {
  status: ExpirationStatus;
  daysUntilExpiration: number;
  color: string;
  bgColor: string;
  label: string;
}

/**
 * Calculate days until expiration from now
 */
export function getDaysUntilExpiration(expirationDate: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const expDate = new Date(expirationDate);
  expDate.setHours(0, 0, 0, 0);

  const diffTime = expDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Get expiration status for a product
 */
export function getExpirationStatus(expirationDate: Date | undefined): ExpirationInfo {
  if (!expirationDate) {
    return {
      status: 'ok',
      daysUntilExpiration: Infinity,
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
      label: 'Non définie',
    };
  }

  const days = getDaysUntilExpiration(expirationDate);

  if (days < 0) {
    return {
      status: 'expired',
      daysUntilExpiration: days,
      color: 'text-red-900 dark:text-red-300',
      bgColor: 'bg-red-100 dark:bg-red-900/30',
      label: 'Périmé',
    };
  } else if (days < 30) {
    return {
      status: 'critical',
      daysUntilExpiration: days,
      color: 'text-red-700 dark:text-red-400',
      bgColor: 'bg-red-100 dark:bg-red-900/30',
      label: `${days}j restant${days > 1 ? 's' : ''}`,
    };
  } else if (days < 60) {
    return {
      status: 'warning',
      daysUntilExpiration: days,
      color: 'text-amber-700 dark:text-amber-400',
      bgColor: 'bg-amber-100 dark:bg-amber-900/30',
      label: `${days}j restant${days > 1 ? 's' : ''}`,
    };
  } else {
    return {
      status: 'ok',
      daysUntilExpiration: days,
      color: 'text-emerald-700 dark:text-emerald-400',
      bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
      label: `${days}j restant${days > 1 ? 's' : ''}`,
    };
  }
}

/**
 * Get products expiring within a certain number of days
 */
export function getExpiringProducts(
  products: Product[],
  daysThreshold: number
): Product[] {
  return products.filter((product) => {
    if (!product.expirationDate) return false;
    const days = getDaysUntilExpiration(product.expirationDate);
    return days >= 0 && days <= daysThreshold;
  });
}

/**
 * Get expired products
 */
export function getExpiredProducts(products: Product[]): Product[] {
  return products.filter((product) => {
    if (!product.expirationDate) return false;
    return getDaysUntilExpiration(product.expirationDate) < 0;
  });
}

/**
 * Get products by expiration status
 */
export function getProductsByExpirationStatus(
  products: Product[],
  status: ExpirationStatus
): Product[] {
  return products.filter((product) => {
    const info = getExpirationStatus(product.expirationDate);
    return info.status === status;
  });
}

/**
 * Sort products by expiration date (soonest first)
 */
export function sortByExpirationDate(products: Product[]): Product[] {
  return [...products].sort((a, b) => {
    // Products without expiration date go to the end
    if (!a.expirationDate && !b.expirationDate) return 0;
    if (!a.expirationDate) return 1;
    if (!b.expirationDate) return -1;

    const daysA = getDaysUntilExpiration(a.expirationDate);
    const daysB = getDaysUntilExpiration(b.expirationDate);

    return daysA - daysB;
  });
}

/**
 * Get expiration summary statistics
 */
export function getExpirationSummary(products: Product[]) {
  const expired = getExpiredProducts(products);
  const critical = getProductsByExpirationStatus(products, 'critical');
  const warning = getProductsByExpirationStatus(products, 'warning');
  const total = expired.length + critical.length + warning.length;

  return {
    expired: expired.length,
    critical: critical.length,
    warning: warning.length,
    total,
    hasAlerts: total > 0,
  };
}

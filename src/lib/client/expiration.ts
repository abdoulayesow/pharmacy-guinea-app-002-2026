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

import type { Product, ProductBatch } from '@/lib/shared/types';

export type ExpirationStatus = 'ok' | 'warning' | 'critical' | 'expired';

// Batch with product info for display
export interface BatchWithProduct extends ProductBatch {
  productName: string;
  productCategory?: string;
}

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

// ============================================================================
// Batch-Level Expiration Functions (FEFO Phase 3)
// ============================================================================

/**
 * Get batch expiration status
 */
export function getBatchExpirationStatus(expirationDate: Date): ExpirationInfo {
  return getExpirationStatus(expirationDate);
}

/**
 * Get batches expiring within a certain number of days
 */
export function getExpiringBatches(
  batches: ProductBatch[],
  daysThreshold: number
): ProductBatch[] {
  return batches.filter((batch) => {
    if (!batch.expiration_date || batch.quantity <= 0) return false;
    const days = getDaysUntilExpiration(batch.expiration_date);
    return days >= 0 && days <= daysThreshold;
  });
}

/**
 * Get expired batches (with remaining quantity)
 */
export function getExpiredBatches(batches: ProductBatch[]): ProductBatch[] {
  return batches.filter((batch) => {
    if (!batch.expiration_date || batch.quantity <= 0) return false;
    return getDaysUntilExpiration(batch.expiration_date) < 0;
  });
}

/**
 * Get batches by expiration status
 */
export function getBatchesByExpirationStatus(
  batches: ProductBatch[],
  status: ExpirationStatus
): ProductBatch[] {
  return batches.filter((batch) => {
    if (batch.quantity <= 0) return false;
    const info = getExpirationStatus(batch.expiration_date);
    return info.status === status;
  });
}

/**
 * Sort batches by expiration date (soonest first) - FEFO order
 */
export function sortBatchesByExpiration(batches: ProductBatch[]): ProductBatch[] {
  return [...batches].sort((a, b) => {
    const daysA = getDaysUntilExpiration(a.expiration_date);
    const daysB = getDaysUntilExpiration(b.expiration_date);
    return daysA - daysB;
  });
}

/**
 * Get batch expiration summary statistics
 */
export function getBatchExpirationSummary(batches: ProductBatch[]) {
  // Only count batches with remaining quantity
  const activeBatches = batches.filter(b => b.quantity > 0);

  const expired = getExpiredBatches(activeBatches);
  const critical = getBatchesByExpirationStatus(activeBatches, 'critical');
  const warning = getBatchesByExpirationStatus(activeBatches, 'warning');

  // Calculate total value at risk (quantity * unit_cost)
  const expiredValue = expired.reduce((sum, b) => sum + (b.quantity * (b.unit_cost || 0)), 0);
  const criticalValue = critical.reduce((sum, b) => sum + (b.quantity * (b.unit_cost || 0)), 0);
  const warningValue = warning.reduce((sum, b) => sum + (b.quantity * (b.unit_cost || 0)), 0);

  const total = expired.length + critical.length + warning.length;
  const totalUnits = expired.reduce((s, b) => s + b.quantity, 0)
    + critical.reduce((s, b) => s + b.quantity, 0)
    + warning.reduce((s, b) => s + b.quantity, 0);

  return {
    expired: expired.length,
    critical: critical.length,
    warning: warning.length,
    total,
    totalUnits,
    expiredValue,
    criticalValue,
    warningValue,
    totalValueAtRisk: expiredValue + criticalValue + warningValue,
    hasAlerts: total > 0,
  };
}

/**
 * Get alert batches with product info for display
 */
export function getAlertBatchesWithProducts(
  batches: ProductBatch[],
  products: Product[]
): BatchWithProduct[] {
  const productMap = new Map(products.map(p => [p.id, p]));

  return batches
    .filter(batch => {
      if (batch.quantity <= 0) return false;
      const info = getExpirationStatus(batch.expiration_date);
      return info.status === 'expired' || info.status === 'critical' || info.status === 'warning';
    })
    .map(batch => {
      const product = productMap.get(batch.product_id);
      return {
        ...batch,
        productName: product?.name || 'Produit inconnu',
        productCategory: product?.category,
      };
    })
    .sort((a, b) => {
      // Sort by expiration date (soonest first)
      const daysA = getDaysUntilExpiration(a.expiration_date);
      const daysB = getDaysUntilExpiration(b.expiration_date);
      return daysA - daysB;
    });
}

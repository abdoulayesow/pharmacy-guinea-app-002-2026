'use client';

import { cn } from '@/lib/client/utils';

interface SkeletonProps {
  className?: string;
}

/**
 * Basic skeleton loader with shimmer animation
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-gray-200 dark:bg-slate-700',
        className
      )}
    />
  );
}

/**
 * Skeleton for a supplier card in the list (dark mode optimized)
 */
export function SupplierCardSkeleton() {
  return (
    <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
      <div className="flex items-start gap-3 mb-3">
        {/* Icon placeholder */}
        <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
        <div className="flex-1 min-w-0">
          <Skeleton className="h-5 w-36 mb-2" />
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-3 w-20" />
        </div>
        {/* Balance badge */}
        <Skeleton className="h-8 w-24 rounded-lg shrink-0" />
      </div>
      {/* Payment info box */}
      <Skeleton className="h-16 w-full rounded-lg" />
    </div>
  );
}

/**
 * Skeleton for the supplier list page
 */
export function SupplierListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SupplierCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for an order card in the list (dark mode)
 */
export function OrderCardSkeleton() {
  return (
    <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
      <div className="flex items-start justify-between mb-3">
        <div>
          <Skeleton className="h-5 w-36 mb-2" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-7 w-24 rounded-full" />
      </div>
      <div className="flex justify-between items-center pt-3 border-t border-slate-700">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}

/**
 * Skeleton for the order list
 */
export function OrderListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <OrderCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for an order detail page (dark mode)
 */
export function OrderDetailSkeleton() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
        <div className="flex justify-between items-start mb-4">
          <div>
            <Skeleton className="h-6 w-40 mb-2" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-7 w-24 rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Skeleton className="h-3 w-16 mb-1" />
            <Skeleton className="h-5 w-24" />
          </div>
          <div>
            <Skeleton className="h-3 w-16 mb-1" />
            <Skeleton className="h-5 w-28" />
          </div>
        </div>
      </div>

      {/* Products */}
      <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
        <Skeleton className="h-5 w-24 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex justify-between items-center py-2 border-b border-slate-700 last:border-0">
              <div>
                <Skeleton className="h-4 w-32 mb-1" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-5 w-24" />
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
        <div className="space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex justify-between">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="flex justify-between pt-2 border-t border-slate-700">
            <Skeleton className="h-5 w-14" />
            <Skeleton className="h-5 w-28" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for a product row in lists
 */
export function ProductRowSkeleton() {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
      <div className="flex-1">
        <Skeleton className="h-4 w-36 mb-1" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="text-right">
        <Skeleton className="h-4 w-20 mb-1" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

/**
 * Skeleton for product list in forms
 */
export function ProductListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <ProductRowSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for a sale card in the list (dark mode optimized)
 */
export function SaleCardSkeleton() {
  return (
    <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
      <div className="flex items-start gap-3 mb-3">
        {/* Icon placeholder */}
        <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
        <div className="flex-1 min-w-0">
          <Skeleton className="h-5 w-28 mb-2" />
          <Skeleton className="h-4 w-24 mb-1" />
          <Skeleton className="h-3 w-20" />
        </div>
        {/* Status badge */}
        <Skeleton className="h-7 w-20 rounded-lg shrink-0" />
      </div>
    </div>
  );
}

/**
 * Skeleton for the sales list page
 */
export function SalesListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SaleCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for an expense card in the list (dark mode optimized)
 */
export function ExpenseCardSkeleton() {
  return (
    <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
      <div className="flex items-start gap-3">
        {/* Icon placeholder */}
        <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <Skeleton className="h-5 w-36 mb-2" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-6 w-28" />
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-slate-700">
            <Skeleton className="h-4 w-24" />
            <div className="flex gap-1">
              <Skeleton className="w-8 h-8 rounded-lg" />
              <Skeleton className="w-8 h-8 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for the expense list page
 */
export function ExpenseListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <ExpenseCardSkeleton key={i} />
      ))}
    </div>
  );
}

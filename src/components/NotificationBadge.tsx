'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/client/db';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

/**
 * Notification badge component showing urgent payment reminders
 * Displays count of CRITICAL and URGENT reminders
 */
export function NotificationBadge({ className = '' }: { className?: string }) {
  // Fetch credit sales with pending payments
  const creditSales = useLiveQuery(() =>
    db.sales.where('payment_method').equals('CREDIT').and(s => s.payment_status !== 'PAID').toArray()
  ) ?? [];

  // Count urgent reminders (overdue or due within 3 days)
  const urgentCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return creditSales.filter(sale => {
      if (!sale.due_date) return false;

      const dueDate = new Date(sale.due_date);
      dueDate.setHours(0, 0, 0, 0);
      const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // CRITICAL: overdue (daysUntilDue < 0)
      // URGENT: due today or within 3 days (0 <= daysUntilDue <= 3)
      return daysUntilDue <= 3;
    }).length;
  }, [creditSales]);

  if (urgentCount === 0) {
    return null;
  }

  return (
    <Link href="/notifications" className={`relative ${className}`}>
      <Bell className="w-6 h-6 text-gray-700 dark:text-gray-300" />
      <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center shadow-lg
        animate-pulse">
        <span className="text-xs font-bold text-white">{urgentCount > 9 ? '9+' : urgentCount}</span>
      </div>
    </Link>
  );
}

/**
 * Notification banner for dashboard - shows summary of urgent reminders
 */
export function NotificationBanner() {
  // Fetch credit sales with pending payments
  const creditSales = useLiveQuery(() =>
    db.sales.where('payment_method').equals('CREDIT').and(s => s.payment_status !== 'PAID').toArray()
  ) ?? [];

  // Categorize reminders
  const { critical, urgent } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const critical: typeof creditSales = [];
    const urgent: typeof creditSales = [];

    creditSales.forEach(sale => {
      if (!sale.due_date) return;

      const dueDate = new Date(sale.due_date);
      dueDate.setHours(0, 0, 0, 0);
      const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilDue < 0) {
        critical.push(sale);
      } else if (daysUntilDue <= 3) {
        urgent.push(sale);
      }
    });

    return { critical, urgent };
  }, [creditSales]);

  if (critical.length === 0 && urgent.length === 0) {
    return null;
  }

  return (
    <Link href="/notifications">
      <div className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
        critical.length > 0
          ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800 hover:border-red-400'
          : 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-800 hover:border-amber-400'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            critical.length > 0 ? 'bg-red-600' : 'bg-amber-600'
          }`}>
            <Bell className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="font-bold text-gray-900 dark:text-white">
              {critical.length > 0 ? '🚨 Paiements en retard' : '⏰ Paiements urgents'}
            </div>
            <div className="text-sm text-gray-700 dark:text-gray-300">
              {critical.length > 0 && `${critical.length} en retard`}
              {critical.length > 0 && urgent.length > 0 && ' • '}
              {urgent.length > 0 && `${urgent.length} échéance proche`}
            </div>
          </div>
          <div className="text-2xl">→</div>
        </div>
      </div>
    </Link>
  );
}

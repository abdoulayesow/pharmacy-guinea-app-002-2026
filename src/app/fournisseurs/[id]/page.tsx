'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSession } from 'next-auth/react';
import { db } from '@/lib/client/db';
import { useAuthStore } from '@/stores/auth';
import { formatCurrency, formatDate } from '@/lib/shared/utils';
import { cn } from '@/lib/client/utils';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Building2,
  Phone,
  Calendar,
  Package,
  CreditCard,
  RotateCcw,
  Clock,
  AlertCircle,
  CheckCircle2,
  Truck,
  Edit3,
  X,
} from 'lucide-react';
import type { Supplier, SupplierOrder } from '@/lib/shared/types';

export default function SupplierDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { data: session, status } = useSession();
  const { isAuthenticated } = useAuthStore();
  const supplierId = parseInt(params.id as string);

  // Redirect if not authenticated (check both OAuth session and Zustand store)
  useEffect(() => {
    if (status === 'loading') return;
    const hasOAuthSession = status === 'authenticated' && !!session?.user;
    if (!isAuthenticated && !hasOAuthSession) {
      router.push(`/login?callbackUrl=${encodeURIComponent(`/fournisseurs/${supplierId}`)}`);
    }
  }, [isAuthenticated, session, status, router, supplierId]);

  // Get supplier and orders/returns
  const supplier = useLiveQuery(
    () => db.suppliers.get(supplierId),
    [supplierId]
  );
  const allTransactions = useLiveQuery(
    () => db.supplier_orders.where('supplierId').equals(supplierId).reverse().toArray(),
    [supplierId]
  ) ?? [];
  const orders = allTransactions.filter(t => t.type === 'ORDER' || !t.type); // Include legacy orders without type
  const returns = allTransactions.filter(t => t.type === 'RETURN');
  const allOrderItems = useLiveQuery(
    () => db.supplier_order_items.toArray(),
    []
  ) ?? [];

  // Calculate stats (only for orders, not returns)
  const totalOwed = orders.reduce((sum, o) => {
    if (o.status === 'CANCELLED') return sum;
    return sum + ((o.calculatedTotal ?? o.totalAmount) - o.amountPaid);
  }, 0);
  const totalOrdered = orders.reduce((sum, o) => {
    if (o.status === 'CANCELLED') return sum;
    return sum + (o.calculatedTotal ?? o.totalAmount);
  }, 0);
  const totalPaid = orders.reduce((sum, o) => sum + o.amountPaid, 0);

  const getPaymentStatus = (order: SupplierOrder): 'overdue' | 'urgent' | 'upcoming' | 'paid' => {
    // For returns, check paymentStatus instead
    if (order.type === 'RETURN') {
      if (order.paymentStatus === 'PAID') return 'paid';
      return 'upcoming'; // Returns don't have due dates
    }

    // For orders, check payment status
    if (order.paymentStatus === 'PAID' || (order.status === 'DELIVERED' && order.amountPaid >= (order.calculatedTotal ?? order.totalAmount))) {
      return 'paid';
    }

    if (order.status === 'CANCELLED') return 'upcoming'; // Cancelled orders don't need payment

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(order.dueDate);
    due.setHours(0, 0, 0, 0);
    const daysUntil = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil < 0) return 'overdue';
    if (daysUntil <= 3) return 'urgent';
    return 'upcoming';
  };

  const getStatusConfig = (status: 'overdue' | 'urgent' | 'upcoming' | 'paid') => {
    switch (status) {
      case 'overdue':
        return {
          label: 'En retard',
          color: 'text-red-600 dark:text-red-400',
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/30',
          icon: AlertCircle,
        };
      case 'urgent':
        return {
          label: 'Urgent',
          color: 'text-orange-600 dark:text-orange-400',
          bgColor: 'bg-orange-500/10',
          borderColor: 'border-orange-500/30',
          icon: Clock,
        };
      case 'upcoming':
        return {
          label: 'À venir',
          color: 'text-amber-600 dark:text-amber-400',
          bgColor: 'bg-amber-500/10',
          borderColor: 'border-amber-500/30',
          icon: Clock,
        };
      default:
        return {
          label: 'Payé',
          color: 'text-emerald-600 dark:text-emerald-400',
          bgColor: 'bg-emerald-500/10',
          borderColor: 'border-emerald-500/30',
          icon: CheckCircle2,
        };
    }
  };

  const getOrderStatusConfig = (order: SupplierOrder) => {
    // First check order lifecycle status
    switch (order.status) {
      case 'PENDING':
      case 'ORDERED':
        return {
          label: 'Commandé',
          icon: Package,
          color: 'text-blue-400',
          bgColor: 'bg-blue-500/10',
        };
      case 'CANCELLED':
        return {
          label: 'Annulé',
          icon: Package,
          color: 'text-slate-400',
          bgColor: 'bg-slate-500/10',
        };
      case 'DELIVERED':
        // For delivered orders, show payment status
        switch (order.paymentStatus) {
          case 'PAID':
            return {
              label: 'Payé',
              icon: CheckCircle2,
              color: 'text-emerald-400',
              bgColor: 'bg-emerald-500/10',
            };
          case 'PARTIALLY_PAID':
            return {
              label: 'Partiellement payé',
              icon: CreditCard,
              color: 'text-amber-400',
              bgColor: 'bg-amber-500/10',
            };
          default:
            return {
              label: 'Livré',
              icon: Truck,
              color: 'text-purple-400',
              bgColor: 'bg-purple-500/10',
            };
        }
      default:
        return {
          label: 'En cours',
          icon: Package,
          color: 'text-slate-400',
          bgColor: 'bg-slate-500/10',
        };
    }
  };

  if (!isAuthenticated || !supplier) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-8">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
        <div className="flex items-center gap-3 p-4 max-w-2xl mx-auto">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors active:scale-95"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{supplier.name}</h1>
            <p className="text-sm text-slate-400">Détails du fournisseur</p>
          </div>
          <button
            onClick={() => {/* TODO: Edit supplier */}}
            className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors active:scale-95"
          >
            <Edit3 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <main className="p-4 max-w-2xl mx-auto space-y-4">
        {/* Supplier Info Card */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 border border-slate-700">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-xl bg-emerald-500/10 flex items-center justify-center ring-2 ring-emerald-500/20">
              <Building2 className="w-8 h-8 text-emerald-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white mb-1">{supplier.name}</h2>
              {supplier.phone && (
                <div className="flex items-center gap-2 text-slate-400">
                  <Phone className="w-4 h-4" />
                  <span className="text-sm">{supplier.phone}</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-700/50">
            <div>
              <p className="text-xs text-slate-500 mb-1">Délai de crédit</p>
              <p className="text-lg font-bold text-white">{supplier.paymentTermsDays} jours</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Commandes</p>
              <p className="text-lg font-bold text-white">{orders.length}</p>
            </div>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
            <p className="text-xs text-slate-500 mb-2">Total commandé</p>
            <p className="text-sm font-bold text-white">{formatCurrency(totalOrdered)}</p>
          </div>
          <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
            <p className="text-xs text-slate-500 mb-2">Total payé</p>
            <p className="text-sm font-bold text-emerald-400">{formatCurrency(totalPaid)}</p>
          </div>
          <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
            <p className="text-xs text-slate-500 mb-2">Solde dû</p>
            <p className={cn(
              'text-sm font-bold',
              totalOwed > 0 ? 'text-red-400' : 'text-emerald-400'
            )}>
              {formatCurrency(totalOwed)}
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-2">
          <Button
            onClick={() => router.push(`/fournisseurs/commande/nouvelle?supplierId=${supplierId}`)}
            className="h-20 bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-all"
          >
            <Package className="w-5 h-5" />
            <span className="text-xs font-semibold">Nouvelle commande</span>
          </Button>
          <Button
            onClick={() => router.push(`/fournisseurs/paiement?supplierId=${supplierId}`)}
            disabled={totalOwed === 0}
            className="h-20 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex flex-col items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
          >
            <CreditCard className="w-5 h-5" />
            <span className="text-xs font-semibold">Paiement</span>
          </Button>
          <Button
            onClick={() => router.push(`/fournisseurs/retour/nouveau?supplierId=${supplierId}`)}
            className="h-20 bg-orange-600 hover:bg-orange-500 text-white rounded-xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-all"
          >
            <RotateCcw className="w-5 h-5" />
            <span className="text-xs font-semibold">Retour produit</span>
          </Button>
        </div>

        {/* Orders and Returns List */}
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wide">
            Historique des commandes et retours
          </h3>

          {allTransactions.length === 0 ? (
            <div className="bg-slate-900 rounded-xl p-8 border border-slate-700 text-center">
              <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 mb-1">Aucune commande ou retour</p>
              <p className="text-sm text-slate-500">Créez votre première commande</p>
            </div>
          ) : (
            <div className="space-y-3">
              {allTransactions.map((order) => {
                const paymentStatus = getPaymentStatus(order);
                const statusConfig = getStatusConfig(paymentStatus);
                const StatusIcon = statusConfig.icon;
                const orderStatusConfig = getOrderStatusConfig(order);
                const OrderStatusIcon = orderStatusConfig.icon;
                const balance = order.type === 'RETURN' 
                  ? order.totalAmount - order.amountPaid // For returns, this is refund amount
                  : (order.calculatedTotal ?? order.totalAmount) - order.amountPaid;
                const orderItemsCount = allOrderItems.filter(item => item.order_id === order.id).length;
                const isReturn = order.type === 'RETURN';

                return (
                  <div
                    key={order.id}
                    className={cn(
                      "bg-slate-900 rounded-xl p-4 border transition-all cursor-pointer active:scale-[0.98]",
                      isReturn ? "border-orange-700 hover:border-orange-600" : "border-slate-700 hover:border-slate-600"
                    )}
                    onClick={() => {
                      router.push(`/fournisseurs/commande/${order.id}`);
                    }}
                  >
                    {/* Order/Return Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={cn('p-2 rounded-lg', orderStatusConfig.bgColor)}>
                          <OrderStatusIcon className={cn('w-4 h-4', orderStatusConfig.color)} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {isReturn ? 'Retour' : 'Commande'} #{order.id}
                          </p>
                          <p className="text-xs text-slate-500">
                            {isReturn ? 'Date retour' : 'Date commande'}: {formatDate(order.orderDate)}
                          </p>
                          {orderItemsCount > 0 && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              {orderItemsCount} {orderItemsCount === 1 ? 'produit' : 'produits'}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-white">
                          {formatCurrency(order.calculatedTotal ?? order.totalAmount)}
                        </p>
                        <p className={cn('text-xs font-semibold', orderStatusConfig.color)}>
                          {orderStatusConfig.label}
                        </p>
                      </div>
                    </div>

                    {/* Payment/Refund Progress */}
                    {balance > 0 && !isReturn && (
                      <>
                        <div className="mb-2">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-slate-500">Paiement</span>
                            <span className="text-slate-400 font-medium">
                              {Math.round((order.amountPaid / (order.calculatedTotal ?? order.totalAmount)) * 100)}%
                            </span>
                          </div>
                          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 transition-all"
                              style={{ width: `${(order.amountPaid / (order.calculatedTotal ?? order.totalAmount)) * 100}%` }}
                            />
                          </div>
                        </div>

                        {/* Payment Status Badge */}
                        <div className={cn('rounded-lg p-2.5 border flex items-center justify-between', statusConfig.bgColor, statusConfig.borderColor)}>
                          <div className="flex items-center gap-2">
                            <StatusIcon className={cn('w-4 h-4', statusConfig.color)} />
                            <div>
                              <p className={cn('text-xs font-semibold', statusConfig.color)}>
                                {statusConfig.label}
                              </p>
                              <p className="text-xs text-slate-600 dark:text-slate-400">
                                Échéance: {formatDate(order.dueDate)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={cn('text-sm font-bold', statusConfig.color)}>
                              {formatCurrency(balance)}
                            </p>
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              restant
                            </p>
                          </div>
                        </div>
                      </>
                    )}

                    {balance === 0 && (
                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2.5 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm font-semibold text-emerald-400">
                          Entièrement payé
                        </span>
                      </div>
                    )}

                    {/* Notes */}
                    {order.notes && (
                      <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-800">
                        Note: {order.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

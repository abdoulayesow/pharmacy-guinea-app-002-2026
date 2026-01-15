'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuthStore } from '@/stores/auth';
import { db } from '@/lib/client/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/client/utils';
import { formatCurrency, formatDate } from '@/lib/shared/utils';
import {
  ArrowLeft,
  CreditCard,
  DollarSign,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
  Save,
  Building2,
} from 'lucide-react';
import type { SupplierOrder } from '@/lib/shared/types';

export default function PaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, currentUser } = useAuthStore();
  const supplierId = searchParams.get('supplierId');

  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [selectedOrders, setSelectedOrders] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const suppliers = useLiveQuery(() => db.suppliers.toArray()) ?? [];
  const allOrders = useLiveQuery(() => db.supplier_orders.toArray()) ?? [];

  // Filter orders: only show unpaid/partially paid orders
  const pendingOrders = allOrders.filter(
    (o) =>
      o.totalAmount > o.amountPaid &&
      (!supplierId || o.supplierId === parseInt(supplierId))
  );

  // Get selected supplier if filtered
  const selectedSupplier = supplierId
    ? suppliers.find((s) => s.id === parseInt(supplierId))
    : null;

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  // Calculate totals
  const totalDue = selectedOrders.reduce((sum, orderId) => {
    const order = pendingOrders.find((o) => o.id === orderId);
    return sum + (order ? order.totalAmount - order.amountPaid : 0);
  }, 0);

  const paymentAmountNum = parseInt(paymentAmount) || 0;
  const remainingAfterPayment = totalDue - paymentAmountNum;

  const toggleOrder = (orderId: number) => {
    if (selectedOrders.includes(orderId)) {
      setSelectedOrders(selectedOrders.filter((id) => id !== orderId));
    } else {
      setSelectedOrders([...selectedOrders, orderId]);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (selectedOrders.length === 0) {
      alert('Sélectionnez au moins une commande');
      return;
    }

    if (paymentAmountNum <= 0) {
      alert('Le montant du paiement doit être supérieur à 0');
      return;
    }

    if (paymentAmountNum > totalDue) {
      alert('Le montant du paiement ne peut pas dépasser le total dû');
      return;
    }

    setIsSubmitting(true);

    try {
      let remainingPayment = paymentAmountNum;

      // Distribute payment across selected orders (oldest first)
      const ordersToUpdate = selectedOrders
        .map((id) => pendingOrders.find((o) => o.id === id)!)
        .sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());

      for (const order of ordersToUpdate) {
        if (remainingPayment <= 0) break;

        const orderBalance = order.totalAmount - order.amountPaid;
        const paymentForThisOrder = Math.min(remainingPayment, orderBalance);

        const newAmountPaid = order.amountPaid + paymentForThisOrder;
        const newPaymentStatus =
          newAmountPaid >= order.totalAmount
            ? 'PAID'
            : newAmountPaid > 0
            ? 'PARTIALLY_PAID'
            : order.paymentStatus;

        await db.supplier_orders.update(order.id!, {
          amountPaid: newAmountPaid,
          paymentStatus: newPaymentStatus,
          updatedAt: new Date(),
          synced: false,
        });

        remainingPayment -= paymentForThisOrder;
      }

      // Record expense
      await db.expenses.add({
        date: new Date(paymentDate),
        description: `Paiement ${selectedSupplier?.name || 'fournisseur'} - ${selectedOrders.length} commande(s)`,
        amount: paymentAmountNum,
        category: 'SUPPLIER_PAYMENT',
        supplier_order_id: selectedOrders[0], // Link to first order
        user_id: currentUser?.id || 'unknown',
        synced: false,
      });

      // Navigate back
      if (supplierId) {
        router.push(`/fournisseurs/${supplierId}`);
      } else {
        router.push('/fournisseurs');
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      alert('Erreur lors de l\'enregistrement du paiement');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPaymentStatus = (order: SupplierOrder): 'overdue' | 'urgent' | 'upcoming' => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(order.dueDate);
    due.setHours(0, 0, 0, 0);
    const daysUntil = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil < 0) return 'overdue';
    if (daysUntil <= 3) return 'urgent';
    return 'upcoming';
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-8">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
        <div className="flex items-center gap-3 p-4 max-w-2xl mx-auto">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Enregistrer un paiement</h1>
            <p className="text-sm text-slate-400">
              {selectedSupplier ? selectedSupplier.name : 'Tous les fournisseurs'}
            </p>
          </div>
        </div>
      </div>

      <main className="p-4 max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Icon Display */}
          <div className="flex justify-center pt-4 pb-2">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center border-2 border-emerald-500/30">
              <CreditCard className="w-12 h-12 text-emerald-400" />
            </div>
          </div>

          {/* Payment Details */}
          <div className="bg-slate-900 rounded-2xl p-5 border border-slate-700 space-y-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wide">
              Détails du paiement
            </h3>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Date du paiement *
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                  <Calendar className="w-5 h-5" />
                </div>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="h-14 pl-12 bg-slate-800 border-slate-700 text-white rounded-xl"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Montant du paiement (GNF) *
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <DollarSign className="w-5 h-5" />
                </div>
                <Input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0"
                  min="0"
                  max={totalDue}
                  step="1000"
                  className="h-14 pl-12 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 rounded-xl text-base"
                  required
                />
              </div>
              {paymentAmount && (
                <p className="text-sm text-emerald-400 mt-2 font-semibold">
                  {formatCurrency(paymentAmountNum)}
                </p>
              )}
            </div>

            {/* Quick Amount Buttons */}
            {totalDue > 0 && (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentAmount(Math.floor(totalDue / 2).toString())}
                  className="h-12 rounded-xl font-semibold text-sm bg-slate-800 text-slate-400 hover:bg-slate-700 active:scale-95 transition-all"
                >
                  50% ({formatCurrency(Math.floor(totalDue / 2))})
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentAmount(totalDue.toString())}
                  className="h-12 rounded-xl font-semibold text-sm bg-emerald-600 text-white hover:bg-emerald-500 active:scale-95 transition-all"
                >
                  Tout payer ({formatCurrency(totalDue)})
                </button>
              </div>
            )}
          </div>

          {/* Select Orders to Pay */}
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wide">
              Sélectionner les commandes à payer
            </h3>

            {pendingOrders.length === 0 ? (
              <div className="bg-slate-900 rounded-xl p-8 border border-slate-700 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <p className="text-white font-semibold mb-1">Aucune commande en attente</p>
                <p className="text-sm text-slate-400">Tous les paiements sont à jour</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingOrders.map((order) => {
                  const supplier = suppliers.find((s) => s.id === order.supplierId);
                  const balance = order.totalAmount - order.amountPaid;
                  const paymentStatus = getPaymentStatus(order);
                  const isSelected = selectedOrders.includes(order.id!);

                  return (
                    <div
                      key={order.id}
                      onClick={() => toggleOrder(order.id!)}
                      className={cn(
                        'bg-slate-900 rounded-xl p-4 border cursor-pointer transition-all',
                        isSelected
                          ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                          : 'border-slate-700 hover:border-slate-600'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <div
                          className={cn(
                            'w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 mt-1 transition-all',
                            isSelected
                              ? 'bg-emerald-600 border-emerald-600'
                              : 'border-slate-600'
                          )}
                        >
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                        </div>

                        {/* Order Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="text-sm font-semibold text-white">
                                {supplier?.name || 'Fournisseur inconnu'}
                              </p>
                              <p className="text-xs text-slate-500">
                                Commande #{order.id} • {formatDate(order.orderDate)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-white">
                                {formatCurrency(balance)}
                              </p>
                              <p className="text-xs text-slate-400">à payer</p>
                            </div>
                          </div>

                          {/* Payment Status Badge */}
                          <div
                            className={cn(
                              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold',
                              paymentStatus === 'overdue'
                                ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                                : paymentStatus === 'urgent'
                                ? 'bg-orange-500/10 text-orange-400 border border-orange-500/30'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            )}
                          >
                            {paymentStatus === 'overdue' ? (
                              <><AlertCircle className="w-3 h-3" /> En retard</>
                            ) : paymentStatus === 'urgent' ? (
                              <><AlertCircle className="w-3 h-3" /> Urgent (3j)</>
                            ) : (
                              <><Calendar className="w-3 h-3" /> Échéance: {formatDate(order.dueDate)}</>
                            )}
                          </div>

                          {/* Payment Progress */}
                          {order.amountPaid > 0 && (
                            <div className="mt-2">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-slate-500">Déjà payé</span>
                                <span className="text-slate-400 font-medium">
                                  {formatCurrency(order.amountPaid)}
                                </span>
                              </div>
                              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 transition-all"
                                  style={{
                                    width: `${(order.amountPaid / order.totalAmount) * 100}%`,
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Payment Summary */}
          {selectedOrders.length > 0 && (
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 border border-slate-700">
              <h4 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wide">
                Résumé du paiement
              </h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Commandes sélectionnées</span>
                  <span className="text-white font-semibold">{selectedOrders.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Total dû</span>
                  <span className="text-white font-bold">{formatCurrency(totalDue)}</span>
                </div>
                {paymentAmountNum > 0 && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-400">Paiement</span>
                      <span className="text-emerald-400 font-bold">
                        - {formatCurrency(paymentAmountNum)}
                      </span>
                    </div>
                    <div className="pt-3 border-t border-slate-700 flex items-center justify-between">
                      <span className="text-slate-400">Reste à payer</span>
                      <span
                        className={cn(
                          'text-xl font-bold',
                          remainingAfterPayment === 0 ? 'text-emerald-400' : 'text-white'
                        )}
                      >
                        {formatCurrency(remainingAfterPayment)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="flex-1 h-14 text-base bg-slate-800 border-slate-700 text-white hover:bg-slate-700 rounded-xl"
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || selectedOrders.length === 0 || !paymentAmount || paymentAmountNum <= 0}
              className="flex-1 h-14 text-base bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Enregistrement...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save className="w-5 h-5" />
                  Enregistrer le paiement
                </span>
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}

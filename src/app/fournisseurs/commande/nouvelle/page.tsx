'use client';

export const dynamic = 'force-dynamic';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuthStore } from '@/stores/auth';
import { db } from '@/lib/client/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/client/utils';
import { formatCurrency } from '@/lib/shared/utils';
import {
  ArrowLeft,
  Package,
  Calendar,
  DollarSign,
  FileText,
  Save,
  Building2,
} from 'lucide-react';

export default function NewOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuthStore();
  const preselectedSupplierId = searchParams.get('supplierId');

  const [supplierId, setSupplierId] = useState(preselectedSupplierId || '');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const suppliers = useLiveQuery(() => db.suppliers.toArray()) ?? [];
  const selectedSupplier = suppliers.find(s => s.id === parseInt(supplierId));

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  // Calculate due date based on supplier payment terms
  const calculateDueDate = () => {
    if (!selectedSupplier || !orderDate) return null;
    const order = new Date(orderDate);
    order.setDate(order.getDate() + selectedSupplier.paymentTermsDays);
    return order;
  };

  const dueDate = calculateDueDate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (!dueDate) {
        alert('Erreur de calcul de la date d\'échéance');
        return;
      }

      const orderId = await db.supplier_orders.add({
        supplierId: parseInt(supplierId),
        orderDate: new Date(orderDate),
        deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
        totalAmount: parseInt(totalAmount),
        amountPaid: 0,
        dueDate: dueDate,
        status: deliveryDate ? 'DELIVERED' : 'ORDERED',
        notes: notes.trim() || undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
        synced: false,
      });

      // Navigate to supplier detail page
      router.push(`/fournisseurs/${supplierId}`);
    } catch (error) {
      console.error('Error creating order:', error);
      alert('Erreur lors de la création de la commande');
    } finally {
      setIsSubmitting(false);
    }
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
            <h1 className="text-xl font-bold">Nouvelle commande</h1>
            <p className="text-sm text-slate-400">Enregistrer une commande fournisseur</p>
          </div>
        </div>
      </div>

      <main className="p-4 max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Icon Display */}
          <div className="flex justify-center pt-4 pb-2">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 flex items-center justify-center border-2 border-blue-500/30">
              <Package className="w-12 h-12 text-blue-400" />
            </div>
          </div>

          {/* Supplier Selection */}
          <div className="bg-slate-900 rounded-2xl p-5 border border-slate-700">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wide">
              Fournisseur
            </h3>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Sélectionner le fournisseur *
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 z-10">
                  <Building2 className="w-5 h-5" />
                </div>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full h-14 pl-12 pr-4 bg-slate-800 border border-slate-700 text-white rounded-xl text-base appearance-none cursor-pointer"
                  required
                >
                  <option value="">Choisir un fournisseur...</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedSupplier && (
                <div className="mt-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                  <p className="text-sm text-slate-400">
                    Délai de paiement: <span className="font-semibold text-white">{selectedSupplier.paymentTermsDays} jours</span>
                  </p>
                  {selectedSupplier.phone && (
                    <p className="text-sm text-slate-400 mt-1">
                      Téléphone: <span className="text-white">{selectedSupplier.phone}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Order Details */}
          <div className="bg-slate-900 rounded-2xl p-5 border border-slate-700 space-y-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wide">
              Détails de la commande
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Date de commande *
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <Input
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="h-14 pl-12 bg-slate-800 border-slate-700 text-white rounded-xl"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Date de livraison
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <Input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    min={orderDate}
                    className="h-14 pl-12 bg-slate-800 border-slate-700 text-white rounded-xl"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Montant total (GNF) *
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <DollarSign className="w-5 h-5" />
                </div>
                <Input
                  type="number"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="1000"
                  className="h-14 pl-12 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 rounded-xl text-base"
                  required
                />
              </div>
              {totalAmount && (
                <p className="text-sm text-emerald-400 mt-2 font-semibold">
                  {formatCurrency(parseInt(totalAmount) || 0)}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Notes
              </label>
              <div className="relative">
                <div className="absolute left-4 top-4 text-slate-500">
                  <FileText className="w-5 h-5" />
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Commande mensuelle, livraison par camion..."
                  rows={3}
                  className="w-full pl-12 pr-4 py-3 bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 rounded-xl text-base resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Payment Terms Summary */}
          {dueDate && (
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-blue-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-400 mb-1">
                    Date d'échéance calculée
                  </p>
                  <p className="text-2xl font-bold text-white mb-2">
                    {dueDate.toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                  <p className="text-xs text-slate-400">
                    Paiement à effectuer dans <span className="font-semibold text-white">{selectedSupplier?.paymentTermsDays} jours</span> après la commande
                  </p>
                </div>
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
              disabled={isSubmitting || !supplierId || !totalAmount}
              className="flex-1 h-14 text-base bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Enregistrement...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save className="w-5 h-5" />
                  Enregistrer la commande
                </span>
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}

'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/client/db';
import { formatCurrency, formatDate } from '@/lib/shared/utils';
import { ArrowLeft, Printer, Share2, Banknote, Smartphone, FileText, CheckCircle, Clock, AlertCircle, Plus, Receipt } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useMemo, use } from 'react';
import type { Product, CreditPayment } from '@/lib/shared/types';

export default function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const saleId = parseInt(unwrappedParams.id);

  const [showPaymentForm, setShowPaymentForm] = useState(false);

  // Fetch sale from IndexedDB
  const sale = useLiveQuery(() => db.sales.get(saleId));

  // Fetch sale items
  const saleItems = useLiveQuery(() =>
    db.sale_items.where('sale_id').equals(saleId).toArray()
  ) ?? [];

  // Fetch products for sale items
  const products = useLiveQuery(async () => {
    const productIds = saleItems.map(item => item.product_id);
    return await db.products.bulkGet(productIds);
  }, [saleItems]) ?? [];

  // Fetch credit payments for this sale
  const creditPayments = useLiveQuery(() =>
    db.credit_payments.where('sale_id').equals(saleId).toArray()
  ) ?? [];

  // Calculate if overdue
  const isOverdue = useMemo(() => {
    if (!sale || sale.payment_method !== 'CREDIT' || sale.payment_status === 'PAID' || !sale.due_date) {
      return false;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(sale.due_date);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate < today;
  }, [sale]);

  if (!sale) {
    return (
      <div className="min-h-screen bg-[#f5f1e8] flex items-center justify-center">
        <div className="text-center">
          <Receipt className="w-16 h-16 mx-auto text-[#c4b5a0] mb-4" />
          <p className="text-[#8b7355] font-serif text-lg">Vente introuvable</p>
        </div>
      </div>
    );
  }

  const displayStatus = isOverdue ? 'OVERDUE' : sale.payment_status;

  return (
    <div className="min-h-screen bg-[#f5f1e8] relative overflow-hidden pb-24">
      {/* Ledger paper texture background */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 31px,
            #8b7355 31px,
            #8b7355 32px
          )`
        }}
      />

      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#2c1810] text-[#f5f1e8] shadow-lg border-b-4 border-[#8b7355]">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-[#3d2415] rounded-lg transition-colors active:scale-95"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-xl font-serif font-bold tracking-wide">Détails de la vente</h1>
                <p className="text-sm text-[#d4c5b0] font-serif">#{saleId.toString().padStart(4, '0')}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                className="p-2 hover:bg-[#3d2415] rounded-lg transition-colors active:scale-95"
                onClick={() => window.print()}
              >
                <Printer className="w-5 h-5" />
              </button>
              <button
                className="p-2 hover:bg-[#3d2415] rounded-lg transition-colors active:scale-95"
                onClick={() => {
                  // Share functionality
                  if (navigator.share) {
                    navigator.share({
                      title: `Vente #${saleId}`,
                      text: `Vente de ${formatCurrency(sale.total)} - ${formatDate(new Date(sale.created_at))}`,
                    });
                  }
                }}
              >
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Status stamp */}
          <div className="flex justify-center">
            <StatusStamp status={displayStatus} />
          </div>
        </div>
      </div>

      {/* Sale information */}
      <div className="px-4 py-6 space-y-4">
        {/* Total amount card */}
        <div className="bg-white rounded-lg shadow-lg border-2 border-[#d4c5b0] p-6 text-center">
          <div className="text-sm font-serif text-[#8b7355] mb-2">Montant total</div>
          <div className="text-4xl font-bold font-serif tabular-nums text-[#2c1810] mb-4">
            {formatCurrency(sale.total)}
          </div>

          {/* Payment breakdown for credit sales */}
          {sale.payment_method === 'CREDIT' && (
            <div className="space-y-2 pt-4 border-t-2 border-dashed border-[#d4c5b0]">
              <div className="flex justify-between text-sm font-serif">
                <span className="text-emerald-700">Payé</span>
                <span className="font-bold tabular-nums text-emerald-800">{formatCurrency(sale.amount_paid)}</span>
              </div>
              <div className="flex justify-between text-sm font-serif">
                <span className="text-amber-700">Reste dû</span>
                <span className="font-bold tabular-nums text-amber-800">{formatCurrency(sale.amount_due)}</span>
              </div>
            </div>
          )}

          <div className="mt-4 text-xs text-[#a89a84] font-serif">
            {formatDate(new Date(sale.created_at))} à {new Date(sale.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        {/* Payment method */}
        <div className="bg-white rounded-lg shadow-md border-2 border-[#d4c5b0] p-4">
          <div className="text-sm font-serif text-[#8b7355] mb-3 uppercase tracking-wide">Méthode de paiement</div>
          <div className="flex items-center gap-3">
            {sale.payment_method === 'CASH' && (
              <>
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                  <Banknote className="w-6 h-6 text-emerald-700" />
                </div>
                <div>
                  <div className="font-medium text-[#2c1810]">Espèces</div>
                  <div className="text-sm text-[#8b7355] font-serif">Paiement en liquide</div>
                </div>
              </>
            )}
            {sale.payment_method === 'ORANGE_MONEY' && (
              <>
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <Smartphone className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <div className="font-medium text-[#2c1810]">Orange Money</div>
                  {sale.payment_ref && (
                    <div className="text-sm text-[#8b7355] font-mono">Réf: {sale.payment_ref}</div>
                  )}
                </div>
              </>
            )}
            {sale.payment_method === 'CREDIT' && (
              <>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <FileText className="w-6 h-6 text-blue-700" />
                </div>
                <div>
                  <div className="font-medium text-[#2c1810]">Paiement à crédit</div>
                  {sale.due_date && (
                    <div className={`text-sm font-serif ${isOverdue ? 'text-red-700 font-bold' : 'text-blue-700'}`}>
                      Échéance: {formatDate(new Date(sale.due_date))}
                      {isOverdue && ' ⚠ RETARD'}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Customer info for credit sales */}
        {sale.payment_method === 'CREDIT' && sale.customer_name && (
          <div className="bg-white rounded-lg shadow-md border-2 border-blue-200 p-4">
            <div className="text-sm font-serif text-blue-800 mb-3 uppercase tracking-wide">Informations client</div>
            <div className="space-y-2">
              <div>
                <div className="text-xs text-blue-600 font-serif">Nom</div>
                <div className="font-medium text-blue-900">{sale.customer_name}</div>
              </div>
              {sale.customer_phone && (
                <div>
                  <div className="text-xs text-blue-600 font-serif">Téléphone</div>
                  <div className="font-mono text-blue-900">{sale.customer_phone}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Credit payment history */}
        {sale.payment_method === 'CREDIT' && creditPayments.length > 0 && (
          <div className="bg-white rounded-lg shadow-md border-2 border-[#d4c5b0] p-4">
            <div className="text-sm font-serif text-[#8b7355] mb-3 uppercase tracking-wide">Historique des paiements</div>
            <div className="space-y-3">
              {creditPayments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div>
                    <div className="font-medium text-emerald-900 tabular-nums">{formatCurrency(payment.amount)}</div>
                    <div className="text-xs text-emerald-700 font-serif">{formatDate(new Date(payment.payment_date))}</div>
                    <div className="text-xs text-emerald-600 mt-1">
                      {payment.payment_method === 'CASH' ? 'Espèces' : 'Orange Money'}
                      {payment.payment_ref && ` - ${payment.payment_ref}`}
                    </div>
                  </div>
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add payment button for pending credit sales */}
        {sale.payment_method === 'CREDIT' && sale.amount_due > 0 && (
          <button
            onClick={() => setShowPaymentForm(true)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-medium py-4 rounded-lg
              flex items-center justify-center gap-2 shadow-lg transition-all duration-200"
          >
            <Plus className="w-5 h-5" />
            Enregistrer un paiement
          </button>
        )}

        {/* Items sold */}
        <div className="bg-white rounded-lg shadow-md border-2 border-[#d4c5b0] p-4">
          <div className="text-sm font-serif text-[#8b7355] mb-4 uppercase tracking-wide">Articles vendus</div>
          <div className="space-y-3">
            {saleItems.map((item, index) => {
              const product = products[index];
              return (
                <div key={item.id} className="flex justify-between items-start p-3 border-b border-dashed border-[#d4c5b0] last:border-0">
                  <div>
                    <div className="font-medium text-[#2c1810]">{product?.name || 'Produit inconnu'}</div>
                    <div className="text-sm text-[#8b7355] font-serif">
                      Quantité: {item.quantity} × {formatCurrency(item.unit_price)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold font-serif tabular-nums text-[#2c1810]">{formatCurrency(item.subtotal)}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t-2 border-[#8b7355] flex justify-between items-center">
            <span className="font-serif text-[#2c1810] font-bold uppercase tracking-wide">Total</span>
            <span className="text-2xl font-bold font-serif tabular-nums text-[#2c1810]">{formatCurrency(sale.total)}</span>
          </div>
        </div>
      </div>

      {/* Payment form modal */}
      {showPaymentForm && (
        <PaymentFormModal
          sale={sale}
          onClose={() => setShowPaymentForm(false)}
        />
      )}
    </div>
  );
}

// Payment form modal for adding credit payments
function PaymentFormModal({ sale, onClose }: { sale: any; onClose: () => void }) {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'ORANGE_MONEY'>('CASH');
  const [paymentRef, setPaymentRef] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const paymentAmount = parseFloat(amount);

      // Validate amount
      if (isNaN(paymentAmount) || paymentAmount <= 0) {
        alert('Veuillez entrer un montant valide');
        setIsSubmitting(false);
        return;
      }

      if (paymentAmount > sale.amount_due) {
        alert('Le montant ne peut pas dépasser le montant dû');
        setIsSubmitting(false);
        return;
      }

      // Create credit payment record
      const payment: CreditPayment = {
        sale_id: sale.id!,
        amount: paymentAmount,
        payment_method: paymentMethod,
        payment_ref: paymentMethod === 'ORANGE_MONEY' ? paymentRef : undefined,
        payment_date: new Date(),
        notes: notes || undefined,
        user_id: sale.user_id,
        synced: false,
      };

      // Add to database
      await db.credit_payments.add(payment);

      // Update sale record
      const newAmountPaid = sale.amount_paid + paymentAmount;
      const newAmountDue = sale.amount_due - paymentAmount;
      const newStatus = newAmountDue === 0 ? 'PAID' : 'PARTIALLY_PAID';

      await db.sales.update(sale.id!, {
        amount_paid: newAmountPaid,
        amount_due: newAmountDue,
        payment_status: newStatus,
      });

      // Add to sync queue
      await db.sync_queue.add({
        type: 'CREDIT_PAYMENT',
        action: 'CREATE',
        payload: payment,
        localId: sale.id!,
        createdAt: new Date(),
        status: 'PENDING',
        retryCount: 0,
      });

      onClose();
    } catch (error) {
      console.error('Error recording payment:', error);
      alert('Erreur lors de l\'enregistrement du paiement');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl animate-slideUp">
        <div className="p-6">
          <h2 className="text-xl font-serif font-bold text-[#2c1810] mb-4">Enregistrer un paiement</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Amount */}
            <div>
              <label className="block text-sm font-serif text-[#5a3825] mb-2">
                Montant (max: {formatCurrency(sale.amount_due)})
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full px-4 py-3 border-2 border-[#d4c5b0] rounded-lg focus:border-emerald-600 focus:outline-none
                  text-lg font-bold font-serif tabular-nums"
                required
                step="100"
                min="0"
                max={sale.amount_due}
              />
            </div>

            {/* Payment method */}
            <div>
              <label className="block text-sm font-serif text-[#5a3825] mb-2">Méthode de paiement</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`
                    p-4 border-2 rounded-lg font-medium transition-all
                    ${paymentMethod === 'CASH'
                      ? 'bg-emerald-100 border-emerald-600 text-emerald-900'
                      : 'bg-white border-[#d4c5b0] text-[#5a3825] hover:border-emerald-400'
                    }
                  `}
                >
                  <Banknote className="w-6 h-6 mx-auto mb-1" />
                  Espèces
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('ORANGE_MONEY')}
                  className={`
                    p-4 border-2 rounded-lg font-medium transition-all
                    ${paymentMethod === 'ORANGE_MONEY'
                      ? 'bg-orange-100 border-orange-600 text-orange-900'
                      : 'bg-white border-[#d4c5b0] text-[#5a3825] hover:border-orange-400'
                    }
                  `}
                >
                  <Smartphone className="w-6 h-6 mx-auto mb-1" />
                  Orange Money
                </button>
              </div>
            </div>

            {/* Orange Money reference */}
            {paymentMethod === 'ORANGE_MONEY' && (
              <div>
                <label className="block text-sm font-serif text-[#5a3825] mb-2">Référence de transaction</label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="MP240113.1234.A12345"
                  className="w-full px-4 py-3 border-2 border-[#d4c5b0] rounded-lg focus:border-orange-600 focus:outline-none font-mono"
                />
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-serif text-[#5a3825] mb-2">Notes (optionnel)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Commentaire..."
                rows={2}
                className="w-full px-4 py-3 border-2 border-[#d4c5b0] rounded-lg focus:border-emerald-600 focus:outline-none resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 border-2 border-[#d4c5b0] rounded-lg font-medium text-[#5a3825]
                  hover:bg-[#f5f1e8] active:scale-95 transition-all"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-medium rounded-lg
                  disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
              >
                {isSubmitting ? 'Enregistrement...' : 'Confirmer'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Status stamp component
function StatusStamp({ status }: { status: 'PAID' | 'PENDING' | 'PARTIALLY_PAID' | 'OVERDUE' }) {
  const getStampStyle = () => {
    switch (status) {
      case 'PAID':
        return {
          bg: 'bg-emerald-100',
          border: 'border-emerald-700',
          text: 'text-emerald-800',
          label: 'PAYÉ',
          icon: CheckCircle,
        };
      case 'PENDING':
        return {
          bg: 'bg-amber-100',
          border: 'border-amber-700',
          text: 'text-amber-800',
          label: 'EN ATTENTE',
          icon: Clock,
        };
      case 'OVERDUE':
        return {
          bg: 'bg-red-100',
          border: 'border-red-700',
          text: 'text-red-800',
          label: 'EN RETARD',
          icon: AlertCircle,
        };
      case 'PARTIALLY_PAID':
        return {
          bg: 'bg-blue-100',
          border: 'border-blue-700',
          text: 'text-blue-800',
          label: 'PARTIEL',
          icon: Clock,
        };
      default:
        return {
          bg: 'bg-gray-100',
          border: 'border-gray-700',
          text: 'text-gray-800',
          label: status,
          icon: AlertCircle,
        };
    }
  };

  const style = getStampStyle();
  const Icon = style.icon;

  return (
    <div
      className={`
        ${style.bg} ${style.border} ${style.text}
        border-3 rounded px-4 py-2 font-bold text-sm uppercase tracking-wider
        transform rotate-3 shadow-lg inline-flex items-center gap-2
      `}
      style={{
        fontFamily: 'serif',
        letterSpacing: '0.15em',
      }}
    >
      <Icon className="w-5 h-5" />
      {style.label}
    </div>
  );
}

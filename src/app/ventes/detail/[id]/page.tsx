'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/client/db';
import { formatCurrency, formatDate } from '@/lib/shared/utils';
import {
  ArrowLeft, Printer, Share2, Banknote, Smartphone, FileText, CheckCircle,
  Clock, AlertCircle, Plus, Receipt, Edit2, Info, X, Minus, Package
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useMemo, use } from 'react';
import { toast } from 'sonner';
import type { Product, CreditPayment } from '@/lib/shared/types';
import { useSaleEdit } from '@/lib/client/useSaleEdit';
import { ProductSearch } from '@/components/ProductSearch';
import { useAuthStore } from '@/stores/auth';
import { Input } from '@/components/ui/input';
import { queueTransaction } from '@/lib/client/sync';

export default function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const saleId = parseInt(unwrappedParams.id);
  const currentUser = useAuthStore((state) => state.currentUser);

  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);

  // Fetch sale from IndexedDB
  const sale = useLiveQuery(() => db.sales.get(saleId));

  // Fetch sale items with products
  const saleItemsWithProducts = useLiveQuery(async () => {
    const items = await db.sale_items.where('sale_id').equals(saleId).toArray();
    const productsData = await Promise.all(
      items.map(async (item) => {
        const product = await db.products.get(item.product_id);
        return { ...item, product: product! };
      })
    );
    return productsData;
  }, [saleId]) ?? [];

  // Fetch credit payments for this sale
  const creditPayments = useLiveQuery(() =>
    db.credit_payments.where('sale_id').equals(saleId).toArray()
  ) ?? [];

  // Initialize sale edit hook
  const {
    isEditMode,
    canEdit,
    editItems,
    editTotal,
    isSaving,
    hasSignificantChanges,
    enterEditMode,
    cancelEdit,
    updateQuantity,
    removeItem,
    addItem,
    saveSale,
  } = useSaleEdit({
    sale: sale!,
    saleItems: saleItemsWithProducts,
    onEditComplete: () => {
      // Refresh will happen automatically via useLiveQuery
    },
  });

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

  // Handle save
  const handleSave = async () => {
    if (!currentUser) {
      toast.error('Utilisateur non authentifié');
      return;
    }
    await saveSale(currentUser.id);
  };

  if (!sale) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Receipt className="w-16 h-16 mx-auto text-slate-600 mb-4" />
          <p className="text-slate-400 text-lg">Vente introuvable</p>
        </div>
      </div>
    );
  }

  const displayStatus = isOverdue ? 'OVERDUE' : sale.payment_status;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 relative pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-gradient-to-br from-slate-900 to-slate-950 border-b border-slate-700 shadow-xl">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors active:scale-95"
              >
                <ArrowLeft className="w-6 h-6 text-white" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-white tracking-wide">Détails de la vente</h1>
                <p className="text-sm text-slate-400">#{saleId.toString().padStart(4, '0')}</p>
              </div>
            </div>

            <div className="flex gap-2">
              {/* Edit button - only show if can edit and not in edit mode */}
              {canEdit.allowed && !isEditMode && (
                <button
                  onClick={enterEditMode}
                  className="p-2 hover:bg-emerald-600/20 rounded-lg transition-colors active:scale-95 border border-emerald-600/30"
                  title="Modifier la vente"
                >
                  <Edit2 className="w-5 h-5 text-emerald-500" />
                </button>
              )}
              {!isEditMode && (
                <>
                  <button
                    className="p-2 hover:bg-slate-800 rounded-lg transition-colors active:scale-95"
                    onClick={() => window.print()}
                  >
                    <Printer className="w-5 h-5 text-white" />
                  </button>
                  <button
                    className="p-2 hover:bg-slate-800 rounded-lg transition-colors active:scale-95"
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: `Vente #${saleId}`,
                          text: `Vente de ${formatCurrency(sale.total)} - ${formatDate(new Date(sale.created_at))}`,
                        });
                      }
                    }}
                  >
                    <Share2 className="w-5 h-5 text-white" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Status stamp */}
          <div className="flex justify-center">
            <StatusStamp status={displayStatus} />
          </div>

          {/* Modified badge */}
          {sale.modified_at && !isEditMode && (
            <div className="flex justify-center mt-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <Info className="w-4 h-4 text-blue-400" />
                <div className="text-xs text-blue-300">
                  Modifié le {formatDate(new Date(sale.modified_at))}
                  {sale.edit_count && sale.edit_count > 1 && ` (${sale.edit_count}×)`}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit mode indicator banner */}
      {isEditMode && (
        <div className="sticky top-[118px] z-10 bg-amber-500/10 border-y border-amber-500/20 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-400" />
              <span className="text-sm text-amber-200 font-semibold">Mode modification</span>
            </div>
            {hasSignificantChanges && (
              <span className="text-xs text-amber-300">Changements importants détectés</span>
            )}
          </div>
        </div>
      )}

      {/* Sale information */}
      <div className="px-4 py-6 space-y-4">
        {/* Total amount card */}
        <div className="bg-slate-900/70 rounded-xl border border-slate-700 p-6 text-center shadow-lg">
          <div className="text-sm font-semibold text-slate-400 mb-2">
            {isEditMode ? 'Nouveau montant' : 'Montant total'}
          </div>
          <div className="text-4xl font-bold tabular-nums text-white mb-4">
            {formatCurrency(isEditMode ? editTotal : sale.total)}
          </div>

          {isEditMode && editTotal !== sale.total && (
            <div className="mb-4 pb-4 border-b border-slate-700">
              <div className="text-sm text-slate-500">
                Original: <span className="line-through">{formatCurrency(sale.total)}</span>
              </div>
              <div className="text-sm text-emerald-400 font-semibold">
                Différence: {formatCurrency(editTotal - sale.total)}
              </div>
            </div>
          )}

          {/* Payment breakdown for credit sales */}
          {sale.payment_method === 'CREDIT' && !isEditMode && (
            <div className="space-y-2 pt-4 border-t border-slate-700">
              <div className="flex justify-between text-sm">
                <span className="text-emerald-400">Payé</span>
                <span className="font-bold tabular-nums text-emerald-300">{formatCurrency(sale.amount_paid)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-amber-400">Reste dû</span>
                <span className="font-bold tabular-nums text-amber-300">{formatCurrency(sale.amount_due)}</span>
              </div>
            </div>
          )}

          <div className="mt-4 text-xs text-slate-500">
            {formatDate(new Date(sale.created_at))} à {new Date(sale.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        {/* Payment method - hide in edit mode */}
        {!isEditMode && (
          <div className="bg-slate-900/70 rounded-xl border border-slate-700 p-4 shadow-lg">
            <div className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wide">Méthode de paiement</div>
            <div className="flex items-center gap-3">
              {sale.payment_method === 'CASH' && (
                <>
                  <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center">
                    <Banknote className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <div className="font-medium text-white">Espèces</div>
                    <div className="text-sm text-slate-400">Paiement en liquide</div>
                  </div>
                </>
              )}
              {sale.payment_method === 'ORANGE_MONEY' && (
                <>
                  <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center">
                    <Smartphone className="w-6 h-6 text-orange-400" />
                  </div>
                  <div>
                    <div className="font-medium text-white">Orange Money</div>
                    {sale.payment_ref && (
                      <div className="text-sm text-slate-400 font-mono">Réf: {sale.payment_ref}</div>
                    )}
                  </div>
                </>
              )}
              {sale.payment_method === 'CREDIT' && (
                <>
                  <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                    <FileText className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <div className="font-medium text-white">Paiement à crédit</div>
                    {sale.due_date && (
                      <div className={`text-sm ${isOverdue ? 'text-red-400 font-bold' : 'text-blue-400'}`}>
                        Échéance: {formatDate(new Date(sale.due_date))}
                        {isOverdue && ' ⚠ RETARD'}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Customer info - hide in edit mode, or make editable later */}
        {!isEditMode && sale.payment_method === 'CREDIT' && sale.customer_name && (
          <div className="bg-slate-900/70 rounded-xl border border-blue-500/30 p-4 shadow-lg">
            <div className="text-sm font-semibold text-blue-400 mb-3 uppercase tracking-wide">Informations client</div>
            <div className="space-y-2">
              <div>
                <div className="text-xs text-blue-400">Nom</div>
                <div className="font-medium text-white">{sale.customer_name}</div>
              </div>
              {sale.customer_phone && (
                <div>
                  <div className="text-xs text-blue-400">Téléphone</div>
                  <div className="font-mono text-white">{sale.customer_phone}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Credit payment history - hide in edit mode */}
        {!isEditMode && sale.payment_method === 'CREDIT' && creditPayments.length > 0 && (
          <div className="bg-slate-900/70 rounded-xl border border-slate-700 p-4 shadow-lg">
            <div className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wide">Historique des paiements</div>
            <div className="space-y-3">
              {creditPayments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <div>
                    <div className="font-medium text-emerald-300 tabular-nums">{formatCurrency(payment.amount)}</div>
                    <div className="text-xs text-emerald-400">{formatDate(new Date(payment.payment_date))}</div>
                    <div className="text-xs text-emerald-500 mt-1">
                      {payment.payment_method === 'CASH' ? 'Espèces' : 'Orange Money'}
                      {payment.payment_ref && ` - ${payment.payment_ref}`}
                    </div>
                  </div>
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add payment button - hide in edit mode */}
        {!isEditMode && sale.payment_method === 'CREDIT' && sale.amount_due > 0 && (
          <button
            onClick={() => setShowPaymentForm(true)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-medium py-4 rounded-xl
              flex items-center justify-center gap-2 shadow-lg transition-all duration-200"
          >
            <Plus className="w-5 h-5" />
            Enregistrer un paiement
          </button>
        )}

        {/* Items sold - READ MODE */}
        {!isEditMode && (
          <div className="bg-slate-900/70 rounded-xl border border-slate-700 p-4 shadow-lg">
            <div className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-wide">Articles vendus</div>
            <div className="space-y-3">
              {saleItemsWithProducts.map((item) => (
                <div key={item.id} className="flex justify-between items-start p-3 border-b border-slate-800 last:border-0">
                  <div>
                    <div className="font-medium text-white">{item.product?.name || 'Produit inconnu'}</div>
                    <div className="text-sm text-slate-400">
                      Quantité: {item.quantity} × {formatCurrency(item.unit_price)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold tabular-nums text-white">{formatCurrency(item.subtotal)}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t-2 border-slate-700 flex justify-between items-center">
              <span className="text-white font-bold uppercase tracking-wide">Total</span>
              <span className="text-2xl font-bold tabular-nums text-white">{formatCurrency(sale.total)}</span>
            </div>
          </div>
        )}

        {/* Items - EDIT MODE */}
        {isEditMode && (
          <div className="bg-slate-900/70 rounded-xl border border-amber-500/30 p-4 shadow-lg space-y-3">
            <div className="text-sm font-semibold text-amber-400 mb-4 uppercase tracking-wide">Articles (édition)</div>

            {editItems.map((item, index) => (
              <div key={index} className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white truncate">{item.product.name}</div>
                  <div className="text-sm text-slate-400">{formatCurrency(item.unit_price)} / unité</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Stock disponible: {item.product.stock + (saleItemsWithProducts.find(si => si.product_id === item.product.id)?.quantity || 0)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(index, item.quantity - 1)}
                    disabled={item.quantity <= 1}
                    className="w-8 h-8 flex items-center justify-center bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    <Minus className="w-4 h-4 text-white" />
                  </button>

                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateQuantity(index, parseInt(e.target.value) || 1)}
                    className="w-16 h-8 text-center bg-slate-900 border-slate-600 text-white text-sm"
                  />

                  <button
                    onClick={() => updateQuantity(index, item.quantity + 1)}
                    className="w-8 h-8 flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4 text-white" />
                  </button>
                </div>

                <div className="text-right min-w-[100px]">
                  <div className="font-bold text-white tabular-nums">{formatCurrency(item.subtotal)}</div>
                </div>

                <button
                  onClick={() => removeItem(index)}
                  disabled={editItems.length <= 1}
                  className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ))}

            {/* Add item button */}
            <button
              onClick={() => setShowProductSearch(true)}
              className="w-full py-3 border-2 border-dashed border-emerald-500/30 hover:border-emerald-500/50 hover:bg-emerald-500/5
                rounded-lg text-emerald-400 font-medium transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Ajouter un article
            </button>
          </div>
        )}
      </div>

      {/* Fixed bottom action bar - EDIT MODE */}
      {isEditMode && (
        <div className="fixed bottom-20 left-0 right-0 z-20 bg-slate-900/95 backdrop-blur-sm border-t border-slate-700 px-4 py-4 shadow-2xl">
          <div className="flex gap-3 max-w-2xl mx-auto">
            <button
              onClick={cancelEdit}
              disabled={isSaving}
              className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || editItems.length === 0 || editTotal <= 0}
              className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Enregistrer
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Payment form modal */}
      {showPaymentForm && (
        <PaymentFormModal
          sale={sale}
          onClose={() => setShowPaymentForm(false)}
        />
      )}

      {/* Product search modal */}
      <ProductSearch
        open={showProductSearch}
        onClose={() => setShowProductSearch(false)}
        onAddProduct={(product, quantity) => addItem(product, quantity)}
        excludeProductIds={editItems.map(item => item.product.id!)}
      />
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

      if (isNaN(paymentAmount) || paymentAmount <= 0) {
        toast.error('Veuillez entrer un montant valide');
        setIsSubmitting(false);
        return;
      }

      if (paymentAmount > sale.amount_due) {
        toast.error('Le montant ne peut pas dépasser le montant dû');
        setIsSubmitting(false);
        return;
      }

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

      await db.credit_payments.add(payment);

      const newAmountPaid = sale.amount_paid + paymentAmount;
      const newAmountDue = sale.amount_due - paymentAmount;
      const newStatus = newAmountDue === 0 ? 'PAID' : 'PARTIALLY_PAID';

      await db.sales.update(sale.id!, {
        amount_paid: newAmountPaid,
        amount_due: newAmountDue,
        payment_status: newStatus,
      });

      await queueTransaction('CREDIT_PAYMENT', 'CREATE', payment, String(sale.id!));

      toast.success('Paiement enregistré');
      onClose();
    } catch (error) {
      console.error('Error recording payment:', error);
      toast.error('Erreur lors de l\'enregistrement du paiement');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl animate-slideUp">
        <div className="p-6">
          <h2 className="text-xl font-bold text-white mb-4">Enregistrer un paiement</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Montant (max: {formatCurrency(sale.amount_due)})
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full px-4 py-3 bg-slate-950 border-2 border-slate-700 focus:border-emerald-500 rounded-lg
                  text-lg font-bold tabular-nums text-white outline-none"
                required
                step="100"
                min="0"
                max={sale.amount_due}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Méthode de paiement</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`p-4 border-2 rounded-lg font-medium transition-all ${
                    paymentMethod === 'CASH'
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-emerald-500/50'
                  }`}
                >
                  <Banknote className="w-6 h-6 mx-auto mb-1" />
                  Espèces
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('ORANGE_MONEY')}
                  className={`p-4 border-2 rounded-lg font-medium transition-all ${
                    paymentMethod === 'ORANGE_MONEY'
                      ? 'bg-orange-500/20 border-orange-500 text-orange-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-orange-500/50'
                  }`}
                >
                  <Smartphone className="w-6 h-6 mx-auto mb-1" />
                  Orange Money
                </button>
              </div>
            </div>

            {paymentMethod === 'ORANGE_MONEY' && (
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Référence de transaction</label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="MP240113.1234.A12345"
                  className="w-full px-4 py-3 bg-slate-950 border-2 border-slate-700 focus:border-orange-500 rounded-lg
                    font-mono text-white outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Notes (optionnel)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Commentaire..."
                rows={2}
                className="w-full px-4 py-3 bg-slate-950 border-2 border-slate-700 focus:border-emerald-500 rounded-lg
                  text-white outline-none resize-none"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 border-2 border-slate-700 rounded-lg font-medium text-slate-300
                  hover:bg-slate-800 active:scale-95 transition-all"
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
          bg: 'bg-emerald-500/20',
          border: 'border-emerald-500',
          text: 'text-emerald-300',
          label: 'PAYÉ',
          icon: CheckCircle,
        };
      case 'PENDING':
        return {
          bg: 'bg-amber-500/20',
          border: 'border-amber-500',
          text: 'text-amber-300',
          label: 'EN ATTENTE',
          icon: Clock,
        };
      case 'OVERDUE':
        return {
          bg: 'bg-red-500/20',
          border: 'border-red-500',
          text: 'text-red-300',
          label: 'EN RETARD',
          icon: AlertCircle,
        };
      case 'PARTIALLY_PAID':
        return {
          bg: 'bg-blue-500/20',
          border: 'border-blue-500',
          text: 'text-blue-300',
          label: 'PARTIEL',
          icon: Clock,
        };
      default:
        return {
          bg: 'bg-slate-500/20',
          border: 'border-slate-500',
          text: 'text-slate-300',
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
        border-2 rounded-lg px-4 py-2 font-bold text-sm uppercase tracking-wider
        shadow-lg inline-flex items-center gap-2
      `}
    >
      <Icon className="w-5 h-5" />
      {style.label}
    </div>
  );
}

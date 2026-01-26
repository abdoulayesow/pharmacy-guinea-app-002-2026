'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  X,
  Package,
  User,
  Phone,
  FileText,
  Send,
  Loader2,
  CheckCircle2,
  Hash,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { db } from '@/lib/client/db';
import { queueTransaction } from '@/lib/client/sync';
import { generateId } from '@/lib/shared/utils';
import type { Product, StockoutReport } from '@/lib/shared/types';
import { cn } from '@/lib/utils';

interface StockoutReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product | null; // Pre-fill if product is known
  userId: string;
  onReported?: () => void; // Callback after successful report
}

export function StockoutReportModal({
  isOpen,
  onClose,
  product,
  userId,
  onReported,
}: StockoutReportModalProps) {
  const [productName, setProductName] = useState(product?.name || '');
  const [requestedQty, setRequestedQty] = useState('1');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Reset form when modal opens with new product
  useState(() => {
    if (isOpen) {
      setProductName(product?.name || '');
      setRequestedQty('1');
      setCustomerName('');
      setCustomerPhone('');
      setNotes('');
      setIsSuccess(false);
    }
  });

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!productName.trim()) {
      toast.error('Veuillez entrer le nom du produit');
      return;
    }

    const qty = parseInt(requestedQty, 10);
    if (isNaN(qty) || qty < 1) {
      toast.error('Quantité invalide');
      return;
    }

    setIsSubmitting(true);

    try {
      const report: StockoutReport = {
        id: generateId(),
        product_name: productName.trim(),
        product_id: product?.id,
        requested_qty: qty,
        customer_name: customerName.trim() || undefined,
        customer_phone: customerPhone.trim() || undefined,
        notes: notes.trim() || undefined,
        reported_by: userId,
        created_at: new Date(),
        synced: false,
      };

      // Save to IndexedDB
      await db.table('stockout_reports').add(report);

      // Queue for sync
      await queueTransaction('STOCKOUT_REPORT' as any, 'CREATE', report);

      // Show success state
      setIsSuccess(true);
      toast.success('Rupture de stock signalée');

      // Callback and close after brief delay
      setTimeout(() => {
        onReported?.();
        onClose();
        setIsSuccess(false);
      }, 1500);
    } catch (error) {
      console.error('Error reporting stockout:', error);
      toast.error('Erreur lors du signalement');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success state
  if (isSuccess) {
    return (
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-50 animate-in fade-in duration-200 px-4"
        onClick={onClose}
      >
        <div
          className="bg-gradient-to-br from-emerald-900 to-emerald-950 rounded-3xl p-8 text-center animate-in zoom-in duration-300 border-2 border-emerald-500/50"
          onClick={(e) => e.stopPropagation()}
          style={{ boxShadow: '0 20px 60px rgba(16, 185, 129, 0.3)' }}
        >
          <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-4 animate-in zoom-in duration-500">
            <CheckCircle2 className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-white text-xl font-bold mb-2">Rupture signalée</h3>
          <p className="text-emerald-300 text-sm">
            {productName}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-end sm:items-center justify-center z-50 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/20 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[90vh] overflow-hidden shadow-2xl animate-in slide-in-from-bottom sm:zoom-in duration-300 border-t-2 sm:border-2 border-amber-500/30"
        onClick={(e) => e.stopPropagation()}
        style={{ boxShadow: '0 -10px 60px rgba(245, 158, 11, 0.2)' }}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-r from-amber-600 to-orange-500 p-5">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-amber-200 hover:text-white w-10 h-10 rounded-lg hover:bg-amber-700/50 flex items-center justify-center transition-all"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm shadow-lg flex items-center justify-center border-2 border-white/30">
              <AlertTriangle className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-xl tracking-tight">
                Rupture de stock
              </h3>
              <p className="text-amber-100 text-sm font-medium">
                Signaler un produit manquant
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[60vh]">
          {/* Product Name */}
          <div>
            <label className="flex items-center gap-2 text-xs font-bold text-amber-400 mb-2 uppercase tracking-wider">
              <Package className="w-4 h-4" />
              Produit demandé *
            </label>
            <Input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Nom du produit"
              className="h-14 bg-slate-950 border-2 border-amber-900/50 focus:border-amber-500 rounded-xl text-base font-medium"
              autoFocus={!product}
              disabled={!!product}
            />
            {product && (
              <p className="text-xs text-slate-500 mt-1">
                Stock actuel: {product.stock} unités
              </p>
            )}
          </div>

          {/* Quantity */}
          <div>
            <label className="flex items-center gap-2 text-xs font-bold text-amber-400 mb-2 uppercase tracking-wider">
              <Hash className="w-4 h-4" />
              Quantité demandée *
            </label>
            <Input
              type="number"
              inputMode="numeric"
              value={requestedQty}
              onChange={(e) => setRequestedQty(e.target.value)}
              min={1}
              className="h-14 bg-slate-950 border-2 border-amber-900/50 focus:border-amber-500 rounded-xl text-center text-xl font-bold"
            />
          </div>

          {/* Divider */}
          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700/50" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-slate-900 px-3 text-xs text-slate-500 font-medium uppercase tracking-wider">
                Informations client (optionnel)
              </span>
            </div>
          </div>

          {/* Customer Name */}
          <div>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">
              <User className="w-4 h-4" />
              Nom du client
            </label>
            <Input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Pour le rappeler quand le produit arrive"
              className="h-12 bg-slate-950 border-2 border-slate-700 focus:border-amber-500 rounded-xl text-sm"
            />
          </div>

          {/* Customer Phone */}
          <div>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">
              <Phone className="w-4 h-4" />
              Téléphone
            </label>
            <Input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="+224 6XX XX XX XX"
              className="h-12 bg-slate-950 border-2 border-slate-700 focus:border-amber-500 rounded-xl text-sm"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">
              <FileText className="w-4 h-4" />
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contexte supplémentaire..."
              rows={2}
              className="w-full bg-slate-950 border-2 border-slate-700 focus:border-amber-500 rounded-xl text-sm p-3 resize-none focus:outline-none focus:ring-0 text-white placeholder:text-slate-600"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="p-5 pt-2 border-t border-slate-800 bg-slate-900/50 space-y-3">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !productName.trim()}
            className={cn(
              "w-full h-14 font-bold text-base rounded-xl transition-all active:scale-95",
              "bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600",
              "hover:from-amber-500 hover:via-orange-400 hover:to-amber-500",
              "shadow-lg shadow-amber-500/30 border-2 border-amber-400",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
            style={{ boxShadow: !isSubmitting && productName.trim() ? '0 6px 20px rgba(245, 158, 11, 0.4)' : undefined }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Envoi en cours...
              </>
            ) : (
              <>
                <Send className="w-5 h-5 mr-2" />
                Signaler la rupture
              </>
            )}
          </Button>

          <Button
            variant="outline"
            onClick={onClose}
            className="w-full h-12 rounded-xl border-2 border-slate-700 font-semibold text-slate-300 hover:text-white hover:border-slate-600"
          >
            Annuler
          </Button>
        </div>
      </div>
    </div>
  );
}

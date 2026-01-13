'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/client/db';
import { formatCurrency, formatDate } from '@/lib/shared/utils';
import { ArrowLeft, Filter, Banknote, Smartphone, FileText, AlertCircle, CheckCircle, Clock, ShoppingCart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useMemo } from 'react';
import type { Sale, PaymentMethod, PaymentStatus } from '@/lib/shared/types';

type FilterPaymentMethod = PaymentMethod | 'ALL';
type FilterPaymentStatus = PaymentStatus | 'ALL';

export default function SalesHistoryPage() {
  const router = useRouter();
  const [filterMethod, setFilterMethod] = useState<FilterPaymentMethod>('ALL');
  const [filterStatus, setFilterStatus] = useState<FilterPaymentStatus>('ALL');

  // Fetch all sales from IndexedDB
  const sales = useLiveQuery(() =>
    db.sales.orderBy('created_at').reverse().toArray()
  ) ?? [];

  // Calculate metrics
  const metrics = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0);
    const pendingCredits = sales.filter(s => s.payment_method === 'CREDIT' && s.payment_status !== 'PAID');
    const pendingAmount = pendingCredits.reduce((sum, sale) => sum + sale.amount_due, 0);

    const overdueCredits = pendingCredits.filter(sale => {
      if (!sale.due_date) return false;
      const dueDate = new Date(sale.due_date);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate < today;
    });
    const overdueAmount = overdueCredits.reduce((sum, sale) => sum + sale.amount_due, 0);

    return { totalSales, pendingCredits: pendingCredits.length, pendingAmount, overdueCredits: overdueCredits.length, overdueAmount };
  }, [sales]);

  // Filter sales
  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
      // Payment method filter
      if (filterMethod !== 'ALL' && sale.payment_method !== filterMethod) return false;

      // Status filter
      if (filterStatus !== 'ALL') {
        // Calculate if overdue
        const isOverdue = sale.payment_method === 'CREDIT' &&
          sale.payment_status !== 'PAID' &&
          sale.due_date &&
          new Date(sale.due_date) < new Date();

        if (filterStatus === 'OVERDUE' && !isOverdue) return false;
        if (filterStatus !== 'OVERDUE' && sale.payment_status !== filterStatus) return false;
      }

      return true;
    });
  }, [sales, filterMethod, filterStatus]);

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-gradient-to-br from-slate-900 to-slate-950 shadow-xl border-b border-slate-700">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors active:scale-95"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-2xl font-bold tracking-wide">Historique des ventes</h1>
              <p className="text-sm text-slate-400">Consulter les transactions</p>
            </div>
          </div>

          {/* Summary metrics */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-3 border border-slate-700 shadow-xl">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center ring-2 ring-blue-500/20 mb-2">
                <ShoppingCart className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-xs text-slate-400 mb-1">Total des ventes</div>
              <div className="text-base font-bold tabular-nums text-white">{formatCurrency(metrics.totalSales).replace(' GNF', '')}</div>
              <div className="text-xs text-blue-400/70 font-medium">GNF</div>
            </div>
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-3 border border-slate-700 shadow-xl">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center ring-2 ring-amber-500/20 mb-2">
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-xs text-amber-400 mb-1">Crédits en cours</div>
              <div className="text-base font-bold tabular-nums text-white">{metrics.pendingCredits}</div>
              <div className="text-xs text-amber-300/70 tabular-nums">{formatCurrency(metrics.pendingAmount)}</div>
            </div>
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-3 border border-slate-700 shadow-xl">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center ring-2 ring-red-500/20 mb-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
              </div>
              <div className="text-xs text-red-400 mb-1">En retard</div>
              <div className="text-base font-bold tabular-nums text-white">{metrics.overdueCredits}</div>
              <div className="text-xs text-red-300/70 tabular-nums">{formatCurrency(metrics.overdueAmount)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="sticky top-[168px] z-10 bg-gradient-to-br from-slate-900 to-slate-950 border-b border-slate-700 shadow-xl">
        <div className="px-4 py-3">
          {/* Payment method filter */}
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center ring-1 ring-blue-500/20">
                <Filter className="w-3 h-3 text-blue-400" />
              </div>
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Méthode de paiement</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(['ALL', 'CASH', 'ORANGE_MONEY', 'CREDIT'] as const).map((method) => (
                <button
                  key={method}
                  onClick={() => setFilterMethod(method)}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm whitespace-nowrap
                    transition-all duration-200 border
                    ${filterMethod === method
                      ? 'bg-gradient-to-br from-blue-500/20 to-blue-600/20 text-blue-300 border-blue-500/40 shadow-lg shadow-blue-500/20 scale-105 ring-2 ring-blue-500/30'
                      : 'bg-slate-800/50 text-slate-300 border-slate-700 hover:border-slate-600 hover:bg-slate-800 hover:shadow-md active:scale-95'
                    }
                  `}
                >
                  {method === 'ALL' && <Filter className="w-4 h-4" />}
                  {method === 'CASH' && <Banknote className="w-4 h-4" />}
                  {method === 'ORANGE_MONEY' && <Smartphone className="w-4 h-4" />}
                  {method === 'CREDIT' && <FileText className="w-4 h-4" />}
                  <span>
                    {method === 'ALL' && 'Tous'}
                    {method === 'CASH' && 'Espèces'}
                    {method === 'ORANGE_MONEY' && 'Orange Money'}
                    {method === 'CREDIT' && 'Crédit'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Payment status filter */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center ring-1 ring-emerald-500/20">
                <CheckCircle className="w-3 h-3 text-emerald-400" />
              </div>
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Statut de paiement</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(['ALL', 'PAID', 'PENDING', 'OVERDUE'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm whitespace-nowrap
                    transition-all duration-200 border
                    ${filterStatus === status
                      ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 text-emerald-300 border-emerald-500/40 shadow-lg shadow-emerald-500/20 scale-105 ring-2 ring-emerald-500/30'
                      : 'bg-slate-800/50 text-slate-300 border-slate-700 hover:border-slate-600 hover:bg-slate-800 hover:shadow-md active:scale-95'
                    }
                  `}
                >
                  {status === 'ALL' && <Filter className="w-4 h-4" />}
                  {status === 'PAID' && <CheckCircle className="w-4 h-4" />}
                  {status === 'PENDING' && <Clock className="w-4 h-4" />}
                  {status === 'OVERDUE' && <AlertCircle className="w-4 h-4" />}
                  <span>
                    {status === 'ALL' && 'Tous'}
                    {status === 'PAID' && 'Payé'}
                    {status === 'PENDING' && 'En attente'}
                    {status === 'OVERDUE' && 'En retard'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Sales list */}
      <div className="px-4 py-6 space-y-4 pb-24">
        {filteredSales.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-slate-800/50 flex items-center justify-center ring-2 ring-slate-700/50">
              <FileText className="w-10 h-10 text-slate-400" />
            </div>
            <p className="text-slate-300 text-lg font-semibold">Aucune vente trouvée</p>
            <p className="text-slate-400 text-sm mt-2">Essayez de modifier les filtres</p>
          </div>
        ) : (
          filteredSales.map((sale, index) => (
            <SaleCard key={sale.id} sale={sale} index={index} />
          ))
        )}
      </div>
    </div>
  );
}

// Sale card component with receipt aesthetic
function SaleCard({ sale, index }: { sale: Sale; index: number }) {
  const router = useRouter();

  // Calculate if overdue
  const isOverdue = useMemo(() => {
    if (sale.payment_method !== 'CREDIT' || sale.payment_status === 'PAID' || !sale.due_date) {
      return false;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(sale.due_date);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate < today;
  }, [sale]);

  // Determine actual status (accounting for overdue)
  const displayStatus = isOverdue ? 'OVERDUE' : sale.payment_status;

  return (
    <div
      className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-lg shadow-xl border border-slate-700 overflow-hidden cursor-pointer
        hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200
        relative"
      onClick={() => router.push(`/ventes/detail/${sale.id}`)}
      style={{
        animation: `slideInUp 0.3s ease-out ${index * 0.05}s both`,
      }}
    >
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-slate-600 to-transparent opacity-50" />

      <div className="p-4 pt-6">
        {/* Header - Date and Status */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-sm text-slate-300 mb-1 font-medium">
              {formatDate(new Date(sale.created_at))}
            </div>
            <div className="text-xs text-slate-400">
              Vente #{sale.id?.toString().padStart(4, '0')}
            </div>
          </div>

          {/* Status stamp */}
          <StatusStamp status={displayStatus} />
        </div>

        {/* Amount - Large serif numbers */}
        <div className="mb-3 py-2 border-t border-b border-dashed border-slate-700">
          <div className="text-2xl font-bold tabular-nums text-white">
            {formatCurrency(sale.total)}
          </div>
          {sale.payment_method === 'CREDIT' && sale.amount_due > 0 && (
            <div className="text-sm text-amber-400 mt-1">
              Reste à payer: <span className="font-bold tabular-nums">{formatCurrency(sale.amount_due)}</span>
            </div>
          )}
        </div>

        {/* Payment method */}
        <div className="flex items-center gap-2 mb-2">
          {sale.payment_method === 'CASH' && (
            <>
              <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center ring-1 ring-emerald-500/20">
                <Banknote className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="text-sm font-medium text-slate-300">Espèces</span>
            </>
          )}
          {sale.payment_method === 'ORANGE_MONEY' && (
            <>
              <div className="w-6 h-6 rounded-lg bg-orange-500/10 flex items-center justify-center ring-1 ring-orange-500/20">
                <Smartphone className="w-4 h-4 text-orange-400" />
              </div>
              <span className="text-sm font-medium text-slate-300">Orange Money</span>
              {sale.payment_ref && (
                <span className="text-xs text-slate-400 font-mono">#{sale.payment_ref}</span>
              )}
            </>
          )}
          {sale.payment_method === 'CREDIT' && (
            <>
              <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center ring-1 ring-blue-500/20">
                <FileText className="w-4 h-4 text-blue-400" />
              </div>
              <span className="text-sm font-medium text-slate-300">Crédit</span>
            </>
          )}
        </div>

        {/* Customer info for credit sales */}
        {sale.payment_method === 'CREDIT' && sale.customer_name && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-2 ring-1 ring-blue-500/20">
            <div className="text-sm font-medium text-blue-300">{sale.customer_name}</div>
            {sale.customer_phone && (
              <div className="text-xs text-blue-400 font-mono mt-0.5">{sale.customer_phone}</div>
            )}
            {sale.due_date && (
              <div className="text-xs text-slate-300 mt-2 flex items-center gap-2">
                <span>Échéance:</span>
                <span className="font-bold text-blue-300">{formatDate(new Date(sale.due_date))}</span>
                {isOverdue && (
                  <span className="ml-auto px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-xs font-bold ring-1 ring-red-500/30">
                    ⚠ RETARD
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Status stamp component with slate aesthetic
function StatusStamp({ status }: { status: PaymentStatus | 'OVERDUE' }) {
  const getStampStyle = () => {
    switch (status) {
      case 'PAID':
        return {
          bg: 'bg-emerald-500/10',
          border: 'border-emerald-500/30',
          ring: 'ring-2 ring-emerald-500/20',
          text: 'text-emerald-400',
          label: 'PAYÉ',
          icon: CheckCircle,
        };
      case 'PENDING':
        return {
          bg: 'bg-amber-500/10',
          border: 'border-amber-500/30',
          ring: 'ring-2 ring-amber-500/20',
          text: 'text-amber-400',
          label: 'EN ATTENTE',
          icon: Clock,
        };
      case 'OVERDUE':
        return {
          bg: 'bg-red-500/10',
          border: 'border-red-500/30',
          ring: 'ring-2 ring-red-500/20',
          text: 'text-red-400',
          label: 'EN RETARD',
          icon: AlertCircle,
        };
      case 'PARTIALLY_PAID':
        return {
          bg: 'bg-blue-500/10',
          border: 'border-blue-500/30',
          ring: 'ring-2 ring-blue-500/20',
          text: 'text-blue-400',
          label: 'PARTIEL',
          icon: Clock,
        };
      default:
        return {
          bg: 'bg-slate-500/10',
          border: 'border-slate-500/30',
          ring: 'ring-2 ring-slate-500/20',
          text: 'text-slate-400',
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
        ${style.bg} ${style.border} ${style.ring} ${style.text}
        border rounded-lg px-3 py-1.5 font-bold text-xs uppercase tracking-wider
        shadow-lg
        flex items-center gap-1.5
      `}
    >
      <Icon className="w-4 h-4" />
      {style.label}
    </div>
  );
}

// Keyframe animations
const styles = `
  @keyframes slideInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}

'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/client/db';
import { formatCurrency, formatDate } from '@/lib/shared/utils';
import { ArrowLeft, Filter, Banknote, Smartphone, FileText, AlertCircle, CheckCircle, Clock } from 'lucide-react';
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
    <div className="min-h-screen bg-[#f5f1e8] relative overflow-hidden">
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
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-[#3d2415] rounded-lg transition-colors active:scale-95"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-2xl font-serif font-bold tracking-wide">Registre des Ventes</h1>
              <p className="text-sm text-[#d4c5b0] font-serif italic">Historique comptable</p>
            </div>
          </div>

          {/* Summary metrics - Ledger header style */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-[#3d2415] rounded-lg p-3 border border-[#5a3825]">
              <div className="text-xs text-[#d4c5b0] font-serif mb-1">Total des ventes</div>
              <div className="text-lg font-bold font-serif tabular-nums">{formatCurrency(metrics.totalSales)}</div>
            </div>
            <div className="bg-[#3d2415] rounded-lg p-3 border border-[#5a3825]">
              <div className="text-xs text-amber-400 font-serif mb-1">Crédits en cours</div>
              <div className="text-lg font-bold font-serif tabular-nums">{metrics.pendingCredits}</div>
              <div className="text-xs text-amber-300/70 font-serif tabular-nums">{formatCurrency(metrics.pendingAmount)}</div>
            </div>
            <div className="bg-[#3d2415] rounded-lg p-3 border border-[#5a3825]">
              <div className="text-xs text-red-400 font-serif mb-1">En retard</div>
              <div className="text-lg font-bold font-serif tabular-nums">{metrics.overdueCredits}</div>
              <div className="text-xs text-red-300/70 font-serif tabular-nums">{formatCurrency(metrics.overdueAmount)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="sticky top-[168px] z-10 bg-[#e8e0d0] border-b-2 border-[#8b7355] shadow-md">
        <div className="px-4 py-3">
          {/* Payment method filter */}
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="w-4 h-4 text-[#5a3825]" />
              <span className="text-xs font-semibold text-[#5a3825] uppercase tracking-wide">Méthode de paiement</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(['ALL', 'CASH', 'ORANGE_MONEY', 'CREDIT'] as const).map((method) => (
                <button
                  key={method}
                  onClick={() => setFilterMethod(method)}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap
                    transition-all duration-200 border-2
                    ${filterMethod === method
                      ? 'bg-[#2c1810] text-[#f5f1e8] border-[#2c1810] shadow-lg scale-105'
                      : 'bg-white text-[#5a3825] border-[#c4b5a0] hover:border-[#8b7355] hover:shadow-md active:scale-95'
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
              <Filter className="w-4 h-4 text-[#5a3825]" />
              <span className="text-xs font-semibold text-[#5a3825] uppercase tracking-wide">Statut de paiement</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(['ALL', 'PAID', 'PENDING', 'OVERDUE'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap
                    transition-all duration-200 border-2
                    ${filterStatus === status
                      ? 'bg-[#2c1810] text-[#f5f1e8] border-[#2c1810] shadow-lg scale-105'
                      : 'bg-white text-[#5a3825] border-[#c4b5a0] hover:border-[#8b7355] hover:shadow-md active:scale-95'
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
            <FileText className="w-16 h-16 mx-auto text-[#c4b5a0] mb-4" />
            <p className="text-[#8b7355] font-serif text-lg">Aucune vente trouvée</p>
            <p className="text-[#a89a84] font-serif text-sm mt-2">Essayez de modifier les filtres</p>
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
      className="bg-white rounded-lg shadow-md border-2 border-[#d4c5b0] overflow-hidden cursor-pointer
        hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200
        relative"
      onClick={() => router.push(`/ventes/detail/${sale.id}`)}
      style={{
        animation: `slideInUp 0.3s ease-out ${index * 0.05}s both`,
      }}
    >
      {/* Perforated edge effect */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#d4c5b0] to-transparent opacity-50"
        style={{
          backgroundImage: `repeating-linear-gradient(
            90deg,
            transparent,
            transparent 10px,
            #d4c5b0 10px,
            #d4c5b0 12px
          )`
        }}
      />

      <div className="p-4 pt-6">
        {/* Header - Date and Status */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-sm font-serif text-[#8b7355] mb-1">
              {formatDate(new Date(sale.created_at))}
            </div>
            <div className="text-xs text-[#a89a84] font-serif">
              Vente #{sale.id?.toString().padStart(4, '0')}
            </div>
          </div>

          {/* Status stamp */}
          <StatusStamp status={displayStatus} />
        </div>

        {/* Amount - Large serif numbers */}
        <div className="mb-3 py-2 border-t border-b border-dashed border-[#d4c5b0]">
          <div className="text-2xl font-bold font-serif tabular-nums text-[#2c1810]">
            {formatCurrency(sale.total)}
          </div>
          {sale.payment_method === 'CREDIT' && sale.amount_due > 0 && (
            <div className="text-sm font-serif text-amber-700 mt-1">
              Reste à payer: <span className="font-bold tabular-nums">{formatCurrency(sale.amount_due)}</span>
            </div>
          )}
        </div>

        {/* Payment method */}
        <div className="flex items-center gap-2 mb-2">
          {sale.payment_method === 'CASH' && (
            <>
              <Banknote className="w-5 h-5 text-emerald-700" />
              <span className="text-sm font-medium text-[#5a3825]">Espèces</span>
            </>
          )}
          {sale.payment_method === 'ORANGE_MONEY' && (
            <>
              <Smartphone className="w-5 h-5 text-orange-600" />
              <span className="text-sm font-medium text-[#5a3825]">Orange Money</span>
              {sale.payment_ref && (
                <span className="text-xs text-[#a89a84] font-mono">#{sale.payment_ref}</span>
              )}
            </>
          )}
          {sale.payment_method === 'CREDIT' && (
            <>
              <FileText className="w-5 h-5 text-blue-700" />
              <span className="text-sm font-medium text-[#5a3825]">Crédit</span>
            </>
          )}
        </div>

        {/* Customer info for credit sales */}
        {sale.payment_method === 'CREDIT' && sale.customer_name && (
          <div className="bg-blue-50 border border-blue-200 rounded p-2 mb-2">
            <div className="text-sm font-medium text-blue-900">{sale.customer_name}</div>
            {sale.customer_phone && (
              <div className="text-xs text-blue-700 font-mono">{sale.customer_phone}</div>
            )}
            {sale.due_date && (
              <div className="text-xs text-blue-800 mt-1 font-serif">
                Échéance: <span className="font-bold">{formatDate(new Date(sale.due_date))}</span>
                {isOverdue && (
                  <span className="ml-2 text-red-700 font-bold">⚠ RETARD</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Status stamp component with ink stamp aesthetic
function StatusStamp({ status }: { status: PaymentStatus | 'OVERDUE' }) {
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
        border-3 rounded px-3 py-1.5 font-bold text-xs uppercase tracking-wider
        transform rotate-3 shadow-md
        flex items-center gap-1.5
      `}
      style={{
        fontFamily: 'serif',
        letterSpacing: '0.1em',
      }}
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

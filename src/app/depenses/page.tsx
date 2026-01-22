'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSession } from 'next-auth/react';
import {
  Plus,
  Calendar,
  Coins,
  TrendingDown,
  X,
  Trash2,
  Edit2,
  Wallet,
  AlertCircle,
  Search,
  Package,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { db } from '@/lib/client/db';
import { formatCurrency, formatDate, formatTime, generateId } from '@/lib/shared/utils';
import { queueTransaction } from '@/lib/client/sync';
import { cn } from '@/lib/client/utils';
import type { Expense, ExpenseCategory } from '@/lib/shared/types';
import { Header } from '@/components/Header';
import { Navigation } from '@/components/Navigation';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

type FilterPeriod = 'all' | 'today' | 'week' | 'month';

const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'STOCK_PURCHASE', label: 'Achat de médicaments' },
  { value: 'SUPPLIER_PAYMENT', label: 'Paiement fournisseur' },
  { value: 'RENT', label: 'Loyer' },
  { value: 'SALARY', label: 'Salaire' },
  { value: 'ELECTRICITY', label: 'Électricité' },
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'OTHER', label: 'Autre' },
];

export default function DepensesPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const { isAuthenticated, currentUser, isInactive, lastActivityAt, syncProfileFromSession } = useAuthStore();

  // Check if user is authenticated via Zustand OR via Google session + recently active
  const hasGoogleSession = sessionStatus === 'authenticated' && !!session?.user;
  const isRecentlyActive = hasGoogleSession && lastActivityAt && !isInactive();
  const isFullyAuthenticated = isAuthenticated || isRecentlyActive;

  // Use session role (source of truth) with fallback to Zustand
  const userRole = session?.user?.role || currentUser?.role;

  // Sync profile from session when available (ensures Zustand stays updated)
  useEffect(() => {
    if (sessionStatus === 'authenticated' && session?.user?.id) {
      syncProfileFromSession({
        id: session.user.id,
        name: session.user.name,
        role: session.user.role,
        image: session.user.image,
      });
    }
  }, [sessionStatus, session, syncProfileFromSession]);

  // Filter states
  const [periodFilter, setPeriodFilter] = useState<FilterPeriod>('all');
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  // Form state
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('STOCK_PURCHASE');
  const [description, setDescription] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);

  // Get expenses from IndexedDB
  const expenses = useLiveQuery(() => db.expenses.orderBy('date').reverse().toArray()) ?? [];

  // Get supplier orders for linking
  const supplierOrders = useLiveQuery(() => db.supplier_orders.toArray()) ?? [];

  useEffect(() => {
    // Wait for session to load before checking auth
    if (sessionStatus === 'loading') return;

    if (!isFullyAuthenticated) {
      router.push(`/login?callbackUrl=${encodeURIComponent('/depenses')}`);
    }
  }, [isFullyAuthenticated, sessionStatus, router]);

  // Only owners can access expenses
  useEffect(() => {
    if (isFullyAuthenticated && userRole && userRole !== 'OWNER') {
      toast.error('Accès refusé', {
        description: 'Seul le propriétaire peut gérer les dépenses',
      });
      router.push('/dashboard');
    }
  }, [isFullyAuthenticated, userRole, router]);

  // Show nothing while loading or redirecting
  if (sessionStatus === 'loading' || !isFullyAuthenticated) {
    return null;
  }

  if (userRole !== 'OWNER') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
        <Header />
        <main className="max-w-md mx-auto px-4 py-6">
          <Card className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <Wallet className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Accès restreint
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Seuls les propriétaires peuvent accéder aux dépenses.
            </p>
          </Card>
        </main>
        <Navigation />
      </div>
    );
  }

  // Enhanced filter logic with category and search
  const getFilteredExpenses = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);

    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    monthAgo.setHours(0, 0, 0, 0);

    return expenses.filter((expense) => {
      const expenseDate = new Date(expense.date);
      expenseDate.setHours(0, 0, 0, 0);

      // Period filter
      let periodMatch = true;
      switch (periodFilter) {
        case 'today':
          periodMatch = expenseDate.getTime() === today.getTime();
          break;
        case 'week':
          periodMatch = expenseDate >= weekAgo;
          break;
        case 'month':
          periodMatch = expenseDate >= monthAgo;
          break;
        default:
          periodMatch = true;
      }

      // Category filter
      const categoryMatch =
        categoryFilter === 'all' || expense.category === categoryFilter;

      // Search filter (case-insensitive)
      const searchMatch =
        searchQuery === '' ||
        expense.description.toLowerCase().includes(searchQuery.toLowerCase());

      return periodMatch && categoryMatch && searchMatch;
    });
  };

  const filteredExpenses = getFilteredExpenses();
  const totalAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  const resetForm = () => {
    setAmount('');
    setCategory('STOCK_PURCHASE');
    setDescription('');
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setSelectedExpense(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleOpenEdit = (expense: Expense) => {
    setAmount(expense.amount.toString());
    setCategory(expense.category);
    setDescription(expense.description);
    setExpenseDate(new Date(expense.date).toISOString().split('T')[0]);
    setSelectedExpense(expense);
    setShowAddModal(true);
  };

  const handleOpenDelete = (expense: Expense) => {
    setSelectedExpense(expense);
    setShowDeleteDialog(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!amount || !description || !expenseDate) {
      toast.error('Erreur', {
        description: 'Veuillez remplir tous les champs correctement',
      });
      return;
    }

    if (parseFloat(amount) <= 0) {
      toast.error('Erreur', {
        description: 'Le montant doit être supérieur à 0',
      });
      return;
    }

    if (!currentUser?.id) {
      toast.error('Erreur', {
        description: 'Utilisateur non identifié',
      });
      return;
    }

    // UUID migration: Generate ID client-side for new expenses
    const expenseId = selectedExpense?.id || generateId();

    const expenseData: Expense = {
      id: expenseId,
      amount: parseFloat(amount),
      category,
      description: description.trim(),
      date: new Date(expenseDate),
      user_id: currentUser.id,
      synced: false,
    };

    try {
      if (selectedExpense?.id) {
        // Update existing expense
        await db.expenses.update(selectedExpense.id, expenseData);
        await queueTransaction('EXPENSE', 'UPDATE', expenseData);

        toast.success('Dépense modifiée', {
          description: 'Les modifications ont été enregistrées',
        });
      } else {
        // Create new expense with client-generated ID
        await db.expenses.add(expenseData);
        await queueTransaction('EXPENSE', 'CREATE', expenseData);

        toast.success('Dépense ajoutée', {
          description: `${formatCurrency(expenseData.amount)} enregistré`,
        });
      }

      setShowAddModal(false);
      resetForm();
    } catch (error) {
      console.error('Error saving expense:', error);
      toast.error('Erreur', {
        description: "Impossible d'enregistrer la dépense",
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedExpense?.id) return;

    try {
      await db.expenses.delete(selectedExpense.id);
      await queueTransaction('EXPENSE', 'DELETE', { id: selectedExpense.id });

      toast.success('Dépense supprimée', {
        description: 'La dépense a été supprimée avec succès',
      });

      setShowDeleteDialog(false);
      setSelectedExpense(null);
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast.error('Erreur', {
        description: 'Impossible de supprimer la dépense',
      });
    }
  };

  const getCategoryLabel = (cat: ExpenseCategory) => {
    return EXPENSE_CATEGORIES.find((c) => c.value === cat)?.label || cat;
  };

  const getLinkedSupplierOrder = (expense: Expense) => {
    if (!expense.supplier_order_id) return null;
    return supplierOrders.find((order: any) => order.id === expense.supplier_order_id);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Header with Title and Add Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <TrendingDown className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-gray-900 dark:text-white text-xl font-bold">Dépenses</h1>
          </div>
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-xl active:scale-95 transition-all shadow-lg shadow-orange-600/20"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nouvelle dépense</span>
          </button>
        </div>

        {/* Filters Card */}
        <Card className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200/50 dark:border-gray-700/50">
          {/* Period Filter Pills */}
          <div className="flex gap-1.5 overflow-x-auto pb-3 mb-3 -mx-1 px-1">
            {[
              { key: 'all' as FilterPeriod, label: 'Toutes' },
              { key: 'today' as FilterPeriod, label: "Aujourd'hui" },
              { key: 'week' as FilterPeriod, label: '7 jours' },
              { key: 'month' as FilterPeriod, label: '30' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setPeriodFilter(key)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all font-medium',
                  periodFilter === key
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Category and Search Row */}
          <div className="flex gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as ExpenseCategory | 'all')}
              className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
            >
              <option value="all">Catégorie</option>
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
              />
            </div>
          </div>
        </Card>

        {/* Total Card */}
        {filteredExpenses.length > 0 && (
          <Card className="p-4 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl border-0 shadow-lg shadow-orange-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-orange-100 font-medium mb-0.5 uppercase tracking-wide">
                  Total
                </p>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(totalAmount)}
                </p>
                <p className="text-xs text-orange-200 mt-0.5">
                  {filteredExpenses.length} dépense{filteredExpenses.length > 1 ? 's' : ''}
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                <Coins className="w-5 h-5 text-white" />
              </div>
            </div>
          </Card>
        )}

        {/* Expense List */}
        <div className="space-y-2">
          {filteredExpenses.length === 0 ? (
            <Card className="p-10 text-center rounded-xl">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gray-100 dark:bg-gray-700/50 flex items-center justify-center">
                <Coins className="w-7 h-7 text-gray-400 dark:text-gray-500" />
              </div>
              <p className="text-gray-600 dark:text-gray-400 font-medium text-sm">
                Aucune dépense
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {periodFilter !== 'all' || categoryFilter !== 'all' || searchQuery
                  ? 'pour cette sélection'
                  : 'enregistrée'}
              </p>
            </Card>
          ) : (
            filteredExpenses.map((expense) => {
              const linkedOrder = getLinkedSupplierOrder(expense);
              return (
                <Card key={expense.id} className="p-3.5 rounded-xl hover:shadow-md transition-all border border-gray-100 dark:border-gray-700/50">
                  <div className="flex items-start gap-3">
                    {/* Category Icon */}
                    <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                      <Coins className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-gray-900 dark:text-white font-medium text-sm truncate">
                            {expense.description}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-[10px] font-medium rounded-full">
                              {getCategoryLabel(expense.category)}
                            </span>
                            {!expense.synced && (
                              <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-medium rounded-full">
                                Non sync
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-base font-bold text-gray-900 dark:text-white whitespace-nowrap">
                          {formatCurrency(expense.amount)}
                        </p>
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-gray-700/50">
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{formatDate(new Date(expense.date))}</span>
                          {linkedOrder && (
                            <>
                              <span className="text-gray-300 dark:text-gray-600">•</span>
                              <Package className="w-3 h-3" />
                              <span>Commande liée</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(expense)}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg transition-all active:scale-95"
                            title="Modifier"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                          </button>
                          <button
                            onClick={() => handleOpenDelete(expense)}
                            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all active:scale-95"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </main>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center sm:justify-center z-50">
          <div
            className="absolute inset-0"
            onClick={() => { setShowAddModal(false); resetForm(); }}
          />
          <Card className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-gray-900 dark:text-white font-semibold text-lg">
                {selectedExpense ? 'Modifier la dépense' : 'Nouvelle dépense'}
              </h3>
              <button
                onClick={() => { setShowAddModal(false); resetForm(); }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto max-h-[calc(85vh-130px)]">
              {/* Category */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                  Catégorie
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                  className="w-full h-11 px-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all"
                  required
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Achat de paracétamol"
                  className="w-full h-11 px-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all"
                  required
                  autoFocus
                />
              </div>

              {/* Amount and Date Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                    Montant (GNF)
                  </label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    min="0"
                    step="1"
                    className="w-full h-11 px-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                    Date
                  </label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all"
                    required
                  />
                </div>
              </div>
            </form>

            {/* Footer Buttons */}
            <div className="flex gap-2 p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
              <button
                type="button"
                onClick={() => { setShowAddModal(false); resetForm(); }}
                className="flex-1 h-10 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
              >
                Annuler
              </button>
              <button
                type="submit"
                form="expense-form"
                onClick={handleSubmit}
                className="flex-1 h-10 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium shadow-lg shadow-orange-600/20 active:scale-[0.98] transition-all"
              >
                {selectedExpense ? 'Modifier' : 'Enregistrer'}
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && selectedExpense && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div
            className="absolute inset-0"
            onClick={() => { setShowDeleteDialog(false); setSelectedExpense(null); }}
          />
          <Card className="relative w-full max-w-sm p-5 rounded-2xl shadow-2xl">
            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-3">
                <AlertCircle className="w-7 h-7 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                Supprimer la dépense ?
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {formatCurrency(selectedExpense.amount)} sera supprimé définitivement.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setShowDeleteDialog(false); setSelectedExpense(null); }}
                className="flex-1 h-10 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium shadow-lg shadow-red-600/20 active:scale-[0.98] transition-all"
              >
                Supprimer
              </button>
            </div>
          </Card>
        </div>
      )}

      <Navigation />
    </div>
  );
}

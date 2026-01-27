'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
  Receipt,
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
import { ExpenseListSkeleton } from '@/components/ui/Skeleton';
import { toast } from 'sonner';

type FilterTab = 'all' | 'today' | 'week' | 'month';

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
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
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
      <div className="min-h-screen bg-slate-950 pb-24">
        <Header />
        <main className="max-w-md mx-auto px-4 py-6">
          <div className="bg-slate-900 rounded-xl p-8 text-center border border-slate-700">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <Wallet className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Accès restreint
            </h2>
            <p className="text-slate-400">
              Seuls les propriétaires peuvent accéder aux dépenses.
            </p>
          </div>
        </main>
        <Navigation />
      </div>
    );
  }

  // Calculate summary statistics
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const todayExpenses = expenses.filter((e) => {
      const expDate = new Date(e.date);
      expDate.setHours(0, 0, 0, 0);
      return expDate.getTime() === today.getTime();
    });

    const weekExpenses = expenses.filter((e) => {
      const expDate = new Date(e.date);
      expDate.setHours(0, 0, 0, 0);
      return expDate >= weekAgo;
    });

    const monthExpenses = expenses.filter((e) => {
      const expDate = new Date(e.date);
      expDate.setHours(0, 0, 0, 0);
      return expDate >= monthStart;
    });

    return {
      todayTotal: todayExpenses.reduce((sum, e) => sum + e.amount, 0),
      todayCount: todayExpenses.length,
      weekTotal: weekExpenses.reduce((sum, e) => sum + e.amount, 0),
      weekCount: weekExpenses.length,
      monthTotal: monthExpenses.reduce((sum, e) => sum + e.amount, 0),
      monthCount: monthExpenses.length,
      totalCount: expenses.length,
    };
  }, [expenses]);

  // Enhanced filter logic with category and search
  const filteredExpenses = useMemo(() => {
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

      // Period filter based on active tab
      let periodMatch = true;
      switch (activeTab) {
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
  }, [expenses, activeTab, categoryFilter, searchQuery]);

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

  // Loading state
  if (!expenses) {
    return (
      <div className="min-h-screen bg-slate-950 pb-24">
        <Header />
        <main className="max-w-md mx-auto px-4 py-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
              <Coins className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-white text-xl font-bold">Dépenses</h1>
          </div>
          <ExpenseListSkeleton count={5} />
        </main>
        <Navigation />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 pb-24">
      <Header />

      <main className="max-w-md mx-auto px-4 py-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Coins className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white text-xl font-bold">Dépenses</h1>
            <p className="text-slate-400 text-sm">{stats.totalCount} dépense{stats.totalCount !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          {/* Today */}
          <div className="bg-slate-900 rounded-xl p-3 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <Calendar className="w-3.5 h-3.5 text-orange-400" />
              </div>
            </div>
            <p className="text-white font-bold text-sm">{formatCurrency(stats.todayTotal)}</p>
            <p className="text-slate-500 text-xs">Aujourd&apos;hui</p>
          </div>

          {/* This Week */}
          <div className="bg-slate-900 rounded-xl p-3 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <TrendingDown className="w-3.5 h-3.5 text-amber-400" />
              </div>
            </div>
            <p className="text-white font-bold text-sm">{formatCurrency(stats.weekTotal)}</p>
            <p className="text-slate-500 text-xs">Cette semaine</p>
          </div>

          {/* This Month */}
          <div className="bg-slate-900 rounded-xl p-3 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-red-500/20 flex items-center justify-center">
                <Receipt className="w-3.5 h-3.5 text-red-400" />
              </div>
            </div>
            <p className="text-white font-bold text-sm">{formatCurrency(stats.monthTotal)}</p>
            <p className="text-slate-500 text-xs">Ce mois</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            { key: 'all' as FilterTab, label: 'Toutes', count: stats.totalCount },
            { key: 'today' as FilterTab, label: "Aujourd'hui", count: stats.todayCount },
            { key: 'week' as FilterTab, label: '7 jours', count: stats.weekCount },
            { key: 'month' as FilterTab, label: 'Ce mois', count: stats.monthCount },
          ].map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              aria-pressed={activeTab === key}
              className={cn(
                'px-4 py-2 min-h-12 rounded-full text-sm font-medium whitespace-nowrap transition-all active:scale-95',
                activeTab === key
                  ? 'bg-orange-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              )}
            >
              {label}
              {count > 0 && (
                <span className={cn(
                  'ml-1.5 px-1.5 py-0.5 rounded-full text-xs',
                  activeTab === key ? 'bg-orange-500' : 'bg-slate-700'
                )}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search and Category Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as ExpenseCategory | 'all')}
            className="px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
          >
            <option value="all">Toutes</option>
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* Expense List */}
        <div className="space-y-3">
          {filteredExpenses.length === 0 ? (
            <div className="bg-slate-900 rounded-xl p-8 border border-slate-700 text-center">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-800 flex items-center justify-center">
                <Coins className="w-7 h-7 text-slate-600" />
              </div>
              <p className="text-slate-400 font-medium">Aucune dépense</p>
              <p className="text-slate-600 text-sm mt-1">
                {activeTab !== 'all' || categoryFilter !== 'all' || searchQuery
                  ? 'pour cette sélection'
                  : 'enregistrée'}
              </p>
            </div>
          ) : (
            filteredExpenses.map((expense) => {
              const linkedOrder = getLinkedSupplierOrder(expense);
              return (
                <div
                  key={expense.id}
                  className="bg-slate-900 rounded-xl p-4 border border-slate-700 hover:border-slate-600 transition-all"
                >
                  <div className="flex items-start gap-3">
                    {/* Category Icon */}
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/20 flex items-center justify-center shrink-0">
                      <Coins className="w-6 h-6 text-orange-400" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-white font-medium truncate">
                            {expense.description}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs font-medium rounded-full">
                              {getCategoryLabel(expense.category)}
                            </span>
                            {!expense.synced && (
                              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs font-medium rounded-full">
                                Non sync
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-lg font-bold text-white whitespace-nowrap">
                          {formatCurrency(expense.amount)}
                        </p>
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700">
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{formatDate(new Date(expense.date))}</span>
                          {linkedOrder && (
                            <>
                              <span className="text-slate-600">•</span>
                              <Package className="w-3 h-3" />
                              <span>Commande liée</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(expense)}
                            className="p-2 hover:bg-slate-800 rounded-lg transition-all active:scale-95"
                            title="Modifier"
                          >
                            <Edit2 className="w-4 h-4 text-slate-400" />
                          </button>
                          <button
                            onClick={() => handleOpenDelete(expense)}
                            className="p-2 hover:bg-red-500/20 rounded-lg transition-all active:scale-95"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Floating Action Button */}
      <button
        onClick={handleOpenAdd}
        aria-label="Ajouter une dépense"
        className="fixed bottom-24 right-4 w-14 h-14 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full shadow-lg shadow-orange-500/30 flex items-center justify-center hover:from-orange-600 hover:to-orange-700 active:scale-95 transition-all z-30"
      >
        <Plus className="w-6 h-6 text-white" />
      </button>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center sm:justify-center z-50">
          <div
            className="absolute inset-0"
            onClick={() => { setShowAddModal(false); resetForm(); }}
          />
          <div className="relative w-full max-w-md bg-slate-900 rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-hidden shadow-2xl border border-slate-700">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="text-white font-semibold text-lg">
                {selectedExpense ? 'Modifier la dépense' : 'Nouvelle dépense'}
              </h3>
              <button
                onClick={() => { setShowAddModal(false); resetForm(); }}
                className="text-slate-400 hover:text-white w-8 h-8 rounded-full hover:bg-slate-800 flex items-center justify-center transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form id="expense-form" onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto max-h-[calc(85vh-130px)]">
              {/* Category */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                  Catégorie
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-700 bg-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
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
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Achat de paracétamol"
                  className="w-full h-11 px-3 rounded-xl border border-slate-700 bg-slate-800 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                  required
                  autoFocus
                />
              </div>

              {/* Amount and Date Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                    Montant (GNF)
                  </label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    min="0"
                    step="1"
                    className="w-full h-11 px-3 rounded-xl border border-slate-700 bg-slate-800 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                    Date
                  </label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-700 bg-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                    required
                  />
                </div>
              </div>
            </form>

            {/* Footer Buttons */}
            <div className="flex gap-2 p-4 border-t border-slate-700 bg-slate-900/50">
              <button
                type="button"
                onClick={() => { setShowAddModal(false); resetForm(); }}
                className="flex-1 h-10 rounded-xl border border-slate-600 text-slate-300 text-sm font-medium hover:bg-slate-800 transition-all"
              >
                Annuler
              </button>
              <button
                type="submit"
                form="expense-form"
                className="flex-1 h-10 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium shadow-lg shadow-orange-600/20 active:scale-[0.98] transition-all"
              >
                {selectedExpense ? 'Modifier' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && selectedExpense && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div
            className="absolute inset-0"
            onClick={() => { setShowDeleteDialog(false); setSelectedExpense(null); }}
          />
          <div className="relative w-full max-w-sm p-5 bg-slate-900 rounded-2xl shadow-2xl border border-slate-700">
            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-14 h-14 rounded-2xl bg-red-500/20 flex items-center justify-center mb-3">
                <AlertCircle className="w-7 h-7 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">
                Supprimer la dépense ?
              </h3>
              <p className="text-sm text-slate-400">
                {formatCurrency(selectedExpense.amount)} sera supprimé définitivement.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setShowDeleteDialog(false); setSelectedExpense(null); }}
                className="flex-1 h-10 rounded-xl border border-slate-600 text-slate-300 text-sm font-medium hover:bg-slate-800 transition-all"
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
          </div>
        </div>
      )}

      <Navigation />
    </div>
  );
}

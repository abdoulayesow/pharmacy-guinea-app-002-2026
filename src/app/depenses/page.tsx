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
import { formatCurrency, formatDate, formatTime } from '@/lib/shared/utils';
import { queueTransaction } from '@/lib/client/sync';
import { cn } from '@/lib/client/utils';
import type { Expense, ExpenseCategory } from '@/lib/shared/types';
import { Header } from '@/components/Header';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  const { isAuthenticated, currentUser, isInactive, lastActivityAt } = useAuthStore();

  // Check if user is authenticated via Zustand OR via Google session + recently active
  const hasGoogleSession = sessionStatus === 'authenticated' && !!session?.user;
  const isRecentlyActive = hasGoogleSession && lastActivityAt && !isInactive();
  const isFullyAuthenticated = isAuthenticated || isRecentlyActive;

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
    if (isFullyAuthenticated && currentUser?.role !== 'OWNER') {
      toast.error('Accès refusé', {
        description: 'Seul le propriétaire peut gérer les dépenses',
      });
      router.push('/dashboard');
    }
  }, [isFullyAuthenticated, currentUser, router]);

  // Show nothing while loading or redirecting
  if (sessionStatus === 'loading' || !isFullyAuthenticated) {
    return null;
  }

  if (currentUser?.role !== 'OWNER') {
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

    const expenseData: Expense = {
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
        await queueTransaction('EXPENSE', 'UPDATE', { ...expenseData, id: selectedExpense.id });

        toast.success('Dépense modifiée', {
          description: 'Les modifications ont été enregistrées',
        });
      } else {
        // Create new expense
        const id = await db.expenses.add(expenseData);
        await queueTransaction('EXPENSE', 'CREATE', { ...expenseData, id });

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
        {/* Header Card */}
        <Card className="p-5 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-orange-600 flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-gray-900 dark:text-white text-xl font-semibold">Dépenses</h2>
            </div>
            <Button
              onClick={handleOpenAdd}
              className="bg-orange-600 hover:bg-orange-700 text-white rounded-md active:scale-95 transition-all h-11"
            >
              <Plus className="w-5 h-5 mr-2" />
              Nouvelle dépense
            </Button>
          </div>

          {/* Period Filter Buttons */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
            {[
              { key: 'all' as FilterPeriod, label: 'Toutes' },
              { key: 'today' as FilterPeriod, label: "Aujourd'hui" },
              { key: 'week' as FilterPeriod, label: '7 jours' },
              { key: 'month' as FilterPeriod, label: '30 jours' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setPeriodFilter(key)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-all font-medium',
                  periodFilter === key
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Category Filter Dropdown */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Catégorie
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as ExpenseCategory | 'all')}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 transition-all"
            >
              <option value="all">Toutes les catégories</option>
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Rechercher une dépense..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </Card>

        {/* Total Card */}
        {filteredExpenses.length > 0 && (
          <Card className="p-5 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-700 dark:text-orange-400 font-medium mb-2">
                  Total des dépenses
                </p>
                <p className="text-3xl font-bold text-orange-900 dark:text-orange-300">
                  {formatCurrency(totalAmount)}
                </p>
                <p className="text-xs text-orange-600 dark:text-orange-500 mt-1">
                  {filteredExpenses.length} dépense{filteredExpenses.length > 1 ? 's' : ''}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-orange-600 flex items-center justify-center">
                <Coins className="w-6 h-6 text-white" />
              </div>
            </div>
          </Card>
        )}

        {/* Expense List */}
        <div className="space-y-3">
          {filteredExpenses.length === 0 ? (
            <Card className="p-12 text-center rounded-lg">
              <Coins className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400 font-medium mb-1">
                Aucune dépense
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                {periodFilter !== 'all' || categoryFilter !== 'all' || searchQuery
                  ? 'pour cette sélection'
                  : 'enregistrée'}
              </p>
            </Card>
          ) : (
            filteredExpenses.map((expense) => {
              const linkedOrder = getLinkedSupplierOrder(expense);
              return (
                <Card key={expense.id} className="p-5 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="text-gray-900 dark:text-white font-semibold mb-2">
                        {expense.description}
                      </div>
                      <div className="inline-block px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs font-medium rounded-lg">
                        {getCategoryLabel(expense.category)}
                      </div>
                      {linkedOrder && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                          <Package className="w-3 h-3" />
                          <span>Commande fournisseur liée</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        {formatCurrency(expense.amount)}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenEdit(expense)}
                          className="p-2 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-all active:scale-95"
                          title="Modifier"
                        >
                          <Edit2 className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                        </button>
                        <button
                          onClick={() => handleOpenDelete(expense)}
                          className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all active:scale-95"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 pt-3 border-t border-gray-200 dark:border-gray-700 font-medium">
                    <Calendar className="w-4 h-4" />
                    <span>{formatDate(new Date(expense.date))}</span>
                    <span>•</span>
                    <span>{formatTime(new Date(expense.date))}</span>
                    {!expense.synced && (
                      <>
                        <span>•</span>
                        <span className="text-amber-600 dark:text-amber-500">En attente de sync</span>
                      </>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </main>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center sm:justify-center z-50 p-4">
          <Card className="w-full max-w-md bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-gray-900 dark:text-white font-bold text-xl">
                  {selectedExpense ? 'Modifier la dépense' : 'Nouvelle dépense'}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {selectedExpense ? 'Mettez à jour les informations' : 'Ajoutez une nouvelle dépense'}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 w-10 h-10 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Category */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Catégorie *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                  className="w-full h-12 px-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 transition-all"
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
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Description *
                </label>
                <Input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Achat de paracétamol chez Pharma Guinée"
                  className="h-12"
                  required
                  autoFocus
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Montant (GNF) *
                </label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="1"
                  className="h-12"
                  required
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Date *
                </label>
                <Input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="h-12"
                  required
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
                  className="flex-1 h-12 rounded-lg"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-12 rounded-lg bg-orange-600 hover:bg-orange-700 text-white"
                >
                  {selectedExpense ? 'Modifier' : 'Enregistrer'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && selectedExpense && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Supprimer la dépense ?
              </h3>
            </div>

            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Êtes-vous sûr de vouloir supprimer cette dépense de{' '}
              <strong className="text-gray-900 dark:text-white">{formatCurrency(selectedExpense.amount)}</strong> ?
              Cette action est irréversible.
            </p>

            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setShowDeleteDialog(false);
                  setSelectedExpense(null);
                }}
                variant="outline"
                className="flex-1 h-12"
              >
                Annuler
              </Button>
              <Button
                onClick={handleDelete}
                className="flex-1 h-12 bg-red-600 hover:bg-red-700 text-white"
              >
                Supprimer
              </Button>
            </div>
          </Card>
        </div>
      )}

      <Navigation />
    </div>
  );
}

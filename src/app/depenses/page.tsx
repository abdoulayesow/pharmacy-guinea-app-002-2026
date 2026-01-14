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
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { db } from '@/lib/client/db';
import { formatCurrency } from '@/lib/shared/utils';
import type { Expense, ExpenseCategory } from '@/lib/shared/types';
import { Header } from '@/components/Header';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

type FilterPeriod = 'all' | 'today' | 'week' | 'month';

const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'STOCK_PURCHASE', label: 'Achat de médicaments' },
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

  const [filter, setFilter] = useState<FilterPeriod>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Form state
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('STOCK_PURCHASE');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Get expenses from IndexedDB
  const expenses = useLiveQuery(() => db.expenses.orderBy('date').reverse().toArray()) ?? [];

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

  // Filter logic
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  weekAgo.setHours(0, 0, 0, 0);

  const monthAgo = new Date();
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  monthAgo.setHours(0, 0, 0, 0);

  const filteredExpenses = expenses.filter((expense) => {
    const expenseDate = new Date(expense.date);
    expenseDate.setHours(0, 0, 0, 0);

    switch (filter) {
      case 'today':
        return expenseDate.getTime() === today.getTime();
      case 'week':
        return expenseDate >= weekAgo;
      case 'month':
        return expenseDate >= monthAgo;
      default:
        return true;
    }
  });

  const total = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  const resetForm = () => {
    setAmount('');
    setCategory('STOCK_PURCHASE');
    setDescription('');
    setDate(new Date().toISOString().split('T')[0]);
    setEditingExpense(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleOpenEdit = (expense: Expense) => {
    setAmount(expense.amount.toString());
    setCategory(expense.category);
    setDescription(expense.description);
    setDate(new Date(expense.date).toISOString().split('T')[0]);
    setEditingExpense(expense);
    setShowAddModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!amount || !description || !date) {
      alert('Veuillez remplir tous les champs');
      return;
    }

    const expenseData = {
      amount: parseFloat(amount),
      category,
      description,
      date: new Date(date),
      synced: false,
    };

    try {
      if (editingExpense) {
        // Update existing expense
        await db.expenses.update(editingExpense.id!, expenseData);

        // Add to sync queue
        await db.sync_queue.add({
          type: 'EXPENSE',
          action: 'UPDATE',
          payload: { ...expenseData, id: editingExpense.id },
          localId: editingExpense.id!,
          createdAt: new Date(),
          status: 'PENDING',
          retryCount: 0,
        });
      } else {
        // Create new expense
        const id = await db.expenses.add({
          ...expenseData,
          user_id: currentUser.id,
        });

        // Add to sync queue
        await db.sync_queue.add({
          type: 'EXPENSE',
          action: 'CREATE',
          payload: { ...expenseData, id, user_id: currentUser.id },
          localId: id as number,
          createdAt: new Date(),
          status: 'PENDING',
          retryCount: 0,
        });
      }

      setShowAddModal(false);
      resetForm();
    } catch (error) {
      console.error('Error saving expense:', error);
      alert("Erreur lors de l'enregistrement");
    }
  };

  const handleDelete = async (expense: Expense) => {
    if (!confirm('Supprimer cette dépense ?')) return;

    try {
      await db.expenses.delete(expense.id!);

      // Add to sync queue
      await db.sync_queue.add({
        type: 'EXPENSE',
        action: 'DELETE',
        payload: { id: expense.id },
        localId: expense.id!,
        createdAt: new Date(),
        status: 'PENDING',
        retryCount: 0,
      });
    } catch (error) {
      console.error('Error deleting expense:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const getCategoryLabel = (cat: ExpenseCategory) => {
    return EXPENSE_CATEGORIES.find((c) => c.value === cat)?.label || cat;
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('fr-GN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
      <Header />

      <main className="max-w-md mx-auto px-4 py-6 space-y-4">
        {/* Header Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gray-700 dark:bg-gray-600 flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-gray-900 dark:text-white text-xl font-semibold">Dépenses</h2>
            </div>
            <Button
              onClick={handleOpenAdd}
              className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white rounded-md active:scale-95 transition-all h-11"
            >
              <Plus className="w-5 h-5" />
              Nouvelle dépense
            </Button>
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {[
              { key: 'all' as FilterPeriod, label: 'Toutes' },
              { key: 'today' as FilterPeriod, label: "Aujourd'hui" },
              { key: 'week' as FilterPeriod, label: '7 jours' },
              { key: 'month' as FilterPeriod, label: '30 jours' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-all font-medium ${
                  filter === key
                    ? 'bg-gray-700 dark:bg-gray-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Total Card */}
        {filteredExpenses.length > 0 && (
          <Card className="p-5 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium mb-2">Total des dépenses</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{formatCurrency(total)}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-gray-700 dark:bg-gray-600 flex items-center justify-center">
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
              <p className="text-gray-500 dark:text-gray-400 font-medium mb-1">Aucune dépense</p>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                {filter !== 'all' ? 'pour cette période' : 'enregistrée'}
              </p>
            </Card>
          ) : (
            filteredExpenses.map((expense) => (
              <Card key={expense.id} className="p-5 rounded-lg shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="text-gray-900 dark:text-white font-semibold mb-1">{expense.description}</div>
                    <div className="inline-block px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-lg">
                      {getCategoryLabel(expense.category)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(expense.amount)}</div>
                    {!expense.synced && (
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-medium">En attente</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 font-medium">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {new Date(expense.date).toLocaleDateString('fr-GN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })}
                    </span>
                    <span>•</span>
                    <span>{formatTime(expense.date)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEdit(expense)}
                      className="h-10 w-10 rounded-lg flex items-center justify-center text-gray-600 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all active:scale-95"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(expense)}
                      className="h-10 w-10 rounded-lg flex items-center justify-center text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all active:scale-95"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </main>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white dark:bg-gray-800 rounded-t-2xl w-full p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-gray-900 dark:text-white font-bold text-xl">
                  {editingExpense ? 'Modifier la dépense' : 'Nouvelle dépense'}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {editingExpense ? 'Mettez à jour les informations' : 'Ajoutez une nouvelle dépense'}
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
                  className="w-full h-12 px-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-emerald-500 dark:focus:border-emerald-400 transition-all"
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
                  className="h-12"
                  required
                />
              </div>

              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-300">
                Cette dépense sera enregistrée avec la date et l'heure actuelles.
              </div>

              {/* Submit Button */}
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
                  className="flex-1 h-12 rounded-lg bg-emerald-600 hover:bg-emerald-700"
                >
                  {editingExpense ? 'Modifier' : 'Enregistrer la dépense'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Navigation />
    </div>
  );
}

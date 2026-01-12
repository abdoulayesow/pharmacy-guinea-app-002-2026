'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Plus,
  Calendar,
  DollarSign,
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
import { cn } from '@/lib/utils';

type FilterPeriod = 'all' | 'today' | 'week' | 'month';

const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'STOCK_PURCHASE', label: 'Achat de stock' },
  { value: 'RENT', label: 'Loyer' },
  { value: 'SALARY', label: 'Salaire' },
  { value: 'ELECTRICITY', label: 'Électricité' },
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'OTHER', label: 'Autre' },
];

export default function DepensesPage() {
  const router = useRouter();
  const { isAuthenticated, currentUser } = useAuthStore();

  const [filter, setFilter] = useState<FilterPeriod>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Form state
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('OTHER');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Get expenses from IndexedDB
  const expenses = useLiveQuery(() => db.expenses.orderBy('date').reverse().toArray()) ?? [];

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  // Only owners can access expenses
  useEffect(() => {
    if (isAuthenticated && currentUser?.role !== 'OWNER') {
      router.push('/dashboard');
    }
  }, [isAuthenticated, currentUser, router]);

  if (!isAuthenticated) {
    return null;
  }

  if (currentUser?.role !== 'OWNER') {
    return (
      <div className="min-h-screen bg-slate-800 pb-24">
        <Header />
        <main className="max-w-md mx-auto px-4 py-6">
          <Card className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <Wallet className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Accès restreint
            </h2>
            <p className="text-slate-400">
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
    setCategory('OTHER');
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
      alert('Erreur lors de l\'enregistrement');
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

  return (
    <div className="min-h-screen bg-slate-800 pb-24">
      <Header />

      <main className="max-w-md mx-auto px-4 py-6 space-y-5">
        {/* Header Card */}
        <div className="bg-slate-900 rounded-xl p-6 shadow-md border border-slate-700 transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-md shadow-orange-500/30 flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-white text-xl font-bold tracking-tight">Dépenses</h2>
            </div>
            <Button
              onClick={handleOpenAdd}
              className="bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white rounded-xl active:scale-95 transition-all h-11 px-5 shadow-md shadow-orange-500/30 font-semibold"
            >
              <Plus className="w-5 h-5 mr-1.5" />
              Nouvelle
            </Button>
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {[
              { key: 'all' as FilterPeriod, label: 'Toutes' },
              { key: 'today' as FilterPeriod, label: "Aujourd'hui" },
              { key: 'week' as FilterPeriod, label: '7 jours' },
              { key: 'month' as FilterPeriod, label: '30 jours' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={cn(
                  'px-4 py-2.5 rounded-xl text-sm whitespace-nowrap transition-all font-semibold min-h-[44px]',
                  filter === key
                    ? 'bg-gradient-to-r from-orange-600 to-orange-500 text-white shadow-md shadow-orange-500/30 scale-105'
                    : 'bg-gray-100 dark:bg-gray-700 text-slate-300 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 active:scale-95'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Total Card */}
        {filteredExpenses.length > 0 && (
          <Card className="p-6 bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-900/20 dark:to-orange-900/10 border-orange-200 dark:border-orange-800 rounded-xl shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-orange-700/80 dark:text-orange-300/80 font-semibold mb-1">
                  Total des dépenses
                </p>
                <p className="text-3xl font-extrabold text-orange-900 dark:text-orange-100 tracking-tight">
                  {formatCurrency(total)}
                </p>
              </div>
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg shadow-orange-500/40 flex items-center justify-center">
                <DollarSign className="w-7 h-7 text-white" />
              </div>
            </div>
          </Card>
        )}

        {/* Expense List */}
        <div className="space-y-3">
          {filteredExpenses.length === 0 ? (
            <Card className="p-16 text-center rounded-xl bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 border-2 border-dashed border-slate-700">
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/20 dark:to-orange-900/10 flex items-center justify-center">
                <DollarSign className="w-10 h-10 text-orange-400 dark:text-orange-500" />
              </div>
              <p className="text-slate-300 font-semibold mb-1 text-lg">Aucune dépense</p>
              <p className="text-sm text-slate-400">
                {filter !== 'all' ? 'pour cette période' : 'enregistrée'}
              </p>
            </Card>
          ) : (
            filteredExpenses.map((expense) => (
              <Card key={expense.id} className="p-5 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100 dark:border-gray-700">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="text-white font-semibold mb-2 text-base leading-tight">
                      {expense.description}
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-900/20 text-orange-700 dark:text-orange-300 text-xs font-semibold rounded-full border border-orange-200/50 dark:border-orange-700/50">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                      {getCategoryLabel(expense.category)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-extrabold text-orange-600 dark:text-orange-400 tracking-tight">
                      {formatCurrency(expense.amount)}
                    </div>
                    {!expense.synced && (
                      <div className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">
                        En attente
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-700">
                  <div className="flex items-center gap-2 text-sm text-slate-400 font-medium">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {new Date(expense.date).toLocaleDateString('fr-GN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEdit(expense)}
                      className="h-10 w-10 rounded-xl flex items-center justify-center text-gray-600 hover:text-orange-600 dark:text-gray-400 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all active:scale-95 border border-transparent hover:border-orange-200 dark:hover:border-orange-700"
                    >
                      <Edit2 className="w-4.5 h-4.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(expense)}
                      className="h-10 w-10 rounded-xl flex items-center justify-center text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all active:scale-95 border border-transparent hover:border-red-200 dark:hover:border-red-700"
                    >
                      <Trash2 className="w-4.5 h-4.5" />
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-end z-50 animate-in fade-in duration-200">
          <div className="bg-slate-900 rounded-t-3xl w-full p-6 max-h-[85vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-white font-bold text-xl tracking-tight">
                  {editingExpense ? 'Modifier la dépense' : 'Nouvelle dépense'}
                </h3>
                <p className="text-sm text-slate-400 mt-0.5">
                  {editingExpense ? 'Mettez à jour les informations' : 'Ajoutez une nouvelle dépense'}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
                className="text-slate-400 hover:text-slate-300 w-11 h-11 rounded-xl hover:bg-slate-700 flex items-center justify-center transition-all active:scale-90 shrink-0"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Amount */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2.5">
                  Montant (GNF)
                </label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="15000"
                  className="h-14 text-base rounded-xl border-2 focus:border-orange-500 dark:focus:border-orange-400 transition-all"
                  required
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2.5">
                  Catégorie
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                  className="w-full h-14 px-4 rounded-xl border-2 border-slate-700 bg-slate-900 text-white focus:border-orange-500 dark:focus:border-orange-400 transition-all font-medium"
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
                <label className="block text-sm font-semibold text-slate-300 mb-2.5">
                  Description
                </label>
                <Input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Achat de médicaments"
                  className="h-14 text-base rounded-xl border-2 focus:border-orange-500 dark:focus:border-orange-400 transition-all"
                  required
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2.5">
                  Date
                </label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-14 text-base rounded-xl border-2 focus:border-orange-500 dark:focus:border-orange-400 transition-all"
                  required
                />
              </div>

              {/* Submit Button */}
              <div className="flex gap-3 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
                  className="flex-1 h-14 rounded-xl border-2 font-semibold text-base active:scale-95 transition-all"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-14 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 shadow-lg shadow-orange-500/30 font-semibold text-base active:scale-95 transition-all"
                >
                  {editingExpense ? 'Modifier' : 'Enregistrer'}
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

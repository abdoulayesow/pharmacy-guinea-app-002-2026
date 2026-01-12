import { useState } from 'react';
import { useApp } from '../lib/context';
import { formatCurrency, formatDate, formatTime } from '../lib/utils';
import { Plus, Calendar, Coins, TrendingDown } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';

export function ExpenseList({ onAddExpense }: { onAddExpense: () => void }) {
  const { expenses } = useApp();
  const [filter, setFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  weekAgo.setHours(0, 0, 0, 0);

  const monthAgo = new Date();
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  monthAgo.setHours(0, 0, 0, 0);

  const filteredExpenses = expenses.filter(expense => {
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

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors duration-300">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gray-700 dark:bg-gray-600 flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-gray-900 dark:text-white text-xl font-semibold">Dépenses</h2>
          </div>
          <Button
            onClick={onAddExpense}
            className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white rounded-md active:scale-95 transition-all h-11"
          >
            <Plus className="w-5 h-5" />
            Nouvelle dépense
          </Button>
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { key: 'all', label: 'Toutes' },
            { key: 'today', label: 'Aujourd\'hui' },
            { key: 'week', label: '7 jours' },
            { key: 'month', label: '30 jours' }
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key as any)}
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
          filteredExpenses.map(expense => (
            <Card key={expense.id} className="p-5 rounded-lg shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="text-gray-900 dark:text-white font-semibold mb-1">{expense.description}</div>
                  <div className="inline-block px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-lg">
                    {expense.category}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(expense.amount)}</div>
                  {!expense.synced && (
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-medium">En attente</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 pt-3 border-t border-gray-200 dark:border-gray-700 font-medium">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(new Date(expense.date))}</span>
                <span>•</span>
                <span>{formatTime(new Date(expense.date))}</span>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
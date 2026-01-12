import { useState } from 'react';
import { useApp } from '../lib/context';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card } from './ui/card';
import { ArrowLeft, Save, Coins } from 'lucide-react';

const EXPENSE_CATEGORIES = [
  'Achat de médicaments',
  'Fournitures',
  'Salaires',
  'Loyer',
  'Électricité',
  'Eau',
  'Transport',
  'Maintenance',
  'Autre'
];

export function ExpenseForm({ onBack }: { onBack: () => void }) {
  const { addExpense } = useApp();
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: EXPENSE_CATEGORIES[0]
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    addExpense({
      description: formData.description,
      amount: parseFloat(formData.amount),
      category: formData.category
    });
    
    onBack();
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors duration-300">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack} 
            className="w-11 h-11 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:border-emerald-500 dark:hover:border-emerald-400 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all active:scale-90"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h2 className="text-gray-900 dark:text-white text-xl font-semibold">Nouvelle dépense</h2>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card className="p-5 rounded-lg shadow-sm">
          <div className="space-y-4">
            <div>
              <Label htmlFor="category" className="text-gray-700 dark:text-gray-300 font-medium mb-2 block">Catégorie *</Label>
              <select
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full h-12 px-4 rounded-lg border border-gray-200 dark:border-gray-600 focus:border-emerald-500 dark:focus:border-emerald-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-medium outline-none transition-colors"
                required
              >
                {EXPENSE_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="description" className="text-gray-700 dark:text-gray-300 font-medium mb-2 block">Description *</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ex: Achat de paracétamol chez Pharma Guinée"
                required
                className="h-12 border border-gray-200 dark:border-gray-600 focus:border-emerald-500 dark:focus:border-emerald-400 rounded-lg"
              />
            </div>

            <div>
              <Label htmlFor="amount" className="text-gray-700 dark:text-gray-300 font-medium mb-2 block">Montant (GNF) *</Label>
              <div className="relative">
                <Coins className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400 dark:text-gray-500" />
                <Input
                  id="amount"
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0"
                  required
                  min="0"
                  step="1"
                  className="pl-14 h-14 border border-gray-200 dark:border-gray-600 focus:border-emerald-500 dark:focus:border-emerald-400 rounded-lg text-xl font-bold"
                />
              </div>
            </div>
          </div>
        </Card>

        <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-5">
          <p className="text-sm text-gray-700 dark:text-gray-300 font-medium flex items-center gap-2">
            Cette dépense sera enregistrée avec la date et l'heure actuelles.
          </p>
        </div>

        <Button
          type="submit"
          className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-semibold rounded-md shadow-lg active:scale-95 transition-all"
        >
          <Save className="w-5 h-5 mr-2" />
          Enregistrer la dépense
        </Button>
      </form>
    </div>
  );
}
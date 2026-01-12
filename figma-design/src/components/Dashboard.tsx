import { useApp } from '../lib/context';
import { formatCurrency, formatDate } from '../lib/utils';
import { TrendingUp, TrendingDown, Package, AlertTriangle, ShoppingCart, Banknote, Activity, Clock } from 'lucide-react';
import { Card } from './ui/card';

export function Dashboard() {
  const { products, sales, expenses, currentUser } = useApp();

  // Calculate today's stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todaySales = sales.filter(s => {
    const saleDate = new Date(s.date);
    saleDate.setHours(0, 0, 0, 0);
    return saleDate.getTime() === today.getTime();
  });

  const todayExpenses = expenses.filter(e => {
    const expenseDate = new Date(e.date);
    expenseDate.setHours(0, 0, 0, 0);
    return expenseDate.getTime() === today.getTime();
  });

  const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
  const todayExpenseTotal = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
  const todayProfit = todayRevenue - todayExpenseTotal;

  // Stock alerts
  const lowStockProducts = products.filter(p => p.stock <= p.minStock);
  const outOfStockProducts = products.filter(p => p.stock === 0);

  // This week stats
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  weekAgo.setHours(0, 0, 0, 0);

  const weekSales = sales.filter(s => new Date(s.date) >= weekAgo);
  const weekRevenue = weekSales.reduce((sum, s) => sum + s.total, 0);

  return (
    <div className="space-y-6">
      {/* Welcome Header - Sober */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors duration-300">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-emerald-600 flex items-center justify-center">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-gray-900 dark:text-white text-xl font-semibold">Bonjour, {currentUser?.name}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{formatDate(new Date())}</p>
          </div>
        </div>
      </div>

      {/* Today's Stats - Monochrome Grid */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Aujourd'hui</h3>
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {todaySales.length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Ventes</div>
          </Card>

          <Card className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {formatCurrency(todayRevenue).replace(' GNF', '')}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Recettes (GNF)</div>
          </Card>

          <Card className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {formatCurrency(todayExpenseTotal).replace(' GNF', '')}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Dépenses (GNF)</div>
          </Card>

          <Card className={`p-5 ${
            todayProfit >= 0 
              ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' 
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          }`}>
            <div className="flex items-start justify-between mb-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                todayProfit >= 0 
                  ? 'bg-emerald-600' 
                  : 'bg-red-600'
              }`}>
                <Banknote className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className={`text-2xl font-bold mb-1 ${
              todayProfit >= 0 
                ? 'text-emerald-900 dark:text-emerald-400' 
                : 'text-red-900 dark:text-red-400'
            }`}>
              {formatCurrency(Math.abs(todayProfit)).replace(' GNF', '')}
            </div>
            <div className={`text-xs font-medium ${todayProfit >= 0 ? 'text-emerald-700 dark:text-emerald-500' : 'text-red-700 dark:text-red-500'}`}>
              Bénéfice net (GNF)
            </div>
          </Card>
        </div>
      </div>

      {/* Stock Alerts - Sober */}
      {(lowStockProducts.length > 0 || outOfStockProducts.length > 0) && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Alertes de stock</h3>
          <Card className="p-5 bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-gray-700 dark:bg-gray-600 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="text-gray-900 dark:text-white font-semibold">Attention requise</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {outOfStockProducts.length > 0 && `${outOfStockProducts.length} rupture(s) • `}
                  {lowStockProducts.length} stock faible
                </p>
              </div>
            </div>
            
            <div className="space-y-2">
              {outOfStockProducts.slice(0, 2).map(product => (
                <div key={product.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="flex-1">
                    <div className="text-gray-900 dark:text-white font-medium">{product.name}</div>
                    <div className="text-sm text-red-600 dark:text-red-400">Rupture de stock</div>
                  </div>
                  <div className="px-3 py-1 bg-red-600 text-white rounded-lg font-semibold text-sm">
                    0
                  </div>
                </div>
              ))}
              {lowStockProducts.slice(0, 3).map(product => (
                product.stock > 0 && (
                  <div key={product.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600">
                    <div className="flex-1">
                      <div className="text-gray-900 dark:text-white font-medium">{product.name}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Stock faible</div>
                    </div>
                    <div className="px-3 py-1 bg-gray-700 dark:bg-gray-600 text-white rounded-lg font-semibold text-sm">
                      {product.stock}
                    </div>
                  </div>
                )
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Week Summary - Monochrome */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Cette semaine</h3>
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-lg bg-gray-700 dark:bg-gray-600 flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="text-gray-900 dark:text-white font-semibold">7 derniers jours</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">Résumé hebdomadaire</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Ventes totales</div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {weekSales.length}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Recettes</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(weekRevenue).replace(' GNF', '')}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">GNF</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Sales - Sober */}
      {todaySales.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Dernières ventes</h3>
          <Card className="p-5">
            <div className="space-y-2">
              {todaySales.slice(0, 3).map(sale => (
                <div key={sale.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="flex-1">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {new Date(sale.date).toLocaleTimeString('fr-GN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="text-sm text-gray-900 dark:text-white font-medium">
                      {sale.items.length} article{sale.items.length > 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-emerald-900 dark:text-emerald-400 font-semibold">{formatCurrency(sale.total)}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                      {sale.paymentMethod === 'orange-money' ? 'Orange Money' : 'Espèces'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
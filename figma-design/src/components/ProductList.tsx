import { useState } from 'react';
import { useApp } from '../lib/context';
import { formatCurrency } from '../lib/utils';
import { Search, Plus, Package, AlertCircle } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Card } from './ui/card';

export function ProductList({ onEditProduct }: { onEditProduct: (product: any) => void }) {
  const { products } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = ['all', ...Array.from(new Set(products.map(p => p.category)))];

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const lowStockCount = products.filter(p => p.stock <= p.minStock).length;

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors duration-300">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gray-700 dark:bg-gray-600 flex items-center justify-center">
              <Package className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-gray-900 dark:text-white text-xl font-semibold">Inventaire</h2>
          </div>
          <Button
            onClick={() => onEditProduct(null)}
            className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white rounded-md active:scale-95 transition-all h-11"
          >
            <Plus className="w-5 h-5" />
            Nouveau produit
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            type="text"
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-12 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 focus:border-emerald-500 dark:focus:border-emerald-400 rounded-lg"
          />
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-all font-medium ${
                selectedCategory === category
                  ? 'bg-gray-700 dark:bg-gray-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
              }`}
            >
              {category === 'all' ? 'Tous' : category}
            </button>
          ))}
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockCount > 0 && (
        <Card className="p-5 bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gray-700 dark:bg-gray-600 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-gray-900 dark:text-white font-semibold">{lowStockCount} produit(s) en stock faible</p>
            </div>
          </div>
        </Card>
      )}

      {/* Products Grid */}
      <div className="space-y-3">
        {filteredProducts.length === 0 ? (
          <Card className="p-12 text-center rounded-lg">
            <Package className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">Aucun produit trouvé</p>
          </Card>
        ) : (
          filteredProducts.map(product => (
            <Card
              key={product.id}
              className="p-5 cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-600 hover:shadow-lg transition-all duration-200 active:scale-[0.98] rounded-lg bg-white dark:bg-gray-800"
              onClick={() => onEditProduct(product)}
            >
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <div className="text-gray-900 dark:text-white font-bold mb-1">{product.name}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">{product.category}</div>
                  <div className="text-emerald-600 dark:text-emerald-400 font-bold text-lg">{formatCurrency(product.price)}</div>
                </div>
                <div className="text-right">
                  <div className={`px-3 py-1.5 rounded-lg text-sm font-semibold mb-2 ${
                    product.stock === 0
                      ? 'bg-red-600 text-white'
                      : product.stock <= product.minStock
                      ? 'bg-gray-600 dark:bg-gray-500 text-white'
                      : 'bg-emerald-600 text-white'
                  }`}>
                    {product.stock}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    Min: {product.minStock}
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
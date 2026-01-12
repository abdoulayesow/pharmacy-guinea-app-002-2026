import { useState, useEffect } from 'react';
import { useApp } from '../lib/context';
import { Product } from '../lib/types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card } from './ui/card';
import { ArrowLeft, Save, Trash2, Package } from 'lucide-react';

export function ProductForm({ product, onBack }: { product: Product | null; onBack: () => void }) {
  const { addProduct, updateProduct, deleteProduct } = useApp();
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    price: '',
    stock: '',
    minStock: '',
    barcode: '',
    description: ''
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        category: product.category,
        price: product.price.toString(),
        stock: product.stock.toString(),
        minStock: product.minStock.toString(),
        barcode: product.barcode || '',
        description: product.description || ''
      });
    }
  }, [product]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const productData = {
      name: formData.name,
      category: formData.category,
      price: parseFloat(formData.price),
      stock: parseInt(formData.stock),
      minStock: parseInt(formData.minStock),
      barcode: formData.barcode || undefined,
      description: formData.description || undefined
    };

    if (product) {
      updateProduct(product.id, productData);
    } else {
      addProduct(productData);
    }
    
    onBack();
  };

  const handleDelete = () => {
    if (product) {
      deleteProduct(product.id);
      onBack();
    }
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
          <h2 className="text-gray-900 dark:text-white text-xl font-semibold">
            {product ? 'Modifier le produit' : 'Nouveau produit'}
          </h2>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card className="p-5 rounded-lg shadow-sm">
          <h3 className="text-gray-900 dark:text-white font-semibold text-lg mb-5">Informations générales</h3>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-gray-700 dark:text-gray-300 font-medium mb-2 block">Nom du produit *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Paracétamol 500mg"
                required
                className="h-12 border border-gray-200 dark:border-gray-600 focus:border-emerald-500 dark:focus:border-emerald-400 rounded-lg"
              />
            </div>

            <div>
              <Label htmlFor="category" className="text-gray-700 dark:text-gray-300 font-medium mb-2 block">Catégorie *</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="Ex: Antalgiques"
                required
                className="h-12 border border-gray-200 dark:border-gray-600 focus:border-emerald-500 dark:focus:border-emerald-400 rounded-lg"
              />
            </div>

            <div>
              <Label htmlFor="barcode" className="text-gray-700 dark:text-gray-300 font-medium mb-2 block">Code-barre</Label>
              <Input
                id="barcode"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                placeholder="Optionnel"
                className="h-12 border border-gray-200 dark:border-gray-600 focus:border-emerald-500 dark:focus:border-emerald-400 rounded-lg"
              />
            </div>

            <div>
              <Label htmlFor="description" className="text-gray-700 dark:text-gray-300 font-medium mb-2 block">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optionnel"
                className="h-12 border border-gray-200 dark:border-gray-600 focus:border-emerald-500 dark:focus:border-emerald-400 rounded-lg"
              />
            </div>
          </div>
        </Card>

        <Card className="p-5 rounded-lg shadow-sm">
          <h3 className="text-gray-900 dark:text-white font-semibold text-lg mb-5">Prix et stock</h3>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="price" className="text-gray-700 dark:text-gray-300 font-medium mb-2 block">Prix unitaire (GNF) *</Label>
              <Input
                id="price"
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="0"
                required
                min="0"
                step="1"
                className="h-14 border border-gray-200 dark:border-gray-600 focus:border-emerald-500 dark:focus:border-emerald-400 rounded-lg text-lg font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="stock" className="text-gray-700 dark:text-gray-300 font-medium mb-2 block">Stock actuel *</Label>
                <Input
                  id="stock"
                  type="number"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  placeholder="0"
                  required
                  min="0"
                  className="h-14 border border-gray-200 dark:border-gray-600 focus:border-emerald-500 dark:focus:border-emerald-400 rounded-lg text-lg font-bold"
                />
              </div>

              <div>
                <Label htmlFor="minStock" className="text-gray-700 dark:text-gray-300 font-medium mb-2 block">Stock minimum *</Label>
                <Input
                  id="minStock"
                  type="number"
                  value={formData.minStock}
                  onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                  placeholder="0"
                  required
                  min="0"
                  className="h-14 border border-gray-200 dark:border-gray-600 focus:border-emerald-500 dark:focus:border-emerald-400 rounded-lg text-lg font-bold"
                />
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
              <p className="text-sm text-gray-700 dark:text-gray-300 font-medium flex items-center gap-2">
                <Package className="w-5 h-5" />
                Vous recevrez une alerte lorsque le stock atteint le niveau minimum.
              </p>
            </div>
          </div>
        </Card>

        <div className="flex gap-3">
          <Button
            type="submit"
            className="flex-1 h-14 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-semibold rounded-md shadow-lg active:scale-95 transition-all"
          >
            <Save className="w-5 h-5 mr-2" />
            {product ? 'Mettre à jour' : 'Créer le produit'}
          </Button>
          
          {product && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDeleteConfirm(true)}
              className="h-14 px-8 border-2 border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg font-semibold active:scale-95 transition-all"
            >
              <Trash2 className="w-5 h-5" />
            </Button>
          )}
        </div>
      </form>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowDeleteConfirm(false)}>
          <Card className="p-6 max-w-sm rounded-lg shadow-2xl dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-gray-900 dark:text-white font-semibold text-xl mb-3">Confirmer la suppression</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
              Êtes-vous sûr de vouloir supprimer <span className="font-semibold">"{product?.name}"</span> ? Cette action est irréversible.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 h-12 rounded-lg border-2 font-semibold"
              >
                Annuler
              </Button>
              <Button
                onClick={handleDelete}
                className="flex-1 h-12 bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 text-white font-semibold rounded-lg shadow-lg"
              >
                Supprimer
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
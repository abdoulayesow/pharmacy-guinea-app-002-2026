import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Product, Sale, Expense, CartItem, StockAdjustment } from './types';
import { generateId } from './utils';

interface AppState {
  // Auth
  currentUser: User | null;
  users: User[];
  login: (userId: string, pin: string) => boolean;
  logout: () => void;

  // Products
  products: Product[];
  addProduct: (product: Omit<Product, 'id'>) => void;
  updateProduct: (id: string, product: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  adjustStock: (adjustment: Omit<StockAdjustment, 'id' | 'date'>) => void;

  // Sales
  sales: Sale[];
  cart: CartItem[];
  addToCart: (product: Product, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  completeSale: (paymentMethod: 'cash' | 'orange-money') => Sale | null;
  lastSale: Sale | null;

  // Expenses
  expenses: Expense[];
  addExpense: (expense: Omit<Expense, 'id' | 'date' | 'userId' | 'synced'>) => void;

  // Status
  isOnline: boolean;
  pendingSyncCount: number;
}

const AppContext = createContext<AppState | undefined>(undefined);

// Mock users
const mockUsers: User[] = [
  { id: '1', name: 'Mamadou', role: 'owner', pin: '1234' },
  { id: '2', name: 'Fatoumata', role: 'employee', pin: '5678' },
  { id: '3', name: 'Aicha', role: 'employee', pin: '9012' }
];

// Mock products
const mockProducts: Product[] = [
  { id: '1', name: 'Paracétamol 500mg', category: 'Antalgiques', price: 5000, stock: 150, minStock: 50, barcode: '123456' },
  { id: '2', name: 'Amoxicilline 500mg', category: 'Antibiotiques', price: 25000, stock: 80, minStock: 30 },
  { id: '3', name: 'Ibuprofène 400mg', category: 'Anti-inflammatoires', price: 8000, stock: 20, minStock: 40 },
  { id: '4', name: 'Vitamine C 1000mg', category: 'Vitamines', price: 12000, stock: 200, minStock: 50 },
  { id: '5', name: 'Aspirine 100mg', category: 'Antalgiques', price: 4000, stock: 45, minStock: 40 },
  { id: '6', name: 'Oméprazole 20mg', category: 'Digestifs', price: 15000, stock: 60, minStock: 30 },
  { id: '7', name: 'Métronidazole 250mg', category: 'Antibiotiques', price: 18000, stock: 10, minStock: 25 },
  { id: '8', name: 'Sirop toux enfant', category: 'Pédiatrie', price: 22000, stock: 5, minStock: 20 },
];

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users] = useState<User[]>(mockUsers);
  const [products, setProducts] = useState<Product[]>(mockProducts);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  // Simulate intermittent connectivity
  useEffect(() => {
    const interval = setInterval(() => {
      setIsOnline(Math.random() > 0.2); // 80% online, 20% offline
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const login = (userId: string, pin: string): boolean => {
    const user = users.find(u => u.id === userId && u.pin === pin);
    if (user) {
      setCurrentUser(user);
      return true;
    }
    return false;
  };

  const logout = () => {
    setCurrentUser(null);
    setCart([]);
    setLastSale(null);
  };

  const addProduct = (product: Omit<Product, 'id'>) => {
    const newProduct = { ...product, id: generateId() };
    setProducts(prev => [...prev, newProduct]);
  };

  const updateProduct = (id: string, updates: Partial<Product>) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const deleteProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const adjustStock = (adjustment: Omit<StockAdjustment, 'id' | 'date'>) => {
    updateProduct(adjustment.productId, {
      stock: products.find(p => p.id === adjustment.productId)!.stock + adjustment.quantity
    });
  };

  const addToCart = (product: Product, quantity: number) => {
    const existingItem = cart.find(item => item.product.id === product.id);
    if (existingItem) {
      updateCartQuantity(product.id, existingItem.quantity + quantity);
    } else {
      setCart(prev => [...prev, { product, quantity }]);
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
    } else {
      setCart(prev => prev.map(item =>
        item.product.id === productId ? { ...item, quantity } : item
      ));
    }
  };

  const clearCart = () => {
    setCart([]);
  };

  const completeSale = (paymentMethod: 'cash' | 'orange-money'): Sale | null => {
    if (cart.length === 0 || !currentUser) return null;

    const total = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    const sale: Sale = {
      id: generateId(),
      date: new Date(),
      items: [...cart],
      total,
      paymentMethod,
      userId: currentUser.id,
      synced: isOnline
    };

    // Update stock
    cart.forEach(item => {
      updateProduct(item.product.id, {
        stock: item.product.stock - item.quantity
      });
    });

    setSales(prev => [sale, ...prev]);
    setLastSale(sale);
    clearCart();
    return sale;
  };

  const addExpense = (expense: Omit<Expense, 'id' | 'date' | 'userId' | 'synced'>) => {
    if (!currentUser) return;

    const newExpense: Expense = {
      ...expense,
      id: generateId(),
      date: new Date(),
      userId: currentUser.id,
      synced: isOnline
    };

    setExpenses(prev => [newExpense, ...prev]);
  };

  const pendingSyncCount = [...sales, ...expenses].filter(item => !item.synced).length;

  return (
    <AppContext.Provider
      value={{
        currentUser,
        users,
        login,
        logout,
        products,
        addProduct,
        updateProduct,
        deleteProduct,
        adjustStock,
        sales,
        cart,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        clearCart,
        completeSale,
        lastSale,
        expenses,
        addExpense,
        isOnline,
        pendingSyncCount
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}

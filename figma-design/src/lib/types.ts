export interface User {
  id: string;
  name: string;
  role: 'owner' | 'employee';
  pin: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  minStock: number;
  barcode?: string;
  description?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Sale {
  id: string;
  date: Date;
  items: CartItem[];
  total: number;
  paymentMethod: 'cash' | 'orange-money';
  userId: string;
  synced: boolean;
}

export interface Expense {
  id: string;
  date: Date;
  description: string;
  amount: number;
  category: string;
  userId: string;
  synced: boolean;
}

export interface StockAdjustment {
  id: string;
  productId: string;
  quantity: number;
  reason: string;
  date: Date;
  userId: string;
}

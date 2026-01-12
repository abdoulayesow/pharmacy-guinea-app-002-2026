import { useState } from 'react';
import { AppProvider, useApp } from './lib/context';
import { ThemeProvider } from './contexts/ThemeContext';
import { LoginScreen } from './components/LoginScreen';
import { Dashboard } from './components/Dashboard';
import { NewSale } from './components/NewSale';
import { ProductList } from './components/ProductList';
import { ProductForm } from './components/ProductForm';
import { ExpenseList } from './components/ExpenseList';
import { ExpenseForm } from './components/ExpenseForm';
import { Header, Navigation } from './components/Navigation';
import { Product } from './lib/types';

type Screen = 'dashboard' | 'sale' | 'products' | 'expenses';

function MainApp() {
  const { currentUser, logout, isOnline, pendingSyncCount } = useApp();
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null | undefined>(undefined);
  const [showExpenseForm, setShowExpenseForm] = useState(false);

  const handleLogout = () => {
    logout();
    setIsAuthenticated(false);
    setCurrentScreen('dashboard');
  };

  if (!isAuthenticated || !currentUser) {
    return <LoginScreen onLogin={() => setIsAuthenticated(true)} />;
  }

  const renderScreen = () => {
    // Product Form (overlay state)
    if (editingProduct !== undefined) {
      return (
        <ProductForm 
          product={editingProduct} 
          onBack={() => setEditingProduct(undefined)} 
        />
      );
    }

    // Expense Form (overlay state)
    if (showExpenseForm) {
      return (
        <ExpenseForm 
          onBack={() => setShowExpenseForm(false)} 
        />
      );
    }

    // Main screens
    switch (currentScreen) {
      case 'dashboard':
        return <Dashboard />;
      case 'sale':
        return <NewSale />;
      case 'products':
        return <ProductList onEditProduct={(product) => setEditingProduct(product)} />;
      case 'expenses':
        return <ExpenseList onAddExpense={() => setShowExpenseForm(true)} />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <Header 
        userName={currentUser.name}
        isOnline={isOnline}
        pendingSyncCount={pendingSyncCount}
        onLogout={handleLogout}
      />
      
      <main className="max-w-md mx-auto px-4 py-5 pb-28">
        {renderScreen()}
      </main>

      <Navigation 
        currentScreen={currentScreen} 
        onNavigate={(screen) => {
          setCurrentScreen(screen);
          setEditingProduct(undefined);
          setShowExpenseForm(false);
        }}
        onLogout={handleLogout}
      />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <ThemeProvider>
        <MainApp />
      </ThemeProvider>
    </AppProvider>
  );
}
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/client/db';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/lib/shared/utils';
import { Search, User, Phone, Clock, ShoppingBag, X, Plus } from 'lucide-react';

interface CustomerSummary {
  name: string;
  phone?: string;
  purchaseCount: number;
  lastPurchaseDate: Date;
  totalSpent: number;
}

interface CustomerAutocompleteProps {
  customerName: string;
  customerPhone: string;
  onCustomerSelect: (name: string, phone: string) => void;
  onCustomerNameChange: (name: string) => void;
  onCustomerPhoneChange: (phone: string) => void;
}

// Format phone number as 6XX XX XX XX (Guinea format)
function formatPhoneNumber(value: string): string {
  // Remove all non-digits
  const digits = value.replace(/\D/g, '');

  // Limit to 9 digits (Guinea mobile format)
  const limited = digits.slice(0, 9);

  // Format as 6XX XX XX XX
  if (limited.length === 0) return '';
  if (limited.length <= 3) return limited;
  if (limited.length <= 5) return `${limited.slice(0, 3)} ${limited.slice(3)}`;
  if (limited.length <= 7) return `${limited.slice(0, 3)} ${limited.slice(3, 5)} ${limited.slice(5)}`;
  return `${limited.slice(0, 3)} ${limited.slice(3, 5)} ${limited.slice(5, 7)} ${limited.slice(7)}`;
}

// Check if input looks like a phone number (starts with 6 and has digits)
function isPhoneNumberInput(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length > 0 && digits[0] === '6';
}

export function CustomerAutocomplete({
  customerName,
  customerPhone,
  onCustomerSelect,
  onCustomerNameChange,
  onCustomerPhoneChange,
}: CustomerAutocompleteProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);

  // Query all sales with customer information
  const sales = useLiveQuery(() =>
    db.sales
      .where('customer_name')
      .notEqual('')
      .toArray()
  );

  // Calculate customer summaries (grouped by customer name)
  const customerSummaries = useMemo<CustomerSummary[]>(() => {
    if (!sales || sales.length === 0) return [];

    const customerMap = new Map<string, CustomerSummary>();

    sales.forEach((sale) => {
      if (!sale.customer_name) return;

      const existing = customerMap.get(sale.customer_name.toLowerCase());

      if (existing) {
        existing.purchaseCount += 1;
        existing.totalSpent += sale.total;
        if (sale.created_at > existing.lastPurchaseDate) {
          existing.lastPurchaseDate = sale.created_at;
          // Update phone if more recent sale has phone info
          if (sale.customer_phone) {
            existing.phone = sale.customer_phone;
          }
        }
      } else {
        customerMap.set(sale.customer_name.toLowerCase(), {
          name: sale.customer_name,
          phone: sale.customer_phone,
          purchaseCount: 1,
          lastPurchaseDate: sale.created_at,
          totalSpent: sale.total,
        });
      }
    });

    return Array.from(customerMap.values()).sort((a, b) => {
      const dateA = a.lastPurchaseDate instanceof Date ? a.lastPurchaseDate : new Date(a.lastPurchaseDate);
      const dateB = b.lastPurchaseDate instanceof Date ? b.lastPurchaseDate : new Date(b.lastPurchaseDate);
      return dateB.getTime() - dateA.getTime();
    });
  }, [sales]);

  // Fuzzy search filtering
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) {
      // Show recent customers when no search query
      return customerSummaries.slice(0, 5);
    }

    const query = searchQuery.toLowerCase();
    return customerSummaries.filter(
      (customer) =>
        customer.name.toLowerCase().includes(query) ||
        customer.phone?.toLowerCase().includes(query)
    );
  }, [searchQuery, customerSummaries]);

  // Handle search input change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setShowSuggestions(true);
    setManualEntry(false);
  };

  // Handle customer selection from dropdown
  const handleCustomerSelect = (customer: CustomerSummary) => {
    onCustomerSelect(customer.name, customer.phone ? formatPhoneNumber(customer.phone) : '');
    setSearchQuery('');
    setShowSuggestions(false);
    setManualEntry(false);
  };

  // Handle manual entry mode - pre-populate with search query
  const handleManualEntry = () => {
    // If search query looks like a phone number, populate phone field
    if (isPhoneNumberInput(searchQuery)) {
      onCustomerPhoneChange(formatPhoneNumber(searchQuery));
      onCustomerNameChange('');
    } else {
      // Otherwise populate name field
      onCustomerNameChange(searchQuery);
      onCustomerPhoneChange('');
    }
    setManualEntry(true);
    setShowSuggestions(false);
    setSearchQuery('');
  };

  // Handle clearing customer
  const handleClearCustomer = () => {
    onCustomerSelect('', '');
    setSearchQuery('');
    setManualEntry(false);
    setShowSuggestions(false);
  };

  // Show manual entry form if customer has been selected or manual entry mode
  const showManualForm = manualEntry || customerName;

  return (
    <div className="space-y-4">
      {!showManualForm ? (
        <div className="relative">
          <label className="block text-sm font-semibold text-slate-300 mb-2">
            Rechercher un client
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Nom ou téléphone..."
              className="h-12 pl-10 bg-slate-950 border-2 border-slate-700 focus:border-emerald-500 rounded-xl text-base"
            />
          </div>

          {/* Suggestions dropdown */}
          {showSuggestions && (
            <Card className="absolute z-10 w-full mt-2 max-h-80 overflow-y-auto bg-slate-900 border-slate-700 shadow-xl">
              {filteredCustomers.length > 0 ? (
                <div className="divide-y divide-slate-800">
                  {filteredCustomers.map((customer, index) => (
                    <button
                      key={`${customer.name}-${index}`}
                      onClick={() => handleCustomerSelect(customer)}
                      className="w-full p-4 text-left hover:bg-slate-800 transition-colors active:scale-98"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <User className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                            <span className="font-semibold text-white truncate">
                              {customer.name}
                            </span>
                          </div>
                          {customer.phone && (
                            <div className="flex items-center gap-2 mb-2">
                              <Phone className="h-3 w-3 text-slate-400 flex-shrink-0" />
                              <span className="text-sm text-slate-400">
                                {formatPhoneNumber(customer.phone)}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            <div className="flex items-center gap-1">
                              <ShoppingBag className="h-3 w-3" />
                              <span>{customer.purchaseCount} achat{customer.purchaseCount > 1 ? 's' : ''}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>{formatDate(customer.lastPurchaseDate)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-emerald-500">
                            {formatCurrency(customer.totalSpent)}
                          </div>
                          <div className="text-xs text-slate-500">Total</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-slate-400">
                  {searchQuery ? (
                    <>
                      <p className="mb-3">Aucun client trouvé</p>
                      <button
                        onClick={handleManualEntry}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                        Ajouter
                      </button>
                    </>
                  ) : (
                    <p>Aucun client enregistré</p>
                  )}
                </div>
              )}

              {/* Manual entry option at bottom */}
              {filteredCustomers.length > 0 && (
                <button
                  onClick={handleManualEntry}
                  className="w-full p-4 text-center hover:bg-slate-800 font-semibold border-t border-slate-800 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="h-4 w-4 text-emerald-500" />
                  <span className="text-emerald-500">Ajouter</span>
                </button>
              )}
            </Card>
          )}

          {/* Click outside to close dropdown */}
          {showSuggestions && (
            <div
              className="fixed inset-0 z-0"
              onClick={() => setShowSuggestions(false)}
            />
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Manual entry form */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-slate-300">
                Nom du client
              </label>
              {customerName && (
                <button
                  onClick={handleClearCustomer}
                  className="text-xs text-slate-400 hover:text-slate-300 flex items-center gap-1"
                >
                  <X className="h-3 w-3" />
                  Effacer
                </button>
              )}
            </div>
            <Input
              type="text"
              value={customerName}
              onChange={(e) => onCustomerNameChange(e.target.value)}
              placeholder="Ex: Mamadou Diallo"
              className="h-12 bg-slate-950 border-2 border-slate-700 focus:border-emerald-500 rounded-xl text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Téléphone (optionnel)
            </label>
            <Input
              type="tel"
              value={customerPhone}
              onChange={(e) => onCustomerPhoneChange(formatPhoneNumber(e.target.value))}
              placeholder="6XX XX XX XX"
              className="h-12 bg-slate-950 border-2 border-slate-700 focus:border-emerald-500 rounded-xl text-base"
            />
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/client/utils';
import { formatCurrency } from '@/lib/shared/utils';

interface QuantitySelectorProps {
  value: number;
  onChange: (value: number) => void;
  unitPrice?: number;
  min?: number;
  max?: number;
  showQuickAmounts?: boolean;
  className?: string;
}

const QUICK_AMOUNTS = [5, 10, 20, 50, 100];

export function QuantitySelector({
  value,
  onChange,
  unitPrice,
  min = 1,
  max,
  showQuickAmounts = true,
  className,
}: QuantitySelectorProps) {
  const [inputValue, setInputValue] = useState(value.toString());

  const handleDecrease = () => {
    const newValue = Math.max(min, value - 1);
    onChange(newValue);
    setInputValue(newValue.toString());
  };

  const handleIncrease = () => {
    const newValue = max ? Math.min(max, value + 1) : value + 1;
    onChange(newValue);
    setInputValue(newValue.toString());
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    const numValue = parseInt(newValue);
    if (!isNaN(numValue) && numValue >= min && (!max || numValue <= max)) {
      onChange(numValue);
    }
  };

  const handleInputBlur = () => {
    const numValue = parseInt(inputValue);
    if (isNaN(numValue) || numValue < min) {
      onChange(min);
      setInputValue(min.toString());
    } else if (max && numValue > max) {
      onChange(max);
      setInputValue(max.toString());
    } else {
      onChange(numValue);
      setInputValue(numValue.toString());
    }
  };

  const handleQuickAmount = (amount: number) => {
    const newValue = max ? Math.min(max, amount) : amount;
    onChange(newValue);
    setInputValue(newValue.toString());
  };

  const subtotal = unitPrice ? value * unitPrice : 0;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Current Value Display */}
      <div className="bg-slate-950 rounded-lg p-4 border border-slate-700 text-center">
        <p className="text-sm text-slate-400 mb-1">Quantité</p>
        <p className="text-3xl font-bold text-white">{value}</p>
        {unitPrice && (
          <p className="text-sm text-slate-400 mt-2">
            × {formatCurrency(unitPrice)} = <span className="text-emerald-400 font-semibold">{formatCurrency(subtotal)}</span>
          </p>
        )}
      </div>

      {/* +/- Buttons */}
      <div className="flex items-center justify-center gap-4">
        <Button
          type="button"
          onClick={handleDecrease}
          disabled={value <= min}
          className="w-16 h-16 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
          aria-label="Diminuer"
        >
          <Minus className="w-6 h-6" />
        </Button>

        <Input
          type="number"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          min={min}
          max={max}
          className="w-32 h-16 text-center text-2xl font-bold bg-slate-800 border-slate-700 text-white rounded-xl"
        />

        <Button
          type="button"
          onClick={handleIncrease}
          disabled={max !== undefined && value >= max}
          className="w-16 h-16 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Augmenter"
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>

      {/* Quick Amount Chips */}
      {showQuickAmounts && (
        <div>
          <p className="text-sm text-slate-400 mb-2 text-center">Montants rapides</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {QUICK_AMOUNTS.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => handleQuickAmount(amount)}
                className={cn(
                  'px-4 py-2 rounded-lg font-semibold text-sm transition-all active:scale-95',
                  value === amount
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                )}
              >
                {amount}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}














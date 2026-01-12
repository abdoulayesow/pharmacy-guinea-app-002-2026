import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format Guinean Franc currency
export function formatCurrency(amount: number): string {
  const formatted = amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${formatted} GNF`;
}

// Format date in French
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('fr-GN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}

// Format time
export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('fr-GN', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

// Format datetime
export function formatDateTime(date: Date): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

// Generate unique ID
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Shared utility functions for Seri
 *
 * These utilities are used by both:
 * - Frontend (PWA + Future Android app)
 * - Backend (API for formatting responses)
 */

// ============================================================================
// Currency Formatting
// ============================================================================

/**
 * Format amount in Guinean Francs (GNF)
 * Example: 15000 -> "15 000 GNF"
 */
export function formatCurrency(amount: number): string {
  const formatted = Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${formatted} GNF`;
}

// ============================================================================
// Date Formatting
// ============================================================================

/**
 * Format date as DD/MM/YYYY (French format)
 * Example: 2026-01-15 -> "15/01/2026"
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('fr-GN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/**
 * Format time as HH:MM (24h format)
 * Example: 14:30
 */
export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('fr-GN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/**
 * Format date and time together
 * Example: "15/01/2026 14:30"
 */
export function formatDateTime(date: Date): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

/**
 * Get relative time string in French
 * Example: "Il y a 5 minutes"
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "À l'instant";
  if (diffMins < 60) return `Il y a ${diffMins} minute${diffMins > 1 ? 's' : ''}`;
  if (diffHours < 24) return `Il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
  if (diffDays < 7) return `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;

  return formatDate(date);
}

// ============================================================================
// Stock Status
// ============================================================================

/**
 * Get stock status based on current stock vs minimum
 */
export function getStockStatus(stock: number, minStock: number): 'ok' | 'low' | 'out' {
  if (stock === 0) return 'out';
  if (stock <= minStock) return 'low';
  return 'ok';
}

/**
 * Get stock status color classes (Tailwind CSS)
 */
export function getStockStatusColor(status: 'ok' | 'low' | 'out'): string {
  switch (status) {
    case 'ok':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200';
    case 'low':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'out':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  }
}

// ============================================================================
// Expense Categories
// ============================================================================

/**
 * Parse expense category to French label
 */
export function getExpenseCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    STOCK_PURCHASE: 'Achat de stock',
    RENT: 'Loyer',
    SALARY: 'Salaire',
    ELECTRICITY: 'Électricité',
    TRANSPORT: 'Transport',
    OTHER: 'Autre',
  };
  return labels[category] || category;
}

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Generate a unique local ID for offline-first operations
 */
export function generateLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate PIN format (4 digits)
 */
export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

/**
 * Validate amount (must be positive number)
 */
export function isValidAmount(amount: number): boolean {
  return !isNaN(amount) && amount > 0;
}

/**
 * Validate stock quantity (must be non-negative integer)
 */
export function isValidStock(stock: number): boolean {
  return Number.isInteger(stock) && stock >= 0;
}

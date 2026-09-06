export function formatCurrency(value: number, currency: 'EUR' | 'USD' = 'EUR'): string {
  const symbol = currency === 'EUR' ? '€' : '$';
  const formatted = new Intl.NumberFormat(currency === 'EUR' ? 'de-DE' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));

  return `${value < 0 ? '-' : ''}${symbol} ${formatted}`;
}

export function formatPercent(value: number, includeSign = true): string {
  const sign = includeSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export const ASSET_TYPE_COLORS: Record<string, string> = {
  etf: '#3b82f6',    // Blue
  stock: '#22c55e',  // Neon Green
  crypto: '#f59e0b', // Amber/Gold
  cash: '#a855f7',   // Purple
};

export const ASSET_TYPE_LABELS: Record<string, string> = {
  etf: 'ETFs',
  stock: 'Stocks',
  crypto: 'Crypto',
  cash: 'Cash',
};

/**
 * Twelve Data API Configuration and Symbol Normalization Service
 */

export const TWELVE_DATA_API_KEY = 'c680e1388d9d40a28b1e2b3649aafefb';
export const TWELVE_DATA_BASE_URL = 'https://api.twelvedata.com';

/**
 * Specific asset ticker overrides for XTB / Getquin
 */
const SPECIFIC_TICKER_MAP: Record<string, string> = {
  'SKHY.US': '000660',
  '000660.KS': '000660',
  'SKHY': '000660',
  'SPCX.US': 'DXYZ', // Destiny Tech100 (SpaceX primary exposure)
  'SPCX': 'DXYZ',
  'SXR8.DE': 'SXR8',
  'VVSM.DE': 'VVSM',
  'GOOGL.US': 'GOOGL',
  'AAPL.US': 'AAPL',
  'MSFT.US': 'MSFT',
  'NVDA.US': 'NVDA',
  'AMZN.US': 'AMZN',
  'TSLA.US': 'TSLA',
  'META.US': 'META',
};

/**
 * Cleans market suffixes and maps XTB / Getquin symbols to Twelve Data format.
 * Examples:
 * - "SXR8.DE" -> "SXR8"
 * - "VVSM.DE" -> "VVSM"
 * - "GOOGL.US" -> "GOOGL"
 * - "SKHY.US" / "000660.KS" -> "000660"
 * - "SPCX.US" -> "DXYZ"
 * - "BTC-USD" -> "BTC/USD"
 */
export function formatTickerForTwelveData(ticker: string): string {
  if (!ticker) return '';

  const rawUpper = ticker.trim().toUpperCase();

  // 1. Check explicit overrides first
  if (SPECIFIC_TICKER_MAP[rawUpper]) {
    return SPECIFIC_TICKER_MAP[rawUpper];
  }

  // 2. Handle crypto pairs
  const cryptoMatch = rawUpper.match(/^(BTC|ETH|SOL|ADA|DOT|XRP|BNB|AVAX|MATIC|DOGE)[-/]?(USD|EUR|USDT)$/i);
  if (cryptoMatch) {
    return `${cryptoMatch[1].toUpperCase()}/${cryptoMatch[2].toUpperCase()}`;
  }

  // 3. Remove standard market suffixes (.DE, .US, .UK, .L, .PA, .MC, .AS, .MI, .NL, .SW, .PL, .PT, etc.)
  let cleaned = rawUpper.replace(/\.(US|DE|FR|UK|L|PA|MC|AS|MI|NL|SW|PL|PT|KS|KQ)$/i, '');

  // Secondary check after suffix removal
  if (SPECIFIC_TICKER_MAP[cleaned]) {
    return SPECIFIC_TICKER_MAP[cleaned];
  }

  return cleaned;
}

// Alias for backward compatibility
export const normalizeSymbolForTwelveData = formatTickerForTwelveData;

/**
 * Formats multiple symbols into a comma-separated list for batch requests
 */
export function formatBatchSymbols(symbols: string[]): string {
  const normalized = symbols
    .map(s => formatTickerForTwelveData(s))
    .filter(Boolean);
  return Array.from(new Set(normalized)).join(',');
}

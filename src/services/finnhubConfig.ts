/**
 * Finnhub API Configuration and Ticker Sanitization Service
 * Official API Key: daeb3chr01ql3jf9o350daeb3chr01ql3jf9o35g
 */

export const FINNHUB_API_KEY = 'daeb3chr01ql3jf9o350daeb3chr01ql3jf9o35g';
export const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

/**
 * Specific asset ticker overrides for XTB / Getquin
 */
const SPECIFIC_TICKER_MAP: Record<string, string> = {
  'SKHY.US': '000660.KS',
  'SKHY': '000660.KS',
  '000660.KS': '000660.KS',
  '000660': '000660.KS',
  'SPCX.US': 'DXYZ', // Destiny Tech100 (SpaceX primary exposure)
  'SPCX': 'DXYZ',
  'SXR8.DE': 'SXR8.DE',
  'VVSM.DE': 'VVSM.DE',
  'VWCE.DE': 'VWCE.DE',
  'VUAA.DE': 'VUAA.DE',
  'GOOGL.US': 'GOOGL',
  'AAPL.US': 'AAPL',
  'MSFT.US': 'MSFT',
  'NVDA.US': 'NVDA',
  'AMZN.US': 'AMZN',
  'TSLA.US': 'TSLA',
  'META.US': 'META',
  'ORCL.US': 'ORCL',
  'AMD.US': 'AMD',
  'INTC.US': 'INTC',
  'PLTR.US': 'PLTR',
  'COIN.US': 'COIN',
  'BABA.US': 'BABA',
  'NFLX.US': 'NFLX',
  'DIS.US': 'DIS',
};

/**
 * Cleans market suffixes and maps XTB / Getquin symbols to Finnhub format.
 * Examples:
 * - "GOOGL.US" -> "GOOGL"
 * - "AAPL.US" -> "AAPL"
 * - "SXR8.DE" -> "SXR8.DE" (or "SXR8")
 * - "SKHY.US" / "000660.KS" -> "000660.KS"
 * - "BTC-USD" -> "BINANCE:BTCUSDT"
 */
export function formatTickerForFinnhub(ticker: string): string {
  if (!ticker) return '';

  const rawUpper = ticker.trim().toUpperCase();

  // 1. Check explicit overrides first
  if (SPECIFIC_TICKER_MAP[rawUpper]) {
    return SPECIFIC_TICKER_MAP[rawUpper];
  }

  // 2. Handle crypto pairs
  const cryptoMatch = rawUpper.match(/^(BTC|ETH|SOL|ADA|DOT|XRP|BNB|AVAX|MATIC|DOGE)[-/]?(USD|EUR|USDT)$/i);
  if (cryptoMatch) {
    return `BINANCE:${cryptoMatch[1].toUpperCase()}USDT`;
  }

  // 3. Strip .US suffix (e.g. GOOGL.US -> GOOGL, MSFT.US -> MSFT)
  if (rawUpper.endsWith('.US')) {
    const withoutUS = rawUpper.slice(0, -3);
    if (SPECIFIC_TICKER_MAP[withoutUS]) {
      return SPECIFIC_TICKER_MAP[withoutUS];
    }
    return withoutUS;
  }

  // 4. If symbol already has European suffix like .DE, .PA, .MC, check map or return as is
  return rawUpper;
}

// Alias for ease of use
export const normalizeSymbolForFinnhub = formatTickerForFinnhub;

import { QuoteData } from '../types';
import {
  FINNHUB_API_KEY,
  FINNHUB_BASE_URL,
  formatTickerForFinnhub,
} from './finnhubConfig';
import { fetchYahooQuote } from './yahooFinanceService';

/**
 * In-memory cache for quotes to provide fast responses
 */
const quoteCache = new Map<string, { data: QuoteData; timestamp: number }>();
const CACHE_TTL_MS = 30 * 1000; // 30 seconds cache

/**
 * Checks if ticker is inherently an international or non-US exchange symbol
 */
function isInternationalTicker(symbol: string): boolean {
  const s = (symbol || '').toUpperCase();
  return (
    s.includes('.DE') ||
    s.includes('.KS') ||
    s.includes('.PA') ||
    s.includes('.MC') ||
    s.includes('.AS') ||
    s.includes('.MI') ||
    s.includes('.L') ||
    s.includes('.TO') ||
    s === '000660.KS' ||
    s === 'SKHY' ||
    s === 'SKHY.US' ||
    s === 'SXR8.DE' ||
    s === 'VWCE.DE' ||
    s === 'VUAA.DE'
  );
}

/**
 * Fetches real-time market quote for a single symbol.
 * Strategy:
 * 1. For international tickers (e.g. SXR8.DE, 000660.KS), uses Yahoo Finance.
 * 2. For US tickers, uses Finnhub API first.
 * 3. If Finnhub returns 0 or error, falls back to Yahoo Finance.
 * 4. If all fail, uses fallbackPrice (average buy price) so it never shows €0.00.
 */
async function fetchSingleQuoteWithFallback(
  symbol: string,
  fallbackPrice?: number
): Promise<QuoteData | null> {
  const cleanSym = formatTickerForFinnhub(symbol);
  if (!cleanSym) return null;

  // Check cache first
  const cached = quoteCache.get(cleanSym);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // 1. If international ticker, prioritize Yahoo Finance directly
  if (isInternationalTicker(symbol) || isInternationalTicker(cleanSym)) {
    const yQuote = await fetchYahooQuote(symbol);
    if (yQuote && yQuote.regularMarketPrice > 0) {
      quoteCache.set(cleanSym, { data: yQuote, timestamp: Date.now() });
      return yQuote;
    }
  }

  // 2. Try official Finnhub Quote API
  const url = `${FINNHUB_BASE_URL}/quote?symbol=${encodeURIComponent(cleanSym)}&token=${FINNHUB_API_KEY}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const currentPrice = typeof data?.c === 'number' ? data.c : 0;
      const change = typeof data?.d === 'number' ? data.d : 0;
      const changePct = typeof data?.dp === 'number' ? data.dp : 0;

      if (currentPrice > 0) {
        const quoteObj: QuoteData = {
          symbol: cleanSym,
          regularMarketPrice: currentPrice,
          regularMarketChange: change,
          regularMarketChangePercent: changePct,
          currency: 'USD',
        };
        quoteCache.set(cleanSym, { data: quoteObj, timestamp: Date.now() });
        return quoteObj;
      }
    }
  } catch (err) {
    console.warn(`Finnhub quote error for ${cleanSym}:`, err);
  }

  // 3. Fallback to Yahoo Finance for any asset that failed on Finnhub
  try {
    const yQuote = await fetchYahooQuote(symbol);
    if (yQuote && yQuote.regularMarketPrice > 0) {
      quoteCache.set(cleanSym, { data: yQuote, timestamp: Date.now() });
      return yQuote;
    }
  } catch {
    // continue to safe fallback
  }

  // 4. Fallback de Segurança: se devolver c: 0 ou erro, usa o Preço de Compra
  if (fallbackPrice && fallbackPrice > 0) {
    const fallbackQuote: QuoteData = {
      symbol: cleanSym,
      regularMarketPrice: fallbackPrice,
      regularMarketChange: 0,
      regularMarketChangePercent: 0,
      currency: 'USD',
    };
    return fallbackQuote;
  }

  return null;
}

/**
 * Fetches real-time prices for multiple portfolio assets with Yahoo Finance fallback.
 */
export async function fetchLiveQuotes(
  symbols: string[],
  fallbackPrices?: Record<string, number>
): Promise<Record<string, QuoteData>> {
  if (!symbols || symbols.length === 0) return {};

  const cleanSymbols = Array.from(new Set(symbols.map((s) => s.trim().toUpperCase())));
  const resultMap: Record<string, QuoteData> = {};

  const finnhubToOriginals = new Map<string, string[]>();

  cleanSymbols.forEach((origSym) => {
    const finnSym = formatTickerForFinnhub(origSym);
    if (!finnSym) return;

    const list = finnhubToOriginals.get(finnSym) || [];
    if (!list.includes(origSym)) {
      list.push(origSym);
    }
    finnhubToOriginals.set(finnSym, list);
  });

  const uniqueSymbols = Array.from(finnhubToOriginals.keys());

  const CHUNK_SIZE = 6;
  for (let i = 0; i < uniqueSymbols.length; i += CHUNK_SIZE) {
    const chunk = uniqueSymbols.slice(i, i + CHUNK_SIZE);

    const promises = chunk.map(async (finnSym) => {
      const originals = finnhubToOriginals.get(finnSym) || [finnSym];
      let fallbackPrice: number | undefined;
      if (fallbackPrices) {
        for (const orig of originals) {
          if (fallbackPrices[orig] && fallbackPrices[orig] > 0) {
            fallbackPrice = fallbackPrices[orig];
            break;
          }
        }
      }

      const quote = await fetchSingleQuoteWithFallback(originals[0] || finnSym, fallbackPrice);
      if (quote) {
        resultMap[finnSym] = quote;
        originals.forEach((orig) => {
          resultMap[orig] = { ...quote, symbol: orig };
        });
      }
    });

    await Promise.allSettled(promises);
  }

  return resultMap;
}

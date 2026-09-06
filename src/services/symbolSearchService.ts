import { AssetType } from '../types';
import {
  FINNHUB_API_KEY,
  FINNHUB_BASE_URL,
} from './finnhubConfig';

export interface SearchSymbolResult {
  symbol: string;
  name: string;
  exchange: string;
  typeDisp: string; // 'Stock' | 'ETF' | 'Fund' | 'Crypto' | etc.
  quoteType: string;
  mappedAssetType: AssetType;
  country?: string;
  currency?: string;
  change24hPercent?: number;
  avatarInitials?: string;
  avatarBg?: string;
}

// Curated popular assets for instant fallback display
export const CURATED_ASSETS: SearchSymbolResult[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', country: 'United States', currency: 'USD', typeDisp: 'Stock', quoteType: 'Common Stock', mappedAssetType: 'stock', avatarInitials: '', avatarBg: '#64748b' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ', country: 'United States', currency: 'USD', typeDisp: 'Stock', quoteType: 'Common Stock', mappedAssetType: 'stock', avatarInitials: 'MS', avatarBg: '#0284c7' },
  { symbol: 'NVDA', name: 'Nvidia Corp.', exchange: 'NASDAQ', country: 'United States', currency: 'USD', typeDisp: 'Stock', quoteType: 'Common Stock', mappedAssetType: 'stock', avatarInitials: 'NV', avatarBg: '#16a34a' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', exchange: 'NASDAQ', country: 'United States', currency: 'USD', typeDisp: 'Stock', quoteType: 'Common Stock', mappedAssetType: 'stock', avatarInitials: 'AM', avatarBg: '#d97706' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NASDAQ', country: 'United States', currency: 'USD', typeDisp: 'Stock', quoteType: 'Common Stock', mappedAssetType: 'stock', avatarInitials: 'G', avatarBg: '#ea580c' },
  { symbol: 'TSLA', name: 'Tesla Inc.', exchange: 'NASDAQ', country: 'United States', currency: 'USD', typeDisp: 'Stock', quoteType: 'Common Stock', mappedAssetType: 'stock', avatarInitials: 'TS', avatarBg: '#e11d48' },
  { symbol: 'SXR8.DE', name: 'iShares Core S&P 500 UCITS ETF', exchange: 'XETRA', country: 'Germany', currency: 'EUR', typeDisp: 'ETF', quoteType: 'ETP', mappedAssetType: 'etf', avatarInitials: 'SX', avatarBg: '#0f766e' },
  { symbol: 'VWCE.DE', name: 'Vanguard FTSE All-World ETF', exchange: 'XETRA', country: 'Germany', currency: 'EUR', typeDisp: 'ETF', quoteType: 'ETP', mappedAssetType: 'etf', avatarInitials: 'VW', avatarBg: '#991b1b' },
  { symbol: 'VUAA.DE', name: 'Vanguard S&P 500 UCITS ETF', exchange: 'XETRA', country: 'Germany', currency: 'EUR', typeDisp: 'ETF', quoteType: 'ETP', mappedAssetType: 'etf', avatarInitials: 'VU', avatarBg: '#0f766e' },
  { symbol: '000660.KS', name: 'SK Hynix Inc.', exchange: 'Korea', country: 'South Korea', currency: 'KRW', typeDisp: 'Stock', quoteType: 'Common Stock', mappedAssetType: 'stock', avatarInitials: 'SK', avatarBg: '#0284c7' },
  { symbol: 'BINANCE:BTCUSDT', name: 'Bitcoin (BTC)', exchange: 'Binance', country: 'Global', currency: 'USD', typeDisp: 'Crypto', quoteType: 'Crypto', mappedAssetType: 'crypto', avatarInitials: '₿', avatarBg: '#f59e0b' },
  { symbol: 'BINANCE:ETHUSDT', name: 'Ethereum (ETH)', exchange: 'Binance', country: 'Global', currency: 'USD', typeDisp: 'Crypto', quoteType: 'Crypto', mappedAssetType: 'crypto', avatarInitials: 'Ξ', avatarBg: '#6366f1' },
];

export const GETQUIN_TOP_MOVERS: SearchSymbolResult[] = [
  CURATED_ASSETS[2], // NVDA
  CURATED_ASSETS[5], // TSLA
  CURATED_ASSETS[6], // SXR8.DE
].filter(Boolean);

export const GETQUIN_DEFAULT_LAST_SEARCHES: SearchSymbolResult[] = [
  CURATED_ASSETS[0], // AAPL
  CURATED_ASSETS[1], // MSFT
  CURATED_ASSETS[7], // VWCE.DE
].filter(Boolean);

export const GETQUIN_MOST_SEARCHED: SearchSymbolResult[] = [
  CURATED_ASSETS[0], // AAPL
  CURATED_ASSETS[2], // NVDA
  CURATED_ASSETS[1], // MSFT
  CURATED_ASSETS[6], // SXR8.DE
].filter(Boolean);

function mapTypeToAssetType(type: string, symbol: string): AssetType {
  const t = (type || '').toLowerCase();
  const s = (symbol || '').toUpperCase();

  if (t.includes('etf') || t.includes('etp') || t.includes('fund') || t.includes('trust') || s.includes('ETF')) {
    return 'etf';
  }
  if (t.includes('crypto') || t.includes('digital') || s.includes('BTC') || s.includes('ETH') || s.startsWith('BINANCE:')) {
    return 'crypto';
  }
  if (t.includes('currency') || s.includes('CASH') || (s.includes('EUR') && s.length <= 4)) {
    return 'cash';
  }
  return 'stock';
}

function getInitials(name: string, symbol: string): string {
  if (symbol.includes(':')) return symbol.split(':')[1].slice(0, 3);
  if (symbol.includes('/')) return symbol.split('/')[0].slice(0, 3);
  if (symbol.includes('-')) return symbol.split('-')[0].slice(0, 3);

  const cleanName = (name || '').replace(/Inc\.?|Corp\.?|ETF|Holdings|Company|Corporation|S\.A\.?/gi, '').trim();
  const parts = cleanName.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (symbol || 'AS').slice(0, 2).toUpperCase();
}

const BG_PALETTE = ['#0284c7', '#2563eb', '#0f766e', '#16a34a', '#d97706', '#dc2626', '#4f46e5', '#475569'];
function getAvatarBg(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % BG_PALETTE.length;
  return BG_PALETTE[index];
}

/**
 * Searches official Finnhub Symbol Search API:
 * https://finnhub.io/api/v1/search?q=QUERY&token=daeb3chr01ql3jf9o350daeb3chr01ql3jf9o35g
 */
export async function searchFinnhubSymbols(query: string): Promise<SearchSymbolResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // Instant local match from curated list for fast feedback
  const qLower = trimmed.toLowerCase();
  const localMatches = CURATED_ASSETS.filter(
    (a) => a.symbol.toLowerCase().includes(qLower) || a.name.toLowerCase().includes(qLower)
  );

  try {
    const url = `${FINNHUB_BASE_URL}/search?q=${encodeURIComponent(trimmed)}&token=${FINNHUB_API_KEY}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const json = await response.json();
      const items: any[] = json?.result || [];

      const remoteResults: SearchSymbolResult[] = items
        .filter((item) => item && (item.symbol || item.displaySymbol))
        .map((item) => {
          const sym = (item.displaySymbol || item.symbol || '').toUpperCase();
          const name = item.description || sym;
          const rawType = item.type || 'Common Stock';

          let typeDisp = 'Stock';
          if (rawType.toLowerCase().includes('etf') || rawType.toLowerCase().includes('etp')) typeDisp = 'ETF';
          else if (rawType.toLowerCase().includes('fund') || rawType.toLowerCase().includes('trust')) typeDisp = 'Fund';
          else if (rawType.toLowerCase().includes('crypto')) typeDisp = 'Crypto';

          return {
            symbol: sym,
            name,
            exchange: sym.includes('.') ? sym.split('.')[1] : '',
            country: '',
            currency: '',
            typeDisp,
            quoteType: rawType,
            mappedAssetType: mapTypeToAssetType(rawType, sym),
            avatarInitials: getInitials(name, sym),
            avatarBg: getAvatarBg(sym),
          };
        });

      // Combine local and remote results avoiding duplicate symbols
      const combined = [...localMatches];
      const seen = new Set(localMatches.map((m) => m.symbol.toUpperCase()));

      remoteResults.forEach((r) => {
        const key = r.symbol.toUpperCase();
        if (!seen.has(key)) {
          seen.add(key);
          combined.push(r);
        }
      });

      return combined.slice(0, 30);
    }
  } catch (err) {
    console.warn('Finnhub symbol search error, returning fallback matches:', err);
  }

  return localMatches;
}

// Aliases for seamless backward compatibility
export const searchTwelveDataSymbols = searchFinnhubSymbols;
export const searchYahooFinanceSymbols = searchFinnhubSymbols;

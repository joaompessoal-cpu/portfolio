export type AssetType = 'etf' | 'stock' | 'crypto' | 'cash';

export interface Holding {
  id: string;
  ticker: string;
  name: string;
  shares: number;
  buyPrice: number; // in base currency or native
  currentPrice: number;
  change24h: number;
  change24hPercent: number;
  assetType: AssetType;
  currency: 'EUR' | 'USD';
  purchaseDate?: string;
  lastUpdated?: string;
}

export interface PortfolioStats {
  totalValue: number;
  totalCost: number;
  totalProfit: number;
  totalProfitPercent: number;
  dailyProfit: number;
  dailyProfitPercent: number;
  pwrAnnualized: number;
}

export interface QuoteData {
  symbol: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  currency?: string;
}

export type ChartRange = '1D' | '1W' | '1M' | 'YTD' | '1Y' | 'Max';

export interface HistoricalPricePoint {
  timestamp: number; // in milliseconds
  dateStr: string;
  price: number;
}

export interface CandlePoint {
  timestamp: number; // in milliseconds
  dateStr: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface RealCompanyProfile {
  name?: string;
  description?: string;
  sector?: string;
  industry?: string;
  website?: string;
  marketCap?: number;
  peRatio?: number;
  dividendYield?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  currency?: string;
}

export interface RealChartData {
  symbol: string;
  currency: string;
  range: ChartRange;
  currentPrice: number;
  previousClose: number;
  priceChange: number;
  priceChangePercent: number;
  points: HistoricalPricePoint[];
  candles?: CandlePoint[];
  high: number;
  low: number;
  companyProfile?: RealCompanyProfile;
}


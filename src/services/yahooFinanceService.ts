import { QuoteData, ChartRange, RealChartData, HistoricalPricePoint, CandlePoint } from '../types';

/**
 * Normalizes symbols for Yahoo Finance API
 * e.g.
 * - GOOGL.US -> GOOGL
 * - SKHY.US / SKHY -> 000660.KS
 * - SXR8.DE -> SXR8.DE
 * - BINANCE:BTCUSDT / BTC-USD -> BTC-USD
 */
export function normalizeTickerForYahoo(ticker: string): string {
  if (!ticker) return '';
  const raw = ticker.trim().toUpperCase();

  const OVERRIDES: Record<string, string> = {
    'SKHY.US': '000660.KS',
    'SKHY': '000660.KS',
    '000660.KS': '000660.KS',
    'SPCX.US': 'DXYZ',
    'SPCX': 'DXYZ',
    'BTC-USD': 'BTC-USD',
    'BINANCE:BTCUSDT': 'BTC-USD',
    'BINANCE:ETHUSDT': 'ETH-USD',
  };

  if (OVERRIDES[raw]) return OVERRIDES[raw];

  if (raw.endsWith('.US')) {
    return raw.slice(0, -3);
  }

  return raw;
}

/**
 * Maps app ChartRange to Yahoo Finance range & interval
 */
function getYahooRangeAndInterval(range: ChartRange): { range: string; interval: string } {
  switch (range) {
    case '1D':
      return { range: '1d', interval: '5m' };
    case '1W':
      return { range: '5d', interval: '15m' };
    case '1M':
      return { range: '1mo', interval: '1d' };
    case 'YTD':
      return { range: 'ytd', interval: '1d' };
    case '1Y':
      return { range: '1y', interval: '1d' };
    case 'Max':
      return { range: '5y', interval: '1wk' };
    default:
      return { range: '1mo', interval: '1d' };
  }
}

/**
 * Requests Yahoo chart data via local proxy (/api/yahoo) with fallback
 */
async function queryYahooRaw(symbol: string, rangeStr: string, intervalStr: string): Promise<any | null> {
  const cleanSym = normalizeTickerForYahoo(symbol);
  if (!cleanSym) return null;

  // 1. First try local proxy
  try {
    const localUrl = `/api/yahoo?symbol=${encodeURIComponent(cleanSym)}&range=${rangeStr}&interval=${intervalStr}`;
    const res = await fetch(localUrl);
    if (res.ok) {
      const data = await res.json();
      if (data?.chart?.result?.[0]) {
        return data.chart.result[0];
      }
    }
  } catch (err) {
    // continue to fallback
  }

  // 2. Direct / CORS proxy fallback
  try {
    const directUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      cleanSym
    )}?range=${rangeStr}&interval=${intervalStr}`;
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(directUrl)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(proxyUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data?.chart?.result?.[0]) {
        return data.chart.result[0];
      }
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Fetches real-time quote from Yahoo Finance
 */
export async function fetchYahooQuote(symbol: string): Promise<QuoteData | null> {
  const cleanSym = normalizeTickerForYahoo(symbol);
  if (!cleanSym) return null;

  try {
    const raw = await queryYahooRaw(cleanSym, '5d', '1d');
    if (!raw) return null;

    const meta = raw.meta;
    const currentPrice = meta?.regularMarketPrice || meta?.chartPreviousClose || 0;
    if (!currentPrice || currentPrice <= 0) return null;

    const prevClose = meta?.chartPreviousClose || currentPrice;
    const change = meta?.regularMarketPrice ? +(currentPrice - prevClose).toFixed(2) : 0;
    const changePct = meta?.regularMarketChangePercent
      ? +meta.regularMarketChangePercent.toFixed(2)
      : prevClose > 0
      ? +(((currentPrice - prevClose) / prevClose) * 100).toFixed(2)
      : 0;

    return {
      symbol: cleanSym,
      regularMarketPrice: +currentPrice.toFixed(2),
      regularMarketChange: change,
      regularMarketChangePercent: changePct,
      currency: meta?.currency || 'USD',
    };
  } catch (err) {
    console.warn(`Yahoo Finance quote failed for ${symbol}:`, err);
    return null;
  }
}

/**
 * Fetches historical candle and line chart data from Yahoo Finance
 */
export async function fetchYahooChart(
  symbol: string,
  range: ChartRange = '1D'
): Promise<RealChartData | null> {
  const cleanSym = normalizeTickerForYahoo(symbol);
  if (!cleanSym) return null;

  const { range: rangeStr, interval: intervalStr } = getYahooRangeAndInterval(range);

  try {
    const raw = await queryYahooRaw(cleanSym, rangeStr, intervalStr);
    if (!raw) return null;

    const timestamps: number[] = raw.timestamp || [];
    const quote = raw.indicators?.quote?.[0];
    if (!timestamps.length || !quote) return null;

    const opens = quote.open || [];
    const highs = quote.high || [];
    const lows = quote.low || [];
    const closes = quote.close || [];
    const volumes = quote.volume || [];

    const points: HistoricalPricePoint[] = [];
    const candles: CandlePoint[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const closeVal = closes[i];
      if (typeof closeVal !== 'number' || isNaN(closeVal) || closeVal <= 0) continue;

      const tsMs = timestamps[i] * 1000;
      const openVal = typeof opens[i] === 'number' && !isNaN(opens[i]) ? opens[i] : closeVal;
      const highVal = typeof highs[i] === 'number' && !isNaN(highs[i]) ? highs[i] : closeVal;
      const lowVal = typeof lows[i] === 'number' && !isNaN(lows[i]) ? lows[i] : closeVal;
      const volVal = volumes[i];

      const d = new Date(tsMs);
      const dateStr =
        range === '1D'
          ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : range === '1W' || range === '1M'
          ? d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
          : d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });

      points.push({
        timestamp: tsMs,
        dateStr,
        price: +closeVal.toFixed(2),
      });

      candles.push({
        timestamp: tsMs,
        dateStr,
        open: +openVal.toFixed(2),
        high: +highVal.toFixed(2),
        low: +lowVal.toFixed(2),
        close: +closeVal.toFixed(2),
        volume: volVal,
      });
    }

    if (points.length === 0) return null;

    // Extend to now for weekend continuity
    const nowMs = Date.now();
    const lastPoint = points[points.length - 1];
    if (nowMs - lastPoint.timestamp > 30 * 60 * 1000) {
      const nowD = new Date(nowMs);
      const nowDateStr =
        range === '1D'
          ? nowD.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : nowD.toLocaleDateString([], { month: 'short', day: 'numeric' });

      points.push({
        timestamp: nowMs,
        dateStr: nowDateStr,
        price: lastPoint.price,
      });

      if (candles.length > 0) {
        const lastCandle = candles[candles.length - 1];
        candles.push({
          timestamp: nowMs,
          dateStr: nowDateStr,
          open: lastCandle.close,
          high: lastCandle.close,
          low: lastCandle.close,
          close: lastCandle.close,
          volume: 0,
        });
      }
    }

    const currentPrice = points[points.length - 1].price;
    const previousClose = raw.meta?.chartPreviousClose || points[0].price;
    const priceChange = +(currentPrice - previousClose).toFixed(2);
    const priceChangePercent =
      previousClose > 0 ? +((priceChange / previousClose) * 100).toFixed(2) : 0;

    const prices = points.map((p) => p.price);
    const high = Math.max(...prices);
    const low = Math.min(...prices);

    return {
      symbol: cleanSym,
      currency: raw.meta?.currency || 'USD',
      range,
      currentPrice: +currentPrice.toFixed(2),
      previousClose: +previousClose.toFixed(2),
      priceChange,
      priceChangePercent,
      points,
      candles,
      high,
      low,
    };
  } catch (err) {
    console.warn(`Yahoo Finance chart failed for ${symbol}:`, err);
    return null;
  }
}

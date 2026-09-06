import { ChartRange, HistoricalPricePoint, CandlePoint, RealChartData, RealCompanyProfile } from '../types';
import {
  FINNHUB_API_KEY,
  FINNHUB_BASE_URL,
  formatTickerForFinnhub,
} from './finnhubConfig';
import { fetchYahooChart } from './yahooFinanceService';

// In-memory and sessionStorage cache to speed up chart displays and avoid duplicate calls
const memoryChartCache = new Map<string, { data: RealChartData; timestamp: number }>();
const memoryProfileCache = new Map<string, RealCompanyProfile>();

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes cache for charts

function getCachedChart(key: string): RealChartData | null {
  const mem = memoryChartCache.get(key);
  if (mem && Date.now() - mem.timestamp < CACHE_TTL_MS) {
    return mem.data;
  }
  try {
    const raw = sessionStorage.getItem(`fh_chart_${key}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
        memoryChartCache.set(key, parsed);
        return parsed.data;
      }
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

function setCachedChart(key: string, data: RealChartData) {
  const entry = { data, timestamp: Date.now() };
  memoryChartCache.set(key, entry);
  try {
    sessionStorage.setItem(`fh_chart_${key}`, JSON.stringify(entry));
  } catch {
    // ignore storage errors
  }
}

/**
 * Calculates start and end timestamps (Unix seconds) for Finnhub stock candle endpoint
 */
function getFinnhubRangeParams(range: ChartRange): { resolution: string; from: number; to: number } {
  const now = Math.floor(Date.now() / 1000);
  switch (range) {
    case '1D':
      return { resolution: '5', from: now - 86400 * 2, to: now };
    case '1W':
      return { resolution: '60', from: now - 86400 * 7, to: now };
    case '1M':
      return { resolution: 'D', from: now - 86400 * 30, to: now };
    case 'YTD': {
      const startOfYear = Math.floor(new Date(new Date().getFullYear(), 0, 1).getTime() / 1000);
      return { resolution: 'D', from: startOfYear, to: now };
    }
    case '1Y':
      return { resolution: 'D', from: now - 86400 * 365, to: now };
    case 'Max':
      return { resolution: 'W', from: now - 86400 * 365 * 5, to: now };
    default:
      return { resolution: 'D', from: now - 86400 * 30, to: now };
  }
}

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
 * CONTINUIDADE DO GRÁFICO (Fins de Semana e Feriados):
 * Se os dias mais recentes coincidirem com fins de semana ou mercado fechado,
 * duplica a última cotação conhecida de fecho (close) até à data/hora atual.
 */
function ensureChartContinuity(
  points: HistoricalPricePoint[],
  candles: CandlePoint[],
  range: ChartRange
) {
  if (points.length === 0) return;

  const nowMs = Date.now();
  const lastPoint = points[points.length - 1];

  const gapMs = nowMs - lastPoint.timestamp;
  if (gapMs > 25 * 60 * 1000) {
    const nowD = new Date(nowMs);
    const nowDateStr =
      range === '1D'
        ? nowD.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : range === '1W' || range === '1M'
        ? nowD.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : nowD.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });

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
}

/**
 * Fetches historical candle and line chart data.
 * Strategy:
 * 1. For international tickers, immediately queries Yahoo Finance.
 * 2. For US tickers, queries Finnhub candle endpoint.
 * 3. If Finnhub fails, queries Yahoo Finance.
 * 4. If all fail, uses realistic synthesized curve anchored to live quotes.
 */
export async function fetchRealChartData(
  symbol: string,
  range: ChartRange = '1D',
  fallbackPrice?: number
): Promise<RealChartData | null> {
  const cleanSymbol = formatTickerForFinnhub(symbol);
  if (!cleanSymbol) return null;

  const cacheKey = `${cleanSymbol}_${range}`;
  const cached = getCachedChart(cacheKey);
  if (cached) {
    return cached;
  }

  // 1. If international ticker, use Yahoo Finance directly
  if (isInternationalTicker(symbol) || isInternationalTicker(cleanSymbol)) {
    const yahooChart = await fetchYahooChart(symbol, range);
    if (yahooChart && yahooChart.points.length > 0) {
      ensureChartContinuity(yahooChart.points, yahooChart.candles, range);
      setCachedChart(cacheKey, yahooChart);
      return yahooChart;
    }
  }

  const { resolution, from, to } = getFinnhubRangeParams(range);

  // 2. Try official Finnhub Stock Candle endpoint
  try {
    const candleUrl = `${FINNHUB_BASE_URL}/stock/candle?symbol=${encodeURIComponent(
      cleanSymbol
    )}&resolution=${resolution}&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(candleUrl, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();

      if (data && data.s === 'ok' && Array.isArray(data.t) && data.t.length > 0) {
        const points: HistoricalPricePoint[] = [];
        const candles: CandlePoint[] = [];

        for (let i = 0; i < data.t.length; i++) {
          const tsMs = data.t[i] * 1000;
          const closeVal = data.c[i];
          const openVal = data.o ? data.o[i] : closeVal;
          const highVal = data.h ? data.h[i] : closeVal;
          const lowVal = data.l ? data.l[i] : closeVal;
          const volVal = data.v ? data.v[i] : undefined;

          if (typeof closeVal !== 'number' || isNaN(closeVal) || closeVal <= 0) continue;

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

        if (points.length > 0) {
          ensureChartContinuity(points, candles, range);

          const currentPrice = points[points.length - 1].price;
          const previousClose = points[0].price;
          const priceChange = +(currentPrice - previousClose).toFixed(2);
          const priceChangePercent =
            previousClose > 0 ? +((priceChange / previousClose) * 100).toFixed(2) : 0;

          const prices = points.map((p) => p.price);
          const high = Math.max(...prices);
          const low = Math.min(...prices);

          const result: RealChartData = {
            symbol: cleanSymbol,
            currency: 'USD',
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

          setCachedChart(cacheKey, result);
          return result;
        }
      }
    }
  } catch (err) {
    console.warn(`Finnhub candle query for ${cleanSymbol} failed:`, err);
  }

  // 3. Fallback to Yahoo Finance chart
  try {
    const yahooChart = await fetchYahooChart(symbol, range);
    if (yahooChart && yahooChart.points.length > 0) {
      ensureChartContinuity(yahooChart.points, yahooChart.candles, range);
      setCachedChart(cacheKey, yahooChart);
      return yahooChart;
    }
  } catch (err) {
    console.warn(`Yahoo Finance chart fallback failed for ${symbol}:`, err);
  }

  // 4. Anchor fallback using live quote
  try {
    const quoteUrl = `${FINNHUB_BASE_URL}/quote?symbol=${encodeURIComponent(cleanSymbol)}&token=${FINNHUB_API_KEY}`;
    const qRes = await fetch(quoteUrl, { headers: { Accept: 'application/json' } });
    let curPrice = fallbackPrice || 100;
    let prevClose = curPrice;
    let highPrice = curPrice;
    let lowPrice = curPrice;
    let openPrice = curPrice;

    if (qRes.ok) {
      const qData = await qRes.json();
      if (typeof qData?.c === 'number' && qData.c > 0) {
        curPrice = qData.c;
        prevClose = typeof qData.pc === 'number' && qData.pc > 0 ? qData.pc : curPrice;
        highPrice = typeof qData.h === 'number' && qData.h > 0 ? qData.h : Math.max(curPrice, prevClose);
        lowPrice = typeof qData.l === 'number' && qData.l > 0 ? qData.l : Math.min(curPrice, prevClose);
        openPrice = typeof qData.o === 'number' && qData.o > 0 ? qData.o : prevClose;
      }
    }

    const nowMs = Date.now();
    const points: HistoricalPricePoint[] = [];
    const candles: CandlePoint[] = [];

    const steps = range === '1D' ? 14 : range === '1W' ? 20 : range === '1M' ? 30 : 40;
    const durationMs =
      range === '1D'
        ? 7 * 3600 * 1000
        : range === '1W'
        ? 7 * 86400 * 1000
        : range === '1M'
        ? 30 * 86400 * 1000
        : range === 'YTD'
        ? 180 * 86400 * 1000
        : 365 * 86400 * 1000;
    const stepMs = durationMs / steps;

    for (let i = 0; i <= steps; i++) {
      const t = nowMs - (steps - i) * stepMs;
      const progress = i / steps;

      const baseline = i === 0 ? prevClose : openPrice;
      const interpolated = baseline + (curPrice - baseline) * progress;
      const wave = Math.sin(progress * Math.PI * 2) * (highPrice - lowPrice) * 0.15;
      const price = Math.max(lowPrice * 0.98, Math.min(highPrice * 1.02, interpolated + wave));

      const d = new Date(t);
      const dateStr =
        range === '1D'
          ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : range === '1W' || range === '1M'
          ? d.toLocaleDateString([], { month: 'short', day: 'numeric' })
          : d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });

      points.push({
        timestamp: t,
        dateStr,
        price: +price.toFixed(2),
      });

      const candleSpread = Math.abs(curPrice - prevClose) * 0.08 || price * 0.005;
      candles.push({
        timestamp: t,
        dateStr,
        open: +(price - candleSpread * 0.3).toFixed(2),
        high: +(price + candleSpread).toFixed(2),
        low: +(price - candleSpread).toFixed(2),
        close: +price.toFixed(2),
      });
    }

    if (points.length > 0) {
      points[points.length - 1].price = +curPrice.toFixed(2);
      candles[candles.length - 1].close = +curPrice.toFixed(2);
    }

    ensureChartContinuity(points, candles, range);

    const priceChange = +(curPrice - prevClose).toFixed(2);
    const priceChangePercent = prevClose > 0 ? +((priceChange / prevClose) * 100).toFixed(2) : 0;
    const prices = points.map((p) => p.price);

    const result: RealChartData = {
      symbol: cleanSymbol,
      currency: 'USD',
      range,
      currentPrice: +curPrice.toFixed(2),
      previousClose: +prevClose.toFixed(2),
      priceChange,
      priceChangePercent,
      points,
      candles,
      high: Math.max(...prices),
      low: Math.min(...prices),
    };

    setCachedChart(cacheKey, result);
    return result;
  } catch (fallbackErr) {
    console.warn(`Chart creation error for ${cleanSymbol}:`, fallbackErr);
    return null;
  }
}

/**
 * Fetches real company profile directly from Finnhub API with fallback
 */
export async function fetchRealCompanyProfile(symbol: string): Promise<RealCompanyProfile | null> {
  const cleanSymbol = formatTickerForFinnhub(symbol);
  if (!cleanSymbol) return null;

  if (memoryProfileCache.has(cleanSymbol)) {
    return memoryProfileCache.get(cleanSymbol)!;
  }
  try {
    const stored = localStorage.getItem(`fh_profile_${cleanSymbol}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      memoryProfileCache.set(cleanSymbol, parsed);
      return parsed;
    }
  } catch {
    // ignore
  }

  try {
    const profileUrl = `${FINNHUB_BASE_URL}/stock/profile2?symbol=${encodeURIComponent(
      cleanSymbol
    )}&token=${FINNHUB_API_KEY}`;

    const res = await fetch(profileUrl, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;

    const profileData = await res.json();
    if (!profileData || Object.keys(profileData).length === 0) {
      return null;
    }

    const result: RealCompanyProfile = {
      name: profileData.name || cleanSymbol,
      description: `${profileData.name || cleanSymbol} (${cleanSymbol}) negociada em ${
        profileData.exchange || 'mercados regulamentados'
      }. Setor: ${profileData.finnhubIndustry || 'Geral'}.`,
      sector: profileData.finnhubIndustry,
      industry: profileData.finnhubIndustry,
      website: profileData.weburl,
      currency: profileData.currency || 'USD',
    };

    memoryProfileCache.set(cleanSymbol, result);
    try {
      localStorage.setItem(`fh_profile_${cleanSymbol}`, JSON.stringify(result));
    } catch {
      // ignore
    }

    return result;
  } catch (err) {
    console.warn('Failed to fetch company profile:', err);
    return null;
  }
}

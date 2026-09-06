import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Star,
  MoreHorizontal,
  TrendingUp,
  TrendingDown,
  Loader2,
  Globe,
  Building2,
  Plus,
  Check,
  Calendar,
  DollarSign,
  PieChart,
  BarChart3,
  X,
} from 'lucide-react';
import { ChartRange, RealChartData, RealCompanyProfile, Holding } from '../types';
import { fetchRealChartData, fetchRealCompanyProfile } from '../services/historicalChartService';
import { formatCurrency, formatPercent, ASSET_TYPE_COLORS } from '../utils/formatters';

interface AssetDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  name?: string;
  currentHolding?: Holding | null;
  baseCurrency: 'EUR' | 'USD';
  onAddToPortfolio?: (holding: Omit<Holding, 'id'>) => void;
  onUpdateHolding?: (holding: Holding) => void;
}

export const AssetDetailModal: React.FC<AssetDetailModalProps> = ({
  isOpen,
  onClose,
  symbol,
  name,
  currentHolding,
  baseCurrency,
  onAddToPortfolio,
  onUpdateHolding,
}) => {
  const [range, setRange] = useState<ChartRange>('1D');
  const [chartType, setChartType] = useState<'line' | 'candles'>('line');
  const [activeTab, setActiveTab] = useState<'fundamentals' | 'portfolio' | 'dividends'>('fundamentals');
  const [chartData, setChartData] = useState<RealChartData | null>(null);
  const [profile, setProfile] = useState<RealCompanyProfile | null>(null);
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const [hoveredBuyDot, setHoveredBuyDot] = useState(false);
  const [isBuyDotPinned, setIsBuyDotPinned] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [expandedInfo, setExpandedInfo] = useState(false);

  // Edit holding state
  const [isEditingHolding, setIsEditingHolding] = useState(false);
  const [editShares, setEditShares] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editDate, setEditDate] = useState('');

  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Sync editing fields when holding changes
  useEffect(() => {
    if (currentHolding) {
      setEditShares(String(currentHolding.shares));
      setEditPrice(String(currentHolding.buyPrice));
      setEditDate(currentHolding.purchaseDate || new Date().toISOString().split('T')[0]);
    }
  }, [currentHolding]);

  // Reset states when symbol opens
  useEffect(() => {
    if (isOpen && symbol) {
      let initialRange: ChartRange = '1D';
      if (currentHolding?.purchaseDate) {
        const pTs = new Date(currentHolding.purchaseDate).getTime();
        if (!isNaN(pTs) && Date.now() - pTs > 2 * 86400 * 1000) {
          initialRange = Date.now() - pTs > 45 * 86400 * 1000 ? '1Y' : '1M';
        }
      }

      setRange(initialRange);
      setHoveredPointIndex(null);
      setHoveredBuyDot(false);
      setIsBuyDotPinned(false);
      setExpandedInfo(false);
      setIsEditingHolding(false);
      loadChartData(symbol, initialRange);
      loadProfileData(symbol);
    }
  }, [isOpen, symbol, currentHolding?.purchaseDate]);

  const handleRangeChange = (newRange: ChartRange) => {
    setRange(newRange);
    setHoveredPointIndex(null);
    if (symbol) {
      loadChartData(symbol, newRange);
    }
  };

  const loadChartData = async (sym: string, rng: ChartRange) => {
    setIsLoadingChart(true);
    try {
      const data = await fetchRealChartData(sym, rng, currentHolding?.buyPrice);
      setChartData(data);
    } catch (err) {
      console.error('Error fetching real chart data:', err);
    } finally {
      setIsLoadingChart(false);
    }
  };

  const loadProfileData = async (sym: string) => {
    setIsLoadingProfile(true);
    try {
      const p = await fetchRealCompanyProfile(sym);
      setProfile(p);
    } catch (err) {
      console.error('Error fetching real company profile:', err);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const displayPoint = useMemo(() => {
    if (!chartData || chartData.points.length === 0) return null;
    if (hoveredPointIndex !== null && chartData.points[hoveredPointIndex]) {
      return chartData.points[hoveredPointIndex];
    }
    return chartData.points[chartData.points.length - 1];
  }, [chartData, hoveredPointIndex]);

  const displayCandle = useMemo(() => {
    if (!chartData?.candles || chartData.candles.length === 0) return null;
    if (hoveredPointIndex !== null && chartData.candles[hoveredPointIndex]) {
      return chartData.candles[hoveredPointIndex];
    }
    return chartData.candles[chartData.candles.length - 1];
  }, [chartData, hoveredPointIndex]);

  const displayPrice = displayPoint ? displayPoint.price : chartData?.currentPrice ?? 0;
  const baselinePrice = chartData?.previousClose ?? displayPrice;
  const displayChange = +(displayPrice - baselinePrice).toFixed(2);
  const displayChangePercent =
    baselinePrice > 0 ? +((displayChange / baselinePrice) * 100).toFixed(2) : 0;
  const isPositive = displayChange >= 0;

  // Render SVG Path and coordinates
  const { pathD, baselineY, svgWidth, svgHeight, getY, getX, candlesList } = useMemo(() => {
    const width = 600;
    const height = 240;

    if (!chartData || chartData.points.length < 2) {
      return {
        pathD: '',
        baselineY: height / 2,
        svgWidth: width,
        svgHeight: height,
        getY: () => height / 2,
        getX: () => 0,
        candlesList: [],
      };
    }

    const prices = chartData.points.map((p) => p.price);
    const candleHighs = chartData.candles?.map((c) => c.high) || [];
    const candleLows = chartData.candles?.map((c) => c.low) || [];
    const buyP = currentHolding?.buyPrice ? [currentHolding.buyPrice] : [];

    const allPrices = [...prices, ...candleHighs, ...candleLows, baselinePrice, ...buyP];
    let minP = Math.min(...allPrices);
    let maxP = Math.max(...allPrices);
    if (minP === maxP) {
      minP = minP * 0.95;
      maxP = maxP * 1.05;
    } else {
      const padding = (maxP - minP) * 0.12;
      minP -= padding;
      maxP += padding;
    }
    const rangeP = maxP - minP || 1;

    const padTop = 15;
    const padBottom = 25;
    const usableHeight = height - padTop - padBottom;

    const getY = (price: number) => {
      const norm = (price - minP) / rangeP;
      return height - padBottom - norm * usableHeight;
    };

    const getX = (index: number, total: number) => {
      return (index / (total - 1 || 1)) * width;
    };

    let d = '';
    chartData.points.forEach((pt, i) => {
      const x = getX(i, chartData.points.length);
      const y = getY(pt.price);
      if (i === 0) {
        d += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      } else {
        d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
    });

    const bY = getY(baselinePrice);

    return {
      pathD: d,
      baselineY: bY,
      svgWidth: width,
      svgHeight: height,
      getY,
      getX,
      candlesList: chartData.candles || [],
    };
  }, [chartData, baselinePrice, currentHolding]);

  // Compute transaction dot position on chart
  const buyDotPoint = useMemo(() => {
    if (!currentHolding || !currentHolding.buyPrice || !chartData || chartData.points.length < 2) {
      return null;
    }

    const buyPrice = currentHolding.buyPrice;
    const purchaseDate = currentHolding.purchaseDate;

    let targetIndex = -1;
    let isBeforeRange = false;
    let isAfterRange = false;

    if (purchaseDate) {
      const purchaseTs = new Date(purchaseDate).getTime();
      if (!isNaN(purchaseTs)) {
        const firstTs = chartData.points[0].timestamp;
        const lastTs = chartData.points[chartData.points.length - 1].timestamp;

        if (purchaseTs < firstTs - 86400 * 1000) {
          isBeforeRange = true;
          targetIndex = 0;
        } else if (purchaseTs > lastTs + 86400 * 1000) {
          isAfterRange = true;
          targetIndex = chartData.points.length - 1;
        } else {
          let minDiff = Infinity;
          chartData.points.forEach((pt, idx) => {
            const diff = Math.abs(pt.timestamp - purchaseTs);
            if (diff < minDiff) {
              minDiff = diff;
              targetIndex = idx;
            }
          });
        }
      }
    }

    if (targetIndex === -1) {
      targetIndex = Math.floor(chartData.points.length / 2);
    }

    const x = getX(targetIndex, chartData.points.length);
    const y = getY(buyPrice);

    return {
      x,
      y,
      buyPrice,
      shares: currentHolding.shares,
      purchaseDate: purchaseDate || 'Data registada',
      isBeforeRange,
      isAfterRange,
    };
  }, [currentHolding, chartData, getX, getY]);

  const handleChartMouseMove = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
    if (!chartContainerRef.current || !chartData || chartData.points.length < 2) return;
    const rect = chartContainerRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const relativeX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const ratio = relativeX / rect.width;
    const pointIdx = Math.round(ratio * (chartData.points.length - 1));
    setHoveredPointIndex(Math.max(0, Math.min(chartData.points.length - 1, pointIdx)));
  };

  const handleChartMouseLeave = () => {
    setHoveredPointIndex(null);
  };

  if (!isOpen) return null;

  const displayCurrency = chartData?.currency || baseCurrency;
  const currencySymbol = displayCurrency === 'USD' ? '$' : '€';
  const assetDisplayName = profile?.name || name || symbol;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-4">
      <div
        className="w-full sm:max-w-lg bg-white h-[90vh] sm:h-auto sm:max-h-[92vh] rounded-t-[28px] sm:rounded-3xl border border-slate-200/80 shadow-2xl flex flex-col overflow-hidden text-slate-900 pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        {/* iOS Drag Handle */}
        <div className="w-10 h-1 rounded-full bg-slate-300 mx-auto mt-2 sm:hidden shrink-0" />

        {/* Top App Bar */}
        <div className="px-5 pt-3 pb-2 flex items-center justify-between border-b border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer touch-manipulation"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsFavorite(!isFavorite)}
              className={`w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer touch-manipulation ${
                isFavorite ? 'text-amber-500' : 'text-slate-500'
              }`}
              title="Favorito"
            >
              <Star className={`w-4 h-4 ${isFavorite ? 'fill-amber-500' : ''}`} />
            </button>
          </div>
        </div>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 no-scrollbar">
          {/* Asset Identity Header */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-sm font-black text-blue-600 shadow-xs">
              {symbol.slice(0, 3).toUpperCase()}
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-snug">
                {assetDisplayName}
              </h1>
              <p className="text-xs font-mono font-semibold text-slate-500 tracking-wider uppercase">
                {symbol}
              </p>
            </div>
          </div>

          {/* Price and Return */}
          <div className="flex items-baseline justify-between pt-1">
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-base font-bold text-slate-500">{currencySymbol}</span>
                <span className="text-3xl font-extrabold font-mono tracking-tight text-slate-900">
                  {displayPrice.toFixed(2)}
                </span>
              </div>
              {displayPoint && (
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                  {range === '1D' ? 'Hoje ' : ''}
                  {displayPoint.dateStr}
                </p>
              )}
            </div>

            <div className="text-right">
              <div
                className={`flex items-center justify-end gap-1 text-sm font-bold font-mono ${
                  isPositive ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                <span>
                  {isPositive ? '+' : ''}
                  {displayChangePercent.toFixed(2)}%
                </span>
              </div>
              <div
                className={`text-xs font-bold font-mono ${
                  isPositive ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {isPositive ? '+' : ''}
                {currencySymbol}
                {Math.abs(displayChange).toFixed(2)}
              </div>
            </div>
          </div>

          {/* Chart Controls: Style Selector */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl">
              <button
                type="button"
                onClick={() => setChartType('line')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  chartType === 'line'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Linha
              </button>
              <button
                type="button"
                onClick={() => setChartType('candles')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  chartType === 'candles'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Velas
              </button>
            </div>

            {chartType === 'candles' && displayCandle && (
              <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">
                <span>O: {displayCandle.open.toFixed(1)}</span>
                <span className="text-emerald-600">H: {displayCandle.high.toFixed(1)}</span>
                <span className="text-rose-600">L: {displayCandle.low.toFixed(1)}</span>
                <span>C: {displayCandle.close.toFixed(1)}</span>
              </div>
            )}
          </div>

          {/* Real Interactive Chart */}
          <div className="relative">
            <div
              ref={chartContainerRef}
              className="w-full h-52 relative select-none cursor-crosshair touch-none bg-slate-50/60 rounded-2xl border border-slate-100 p-2"
            >
              {isLoadingChart ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  <span className="text-xs font-mono">A carregar dados do mercado...</span>
                </div>
              ) : chartData && chartData.points.length >= 2 ? (
                <>
                  <svg
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                    preserveAspectRatio="none"
                    className="w-full h-full overflow-visible"
                    onMouseMove={handleChartMouseMove}
                    onTouchMove={handleChartMouseMove}
                    onMouseLeave={handleChartMouseLeave}
                    onTouchEnd={handleChartMouseLeave}
                  >
                    {/* Dotted Baseline */}
                    <line
                      x1="0"
                      y1={baselineY}
                      x2={svgWidth}
                      y2={baselineY}
                      stroke="#cbd5e1"
                      strokeWidth="1.2"
                      strokeDasharray="4 4"
                    />

                    {/* LINE MODE */}
                    {chartType === 'line' && (
                      <path
                        d={pathD}
                        fill="none"
                        stroke={isPositive ? '#059669' : '#e11d48'}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}

                    {/* CANDLESTICK MODE */}
                    {chartType === 'candles' &&
                      candlesList.map((c, i) => {
                        const cX = getX(i, candlesList.length);
                        const cWidth = Math.max(2.5, Math.min(10, (svgWidth / candlesList.length) * 0.7));
                        const isBull = c.close >= c.open;
                        const cColor = isBull ? '#059669' : '#e11d48';
                        const bodyY = getY(Math.max(c.open, c.close));
                        const bodyH = Math.max(1.8, Math.abs(getY(c.open) - getY(c.close)));
                        const wickTop = getY(c.high);
                        const wickBottom = getY(c.low);

                        return (
                          <g key={`candle-${c.timestamp}-${i}`}>
                            <line
                              x1={cX}
                              y1={wickTop}
                              x2={cX}
                              y2={wickBottom}
                              stroke={cColor}
                              strokeWidth="1.2"
                            />
                            <rect
                              x={cX - cWidth / 2}
                              y={bodyY}
                              width={cWidth}
                              height={bodyH}
                              fill={cColor}
                              rx="1"
                            />
                          </g>
                        );
                      })}

                    {/* Scrubber crosshair */}
                    {hoveredPointIndex !== null && chartType === 'line' && (
                      <>
                        <line
                          x1={(hoveredPointIndex / (chartData.points.length - 1)) * svgWidth}
                          y1="0"
                          x2={(hoveredPointIndex / (chartData.points.length - 1)) * svgWidth}
                          y2={svgHeight}
                          stroke="#94a3b8"
                          strokeWidth="1"
                          strokeDasharray="2 2"
                        />
                        <circle
                          cx={(hoveredPointIndex / (chartData.points.length - 1)) * svgWidth}
                          cy={
                            svgHeight -
                            25 -
                            ((chartData.points[hoveredPointIndex].price -
                              Math.min(...chartData.points.map((p) => p.price), baselinePrice)) /
                              (Math.max(...chartData.points.map((p) => p.price), baselinePrice) -
                                Math.min(...chartData.points.map((p) => p.price), baselinePrice) ||
                                1)) *
                              (svgHeight - 40)
                          }
                          r="4"
                          fill={isPositive ? '#059669' : '#e11d48'}
                          stroke="#ffffff"
                          strokeWidth="2"
                        />
                      </>
                    )}

                    {/* PONTO DE COMPRA NO GRÁFICO */}
                    {buyDotPoint && (
                      <>
                        <line
                          x1="0"
                          y1={buyDotPoint.y}
                          x2={svgWidth}
                          y2={buyDotPoint.y}
                          stroke="#2563eb"
                          strokeWidth="1"
                          strokeDasharray="4 4"
                          opacity="0.7"
                        />
                        <text
                          x="6"
                          y={Math.max(12, buyDotPoint.y - 4)}
                          fill="#2563eb"
                          fontSize="9"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          Compra: {currencySymbol}{buyDotPoint.buyPrice.toFixed(2)}
                        </text>

                        <g
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredBuyDot(true)}
                          onMouseLeave={() => setHoveredBuyDot(false)}
                          onClick={() => setIsBuyDotPinned(!isBuyDotPinned)}
                        >
                          <circle
                            cx={buyDotPoint.x}
                            cy={buyDotPoint.y}
                            r="5"
                            fill="#2563eb"
                            stroke="#ffffff"
                            strokeWidth="2"
                          />
                        </g>
                      </>
                    )}
                  </svg>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 text-xs">
                  <span>Sem dados históricos para este ativo.</span>
                </div>
              )}
            </div>

            {/* Aviso data de compra anterior ao período */}
            {buyDotPoint && buyDotPoint.isBeforeRange && (
              <div className="flex items-center justify-between px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 mt-2">
                <span className="truncate">
                  Compra em <strong>{buyDotPoint.purchaseDate}</strong> (anterior ao período {range}).
                </span>
                <button
                  type="button"
                  onClick={() => handleRangeChange('Max')}
                  className="font-bold text-blue-600 underline cursor-pointer ml-2 text-[11px]"
                >
                  Ver em Max
                </button>
              </div>
            )}
          </div>

          {/* Time Range Selector */}
          <div className="flex items-center justify-between bg-slate-100 p-0.5 rounded-xl">
            {(['1D', '1W', '1M', 'YTD', '1Y', 'Max'] as ChartRange[]).map((r) => {
              const active = range === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleRangeChange(r)}
                  className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {r}
                </button>
              );
            })}
          </div>

          {/* Section Navigation Tabs */}
          <div className="flex items-center gap-1.5 border-b border-slate-100 pb-1">
            <button
              type="button"
              onClick={() => setActiveTab('fundamentals')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'fundamentals'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              Fundamentos
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('portfolio')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'portfolio'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              Carteira {currentHolding ? '(1)' : ''}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('dividends')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'dividends'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              Dividendos
            </button>
          </div>

          {/* TAB 1: FUNDAMENTALS */}
          {activeTab === 'fundamentals' && (
            <div className="space-y-4">
              {profile?.description && (
                <div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {expandedInfo
                      ? profile.description
                      : `${profile.description.slice(0, 160)}...`}
                  </p>
                  {profile.description.length > 160 && (
                    <button
                      type="button"
                      onClick={() => setExpandedInfo(!expandedInfo)}
                      className="text-xs font-bold text-blue-600 hover:underline mt-1 cursor-pointer"
                    >
                      {expandedInfo ? 'Ver menos' : 'Mais detalhes'}
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase block font-semibold">
                    Máx / Mín (Período)
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-900 mt-0.5 block">
                    {chartData ? `${chartData.high.toFixed(2)} / ${chartData.low.toFixed(2)}` : '—'}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase block font-semibold">
                    52 Semanas
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-900 mt-0.5 block">
                    {profile?.fiftyTwoWeekHigh && profile?.fiftyTwoWeekLow
                      ? `${profile.fiftyTwoWeekHigh.toFixed(2)} / ${profile.fiftyTwoWeekLow.toFixed(2)}`
                      : '—'}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase block font-semibold">
                    P/E Ratio
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-900 mt-0.5 block">
                    {profile?.peRatio ? profile.peRatio.toFixed(2) : 'N/A'}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase block font-semibold">
                    Dividend Yield
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-600 mt-0.5 block">
                    {profile?.dividendYield ? `${profile.dividendYield.toFixed(2)}%` : '0.00%'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PORTFOLIO HOLDINGS */}
          {activeTab === 'portfolio' && (
            <div className="space-y-3">
              {currentHolding ? (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                    <span className="text-xs font-bold text-slate-800">Posição Registada</span>
                    {onUpdateHolding && !isEditingHolding && (
                      <button
                        type="button"
                        onClick={() => setIsEditingHolding(true)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                      >
                        Editar
                      </button>
                    )}
                  </div>

                  {isEditingHolding ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="text-slate-500 block text-[10px] uppercase font-semibold mb-1">
                            Quantidade
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={editShares}
                            onChange={(e) => setEditShares(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-mono focus:border-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-slate-500 block text-[10px] uppercase font-semibold mb-1">
                            Preço Médio ({currencySymbol})
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-mono focus:border-blue-500 outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-slate-500 block text-[10px] uppercase font-semibold mb-1">
                          Data da Compra
                        </label>
                        <input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-mono focus:border-blue-500 outline-none"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60">
                        <button
                          type="button"
                          onClick={() => setIsEditingHolding(false)}
                          className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const s = parseFloat(editShares);
                            const p = parseFloat(editPrice);
                            if (isNaN(s) || isNaN(p) || s <= 0 || p <= 0) return;
                            if (onUpdateHolding && currentHolding) {
                              onUpdateHolding({
                                ...currentHolding,
                                shares: s,
                                buyPrice: p,
                                purchaseDate: editDate || currentHolding.purchaseDate,
                              });
                            }
                            setIsEditingHolding(false);
                          }}
                          className="px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer shadow-xs"
                        >
                          Guardar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">Quantidade</span>
                        <span className="font-mono font-bold text-slate-900 text-sm">
                          {currentHolding.shares.toLocaleString()} cotas
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">Preço Médio</span>
                        <span className="font-mono font-bold text-slate-900 text-sm">
                          {formatCurrency(currentHolding.buyPrice, baseCurrency)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">Data da Transação</span>
                        <span className="font-mono text-slate-700 text-xs">
                          {currentHolding.purchaseDate || 'Registada'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">Valor Atual</span>
                        <span className="font-mono font-bold text-slate-900 text-sm">
                          {formatCurrency(currentHolding.shares * displayPrice, baseCurrency)}
                        </span>
                      </div>
                      <div className="col-span-2 pt-2 border-t border-slate-200/60">
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">Lucro / Prejuízo</span>
                        {(() => {
                          const totalCost = currentHolding.shares * currentHolding.buyPrice;
                          const curVal = currentHolding.shares * displayPrice;
                          const gain = curVal - totalCost;
                          const gainPct = totalCost > 0 ? (gain / totalCost) * 100 : 0;
                          const isGain = gain >= 0;
                          return (
                            <span
                              className={`font-mono font-bold text-sm block mt-0.5 ${
                                isGain ? 'text-emerald-600' : 'text-rose-600'
                              }`}
                            >
                              {gain >= 0 ? '+' : ''}{formatCurrency(gain, baseCurrency)} ({formatPercent(gainPct)})
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-center space-y-3">
                  <p className="text-xs text-slate-500">
                    Ainda não possui <span className="font-bold text-slate-900">{symbol}</span> na sua carteira.
                  </p>
                  {onAddToPortfolio && (
                    <button
                      type="button"
                      onClick={() => {
                        onAddToPortfolio({
                          ticker: symbol,
                          name: assetDisplayName,
                          shares: 1,
                          buyPrice: displayPrice,
                          currentPrice: displayPrice,
                          change24h: displayChange,
                          change24hPercent: displayChangePercent,
                          assetType: 'stock',
                          currency: baseCurrency,
                          purchaseDate: new Date().toISOString().split('T')[0],
                        });
                        onClose();
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Adicionar à Carteira
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DIVIDENDS */}
          {activeTab === 'dividends' && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-semibold">Yield Anualizado</span>
                <span className="text-sm font-mono font-bold text-emerald-600">
                  {profile?.dividendYield ? `${profile.dividendYield.toFixed(2)}%` : '0.00%'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-semibold">Moeda de Pagamento</span>
                <span className="text-xs font-mono font-bold text-slate-800 uppercase">
                  {displayCurrency}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

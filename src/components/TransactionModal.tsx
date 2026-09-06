import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Search,
  Loader2,
  Globe,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Check,
  Building,
  User,
  Plus,
  LineChart,
} from 'lucide-react';
import { AssetType, Holding } from '../types';
import {
  searchYahooFinanceSymbols,
  SearchSymbolResult,
  GETQUIN_TOP_MOVERS,
  GETQUIN_DEFAULT_LAST_SEARCHES,
  GETQUIN_MOST_SEARCHED,
} from '../services/symbolSearchService';
import { fetchLiveQuotes } from '../services/quotesService';
import { formatCurrency, ASSET_TYPE_COLORS } from '../utils/formatters';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (holding: Omit<Holding, 'id'>) => void;
  currency: 'EUR' | 'USD';
  onViewAssetChart?: (symbol: string, name?: string) => void;
}

const STORAGE_KEY_LAST_SEARCHES = 'getquin_last_searches_v1';

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currency,
  onViewAssetChart,
}) => {
  const [step, setStep] = useState<'search' | 'details'>('search');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchSymbolResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [lastSearches, setLastSearches] = useState<SearchSymbolResult[]>([]);

  // Selected asset state
  const [selectedAsset, setSelectedAsset] = useState<SearchSymbolResult | null>(null);
  const [shares, setShares] = useState<string>('');
  const [buyPrice, setBuyPrice] = useState<string>('');
  const [assetType, setAssetType] = useState<AssetType>('stock');
  const [isPriceLoading, setIsPriceLoading] = useState(false);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [error, setError] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<any>(null);

  // Load last searches
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LAST_SEARCHES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLastSearches(parsed);
          return;
        }
      }
    } catch {
      // fallback
    }
    setLastSearches(GETQUIN_DEFAULT_LAST_SEARCHES);
  }, []);

  const saveLastSearches = (items: SearchSymbolResult[]) => {
    setLastSearches(items);
    try {
      localStorage.setItem(STORAGE_KEY_LAST_SEARCHES, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save recent searches', e);
    }
  };

  const removeLastSearch = (e: React.MouseEvent, symbol: string) => {
    e.stopPropagation();
    const updated = lastSearches.filter((s) => s.symbol !== symbol);
    saveLastSearches(updated);
  };

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      setStep('search');
      setSearchQuery('');
      setResults([]);
      setError('');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      const res = await searchYahooFinanceSymbols(searchQuery);
      setResults(res);
      setIsSearching(false);
    }, 250);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery]);

  // Select asset handler
  const handleSelectAsset = async (item: SearchSymbolResult) => {
    setSelectedAsset(item);
    setAssetType(item.mappedAssetType || 'stock');
    setStep('details');
    setError('');
    setBuyPrice('');
    setLivePrice(null);

    // Save to last searches history
    const filtered = lastSearches.filter((s) => s.symbol !== item.symbol);
    saveLastSearches([item, ...filtered].slice(0, 8));

    // Fetch freshest live price
    setIsPriceLoading(true);
    try {
      const quotes = await fetchLiveQuotes([item.symbol]);
      const q = quotes[item.symbol.toUpperCase()];
      if (q && q.regularMarketPrice && q.regularMarketPrice > 0) {
        setBuyPrice(String(q.regularMarketPrice));
        setLivePrice(q.regularMarketPrice);
      }
    } catch (e) {
      console.error('Error fetching live quote for new asset:', e);
    } finally {
      setIsPriceLoading(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;

    const numShares = parseFloat(shares);
    const numPrice = parseFloat(buyPrice);

    if (isNaN(numShares) || numShares <= 0) {
      setError('Por favor, introduza uma quantidade válida de cotas.');
      return;
    }

    if (isNaN(numPrice) || numPrice < 0) {
      setError('Por favor, introduza um preço de compra válido.');
      return;
    }

    onSave({
      ticker: selectedAsset.symbol.toUpperCase(),
      name: selectedAsset.name || selectedAsset.symbol,
      shares: numShares,
      buyPrice: numPrice,
      currentPrice: livePrice && livePrice > 0 ? livePrice : numPrice,
      change24h: selectedAsset.change24h || 0,
      change24hPercent: selectedAsset.change24hPercent || 0,
      assetType,
      currency,
      purchaseDate: new Date().toISOString().split('T')[0],
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-4">
      <div
        className="w-full sm:max-w-lg bg-white h-[90vh] sm:h-auto sm:max-h-[85vh] rounded-t-[28px] sm:rounded-3xl border border-slate-200/80 shadow-2xl flex flex-col overflow-hidden text-slate-900 pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        {/* iOS Drag Handle */}
        <div className="w-10 h-1 rounded-full bg-slate-300 mx-auto mt-2 sm:hidden shrink-0" />

        {/* STEP 1: ASSET SEARCH */}
        {step === 'search' ? (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Search Header */}
            <div className="p-4 border-b border-slate-100 flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Pesquisar por ticker ou empresa (ex: AAPL, VWCE, BTC)..."
                  className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5 no-scrollbar">
              {isSearching ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  <span className="text-xs">A pesquisar cotações em tempo real...</span>
                </div>
              ) : searchQuery.trim().length > 0 ? (
                /* Results List */
                <div>
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 font-mono">
                    Resultados ({results.length})
                  </h3>
                  {results.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      Nenhum resultado encontrado para "{searchQuery}".
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 -mx-4">
                      {results.map((item) => (
                        <div
                          key={item.symbol}
                          onClick={() => handleSelectAsset(item)}
                          className="px-4 py-3 active:bg-slate-50 flex items-center justify-between gap-3 transition-colors cursor-pointer touch-manipulation"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center font-mono font-bold text-xs text-slate-800 shrink-0">
                              {item.symbol.slice(0, 3)}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-slate-900 truncate">
                                {item.symbol}
                              </div>
                              <div className="text-xs text-slate-500 truncate">
                                {item.name}
                              </div>
                              <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">
                                {item.typeDisp || item.mappedAssetType} • {item.exchange || 'Global'}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Plus className="w-4 h-4 text-blue-600" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Default State: Recent Searches & Top Movers */
                <div className="space-y-4">
                  {lastSearches.length > 0 && (
                    <div>
                      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 font-mono">
                        Pesquisas Recentes
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {lastSearches.map((item) => (
                          <div
                            key={item.symbol}
                            onClick={() => handleSelectAsset(item)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-800 transition-colors cursor-pointer touch-manipulation"
                          >
                            <span className="font-bold">{item.symbol}</span>
                            <span className="text-slate-400 text-[10px]">{item.typeDisp || item.mappedAssetType}</span>
                            <button
                              type="button"
                              onClick={(e) => removeLastSearch(e, item.symbol)}
                              className="text-slate-400 hover:text-slate-700 p-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 font-mono">
                      Mais Populares
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {GETQUIN_MOST_SEARCHED.slice(0, 6).map((item) => (
                        <div
                          key={item.symbol}
                          onClick={() => handleSelectAsset(item)}
                          className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200/60 flex items-center justify-between cursor-pointer transition-colors touch-manipulation"
                        >
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-slate-900 block truncate">
                              {item.symbol}
                            </span>
                            <span className="text-[11px] text-slate-500 block truncate">
                              {item.name}
                            </span>
                          </div>
                          <Plus className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* STEP 2: TRANSACTION DETAILS */
          <form onSubmit={handleSave} className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep('search')}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    {selectedAsset?.symbol}
                  </h2>
                  <p className="text-[11px] text-slate-500 truncate max-w-[200px]">
                    {selectedAsset?.name}
                  </p>
                </div>
              </div>

              {onViewAssetChart && selectedAsset && (
                <button
                  type="button"
                  onClick={() => onViewAssetChart(selectedAsset.symbol, selectedAsset.name)}
                  className="text-xs font-semibold text-blue-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <LineChart className="w-3.5 h-3.5" /> Ver Gráfico
                </button>
              )}
            </div>

            {/* Inputs */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                  {error}
                </div>
              )}

              {/* Asset Type Selector */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
                  Tipo de Ativo
                </label>
                <div className="grid grid-cols-4 gap-1.5 bg-slate-100 p-0.5 rounded-xl">
                  {(['etf', 'stock', 'crypto', 'cash'] as AssetType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setAssetType(t)}
                      className={`py-1.5 text-xs font-semibold rounded-lg capitalize transition-all cursor-pointer ${
                        assetType === t
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Shares */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
                  Quantidade (Cotas / Unidades)
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={shares}
                  onChange={(e) => setShares(e.target.value)}
                  placeholder="Ex: 10 ou 0.5432"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:bg-white focus:border-blue-500 outline-none transition-colors"
                />
              </div>

              {/* Buy Price */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Preço de Compra por Cota ({currency})
                  </label>
                  {isPriceLoading ? (
                    <span className="text-[11px] text-blue-600 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> A obter cotação...
                    </span>
                  ) : (
                    livePrice && (
                      <span className="text-[11px] text-slate-500 font-mono">
                        Cotação de mercado: {formatCurrency(livePrice, currency)}
                      </span>
                    )
                  )}
                </div>
                <input
                  type="number"
                  step="any"
                  required
                  value={buyPrice}
                  onChange={(e) => setBuyPrice(e.target.value)}
                  placeholder="Ex: 85.50"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:bg-white focus:border-blue-500 outline-none transition-colors"
                />
              </div>

              {/* Calculated Total */}
              {parseFloat(shares) > 0 && parseFloat(buyPrice) > 0 && (
                <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">Investimento Total:</span>
                  <span className="text-sm font-bold font-mono text-blue-700">
                    {formatCurrency(parseFloat(shares) * parseFloat(buyPrice), currency)}
                  </span>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setStep('search')}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                Adicionar Posição
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

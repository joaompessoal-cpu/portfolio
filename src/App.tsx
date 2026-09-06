/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, RefreshCw, Layers, Upload, ArrowUpDown } from 'lucide-react';
import { Holding, PortfolioStats } from './types';
import { INITIAL_HOLDINGS } from './data/initialHoldings';
import { fetchLiveQuotes } from './services/quotesService';
import { BentoHeader } from './components/BentoHeader';
import { BentoStats } from './components/BentoStats';
import { AllocationDonut } from './components/AllocationDonut';
import { HoldingsTable } from './components/HoldingsTable';
import { TransactionModal } from './components/TransactionModal';
import { AssetDetailModal } from './components/AssetDetailModal';
import { ExcelImportZone } from './components/ExcelImportZone';

const STORAGE_KEY_HOLDINGS = 'getquin_bento_holdings_v1';
const STORAGE_KEY_CURRENCY = 'getquin_bento_currency_v1';

export default function App() {
  // 1. Holdings State (localStorage persistence)
  const [holdings, setHoldings] = useState<Holding[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HOLDINGS);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load holdings from localStorage', e);
    }
    return INITIAL_HOLDINGS;
  });

  // 2. Base Currency (EUR / USD)
  const [currency, setCurrency] = useState<'EUR' | 'USD'>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CURRENCY);
      if (saved === 'EUR' || saved === 'USD') return saved;
    } catch {
      // ignore
    }
    return 'EUR';
  });

  // 3. Status State
  const [isUpdating, setIsUpdating] = useState(false);
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAssetForDetail, setSelectedAssetForDetail] = useState<{
    symbol: string;
    name?: string;
    holding?: Holding | null;
  } | null>(null);

  // Persist holdings
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_HOLDINGS, JSON.stringify(holdings));
    } catch (e) {
      console.error('Failed to persist holdings', e);
    }
  }, [holdings]);

  // Persist currency
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CURRENCY, currency);
    } catch {
      // ignore
    }
  }, [currency]);

  // Real-time quote refresh with Finnhub & Yahoo Finance fallback
  const refreshQuotes = useCallback(async () => {
    setIsUpdating(true);

    try {
      const symbolsToFetch = holdings
        .filter((h) => h.assetType !== 'cash')
        .map((h) => h.ticker);

      const fallbackPricesMap: Record<string, number> = {};
      holdings.forEach((h) => {
        if (h.buyPrice > 0) {
          fallbackPricesMap[h.ticker.toUpperCase()] = h.buyPrice;
        }
      });

      const liveQuotes = await fetchLiveQuotes(symbolsToFetch, fallbackPricesMap);

      setHoldings((prevHoldings) =>
        prevHoldings.map((h) => {
          if (h.assetType === 'cash') return h;

          const quote = liveQuotes[h.ticker.toUpperCase()];
          if (quote && quote.regularMarketPrice && quote.regularMarketPrice > 0) {
            return {
              ...h,
              currentPrice: quote.regularMarketPrice,
              change24h: quote.regularMarketChange ?? h.change24h,
              change24hPercent: quote.regularMarketChangePercent ?? h.change24hPercent,
              lastUpdated: new Date().toISOString(),
            };
          }

          const safePrice = h.currentPrice && h.currentPrice > 0 ? h.currentPrice : h.buyPrice;
          return {
            ...h,
            currentPrice: safePrice,
          };
        })
      );
      setSecondsSinceUpdate(0);
    } catch (err) {
      console.error('Error refreshing portfolio quotes:', err);
    } finally {
      setIsUpdating(false);
    }
  }, [holdings]);

  // Second counter for "Atualizado há Xs"
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsSinceUpdate((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute portfolio statistics
  const stats: PortfolioStats = useMemo(() => {
    let totalValue = 0;
    let totalCost = 0;
    let dailyProfit = 0;

    holdings.forEach((h) => {
      const positionValue = h.shares * h.currentPrice;
      const positionCost = h.shares * h.buyPrice;
      totalValue += positionValue;
      totalCost += positionCost;

      if (h.assetType !== 'cash') {
        dailyProfit += (h.change24h || 0) * h.shares;
      }
    });

    const totalProfit = totalValue - totalCost;
    const totalProfitPercent = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
    const previousDayValue = totalValue - dailyProfit;
    const dailyProfitPercent = previousDayValue > 0 ? (dailyProfit / previousDayValue) * 100 : 0;

    return {
      totalValue,
      totalCost,
      totalProfit,
      totalProfitPercent,
      dailyProfit,
      dailyProfitPercent,
      pwrAnnualized: 12.85,
    };
  }, [holdings]);

  // Handlers
  const handleCurrencyToggle = () => {
    setCurrency((prev) => (prev === 'EUR' ? 'USD' : 'EUR'));
  };

  const handleDeleteHolding = (id: string) => {
    setHoldings((prev) => prev.filter((h) => h.id !== id));
  };

  const handleSaveHolding = (newHoldingData: Omit<Holding, 'id'>) => {
    const newHolding: Holding = {
      ...newHoldingData,
      id: Date.now().toString(),
    };
    setHoldings((prev) => [newHolding, ...prev]);
  };

  const handleImportHoldings = (importedHoldings: Holding[], mode: 'replace' | 'merge') => {
    if (mode === 'replace') {
      try {
        localStorage.removeItem(STORAGE_KEY_HOLDINGS);
        localStorage.setItem(STORAGE_KEY_HOLDINGS, JSON.stringify(importedHoldings));
      } catch (e) {
        console.error('Failed to reset localStorage holdings', e);
      }
      setHoldings(importedHoldings);
    } else {
      setHoldings((prev) => {
        const map = new Map<string, Holding>();
        prev.forEach((h) => {
          map.set(h.ticker.toUpperCase(), { ...h });
        });

        importedHoldings.forEach((imported) => {
          const key = imported.ticker.toUpperCase();
          const existing = map.get(key);
          if (existing) {
            const totalShares = existing.shares + imported.shares;
            const totalCost = existing.shares * existing.buyPrice + imported.shares * imported.buyPrice;
            const weightedAvg = totalShares > 0 ? totalCost / totalShares : existing.buyPrice;

            map.set(key, {
              ...existing,
              shares: +totalShares.toFixed(4),
              buyPrice: +weightedAvg.toFixed(2),
              currentPrice: imported.currentPrice || existing.currentPrice,
              change24h: imported.change24h || existing.change24h,
              change24hPercent: imported.change24hPercent || existing.change24hPercent,
              lastUpdated: new Date().toISOString(),
            });
          } else {
            map.set(key, imported);
          }
        });

        return Array.from(map.values());
      });
    }
  };

  const handleUpdateHolding = (updated: Holding) => {
    setHoldings((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-['Plus_Jakarta_Sans'] pb-28 md:pb-12 antialiased selection:bg-blue-600 selection:text-white">
      {/* Main Container */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 sm:pt-6 flex flex-col gap-4 sm:gap-6">
        {/* Clean Bento Header */}
        <BentoHeader
          currency={currency}
          onCurrencyToggle={handleCurrencyToggle}
          isUpdating={isUpdating}
          onManualRefresh={refreshQuotes}
          secondsSinceUpdate={secondsSinceUpdate}
        />

        {/* 4-Card Stats Grid */}
        <BentoStats stats={stats} currency={currency} />

        {/* Collapsible Clean Excel/CSV Import Card */}
        <ExcelImportZone
          onImportSuccess={handleImportHoldings}
          baseCurrency={currency}
        />

        {/* Main Bento Grid: 1fr Allocation Donut + 2fr Holdings List */}
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-stretch">
          {/* Left Column: Asset Allocation Donut */}
          <section className="lg:col-span-4 h-full">
            <AllocationDonut
              holdings={holdings}
              totalValue={stats.totalValue}
              currency={currency}
            />
          </section>

          {/* Right Column: Holdings List Card */}
          <section className="lg:col-span-8 h-full">
            <HoldingsTable
              holdings={holdings}
              currency={currency}
              secondsSinceUpdate={secondsSinceUpdate}
              onDeleteHolding={handleDeleteHolding}
              onAddTransactionClick={() => setIsModalOpen(true)}
              onSelectHolding={(holding) =>
                setSelectedAssetForDetail({
                  symbol: holding.ticker,
                  name: holding.name,
                  holding,
                })
              }
            />
          </section>
        </main>
      </div>

      {/* iPhone Safari Ergonomic Bottom Dock (Clean & Uncluttered) */}
      <nav className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-4 py-2 pb-safe flex items-center justify-around z-40 sm:hidden shadow-xs">
        {/* Refresh */}
        <button
          onClick={refreshQuotes}
          disabled={isUpdating}
          className="flex flex-col items-center gap-1 text-slate-500 active:text-blue-600 py-1 px-3 cursor-pointer touch-manipulation"
        >
          <RefreshCw className={`w-5 h-5 ${isUpdating ? 'animate-spin text-blue-600' : ''}`} />
          <span className="text-[10px] font-medium">Atualizar</span>
        </button>

        {/* Add Asset (Prominent Thumb-Friendly Button) */}
        <button
          id="btn-add-asset-mobile"
          onClick={() => setIsModalOpen(true)}
          className="w-12 h-12 bg-blue-600 active:bg-blue-700 text-white rounded-2xl flex items-center justify-center shadow-md shadow-blue-600/30 active:scale-95 transition-all cursor-pointer touch-manipulation"
          title="Adicionar Ativo"
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </button>

        {/* Currency Toggle */}
        <button
          onClick={handleCurrencyToggle}
          className="flex flex-col items-center gap-1 text-slate-500 active:text-blue-600 py-1 px-3 cursor-pointer touch-manipulation"
        >
          <ArrowUpDown className="w-5 h-5" />
          <span className="text-[10px] font-medium">{currency}</span>
        </button>
      </nav>

      {/* Desktop Floating Action Button */}
      <button
        id="btn-add-asset-fab"
        onClick={() => setIsModalOpen(true)}
        className="hidden sm:flex fixed bottom-6 right-6 lg:bottom-8 lg:right-8 w-13 h-13 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-2xl items-center justify-center shadow-lg shadow-blue-600/25 transition-all cursor-pointer z-40 group"
        title="Adicionar Novo Ativo"
      >
        <Plus className="w-6 h-6 stroke-[2.5] group-hover:rotate-90 transition-transform duration-200" />
      </button>

      {/* Transaction Entry Modal */}
      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveHolding}
        currency={currency}
        onViewAssetChart={(symbol, name) => {
          setIsModalOpen(false);
          setSelectedAssetForDetail({
            symbol,
            name,
            holding:
              holdings.find((h) => h.ticker.toUpperCase() === symbol.toUpperCase()) ||
              null,
          });
        }}
      />

      {/* Asset Detail & Real Historical Chart Modal */}
      {selectedAssetForDetail && (
        <AssetDetailModal
          isOpen={!!selectedAssetForDetail}
          onClose={() => setSelectedAssetForDetail(null)}
          symbol={selectedAssetForDetail.symbol}
          name={selectedAssetForDetail.name}
          currentHolding={
            selectedAssetForDetail.holding ||
            holdings.find(
              (h) =>
                h.ticker.toUpperCase() ===
                selectedAssetForDetail.symbol.toUpperCase()
            ) ||
            null
          }
          baseCurrency={currency}
          onAddToPortfolio={handleSaveHolding}
          onUpdateHolding={handleUpdateHolding}
        />
      )}
    </div>
  );
}

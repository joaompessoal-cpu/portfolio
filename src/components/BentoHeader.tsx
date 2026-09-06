import React from 'react';
import { RefreshCw, ArrowUpDown } from 'lucide-react';

interface BentoHeaderProps {
  currency: 'EUR' | 'USD';
  onCurrencyToggle: () => void;
  isUpdating: boolean;
  onManualRefresh: () => void;
  secondsSinceUpdate: number;
}

export const BentoHeader: React.FC<BentoHeaderProps> = ({
  currency,
  onCurrencyToggle,
  isUpdating,
  onManualRefresh,
  secondsSinceUpdate,
}) => {
  return (
    <header className="flex items-center justify-between gap-3 pt-safe">
      {/* Brand & Status */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center font-extrabold text-white text-base shadow-xs">
          Q
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900">
              getquin <span className="font-medium text-slate-400">Pro</span>
            </h1>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            {isUpdating ? 'A sincronizar cotações...' : `Atualizado há ${secondsSinceUpdate}s`}
          </p>
        </div>
      </div>

      {/* Clean Quick Actions */}
      <div className="flex items-center gap-2">
        {/* Currency Switcher */}
        <button
          id="btn-currency-toggle"
          onClick={onCurrencyToggle}
          className="min-h-[40px] px-3 py-1.5 text-xs font-semibold rounded-xl bg-white hover:bg-slate-100 active:scale-95 border border-slate-200/80 text-slate-700 shadow-xs transition-all flex items-center gap-1.5 cursor-pointer touch-manipulation"
          title="Alternar Moeda"
        >
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
          <span className={currency === 'EUR' ? 'text-blue-600 font-bold' : 'text-slate-500'}>EUR</span>
          <span className="text-slate-300">/</span>
          <span className={currency === 'USD' ? 'text-blue-600 font-bold' : 'text-slate-500'}>USD</span>
        </button>

        {/* Manual Refresh Button */}
        <button
          id="btn-manual-refresh"
          onClick={onManualRefresh}
          disabled={isUpdating}
          className="min-h-[40px] px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer touch-manipulation"
          title="Atualizar cotações (Finnhub & Yahoo Finance)"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{isUpdating ? 'A carregar...' : 'Atualizar'}</span>
        </button>
      </div>
    </header>
  );
};

import React from 'react';
import { TrendingUp, TrendingDown, Award, Calendar } from 'lucide-react';
import { PortfolioStats } from '../types';
import { formatCurrency, formatPercent } from '../utils/formatters';

interface BentoStatsProps {
  stats: PortfolioStats;
  currency: 'EUR' | 'USD';
}

export const BentoStats: React.FC<BentoStatsProps> = ({ stats, currency }) => {
  const isTotalProfitPos = stats.totalProfit >= 0;
  const isDailyProfitPos = stats.dailyProfit >= 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* 1. Total Portfolio */}
      <div
        id="card-total-portfolio"
        className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between gap-2"
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 font-mono">
            Património Total
          </span>
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-['Plus_Jakarta_Sans']">
            {formatCurrency(stats.totalValue, currency)}
          </div>
          <div className="text-[11px] sm:text-xs mt-1 font-semibold flex items-center gap-1">
            <span className={isDailyProfitPos ? 'text-emerald-600' : 'text-rose-600'}>
              {formatPercent(stats.dailyProfitPercent)}
            </span>
            <span className="text-slate-400 font-normal">Hoje</span>
          </div>
        </div>
      </div>

      {/* 2. Total Profit/Loss */}
      <div
        id="card-total-pnl"
        className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between gap-2"
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 font-mono">
            Lucro Acumulado
          </span>
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isTotalProfitPos ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            {isTotalProfitPos ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          </div>
        </div>
        <div>
          <div className={`text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight font-['Plus_Jakarta_Sans'] ${isTotalProfitPos ? 'text-emerald-600' : 'text-rose-600'}`}>
            {stats.totalProfit >= 0 ? '+ ' : ''}{formatCurrency(stats.totalProfit, currency)}
          </div>
          <div className="text-[11px] sm:text-xs mt-1 font-semibold flex items-center gap-1">
            <span className={isTotalProfitPos ? 'text-emerald-600' : 'text-rose-600'}>
              {formatPercent(stats.totalProfitPercent)}
            </span>
            <span className="text-slate-400 font-normal">Total</span>
          </div>
        </div>
      </div>

      {/* 3. PWR / CAGR */}
      <div
        id="card-pwr-cagr"
        className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between gap-2"
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 font-mono">
            PWR Anualizado
          </span>
          <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <Award className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight font-['Plus_Jakarta_Sans']">
            {stats.pwrAnnualized.toFixed(2)}%
          </div>
          <div className="text-[11px] sm:text-xs mt-1 font-medium text-emerald-600 flex items-center gap-1">
            <span>vs S&P 500</span>
            <span className="text-slate-400 font-normal">• CAGR</span>
          </div>
        </div>
      </div>

      {/* 4. Daily Yield (24h) */}
      <div
        id="card-daily-yield"
        className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between gap-2"
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 font-mono">
            Variação Diária
          </span>
          <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
            <Calendar className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className={`text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight font-['Plus_Jakarta_Sans'] ${isDailyProfitPos ? 'text-emerald-600' : 'text-rose-600'}`}>
            {stats.dailyProfit >= 0 ? '+ ' : ''}{formatCurrency(stats.dailyProfit, currency)}
          </div>
          <div className="text-[11px] sm:text-xs mt-1 font-semibold flex items-center gap-1">
            <span className={isDailyProfitPos ? 'text-emerald-600' : 'text-rose-600'}>
              {formatPercent(stats.dailyProfitPercent)}
            </span>
            <span className="text-slate-400 font-normal">24 horas</span>
          </div>
        </div>
      </div>
    </div>
  );
};
